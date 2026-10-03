#!/usr/bin/env bash
# Docker preview ownership and configuration live in dx.
set -Eeuo pipefail

main() {
	local repo_root
	repo_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
	exec "${repo_root}/dx" preview "$@"
}

main "$@"
