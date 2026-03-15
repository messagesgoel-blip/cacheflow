#!/usr/bin/env bash
set -euo pipefail

# PR-Agent Second-Pass Review (Fallback 1)
# Second-pass review using PR-Agent via LiteLLM for pre-commit quality gate.
# Requires GitHub token and LiteLLM configuration.

REPO_PATH="${CODERO_REPO_PATH:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
PR_AGENT_BIN="${CODERO_PR_AGENT_BIN:-pr-agent}"
LITELLM_URL_RAW="${CODERO_LITELLM_URL:-${LITELLM_PROXY_URL:-http://localhost:4000/v1}}"
PRIMARY_MODEL="${CODERO_PR_AGENT_MODEL:-${CODERO_SECOND_PASS_LITELLM_MODEL:-qwen3-coder-plus}}"
MODEL_SET_RAW="${CODERO_PR_AGENT_FALLBACK_MODELS:-${CODERO_SECOND_PASS_LITELLM_MODELS:-$PRIMARY_MODEL}}"
TIMEOUT_SEC="${CODERO_PR_AGENT_TIMEOUT_SEC:-240}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    return 1
  fi
  return 0
}

load_litellm_key() {
  if [ -n "${CODERO_LITELLM_MASTER_KEY:-}" ]; then
    echo "$CODERO_LITELLM_MASTER_KEY"
    return 0
  fi
  if [ -n "${LITELLM_MASTER_KEY:-}" ]; then
    echo "$LITELLM_MASTER_KEY"
    return 0
  fi
  if [ -n "${LITELLM_API_KEY:-}" ]; then
    echo "$LITELLM_API_KEY"
    return 0
  fi
  if [ -n "${OPENAI_API_KEY:-}" ]; then
    echo "$OPENAI_API_KEY"
    return 0
  fi

  if [ -f "$REPO_PATH/.env" ]; then
    local raw
    raw="$(grep -E '^(CODERO_LITELLM_MASTER_KEY|LITELLM_MASTER_KEY|LITELLM_API_KEY|OPENAI_API_KEY)=' "$REPO_PATH/.env" | head -n 1 | cut -d'=' -f2- || true)"
    raw="${raw%\"}"
    raw="${raw#\"}"
    raw="${raw%\'}"
    raw="${raw#\'}"
    if [ -n "$raw" ]; then
      echo "$raw"
      return 0
    fi
  fi

  return 1
}

model_list_to_json() {
  local input="$1"
  local item first=1 out="["
  IFS=',' read -r -a items <<< "$input"
  for item in "${items[@]}"; do
    item="$(echo "$item" | xargs)"
    [ -z "$item" ] && continue
    if [ "$first" -eq 0 ]; then
      out+=" ,"
    fi
    out+="\"$item\""
    first=0
  done
  out+="]"
  printf '%s' "$out"
}

main() {
  if ! require_cmd "$PR_AGENT_BIN"; then
    echo "Error: pr-agent binary not found ($PR_AGENT_BIN)" >&2
    echo "Install with: pip install pr-agent" >&2
    exit 1
  fi

  if [ ! -d "$REPO_PATH" ]; then
    echo "Error: repo path does not exist: $REPO_PATH" >&2
    exit 1
  fi

  local litellm_key github_token fallback_json litellm_base
  if ! litellm_key="$(load_litellm_key)"; then
    echo "Error: LiteLLM key not found. Set LITELLM_MASTER_KEY or add it in $REPO_PATH/.env" >&2
    exit 1
  fi

  github_token="${CODERO_GITHUB_TOKEN:-${GH_TOKEN:-${GITHUB_TOKEN:-}}}"
  if [ -z "$github_token" ]; then
    echo "Error: GitHub token not found. Set CODERO_GITHUB_TOKEN, GH_TOKEN, or GITHUB_TOKEN." >&2
    exit 1
  fi

  fallback_json="$(model_list_to_json "$MODEL_SET_RAW")"
  litellm_base="${LITELLM_URL_RAW%/chat/completions}"

  echo "--- CODERO PR-AGENT FALLBACK (via LiteLLM) ---"
  echo "LiteLLM base: $litellm_base"
  echo "Model: $PRIMARY_MODEL"
  echo "Fallback models: $fallback_json"

  local pr_url result exit_code
  pr_url="${CODERO_PR_URL:-${PR_URL:-}}"
  if [ -z "$pr_url" ]; then
    echo "Error: PR URL not found. Set CODERO_PR_URL or PR_URL for PR-Agent review." >&2
    exit 1
  fi

  set +e
  result="$(
    timeout "$TIMEOUT_SEC" sh -c '
      cd "$1" &&
      OPENAI__API_BASE="$2" \
      OPENAI__KEY="$3" \
      CONFIG__MODEL="$4" \
      CONFIG__FALLBACK_MODELS="$5" \
      GITHUB__USER_TOKEN="$6" \
      "$7" review --pr_url "$8" 2>&1
    ' -- "$REPO_PATH" "$litellm_base" "$litellm_key" "$PRIMARY_MODEL" "$fallback_json" "$github_token" "$PR_AGENT_BIN" "$pr_url"
  )"
  exit_code=$?
  set -e
  if [ $exit_code -ne 0 ]; then
    if [ $exit_code -eq 124 ]; then
      echo "Error: PR-Agent review timed out after ${TIMEOUT_SEC}s"
      exit 1
    fi
    echo "$result" >&2
    exit 1
  fi

  echo "$result"
  echo "--- CODERO PR-AGENT FALLBACK END ---"
}

main "$@"
