#!/usr/bin/env bash
set -euo pipefail
for pidfile in /tmp/coderabbit-webhook.pid /tmp/orchestrate.pid; do
  if [ -f "$pidfile" ]; then
    PID=$(cat "$pidfile")
    kill "$PID" 2>/dev/null && echo "Stopped PID $PID ($pidfile)" || echo "PID $PID already gone"
    rm -f "$pidfile"
  fi
done
rm -f /tmp/cacheflow-orchestrator.lock
echo "✅ Orchestration stack stopped."
