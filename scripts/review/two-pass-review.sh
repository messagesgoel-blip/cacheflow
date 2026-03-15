#!/usr/bin/env bash
set -euo pipefail

# Cacheflow review gate wrapper so repo-gate can run the same entrypoint
# across cacheflow/codero/mathkit-v2.

REPO_PATH="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

review_executed=false

if [ -x "$REPO_PATH/scripts/pre-push-review.sh" ]; then
  echo "Running Cacheflow committed review pass..."
  "$REPO_PATH/scripts/pre-push-review.sh"
  review_executed=true
else
  echo "Skipping pre-push-review.sh (not found or not executable)"
fi

parallel_script="$REPO_PATH/scripts/review/parallel-agent-pass.sh"
if [ -x "$parallel_script" ]; then
  echo "Running parallel-agent pass..."
  "$parallel_script"
  review_executed=true
else
  echo "Skipping parallel-agent-pass.sh (not found or not executable)"
fi

# Mandatory Semgrep gate - always runs regardless of other passes
if command -v semgrep >/dev/null 2>&1; then
  echo "Running mandatory semgrep pass..."
  if ! semgrep scan --config p/default --json "$REPO_PATH" >/dev/null 2>&1; then
    echo "Cacheflow two-pass review: FAIL (semgrep findings)" >&2
    exit 1
  fi
  review_executed=true
else
  echo "Warning: semgrep not found - skipping mandatory security scan" >&2
fi

if [ "$review_executed" = true ]; then
  echo "Cacheflow two-pass review: PASS"
else
  echo "Cacheflow two-pass review: SKIP (no review scripts available)"
fi
