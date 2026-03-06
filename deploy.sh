#!/bin/bash
set -euo pipefail

REPO_DIR="/opt/docker/apps/cacheflow"
COMPOSE_FILE="infra/docker-compose.yml"
cd "$REPO_DIR"

echo "==> Pulling latest from git..."
git pull origin main

SHA=$(git rev-parse --short HEAD)
IMAGE="cacheflow:$SHA"

echo "==> Building image $IMAGE..."
docker build -t "$IMAGE" -t cacheflow:latest .

echo "==> Deploying..."
CACHEFLOW_IMAGE="$IMAGE" docker compose -f "$COMPOSE_FILE" up -d --force-recreate web

echo "==> Pruning old images (keeping last 3 builds)..."
docker images cacheflow --format "{{.Tag}}\t{{.ID}}" \
  | grep -v latest \
  | sort -r \
  | tail -n +4 \
  | awk '{print $2}' \
  | xargs -r docker rmi --force

echo "==> Done. Live image: $IMAGE"
docker ps --filter name=cacheflow-web --format \
  "table {{.Names}}\t{{.Image}}\t{{.Status}}"
