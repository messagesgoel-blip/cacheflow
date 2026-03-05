#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT_DIR="${CHAOS_OUT_DIR:-/srv/storage/local/screenshot/$(date +%Y%m%d_%H%M%S)_chaos}"

"$REPO_ROOT/scripts/chaos/preflight_live.sh"

export CHAOS_OUT_DIR="$OUT_DIR"
node "$REPO_ROOT/scripts/chaos/cacheflow_chaos_live.js"

echo "CHAOS_DONE: $OUT_DIR"
