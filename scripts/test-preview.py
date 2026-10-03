#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Check preview configuration and lifecycle using isolated HTTP/Docker fixtures."""

import http.server
import importlib.util
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
    if operation == "image":
        return 1 if (root / "missing-image").exists() else 0
    if operation == "build":
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
        print(json.dumps([state[args[1]]]))
        return 0
    if operation == "exec":
        return 1 if (root / "internal-fail").exists() else 0
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
        return 0
    else:
        return 2
    path.write_text(json.dumps(state))
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
        self.environment = {key: value for key, value in os.environ.items() if not key.startswith(("HOUKAGO_", "VITE_", "PREVIEW_", "DX_")) and key not in ("HOST", "PORT", "HOUSOU_DB")}
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
        self.assertIn(f"API: http://127.0.0.1:{self.environment['TEST_BACKEND_PORT']}", result.stdout)
        self.assertIn(f"Website: http://127.0.0.1:{self.environment['TEST_FRONTEND_PORT']}", result.stdout)
        state = self.records()
        self.assertEqual(state["owned-frontend"]["Config"]["Env"]["VITE_HOUSOU_PORT"], self.environment["TEST_BACKEND_PORT"])
        self.assertNotIn("HOUKAGO_BAIDU_CLIENT_SECRET", state["owned-frontend"]["Config"]["Env"])
        self.run_preview("start")
        self.run_preview("status")
        self.assertEqual(sum(command[0] == "create" for command in self.commands()), 2)
        self.assertFalse(any(command[0] in ("build", "run") for command in self.commands()))
        self.assertNotIn("literal $(never)", json.dumps(self.commands()))
        self.run_preview("stop")
        self.run_preview("down")
        self.assertEqual(set(self.records()), {"unrelated"})
        self.assertEqual((self.repo / "persistence-marker").read_text(), "retain")

    def test_build_status_help_do_not_start(self) -> None:
        """Read-only/status and explicit image preparation have no implicit startup."""
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

    def test_missing_prerequisites(self) -> None:
        """Missing image, dependencies or .env fail before creating a container."""
        (self.state / "missing-image").touch()
        self.assertIn("preview.sh build", self.run_preview("start", success=False).stderr)
        (self.state / "missing-image").unlink()
        shutil.rmtree(self.repo / "packages/housou/node_modules/elysia")
        self.assertIn("dx bun install", self.run_preview("start", success=False).stderr)
        self.env_path.unlink()
        for command in ("start", "build"):
            self.assertIn("cp .env.example .env", self.run_preview(command, success=False).stderr)
        self.assertFalse(any(command[0] == "create" for command in self.commands()))

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


def main() -> int:
    """Run the bounded suite, or serve as its Docker stub executable."""
    if len(sys.argv) > 1 and sys.argv[1] == "--docker-stub":
        return docker_stub()
    suite = unittest.defaultTestLoader.loadTestsFromModule(sys.modules[__name__])
    return 0 if unittest.TextTestRunner(verbosity=2).run(suite).wasSuccessful() else 1


if __name__ == "__main__":
    sys.exit(main())
