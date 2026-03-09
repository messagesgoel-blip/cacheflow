#!/usr/bin/env bash
# Called by orchestrate.ts to update Linear ticket status when sprint tasks complete.
# Usage: bash scripts/linear-sprint-sync.sh <ISSUE_ID> <STATUS> [COMMENT]
# Example: bash scripts/linear-sprint-sync.sh CF-42 "In Progress" "Blocked by gate"

set -euo pipefail

ISSUE_ID="${1:-}"
STATUS="${2:-}"
COMMENT="${3:-}"

if [ -z "$ISSUE_ID" ] || [ -z "$STATUS" ]; then
  echo "Usage: $0 <ISSUE_ID> <STATUS>"
  exit 1
fi

if linearis issues update "$ISSUE_ID" --status "$STATUS" --json; then
  echo "Linear: $ISSUE_ID → $STATUS"
else
  echo "ERROR: failed to update $ISSUE_ID"
  exit 1
fi

if [ -n "$COMMENT" ]; then
  if linearis comments create --issue "$ISSUE_ID" --body "$COMMENT" --json >/dev/null; then
    echo "Linear comment added: $ISSUE_ID"
  else
    echo "WARN: failed to add comment to $ISSUE_ID"
  fi
fi
