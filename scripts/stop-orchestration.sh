#!/usr/bin/env bash
set -euo pipefail
for pidfile in /tmp/coderabbit-webhook.pid /tmp/orchestrate.pid; do
  if [ -f "$pidfile" ]; then
    PID=$(cat "$pidfile")
    if ps -p "$PID" -o comm= 2>/dev/null | grep -qE '(node|tsx|bash)'; then
      kill "$PID" 2>/dev/null && echo "Stopped PID $PID ($pidfile)" || echo "PID $PID already gone"
    else
      echo "PID $PID not an orchestration process, skipping ($pidfile)"
    fi
    rm -f "$pidfile"
  fi
done
rm -f /tmp/cacheflow-orchestrator.lock
echo "✅ Orchestration stack stopped."
