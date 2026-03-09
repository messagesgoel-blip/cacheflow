#!/usr/bin/env bash
set -euo pipefail

# Install CodeRabbit CLI via official curl script
# Since npm package @coderabbit/cli was not found in the registry
curl -fsSL https://cli.coderabbit.ai/install.sh | sh

# Ensure ~/.local/bin is in PATH for this session
export PATH="$HOME/.local/bin:$PATH"

# Verify install
coderabbit --version || { echo "coderabbit install failed"; exit 1; }

# Authenticate if token present
if [ -n "${CODERABBIT_API_KEY:-}" ]; then
  coderabbit auth login --api-key "$CODERABBIT_API_KEY"
  echo "CodeRabbit: authenticated"
else
  echo "WARNING: CODERABBIT_API_KEY not set — run: coderabbit auth login"
fi
