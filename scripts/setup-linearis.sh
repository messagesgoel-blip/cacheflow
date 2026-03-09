#!/usr/bin/env bash
set -euo pipefail

# Install linearis globally
npm install -g linearis

# Verify install
linearis --version || { echo "linearis install failed"; exit 1; }

# Write token if provided
if [ -n "${LINEAR_API_TOKEN:-}" ]; then
  echo "$LINEAR_API_TOKEN" > ~/.linear_api_token
  echo "Linear API token written to ~/.linear_api_token"
else
  echo "WARNING: LINEAR_API_TOKEN not set — run: echo '<token>' > ~/.linear_api_token"
fi

# Smoke test (non-destructive)
# Removed --limit 1 as it is not supported in this version
linearis teams list && echo "linearis: connection OK" || echo "linearis: connection FAILED (check token)"
