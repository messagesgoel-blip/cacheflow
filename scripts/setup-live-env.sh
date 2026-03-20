#!/usr/bin/env bash
# Setup script for the repo-owned bootstrap environment (ENV-01).
# Generates local-only bootstrap values and writes them to web/.env.live without
# exposing them in logs or git.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$REPO_ROOT/web/.env.live"
BOOTSTRAP_SOURCE_ENV="${CACHEFLOW_BOOTSTRAP_SOURCE_ENV:-}"

mkdir -p "$(dirname "$ENV_FILE")"

load_env_file() {
  local file_path="${1:-}"
  if [ -n "$file_path" ] && [ -f "$file_path" ]; then
    set -a
    # shellcheck disable=SC1090
    . "$file_path"
    set +a
  fi
}

generate_base32_secret() {
  node -e '
const crypto = require("node:crypto")
const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
const bytes = crypto.randomBytes(32)
let secret = ""
for (const byte of bytes) secret += chars[byte % chars.length]
process.stdout.write(secret)
'
}

explicit_totp_secret="${CF_TOTP_SECRET:-}"
explicit_bootstrap_email="${CACHEFLOW_BOOTSTRAP_EMAIL:-${PLAYWRIGHT_QA_EMAIL:-${CACHEFLOW_TEST_USER_EMAIL:-}}}"
explicit_bootstrap_password="${CACHEFLOW_BOOTSTRAP_PASSWORD:-${PLAYWRIGHT_QA_PASSWORD:-${CACHEFLOW_TEST_USER_PASSWORD:-}}}"
explicit_seed_flag="${CACHEFLOW_TEST_USER_SEED:-}"

load_env_file "$BOOTSTRAP_SOURCE_ENV"
source_seed_secret="${CF_TOTP_SECRET:-}"
source_bootstrap_email="${CACHEFLOW_BOOTSTRAP_EMAIL:-${PLAYWRIGHT_QA_EMAIL:-${CACHEFLOW_TEST_USER_EMAIL:-}}}"
source_bootstrap_password="${CACHEFLOW_BOOTSTRAP_PASSWORD:-${PLAYWRIGHT_QA_PASSWORD:-${CACHEFLOW_TEST_USER_PASSWORD:-}}}"
source_seed_flag="${CACHEFLOW_TEST_USER_SEED:-}"

load_env_file "$ENV_FILE"
existing_seed_secret="${CF_TOTP_SECRET:-}"

secret="${explicit_totp_secret:-${source_seed_secret:-${existing_seed_secret:-}}}"
if [ -z "$secret" ]; then
  secret="$(generate_base32_secret)"
fi

bootstrap_email="${explicit_bootstrap_email:-${source_bootstrap_email:-admin@cacheflow.goels.in}}"
bootstrap_password="${explicit_bootstrap_password:-${source_bootstrap_password:-admin123}}"

seed_flag="${explicit_seed_flag:-${source_seed_flag:-true}}"

umask 077
tmp_file="$(mktemp "${ENV_FILE}.XXXXXX")"
trap 'rm -f "$tmp_file"' EXIT

cat >"$tmp_file" <<EOF
CF_TOTP_SECRET=$secret
CACHEFLOW_TEST_USER_SEED=$seed_flag
CACHEFLOW_BOOTSTRAP_EMAIL=$bootstrap_email
CACHEFLOW_BOOTSTRAP_PASSWORD=$bootstrap_password
PLAYWRIGHT_QA_EMAIL=$bootstrap_email
PLAYWRIGHT_QA_PASSWORD=$bootstrap_password
CACHEFLOW_TEST_USER_EMAIL=$bootstrap_email
CACHEFLOW_TEST_USER_PASSWORD=$bootstrap_password
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3010
CACHEFLOW_WEB_URL=http://127.0.0.1:3010
EOF

mv "$tmp_file" "$ENV_FILE"
chmod 600 "$ENV_FILE"
trap - EXIT

echo "✅ Developer bootstrap env written to $ENV_FILE"
echo "Note: web/.env.live is ignored by git and loaded by web/playwright.live.config.ts."
echo "Bootstrap account: $bootstrap_email"
