#!/bin/bash
set -euo pipefail

REPO_NAME=$(basename "$(pwd)")
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
NAMESPACE="${REPO_NAME}:${BRANCH}"
TOKEN=${MCP_AUTH_TOKEN:-$(docker inspect mcp-cache-server --format '{{range .Config.Env}}{{println .}}{{end}}' | rg '^MCP_AUTH_TOKEN=' | sed 's/MCP_AUTH_TOKEN=//')}

FILES=$(git diff-tree --no-commit-id --name-only -r HEAD 2>/dev/null || true)
TAGS="codebase-context"
if echo "$FILES" | rg -q '(^|/)(package.json|package-lock.json|pnpm-lock.yaml|yarn.lock|requirements.txt|poetry.lock|go.mod|go.sum)$'; then
  TAGS="${TAGS},dependency-context"
fi
if echo "$FILES" | rg -q '(^|/)AGENTS.md|(^|/)STATUS.md|(^|/)\.context/'; then
  TAGS="${TAGS},system-prompt"
fi

node - <<'NODE' "$TAGS" "$NAMESPACE" > /tmp/mcp_invalidate_payload.json
const tags = process.argv[2].split(',').filter(Boolean)
const ns = process.argv[3]
process.stdout.write(JSON.stringify({
  jsonrpc: '2.0',
  id: 'invalidate',
  method: 'tools/call',
  params: {
    name: 'cache_invalidate',
    arguments: { tags, namespaces: [ns] }
  }
}))
NODE

curl -sS -o /tmp/mcp_invalidate_result.json \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "X-MCP-Client: git-hook" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -X POST http://localhost:8765/mcp \
  --data @/tmp/mcp_invalidate_payload.json >/dev/null || true
