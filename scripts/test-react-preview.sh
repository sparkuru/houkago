#!/usr/bin/env bash
set -Eeuo pipefail

test_dir=""
runner_pid=""
checks=0

die() {
	printf 'FAIL: %s\n' "$*" >&2
	exit 1
}

cleanup() {
	local status=$?
	trap - EXIT INT TERM
	if [[ -n "$runner_pid" ]]; then
		kill "$runner_pid" 2>/dev/null || true
		wait "$runner_pid" 2>/dev/null || true
	fi
	if [[ "$test_dir" == "${TMPDIR:-/tmp}/react-preview-test."* && -d "$test_dir" ]]; then
		rm -rf -- "$test_dir"
	fi
	exit "$status"
}

assert_equal() {
	[[ "$1" == "$2" ]] || die "$3: expected '$2', got '$1'"
	checks=$((checks + 1))
}

check_ports() {
	local input=$1 expected=$2 arg port_list="" previous=""
	local -a args=()
	DX_EXTRA_PORTS="$input" "$test_dir/repo/dx" bun run 'argument with spaces' >/dev/null
	mapfile -d '' -t args <"$test_dir/docker.args"
	for arg in "${args[@]}"; do
		[[ "$previous" != -p ]] || port_list+="${arg} "
		previous=$arg
	done
	assert_equal "$port_list" "$expected" "published ports for '$input'"
	assert_equal "${args[-1]}" 'argument with spaces' "command quoting"
	assert_equal "${args[0]} ${args[1]}" 'run --rm' "Docker lifecycle defaults"
}

wait_for_services() {
	local attempt service ready
	for ((attempt = 0; attempt < 100; attempt++)); do
		ready=1
		for service in housou react; do
			[[ -f "$test_dir/services/$service.pid" ]] || ready=0
		done
		[[ "$ready" -ne 1 ]] || return 0
		kill -0 "$runner_pid" 2>/dev/null || die "preview exited before services were ready"
		sleep 0.02
	done
	die "preview startup timed out"
}

check_runner() {
	local mode=$1 expected=$2 status=0 service pid
	local -a args=()
	rm -rf -- "$test_dir/services"
	mkdir -- "$test_dir/services"
	# Job control allows the async runner to install its INT trap instead of inheriting SIG_IGN.
	set -m
	TEST_SERVICE_DIR="$test_dir/services" HOUKAGO_CORS_ORIGIN=sentinel \
		HOUKAGO_BAIDU_CLIENT_SECRET=sentinel HOUKAGO_CREDENTIAL_KEY=sentinel \
		HOUSOU_DB=sentinel PORT=9000 NODE_ENV=production \
		bash "$test_dir/repo/scripts/dev-react-preview.sh" >"$test_dir/runner.log" 2>&1 &
	runner_pid=$!
	set +m
	wait_for_services
	for service in housou react; do
		mapfile -d '' -t args <"$test_dir/services/$service.args"
		assert_equal "${args[0]}" --no-env-file "$service disables Bun env files"
		assert_equal "$(<"$test_dir/services/$service.env")" "development|||" "$service clears credentials/CORS"
	done
	assert_equal "$(<"$test_dir/services/housou.memory")" ':memory:|3000' "memory DB and fixed backend port"
	assert_equal "$(<"$test_dir/services/react.frontend")" '1|http://127.0.0.1:3000|' "isolated React config"
	mapfile -d '' -t args <"$test_dir/services/housou.args"
	assert_equal "${args[1]}" packages/housou/src/index.ts "backend entry"
	mapfile -d '' -t args <"$test_dir/services/react.args"
	[[ " ${args[*]} " == *' --host 0.0.0.0 '* && " ${args[*]} " == *' --strictPort '* ]] || die "React bind/strict port arguments"
	assert_equal "${args[1]}" ./node_modules/vite/bin/vite.js "React runs direct Vite"
	assert_equal "$(<"$test_dir/services/react.cwd")" "$test_dir/repo/packages/kyoushitsu-react" "React package working directory"
	[[ " ${args[*]} " == *' --port 5173 '* ]] || die "React port arguments"
	checks=$((checks + 2))

	case "$mode" in
	failure) printf '7' >"$test_dir/services/exit-react" ;;
	success) printf '0' >"$test_dir/services/exit-react" ;;
	TERM | INT) kill -s "$mode" "$runner_pid" ;;
	esac
	wait "$runner_pid" || status=$?
	runner_pid=""
	assert_equal "$status" "$expected" "runner exit status ($mode)"
	for service in housou react; do
		pid=$(<"$test_dir/services/$service.pid")
		! kill -0 "$pid" 2>/dev/null || die "$service survived runner $mode"
		pid=$(<"$test_dir/services/$service.helper")
		! kill -0 "$pid" 2>/dev/null || die "$service helper survived runner $mode"
		checks=$((checks + 2))
	done
}

main() {
	local repo_root command input status
	case "${1:-}" in
	--help | -h)
		printf 'Usage: bash scripts/test-react-preview.sh\nRun fake Docker/Bun port, isolation, exit and signal checks without services.\n' >&2
		return 0
		;;
	"") ;;
	*) die "unknown argument: $1" ;;
	esac
	[[ $# -eq 0 ]] || die "unexpected arguments"
	for command in bash cat chmod cp mkdir mktemp rm sleep; do
		command -v "$command" >/dev/null 2>&1 || die "required command not found: $command"
	done
	repo_root=$(cd -- "${BASH_SOURCE[0]%/*}/.." && pwd)
	test_dir=$(mktemp -d "${TMPDIR:-/tmp}/react-preview-test.XXXXXXXXXX")
	trap cleanup EXIT
	trap 'exit 130' INT
	trap 'exit 143' TERM
	mkdir -p -- "$test_dir/bin" "$test_dir/repo/scripts" "$test_dir/repo/packages/housou/src" "$test_dir/repo/packages/kyoushitsu-react"
	mkdir -p -- "$test_dir/repo/packages/kyoushitsu-react/node_modules/vite/bin"
	cp -- "$repo_root/dx" "$test_dir/repo/dx"
	cp -- "$repo_root/scripts/dev-react-preview.sh" "$test_dir/repo/scripts/dev-react-preview.sh"
	printf '' >"$test_dir/repo/packages/housou/src/index.ts"
	printf '{}' >"$test_dir/repo/packages/kyoushitsu-react/package.json"
	printf '' >"$test_dir/repo/packages/kyoushitsu-react/node_modules/vite/bin/vite.js"

	cat >"$test_dir/bin/docker" <<'FAKE_DOCKER'
#!/usr/bin/env bash
set -Eeuo pipefail
printf '%s\0' "$@" > "$TEST_DOCKER_ARGS"
FAKE_DOCKER
	cat >"$test_dir/bin/bun" <<'FAKE_BUN'
#!/usr/bin/env bash
set -Eeuo pipefail
case "$PWD" in
  */repo) service=housou ;;
  */packages/kyoushitsu-react) service=react ;;
  *) exit 99 ;;
esac
printf '%s\0' "$@" > "$TEST_SERVICE_DIR/$service.args"
printf '%s' "$PWD" > "$TEST_SERVICE_DIR/$service.cwd"
printf '%s|%s|%s|%s' "${NODE_ENV:-}" "${HOUKAGO_CORS_ORIGIN+x}" "${HOUKAGO_BAIDU_CLIENT_SECRET+x}" "${HOUKAGO_CREDENTIAL_KEY+x}" > "$TEST_SERVICE_DIR/$service.env"
printf '%s|%s' "${HOUSOU_DB:-}" "${PORT:-}" > "$TEST_SERVICE_DIR/$service.memory"
printf '%s|%s|%s' "${HOUKAGO_ISOLATED_PREVIEW:-}" "${VITE_HOUSOU_URL:-}" "${VITE_LEGACY_FRONTEND_URL:-}" > "$TEST_SERVICE_DIR/$service.frontend"
sleep 30 &
helper_pid=$!
printf '%s' "$helper_pid" > "$TEST_SERVICE_DIR/$service.helper"
cleanup() {
  kill "$helper_pid" 2>/dev/null || true
  wait "$helper_pid" 2>/dev/null || true
}
trap cleanup EXIT
trap 'exit 0' TERM
printf '%s' "$$" > "$TEST_SERVICE_DIR/$service.pid"
while [[ ! -f "$TEST_SERVICE_DIR/exit-$service" ]]; do sleep 0.02; done
exit "$(< "$TEST_SERVICE_DIR/exit-$service")"
FAKE_BUN
	chmod +x "$test_dir/bin/docker" "$test_dir/bin/bun"
	export PATH="$test_dir/bin:$PATH" TEST_DOCKER_ARGS="$test_dir/docker.args"
	check_ports '' '3000:3000 5173:5173 '
	check_ports '5174' '3000:3000 5173:5173 5174:5174 '
	check_ports '5174,3000,05173,5174,0005174,1,65535' '3000:3000 5173:5173 5174:5174 1:1 65535:65535 '
	for input in 0 08 00008 65536 nope; do
		if bash "$test_dir/repo/scripts/dev-react-preview.sh" --backend-port "$input" >/dev/null 2>&1; then
			die "invalid preview port was accepted: $input"
		fi
		checks=$((checks + 1))
	done
	rm -rf -- "$test_dir/repo/.devhome"
	# shellcheck disable=SC2016 # Literal command substitution must be rejected, never evaluated.
	for input in 0 00000 65536 18446744073709551617 -1 +5174 1.5 ' 5174' '5174 ' '5174,' ',5174' '5174,,5175' '5174;touch forbidden' '$(touch forbidden)' $'5174\n5175'; do
		rm -- "$test_dir/docker.args"
		status=0
		DX_EXTRA_PORTS="$input" "$test_dir/repo/dx" bun --version >/dev/null 2>&1 || status=$?
		[[ "$status" -ne 0 && ! -e "$test_dir/docker.args" && ! -d "$test_dir/repo/.devhome" ]] || die "invalid port input reached Docker or changed the workspace: '$input'"
		checks=$((checks + 1))
		printf '' >"$test_dir/docker.args"
	done
	check_runner failure 7
	check_runner success 0
	check_runner TERM 143
	check_runner INT 130
	printf 'PASS: %s shell behavior checks\n' "$checks"
}

main "$@"
