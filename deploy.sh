#!/bin/bash
set -euo pipefail

REPO_DIR="/opt/docker/apps/cacheflow"
COMPOSE_FILE="infra/docker-compose.yml"
APP_SERVICES=(api worker web)

require_clean_git() {
  if [[ -n "$(git status --short)" ]]; then
    echo "==> Refusing to deploy from a dirty git worktree."
    git status --short
    exit 1
  fi
}

cd "$REPO_DIR"

echo "==> Checking git worktree..."
require_clean_git

echo "==> Pulling latest from git..."
git pull --ff-only origin main

SHA=$(git rev-parse --short HEAD)
IMAGE="cacheflow:$SHA"

echo "==> Building API and worker images..."
docker compose -f "$COMPOSE_FILE" build api worker

echo "==> Building image $IMAGE..."
docker build -t "$IMAGE" -t cacheflow:latest .

echo "==> Deploying..."
CACHEFLOW_IMAGE="$IMAGE" docker compose -f "$COMPOSE_FILE" up -d --force-recreate "${APP_SERVICES[@]}"

echo "==> Pruning old images (keeping last 3 builds)..."
docker images cacheflow --format "{{.Tag}}\t{{.ID}}" \
  | grep -v latest \
  | sort -r \
  | tail -n +4 \
  | awk '{print $2}' \
  | xargs -r docker rmi --force

echo "==> Done. Live image: $IMAGE"
docker compose -f "$COMPOSE_FILE" ps "${APP_SERVICES[@]}"
