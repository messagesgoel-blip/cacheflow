#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/.." && pwd)"
cd "$repo_root"

enable_protocol_guards() {
  git config core.hooksPath .githooks >/dev/null 2>&1 || true
  [ ! -f "$repo_root/.githooks/pre-commit" ] || chmod +x "$repo_root/.githooks/pre-commit"
}

usage() {
  cat <<'USAGE'
Usage:
  start_sprint.sh [agent] [--sprint N] [--all|--first|--list]

Agents:
  ClaudeCode | OpenCode | Gemini | Codex
  Shortcuts: claude|open|gemini|codex|ccli|oc|gcli

Options:
  --agent NAME  Explicit agent name (same values as positional agent)
  --sprint N   Override running sprint (default: STATUS.md running_sprint)
  --all        Claim all matching tasks for this agent (default)
  --first      Claim only first claimable task for this agent
  --list       List claim commands only; do not claim
  -h, --help   Show this help

If agent is omitted, detection order is:
1) CACHEFLOW_AGENT
2) current TTY mapping written by CCLI/GCLI/OC/codex-a/codex-b wrappers
USAGE
}

enable_protocol_guards

normalize_agent() {
  local raw="${1,,}"
  case "$raw" in
    claude|claudecode|ccli)
      echo "ClaudeCode"
      ;;
    open|opencode|oc)
      echo "OpenCode"
      ;;
    gemini|gcli)
      echo "Gemini"
      ;;
    codex|master)
      echo "Codex"
      ;;
    *)
      return 1
      ;;
  esac
}

detect_agent_from_tty() {
  local map_dir="${CACHEFLOW_AGENT_TTY_MAP_DIR:-/tmp/cacheflow_agent_tty_map}"
  local tty_name tty_key map_file
  tty_name="$(tty 2>/dev/null || true)"
  [[ "$tty_name" == /dev/* ]] || return 1
  tty_key="$(printf '%s' "$tty_name" | sed 's#[^A-Za-z0-9._-]#_#g')"
  map_file="$map_dir/$tty_key"
  [ -f "$map_file" ] || return 1
  tr -d ' \t\r\n' < "$map_file"
}

agent_input=""
sprint_override=""
claim_mode="all"

while [ "$#" -gt 0 ]; do
  case "$1" in
    -h|--help)
      usage
      exit 0
      ;;
    --sprint)
      shift
      sprint_override="${1:-}"
      [ -n "$sprint_override" ] || { echo "--sprint requires a value" >&2; exit 1; }
      ;;
    --sprint=*)
      sprint_override="${1#*=}"
      ;;
    --agent)
      shift
      agent_input="${1:-}"
      [ -n "$agent_input" ] || { echo "--agent requires a value" >&2; exit 1; }
      ;;
    --agent=*)
      agent_input="${1#*=}"
      ;;
    --all)
      claim_mode="all"
      ;;
    --first)
      claim_mode="first"
      ;;
    --list|--no-claim)
      claim_mode="none"
      ;;
    *)
      if [ -z "$agent_input" ]; then
        agent_input="$1"
      else
        echo "Unknown argument: $1" >&2
        usage
        exit 1
      fi
      ;;
  esac
  shift

done

if [ -z "$agent_input" ] && [ -n "${CACHEFLOW_AGENT:-}" ]; then
  agent_input="$CACHEFLOW_AGENT"
fi
if [ -z "$agent_input" ]; then
  agent_input="$(detect_agent_from_tty 2>/dev/null || true)"
fi
[ -n "$agent_input" ] || {
  echo "Unable to detect agent automatically. Pass agent name or --agent." >&2
  usage
  exit 1
}
agent_name="$(normalize_agent "$agent_input" 2>/dev/null || true)"
[ -n "$agent_name" ] || {
  echo "Unknown agent: $agent_input" >&2
  usage
  exit 1
}

sync_args=()
if [ -n "$sprint_override" ]; then
  sync_args+=(--sprint "$sprint_override")
fi
python3 "$repo_root/scripts/sync_status_running_sprint.py" "${sync_args[@]}" >/dev/null 2>&1 || true

sprint="${sprint_override}"
if [ -z "$sprint" ]; then
  sprint="$(awk '/^- running_sprint:[[:space:]]*[0-9]+/{print $3; exit}' "$repo_root/STATUS.md")"
fi
if ! [[ "$sprint" =~ ^[0-9]+$ ]]; then
  echo "Unable to determine running sprint. Use --sprint N." >&2
  exit 1
fi

mapfile -t tasks < <(python3 - "$repo_root/monitoring/cacheflow_task_state.yaml" "$agent_name" "$sprint" <<'PY'
import re
import sys
from pathlib import Path

import yaml

state_file = Path(sys.argv[1])
agent_name = sys.argv[2]
sprint = int(sys.argv[3])
state = yaml.safe_load(state_file.read_text()) or {}
DONE = {"done", "complete", "closed", "pass"}


def natural_key(value: str):
    parts = re.split(r"(\d+)", value)
    out = []
    for p in parts:
        if p.isdigit():
            out.append(int(p))
        else:
            out.append(p.lower())
    return out

rows = []
for task_key, rec in state.items():
    if not isinstance(task_key, str) or not isinstance(rec, dict):
        continue
    if int(rec.get("sprint", 0) or 0) != sprint:
        continue
    status = str(rec.get("status", "planned")).lower()
    if status in DONE:
        continue
    agent_label = str(rec.get("agent", ""))

    match = False
    if agent_name == "Codex":
        match = ("CODEX" in agent_label.upper()) or ("Codex" in agent_label)
    else:
        match = agent_name in agent_label

    if match:
        rows.append(task_key)

for key in sorted(rows, key=natural_key):
    print(key)
PY
)

echo "start-sprint: agent=${agent_name} sprint=${sprint} mode=${claim_mode}"

if [ "${#tasks[@]}" -eq 0 ]; then
  echo "No queued tasks found for ${agent_name} in sprint ${sprint}."
  exit 0
fi

echo "Queued tasks:"
for task in "${tasks[@]}"; do
  echo "- ${task}"
  echo "  ./agent-coord.sh claim_task ${task} ${agent_name} \"\$(hostname)\""
done

if [ "$claim_mode" = "none" ]; then
  exit 0
fi

claimed=0
busy=0
failed=0

for task in "${tasks[@]}"; do
  if [ "$claim_mode" = "first" ] && [ "$claimed" -gt 0 ]; then
    break
  fi

  set +e
  output="$(./agent-coord.sh claim_task "$task" "$agent_name" "$(hostname)" 2>&1)"
  rc=$?
  set -e

  if [ "$rc" -eq 0 ]; then
    claimed=$((claimed + 1))
    echo "claimed: ${task}"
  elif [ "$rc" -eq 2 ]; then
    busy=$((busy + 1))
    echo "busy: ${task}"
  else
    failed=$((failed + 1))
    echo "failed: ${task}"
    [ -n "$output" ] && echo "$output"
  fi
done

python3 "$repo_root/scripts/sync_status_running_sprint.py" --sprint "$sprint" >/dev/null 2>&1 || true

echo "summary: claimed=${claimed} busy=${busy} failed=${failed}"
echo "finish-task command:"
echo "  ./scripts/finish_task.sh <task_key> --test \"<targeted test>\" --commit \"<message>\""
echo "note: worker agents should not update dashboard/metrics files directly."
echo "active locks:"
./agent-coord.sh get_active_tasks || true
