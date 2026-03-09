#!/usr/bin/env bash
# Called by orchestrate.ts to update Linear ticket status when sprint tasks complete.
# Usage: bash scripts/linear-sprint-sync.sh <ISSUE_ID> <STATUS>
# Example: bash scripts/linear-sprint-sync.sh CF-42 "In Progress"

set -euo pipefail

ISSUE_ID="${1:-}"
STATUS="${2:-}"

if [ -z "$ISSUE_ID" ] || [ -z "$STATUS" ]; then
  echo "Usage: $0 <ISSUE_ID> <STATUS>"
  exit 1
fi

linearis issues update "$ISSUE_ID" --status "$STATUS" --json \
  && echo "Linear: $ISSUE_ID → $STATUS" \
  || { echo "ERROR: failed to update $ISSUE_ID"; exit 1; }
