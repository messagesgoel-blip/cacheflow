#!/bin/bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  ./agent-coord.sh claim_task <task_id> [agent] [machine]
  ./agent-coord.sh release_task <task_id>
  ./agent-coord.sh get_active_tasks
  ./agent-coord.sh log_change <file_path> <reason>
  ./agent-coord.sh get_recent_changes [count]
  ./agent-coord.sh write_contract <contract_name> <producer> <interface_summary>
  ./agent-coord.sh read_contract <contract_name>
  ./agent-coord.sh list_contracts
USAGE
}

cmd="${1:-}"
[ -n "$cmd" ] || { usage; exit 1; }
shift || true

now_utc() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }
repo_name() { basename "$(pwd)"; }
branch_name() { git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown"; }
namespace() { echo "$(repo_name):$(branch_name)"; }
lock_dir=".context/task_locks"
contracts_dir=".context/contracts"
change_log=".context/change_log.md"

ensure_dirs() {
  mkdir -p "$lock_dir" "$contracts_dir"
}

mcp_token() {
  if [ -n "${MCP_AUTH_TOKEN:-}" ]; then
    echo "$MCP_AUTH_TOKEN"
  else
    if command -v rg >/dev/null 2>&1; then
      docker inspect mcp-cache-server --format '{{range .Config.Env}}{{println .}}{{end}}' | rg '^MCP_AUTH_TOKEN=' | sed 's/MCP_AUTH_TOKEN=//' || true
    else
      docker inspect mcp-cache-server --format '{{range .Config.Env}}{{println .}}{{end}}' | grep '^MCP_AUTH_TOKEN=' | sed 's/MCP_AUTH_TOKEN=//' || true
    fi
  fi
}

mcp_set() {
  local query="$1"
  local response="$2"
  local tags_csv="$3"
  local ns
  ns="$(namespace)"
  local token
  token="$(mcp_token)"
  [ -n "$token" ] || return 0

  node - <<'NODE' "$query" "$response" "$tags_csv" "$ns" >/tmp/mcp_agent_coord_payload.json
const q = process.argv[2]
const r = process.argv[3]
const tags = process.argv[4].split(',').filter(Boolean)
const ns = process.argv[5]
process.stdout.write(JSON.stringify({
  jsonrpc: '2.0',
  id: 'agent-coord',
  method: 'tools/call',
  params: {
    name: 'cache_set',
    arguments: { query: q, response: r, namespace: ns, tags }
  }
}))
NODE

  curl -sS -o /dev/null \
    -H "Authorization: Bearer ${token}" \
    -H 'X-MCP-Client: agent-coord' \
    -H 'Content-Type: application/json' \
    -H 'Accept: application/json, text/event-stream' \
    -X POST http://localhost:8765/mcp \
    --data @/tmp/mcp_agent_coord_payload.json || true
}

case "$cmd" in
  claim_task)
    ensure_dirs
    task_id="${1:-}"; agent="${2:-${USER:-unknown}}"; machine="${3:-$(hostname)}"
    [ -n "$task_id" ] || { echo "claim_task requires <task_id>"; exit 1; }
    lock_path="$lock_dir/$task_id.lock"
    if mkdir "$lock_path" 2>/tmp/agent_coord_claim.err; then
      meta=$(cat <<META
{"task_id":"$task_id","agent":"$agent","machine":"$machine","repo":"$(repo_name)","branch":"$(branch_name)","claimed_at":"$(now_utc)","status":"claimed"}
META
)
      echo "$meta" > "$lock_path/meta.json"
      mcp_set "task:claim:${task_id}:$(namespace)" "$meta" "task-lock,system-prompt,repo:$(repo_name),branch:$(branch_name)"
      echo "claimed: $task_id"
    else
      if [ -d "$lock_path" ]; then
        echo "already claimed: $task_id"
        [ -f "$lock_path/meta.json" ] && cat "$lock_path/meta.json"
        exit 2
      fi
      err_msg="$(cat /tmp/agent_coord_claim.err 2>/dev/null || true)"
      echo "claim failed: $task_id"
      [ -n "$err_msg" ] && echo "$err_msg"
      exit 1
    fi
    ;;

  release_task)
    ensure_dirs
    task_id="${1:-}"
    [ -n "$task_id" ] || { echo "release_task requires <task_id>"; exit 1; }
    lock_path="$lock_dir/$task_id.lock"
    if [ -d "$lock_path" ]; then
      rm -rf "$lock_path"
      meta=$(cat <<META
{"task_id":"$task_id","repo":"$(repo_name)","branch":"$(branch_name)","released_at":"$(now_utc)","status":"released"}
META
)
      mcp_set "task:release:${task_id}:$(namespace)" "$meta" "task-lock,system-prompt,repo:$(repo_name),branch:$(branch_name)"
      echo "released: $task_id"
    else
      echo "not claimed: $task_id"
    fi
    ;;

  get_active_tasks)
    ensure_dirs
    found=false
    for d in "$lock_dir"/*.lock; do
      [ -d "$d" ] || continue
      found=true
      [ -f "$d/meta.json" ] && cat "$d/meta.json" || echo "{\"task_id\":\"$(basename "$d" .lock)\"}"
    done
    [ "$found" = true ] || echo "[]"
    ;;

  log_change)
    file_path="${1:-}"; reason="${2:-}"
    [ -n "$file_path" ] && [ -n "$reason" ] || { echo "log_change requires <file_path> <reason>"; exit 1; }
    [ -f "$change_log" ] || cat > "$change_log" <<LOG
# Change Log

| UTC | Agent | File | Reason |
|---|---|---|---|
LOG
    ts="$(now_utc)"
    echo "| $ts | ${USER:-unknown} | $file_path | $reason |" >> "$change_log"
    event=$(cat <<EV
{"ts":"$ts","agent":"${USER:-unknown}","file":"$file_path","reason":"$reason","repo":"$(repo_name)","branch":"$(branch_name)"}
EV
)
    mcp_set "change:unplanned:${file_path}:$(namespace)" "$event" "change-log,runtime-log,repo:$(repo_name),branch:$(branch_name)"
    echo "logged: $file_path"
    ;;

  get_recent_changes)
    count="${1:-20}"
    [ -f "$change_log" ] || { echo "no change log"; exit 0; }
    tail -n "$count" "$change_log"
    ;;

  write_contract)
    ensure_dirs
    name="${1:-}"; producer="${2:-${USER:-unknown}}"; summary="${3:-}"
    [ -n "$name" ] && [ -n "$summary" ] || { echo "write_contract requires <contract_name> <producer> <interface_summary>"; exit 1; }
    path="$contracts_dir/$name.md"
    if [ -f "$path" ]; then
      echo "contract exists: $path"
      exit 2
    fi
    cat > "$path" <<CONTRACT
# Contract: $name

- producer: $producer
- repo: $(repo_name)
- branch: $(branch_name)
- created_utc: $(now_utc)
- status: draft

## Interface Summary
$summary

## Inputs
- 

## Outputs
- 

## Invariants
- 

## Versioning
- version: v1
- breaking_change_policy: bump major section/version and notify consumers
CONTRACT
    body=$(cat "$path")
    mcp_set "contract:${name}:$(namespace)" "$body" "contract,architecture-decision,repo:$(repo_name),branch:$(branch_name)"
    echo "written: $path"
    ;;

  read_contract)
    name="${1:-}"
    [ -n "$name" ] || { echo "read_contract requires <contract_name>"; exit 1; }
    path="$contracts_dir/$name.md"
    [ -f "$path" ] || { echo "missing: $path"; exit 1; }
    cat "$path"
    ;;

  list_contracts)
    ls -1 "$contracts_dir"/*.md 2>/dev/null | xargs -r -n1 basename || true
    ;;

  *)
    usage
    exit 1
    ;;
esac
