#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${CHAOS_BASE_URL:-https://cacheflow.goels.in}"
EMAIL="${CHAOS_EMAIL:-admin@cacheflow.goels.in}"
PASSWORD="${CHAOS_PASSWORD:-${CACHEFLOW_ADMIN_PASSWORD:-admin123}}"
COOKIE_JAR="$(mktemp)"
trap 'rm -f "$COOKIE_JAR"' EXIT

json_get() {
  python3 -c "import json,sys; data=json.load(sys.stdin); print($1)"
}

login_payload=$(printf '{"email":"%s","password":"%s"}' "$EMAIL" "$PASSWORD")

login_response=$(curl -sS --max-time 45 \
  -H 'Content-Type: application/json' \
  -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
  -X POST "$BASE_URL/api/auth/login" \
  -d "$login_payload" || true)

if [ -z "$login_response" ]; then
  echo "PRECHECK_FAIL: login endpoint returned empty response"
  exit 10
fi

login_ok=$(echo "$login_response" | python3 -c "import json,sys; d=json.load(sys.stdin); print(str(bool(d.get('success') or d.get('ok'))).lower())" 2>/dev/null || echo false)
if [ "$login_ok" != "true" ]; then
  echo "PRECHECK_FAIL: login failed for $EMAIL"
  echo "login_response=$login_response"
  exit 11
fi

session_response=$(curl -sS --max-time 30 -c "$COOKIE_JAR" -b "$COOKIE_JAR" "$BASE_URL/api/auth/session" || true)
session_ok=$(echo "$session_response" | python3 -c "import json,sys; d=json.load(sys.stdin); print(str(bool(d.get('success') or d.get('authenticated') or d.get('user'))).lower())" 2>/dev/null || echo false)
if [ "$session_ok" != "true" ]; then
  echo "PRECHECK_FAIL: session endpoint did not confirm authentication"
  echo "session_response=$session_response"
  exit 12
fi

connections_response=$(curl -sS --max-time 30 -c "$COOKIE_JAR" -b "$COOKIE_JAR" "$BASE_URL/api/connections" || true)
connections_count=$(echo "$connections_response" | python3 -c "import json,sys; d=json.load(sys.stdin); arr=d.get('data') if isinstance(d,dict) else []; print(len(arr) if isinstance(arr,list) else 0)" 2>/dev/null || echo 0)

if [ "$connections_count" -lt 1 ]; then
  echo "PRECHECK_FAIL: no provider connections found for $EMAIL"
  echo "hint=ensure QA seed targets admin/test users and API has run seedQARemotes on startup"
  echo "connections_response=$connections_response"
  exit 13
fi

echo "PRECHECK_OK: base=$BASE_URL email=$EMAIL connections=$connections_count"

