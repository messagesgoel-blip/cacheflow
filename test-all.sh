#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd -- "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

run_suite() {
  local name="$1"
  local dir="$2"
  local cmd="$3"
  echo "\n▶ ${name} tests"
  (
    cd "$dir"
    NODE_ENV=test \
    TOKEN_ENCRYPTION_KEY="${TOKEN_ENCRYPTION_KEY:-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef}" \
    $cmd
  )
}

run_suite "web"    "$ROOT/web"    "npm test -- --runInBand"
run_suite "api"    "$ROOT/api"    "npm test -- --runInBand"
run_suite "worker" "$ROOT/worker" "npm test -- --runInBand"

echo "\n✅ All suites finished"
