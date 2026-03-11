#!/usr/bin/env bash
set -euo pipefail

LOCK_FILE="${LOCK_FILE:-/tmp/refresh_cacheflow_metrics.lock}"
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "refresh_cacheflow_metrics: lock held, skipping overlap" >&2
  exit 0
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PY_SCRIPT="$SCRIPT_DIR/update_cacheflow_metrics.py"
ROADMAP_CATALOG_SCRIPT="$SCRIPT_DIR/generate_cacheflow_roadmap_catalog.py"
DASHBOARD_SYNC_SCRIPT="$SCRIPT_DIR/sync_sprints_dashboard.py"
STATUS_SYNC_SCRIPT="$SCRIPT_DIR/sync_status_running_sprint.py"
PUSH_SCRIPT="$SCRIPT_DIR/push_cacheflow_metrics.py"
HISTORY_SCRIPT="$SCRIPT_DIR/push_cacheflow_history.py"
MODULE_AUDIT_SCRIPT="$SCRIPT_DIR/generate_module_audit.py"
export CACHEFLOW_BASE="${CACHEFLOW_BASE:-$BASE_DIR}"

if [ ! -f "$PY_SCRIPT" ]; then
  echo "missing $PY_SCRIPT"
  exit 1
fi

if [ -f "$ROADMAP_CATALOG_SCRIPT" ]; then
  echo "refresh_cacheflow_metrics: generating roadmap catalog"
  if python3 "$ROADMAP_CATALOG_SCRIPT"; then
    echo "refresh_cacheflow_metrics: roadmap catalog generation succeeded"
  else
    echo "refresh_cacheflow_metrics: roadmap catalog generation failed" >&2
    exit 1
  fi
fi

python3 "$PY_SCRIPT"
if [ -f "$DASHBOARD_SYNC_SCRIPT" ]; then
  python3 "$DASHBOARD_SYNC_SCRIPT"
fi
if [ -f "$STATUS_SYNC_SCRIPT" ]; then
  python3 "$STATUS_SYNC_SCRIPT"
fi
if [ -f "$MODULE_AUDIT_SCRIPT" ]; then
  python3 "$MODULE_AUDIT_SCRIPT"
fi
python3 "$PUSH_SCRIPT"
python3 "$HISTORY_SCRIPT"
