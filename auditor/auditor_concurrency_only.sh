#!/bin/bash
set -euo pipefail

API_URL="${API_URL:-http://127.0.0.1:8100}"
TOKEN="${TOKEN:?Set TOKEN=<bearer token>}"
CONCURRENCY="${CONCURRENCY:-50}"
STRESS_MB="${STRESS_MB:-5}"
RUN_ID="${RUN_ID:-hammer_$(date -u +%Y%m%dT%H%M%SZ)_$RANDOM}"
WORKDIR="${WORKDIR:-./cacheflow_hammer_$RUN_ID}"

mkdir -p "$WORKDIR"
trap 'rm -rf "$WORKDIR" >/dev/null 2>&1 || true' EXIT

STRESS_FILE="$WORKDIR/stress.bin"
dd if=/dev/urandom of="$STRESS_FILE" bs=1M count="$STRESS_MB" 2>/dev/null

CODES="$WORKDIR/codes.txt"
: > "$CODES"

for i in $(seq 1 "$CONCURRENCY"); do
  (
    code="$(curl -sS -o /dev/null -w "%{http_code}" \
      -X POST "$API_URL/files/upload" \
      -H "Authorization: Bearer $TOKEN" \
      -F "file=@$STRESS_FILE;filename=hammer_${RUN_ID}_$i.bin" || echo "000")"
    echo "$code" >> "$CODES"
  ) &
done

wait
echo "=== HTTP code summary ==="
sort "$CODES" | uniq -c | sort -nr

echo "=== Final usage ==="
curl -sS -X GET "$API_URL/files/usage" -H "Authorization: Bearer $TOKEN" | jq .
