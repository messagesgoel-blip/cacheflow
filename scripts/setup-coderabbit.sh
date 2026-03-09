#!/usr/bin/env bash
set -euo pipefail

if command -v coderabbit >/dev/null 2>&1; then
  echo "CodeRabbit CLI already installed: $(coderabbit --version)"
else
# Install CodeRabbit CLI via official curl script
  curl -fsSL https://cli.coderabbit.ai/install.sh | sh
fi

# Ensure ~/.local/bin is in PATH for this session
export PATH="$HOME/.local/bin:$PATH"

# Verify install
coderabbit --version || { echo "coderabbit install failed"; exit 1; }

# Authentication Note: 
# Non-interactive authentication is handled via the CODERABBIT_API_KEY environment variable 
# passed directly to the 'review' command.
if [ -n "${CODERABBIT_API_KEY:-}" ]; then
  echo "CodeRabbit: API Key detected in environment."
else
  echo "WARNING: CODERABBIT_API_KEY not set — reviews will require manual login."
fi
