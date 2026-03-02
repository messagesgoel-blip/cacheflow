#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PY_SCRIPT="$SCRIPT_DIR/update_cacheflow_metrics.py"
PUSH_SCRIPT="$SCRIPT_DIR/push_cacheflow_metrics.py"
HISTORY_SCRIPT="$SCRIPT_DIR/push_cacheflow_history.py"

if [ ! -f "$PY_SCRIPT" ]; then
  echo "missing $PY_SCRIPT"
  exit 1
fi

python3 "$PY_SCRIPT"
python3 "$PUSH_SCRIPT"
python3 "$HISTORY_SCRIPT"
