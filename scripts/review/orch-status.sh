#!/usr/bin/env bash
# Wrapper for shared script
set -euo pipefail
SHARED_SCRIPT="/srv/storage/shared/agent-toolkit/bin/orch-status.sh"

if [ ! -x "$SHARED_SCRIPT" ]; then
    echo "Error: Shared script not found: $SHARED_SCRIPT" >&2
    exit 1
fi
export CODERO_REPO_PATH="${CODERO_REPO_PATH:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
export CODERO_MODEL_ALIAS="${CODERO_MODEL_ALIAS:-cacheflow_agent}"
exec "$SHARED_SCRIPT" "$@"
