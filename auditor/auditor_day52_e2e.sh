#!/bin/bash
set -euo pipefail

# CacheFlow E2E Auditor Script - Day 52 (Standalone)
# Direct-to-API (bypass Cloudflare): default http://127.0.0.1:8100
#
# Goals:
# 1) API health
# 2) Multi-tenant registration
# 3) Structural isolation (Tenant B must NOT see Tenant A file)
# 4) BIGINT quota sanity (used_bytes/quota_bytes are numeric-ish)
# 5) Concurrency stress (50 x 5MB) and final usage check
#
# Exit codes:
# 0 = PASS
# 1 = FAIL (functional/security)
# 2 = FAIL (prereq/infra)
#
# Usage:
#   chmod +x auditor_day52_e2e.sh
#   API_URL=http://127.0.0.1:8100 CONCURRENCY=50 STRESS_MB=5 ./auditor_day52_e2e.sh

API_URL="${API_URL:-http://127.0.0.1:8100}"
CONCURRENCY="${CONCURRENCY:-50}"
SMALL_MB="${SMALL_MB:-1}"
STRESS_MB="${STRESS_MB:-5}"
PASS="${PASS:-AuditBreak123!}"

RUN_ID="${RUN_ID:-audit52_$(date -u +%Y%m%dT%H%M%SZ)_$RANDOM}"
WORKDIR="${WORKDIR:-./cacheflow_auditor_$RUN_ID}"
LOG="${LOG:-$WORKDIR/auditor.log}"

mkdir -p "$WORKDIR"
touch "$LOG"

log() { echo -e "$*" | tee -a "$LOG"; }
fail() { log "\n❌ FAIL: $*"; exit 1; }
prereq_fail() { log "\n❌ PREREQ FAIL: $*"; exit 2; }

cleanup() {
  rm -rf "$WORKDIR" >/dev/null 2>&1 || true
}
trap cleanup EXIT

log "======================================================"
log "🛡️  CACHEFLOW AUDITOR: DAY 52 E2E STRESS TEST"
log "RUN_ID=$RUN_ID"
log "API_URL=$API_URL"
log "WORKDIR=$WORKDIR"
log "LOG=$LOG"
log "======================================================"

# ---------- prereqs ----------
command -v curl >/dev/null 2>&1 || prereq_fail "'curl' not found"
command -v jq   >/dev/null 2>&1 || prereq_fail "'jq' not found (sudo apt-get install -y jq recommended)"
command -v dd   >/dev/null 2>&1 || prereq_fail "'dd' not found"
command -v awk  >/dev/null 2>&1 || prereq_fail "'awk' not found"

# ---------- helpers ----------
http_json() {
  # usage: http_json METHOD URL [DATA_JSON] [AUTH_TOKEN]
  local method="$1"
  local url="$2"
  local data="${3:-}"
  local token="${4:-}"

  if [[ -n "$data" && -n "$token" ]]; then
    curl -sS -X "$method" "$url" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $token" \
      -d "$data"
  elif [[ -n "$data" ]]; then
    curl -sS -X "$method" "$url" \
      -H "Content-Type: application/json" \
      -d "$data"
  elif [[ -n "$token" ]]; then
    curl -sS -X "$method" "$url" \
      -H "Authorization: Bearer $token"
  else
    curl -sS -X "$method" "$url"
  fi
}

# ---------- [0/5] HEALTH ----------
log "\n--- [0/5] API HEALTH CHECK ---"
HEALTH="$(curl -sS "$API_URL/health" || true)"
echo "$HEALTH" | jq . >/dev/null 2>&1 || fail "Health endpoint did not return valid JSON: $HEALTH"
STATUS="$(echo "$HEALTH" | jq -r '.status // empty')"
[[ "$STATUS" == "ok" ]] || fail "API unhealthy or unexpected /health payload: $HEALTH"
log "✅ API is healthy: $HEALTH"

# ---------- [1/5] MULTI-TENANT SETUP ----------
log "\n--- [1/5] MULTI-TENANT SETUP ---"
USER_A="tenant_a_${RUN_ID}@test.com"
USER_B="tenant_b_${RUN_ID}@test.com"

log "Registering User A (Tenant A): $USER_A"
RESP_A="$(http_json POST "$API_URL/auth/register" "{\"email\":\"$USER_A\",\"password\":\"$PASS\"}")" || true
TOKEN_A="$(echo "$RESP_A" | jq -r '.token // empty' 2>/dev/null || true)"

log "Registering User B (Tenant B): $USER_B"
RESP_B="$(http_json POST "$API_URL/auth/register" "{\"email\":\"$USER_B\",\"password\":\"$PASS\"}")" || true
TOKEN_B="$(echo "$RESP_B" | jq -r '.token // empty' 2>/dev/null || true)"

[[ -n "$TOKEN_A" && "$TOKEN_A" != "null" ]] || fail "Registration failed for Tenant A. Response: $RESP_A"
[[ -n "$TOKEN_B" && "$TOKEN_B" != "null" ]] || fail "Registration failed for Tenant B. Response: $RESP_B"
log "✅ Both tenants registered successfully."

# ---------- [2/5] GENERATING TEST PAYLOADS ----------
log "\n--- [2/5] GENERATING TEST PAYLOADS ---"
SMALL_FILE="$WORKDIR/cacheflow_small.bin"
STRESS_FILE="$WORKDIR/cacheflow_stress.bin"

dd if=/dev/urandom of="$SMALL_FILE"  bs=1M count="$SMALL_MB" 2>/dev/null
dd if=/dev/urandom of="$STRESS_FILE" bs=1M count="$STRESS_MB" 2>/dev/null

log "✅ Payloads:"
log " - $SMALL_FILE ($(du -b "$SMALL_FILE" | awk '{print $1}') bytes)"
log " - $STRESS_FILE ($(du -b "$STRESS_FILE" | awk '{print $1}') bytes)"

# ---------- [3/5] TENANT ISOLATION ----------
log "\n--- [3/5] STRUCTURAL ISOLATION TEST ---"
log "Uploading file as Tenant A..."
UPLOAD_A_CODE="$(curl -sS -o "$WORKDIR/upload_a.out" -w "%{http_code}" \
  -X POST "$API_URL/files/upload" \
  -H "Authorization: Bearer $TOKEN_A" \
  -F "file=@$SMALL_FILE;filename=cacheflow_small.bin" || true)"

if [[ "$UPLOAD_A_CODE" != "200" && "$UPLOAD_A_CODE" != "201" ]]; then
  log "Upload response body (Tenant A):"
  sed -n '1,200p' "$WORKDIR/upload_a.out" | tee -a "$LOG"
  fail "Upload failed for Tenant A. HTTP $UPLOAD_A_CODE"
fi
log "✅ Upload succeeded for Tenant A (HTTP $UPLOAD_A_CODE)."

log "Querying GET /files as Tenant B..."
FILES_B="$(curl -sS -X GET "$API_URL/files" -H "Authorization: Bearer $TOKEN_B" || true)"
echo "$FILES_B" | jq . >/dev/null 2>&1 || fail "GET /files for Tenant B did not return valid JSON: $FILES_B"

# Auditor’s expectation: filename from Tenant A must not appear for Tenant B
if echo "$FILES_B" | grep -q "cacheflow_small.bin"; then
  fail "CRITICAL: Tenant B can see Tenant A's file name in /files. Isolation broken."
else
  log "✅ ISOLATION VERIFIED: Tenant B cannot see Tenant A's uploaded filename."
fi

# ---------- [4/5] BIGINT QUOTA SANITY ----------
log "\n--- [4/5] QUOTA ENFORCEMENT & BIGINT SANITY ---"
USAGE_A="$(curl -sS -X GET "$API_URL/files/usage" -H "Authorization: Bearer $TOKEN_A" || true)"
echo "$USAGE_A" | jq . >/dev/null 2>&1 || fail "/files/usage (Tenant A) did not return valid JSON: $USAGE_A"

USED_BYTES="$(echo "$USAGE_A" | jq -r '.used_bytes // empty')"
QUOTA_BYTES="$(echo "$USAGE_A" | jq -r '.quota_bytes // empty')"

log "Tenant A usage: used_bytes=$USED_BYTES quota_bytes=$QUOTA_BYTES"

# We accept either JSON number or numeric-string; we fail on null/empty/non-numeric
is_numeric() { [[ "$1" =~ ^[0-9]+$ ]]; }

[[ -n "$USED_BYTES"  && "$USED_BYTES"  != "null" ]] || fail "used_bytes missing/null in usage response: $USAGE_A"
[[ -n "$QUOTA_BYTES" && "$QUOTA_BYTES" != "null" ]] || fail "quota_bytes missing/null in usage response: $USAGE_A"
is_numeric "$USED_BYTES"  || fail "used_bytes not numeric-ish (BIGINT parsing regression?): $USED_BYTES"
is_numeric "$QUOTA_BYTES" || fail "quota_bytes not numeric-ish (BIGINT parsing regression?): $QUOTA_BYTES"

log "✅ Usage endpoint returns numeric-ish used/quota (BIGINT parse fix appears holding)."

# ---------- [5/5] CONCURRENCY STRESS ----------
log "\n--- [5/5] CONCURRENCY & REDIS TOCTOU STRESS TEST ---"
log "Firing $CONCURRENCY simultaneous uploads of ${STRESS_MB}MB for Tenant B..."
CODES_FILE="$WORKDIR/upload_codes.txt"
: > "$CODES_FILE"

# Background uploads
for i in $(seq 1 "$CONCURRENCY"); do
  (
    code="$(curl -sS -o /dev/null -w "%{http_code}" \
      -X POST "$API_URL/files/upload" \
      -H "Authorization: Bearer $TOKEN_B" \
      -F "file=@$STRESS_FILE;filename=cacheflow_stress_${RUN_ID}_$i.bin" || echo "000")"
    echo "$code" >> "$CODES_FILE"
  ) &
done

log "Waiting for uploads to finish..."
wait
log "✅ All concurrent requests resolved."

# Summarize status codes
log "\n--- Concurrency HTTP code summary ---"
sort "$CODES_FILE" | uniq -c | sort -nr | tee -a "$LOG"

# Final usage check
USAGE_B="$(curl -sS -X GET "$API_URL/files/usage" -H "Authorization: Bearer $TOKEN_B" || true)"
echo "$USAGE_B" | jq . >/dev/null 2>&1 || fail "/files/usage (Tenant B) did not return valid JSON: $USAGE_B"
FINAL_USED="$(echo "$USAGE_B" | jq -r '.used_bytes // empty')"
FINAL_QUOTA="$(echo "$USAGE_B" | jq -r '.quota_bytes // empty')"

log "Tenant B final usage: used_bytes=$FINAL_USED quota_bytes=$FINAL_QUOTA"

[[ -n "$FINAL_USED"  && "$FINAL_USED"  != "null" ]] || fail "Tenant B used_bytes missing/null: $USAGE_B"
[[ -n "$FINAL_QUOTA" && "$FINAL_QUOTA" != "null" ]] || fail "Tenant B quota_bytes missing/null: $USAGE_B"
is_numeric "$FINAL_USED"  || fail "Tenant B used_bytes not numeric-ish: $FINAL_USED"
is_numeric "$FINAL_QUOTA" || fail "Tenant B quota_bytes not numeric-ish: $FINAL_QUOTA"

# Optional sanity: used must not exceed quota (if quota is enforced at API)
if [[ "$FINAL_USED" -gt "$FINAL_QUOTA" ]]; then
  fail "Quota bypass suspected: Tenant B used_bytes ($FINAL_USED) > quota_bytes ($FINAL_QUOTA)"
fi
log "✅ Final usage within quota bounds."

log "\n======================================================"
log "🏁 AUDIT COMPLETE: PASS"
log "LOG FILE: $LOG"
log "======================================================"
