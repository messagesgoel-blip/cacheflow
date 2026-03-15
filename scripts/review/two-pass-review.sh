#!/usr/bin/env bash
set -euo pipefail

# Cacheflow review gate wrapper so repo-gate can run the same entrypoint
# across cacheflow/codero/mathkit-v2.

REPO_PATH="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

if [ -x "$REPO_PATH/scripts/pre-push-review.sh" ]; then
  echo "Running Cacheflow committed review pass..."
  "$REPO_PATH/scripts/pre-push-review.sh"
fi

parallel_script="$REPO_PATH/scripts/review/parallel-agent-pass.sh"
if [ -x "$parallel_script" ]; then
  echo "Running parallel-agent pass..."
  "$parallel_script"
fi

echo "Cacheflow two-pass review: PASS"
