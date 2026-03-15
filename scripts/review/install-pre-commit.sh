#!/usr/bin/env bash
set -euo pipefail

# Install Codero 6-pass review as pre-commit hook for a target repo.
# Supports git worktrees via git rev-parse --git-common-dir.

if [ "$#" -lt 1 ]; then
  echo "Usage: $0 <repo-path>"
  exit 1
fi

TARGET_REPO="$1"
TARGET_REPO="$(cd "$TARGET_REPO" && pwd)"
REPO_PATH="$TARGET_REPO"

if [ ! -e "$REPO_PATH/.git" ]; then
  echo "Error: $REPO_PATH does not appear to be a git repo (no .git entry)" >&2
  exit 1
fi

CODERO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

HOOK_PATH="$(git -C "$REPO_PATH" rev-parse --path-format=absolute --git-path hooks/pre-commit)"
HOOKS_DIR="$(dirname "$HOOK_PATH")"
mkdir -p "$HOOKS_DIR"
RENDER_PATH="${HOOK_PATH}.render.$(date +%s)"
FINAL_PATH="${HOOK_PATH}.tmp.$(date +%s)"

if [ -f "$HOOK_PATH" ]; then
  cp "$HOOK_PATH" "$HOOK_PATH.bak.$(date +%Y%m%d-%H%M%S)"
fi

cat > "$RENDER_PATH" <<'HOOK'
#!/usr/bin/env bash
set -euo pipefail
REPO_ROOT="$(git rev-parse --show-toplevel)"
export CODERO_REPO_PATH="$REPO_ROOT"
export CODERO_MODEL_ALIAS="cacheflow_agent"
export CODERO_ROOT="ACTUAL_CODERO_ROOT"

if [ -f "$REPO_ROOT/.env" ]; then
  export CODERO_ENV_FILE="${CODERO_ENV_FILE:-$REPO_ROOT/.env}"
elif [ -f "$CODERO_ROOT/.env" ]; then
  export CODERO_ENV_FILE="${CODERO_ENV_FILE:-$CODERO_ROOT/.env}"
fi

# Prefer local scripts if available, fallback to global
if [ -r "$REPO_ROOT/scripts/review/two-pass-review.sh" ]; then
  exec bash "$REPO_ROOT/scripts/review/two-pass-review.sh"
elif [ -r "$CODERO_ROOT/scripts/review/two-pass-review.sh" ]; then
  exec bash "$CODERO_ROOT/scripts/review/two-pass-review.sh"
else
  echo "Error: two-pass-review.sh not found in repo or CODERO_ROOT ($CODERO_ROOT)" >&2
  exit 1
fi
HOOK

export CODERO_ROOT
perl -0777 -pe 's/ACTUAL_CODERO_ROOT/\Q$ENV{CODERO_ROOT}\E/g' "$RENDER_PATH" > "$FINAL_PATH"
chmod +x "$FINAL_PATH"
mv "$FINAL_PATH" "$HOOK_PATH"
rm -f "$RENDER_PATH"

echo "Installed Codero 6-pass pre-commit hook: $HOOK_PATH"
echo "  Model alias: cacheflow_agent"
echo "  Mode: fast (default)"
