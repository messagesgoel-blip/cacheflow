#!/bin/bash
set -euo pipefail

if [ "$#" -lt 2 ]; then
  echo "usage: $0 '<query>' <command ...>"
  exit 1
fi

QUERY="$1"
shift
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(git -C "$script_dir" rev-parse --show-toplevel 2>/dev/null || echo "$script_dir")"
cd "$repo_root"

REPO_NAME=$(basename "$repo_root")
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
NAMESPACE="${REPO_NAME}:${BRANCH}"
TOKEN=${MCP_AUTH_TOKEN:-$(docker inspect mcp-cache-server --format '{{range .Config.Env}}{{println .}}{{end}}' | rg '^MCP_AUTH_TOKEN=' | sed 's/MCP_AUTH_TOKEN=//')}

GET_PAYLOAD=$(node -e 'const q=process.argv[1],ns=process.argv[2];process.stdout.write(JSON.stringify({jsonrpc:"2.0",id:"get",method:"tools/call",params:{name:"cache_get",arguments:{query:q,namespace:ns}}}))' "$QUERY" "$NAMESPACE")
RESP=$(curl -sS -H "Authorization: Bearer ${TOKEN}" -H 'X-MCP-Client: cli-wrapper' -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -X POST http://localhost:8765/mcp -d "$GET_PAYLOAD" || true)
TEXT=$(echo "$RESP" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{const o=JSON.parse(d);const t=o?.result?.content?.[0]?.text;if(!t){process.stdout.write("");return;}const v=JSON.parse(t);if(v&&v.hit){process.stdout.write(v.response)}else{process.stdout.write("")}}catch{process.stdout.write("")}})')
if [ -n "$TEXT" ]; then
  echo "$TEXT"
  exit 0
fi

OUT=$("$@" 2>&1)
CODE=$?
echo "$OUT"
if [ "$CODE" -eq 0 ]; then
  SET_PAYLOAD=$(node -e 'const q=process.argv[1],r=process.argv[2],ns=process.argv[3];process.stdout.write(JSON.stringify({jsonrpc:"2.0",id:"set",method:"tools/call",params:{name:"cache_set",arguments:{query:q,response:r,namespace:ns,tags:["tool-result","runtime-log"]}}}))' "$QUERY" "$OUT" "$NAMESPACE")
  curl -sS -H "Authorization: Bearer ${TOKEN}" -H 'X-MCP-Client: cli-wrapper' -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -X POST http://localhost:8765/mcp -d "$SET_PAYLOAD" >/dev/null || true
fi
exit "$CODE"
