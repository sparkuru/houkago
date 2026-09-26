#!/usr/bin/env bash
set -Eeuo pipefail

readonly SCRIPT_NAME=${0##*/}
service_pids=()

usage() {
	printf 'Usage: DX_EXTRA_PORTS=5174 ./dx bash scripts/%s [--help]\n' "$SCRIPT_NAME" >&2
	printf '\nStart isolated memory Housou (3000), Vue (5173), and React (5174) in one container.\n' >&2
	printf 'Open http://127.0.0.1:5174; press Ctrl-C to stop all three services.\n' >&2
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
	local repo_root status=0
	case "${1:-}" in
	--help | -h)
		[[ $# -eq 1 ]] || die "--help takes no further arguments"
		usage
		return 0
		;;
	"") ;;
	*) die "unknown argument: $1" ;;
	esac
	[[ $# -eq 0 ]] || die "unexpected arguments"
	command -v bun >/dev/null 2>&1 || die "required command not found: bun; run through ./dx"
	repo_root=$(cd -- "${BASH_SOURCE[0]%/*}/.." && pwd)
	cd -- "$repo_root"
	[[ -f packages/housou/src/index.ts && -f packages/kyoushitsu-react/package.json ]] || die "preview packages are missing"
	[[ -f packages/kyoushitsu/node_modules/vite/bin/vite.js && -f packages/kyoushitsu-react/node_modules/vite/bin/vite.js ]] || die "Vite dependencies are missing; run ./dx bun install first"

	unset HOUKAGO_BAIDU_CLIENT_ID HOUKAGO_BAIDU_CLIENT_SECRET HOUKAGO_BAIDU_REDIRECT_URI
	unset HOUKAGO_CREDENTIAL_KEY HOUKAGO_CREDENTIAL_KEY_VERSION HOUKAGO_KOMON_USERNAMES
	unset HOUKAGO_CORS_ORIGIN HOUKAGO_OPENAPI
	trap cleanup EXIT
	trap 'exit 130' INT
	trap 'exit 143' TERM

	printf 'Starting isolated preview: Housou :3000, Vue :5173, React :5174.\n'
	NODE_ENV=development HOUSOU_DB=:memory: PORT=3000 \
		bun --no-env-file packages/housou/src/index.ts &
	service_pids+=("$!")

	(
		cd -- packages/kyoushitsu
		NODE_ENV=development HOUKAGO_ISOLATED_PREVIEW=1 VITE_HOUSOU_URL=http://127.0.0.1:3000 \
			exec bun --no-env-file ./node_modules/vite/bin/vite.js --host 0.0.0.0 --port 5173 --strictPort
	) &
	service_pids+=("$!")

	(
		cd -- packages/kyoushitsu-react
		NODE_ENV=development HOUKAGO_ISOLATED_PREVIEW=1 VITE_HOUSOU_URL=http://127.0.0.1:3000 \
			VITE_LEGACY_FRONTEND_URL=http://127.0.0.1:5173 \
			exec bun --no-env-file ./node_modules/vite/bin/vite.js --host 0.0.0.0 --port 5174 --strictPort
	) &
	service_pids+=("$!")

	wait -n "${service_pids[@]}" || status=$?
	exit "$status"
}

main "$@"
