#!/usr/bin/env bash
# Starts all background services required for the automated orchestration loop.
# Run once on OCI (primary) before starting a sprint. Never run on India (worker-only).
set -euo pipefail

if [ "${DATACENTER:-}" = "india" ]; then
  echo "ERROR: start-orchestration.sh must only run on OCI. India is worker-only."
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$SCRIPT_DIR/../logs"
mkdir -p "$LOG_DIR"
LOCK_FILE="/tmp/cacheflow-orchestrator.lock"

echo "==> Starting CodeRabbit webhook listener..."
nohup npx tsx "$SCRIPT_DIR/coderabbit-webhook.ts" \
  >> "$LOG_DIR/coderabbit-webhook.log" 2>&1 &
echo $! > /tmp/coderabbit-webhook.pid
sleep 1
if ! kill -0 "$(cat /tmp/coderabbit-webhook.pid)" 2>/dev/null; then
  echo "ERROR: coderabbit-webhook.ts exited during startup. See $LOG_DIR/coderabbit-webhook.log"
  exit 1
fi
echo "    PID: $(cat /tmp/coderabbit-webhook.pid)"

echo "==> Starting orchestrator..."
nohup bash -lc "exec 200>\"$LOCK_FILE\"; flock -n 200 || exit 1; exec npx tsx \"$SCRIPT_DIR/orchestrate.ts\"" \
  >> "$LOG_DIR/orchestrate.log" 2>&1 &
echo $! > /tmp/orchestrate.pid
sleep 1
if ! kill -0 "$(cat /tmp/orchestrate.pid)" 2>/dev/null; then
  echo "ERROR: orchestrate.ts exited during startup. See $LOG_DIR/orchestrate.log"
  kill "$(cat /tmp/coderabbit-webhook.pid)" 2>/dev/null || true
  rm -f /tmp/coderabbit-webhook.pid /tmp/orchestrate.pid
  exit 1
fi
echo "    PID: $(cat /tmp/orchestrate.pid)"

echo ""
echo "✅ Orchestration stack running."
echo "   Logs: logs/orchestrate.log | logs/coderabbit-webhook.log"
echo "   Stop: bash scripts/stop-orchestration.sh"
