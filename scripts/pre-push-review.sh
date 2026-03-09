#!/usr/bin/env bash
# Run by git pre-push hook or manually before opening a PR.
# Reviews committed-but-not-yet-pushed changes and exits non-zero if blockers found.

set -euo pipefail

echo "==> Running CodeRabbit pre-push review..."

RESULT=$(coderabbit review --plain --type committed 2>&1)
echo "$RESULT"

# Exit non-zero if CodeRabbit signals blocking issues
if echo "$RESULT" | grep -qiE "(🚨|actionable comments posted: [1-9]|high severity)"; then
  echo ""
  echo "❌ CodeRabbit found blocking issues. Fix before pushing."
  exit 1
fi

echo "✅ CodeRabbit: no blocking issues found."
exit 0
