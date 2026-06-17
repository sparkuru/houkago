#!/usr/bin/env bash
set -Eeuo pipefail

readonly SCRIPT_NAME=$(basename "$0")
readonly SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
readonly DX_PATH="${SCRIPT_DIR}/dx"
readonly FRONTEND_URL="http://localhost:5173"
readonly BACKEND_URL="http://localhost:3000"

usage() {
  printf 'Usage: %s [--help]\n' "$SCRIPT_NAME"
  printf '\n'
  printf 'Start the Houkago development servers in one dx container.\n'
  printf '\n'
  printf 'Services:\n'
  printf '  housou      %s\n' "$BACKEND_URL"
  printf '  kyoushitsu  %s\n' "$FRONTEND_URL"
  printf '\n'
  printf 'Press Ctrl-C to stop both services.\n'
}

die() {
  printf 'Error: %s\n' "$*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "required command not found: $1"
}

main() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --help | -h)
        usage
        return 0
        ;;
      *)
        die "unknown argument: $1"
        ;;
    esac
  done

  require_command docker
  [[ -x "$DX_PATH" ]] || die "dx wrapper is not executable: $DX_PATH"

  printf 'Starting Houkago dev servers...\n'
  printf 'Frontend: %s\n' "$FRONTEND_URL"
  printf 'Backend:  %s\n' "$BACKEND_URL"
  printf 'Press Ctrl-C to stop.\n\n'

  exec "$DX_PATH" bash -lc '
set -Eeuo pipefail

cleanup() {
  local status=$?
  trap - EXIT INT TERM
  if [[ -n "${housou_pid:-}" ]]; then
    kill "$housou_pid" 2>/dev/null || true
  fi
  if [[ -n "${kyoushitsu_pid:-}" ]]; then
    kill "$kyoushitsu_pid" 2>/dev/null || true
  fi
  wait "$housou_pid" "$kyoushitsu_pid" 2>/dev/null || true
  exit "$status"
}

trap cleanup EXIT INT TERM

bun run dev:housou &
housou_pid=$!

bun run dev:kyoushitsu &
kyoushitsu_pid=$!

wait -n "$housou_pid" "$kyoushitsu_pid"
'
}

main "$@"
