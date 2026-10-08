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
import shutil
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


def redact_diagnostics(output: str, environment: list[str]) -> str:
    """Hide injected secrets and authenticated URLs in captured service logs."""
    secrets: set[str] = set()
    for entry in environment:
        key, _, value = entry.partition("=")
        if not value:
            continue
        if re.search(r"SECRET|PASSWORD|TOKEN|CREDENTIAL_KEY$", key, re.IGNORECASE):
            secrets.update((value, json.dumps(value)[1:-1]))
        if key == "HOUKAGO_KOMON_USERNAMES":
            secrets.update(item.strip() for item in value.split(",") if item.strip())
    for secret in sorted(secrets, key=len, reverse=True):
        output = output.replace(secret, "<redacted>")
    output = re.sub(r"(https?://)[^\s/@]+:[^\s/@]+@", r"\1<redacted>@", output)
    return re.sub(r"(?i)(Bearer\s+)\S+", r"\1<redacted>", output)


def startup_diagnostics(root: Path, container: str) -> None:
    """Print bounded owned-container logs before a failed attempt is removed."""
    data = docker_json(container)
    labels = data.get("Config", {}).get("Labels", {})
    service = labels.get("houkago.service")
    if service not in ("housou", "kyoushitsu-react") or any(labels.get(key) != value for key, value in {
        "houkago.repo": str(root), "houkago.scope": "preview",
    }.items()):
        raise ConfigError("container ownership mismatch; refusing startup diagnostics")
    print(CLIStyle.color(f"Startup diagnostics ({service}; container {data['State']['Status']}):"), file=sys.stderr)
    result = subprocess.run(["docker", "logs", "--tail", "80", container], capture_output=True,
                            text=True, timeout=5, check=False)
    if result.returncode:
        raise ConfigError(f"{service}: cannot read startup logs")
    output = redact_diagnostics(result.stdout + result.stderr, data["Config"].get("Env", []))
    if output.strip():
        print(CLIStyle.color(output.rstrip()), file=sys.stderr)
    else:
        print(CLIStyle.color("No startup logs available."), file=sys.stderr)
    if service == "housou" and "legacy UUID room data detected" in output:
        print(CLIStyle.color("preview: Housou rejected legacy room data. Preserve the existing database and explicitly choose a new HOUSOU_DB path for preview, or migrate the old data. No database was deleted.", "error"), file=sys.stderr)


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
    try:
        result = subprocess.run(["docker", "exec", runtime["id"], "bun", "--no-env-file", "-e", script],
                                capture_output=True, timeout=3, check=False)
    except (OSError, subprocess.TimeoutExpired) as error:
        raise ConfigError(f"{name}: owned container HTTP probe failed or timed out; inspect ./preview.sh status") from error
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


def require_local_daemon() -> None:
    """Reject remote Docker discovery instead of advertising caller addresses."""
    context = os.environ.get("DOCKER_CONTEXT", "")
    endpoint = os.environ.get("DOCKER_HOST", "") if not context else ""
    if not endpoint:
        # Inspect without a name resolves the active context even on Docker 20.10.
        command = ["docker", "context", "inspect"]
        if context:
            command.append(context)
        result = subprocess.run(command, capture_output=True,
                                text=True, timeout=5, check=False)
        if result.returncode:
            raise ConfigError("cannot inspect Docker context; select a local Docker context before preview")
        try:
            endpoint = json.loads(result.stdout)[0]["Endpoints"]["docker"]["Host"]
        except (ValueError, KeyError, IndexError, TypeError) as error:
            raise ConfigError("Docker context has no inspectable daemon endpoint") from error
    if not isinstance(endpoint, str) or not endpoint.startswith("unix:///"):
        raise ConfigError("remote Docker daemon host address discovery is unavailable; select a local context or provide an authorized daemon-host discovery route and explicit host-address configuration")


def discover_addresses(bind_hosts: list[str]) -> tuple[dict[int, list[str]], list[str]]:
    """Enumerate all host interface addresses for effective wildcard families."""
    families = {ipaddress.ip_address(host or "0.0.0.0").version for host in bind_hosts
                if ipaddress.ip_address(host or "0.0.0.0").is_unspecified}
    addresses: dict[int, list[str]] = {4: [], 6: []}
    notes: list[str] = []
    require_local_daemon()
    if not families:
        return addresses, notes
    if shutil.which("ip") is None:
        raise ConfigError("required command not found: ip; install iproute2 on the preview host before wildcard startup")
    try:
        result = subprocess.run(["ip", "-br", "a"], capture_output=True, text=True, timeout=5, check=False)
    except (OSError, subprocess.TimeoutExpired) as error:
        raise ConfigError("host address discovery failed or timed out: ip -br a; check iproute2 and host interface access") from error
    if result.returncode:
        raise ConfigError("host address discovery failed: ip -br a; check iproute2 and host interface access")
    omitted_link_local = False
    for row in result.stdout.splitlines():
        fields = row.split()
        if len(fields) < 3 or fields[1] not in ("UP", "UNKNOWN"):
            continue
        for field in fields[2:]:
            try:
                address = ipaddress.ip_interface(field).ip
            except ValueError:
                continue
            if address.version not in families or address.is_unspecified or address.is_loopback:
                continue
            if address.version == 6 and address.is_link_local:
                omitted_link_local = True
                continue
            value = str(address)
            if value not in addresses[address.version]:
                addresses[address.version].append(value)
    notes.append("Host addresses enumerated with ip -br a; access from other devices is unverified.")
    if not any(addresses[family] for family in families):
        notes.append("No non-loopback host address found.")
    if omitted_link_local:
        notes.append("Link-local IPv6 addresses omitted because device-specific zone identifiers are required.")
    return addresses, notes


def configured_candidate(host: str, bind: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    """Limit literal hints to the actual publishing family or bound address."""
    if not host or bind.is_loopback:
        return False
    try:
        address = ipaddress.ip_address(host)
    except ValueError:
        return True
    if address.is_loopback or address.is_unspecified or (address.version == 6 and address.is_link_local):
        return False
    return address.version == bind.version if bind.is_unspecified else address == bind


def entry_urls(runtime: dict, addresses: dict[int, list[str]]) -> tuple[list[str], list[str]]:
    """Separate remote candidates from preview-host loopback browser entries."""
    remote: list[str] = []
    local: list[str] = []
    for mapping in runtime["mappings"]:
        bind = ipaddress.ip_address(mapping["HostIp"] or "0.0.0.0")
        hosts = addresses[bind.version][:] if bind.is_unspecified else ([] if bind.is_loopback else [str(bind)])
        if configured_candidate(runtime["lan"], bind) and runtime["lan"] not in hosts:
            hosts.append(runtime["lan"])
        remote.extend(f"http://{url_host(host)}:{mapping['HostPort']}" for host in hosts)
        if bind.is_unspecified or bind.is_loopback:
            local.append(mapping_url(mapping))
    return list(dict.fromkeys(remote)), list(dict.fromkeys(local))


def render_section(title: str, lines: list[str]) -> None:
    """Render nonempty mandatory sections with directly copyable URL lines."""
    if lines:
        print(CLIStyle.color(f"\n{title}:"))
        for line in lines:
            print(CLIStyle.color(line))


def report(runtimes: list[dict], ready: bool) -> None:
    """Print the shared browser-first contract after discovery has succeeded."""
    remote_entries: list[str] = []
    local_entries: list[str] = []
    notes: list[str] = []
    if ready:
        bind_hosts = [mapping["HostIp"] for runtime in runtimes for mapping in runtime["mappings"]]
        addresses, notes = discover_addresses(bind_hosts)
        for runtime in runtimes:
            remote, local = entry_urls(runtime, addresses)
            label = "API" if runtime["service"] == "housou" else "Website"
            entry = f"{label} ({runtime['service']}):"
            if remote:
                remote_entries.extend([entry, *remote])
            if local:
                local_entries.extend([entry, *local])
        if remote_entries and not notes:
            notes.append("Access from other devices is unverified.")
        print(CLIStyle.color("System is ready."))
    render_section("Open", remote_entries)
    render_section("Local only (preview host)", local_entries)
    listeners = [f"Listening {runtime['service']}: {url_host(runtime['host'])}:{runtime['port']} "
                 f"(container; HTTP{' listener unverified' if not ready else ''})" for runtime in runtimes]
    published = [f"Published {runtime['service']}: {url_host(mapping['HostIp'])}:{mapping['HostPort']} -> "
                 f"{url_host(runtime['host'])}:{runtime['port']} "
                 f"({'active listener' if ready else 'listener unverified'})"
                 for runtime in runtimes for mapping in runtime["mappings"]]
    render_section("Listeners", listeners)
    render_section("Published", published)
    render_section("Notes", notes)


def main() -> int:
    """Dispatch config loading or read-only preview inspection."""
    parser = ColoredArgumentParser(description="Internal preview configuration/runtime helper",
                                   epilog="Example: python3 scripts/preview-config.py load . dx")
    parser.add_argument("action", choices=("load", "runtime", "probe", "report", "status", "discovery", "diagnostics"))
    parser.add_argument("root", type=Path)
    parser.add_argument("arguments", nargs="*")
    parser.add_argument("--origin")
    parser.add_argument("--log", action="store_true", help="Reserved for diagnostics; secrets are never logged")
    args = parser.parse_args()
    root = args.root.resolve()
    runtimes: list[dict] = []
    try:
        if args.action == "diagnostics":
            startup_diagnostics(root, args.arguments[0])
            return 0
        if args.action == "discovery":
            discover_addresses(args.arguments)
            return 0
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
