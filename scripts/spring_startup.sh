#!/usr/bin/env bash
set -euo pipefail

script_path="$(readlink -f "${BASH_SOURCE[0]}")"
script_dir="$(cd "$(dirname "$script_path")" && pwd)"
repo_root="$(cd "$script_dir/.." && pwd)"

exec env SUPPRESS_ENTRYPOINT_DEPRECATION=1 "$repo_root/scripts/start_sprint.sh" --sprint 0 "$@"
