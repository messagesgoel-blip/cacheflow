#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$ROOT/logs"
STATUS_DIR="$ROOT/monitoring"

normalize_home() {
  local current_user user_home
  current_user="$(id -un)"
  user_home="$(getent passwd "$current_user" 2>/dev/null | cut -d: -f6)"
  if [ -n "$user_home" ] && [ -f "$user_home/.coderabbit/auth.json" ] && [ ! -f "$HOME/.coderabbit/auth.json" ]; then
    export HOME="$user_home"
  fi
  export PATH="$HOME/.local/bin:$PATH"
}

slugify() {
  printf '%s' "$1" | sed 's#[^A-Za-z0-9._-]#-#g'
}

iso_now() {
  date -u +"%Y-%m-%dT%H:%M:%SZ"
}

status_field() {
  local file="$1" key="$2"
  [ -f "$file" ] || return 1
  sed -n "s/^${key}: //p" "$file" | tail -n 1
}

write_status() {
  local status_file="$1" status="$2" branch="$3" head="$4" review_type="$5" prompt_mode="$6" pid="$7" started_at="$8" completed_at="$9" exit_code="${10}" log_file="${11}" note="${12}"
  mkdir -p "$STATUS_DIR"
  cat >"$status_file" <<EOF
status: $status
branch: $branch
head: $head
reviewType: $review_type
outputMode: $prompt_mode
pid: $pid
startedAt: $started_at
completedAt: $completed_at
exitCode: $exit_code
logFile: $log_file
note: $note
EOF
}

usage() {
  cat <<'EOF'
Usage:
  scripts/coderabbit-local-review.sh start [--type committed|uncommitted|all] [--plain]
  scripts/coderabbit-local-review.sh status
  scripts/coderabbit-local-review.sh show
  scripts/coderabbit-local-review.sh wait [--timeout SECONDS]

Defaults:
  start runs `coderabbit review --prompt-only --type committed` in the background.
EOF
}

run_review() {
  local status_file="$1" log_file="$2" pid_file="$3" branch="$4" head="$5" review_type="$6" prompt_mode="$7"
  shift 7
  local started_at exit_code completed_at state note pid

  mkdir -p "$LOG_DIR" "$STATUS_DIR"
  pid="$$"
  started_at="$(iso_now)"
  printf '%s\n' "$pid" >"$pid_file"
  : >"$log_file"
  {
    echo "[$started_at] CodeRabbit local review started"
    echo "branch=$branch"
    echo "head=$head"
    echo "review_type=$review_type"
    echo "output_mode=$prompt_mode"
    echo ""
  } >>"$log_file"
  write_status "$status_file" "running" "$branch" "$head" "$review_type" "$prompt_mode" "$pid" "$started_at" "-" "-" "$log_file" "review in progress"

  set +e
  "$@" >>"$log_file" 2>&1
  exit_code=$?
  set -e

  completed_at="$(iso_now)"
  state="completed"
  note="review finished"
  if [ "$exit_code" -ne 0 ]; then
    state="failed"
    note="review command exited non-zero"
  elif grep -qiE "(🚨|actionable comments posted: [1-9]|high severity)" "$log_file"; then
    state="blocked"
    note="review completed with blocking findings"
  fi

  {
    echo ""
    echo "[$completed_at] CodeRabbit local review finished"
    echo "exit_code=$exit_code"
    echo "state=$state"
  } >>"$log_file"

  write_status "$status_file" "$state" "$branch" "$head" "$review_type" "$prompt_mode" "-" "$started_at" "$completed_at" "$exit_code" "$log_file" "$note"
  rm -f "$pid_file"
}

start_review() {
  local review_type="committed"
  local prompt_mode="prompt-only"

  while [ "$#" -gt 0 ]; do
    case "$1" in
      --type)
        shift
        review_type="${1:-}"
        ;;
      --type=*)
        review_type="${1#*=}"
        ;;
      --plain)
        prompt_mode="plain"
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        echo "Unknown argument: $1" >&2
        usage >&2
        exit 1
        ;;
    esac
    shift
  done

  normalize_home
  cd "$ROOT"

  local branch branch_slug head status_file log_file pid_file existing_pid existing_head runner
  branch="$(git rev-parse --abbrev-ref HEAD)"
  branch_slug="$(slugify "$branch")"
  head="$(git rev-parse HEAD)"
  status_file="$STATUS_DIR/coderabbit-local-${branch_slug}.yaml"
  log_file="$LOG_DIR/coderabbit-local-${branch_slug}.log"
  pid_file="/tmp/coderabbit-local-${branch_slug}.pid"

  if [ -f "$pid_file" ]; then
    existing_pid="$(cat "$pid_file" 2>/dev/null || true)"
    existing_head="$(status_field "$status_file" "head" || true)"
    if [ -n "$existing_pid" ] && kill -0 "$existing_pid" 2>/dev/null; then
      if [ "$existing_head" = "$head" ]; then
        echo "CodeRabbit local review already running for $branch @ $head"
        echo "status: $status_file"
        echo "log: $log_file"
        exit 0
      fi
      kill "$existing_pid" 2>/dev/null || true
      sleep 1
    fi
    rm -f "$pid_file"
  fi

  mkdir -p "$LOG_DIR" "$STATUS_DIR"
  runner=(coderabbit review "--$prompt_mode" --type "$review_type" --cwd "$ROOT")
  if [ -n "${CODERABBIT_API_KEY:-}" ]; then
    runner+=(--api-key "$CODERABBIT_API_KEY")
  fi

  nohup "$0" _run "$status_file" "$log_file" "$pid_file" "$branch" "$head" "$review_type" "$prompt_mode" "${runner[@]}" >/dev/null 2>&1 &

  echo "CodeRabbit local review launched"
  echo "branch: $branch"
  echo "head: $head"
  echo "status: $status_file"
  echo "log: $log_file"
}

show_status() {
  local branch branch_slug status_file
  cd "$ROOT"
  branch="$(git rev-parse --abbrev-ref HEAD)"
  branch_slug="$(slugify "$branch")"
  status_file="$STATUS_DIR/coderabbit-local-${branch_slug}.yaml"
  if [ ! -f "$status_file" ]; then
    echo "No local CodeRabbit review status for $branch"
    exit 1
  fi
  cat "$status_file"
}

show_log() {
  local branch branch_slug log_file
  cd "$ROOT"
  branch="$(git rev-parse --abbrev-ref HEAD)"
  branch_slug="$(slugify "$branch")"
  log_file="$LOG_DIR/coderabbit-local-${branch_slug}.log"
  if [ ! -f "$log_file" ]; then
    echo "No local CodeRabbit review log for $branch"
    exit 1
  fi
  cat "$log_file"
}

wait_for_review() {
  local timeout_seconds=1800

  while [ "$#" -gt 0 ]; do
    case "$1" in
      --timeout)
        shift
        timeout_seconds="${1:-}"
        ;;
      --timeout=*)
        timeout_seconds="${1#*=}"
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        echo "Unknown argument: $1" >&2
        usage >&2
        exit 1
        ;;
    esac
    shift
  done

  local branch branch_slug status_file waited status
  cd "$ROOT"
  branch="$(git rev-parse --abbrev-ref HEAD)"
  branch_slug="$(slugify "$branch")"
  status_file="$STATUS_DIR/coderabbit-local-${branch_slug}.yaml"

  waited=0
  while [ "$waited" -lt "$timeout_seconds" ]; do
    if [ -f "$status_file" ]; then
      status="$(status_field "$status_file" "status" || true)"
      if [ "$status" != "running" ] && [ -n "$status" ]; then
        cat "$status_file"
        exit 0
      fi
    fi
    sleep 5
    waited=$((waited + 5))
  done

  echo "Timed out waiting for local CodeRabbit review after ${timeout_seconds}s" >&2
  exit 124
}

command="${1:-}"
case "$command" in
  start)
    shift
    start_review "$@"
    ;;
  status)
    shift
    show_status "$@"
    ;;
  show)
    shift
    show_log "$@"
    ;;
  wait)
    shift
    wait_for_review "$@"
    ;;
  _run)
    shift
    run_review "$@"
    ;;
  ""|-h|--help|help)
    usage
    ;;
  *)
    echo "Unknown command: $command" >&2
    usage >&2
    exit 1
    ;;
esac
