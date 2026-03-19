#!/usr/bin/env bash
# Seed Live Fixtures for E2E Suite (ENV-02)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_URL="${CACHEFLOW_API_URL:-${NEXT_PUBLIC_API_URL:-http://127.0.0.1:8100}}"
TOKEN_SOURCE="${CACHEFLOW_ACCESS_TOKEN:-${ACCESS_TOKEN:-${1:-}}}"
COOKIE_SOURCE="${CACHEFLOW_COOKIE_HEADER:-${COOKIE_HEADER:-${SESSION_COOKIE:-${2:-}}}}"
FIXTURES_DIR="$REPO_ROOT/web/e2e/fixtures/files"
EXPECTED_FILES=("normal-file.txt" "test-document.pdf" "report.docx" "image.png")

usage() {
  cat <<'EOF'
Usage:
  CACHEFLOW_ACCESS_TOKEN=<jwt> scripts/seed-live-fixtures.sh
  CACHEFLOW_COOKIE_HEADER='accessToken=<jwt>; ...' scripts/seed-live-fixtures.sh
  scripts/seed-live-fixtures.sh <access-token>

The script skips files that already exist at the root and uploads only the missing ones.
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

json_root_names() {
  node -e '
const fs = require("node:fs")
const payload = JSON.parse(fs.readFileSync(0, "utf8"))
const names = [
  ...((payload.files || []).map((entry) => entry && entry.name).filter(Boolean)),
  ...((payload.folders || []).map((entry) => entry && entry.name).filter(Boolean)),
]
process.stdout.write(names.join("\n"))
'
}

json_remote_size() {
  local file_name="${1:-}"
  node - "$file_name" <<'NODE'
const fs = require('node:fs')
const target = process.argv[2] || ''
const payload = JSON.parse(fs.readFileSync(0, 'utf8'))
const entries = [...(payload.files || []), ...(payload.folders || [])]
const entry = entries.find((item) => item && item.name === target)
if (!entry) {
  process.stdout.write('')
} else {
  const size = entry.size_bytes ?? entry.size ?? entry.sizeBytes ?? ''
  process.stdout.write(String(size))
}
NODE
}

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

declare -A EXPECTED_MIME=(
  ["normal-file.txt"]="text/plain"
  ["test-document.pdf"]="application/pdf"
  ["report.docx"]="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ["image.png"]="image/png"
)

echo "Checking local fixture files..."
for file_name in "${EXPECTED_FILES[@]}"; do
  file_path="$FIXTURES_DIR/$file_name"
  if [ ! -f "$file_path" ]; then
    echo "❌ Missing local fixture file: $file_path" >&2
    exit 1
  fi

  mime_type="$(file -b --mime-type "$file_path")"
  case "$file_name" in
    normal-file.txt)
      [[ "$mime_type" == text/* ]] || { echo "❌ $file_name is not a text file ($mime_type)" >&2; exit 1; }
      ;;
    test-document.pdf)
      [[ "$mime_type" == "application/pdf" ]] || { echo "❌ $file_name is not a PDF ($mime_type)" >&2; exit 1; }
      ;;
    report.docx)
      [[ "$mime_type" == "${EXPECTED_MIME[$file_name]}" ]] || { echo "❌ $file_name is not a DOCX ($mime_type)" >&2; exit 1; }
      ;;
    image.png)
      [[ "$mime_type" == "${EXPECTED_MIME[$file_name]}" ]] || { echo "❌ $file_name is not a PNG ($mime_type)" >&2; exit 1; }
      ;;
  esac
done

echo "Checking current root listing..."
if ! root_listing_json="$(curl -fsS -H "Authorization: Bearer $TOKEN_SOURCE" "$API_URL/files/browse?path=/")"; then
  echo "❌ Failed to fetch current root listing" >&2
  exit 1
fi

existing_names="$(printf '%s' "$root_listing_json" | json_root_names)"
upload_count=0

for file_name in "${EXPECTED_FILES[@]}"; do
  file_path="$FIXTURES_DIR/$file_name"
  local_size="$(stat -c '%s' "$file_path")"
  remote_size=""
  if printf '%s\n' "$existing_names" | grep -Fxq "$file_name"; then
    remote_size="$(printf '%s' "$root_listing_json" | json_remote_size "$file_name")"
    if [ -n "$remote_size" ] && [ "$remote_size" != "$local_size" ]; then
      echo "❌ Existing root file $file_name has size $remote_size, expected $local_size" >&2
      exit 1
    fi
    echo "✅ $file_name already present at root; skipping upload"
    continue
  fi

  echo "Uploading $file_name..."
  upload_response="$(mktemp)"
  if ! http_code="$(curl -sS -o "$upload_response" -w '%{http_code}' \
    -H "Authorization: Bearer $TOKEN_SOURCE" \
    -F "file=@$file_path" \
    "$API_URL/files/upload")"; then
    echo "❌ Upload request failed for $file_name" >&2
    rm -f "$upload_response"
    exit 1
  fi

  if [ "$http_code" != "200" ] && [ "$http_code" != "201" ]; then
    echo "❌ Upload failed for $file_name (HTTP $http_code)" >&2
    cat "$upload_response" >&2 || true
    rm -f "$upload_response"
    exit 1
  fi

  uploaded_name="$(node -e '
const fs = require("node:fs")
const payload = JSON.parse(fs.readFileSync(process.argv[1], "utf8"))
const file = payload.file || payload.data?.file || payload.data || {}
process.stdout.write(file.path || file.name || file.id || "")
' "$upload_response")"
  rm -f "$upload_response"
  upload_count=$((upload_count + 1))
  echo "✅ Uploaded $file_name${uploaded_name:+ as $uploaded_name}"
done

echo "Re-checking root listing..."
if ! root_listing_json="$(curl -fsS -H "Authorization: Bearer $TOKEN_SOURCE" "$API_URL/files/browse?path=/")"; then
  echo "❌ Failed to re-fetch current root listing" >&2
  exit 1
fi

existing_names="$(printf '%s' "$root_listing_json" | json_root_names)"
missing=0
for file_name in "${EXPECTED_FILES[@]}"; do
  if ! printf '%s\n' "$existing_names" | grep -Fxq "$file_name"; then
    echo "❌ Missing root fixture after seeding: $file_name" >&2
    missing=1
  fi
done

if [ "$missing" -ne 0 ]; then
  exit 1
fi

echo "Seeding complete. Uploaded $upload_count missing fixture(s)."
