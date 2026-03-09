#!/usr/bin/env bash
# Creates a Linear issue and echoes the new issue ID (for use in orchestrator scripts).
# Usage: bash scripts/linear-create-issue.sh "<TITLE>" "<TEAM_KEY>" "<DESCRIPTION>"

set -euo pipefail

TITLE="${1:-}"
TEAM="${2:-}"
DESC="${3:-}"

if [ -z "$TITLE" ] || [ -z "$TEAM" ]; then
  echo "Usage: $0 \"<TITLE>\" \"<TEAM_KEY>\" [\"<DESCRIPTION>\"]"
  exit 1
fi

linearis issues create \
  --title "$TITLE" \
  --team "$TEAM" \
  ${DESC:+--description "$DESC"} \
  --json | jq -r '.identifier'
