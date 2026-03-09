#!/usr/bin/env bash
set -euo pipefail

# Install linearis globally
npm install -g linearis

# Verify install
linearis --version || { echo "linearis install failed"; exit 1; }

# Write token if provided
if [ -n "${LINEAR_API_TOKEN:-}" ]; then
  umask 077
  printf '%s\n' "$LINEAR_API_TOKEN" > ~/.linear_api_token
  chmod 600 ~/.linear_api_token
  echo "Linear API token written to ~/.linear_api_token"
else
  echo "WARNING: LINEAR_API_TOKEN not set — run: echo '<token>' > ~/.linear_api_token"
fi

# Smoke test (non-destructive)
# Removed --limit 1 as it is not supported in this version
if linearis teams list >/dev/null; then
  echo "linearis: connection OK"
else
  echo "linearis: connection FAILED (check token)"
  exit 1
fi
