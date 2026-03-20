#!/usr/bin/env bash
# Mint a repo-owned bootstrap access token from the local bootstrap credentials.
# Falls back to the existing access-token input if one is already provided.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$REPO_ROOT/web/.env.live"
API_URL="${CACHEFLOW_API_URL:-${NEXT_PUBLIC_API_URL:-http://127.0.0.1:8100}}"

load_env_file() {
  if [ -f "$ENV_FILE" ]; then
    set -a
    # shellcheck disable=SC1090
    . "$ENV_FILE"
    set +a
  fi
}

extract_access_token() {
  local source="${1:-}"
  if [ -z "$source" ]; then
    return 0
  fi

  if [[ "$source" == *"accessToken="* ]]; then
    node - "$source" <<'NODE'
const source = process.argv[2] || ''
const match = source.match(/(?:^|;\s*)accessToken=([^;]+)/)
process.stdout.write(match ? match[1] : '')
NODE
    return 0
  fi

  printf '%s' "$source"
}

json_string() {
  node - "$1" "$2" <<'NODE'
const email = process.argv[2] || ''
const password = process.argv[3] || ''
process.stdout.write(JSON.stringify({ email, password }))
NODE
}

json_token() {
  node - "$1" <<'NODE'
const fs = require('node:fs')
const responsePath = process.argv[2] || ''
const payload = JSON.parse(fs.readFileSync(responsePath, 'utf8'))
process.stdout.write(payload?.token || payload?.data?.token || '')
NODE
}

request_token() {
  local email="$1"
  local password="$2"
  local path="$3"
  local response_file
  response_file="$(mktemp)"
  local payload
  payload="$(json_string "$email" "$password")"

  local http_code
  if ! http_code="$(curl -sS -o "$response_file" -w '%{http_code}' \
    -H 'Content-Type: application/json' \
    -d "$payload" \
    "$API_URL$path")"; then
    rm -f "$response_file"
    echo ""
    return 1
  fi

  if [ "$http_code" != "200" ]; then
    rm -f "$response_file"
    echo ""
    return 1
  fi

  local token
  token="$(json_token "$response_file")"
  rm -f "$response_file"
  printf '%s' "$token"
}

register_bootstrap_user() {
  local email="$1"
  local password="$2"
  local response_file
  response_file="$(mktemp)"
  local payload
  payload="$(json_string "$email" "$password")"

  local http_code
  if ! http_code="$(curl -sS -o "$response_file" -w '%{http_code}' \
    -H 'Content-Type: application/json' \
    -d "$payload" \
    "$API_URL/auth/register")"; then
    rm -f "$response_file"
    return 1
  fi

  rm -f "$response_file"
  case "$http_code" in
    201|409) return 0 ;;
    *) return 1 ;;
  esac
}

manual_source="${CACHEFLOW_ACCESS_TOKEN:-${ACCESS_TOKEN:-${1:-}}}"
manual_token="$(extract_access_token "$manual_source")"
if [ -n "$manual_token" ]; then
  printf '%s\n' "$manual_token"
  exit 0
fi

if [ ! -f "$ENV_FILE" ]; then
  bash "$REPO_ROOT/scripts/setup-live-env.sh" >/dev/null
fi

load_env_file

bootstrap_email="${CACHEFLOW_BOOTSTRAP_EMAIL:-${PLAYWRIGHT_QA_EMAIL:-${CACHEFLOW_TEST_USER_EMAIL:-}}}"
bootstrap_password="${CACHEFLOW_BOOTSTRAP_PASSWORD:-${PLAYWRIGHT_QA_PASSWORD:-${CACHEFLOW_TEST_USER_PASSWORD:-}}}"

if [ -z "$bootstrap_email" ] || [ -z "$bootstrap_password" ]; then
  bash "$REPO_ROOT/scripts/setup-live-env.sh" >/dev/null
  load_env_file
  bootstrap_email="${CACHEFLOW_BOOTSTRAP_EMAIL:-${PLAYWRIGHT_QA_EMAIL:-${CACHEFLOW_TEST_USER_EMAIL:-}}}"
  bootstrap_password="${CACHEFLOW_BOOTSTRAP_PASSWORD:-${PLAYWRIGHT_QA_PASSWORD:-${CACHEFLOW_TEST_USER_PASSWORD:-}}}"
fi

if [ -z "$bootstrap_email" ] || [ -z "$bootstrap_password" ]; then
  echo "Error: bootstrap credentials are missing. Run scripts/setup-live-env.sh first." >&2
  exit 1
fi

if token="$(request_token "$bootstrap_email" "$bootstrap_password" /auth/login)"; [ -n "$token" ]; then
  printf '%s\n' "$token"
  exit 0
fi

if ! register_bootstrap_user "$bootstrap_email" "$bootstrap_password"; then
  echo "Error: failed to register or log in bootstrap user at $bootstrap_email." >&2
  exit 1
fi

if token="$(request_token "$bootstrap_email" "$bootstrap_password" /auth/login)"; [ -n "$token" ]; then
  printf '%s\n' "$token"
  exit 0
fi

echo "Error: unable to mint bootstrap access token from $bootstrap_email." >&2
exit 1
