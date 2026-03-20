#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  ./scripts/finish_task.sh <task_key> [options]

Deprecated:
  Use ./scripts/done_task.sh instead. This shim remains for compatibility.

Options:
  --commit "message"   Commit message (default: chore(task): complete <task_key>)
  --test "command"     Run one test command before commit/push (repeatable)
  --stage-all          Stage all changes (`git add -A`) before commit
  --no-commit           Skip git add/commit
  --no-push             Skip git pull --rebase and git push
  --no-release          Skip lock release
  -h, --help            Show help

Default flow:
1) run tests (if provided)
2) commit staged changes (or use --stage-all)
3) git pull --rebase --autostash + git push
4) ./agent-coord.sh release_task <task_key>
5) print Codex finalize command
USAGE
}

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/.." && pwd)"
cd "$repo_root"

detect_agent_from_tty() {
  local map_dir="${AGENT_TTY_MAP_DIR:-/tmp/agent_tty_map}"
  local tty_name tty_key map_file
  tty_name="$(tty 2>/dev/null || true)"
  [[ "$tty_name" == /dev/* ]] || return 1
  tty_key="$(printf '%s' "$tty_name" | sed 's#[^A-Za-z0-9._-]#_#g')"
  map_file="$map_dir/$tty_key"
  [ -f "$map_file" ] || return 1
  tr -d ' \t\r\n' < "$map_file"
}

mark_active_tty() {
  local agent_name="$1"
  local source="${2:-finish_task}"
  local tty_name state_dir state_file ts agent_key
  tty_name="$(tty 2>/dev/null || true)"
  [[ "$tty_name" == /dev/* ]] || return 0
  agent_key="$(printf '%s' "${agent_name,,}" | sed 's#[^a-z0-9._-]#-#g')"
  state_dir="$repo_root/.context/cache_state/active_agent_tty"
  state_file="$state_dir/${agent_key}.json"
  ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  mkdir -p "$state_dir"
  printf '{\n  "agent": "%s",\n  "ttyPath": "%s",\n  "source": "%s",\n  "updatedAt": "%s"\n}\n' \
    "$agent_name" "$tty_name" "$source" "$ts" >"$state_file"
}

normalize_agent() {
  local raw="${1,,}"
  case "$raw" in
    codex|codex-a|codex-b|codex-c|codex-d|codex-e|codex-f|codexa|codexb|master)
      echo "Codex"
      ;;
    claude|claudecode|ccli)
      echo "ClaudeCode"
      ;;
    open|opencode|oc)
      echo "OpenCode"
      ;;
    gemini|gcli|gcli-a|gcli-b)
      echo "Gemini"
      ;;
    *)
      echo "$1"
      ;;
  esac
}

task_key=""
commit_message=""
skip_commit=0
skip_push=0
skip_release=0
stage_all=0
test_cmds=()

while [ "$#" -gt 0 ]; do
  case "$1" in
    -h|--help)
      usage
      exit 0
      ;;
    --commit)
      shift
      commit_message="${1:-}"
      [ -n "$commit_message" ] || { echo "--commit requires a value" >&2; exit 1; }
      ;;
    --commit=*)
      commit_message="${1#*=}"
      ;;
    --test)
      shift
      test_cmds+=("${1:-}")
      [ -n "${test_cmds[-1]}" ] || { echo "--test requires a value" >&2; exit 1; }
      ;;
    --test=*)
      test_cmds+=("${1#*=}")
      ;;
    --no-commit)
      skip_commit=1
      ;;
    --stage-all)
      stage_all=1
      ;;
    --no-push)
      skip_push=1
      ;;
    --no-release)
      skip_release=1
      ;;
    *)
      if [ -z "$task_key" ]; then
        task_key="$1"
      else
        echo "Unknown argument: $1" >&2
        usage
        exit 1
      fi
      ;;
  esac
  shift
done

[ -n "$task_key" ] || {
  echo "task_key is required" >&2
  usage
  exit 1
}

if [ "${SUPPRESS_ENTRYPOINT_DEPRECATION:-0}" != "1" ]; then
  echo "DEPRECATED: use ./scripts/done_task.sh instead of ./scripts/finish_task.sh" >&2
fi

if [ ! -d .git ]; then
  echo "Not a git repository: $repo_root" >&2
  exit 1
fi

# Ensure hook enforcement is active for all sessions.
git config core.hooksPath .githooks >/dev/null
[ ! -f .githooks/pre-commit ] || chmod +x .githooks/pre-commit
[ ! -f .githooks/post-merge ] || chmod +x .githooks/post-merge

agent="${AGENT_NAME:-}"
if [ -z "$agent" ]; then
  agent="$(detect_agent_from_tty 2>/dev/null || true)"
fi
agent="$(normalize_agent "${agent:-unknown}")"
mark_active_tty "$agent" "finish_task"

echo "finish-task: task=${task_key} agent=${agent}"

if [ "${#test_cmds[@]}" -gt 0 ]; then
  for cmd in "${test_cmds[@]}"; do
    echo "test: $cmd"
    bash -lc "$cmd"
  done
fi

commit_created=0
published_work=0
if [ "$skip_commit" -eq 0 ]; then
  if [ "$stage_all" -eq 1 ]; then
    git add -A
  fi

  if git diff --cached --quiet; then
    echo "No staged changes found."
    if [ "$stage_all" -eq 0 ]; then
      echo "Stage files first (git add <files>) or rerun with --stage-all." >&2
      exit 2
    fi
    echo "Skipping commit."
  else
    if [ -z "$commit_message" ]; then
      commit_message="chore(task): complete ${task_key}"
    fi
    git commit -m "$commit_message"
    commit_created=1
  fi
fi

if [ "$skip_push" -eq 0 ]; then
  if git rev-parse --verify '@{upstream}' >/dev/null 2>&1; then
    git pull --rebase --autostash
    if [ "$(git rev-list --count '@{upstream}..HEAD')" -gt 0 ]; then
      published_work=1
    fi
    git push
  else
    published_work=1
    git push --set-upstream origin HEAD
  fi
  if [ "$published_work" -eq 1 ]; then
    if command -v gh >/dev/null 2>&1; then
      watch_out="$(mktemp)"
      trap 'rm -f "$watch_out"' EXIT
      if python3 scripts/watch_pr_feedback.py start --agent "$agent" --task "$task_key" >"$watch_out" 2>&1; then
        sed 's/^/pr-feedback-watch: /' "$watch_out" || true
      else
        sed 's/^/pr-feedback-watch: /' "$watch_out" >&2 || true
      fi
      echo "pr-feedback-check: python3 scripts/watch_pr_feedback.py check"
    fi
    if ! python3 scripts/update_cacheflow_task_state_from_git.py --event review --commit HEAD --selector "$task_key" --refresh; then
      echo "finish-task: warning: post-push task-state update failed for $task_key" >&2
    fi
  else
    echo "finish-task: no commits published; skipping task-state update"
  fi
elif [ "$commit_created" -eq 1 ]; then
  echo "finish-task: skipping task-state update because push was skipped"
fi

if [ "$skip_release" -eq 0 ]; then
  ./agent-coord.sh release_task "$task_key"
fi

python3 scripts/sync_status_running_sprint.py >/dev/null 2>&1 || true

echo "codex-finalize: python3 scripts/update_cacheflow_metrics.py --complete ${task_key} && ./scripts/refresh_cacheflow_metrics.sh"
if [ "$commit_created" -eq 1 ]; then
  echo "result: committed, pushed, and released (unless skipped)."
else
  echo "result: no commit created; push/release steps executed based on flags."
fi
