#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Check preview configuration and lifecycle using isolated HTTP/Docker fixtures."""

import contextlib
import http.server
import importlib.util
import io
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import sys
import tempfile
import threading
import unittest
from unittest import mock

sys.dont_write_bytecode = True


class FixtureHandler(http.server.BaseHTTPRequestHandler):
    """Serve real host probes independently of the Docker ownership stub."""

    def do_GET(self) -> None:
        """Return the documented health route and frontend root."""
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b'{"ok":true}' if self.path == "/health" else b"<html>fixture</html>")

    def log_message(self, format_string: str, *args: object) -> None:
        """Keep fixture requests out of test output."""


def docker_stub() -> int:
    """Implement only inspected Docker operations and record every mutation."""
    root = Path(os.environ["TEST_DOCKER_STATE"])
    path = root / "state.json"
    state = json.loads(path.read_text()) if path.exists() else {}
    args = sys.argv[2:]
    with (root / "commands.jsonl").open("a") as output:
        output.write(json.dumps(args) + "\n")
    operation = args[0]
    if operation == "context":
        if args[1] == "inspect":
            current = (root / "current-context").read_text() if (root / "current-context").exists() else "default"
            context = args[2] if len(args) > 2 else current
            endpoint = "ssh://fixture-daemon" if context == "remote" else "unix:///fixture/docker.sock"
            print(json.dumps([{"Endpoints": {"docker": {"Host": endpoint}}}]))
        else:
            return 2
        return 0
    if operation == "image":
        return 1 if (root / "missing-image").exists() else 0
    if operation == "build":
        print("fixture build output")
        if (root / "build-fail").exists():
            print("fixture image build failed", file=sys.stderr)
            return 1
        (root / "missing-image").unlink(missing_ok=True)
        return 0
    if operation == "ps":
        filters = [args[index + 1][6:] for index, value in enumerate(args) if value == "--filter"]
        for container, data in state.items():
            labels = data["Config"]["Labels"]
            if all(labels.get(item.split("=", 1)[0]) == item.split("=", 1)[1] for item in filters):
                print(container)
        return 0
    if operation == "inspect":
        if args[1] not in state:
            return 1
        inspected = json.loads(json.dumps(state[args[1]]))
        environment = inspected["Config"].get("Env", {})
        if isinstance(environment, dict):
            inspected["Config"]["Env"] = [f"{key}={value}" for key, value in environment.items()]
        print(json.dumps([inspected]))
        return 0
    if operation == "logs":
        if args[-1] not in state or (root / "logs-fail").exists():
            return 1
        print("fixture startup logs")
        if args[-1] == "owned-backend" and (root / "legacy-failure").exists():
            print("error: legacy UUID room data detected; reset HOUSOU_DB before starting authenticated Houkago", file=sys.stderr)
            print(state[args[-1]]["Config"]["Env"].get("HOUKAGO_BAIDU_CLIENT_SECRET", ""), file=sys.stderr)
            print("https://fixture-user:fixture-password@example.test Bearer fixture-token", file=sys.stderr)
        return 0
    if operation == "exec":
        if (root / "transient-fail").exists():
            (root / "transient-fail").unlink()
            return 1
        return 1 if any((root / flag).exists() for flag in ("internal-fail", "legacy-failure")) else 0
    if operation == "create":
        labels, environment, mappings = {}, {}, {}
        index = 1
        while index < len(args):
            option = args[index]
            if option == "--init":
                index += 1
                continue
            if option not in ("--label", "-e", "-p", "--user", "--name", "-v", "-w"):
                break
            value = args[index + 1]
            if option == "--label":
                key, item = value.split("=", 1)
                labels[key] = item
            elif option == "-e":
                key, _, item = value.partition("=")
                environment[key] = item if "=" in value else os.environ.get(key, "")
            elif option == "-p":
                host, published, port = value.rsplit(":", 2)
                host = host.strip("[]")
                if published == "0":
                    published = os.environ["TEST_BACKEND_PORT" if labels["houkago.service"] == "housou" else "TEST_FRONTEND_PORT"]
                mappings[f"{port}/tcp"] = [{"HostIp": host, "HostPort": published}]
            index += 2
        container = "owned-backend" if labels["houkago.service"] == "housou" else "owned-frontend"
        if container in state:
            return 1
        state[container] = {"Id": container, "Config": {"Labels": labels, "Env": environment},
                            "State": {"Status": "created", "StartedAt": "2000-01-01T00:00:00Z"},
                            "NetworkSettings": {"Ports": mappings}}
        print(container)
    elif operation == "start":
        if (root / "port-conflict").exists():
            print("port is already allocated", file=sys.stderr)
            return 1
        state[args[1]]["State"]["Status"] = "exited" if (root / "early-exit").exists() else "running"
    elif operation == "stop":
        for container in args[1:]:
            state[container]["State"]["Status"] = "exited"
    elif operation == "rm":
        for container in args[1:]:
            if container != "-f":
                state.pop(container, None)
    elif operation == "run":
        if args[-4:] == ["bun", "--no-env-file", "install", "--frozen-lockfile"]:
            print("fixture install output")
            if (root / "install-fail").exists():
                print("fixture dependency install failed", file=sys.stderr)
                return 1
            if not (root / "install-incomplete").exists():
                repo = Path(args[args.index("-v") + 1].removesuffix(":/app"))
                (repo / "packages/housou/node_modules/elysia").mkdir(parents=True, exist_ok=True)
                entry = repo / "packages/kyoushitsu-react/node_modules/vite/bin/vite.js"
                entry.parent.mkdir(parents=True, exist_ok=True)
                entry.touch()
        return 0
    else:
        return 2
    path.write_text(json.dumps(state))
    return 0


def ip_stub() -> int:
    """Provide deterministic host interfaces without inspecting real networking."""
    root = Path(os.environ["TEST_DOCKER_STATE"])
    with (root / "ip-calls").open("a") as output:
        output.write(" ".join(sys.argv[2:]) + "\n")
    if sys.argv[2:] != ["-br", "a"] or (root / "ip-fail").exists():
        return 1
    print((root / "ip-output").read_text(), end="")
    return 0


class PreviewTests(unittest.TestCase):
    """Exercise shell commands from another cwd without touching user's runtime."""

    def setUp(self) -> None:
        """Create isolated source/config and owned/unrelated Docker records."""
        self.workspace = tempfile.TemporaryDirectory(prefix="houkago-preview-test-")
        self.addCleanup(self.workspace.cleanup)
        self.directory = Path(self.workspace.name)
        self.repo = self.directory / "repo"
        self.repo.mkdir()
        self.state = self.directory / "docker"
        self.state.mkdir()
        self.bin = self.directory / "bin"
        self.bin.mkdir()
        source = Path(__file__).resolve().parent.parent
        for relative in ("dx", "preview.sh", "scripts/preview-config.py", "scripts/preview-services.sh"):
            target = self.repo / relative
            target.parent.mkdir(exist_ok=True)
            shutil.copy2(source / relative, target)
        for relative in ("packages/housou/node_modules/elysia", "packages/kyoushitsu-react/node_modules/vite/bin"):
            (self.repo / relative).mkdir(parents=True)
        (self.repo / "packages/kyoushitsu-react/node_modules/vite/bin/vite.js").touch()
        (self.repo / "package.json").write_text('{"config":{"ports":{"backend":3000,"frontend":5173}}}')
        (self.repo / "Dockerfile.dev").write_text("FROM fixture\n")
        (self.repo / "persistence-marker").write_text("retain")
        self.env_path = self.repo / ".env"
        self.env_path.write_text("PREVIEW_BACKEND_PORT=0\nPREVIEW_FRONTEND_PUBLISHED_PORT=0\nPREVIEW_READY_TIMEOUT=1\nHOUKAGO_BAIDU_CLIENT_SECRET='literal $(never) `never`'\nVITE_TEST=public\nPATH=/invalid\nrepo_root=/invalid\n")
        stub = self.bin / "docker"
        stub.write_text(f"#!/bin/sh\nexec {shutil.which('python3')} '{Path(__file__).resolve()}' --docker-stub \"$@\"\n")
        stub.chmod(0o755)
        stub = self.bin / "ip"
        stub.write_text(f"#!/bin/sh\nexec {shutil.which('python3')} '{Path(__file__).resolve()}' --ip-stub \"$@\"\n")
        stub.chmod(0o755)
        for command in ("bash", "dirname", "python3", "id", "mkdir", "mktemp", "rm", "sleep", "cat"):
            (self.bin / command).symlink_to(shutil.which(command))
        (self.state / "ip-output").write_text(
            "lo UNKNOWN 127.0.0.1/8 ::1/128\n"
            "eth0 UP 192.0.2.10/24 192.0.2.11/24 2001:db8::10/64 fe80::1/64\n"
            "eth1 UP 198.51.100.20/24 192.0.2.10/24\n"
            "bridge0 UP 172.18.0.1/16\n"
            "tun0 UNKNOWN 203.0.113.7/32\n"
            "eth2 DOWN 198.51.100.99/24\n"
            "invalid UP nonsense 0.0.0.0/0\n"
        )
        self.environment = {key: value for key, value in os.environ.items() if not key.startswith(("HOUKAGO_", "VITE_", "PREVIEW_", "DX_", "DOCKER_")) and key not in ("HOST", "PORT", "HOUSOU_DB")}
        self.environment.update(PATH=f"{self.bin}:{os.environ['PATH']}", TEST_DOCKER_STATE=str(self.state))
        self.servers = []
        for key in ("TEST_BACKEND_PORT", "TEST_FRONTEND_PORT"):
            server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), FixtureHandler)
            self.environment[key] = str(server.server_port)
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            self.addCleanup(server.server_close)
            self.addCleanup(server.shutdown)
            self.servers.append(server)
        unrelated = {"unrelated": {"Config": {"Labels": {"houkago.repo": "/other", "houkago.scope": "preview", "houkago.service": "housou"}}, "State": {"Status": "running"}}}
        (self.state / "state.json").write_text(json.dumps(unrelated))

    def run_preview(self, *args: str, success: bool = True, overrides: dict[str, str] | None = None) -> subprocess.CompletedProcess:
        """Run actual thin wrapper and dx with captured secret-safe output."""
        result = subprocess.run([str(self.repo / "preview.sh"), *args], cwd=self.directory,
                                env=self.environment | (overrides or {}), capture_output=True, text=True, timeout=20)
        self.assertEqual(result.returncode == 0, success, result.stdout + result.stderr)
        if not success:
            self.assertNotIn("System is ready.", result.stdout)
        self.assertNotIn("literal $(never)", result.stdout + result.stderr)
        return result

    def records(self) -> dict:
        """Read fixture state without printing injected secret values."""
        return json.loads((self.state / "state.json").read_text())

    def commands(self) -> list[list[str]]:
        """Read Docker arguments to assert absence of secret values and builds."""
        path = self.state / "commands.jsonl"
        return [json.loads(line) for line in path.read_text().splitlines()] if path.exists() else []

    def test_background_start_reuse_dynamic_endpoints_and_stop(self) -> None:
        """Inspect actual mapping, reuse only healthy ownership and preserve data."""
        result = self.run_preview("start", overrides={"DX_REBUILD_IMAGE": "1"})
        self.assertIn("System is ready.", result.stdout)
        self.assertIn(f"API (housou):\nhttp://127.0.0.1:{self.environment['TEST_BACKEND_PORT']}", result.stdout)
        self.assertIn(f"Website (kyoushitsu-react):\nhttp://127.0.0.1:{self.environment['TEST_FRONTEND_PORT']}", result.stdout)
        self.assertEqual(result.stderr, "")
        state = self.records()
        self.assertEqual(state["owned-frontend"]["Config"]["Env"]["VITE_HOUSOU_PORT"], self.environment["TEST_BACKEND_PORT"])
        self.assertNotIn("HOUKAGO_BAIDU_CLIENT_SECRET", state["owned-frontend"]["Config"]["Env"])
        self.assertEqual(self.run_preview("start").stdout, result.stdout)
        self.assertEqual(self.run_preview("status").stdout, result.stdout)
        self.assertEqual(sum(command[0] == "create" for command in self.commands()), 2)
        self.assertFalse(any(command[0] in ("build", "run") for command in self.commands()))
        self.assertFalse(any(command[0] == "logs" for command in self.commands()))
        self.assertNotIn("literal $(never)", json.dumps(self.commands()))
        self.run_preview("stop")
        self.run_preview("down")
        self.assertEqual(set(self.records()), {"unrelated"})
        self.assertEqual((self.repo / "persistence-marker").read_text(), "retain")

    def test_all_host_addresses_and_sections(self) -> None:
        """Enumerate secondary, bridge and tunnel candidates per browser entry."""
        result = self.run_preview("start", overrides={"PREVIEW_LAN_HOST": "preview.example.test"})
        labels = ("Open:", "Local only (preview host):", "Listeners:", "Published:", "Notes:")
        positions = [result.stdout.index(label) for label in labels]
        self.assertEqual(positions, sorted(positions))
        opened = result.stdout.split("Open:\n", 1)[1].split("\nLocal only", 1)[0]
        for label, key in (("API (housou):", "TEST_BACKEND_PORT"), ("Website (kyoushitsu-react):", "TEST_FRONTEND_PORT")):
            expected = label + "\n" + "\n".join(f"http://{host}:{self.environment[key]}" for host in (
                "192.0.2.10", "192.0.2.11", "198.51.100.20", "172.18.0.1", "203.0.113.7", "preview.example.test"))
            self.assertIn(expected, opened)
        self.assertNotIn("127.0.0.1", opened)
        self.assertNotIn("198.51.100.99", opened)
        self.assertNotIn("2001:db8", opened)
        self.assertNotIn("http://0.0.0.0", result.stdout)
        self.assertEqual((self.state / "ip-calls").read_text().splitlines(), ["-br a", "-br a"])
        (self.state / "ip-output").write_text("eth9 UP 192.0.2.55/24\n")
        self.assertIn("http://192.0.2.55:", self.run_preview("status").stdout)

    def test_loopback_needs_no_ip_and_has_no_remote_urls(self) -> None:
        """Keep loopback publishing local even with a configured remote hint."""
        (self.bin / "ip").unlink()
        result = self.run_preview("start", overrides={"DX_BIND_HOST": "127.0.0.1", "PREVIEW_LAN_HOST": "preview.example.test", "PATH": str(self.bin)})
        self.assertNotIn("Open:", result.stdout)
        self.assertIn("Local only (preview host):", result.stdout)
        self.assertNotIn("preview.example.test", result.stdout)
        self.assertFalse((self.state / "ip-calls").exists())

    def test_discovery_errors_before_container_creation(self) -> None:
        """Missing/failing host discovery never starts containers or claims ready."""
        (self.state / "ip-fail").touch()
        self.assertIn("ip -br a", self.run_preview("start", success=False).stderr)
        (self.state / "ip-fail").unlink()
        (self.bin / "ip").unlink()
        self.assertIn("required command not found: ip", self.run_preview("start", success=False, overrides={"PATH": str(self.bin)}).stderr)
        self.assertFalse(any(command[0] in ("create", "start") for command in self.commands()))

    def test_remote_daemon_does_not_enumerate_caller(self) -> None:
        """Inspect effective host/context and refuse unavailable remote discovery."""
        for overrides in ({"DOCKER_HOST": "tcp://fixture-daemon:2375"}, {"DOCKER_CONTEXT": "remote", "DOCKER_HOST": "unix:///ignored.sock"}):
            with self.subTest(overrides=overrides):
                result = self.run_preview("start", success=False, overrides=overrides)
                self.assertIn("remote Docker daemon host address discovery is unavailable", result.stderr)
        self.assertFalse((self.state / "ip-calls").exists())
        self.assertFalse(any(command[0] in ("create", "start") for command in self.commands()))
        self.run_preview("start", overrides={"DOCKER_CONTEXT": "default", "DOCKER_HOST": "tcp://ignored-daemon:2375"})

    def test_active_context_on_older_docker(self) -> None:
        """Resolve current contexts without the unsupported context show command."""
        (self.state / "current-context").write_text("remote")
        self.assertIn("remote Docker daemon", self.run_preview("start", success=False).stderr)
        self.assertFalse((self.state / "ip-calls").exists())
        (self.state / "current-context").write_text("default")
        self.run_preview("start")
        self.assertIn(["context", "inspect"], self.commands())
        self.assertNotIn(["context", "show"], self.commands())

    def test_status_discovery_failure_preserves_services(self) -> None:
        """A failed fresh status enumeration cannot reuse previously printed URLs."""
        self.run_preview("start")
        (self.state / "ip-fail").touch()
        result = self.run_preview("status", success=False)
        self.assertIn("ip -br a", result.stderr)
        self.assertNotIn("Open:", result.stdout)
        self.assertNotIn("http://", result.stdout)
        self.assertEqual(len(self.records()), 3)

    def test_no_eligible_address_keeps_local_summary(self) -> None:
        """An empty candidate set gives the required note and working local URLs."""
        (self.state / "ip-output").write_text("lo UNKNOWN 127.0.0.1/8 ::1/128\neth0 DOWN 192.0.2.10/24\n")
        result = self.run_preview("start")
        self.assertNotIn("Open:", result.stdout)
        self.assertIn("No non-loopback host address found.", result.stdout)
        self.assertIn("Local only (preview host):", result.stdout)

    def test_transient_failures_quiet_unless_verbose(self) -> None:
        """Healthy startup hides retry errors unless the user requests diagnostics."""
        for arguments, verbose in (((), False), (("--verbose",), True)):
            with self.subTest(verbose=verbose):
                (self.state / "transient-fail").touch()
                result = self.run_preview("start", *arguments, overrides={"PREVIEW_READY_TIMEOUT": "5"})
                if verbose:
                    self.assertIn("housou: owned container HTTP listener is not ready", result.stderr)
                else:
                    self.assertEqual(result.stderr, "")
                self.run_preview("stop")

    def test_terminal_readiness_retains_named_diagnostics(self) -> None:
        """A permanently unready required service exits without browser URLs."""
        (self.state / "internal-fail").touch()
        result = self.run_preview("start", success=False)
        self.assertIn("housou: owned container HTTP listener is not ready", result.stderr)
        self.assertIn("readiness timed out", result.stderr)
        self.assertNotIn("Open:", result.stdout)
        self.assertNotIn("http://", result.stdout)
        self.assertEqual(set(self.records()), {"unrelated"})

    def test_startup_logs_survive_failed_attempt_cleanup(self) -> None:
        """Watch-mode startup failures retain their cause without leaking secrets."""
        (self.state / "legacy-failure").touch()
        result = self.run_preview("start", success=False)
        self.assertIn("Startup diagnostics (housou; container running)", result.stderr)
        self.assertIn("legacy UUID room data detected", result.stderr)
        self.assertIn("explicitly choose a new HOUSOU_DB path", result.stderr)
        self.assertIn("<redacted>", result.stderr)
        for private in ("fixture-user", "fixture-password", "fixture-token"):
            self.assertNotIn(private, result.stdout + result.stderr)
        commands = self.commands()
        log_indices = [index for index, command in enumerate(commands) if command[0] == "logs"]
        removal = next(index for index, command in enumerate(commands) if command[0] == "rm")
        self.assertEqual(len(log_indices), 2)
        self.assertTrue(all(index < removal for index in log_indices))
        self.assertEqual(set(self.records()), {"unrelated"})

    def test_unavailable_logs_do_not_block_cleanup(self) -> None:
        """Diagnostic failure preserves nonzero startup and owned-only teardown."""
        (self.state / "internal-fail").touch()
        (self.state / "logs-fail").touch()
        self.assertIn("cannot read startup logs", self.run_preview("start", success=False).stderr)
        self.assertEqual(set(self.records()), {"unrelated"})

    def render_runtime(self, host: str, lan: str = "", ready: bool = True) -> str:
        """Exercise unmapped-to-loopback families without network side effects."""
        spec = importlib.util.spec_from_file_location("preview_config", self.repo / "scripts/preview-config.py")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        runtime = {"service": "kyoushitsu-react", "host": "0.0.0.0", "port": "5173", "lan": lan,
                   "mappings": [{"HostIp": host, "HostPort": "7081"}]}
        output = io.StringIO()
        with mock.patch.dict(os.environ, self.environment, clear=True), contextlib.redirect_stdout(output):
            module.report([runtime], ready)
        return output.getvalue()

    def test_specific_bind_and_unverified_mapping(self) -> None:
        """Specific binds advertise one address; unknown listeners have no URLs."""
        rendered = self.render_runtime("192.0.2.77", "192.0.2.88")
        self.assertIn("Open:\nWebsite (kyoushitsu-react):\nhttp://192.0.2.77:7081", rendered)
        self.assertNotIn("192.0.2.88", rendered)
        self.assertNotIn("Local only", rendered)
        self.assertFalse((self.state / "ip-calls").exists())
        rendered = self.render_runtime("0.0.0.0", ready=False)
        self.assertIn("listener unverified", rendered)
        self.assertNotIn("System is ready.", rendered)
        self.assertNotIn("http://", rendered)

    def test_ipv6_publication_excludes_ipv4_and_link_local(self) -> None:
        """IPv6 wildcard mappings bracket global addresses and separate ::1."""
        rendered = self.render_runtime("::")
        self.assertIn("http://[2001:db8::10]:7081", rendered)
        self.assertIn("http://[::1]:7081", rendered)
        self.assertNotIn("http://192.0.2", rendered)
        self.assertNotIn("http://[fe80", rendered)
        self.assertIn("Link-local IPv6 addresses omitted", rendered)
        self.assertNotIn("http://[::]:", rendered)

    def test_build_status_help_do_not_start(self) -> None:
        """Read-only/status and explicit image preparation have no implicit startup."""
        (self.state / "missing-image").touch()
        shutil.rmtree(self.repo / "packages/kyoushitsu-react/node_modules")
        self.run_preview("--help")
        self.assertEqual(self.commands(), [])
        self.run_preview("status")
        self.run_preview("build")
        self.assertFalse(any(command[0] in ("create", "start", "run") for command in self.commands()))
        self.assertTrue(any(command[0] == "build" for command in self.commands()))

    def test_config_changes_and_deleted_config_preserve_existing(self) -> None:
        """Require explicit restart for changed config; stop/status ignore .env."""
        self.run_preview("start")
        with self.env_path.open("a") as output:
            output.write("PREVIEW_LAN_HOST=192.0.2.1\n")
        result = self.run_preview("start", success=False)
        self.assertIn("configuration changed", result.stderr)
        self.assertEqual(len(self.records()), 3)
        self.env_path.unlink()
        self.run_preview("status")
        self.run_preview("stop")
        self.assertEqual(set(self.records()), {"unrelated"})

    def test_unhealthy_existing_is_preserved(self) -> None:
        """A preexisting unhealthy owned runtime survives failed restart attempts."""
        self.run_preview("start")
        (self.state / "internal-fail").touch()
        self.run_preview("start", success=False)
        result = self.run_preview("status", success=False)
        self.assertIn("unhealthy", result.stdout)
        self.assertEqual(len(self.records()), 3)
        self.run_preview("stop")

    def test_summary_refuses_observed_service_exit(self) -> None:
        """Never announce readiness after observing a required container exit."""
        self.run_preview("start")
        state = self.records()
        state["owned-frontend"]["State"]["Status"] = "exited"
        (self.state / "state.json").write_text(json.dumps(state))
        result = subprocess.run([sys.executable, str(self.repo / "scripts/preview-config.py"), "report",
                                 str(self.repo), "owned-backend", "owned-frontend"],
                                env=self.environment, capture_output=True, text=True, timeout=10)
        self.assertNotEqual(result.returncode, 0)
        self.assertNotIn("System is ready.", result.stdout)
        self.assertNotIn("Website:", result.stdout)

    def test_failed_new_attempt_cleanup(self) -> None:
        """Detect conflict/early exit/timeout, never trust an unrelated HTTP server."""
        for flag in ("port-conflict", "early-exit", "internal-fail"):
            with self.subTest(flag=flag):
                (self.state / flag).touch()
                self.run_preview("start", success=False)
                self.assertEqual(set(self.records()), {"unrelated"})
                (self.state / flag).unlink()

    def test_first_start_prepares_missing_image_and_dependencies(self) -> None:
        """A clone with only .env starts and reuses its preparation next time."""
        original_env = self.env_path.read_bytes()
        lock = self.repo / "bun.lock"
        lock.write_text("fixture lockfile\n")
        (self.state / "missing-image").touch()
        for package in ("housou", "kyoushitsu-react"):
            shutil.rmtree(self.repo / f"packages/{package}/node_modules")
        result = self.run_preview()
        self.assertIn("System is ready.", result.stdout)
        self.assertIn("Building development image", result.stderr)
        self.assertIn("Installing workspace dependencies", result.stderr)
        self.assertNotIn("fixture build output", result.stdout + result.stderr)
        self.assertNotIn("fixture install output", result.stdout + result.stderr)
        commands = self.commands()
        build = next(index for index, command in enumerate(commands) if command[0] == "build")
        install = next(index for index, command in enumerate(commands) if command[0] == "run")
        create = next(index for index, command in enumerate(commands) if command[0] == "create")
        self.assertLess(build, install)
        self.assertLess(install, create)
        self.assertEqual(commands[install][-4:], ["bun", "--no-env-file", "install", "--frozen-lockfile"])
        self.assertNotIn("-p", commands[install])
        self.assertEqual([commands[install][index + 1] for index, arg in enumerate(commands[install]) if arg == "-e"], ["HOME=/app/.devhome"])
        self.assertEqual(self.env_path.read_bytes(), original_env)
        self.assertEqual(lock.read_text(), "fixture lockfile\n")
        self.run_preview("stop")
        self.run_preview("start")
        self.assertEqual(sum(command[0] == "build" for command in self.commands()), 1)
        self.assertEqual(sum(command[0] == "run" for command in self.commands()), 1)

    def test_preparation_failure_does_not_start_services(self) -> None:
        """Build/install failures retain diagnostics and permit a later retry."""
        for flag, message in (("build-fail", "image build failed"), ("install-fail", "dependency install failed"), ("install-incomplete", "installation incomplete")):
            with self.subTest(flag=flag):
                if flag == "build-fail":
                    (self.state / "missing-image").touch()
                (self.repo / "packages/kyoushitsu-react/node_modules/vite/bin/vite.js").unlink(missing_ok=True)
                (self.state / flag).touch()
                self.assertIn(message, self.run_preview("start", success=False).stderr)
                self.assertEqual(set(self.records()), {"unrelated"})
                self.assertFalse(any(command[0] == "create" for command in self.commands()))
                (self.state / flag).unlink()
                (self.state / "missing-image").unlink(missing_ok=True)
        result = self.run_preview("start", "--verbose")
        self.assertIn("fixture install output", result.stderr)

    def test_missing_dockerfile_keeps_diagnostics(self) -> None:
        """A missing build input remains visible despite captured setup output."""
        (self.state / "missing-image").touch()
        (self.repo / "Dockerfile.dev").unlink()
        self.assertIn("missing Dockerfile.dev", self.run_preview("start", success=False).stderr)
        self.assertFalse(any(command[0] in ("build", "run", "create") for command in self.commands()))

    def test_missing_config_does_not_prepare(self) -> None:
        """Missing .env blocks setup with instructions and no Docker mutation."""
        (self.state / "missing-image").touch()
        self.env_path.unlink()
        for command in ("start", "build"):
            self.assertIn("cp .env.example .env", self.run_preview(command, success=False).stderr)
        self.assertEqual(self.commands(), [])

    def test_origin_override_and_public_frontend_inputs(self) -> None:
        """Explicit CLI origin wins; process config wins over root dotenv."""
        self.run_preview("start", "--origin", "http://localhost:4000",
                         overrides={"HOUKAGO_CORS_ORIGIN": "http://localhost:3000", "PREVIEW_LAN_HOST": "192.0.2.9", "VITE_TEST": "overridden"})
        state = self.records()
        self.assertEqual(state["owned-backend"]["Config"]["Env"]["HOUKAGO_CORS_ORIGIN"], "http://localhost:4000")
        self.assertEqual(state["owned-frontend"]["Config"]["Env"]["VITE_TEST"], "overridden")
        self.assertNotIn("repo_root", state["owned-backend"]["Config"]["Env"])

    def test_invalid_config_no_docker_mutation(self) -> None:
        """Reject empty, duplicate, malformed and credential-bearing settings."""
        for value in ("PORT=\n", "PORT=65536\n", "PORT='$(touch forbidden)'\n", "PORT=3000\nPORT=3001\n", "DX_IMAGE=\n", "HOUKAGO_CORS_ORIGIN=http://user:password@localhost\n", "HOUKAGO_CORS_ORIGIN=http://:fixture-password@localhost\n", "HOUKAGO_CORS_ORIGIN=http://localhost:bad\n", "HOUKAGO_CORS_ORIGIN=http://localhost:0\n", "HOUKAGO_CORS_ORIGIN=http://localhost:\n", "PREVIEW_LAN_HOST=192.0.2.1:4000\n", "PREVIEW_LAN_HOST=:::\n", "PREVIEW_READY_TIMEOUT=0\n"):
            with self.subTest(value=value):
                self.env_path.write_text(value)
                self.run_preview("start", success=False)
                self.assertEqual(self.commands(), [])
                self.assertFalse((self.repo / "forbidden").exists())

    def test_isolated_fixture_extra_port_publication(self) -> None:
        """Publish requested extra ports alongside normal manifest ports."""
        ports: list[int] = []
        for _ in range(4):
            reservation = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.addCleanup(reservation.close)
            reservation.bind(("127.0.0.1", 0))
            ports.append(reservation.getsockname()[1])
        # Keep ports reserved without listening: dx sees connection refusal,
        # and the Docker stub records mappings without binding real services.
        (self.repo / "package.json").write_text(json.dumps({
            "config": {"ports": {"backend": ports[0], "frontend": ports[1]}}
        }))
        result = subprocess.run([str(self.repo / "dx"), "bash", "scripts/dev-react-preview.sh"],
                                cwd=self.directory, env=self.environment | {
                                    "DX_EXTRA_PORTS": f"{ports[2]},{ports[3]}"
                                },
                                capture_output=True, text=True, timeout=10)
        self.assertEqual(result.returncode, 0, result.stderr)
        command = next(command for command in self.commands() if command[0] == "run")
        mappings = [command[index + 1] for index, value in enumerate(command) if value == "-p"]
        self.assertEqual(mappings, [f"0.0.0.0:{port}:{port}" for port in ports])
        (self.state / "commands.jsonl").unlink()
        result = subprocess.run([str(self.repo / "dx"), "bun", "--version"], cwd=self.directory,
                                env=self.environment, capture_output=True, text=True, timeout=10)
        self.assertEqual(result.returncode, 0, result.stderr)
        command = next(command for command in self.commands() if command[0] == "run")
        mappings = [command[index + 1] for index, value in enumerate(command) if value == "-p"]
        self.assertEqual(mappings, [f"0.0.0.0:{port}:{port}" for port in ports[:2]])


class DotenvTests(unittest.TestCase):
    """Check quoting and literal semantics without shell execution."""

    def test_comments_quotes_multiline_and_duplicate(self) -> None:
        """Preserve author values and report ambiguous repeated keys."""
        spec = importlib.util.spec_from_file_location("preview_config", Path(__file__).with_name("preview-config.py"))
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        with tempfile.TemporaryDirectory(prefix="houkago-dotenv-test-") as workspace:
            path = Path(workspace) / ".env"
            path.write_text("export EMPTY=\nSINGLE='$(touch nope) `touch nope` ${HOME} # literal'\nDOUBLE=\"line\\nnext\" # comment\nMULTI='one\ntwo'\nRAW=value # comment\nHASH=value#literal\n")
            values = module.parse_dotenv(path)
            self.assertEqual(values["EMPTY"], "")
            self.assertEqual(values["SINGLE"], "$(touch nope) `touch nope` ${HOME} # literal")
            self.assertEqual(values["DOUBLE"], "line\nnext")
            self.assertEqual(values["MULTI"], "one\ntwo")
            self.assertEqual(values["RAW"], "value")
            self.assertEqual(values["HASH"], "value#literal")
            self.assertFalse((Path(workspace) / "nope").exists())
            path.write_text("KEY=first\nKEY=\n")
            with self.assertRaisesRegex(module.ConfigError, "duplicate key KEY"):
                module.parse_dotenv(path)

    def test_probe_timeout_names_service(self) -> None:
        """Timeout diagnostics retain the required service name without secrets."""
        spec = importlib.util.spec_from_file_location("preview_config", Path(__file__).with_name("preview-config.py"))
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        runtime = {"service": "kyoushitsu-react", "state": "running", "id": "fixture", "mappings": [{"HostIp": "0.0.0.0", "HostPort": "9999"}]}
        with mock.patch.object(module.subprocess, "run", side_effect=subprocess.TimeoutExpired("fixture", 3)):
            with self.assertRaisesRegex(module.ConfigError, "kyoushitsu-react: owned container HTTP probe failed or timed out"):
                module.probe(runtime)

    def test_discovery_timeout_is_actionable(self) -> None:
        """Address discovery timeouts name the failing host command."""
        spec = importlib.util.spec_from_file_location("preview_config", Path(__file__).with_name("preview-config.py"))
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        with mock.patch.object(module, "require_local_daemon"), mock.patch.object(module.shutil, "which", return_value="/fixture/ip"), mock.patch.object(module.subprocess, "run", side_effect=subprocess.TimeoutExpired("fixture", 5)):
            with self.assertRaisesRegex(module.ConfigError, "host address discovery failed or timed out: ip -br a"):
                module.discover_addresses(["0.0.0.0"])


def main() -> int:
    """Run the bounded suite, or serve as its Docker stub executable."""
    if len(sys.argv) > 1 and sys.argv[1] == "--docker-stub":
        return docker_stub()
    if len(sys.argv) > 1 and sys.argv[1] == "--ip-stub":
        return ip_stub()
    suite = unittest.defaultTestLoader.loadTestsFromModule(sys.modules[__name__])
    return 0 if unittest.TextTestRunner(verbosity=2).run(suite).wasSuccessful() else 1


if __name__ == "__main__":
    sys.exit(main())
