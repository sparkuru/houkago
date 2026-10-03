#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Load literal dotenv configuration and inspect owned preview endpoints safely."""

import argparse
import datetime
import hashlib
import ipaddress
import json
import os
from pathlib import Path
import re
import subprocess
import sys
from typing import Iterator
import urllib.error
import urllib.parse
import urllib.request


class ConfigError(ValueError):
    """A configuration or runtime prerequisite requires user action."""


class CLIStyle:
    """Respect terminal and NO_COLOR when displaying help or errors."""

    @staticmethod
    def color(text: str, role: str = "content") -> str:
        """Apply a semantic style only on an interactive terminal."""
        if not sys.stderr.isatty() or "NO_COLOR" in os.environ:
            return text
        codes = {"title": "36", "option": "32", "error": "31", "content": "37"}
        return f"\033[1;{codes[role]}m{text}\033[0m"


class ColoredArgumentParser(argparse.ArgumentParser):
    """Style the helper's CLI without coloring machine-readable output."""

    def format_help(self) -> str:
        """Display styled help with a concrete invocation example."""
        return CLIStyle.color(super().format_help(), "title")


def parse_dotenv(path: Path) -> dict[str, str]:
    """Parse literal dotenv values, retaining empties and rejecting duplicates."""
    source = path.read_text(encoding="utf-8-sig")
    values: dict[str, str] = {}
    lines = iter(enumerate(source.splitlines(), 1))
    for line_number, line in lines:
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        match = re.fullmatch(r"(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)", stripped)
        if not match:
            raise ConfigError(f".env line {line_number}: expected KEY=value")
        key, raw = match.groups()
        if key in values:
            raise ConfigError(f".env duplicate key {key}; keep one explicit value")
        value = parse_value(raw, lines, key, line_number)
        if "\0" in value:
            raise ConfigError(f".env key {key}: NUL characters are unsupported")
        values[key] = value
    return values


def parse_value(raw: str, lines: Iterator[tuple[int, str]], key: str, line_number: int) -> str:
    """Handle dotenv quoting and comments without shell evaluation/expansion."""
    if not raw.startswith(("'", '"')):
        return re.split(r"\s+#", raw, maxsplit=1)[0].strip()
    quote = raw[0]
    collected = raw[1:]
    while True:
        escaped = False
        for offset, character in enumerate(collected):
            if character == quote and not escaped:
                tail = collected[offset + 1:].strip()
                if tail and not tail.startswith("#"):
                    raise ConfigError(f".env key {key}: unexpected text after quoted value")
                value = collected[:offset]
                if quote == '"':
                    return re.sub(r"\\([nrt\\\"])", lambda item: {
                        "n": "\n", "r": "\r", "t": "\t", "\\": "\\", '"': '"'
                    }[item[1]], value)
                return value
            escaped = character == "\\" and not escaped if quote == '"' else False
        try:
            _, next_line = next(lines)
        except StopIteration as error:
            raise ConfigError(f".env key {key} at line {line_number}: unterminated quote") from error
        collected += "\n" + next_line


def decimal(value: str, key: str, allow_zero: bool = False) -> str:
    """Normalize a bounded decimal port without accepting signs or whitespace."""
    if not re.fullmatch(r"[0-9]{1,10}", value):
        raise ConfigError(f"{key} must be a decimal port ({0 if allow_zero else 1}-65535)")
    number = int(value)
    if not (0 if allow_zero else 1) <= number <= 65535:
        raise ConfigError(f"{key} must be a decimal port ({0 if allow_zero else 1}-65535)")
    return str(number)


def load_config(root: Path, mode: str, origin: str | None) -> dict[str, str]:
    """Resolve defaults, root dotenv, process overrides, then explicit origin."""
    manifest = json.loads((root / "package.json").read_text())
    defaults = manifest.get("config", {}).get("ports", {})
    ports = [defaults.get("backend"), defaults.get("frontend")]
    if any(type(port) is not int or not 1 <= port <= 65535 for port in ports) or ports[0] == ports[1]:
        raise ConfigError("invalid config.ports in package.json: require distinct ports 1-65535")
    path = root / ".env"
    if mode == "preview" and not path.is_file():
        raise ConfigError("missing root .env; run cp .env.example .env from the repository root")
    local = parse_dotenv(path) if path.is_file() else {}
    values = {
        "DX_IMAGE": "houkago-dev:playwright", "DX_BIND_HOST": "0.0.0.0",
        "HOST": "0.0.0.0", "PORT": str(ports[0]),
        "PREVIEW_FRONTEND_HOST": "0.0.0.0", "PREVIEW_FRONTEND_PORT": str(ports[1]),
        "PREVIEW_BACKEND_PORT": str(ports[0]), "PREVIEW_FRONTEND_PUBLISHED_PORT": str(ports[1]),
        "PREVIEW_READY_TIMEOUT": "60", "PREVIEW_LAN_HOST": "",
        "HOUSOU_DB": "houkago.db", "HOUKAGO_CORS_ORIGIN": "",
    }
    values.update(local)
    relevant = set(values) | {key for key in os.environ if key.startswith(("HOUKAGO_", "VITE_", "PREVIEW_"))}
    for key in relevant:
        if key in os.environ:
            values[key] = os.environ[key]
    if origin is not None:
        values["HOUKAGO_CORS_ORIGIN"] = origin
    for key in ("PORT", "PREVIEW_FRONTEND_PORT", "PREVIEW_BACKEND_PORT", "PREVIEW_FRONTEND_PUBLISHED_PORT"):
        values[key] = decimal(values[key], key, "PUBLISHED" in key or key == "PREVIEW_BACKEND_PORT")
    if values["PORT"] == values["PREVIEW_FRONTEND_PORT"]:
        raise ConfigError("PORT and PREVIEW_FRONTEND_PORT must be distinct container ports")
    if values["PREVIEW_BACKEND_PORT"] != "0" and values["PREVIEW_BACKEND_PORT"] == values["PREVIEW_FRONTEND_PUBLISHED_PORT"]:
        raise ConfigError("published backend and frontend ports must be distinct (or use 0)")
    for key in ("DX_BIND_HOST", "HOST", "PREVIEW_FRONTEND_HOST"):
        try:
            ipaddress.ip_address(values[key])
        except ValueError as error:
            raise ConfigError(f"{key} must be an IPv4 or IPv6 address") from error
    if mode == "preview" and any(values[key] not in ("0.0.0.0", "::") for key in ("HOST", "PREVIEW_FRONTEND_HOST")):
        raise ConfigError("published preview requires HOST/PREVIEW_FRONTEND_HOST=0.0.0.0 or ::; restrict host access with DX_BIND_HOST=127.0.0.1")
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._/:@-]*", values["DX_IMAGE"]):
        raise ConfigError("DX_IMAGE must be a nonempty Docker image reference")
    timeout = values["PREVIEW_READY_TIMEOUT"]
    if not re.fullmatch(r"[0-9]{1,4}", timeout) or not 1 <= int(timeout) <= 3600:
        raise ConfigError("PREVIEW_READY_TIMEOUT must be an integer from 1 to 3600 seconds")
    if not values["HOUSOU_DB"]:
        raise ConfigError("HOUSOU_DB must be nonempty (use houkago.db or :memory:)")
    cors = values["HOUKAGO_CORS_ORIGIN"]
    parsed = urllib.parse.urlsplit(cors)
    try:
        origin_port = parsed.port
    except ValueError as error:
        raise ConfigError("HOUKAGO_CORS_ORIGIN/--origin port must be a decimal port from 1 to 65535") from error
    if origin_port == 0 or (cors and parsed.netloc.endswith(":")):
        raise ConfigError("HOUKAGO_CORS_ORIGIN/--origin port must be a decimal port from 1 to 65535")
    if cors and (parsed.scheme not in ("http", "https") or not parsed.hostname or parsed.path or parsed.query or parsed.fragment or parsed.username is not None or re.search(r"\s", cors)):
        raise ConfigError("HOUKAGO_CORS_ORIGIN/--origin must be one http(s) origin without a path or credentials")
    lan = values["PREVIEW_LAN_HOST"]
    if lan:
        try:
            address = ipaddress.ip_address(lan)
        except ValueError:
            valid_hostname = all(re.fullmatch(r"[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?", label)
                                 for label in lan.rstrip(".").split("."))
            if not valid_hostname or len(lan) > 253 or lan.lower().rstrip(".") == "localhost":
                raise ConfigError("PREVIEW_LAN_HOST must be a hostname/IP without a port, scheme, path or credentials")
        else:
            if address.is_unspecified or address.is_loopback:
                raise ConfigError("PREVIEW_LAN_HOST must be a non-loopback LAN hostname/IP candidate")
    values["PREVIEW_CONFIG_HASH"] = hashlib.sha256(json.dumps(values, sort_keys=True).encode()).hexdigest()
    values["DX_LEGACY_PORTS"] = "1" if not path.is_file() and "DX_BIND_HOST" not in os.environ else "0"
    return values


def emit_values(values: dict[str, str]) -> None:
    """Emit NUL-separated pairs so shell can preserve literals and newlines."""
    for key, value in values.items():
        sys.stdout.buffer.write(f"{key}\0{value}\0".encode())


def docker_json(container: str) -> dict:
    """Inspect a container without forwarding Docker diagnostics or secrets."""
    result = subprocess.run(["docker", "inspect", container], capture_output=True, timeout=5, check=False)
    if result.returncode:
        raise ConfigError("owned preview container disappeared; inspect ./preview.sh status")
    return json.loads(result.stdout)[0]


def owned_runtime(root: Path, container: str, service: str) -> dict:
    """Verify exact ownership and derive actual listener and host mappings."""
    data = docker_json(container)
    labels = data.get("Config", {}).get("Labels", {})
    expected = {"houkago.repo": str(root), "houkago.scope": "preview", "houkago.service": service}
    if any(labels.get(key) != value for key, value in expected.items()):
        raise ConfigError("container ownership mismatch; refusing to operate")
    port = labels["houkago.port"]
    mappings = data.get("NetworkSettings", {}).get("Ports", {}).get(f"{port}/tcp") or []
    return {"id": data["Id"], "service": service, "state": data["State"]["Status"],
            "host": labels["houkago.host"], "port": port, "mappings": mappings,
            "hash": labels["houkago.config"], "lan": labels.get("houkago.lan", ""),
            "started": data["State"].get("StartedAt", ""), "timeout": labels.get("houkago.timeout", "60")}


def url_host(host: str) -> str:
    """Bracket IPv6 hosts in directly openable URLs."""
    return f"[{host}]" if ":" in host else host


def mapping_url(mapping: dict, path: str = "") -> str:
    """Convert wildcard publication to a reachable local probe entry point."""
    host = {"0.0.0.0": "127.0.0.1", "::": "::1", "": "127.0.0.1"}.get(mapping["HostIp"], mapping["HostIp"])
    return f"http://{url_host(host)}:{mapping['HostPort']}{path}"


def probe(runtime: dict) -> None:
    """Check both the owned container listener and its inspected publication."""
    name = runtime["service"]
    if runtime["state"] != "running":
        raise ConfigError(f"{name}: container is {runtime['state']}; restart with ./preview.sh stop then start")
    if not runtime["mappings"]:
        raise ConfigError(f"{name}: no published endpoint")
    backend = name == "housou"
    path = "/health" if backend else "/"
    script = ('const p=process.env.PORT; const h=process.env.HOST==="::"?"[::1]":"127.0.0.1";' if backend else
              'const p=process.env.PREVIEW_FRONTEND_PORT; const h=process.env.PREVIEW_FRONTEND_HOST==="::"?"[::1]":"127.0.0.1";')
    script += f'const r=await fetch(`http://${{h}}:${{p}}{path}`,{{signal:AbortSignal.timeout(1000)}}); if(!r.ok)process.exit(1);'
    if backend:
        script += 'if((await r.json()).ok!==true)process.exit(1);'
    result = subprocess.run(["docker", "exec", runtime["id"], "bun", "--no-env-file", "-e", script],
                            capture_output=True, timeout=3, check=False)
    if result.returncode:
        raise ConfigError(f"{name}: owned container HTTP listener is not ready")
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    for mapping in runtime["mappings"]:
        try:
            with opener.open(mapping_url(mapping, path), timeout=1) as response:
                if response.status != 200 or (backend and json.load(response).get("ok") is not True):
                    raise ConfigError(f"{name}: published HTTP endpoint is not ready")
        except (urllib.error.URLError, TimeoutError, OSError, ValueError) as error:
            raise ConfigError(f"{name}: published HTTP endpoint is not ready") from error


def report(runtimes: list[dict], ready: bool) -> None:
    """Report verified listeners separately from effective Docker mappings."""
    if ready:
        print(CLIStyle.color("System is ready."))
    for runtime in runtimes:
        name = runtime["service"]
        mark = "container; HTTP" if ready else "container; HTTP listener unverified"
        print(CLIStyle.color(f"Listening {name}: {url_host(runtime['host'])}:{runtime['port']} ({mark})"))
        for mapping in runtime["mappings"]:
            print(CLIStyle.color(f"Published {name}: {url_host(mapping['HostIp'])}:{mapping['HostPort']} -> {url_host(runtime['host'])}:{runtime['port']}"))
            if ready:
                label = "API" if name == "housou" else "Website"
                print(CLIStyle.color(f"{label}: {mapping_url(mapping)}"))
                if mapping["HostIp"] in ("0.0.0.0", "::", "") and runtime["lan"]:
                    print(CLIStyle.color(f"Host/LAN {label} (candidate, untested): http://{url_host(runtime['lan'])}:{mapping['HostPort']}"))
    if ready and not any(runtime["lan"] for runtime in runtimes):
        print(CLIStyle.color("LAN access: use your reachable host address; cross-device reachability is unverified."))


def main() -> int:
    """Dispatch config loading or read-only preview inspection."""
    parser = ColoredArgumentParser(description="Internal preview configuration/runtime helper",
                                   epilog="Example: python3 scripts/preview-config.py load . dx")
    parser.add_argument("action", choices=("load", "runtime", "probe", "report", "status"))
    parser.add_argument("root", type=Path)
    parser.add_argument("arguments", nargs="*")
    parser.add_argument("--origin")
    parser.add_argument("--log", action="store_true", help="Reserved for diagnostics; secrets are never logged")
    args = parser.parse_args()
    root = args.root.resolve()
    runtimes: list[dict] = []
    try:
        if args.action == "load":
            emit_values(load_config(root, args.arguments[0], args.origin))
            return 0
        if args.action == "runtime":
            runtime = owned_runtime(root, args.arguments[0], args.arguments[1])
            emit_values({"state": runtime["state"], "hash": runtime["hash"],
                         "published_port": runtime["mappings"][0]["HostPort"] if runtime["mappings"] else ""})
            return 0
        if len(args.arguments) != 2:
            raise ConfigError("both owned Housou and React containers are required")
        runtimes = [owned_runtime(root, item, service) for item, service in zip(args.arguments, ("housou", "kyoushitsu-react"))]
        if args.action == "report":
            if any(runtime["state"] != "running" or not runtime["mappings"] for runtime in runtimes):
                raise ConfigError("required service exited or lost publication before readiness summary; inspect ./preview.sh status")
            report(runtimes, True)
            return 0
        for runtime in runtimes:
            probe(runtime)
        if args.action == "status":
            print(CLIStyle.color("Preview status: ready"))
            report(runtimes, True)
        return 0
    except ConfigError as error:
        if args.action == "status":
            starting = False
            for runtime in runtimes:
                if runtime["state"] != "running":
                    continue
                started = datetime.datetime.fromisoformat(runtime["started"].replace("Z", "+00:00"))
                starting |= (datetime.datetime.now(datetime.timezone.utc) - started).total_seconds() < int(runtime["timeout"])
            print(CLIStyle.color(f"Preview status: {'starting' if starting else 'unhealthy'}"))
            report(runtimes, False)
        print(CLIStyle.color(f"preview: {error}", "error"), file=sys.stderr)
        return 1
    except (OSError, ValueError, KeyError, IndexError, subprocess.TimeoutExpired) as error:
        print(CLIStyle.color(f"preview: cannot read configuration/runtime ({type(error).__name__}); check .env, package.json and Docker daemon", "error"), file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
