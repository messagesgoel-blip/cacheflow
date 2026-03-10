#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
echo "=== Orchestration Status ==="

check_pid() {
  local name=$1 pidfile=$2
  if [ -f "$pidfile" ]; then
    PID=$(cat "$pidfile")
    if kill -0 "$PID" 2>/dev/null; then
      echo "  ✅ $name running (PID $PID)"
    else
      echo "  ❌ $name DEAD (stale pidfile)"
    fi
  else
    echo "  ⬜ $name not started"
  fi
}

check_pid "orchestrate.ts"         /tmp/orchestrate.pid
check_pid "coderabbit-webhook"     /tmp/coderabbit-webhook.pid

echo ""
echo "=== Recent audit log (last 10 entries) ==="
tail -n 10 "$ROOT/logs/codex-audit.jsonl" 2>/dev/null | jq -r '[.ts,.event,.status] | @tsv' 2>/dev/null || echo "(no entries yet)"

echo ""
echo "=== Pending CodeRabbit reviews ==="
shopt -s nullglob
files=("$ROOT"/monitoring/coderabbit-[0-9]*.yaml)
if [ ${#files[@]} -eq 0 ]; then
  echo "  (none)"
else
  printf '%s\n' "${files[@]}" \
  | xargs -I{} sh -c 'echo "  PR $(grep "^pr:" {} | cut -d" " -f2): $(grep "^status:" {} | cut -d" " -f2) | blockers=$(grep "^hasBlockers:" {} | cut -d" " -f2) | notified=$(grep "^agentNotified:" {} | cut -d" " -f2)"' \
  || true
fi

echo ""
echo "=== Local CodeRabbit reviews ==="
echo "  disabled"

echo ""
echo "=== PR Feedback Watchers ==="
watch_dir="$ROOT/.context/cache_state/pr_feedback_watch"
if [ ! -d "$watch_dir" ]; then
  echo "  (none)"
else
  shopt -s nullglob
  watch_files=("$watch_dir"/pr-*.json)
  if [ ${#watch_files[@]} -eq 0 ]; then
    echo "  (none)"
  else
    for file in "${watch_files[@]}"; do
      python3 - "$file" <<'PY'
import json, sys
from pathlib import Path
path = Path(sys.argv[1])
try:
    data = json.loads(path.read_text())
except Exception:
    print(f"  {path.name}: unreadable")
    raise SystemExit(0)
print(
    f"  PR #{data.get('pr', '?')}: {data.get('status', '?')} | "
    f"agent={data.get('agent', '?')} | task={data.get('task', '') or '-'} | "
    f"decision={data.get('reviewDecision', '-')} | "
    f"lastCheck={data.get('lastCheckedAt', '-') or '-'}"
)
PY
    done
  fi
fi
