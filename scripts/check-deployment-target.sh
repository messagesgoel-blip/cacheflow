#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

DEPLOYMENT_TARGET="${DEPLOYMENT_TARGET:-docker}"
TARGET_LC="$(printf '%s' "$DEPLOYMENT_TARGET" | tr '[:upper:]' '[:lower:]')"

status=0

log() {
  printf '[deployment-guard] %s\n' "$1"
}

fail() {
  printf '[deployment-guard] ERROR: %s\n' "$1" >&2
  status=1
}

is_blocked_target() {
  local value="$1"
  case "$value" in
    *vercel*|*netlify*|*lambda*|*cloudflare*|*edge*|*serverless*)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

if is_blocked_target "$TARGET_LC"; then
  fail "DEPLOYMENT_TARGET '$DEPLOYMENT_TARGET' is not allowed. Use a long-running runtime (e.g. docker, kubernetes, vm)."
fi

for prohibited_file in \
  vercel.json \
  netlify.toml \
  wrangler.toml \
  wrangler.json \
  wrangler.jsonc \
  serverless.yml \
  serverless.yaml
do
  if [ -e "$REPO_ROOT/$prohibited_file" ]; then
    fail "Prohibited deployment manifest found at repo root: $prohibited_file"
  fi
done

lambda_manifests=(
  template.yaml
  template.yml
  sam.yaml
  sam.yml
  serverless.yml
  serverless.yaml
)
lambda_pattern='AWS::Lambda::Function|AWS::Serverless::Function|aws_lambda_function'

for manifest in "${lambda_manifests[@]}"; do
  manifest_path="$REPO_ROOT/$manifest"
  if [ -f "$manifest_path" ] && grep -Eqi "$lambda_pattern" "$manifest_path"; then
    fail "Lambda function definition detected in repo root manifest: $manifest"
  fi
done

if [ "$status" -ne 0 ]; then
  fail "Blocked by deployment policy for SSE-1 and TRANSFER-1."
  exit 1
fi

log "PASS: DEPLOYMENT_TARGET='$DEPLOYMENT_TARGET' and no prohibited serverless/edge manifests were found."
