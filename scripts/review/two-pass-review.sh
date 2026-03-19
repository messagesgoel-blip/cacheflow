#!/usr/bin/env bash
# Compatibility wrapper for the repository pre-commit hook.
# Local commits default to a non-blocking path. Set CODERABBIT_REQUIRED=true to
# run the delegated review command explicitly.

set -euo pipefail

if [ "${CODERABBIT_REQUIRED:-false}" != "true" ]; then
  echo "⚠️  CodeRabbit review skipped for local commit."
  exit 0
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec bash "$SCRIPT_DIR/../pre-push-review.sh" "$@"
