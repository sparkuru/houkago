#!/usr/bin/env bash
# One supervised service per --init container; terminate its entire process group.
set -Eeuo pipefail

service_pid=""

cleanup() {
	local status=$?
	trap - EXIT INT TERM
	if [[ -n "$service_pid" ]]; then
		kill -TERM -- "-$service_pid" 2>/dev/null || true
		wait "$service_pid" 2>/dev/null || true
	fi
	exit "$status"
}

main() {
	trap cleanup EXIT
	trap 'exit 130' INT
	trap 'exit 143' TERM
	set -m
	case "${1:-}" in
	housou) bun run dev:housou & ;;
	kyoushitsu-react)
		bun --no-env-file run --filter houkago-kyoushitsu-react dev --host "$PREVIEW_FRONTEND_HOST" --port "$PREVIEW_FRONTEND_PORT" --strictPort &
		;;
	*)
		printf 'Error: expected housou or kyoushitsu-react\n' >&2
		return 1
		;;
	esac
	service_pid=$!
	wait "$service_pid"
}

main "$@"
