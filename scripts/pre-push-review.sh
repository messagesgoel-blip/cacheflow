#!/usr/bin/env bash
# Run by git pre-push hook or manually before opening a PR.
# Reviews committed-but-not-yet-pushed changes and exits non-zero if blockers found.

set -euo pipefail

# Ensure ~/.local/bin is in PATH (in case it was just installed)
export PATH="$HOME/.local/bin:$PATH"

echo "==> Running CodeRabbit pre-push review..."

# Build command with optional API key
CMD="coderabbit review --plain --type committed"
if [ -n "${CODERABBIT_API_KEY:-}" ]; then
  CMD="$CMD --api-key $CODERABBIT_API_KEY"
fi

RESULT=$($CMD 2>&1)
echo "$RESULT"

# Exit non-zero if CodeRabbit signals blocking issues
if echo "$RESULT" | grep -qiE "(🚨|actionable comments posted: [1-9]|high severity)"; then
  echo ""
  echo "❌ CodeRabbit found blocking issues. Fix before pushing."
  exit 1
fi

# Special case for subscription error (don't block the push if billing failed but configuration is correct)
if echo "$RESULT" | grep -qi "No CLI addon found"; then
  echo ""
  echo "⚠️  CodeRabbit: CLI addon missing from subscription. Skipping automated review check."
  exit 0
fi

echo "✅ CodeRabbit: no blocking issues found."
exit 0
