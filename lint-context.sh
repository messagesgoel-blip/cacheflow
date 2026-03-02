#!/bin/bash
set -euo pipefail

fail() {
  echo "context-lint: $1"
  exit 1
}

[ -f .context/decisions.md ] || fail "missing .context/decisions.md"
[ -f .context/patterns.md ] || fail "missing .context/patterns.md"
[ -f .context/mistakes.md ] || fail "missing .context/mistakes.md"
[ -f .context/dependencies.md ] || fail "missing .context/dependencies.md"

rg -q '^# Decisions$' .context/decisions.md || fail "decisions header missing"
rg -q '^## YYYY-MM-DD — \[title\]$' .context/decisions.md || fail "decisions template heading missing"
rg -q '^- decision:$' .context/decisions.md || fail "decisions field missing: decision"
rg -q '^- rationale:$' .context/decisions.md || fail "decisions field missing: rationale"
rg -q '^- alternatives rejected:$' .context/decisions.md || fail "decisions field missing: alternatives rejected"
rg -q '^- agent:$' .context/decisions.md || fail "decisions field missing: agent"
rg -q '^- files:$' .context/decisions.md || fail "decisions trace field missing: files"
rg -q '^- commit:$' .context/decisions.md || fail "decisions trace field missing: commit"

rg -q '^# Code Patterns$' .context/patterns.md || fail "patterns header missing"
rg -q '^## \[pattern name\]$' .context/patterns.md || fail "patterns template heading missing"
rg -q '^- use when:$' .context/patterns.md || fail "patterns field missing: use when"
rg -q '^- example:$' .context/patterns.md || fail "patterns field missing: example"
rg -q '^- do not deviate because:$' .context/patterns.md || fail "patterns field missing: do not deviate because"

rg -q '^# Mistakes & Dead Ends$' .context/mistakes.md || fail "mistakes header missing"
rg -q '^## YYYY-MM-DD — \[title\]$' .context/mistakes.md || fail "mistakes template heading missing"
rg -q '^- what was tried:$' .context/mistakes.md || fail "mistakes field missing: what was tried"
rg -q '^- why it failed:$' .context/mistakes.md || fail "mistakes field missing: why it failed"
rg -q '^- do not attempt:$' .context/mistakes.md || fail "mistakes field missing: do not attempt"
rg -q '^- agent:$' .context/mistakes.md || fail "mistakes field missing: agent"

rg -q '^# Dependencies$' .context/dependencies.md || fail "dependencies header missing"

echo "context-lint: OK"
