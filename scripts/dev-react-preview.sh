#!/usr/bin/env bash
set -Eeuo pipefail

readonly SCRIPT_NAME=${0##*/}
service_pids=()

usage() {
	printf 'Usage: ./dx bash scripts/%s [--backend-port PORT] [--frontend-port PORT] [--help]\n' "$SCRIPT_NAME" >&2
	printf '\nStart isolated memory Housou (3000) and React (5173) in one container.\n' >&2
	printf 'Open http://127.0.0.1:5173; press Ctrl-C to stop both services.\n' >&2
}

die() {
	printf 'Error: %s\n' "$*" >&2
	exit 1
}

cleanup() {
	local status=$?
	trap - EXIT INT TERM
	if [[ ${#service_pids[@]} -gt 0 ]]; then
		# The first exited service may already be gone; still stop and reap every remaining child.
		kill "${service_pids[@]}" 2>/dev/null || true
		wait "${service_pids[@]}" 2>/dev/null || true
	fi
	exit "$status"
}

main() {
	local repo_root status=0 backend_port=3000 frontend_port=5173
	while [[ $# -gt 0 ]]; do
		case "$1" in
		--backend-port)
			[[ $# -ge 2 ]] || die "--backend-port requires a port"
			backend_port=$2
			shift 2
			;;
		--frontend-port)
			[[ $# -ge 2 ]] || die "--frontend-port requires a port"
			frontend_port=$2
			shift 2
			;;
		--help | -h)
			usage
			return 0
			;;
		*) die "unknown argument: $1" ;;
		esac
	done
	for port in "$backend_port" "$frontend_port"; do
		if [[ ! "$port" =~ ^[1-9][0-9]{0,4}$ ]] || ((port > 65535)); then
			die "ports must be decimal values from 1 to 65535"
		fi
	done
	[[ "$backend_port" != "$frontend_port" ]] || die "backend and frontend ports must differ"
	command -v bun >/dev/null 2>&1 || die "required command not found: bun; run through ./dx"
	repo_root=$(cd -- "${BASH_SOURCE[0]%/*}/.." && pwd)
	cd -- "$repo_root"
	[[ -f packages/housou/src/index.ts && -f packages/kyoushitsu-react/package.json ]] || die "preview packages are missing"
	[[ -f packages/kyoushitsu-react/node_modules/vite/bin/vite.js ]] || die "Vite dependencies are missing; run ./dx bun install first"

	unset HOUKAGO_BAIDU_CLIENT_ID HOUKAGO_BAIDU_CLIENT_SECRET HOUKAGO_BAIDU_REDIRECT_URI
	unset HOUKAGO_CREDENTIAL_KEY HOUKAGO_CREDENTIAL_KEY_VERSION HOUKAGO_KOMON_USERNAMES
	unset HOUKAGO_CORS_ORIGIN HOUKAGO_OPENAPI
	trap cleanup EXIT
	trap 'exit 130' INT
	trap 'exit 143' TERM

	printf 'Starting isolated preview: Housou :%s, React :%s.\n' "$backend_port" "$frontend_port"
	NODE_ENV=development HOUSOU_DB=:memory: PORT="$backend_port" \
		bun --no-env-file packages/housou/src/index.ts &
	service_pids+=("$!")

	(
		cd -- packages/kyoushitsu-react
		NODE_ENV=development HOUKAGO_ISOLATED_PREVIEW=1 VITE_HOUSOU_URL="http://127.0.0.1:$backend_port" \
			exec bun --no-env-file ./node_modules/vite/bin/vite.js --host 0.0.0.0 --port "$frontend_port" --strictPort
	) &
	service_pids+=("$!")

	wait -n "${service_pids[@]}" || status=$?
	exit "$status"
}

main "$@"
