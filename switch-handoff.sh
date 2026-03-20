#!/bin/bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(git -C "$script_dir" rev-parse --show-toplevel 2>/dev/null || echo "$script_dir")"
cd "$repo_root"

if [ ! -f STATUS.md ]; then
  echo "STATUS.md not found in $repo_root"
  exit 1
fi

echo "=== Switch Handoff: $(basename "$repo_root") ==="
echo ""
echo "1) STATUS.md checklist"
echo "- Active is current and complete (task/machine/agent/started)"
echo "- Last Session updated if you are finishing the task"
echo "- Queue includes unfinished items"
echo ""
echo "2) Context checklist"
echo "- decisions.md updated for architecture changes"
echo "- patterns.md updated for new coding patterns"
echo "- mistakes.md updated for failed/reverted attempts"
echo "- dependencies.md updated for new libraries"
echo ""

active_block=$(awk '/^## Active/{flag=1;next}/^## /{flag=0}flag' STATUS.md)
last_block=$(awk '/^## Last Session/{flag=1;next}/^## /{flag=0}flag' STATUS.md)

active_ok=true
for field in task machine agent started; do
  if ! echo "$active_block" | grep -Eq "^- ${field}:[[:space:]]*[^[:space:]].*$"; then
    active_ok=false
  fi
done

if [ "$active_ok" != true ]; then
  echo "FAIL: Active section is incomplete in STATUS.md"
  exit 1
fi

echo "Current Active block:"
echo "$active_block"
echo ""

if ! git diff --quiet -- STATUS.md .context 2>/dev/null; then
  echo "Note: Uncommitted changes detected in STATUS.md or .context/."
else
  echo "Note: No local changes in STATUS.md or .context/."
fi

echo ""
echo "Recent commits:"
git log --oneline -5 || true

echo ""
echo "Handoff check complete. If done, commit and push your updates now."
