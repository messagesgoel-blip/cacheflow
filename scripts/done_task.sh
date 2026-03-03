#!/usr/bin/env bash
set -euo pipefail

script_path="$(readlink -f "${BASH_SOURCE[0]}")"
script_dir="$(cd "$(dirname "$script_path")" && pwd)"
repo_root="$(cd "$script_dir/.." && pwd)"
cd "$repo_root"

usage() {
  cat <<'USAGE'
Usage:
  done_task.sh [task_key] [finish_task options...]

Examples:
  ./scripts/done_task.sh 0.2@TRANSFER-1 --test "npm test -- transfer" --commit "feat(transfer): retries"
  ./scripts/done_task.sh --test "npm test -- transfer" --commit "feat(transfer): retries"

Behavior:
- If task_key is omitted, auto-detect from your active lock.
- Then forwards everything to `./scripts/finish_task.sh`.
USAGE
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

normalize_agent() {
  local raw="${1,,}"
  case "$raw" in
    codex|codexa|codexb|master)
      echo "Codex"
      ;;
    claude|claudecode|ccli)
      echo "ClaudeCode"
      ;;
    open|opencode|oc)
      echo "OpenCode"
      ;;
    gemini|gcli)
      echo "Gemini"
      ;;
    *)
      echo "$1"
      ;;
  esac
}

meta_agent_for_lock() {
  local lock_dir="$1"
  local meta_file="$lock_dir/meta.json"
  [ -f "$meta_file" ] || return 1
  sed -n 's/.*"agent":"\([^"]*\)".*/\1/p' "$meta_file" | head -n 1
}

auto_task_for_agent() {
  local wanted_agent="$1"
  local lock_root="$repo_root/.context/task_locks"
  local matches=()
  local any=()
  local d task agent

  [ -d "$lock_root" ] || return 1
  for d in "$lock_root"/*.lock; do
    [ -d "$d" ] || continue
    task="$(basename "$d" .lock)"
    any+=("$task")
    if [ -n "$wanted_agent" ] && [ "$wanted_agent" != "unknown" ]; then
      agent="$(meta_agent_for_lock "$d" || true)"
      agent="$(normalize_agent "${agent:-unknown}")"
      if [ "$agent" = "$wanted_agent" ]; then
        matches+=("$task")
      fi
    fi
  done

  if [ "${#matches[@]}" -eq 1 ]; then
    printf '%s\n' "${matches[0]}"
    return 0
  fi

  if [ "${#matches[@]}" -gt 1 ]; then
    echo "Multiple active locks for $wanted_agent; specify task_key explicitly:" >&2
    printf ' - %s\n' "${matches[@]}" >&2
    return 2
  fi

  if [ "${#any[@]}" -eq 1 ]; then
    printf '%s\n' "${any[0]}"
    return 0
  fi

  if [ "${#any[@]}" -gt 1 ]; then
    echo "No unique lock found; specify task_key explicitly. Active locks:" >&2
    printf ' - %s\n' "${any[@]}" >&2
    return 2
  fi

  echo "No active task locks found." >&2
  return 1
}

if [ "${1:-}" = "-h" ] || [ "${1:-}" = "--help" ]; then
  usage
  exit 0
fi

task_key=""
if [ "$#" -gt 0 ] && [[ "${1:-}" != -* ]]; then
  task_key="$1"
  shift
fi

if [ -z "$task_key" ]; then
  agent="${CACHEFLOW_AGENT:-}"
  if [ -z "$agent" ]; then
    agent="$(detect_agent_from_tty 2>/dev/null || true)"
  fi
  agent="$(normalize_agent "${agent:-unknown}")"
  task_key="$(auto_task_for_agent "$agent")" || exit $?
fi

exec "$repo_root/scripts/finish_task.sh" "$task_key" "$@"
