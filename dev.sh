#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_NAME=$(basename -- "$0")
readonly SCRIPT_NAME
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
readonly SCRIPT_DIR
readonly DX_PATH="${SCRIPT_DIR}/dx"
readonly FRONTEND_URL="http://localhost:5173"
readonly BACKEND_URL="http://localhost:3000"

usage() {
  printf 'Usage: %s [--origin <frontend-origin>] [--help]\n' "$SCRIPT_NAME"
  printf '\n'
  printf 'Start the Houkago development servers in one dx container.\n'
  printf '\n'
  printf 'Services:\n'
  printf '  housou      %s\n' "$BACKEND_URL"
  printf '  kyoushitsu  %s\n' "$FRONTEND_URL"
  printf '\n'
  printf 'Development accepts all frontend origins by default. To restrict it:\n'
  printf '  %s --origin http://192.168.9.4:5173\n' "$SCRIPT_NAME"
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
  local cors_origin=""

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --origin)
        [[ $# -ge 2 ]] || die "--origin requires an http(s) origin"
        cors_origin=$2
        shift 2
        ;;
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
  if [[ -n "$cors_origin" ]]; then
    [[ "$cors_origin" =~ ^https?://[^/]+$ ]] || die "origin must be an http(s) origin without a path"
  fi

  printf 'Starting Houkago dev servers...\n'
  printf 'Frontend: %s\n' "$FRONTEND_URL"
  if [[ -n "$cors_origin" ]]; then
    printf 'Backend:  %s (trusts %s)\n' "$BACKEND_URL" "$cors_origin"
  else
    printf 'Backend:  %s (allows all development origins)\n' "$BACKEND_URL"
  fi
  printf 'Press Ctrl-C to stop.\n\n'

  # shellcheck disable=SC2016 # $1 is expanded by the inner bash process.
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

if [[ -n "$1" ]]; then
  HOUKAGO_CORS_ORIGIN="$1" bun run dev:housou &
else
  bun run dev:housou &
fi
housou_pid=$!

bun run dev:kyoushitsu &
kyoushitsu_pid=$!

wait -n "$housou_pid" "$kyoushitsu_pid"
' bash "$cors_origin"
}

main "$@"
