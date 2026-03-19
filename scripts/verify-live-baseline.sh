#!/usr/bin/env bash
# Verify Live Provider/Account Baseline (ENV-03)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB_URL="${CACHEFLOW_WEB_URL:-${PLAYWRIGHT_BASE_URL:-https://cacheflow.goels.in}}"
API_URL="${CACHEFLOW_API_URL:-${NEXT_PUBLIC_API_URL:-http://127.0.0.1:8100}}"
TOKEN_SOURCE="${CACHEFLOW_ACCESS_TOKEN:-${ACCESS_TOKEN:-${1:-}}}"
COOKIE_SOURCE="${CACHEFLOW_COOKIE_HEADER:-${COOKIE_HEADER:-${SESSION_COOKIE:-${2:-}}}}"
FIXTURES_DIR="$REPO_ROOT/web/e2e/fixtures/files"
EXPECTED_FILES=("normal-file.txt" "test-document.pdf" "report.docx" "image.png")

usage() {
  cat <<'EOF'
Usage:
  CACHEFLOW_ACCESS_TOKEN=<jwt> scripts/verify-live-baseline.sh
  CACHEFLOW_COOKIE_HEADER='accessToken=<jwt>; ...' scripts/verify-live-baseline.sh
  scripts/verify-live-baseline.sh <access-token>

The script verifies:
- live session is accepted by the web app
- /api/health is reachable
- at least one provider is connected and healthy
- the root directory contains the expected fixture files
- available quota is at least 1 GiB
- 2FA is either disabled or has the ENV-01 secret available
EOF
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

json_eval() {
  local expression="$1"
  node -e '
const fs = require("node:fs")
const payload = JSON.parse(fs.readFileSync(0, "utf8"))
const expression = process.argv[1]
const value = Function("payload", `return (${expression});`)(payload)
if (Array.isArray(value)) {
  process.stdout.write(value.join("\n"))
} else if (value === undefined || value === null) {
  process.stdout.write("")
} else {
  process.stdout.write(String(value))
}
' "$expression"
}

failures=0
secret_loaded=0

if [ -f "$REPO_ROOT/web/.env.live" ] && grep -q '^CF_TOTP_SECRET=' "$REPO_ROOT/web/.env.live"; then
  secret_loaded=1
fi

TOKEN_SOURCE="$(extract_access_token "$TOKEN_SOURCE")"
if [ -z "$TOKEN_SOURCE" ]; then
  TOKEN_SOURCE="$(extract_access_token "$COOKIE_SOURCE")"
fi

if [ -z "$TOKEN_SOURCE" ]; then
  usage >&2
  echo "Error: an access token or cookie header is required." >&2
  exit 1
fi

if [ ! -d "$FIXTURES_DIR" ]; then
  echo "Error: fixtures directory not found: $FIXTURES_DIR" >&2
  exit 1
fi

pass() {
  printf '✅ %s\n' "$1"
}

fail() {
  printf '❌ %s\n' "$1" >&2
  failures=$((failures + 1))
}

echo "Verifying live account baseline..."

if session_response="$(curl -fsS -H "Cookie: accessToken=$TOKEN_SOURCE" "$WEB_URL/api/auth/session")"; then
  if [ "$(printf '%s' "$session_response" | json_eval 'Boolean(payload.authenticated)')" = "true" ]; then
    pass "Web session accepted"
  else
    fail "Web session accepted"
  fi
else
  fail "Web session accepted"
fi

if health_response="$(curl -fsS "$WEB_URL/api/health")"; then
  if [ "$(printf '%s' "$health_response" | json_eval 'payload.status')" = "ok" ]; then
    pass "Web health endpoint reachable"
  else
    fail "Web health endpoint reachable"
  fi
else
  fail "Web health endpoint reachable"
fi

if connections_response="$(curl -fsS -H "Cookie: accessToken=$TOKEN_SOURCE" "$WEB_URL/api/connections")"; then
  if [ "$(printf '%s' "$connections_response" | json_eval '(payload.data || []).length')" -ge 1 ]; then
    pass "Connected provider data available"
  else
    fail "Connected provider data available"
  fi
else
  fail "Connected provider data available"
fi

if connections_health_response="$(curl -fsS -H "Cookie: accessToken=$TOKEN_SOURCE" "$WEB_URL/api/connections/health")"; then
  healthy_count="$(printf '%s' "$connections_health_response" | json_eval '(payload.connections || []).filter((entry) => entry && entry.probe && entry.probe.status === "healthy").length')"
  if [ "$healthy_count" -ge 1 ]; then
    pass "At least one provider is healthy"
  else
    fail "At least one provider is healthy"
  fi
else
  fail "At least one provider is healthy"
fi

if usage_response="$(curl -fsS -H "Authorization: Bearer $TOKEN_SOURCE" "$API_URL/files/usage")"; then
  available_bytes="$(printf '%s' "$usage_response" | json_eval 'payload.available_bytes')"
  if [ "$available_bytes" -ge 1073741824 ]; then
    pass "Available quota is at least 1 GiB"
  else
    fail "Available quota is at least 1 GiB"
  fi
else
  fail "Available quota is at least 1 GiB"
fi

if root_listing_response="$(curl -fsS -H "Authorization: Bearer $TOKEN_SOURCE" "$API_URL/files/browse?path=/")"; then
  root_names="$(printf '%s' "$root_listing_response" | json_eval '((payload.files || []).map((entry) => entry && entry.name).filter(Boolean).concat((payload.folders || []).map((entry) => entry && entry.name).filter(Boolean))).join("\n")')"
  root_missing=0
  for file_name in "${EXPECTED_FILES[@]}"; do
    if ! printf '%s\n' "$root_names" | grep -Fxq "$file_name"; then
      printf 'missing:%s\n' "$file_name" >&2
      root_missing=1
    fi
  done
  if [ "$root_missing" -eq 0 ]; then
    pass "Root listing contains seeded fixture files"
  else
    fail "Root listing contains seeded fixture files"
  fi
else
  fail "Root listing contains seeded fixture files"
fi

if twofa_response="$(curl -fsS -H "Cookie: accessToken=$TOKEN_SOURCE" "$WEB_URL/api/auth/2fa/status")"; then
  enabled="$(printf '%s' "$twofa_response" | json_eval 'Boolean(payload.enabled)')"
  if [ "$enabled" = "true" ] && [ "$secret_loaded" -ne 1 ]; then
    fail "2FA secret is loaded or 2FA is off"
  else
    pass "2FA secret is loaded or 2FA is off"
  fi
else
  fail "2FA secret is loaded or 2FA is off"
fi

if [ "${REQUIRE_VPS_CONNECTION:-false}" = "true" ]; then
  if vps_response="$(curl -fsS -H "Cookie: accessToken=$TOKEN_SOURCE" "$WEB_URL/api/connections/health")"; then
    vps_count="$(printf '%s' "$vps_response" | json_eval '(payload.connections || []).filter((entry) => entry && entry.provider === "vps" && entry.probe && entry.probe.status === "healthy").length')"
    if [ "$vps_count" -ge 1 ]; then
      pass "VPS provider is healthy"
    else
      fail "VPS provider is healthy"
    fi
  else
    fail "VPS provider is healthy"
  fi
fi

if [ "$failures" -ne 0 ]; then
  echo ""
  echo "Baseline verification failed with $failures issue(s)." >&2
  exit 1
fi

echo ""
echo "Verification complete. Ready for V1-4-RERUN."
