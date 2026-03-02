#!/bin/bash
set -euo pipefail

git pull --rebase

echo "\n=== STATUS.md ==="
cat STATUS.md

echo "\n=== git log --oneline -10 ==="
git log --oneline -10

echo "\n=== Queue (from STATUS.md) ==="
./mcp-cache-warmup.sh || true

awk '/^## Queue/{flag=1;next}/^## /{flag=0}flag' STATUS.md
