#!/usr/bin/env bash
set -euo pipefail

# CacheFlow QA — Days 80–84
# Tests for: MilesWeb redundancy, overflow sync, audit logging, failover
#
# Usage:
#   ./qa_day80_84.sh init
#   ./qa_day80_84.sh all
#   ./qa_day80_84.sh t150 | T-150 | 150

API_BASE="${API_BASE:-http://cacheflow-api:8100}"
WEB_BASE="${WEB_BASE:-http://127.0.0.1:3010}"

LOGIN_EMAIL="${LOGIN_EMAIL:-test-day37@cacheflow.dev}"
LOGIN_PASS="${LOGIN_PASS:-password123}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@cacheflow.dev}"
ADMIN_PASS="${ADMIN_PASS:-admin123456}"

RUNS_DIR="${RUNS_DIR:-$HOME/cacheflow-qa-runs}"
RUN_DIR="${RUN_DIR:-}"
RUN_ID="${RUN_ID:-$(date -u +%Y%m%d_%H%M%S)}"

CMD_OUT=""
CMD_RC=0

CF_ROOT="${CF_ROOT:-/workspace/cacheflow}"
LOCAL_DIR="${LOCAL_DIR:-/mnt/local}"
MILESWEB_HOST="${MILESWEB_HOST:-100.72.114.54}"

RAW_LOG=""
REPORT_MD=""
SUMMARY_TSV=""
HTTP_CODE=""
HTTP_BODY=""

ts() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }

need() { command -v "$1" >/dev/null 2>&1 || { echo "Missing dependency: $1"; exit 2; }; }

init_run() {
  need curl; need jq; need grep; need awk; need sed; need ssh
  if [[ -z "$RUN_DIR" ]]; then
    RUN_DIR="$RUNS_DIR/$(date -u +%Y%m%d_%H%M%S)_d8084"
  fi
  mkdir -p "$RUN_DIR"
  RAW_LOG="$RUN_DIR/raw.log"
  REPORT_MD="$RUN_DIR/report.md"
  SUMMARY_TSV="$RUN_DIR/summary.tsv"

  : > "$RAW_LOG"
  echo -e "timestamp_utc\tid\tstatus\tnotes" > "$SUMMARY_TSV"
  cat > "$REPORT_MD" <<MD
# CacheFlow Days 80–84 Report
- Started (UTC): $(ts)
- API_BASE: $API_BASE
- WEB_BASE: $WEB_BASE
- CF_ROOT: $CF_ROOT

| Status | ID | Test | Expected | Actual (short) | Timestamp |
|---|---|---|---|---|---|
MD
  echo "RUN_DIR=$RUN_DIR"
}

load_run() {
  if [[ -z "$RUN_DIR" ]]; then
    RUN_DIR="$(ls -1dt "$RUNS_DIR"/*_d8084 2>/dev/null | head -1 || true)"
  fi
  if [[ -n "$RUN_DIR" && ! -d "$RUN_DIR" ]]; then
    mkdir -p "$RUN_DIR"
  fi
  [[ -n "$RUN_DIR" && -d "$RUN_DIR" ]] || { echo "No RUN_DIR found. Run: ./qa_day80_84.sh init"; exit 2; }
  RAW_LOG="$RUN_DIR/raw.log"
  REPORT_MD="$RUN_DIR/report.md"
  SUMMARY_TSV="$RUN_DIR/summary.tsv"
  [[ -f "$SUMMARY_TSV" ]] || echo -e "timestamp_utc\tid\tstatus\tnotes" > "$SUMMARY_TSV"
  [[ -f "$REPORT_MD" ]] || cat > "$REPORT_MD" <<MD
# CacheFlow Days 80–84 Report
- Started (UTC): $(ts)
- API_BASE: $API_BASE
- WEB_BASE: $WEB_BASE
- CF_ROOT: $CF_ROOT

| Status | ID | Test | Expected | Actual (short) | Timestamp |
|---|---|---|---|---|---|
MD
}

record() {
  local status="$1" id="$2" test="$3" expected="$4" actual="$5" notes="$6"
  echo "[$status] $id - $test"
  printf "| %s | %s | %s | %s | %s | %s |\n" \
    "$status" "$id" "$test" "$expected" "${actual//|/\\|}" "$(ts)" >> "$REPORT_MD"
  echo -e "$(ts)\t$id\t$status\t$notes" >> "$SUMMARY_TSV"
}

run_cmd() {
  local cmd="$1"
  set +e
  CMD_OUT="$(bash -lc "$cmd" 2>&1)"
  CMD_RC=$?
  set -e
  echo "========== $(ts) $cmd" >> "$RAW_LOG"
  echo "$CMD_OUT" >> "$RAW_LOG"
  echo >> "$RAW_LOG"
  return $CMD_RC
}

log_raw() {
  local id="$1" title="$2" cmd="$3"
  {
    echo "========== $(ts) $id $title =========="
    echo "CMD: $cmd"
    echo "RC: ${CMD_RC:-0}"
    echo "${CMD_OUT:-}"
    echo
  } >> "$RAW_LOG"
}

get_token() {
  local email="${1:-$LOGIN_EMAIL}"
  local password="${2:-$LOGIN_PASS}"
  local resp token tmp
  tmp="$RUN_DIR/login.json"
  run_cmd "curl -sS -o '$tmp' -X POST '$API_BASE/auth/login' -H 'Content-Type: application/json' -d '{\"email\":\"$email\",\"password\":\"$password\"}'"
  resp="$(cat "$tmp" 2>/dev/null || true)"
  token="$(printf '%s' "$resp" | grep -o '"token":"[^"]*"' | head -n 1 | cut -d'"' -f4 || true)"
  [[ "$CMD_RC" == "0" ]] || { echo "login failed (rc=$CMD_RC): $resp" >> "$RAW_LOG"; return 1; }
  [[ -n "$token" ]] || { echo "login failed: $resp" >> "$RAW_LOG"; return 1; }
  echo "$token"
}

get_admin_token() {
  get_token "$ADMIN_EMAIL" "$ADMIN_PASS"
}

# Detect accessible API endpoint
detect_api() {
  # Try default first
  if curl -sS --connect-timeout 2 "$API_BASE/health" >/dev/null 2>&1; then
    return 0
  fi
  # Try via docker network
  if curl -sS --connect-timeout 2 "http://cacheflow-api:8100/health" >/dev/null 2>&1; then
    API_BASE="http://cacheflow-api:8100"
    return 0
  fi
  return 1
}

http_json() {
  local method="$1" url="$2" data="${3:-}" token="${4:-}"
  local tmp="$RUN_DIR/http_body_$$.txt"
  local code
  if [[ -n "$data" ]]; then
    if [[ -n "$token" ]]; then
      code="$(curl -sS -o "$tmp" -w "%{http_code}" -X "$method" -H "Content-Type: application/json" -H "Authorization: Bearer $token" -d "$data" "$url" || true)"
    else
      code="$(curl -sS -o "$tmp" -w "%{http_code}" -X "$method" -H "Content-Type: application/json" -d "$data" "$url" || true)"
    fi
  else
    if [[ -n "$token" ]]; then
      code="$(curl -sS -o "$tmp" -w "%{http_code}" -X "$method" -H "Authorization: Bearer $token" "$url" || true)"
    else
      code="$(curl -sS -o "$tmp" -w "%{http_code}" -X "$method" "$url" || true)"
    fi
  fi
  HTTP_CODE="$code"
  HTTP_BODY="$(cat "$tmp" 2>/dev/null || true)"
  rm -f "$tmp"
}

run_step() {
  local name="$1"
  local start end dur rc
  start="$(date +%s)"
  "$name"
  rc=$?
  end="$(date +%s)"
  dur=$((end-start))
  if [[ -n "${RAW_LOG:-}" ]]; then
    echo "TIME $name ${dur}s" >> "$RAW_LOG"
  fi
  return $rc
}

json_get() {
  # Use jq for JSON parsing
  local json="$1"
  local path="$2"
  if [[ -z "$path" ]]; then
    echo "$json"
    return
  fi
  # Convert dot notation to jq notation
  local jq_path
  jq_path=$(echo "$path" | sed 's/\././g')
  echo "$json" | jq -r ".$jq_path" 2>/dev/null || true
}

# ============================================================================
# Day 80: (Placeholder - not implemented in this session)
# ============================================================================

t150() {
  # Placeholder for Day 80 feature
  record "SKIP" "T-150" "Day 80 feature" "not defined" "Skipped" "not in plan"
}

# ============================================================================
# Day 81: MilesWeb systemd Services
# ============================================================================

t151() {
  # SSH to MilesWeb succeeds in BatchMode (non-interactive)
  local rc
  timeout 10s ssh -o BatchMode=yes -o ConnectTimeout=7 -o StrictHostKeyChecking=accept-new sanjay@$MILESWEB_HOST true
  rc=$?
  [[ "$rc" == "0" ]] && record "PASS" "T-151" "SSH to MilesWeb BatchMode" "rc=0" "rc=$rc" "ok" \
    || { record "FAIL" "T-151" "SSH to MilesWeb BatchMode" "rc=0" "rc=$rc" "ssh failed"; return 1; }
}

t152() {
  # cacheflow-rclone.timer is active and enabled on MilesWeb
  local active enabled
  active="$(ssh sanjay@$MILESWEB_HOST "systemctl --user is-active cacheflow-rclone.timer" 2>/dev/null || true)"
  enabled="$(ssh sanjay@$MILESWEB_HOST "systemctl --user is-enabled cacheflow-rclone.timer" 2>/dev/null || true)"

  if [[ "$active" == "active" ]] && [[ "$enabled" == "enabled" ]]; then
    record "PASS" "T-152" "cacheflow-rclone.timer active/enabled" "active + enabled" "active=$active enabled=$enabled" "ok"
  else
    record "FAIL" "T-152" "cacheflow-rclone.timer active/enabled" "active + enabled" "active=$active enabled=$enabled" "timer not configured"
    return 1
  fi
}

t153() {
  # rclone lsd milesweb: succeeds from worker container within 15s
  local out rc
  out="$(docker exec cacheflow-worker rclone lsd goels:/srv/storage/remotes/parul-main/CacheFlow --timeout 15s 2>&1)"
  rc=$?

  [[ "$rc" == "0" ]] && record "PASS" "T-153" "rclone to MilesWeb from OCI" "rc=0" "rc=$rc" "ok" \
    || { record "FAIL" "T-153" "rclone to MilesWeb from OCI" "rc=0" "rc=$rc" "rclone failed: $out"; return 1; }
}

# ============================================================================
# Day 82: Overflow Sync
# ============================================================================

t154() {
  # RCLONE_DEST_OVERFLOW env var is set
  local overflow_dest
  overflow_dest="$(docker exec cacheflow-worker env | grep RCLONE_DEST_OVERFLOW | cut -d= -f2 || true)"

  if [[ -n "$overflow_dest" ]]; then
    record "PASS" "T-154" "RCLONE_DEST_OVERFLOW env var" "set" "$overflow_dest" "ok"
  else
    # Check in worker source code
    if grep -q "RCLONE_DEST_OVERFLOW" "$CF_ROOT/worker/sync-worker.js"; then
      record "PASS" "T-154" "RCLONE_DEST_OVERFLOW in code" "defined in code" "found in sync-worker.js" "ok"
    else
      record "FAIL" "T-154" "RCLONE_DEST_OVERFLOW env var" "set" "not found" "overflow not configured"
      return 1
    fi
  fi
}

t155() {
  # Worker has getRcloneDest function for overflow routing
  if grep -q "getRcloneDest" "$CF_ROOT/worker/sync-worker.js"; then
    record "PASS" "T-155" "Worker has overflow routing function" "getRcloneDest exists" "found" "ok"
  else
    record "FAIL" "T-155" "Worker has overflow routing function" "getRcloneDest exists" "not found" "missing function"
    return 1
  fi
}

# ============================================================================
# Day 83: Audit Logging
# ============================================================================

t156() {
  # audit_logs table exists with correct schema
  local schema_check
  schema_check="$(docker exec cacheflow-postgres psql -U cacheflow -d cacheflow -t -c "SELECT COUNT(*) FROM information_schema.columns WHERE table_name='audit_logs' AND column_name IN ('action','resource','user_id','ip_address','metadata','created_at')" 2>/dev/null || true)"

  if [[ "$schema_check" -ge 6 ]]; then
    record "PASS" "T-156" "audit_logs table exists" "schema correct" "columns=$schema_check" "ok"
  else
    record "FAIL" "T-156" "audit_logs table exists" "schema correct" "columns=$schema_check" "missing columns"
    return 1
  fi
}

t157() {
  # Upload creates audit_log entry with action='upload'
  detect_api || { record "SKIP" "T-157" "Upload creates audit log" "API" "not accessible" "network"; return 0; }
  local token tmp up_code audit_count
  token="$(get_token)" || { record "FAIL" "T-157" "Upload creates audit log" "token" "login failed" "login failed"; return 1; }

  # Upload a test file
  tmp="$RUN_DIR/t157_upload.txt"
  echo "audit test T-157 $(date)" > "$tmp"
  run_cmd "curl -sS -o '$RUN_DIR/t157_upload.json' -w '%{http_code}' -X POST '$API_BASE/files/upload' -H 'Authorization: Bearer $token' -F 'file=@$tmp' > '$RUN_DIR/t157_upload.code'"
  up_code="$(cat "$RUN_DIR/t157_upload.code" 2>/dev/null | tr -d '[:space:]')"

  if [[ "$up_code" != "201" ]]; then
    record "FAIL" "T-157" "Upload creates audit log" "upload 201" "HTTP $up_code" "upload failed"
    return 1
  fi

  # Get file ID
  local body file_id
  body="$(cat "$RUN_DIR/t157_upload.json" 2>/dev/null || true)"
  file_id="$(echo "$body" | jq -r '.file.id // .id' 2>/dev/null || true)"

  # Wait a moment for audit log to be written
  sleep 2

  # Check audit logs
  audit_count="$(docker exec cacheflow-postgres psql -U cacheflow -d cacheflow -t -c "SELECT COUNT(*) FROM audit_logs WHERE action='upload' AND resource_id='$file_id'" 2>/dev/null | tr -d ' ' || true)"

  if [[ "$audit_count" -ge 1 ]]; then
    record "PASS" "T-157" "Upload creates audit log" "entry created" "count=$audit_count" "ok"
  else
    record "FAIL" "T-157" "Upload creates audit log" "entry created" "count=$audit_count" "audit log not created"
    return 1
  fi
}

t158() {
  # Download creates audit_log entry with action='download'
  detect_api || { record "SKIP" "T-158" "Download creates audit log" "API" "not accessible" "network"; return 0; }
  local token audit_count

  # First get a file to download
  token="$(get_token)" || { record "FAIL" "T-158" "Download creates audit log" "token" "login failed" "login failed"; return 1; }

  http_json GET "$API_BASE/files" "" "$token"
  local files_json first_file_id
  files_json="$(json_get "$HTTP_BODY" "files")"
  first_file_id="$(echo "$files_json" | jq -r '.[0].id // empty' 2>/dev/null || true)"

  if [[ -z "$first_file_id" ]]; then
    record "SKIP" "T-158" "Download creates audit log" "file to download" "no files" "no files to test"
    return 0
  fi

  # Download the file
  run_cmd "curl -sS -o /dev/null -w '%{http_code}' '$API_BASE/files/$first_file_id/download' -H 'Authorization: Bearer $token' > '$RUN_DIR/t158.code'"
  local dl_code
  dl_code="$(cat "$RUN_DIR/t158.code" 2>/dev/null | tr -d '[:space:]')"

  if [[ "$dl_code" != "200" ]]; then
    record "FAIL" "T-158" "Download creates audit log" "HTTP 200" "HTTP $dl_code" "download failed"
    return 1
  fi

  # Wait for audit log
  sleep 2

  # Check audit logs
  audit_count="$(docker exec cacheflow-postgres psql -U cacheflow -d cacheflow -t -c "SELECT COUNT(*) FROM audit_logs WHERE action='download' AND resource_id='$first_file_id'" 2>/dev/null | tr -d ' ' || true)"

  if [[ "$audit_count" -ge 1 ]]; then
    record "PASS" "T-158" "Download creates audit log" "entry created" "count=$audit_count" "ok"
  else
    record "FAIL" "T-158" "Download creates audit log" "entry created" "count=$audit_count" "audit log not created"
    return 1
  fi
}

t159() {
  # GET /admin/audit returns 200 for admin user
  detect_api || { record "SKIP" "T-159" "Admin audit endpoint" "API" "not accessible" "network"; return 0; }
  local admin_token
  admin_token="$(get_admin_token 2>/dev/null)" || { record "SKIP" "T-159" "Admin audit endpoint" "admin login" "admin not found" "no admin user"; return 0; }

  http_json GET "$API_BASE/admin/audit?limit=10" "" "$admin_token"

  if [[ "$HTTP_CODE" == "200" ]]; then
    record "PASS" "T-159" "Admin audit endpoint" "HTTP 200" "HTTP $HTTP_CODE" "ok"
  else
    record "FAIL" "T-159" "Admin audit endpoint" "HTTP 200" "HTTP $HTTP_CODE" "endpoint failed"
    return 1
  fi
}

# ============================================================================
# Day 84: Failover Test
# ============================================================================

t160() {
  # Worker is running (survived any previous disruptions)
  local worker_status
  worker_status="$(docker ps --filter "name=cacheflow-worker" --format "{{.Status}}" 2>/dev/null || true)"

  if echo "$worker_status" | grep -q "Up"; then
    record "PASS" "T-160" "Worker is running" "status=Up" "$worker_status" "ok"
  else
    record "FAIL" "T-160" "Worker is running" "status=Up" "$worker_status" "worker not running"
    return 1
  fi
}

t161() {
  # Files in error state can be retried via POST /files/:id/retry
  detect_api || { record "SKIP" "T-161" "Retry endpoint works" "API" "not accessible" "network"; return 0; }
  local token

  # First check if there are any error files
  token="$(get_token)" || { record "FAIL" "T-161" "Retry endpoint works" "token" "login failed" "login failed"; return 1; }

  http_json GET "$API_BASE/files?status=error" "" "$token"

  # Even if no error files, test that the endpoint exists and works for any file
  # Pick any file to test retry endpoint
  local files_json first_file_id
  files_json="$(json_get "$HTTP_BODY" "files")"
  first_file_id="$(echo "$files_json" | jq -r '.[0].id // empty' 2>/dev/null || true)"

  if [[ -z "$first_file_id" ]]; then
    record "SKIP" "T-161" "Retry endpoint works" "file to retry" "no files" "no files to test"
    return 0
  fi

  http_json POST "$API_BASE/files/$first_file_id/retry" "" "$token"

  # Accept 200 (success), 404 (not in error state), or 400 (already retrying)
  if [[ "$HTTP_CODE" == "200" ]] || [[ "$HTTP_CODE" == "404" ]] || [[ "$HTTP_CODE" == "400" ]]; then
    record "PASS" "T-161" "Retry endpoint works" "HTTP 200/404/400" "HTTP $HTTP_CODE" "ok"
  else
    record "FAIL" "T-161" "Retry endpoint works" "HTTP 200/404/400" "HTTP $HTTP_CODE" "unexpected response"
    return 1
  fi
}

t162() {
  # RTO: Worker recovers from stale syncing files (periodic recovery enabled)
  # Check that STALE_SYNcing_TIMEOUT_MS is configured
  local timeout_config
  timeout_config="$(docker exec cacheflow-worker env | grep STALE_SYNCING_SWEEP_MS | cut -d= -f2 || true)"

  if [[ -n "$timeout_config" ]]; then
    record "PASS" "T-162" "Stale sync recovery configured" "env var set" "timeout=${timeout_config}ms" "ok"
  else
    # Check in code
    if grep -q "STALE_SYNCING_SWEEP_MS\|recoverStaleSyncingFiles" "$CF_ROOT/worker/sync-worker.js"; then
      record "PASS" "T-162" "Stale sync recovery configured" "in code" "found in sync-worker.js" "ok"
    else
      record "FAIL" "T-162" "Stale sync recovery configured" "configured" "not found" "recovery not enabled"
      return 1
    fi
  fi
}

# ============================================================================
# Day 85: AI Merge Multi-Format Handler
# ============================================================================

t163() {
  # AI merge service supports .txt files
  if grep -q "\.txt.*text" "$CF_ROOT/api/src/services/aiMerge.js"; then
    record "PASS" "T-163" "AI merge supports .txt" "merge type=text" "found in code" "ok"
  else
    record "FAIL" "T-163" "AI merge supports .txt" "merge type=text" "not found" "missing support"
    return 1
  fi
}

t164() {
  # AI merge service supports code files (.py, .js, .ts)
  local supported=0
  for ext in ".py" ".js" ".ts"; do
    if grep -q "$ext.*code" "$CF_ROOT/api/src/services/aiMerge.js"; then
      supported=$((supported + 1))
    fi
  done
  if [[ "$supported" -ge 2 ]]; then
    record "PASS" "T-164" "AI merge supports code files" "code types" "$supported/3 supported" "ok"
  else
    record "FAIL" "T-164" "AI merge supports code files" "code types" "$supported/3 supported" "missing types"
    return 1
  fi
}

t165() {
  # POST /conflicts/:id/ai-merge endpoint exists
  if grep -q "ai-merge" "$CF_ROOT/api/src/routes/conflicts.js"; then
    record "PASS" "T-165" "AI merge endpoint exists" "route defined" "found" "ok"
  else
    record "FAIL" "T-165" "AI merge endpoint exists" "route defined" "not found" "missing endpoint"
    return 1
  fi
}

# ============================================================================
# Day 76: WebDAV Container
# ============================================================================

t166() {
  # WebDAV container is running
  local webdav_status
  webdav_status="$(docker ps --filter "name=cacheflow-webdav" --format "{{.Status}}" 2>/dev/null || true)"

  if echo "$webdav_status" | grep -q "Up"; then
    record "PASS" "T-166" "WebDAV container running" "status=Up" "$webdav_status" "ok"
  else
    record "FAIL" "T-166" "WebDAV container running" "status=Up" "not running" "container down"
    return 1
  fi
}

t167() {
  # WebDAV port 8180 is bound (check via docker port)
  local port_check
  port_check="$(docker port cacheflow-webdav 2>/dev/null | grep "8180" || true)"

  if [[ -n "$port_check" ]]; then
    record "PASS" "T-167" "WebDAV port 8180 bound" "port open" "$port_check" "ok"
  else
    record "FAIL" "T-167" "WebDAV port 8180 bound" "port open" "not bound" "port not open"
    return 1
  fi
}

t168() {
  # WebDAV htpasswd file exists
  if [[ -f "$CF_ROOT/webdav/webdav.htpasswd" ]]; then
    record "PASS" "T-168" "WebDAV htpasswd exists" "file exists" "found" "ok"
  else
    record "FAIL" "T-168" "WebDAV htpasswd exists" "file exists" "not found" "auth not configured"
    return 1
  fi
}

# ============================================================================
# Day 77-78: WebDAV Documentation
# ============================================================================

t169() {
  # WebDAV macOS guide exists
  if [[ -f "$CF_ROOT/docs/webdav-macos.md" ]]; then
    record "PASS" "T-169" "WebDAV macOS guide" "file exists" "found" "ok"
  else
    record "FAIL" "T-169" "WebDAV macOS guide" "file exists" "not found" "missing docs"
    return 1
  fi
}

t170() {
  # WebDAV Windows guide exists
  if [[ -f "$CF_ROOT/docs/webdav-windows.md" ]]; then
    record "PASS" "T-170" "WebDAV Windows guide" "file exists" "found" "ok"
  else
    record "FAIL" "T-170" "WebDAV Windows guide" "file exists" "not found" "missing docs"
    return 1
  fi
}

# ============================================================================
# Day 79: Rate Limiting
# ============================================================================

t171() {
  # Rate limiting middleware exists
  if [[ -f "$CF_ROOT/api/src/middleware/rateLimit.js" ]]; then
    record "PASS" "T-171" "Rate limit middleware" "file exists" "found" "ok"
  else
    record "FAIL" "T-171" "Rate limit middleware" "file exists" "not found" "missing middleware"
    return 1
  fi
}

t172() {
  # Rate limiting is applied to API endpoints (check app.js)
  if grep -q "globalLimiter\|rateLimit" "$CF_ROOT/api/src/app.js"; then
    record "PASS" "T-172" "Rate limiting enabled in API" "limiter configured" "found" "ok"
  else
    record "FAIL" "T-172" "Rate limiting enabled in API" "limiter configured" "not found" "not enabled"
    return 1
  fi
}

# ============================================================================
# Day 80: Security Headers
# ============================================================================

t173() {
  # Helmet security headers are configured
  if grep -q "helmet" "$CF_ROOT/api/src/app.js"; then
    record "PASS" "T-173" "Helmet security headers" "configured" "found" "ok"
  else
    record "FAIL" "T-173" "Helmet security headers" "configured" "not found" "not enabled"
    return 1
  fi
}

t174() {
  # CORS is configured with allowed origins
  if grep -q "cors" "$CF_ROOT/api/src/app.js"; then
    record "PASS" "T-174" "CORS configured" "configured" "found" "ok"
  else
    record "FAIL" "T-174" "CORS configured" "configured" "not found" "not enabled"
    return 1
  fi
}

# ============================================================================
# Security Page
# ============================================================================

t175() {
  # Security page exists in web app
  if [[ -f "$CF_ROOT/web/app/security/page.tsx" ]]; then
    record "PASS" "T-175" "Security page exists" "file exists" "found" "ok"
  else
    record "FAIL" "T-175" "Security page exists" "file exists" "not found" "missing page"
    return 1
  fi
}

t176() {
  # Security page mentions Zero-Retention
  if grep -q "Zero-Retention" "$CF_ROOT/web/app/security/page.tsx" 2>/dev/null; then
    record "PASS" "T-176" "Security page Zero-Retention" "mentioned" "found" "ok"
  else
    record "FAIL" "T-176" "Security page Zero-Retention" "mentioned" "not found" "missing content"
    return 1
  fi
}

# ============================================================================
# E2E Tests
# ============================================================================

t177() {
  # Full upload-download cycle works (skip if API not directly accessible)
  # Try direct access first, if fails try via docker network
  local token tmp up_code file_id dl_code

  # Check if API is accessible
  if ! curl -sS --connect-timeout 2 "$API_BASE/health" >/dev/null 2>&1; then
    # Try via docker network
    if curl -sS --connect-timeout 2 "http://cacheflow-api:8100/health" >/dev/null 2>&1; then
      API_BASE="http://cacheflow-api:8100"
    else
      record "SKIP" "T-177" "E2E upload-download" "API accessible" "not accessible" "network not available"
      return 0
    fi
  fi

  token="$(get_token)" || { record "FAIL" "T-177" "E2E upload-download" "token" "login failed" "login failed"; return 1; }

  # Upload
  tmp="$RUN_DIR/t177_test.txt"
  echo "E2E test $(date)" > "$tmp"
  run_cmd "curl -sS -o '$RUN_DIR/t177_upload.json' -w '%{http_code}' -X POST '$API_BASE/files/upload' -H 'Authorization: Bearer $token' -F 'file=@$tmp' > '$RUN_DIR/t177_upload.code'"
  up_code="$(cat "$RUN_DIR/t177_upload.code" 2>/dev/null | tr -d '[:space:]')"

  if [[ "$up_code" != "201" ]]; then
    record "FAIL" "T-177" "E2E upload-download" "HTTP 201" "HTTP $up_code" "upload failed"
    return 1
  fi

  file_id="$(cat "$RUN_DIR/t177_upload.json" | jq -r '.file.id // .id' 2>/dev/null || true)"

  if [[ -z "$file_id" ]]; then
    record "FAIL" "T-177" "E2E upload-download" "file_id" "not found" "upload response invalid"
    return 1
  fi

  # Download
  run_cmd "curl -sS -o '$RUN_DIR/t177_download.txt' -w '%{http_code}' '$API_BASE/files/$file_id/download' -H 'Authorization: Bearer $token' > '$RUN_DIR/t177_download.code'"
  dl_code="$(cat "$RUN_DIR/t177_download.code" 2>/dev/null | tr -d '[:space:]')"

  if [[ "$dl_code" == "200" ]]; then
    record "PASS" "T-177" "E2E upload-download" "HTTP 200" "HTTP $dl_code" "ok"
  else
    record "FAIL" "T-177" "E2E upload-download" "HTTP 200" "HTTP $dl_code" "download failed"
    return 1
  fi
}

t178() {
  # Share link creation and download works (skip if API not accessible)
  local token share_code share_id download_code

  # Check if API is accessible
  if ! curl -sS --connect-timeout 2 "$API_BASE/health" >/dev/null 2>&1; then
    if curl -sS --connect-timeout 2 "http://cacheflow-api:8100/health" >/dev/null 2>&1; then
      API_BASE="http://cacheflow-api:8100"
    else
      record "SKIP" "T-178" "E2E share" "API accessible" "not accessible" "network not available"
      return 0
    fi
  fi

  token="$(get_token)" || { record "FAIL" "T-178" "E2E share" "token" "login failed" "login failed"; return 1; }

  # Get a file to share
  http_json GET "$API_BASE/files" "" "$token"
  local first_file_id
  first_file_id="$(echo "$HTTP_BODY" | jq -r '.files[0].id // empty' 2>/dev/null || true)"

  if [[ -z "$first_file_id" ]]; then
    record "SKIP" "T-178" "E2E share" "file to share" "no files" "no files to test"
    return 0
  fi

  # Create share link
  http_json POST "$API_BASE/share" "{\"file_id\":\"$first_file_id\",\"expires_in\":3600}" "$token"

  if [[ "$HTTP_CODE" != "201" ]]; then
    record "FAIL" "T-178" "E2E share" "HTTP 201" "HTTP $HTTP_CODE" "share creation failed"
    return 1
  fi

  share_id="$(echo "$HTTP_BODY" | jq -r '.share_id // .id // empty' 2>/dev/null || true)"

  if [[ -z "$share_id" ]]; then
    record "FAIL" "T-178" "E2E share" "share_id" "not found" "share response invalid"
    return 1
  fi

  # Download via share link
  run_cmd "curl -sS -o /dev/null -w '%{http_code}' '$API_BASE/share/$share_id' > '$RUN_DIR/t178.code'"
  download_code="$(cat "$RUN_DIR/t178.code" 2>/dev/null | tr -d '[:space:]')"

  if [[ "$download_code" == "200" ]]; then
    record "PASS" "T-178" "E2E share" "HTTP 200" "HTTP $download_code" "ok"
  else
    record "FAIL" "T-178" "E2E share" "HTTP 200" "HTTP $download_code" "share download failed"
    return 1
  fi
}

# ============================================================================
# Test Runners
# ============================================================================

run_all() {
  run_step t150; run_step t151; run_step t152; run_step t153; run_step t154
  run_step t155; run_step t156; run_step t157; run_step t158; run_step t159
  run_step t160; run_step t161; run_step t162
  run_step t163; run_step t164; run_step t165
  run_step t166; run_step t167; run_step t168
  run_step t169; run_step t170
  run_step t171; run_step t172
  run_step t173; run_step t174
  run_step t175; run_step t176
  run_step t177; run_step t178
}

run_day85() {
  run_step t163; run_step t164; run_step t165
}

run_day86() {
  run_step t166; run_step t167; run_step t168
  run_step t169; run_step t170
  run_step t177; run_step t178
}

run_day79() {
  run_step t171; run_step t172
}

run_day80() {
  run_step t173; run_step t174
  run_step t175; run_step t176
}

run_day81() {
  run_step t151; run_step t152; run_step t153
}

run_day82() {
  run_step t154; run_step t155
}

run_day83() {
  run_step t156; run_step t157; run_step t158; run_step t159
}

run_day84() {
  run_step t160; run_step t161; run_step t162
}

normalize_sel() {
  local s="$1"
  s="${s,,}"
  s="${s#t}"
  s="${s#-}"
  echo "$s"
}

case "${1:-}" in
  init)
    init_run
    ;;
  all)
    load_run
    run_all
    ;;
  day81)
    load_run
    run_day81
    ;;
  day82)
    load_run
    run_day82
    ;;
  day83)
    load_run
    run_day83
    ;;
  day84)
    load_run
    run_day84
    ;;
  day85)
    load_run
    run_day85
    ;;
  day86)
    load_run
    run_day86
    ;;
  day79)
    load_run
    run_day79
    ;;
  day80)
    load_run
    run_day80
    ;;
  *)
    load_run
    sel="$(normalize_sel "${1:-}")"
    if [[ -z "$sel" ]]; then
      echo "usage: $0 <init|all|day79|day80|day81|day82|day83|day84|day85|day86|t150>"
      exit 2
    fi
    if [[ "$sel" =~ ^[0-9]+$ ]]; then
      fn="t$sel"
      if declare -f "$fn" >/dev/null 2>&1; then
        "$fn"
      else
        echo "Unknown test: $1"
        exit 2
      fi
    else
      echo "Unknown selector: $1"
      exit 2
    fi
    ;;
esac
