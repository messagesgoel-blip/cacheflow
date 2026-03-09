#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==> Setting up linearis..."
bash "$SCRIPT_DIR/setup-linearis.sh"

echo "==> Setting up CodeRabbit CLI..."
bash "$SCRIPT_DIR/setup-coderabbit.sh"

echo ""
echo "✅ Dev tools ready."
echo "   linearis usage       — see all Linear commands"
echo "   coderabbit review    — review staged changes"
