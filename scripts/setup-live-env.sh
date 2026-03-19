#!/usr/bin/env bash
# Setup script for Live E2E Rerun Environment (ENV-01)
# Prompts for CF_TOTP_SECRET and writes it to web/.env.live without exposing it in logs or git.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$REPO_ROOT/web/.env.live"

mkdir -p "$(dirname "$ENV_FILE")"

secret="${CF_TOTP_SECRET:-}"
if [ -z "$secret" ]; then
  if [ -t 0 ]; then
    printf 'Enter the CF_TOTP_SECRET for the live test account: '
    IFS= read -r -s secret
    printf '\n'
  else
    echo "CF_TOTP_SECRET is required. Set the env var or run this interactively." >&2
    exit 1
  fi
fi

if [ -z "$secret" ]; then
  echo "Error: CF_TOTP_SECRET cannot be empty." >&2
  exit 1
fi

umask 077
tmp_file="$(mktemp "${ENV_FILE}.XXXXXX")"
trap 'rm -f "$tmp_file"' EXIT

printf 'CF_TOTP_SECRET=%s\n' "$secret" > "$tmp_file"
mv "$tmp_file" "$ENV_FILE"
chmod 600 "$ENV_FILE"
trap - EXIT

echo "✅ Secret securely written to $ENV_FILE"
echo "Note: web/.env.live is ignored by git and loaded by web/playwright.live.config.ts."
