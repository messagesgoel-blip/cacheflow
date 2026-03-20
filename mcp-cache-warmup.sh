#!/bin/bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(git -C "$script_dir" rev-parse --show-toplevel 2>/dev/null || echo "$script_dir")"
cd "$repo_root"

REPO_NAME=$(basename "$repo_root")
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
NAMESPACE="${REPO_NAME}:${BRANCH}"
TOKEN=${MCP_AUTH_TOKEN:-$(docker inspect mcp-cache-server --format '{{range .Config.Env}}{{println .}}{{end}}' | rg '^MCP_AUTH_TOKEN=' | sed 's/MCP_AUTH_TOKEN=//')}

node - <<'NODE' "$NAMESPACE" > /tmp/mcp_warm_payload.json
const fs = require('fs')
const ns = process.argv[2]
const files = [
  { path: 'AGENTS.md', tags: ['system-prompt', 'repo-config'] },
  { path: 'STATUS.md', tags: ['system-prompt', 'session-state'] },
  { path: '.context/decisions.md', tags: ['architecture-decision', 'codebase-context'] },
  { path: '.context/patterns.md', tags: ['code-pattern', 'codebase-context'] },
  { path: '.context/mistakes.md', tags: ['codebase-context'] },
  { path: '.context/dependencies.md', tags: ['dependency-context', 'codebase-context'] }
]
const entries = []
for (const f of files) {
  if (!fs.existsSync(f.path)) continue
  const body = fs.readFileSync(f.path, 'utf8').slice(0, 12000)
  entries.push({
    query: `warmup:${f.path}:${ns}`,
    response: body,
    tags: [...f.tags, `repo:${ns.split(':')[0]}`, `branch:${ns.split(':').slice(1).join(':')}`],
    namespace: ns
  })
}
process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: 'warmup', method: 'tools/call', params: { name: 'cache_warm', arguments: { entries } } }))
NODE

curl -sS -o /tmp/mcp_warm_result.json \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "X-MCP-Client: session-bootstrap" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -X POST http://localhost:8765/mcp \
  --data @/tmp/mcp_warm_payload.json >/dev/null || true
