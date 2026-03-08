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

prune_cacheflow_images() {
  echo "==> Pruning old images (keeping last 3 builds plus any running image)..."

  declare -A protected_image_ids=()
  declare -A seen_image_ids=()
  local -a prune_candidates=()
  local keep_count=0

  while IFS=$'\t' read -r configured_ref image_id; do
    [[ -z "$configured_ref" || -z "$image_id" ]] && continue
    if [[ "$configured_ref" == cacheflow:* ]]; then
      protected_image_ids["$image_id"]=1
    fi
  done < <(
    docker ps --format '{{.ID}}' \
      | xargs -r docker inspect --format '{{.Config.Image}}\t{{.Image}}'
  )

  while IFS=$'\t' read -r image_ref image_id; do
    [[ -z "$image_ref" || -z "$image_id" ]] && continue
    [[ "$image_ref" == "cacheflow:latest" ]] && continue
    [[ -n "${seen_image_ids[$image_id]:-}" ]] && continue
    seen_image_ids["$image_id"]=1

    if (( keep_count < 3 )); then
      ((keep_count+=1))
      continue
    fi

    if [[ -n "${protected_image_ids[$image_id]:-}" ]]; then
      continue
    fi

    prune_candidates+=("$image_id")
  done < <(docker images --no-trunc cacheflow --format '{{.Repository}}:{{.Tag}}\t{{.ID}}')

  if (( ${#prune_candidates[@]} == 0 )); then
    echo "==> No old cacheflow images to prune."
    return 0
  fi

  local prune_failed=0
  local image_id
  for image_id in "${prune_candidates[@]}"; do
    if ! docker rmi --force "$image_id"; then
      echo "==> Warning: failed to remove image $image_id; leaving it in place." >&2
      prune_failed=1
    fi
  done

  if (( prune_failed != 0 )); then
    echo "==> Image pruning completed with warnings." >&2
  fi
}

cd "$REPO_DIR"

echo "==> Checking git worktree..."
require_clean_git

echo "==> Pulling latest from git..."
git fetch origin main
git merge --ff-only FETCH_HEAD

SHA=$(git rev-parse --short HEAD)
IMAGE="cacheflow:$SHA"

echo "==> Building API and worker images..."
docker compose -f "$COMPOSE_FILE" build api worker

echo "==> Building image $IMAGE..."
docker build -t "$IMAGE" -t cacheflow:latest .

echo "==> Deploying..."
CACHEFLOW_IMAGE="$IMAGE" docker compose -f "$COMPOSE_FILE" up -d --force-recreate "${APP_SERVICES[@]}"

prune_cacheflow_images

echo "==> Done. Live image: $IMAGE"
docker compose -f "$COMPOSE_FILE" ps "${APP_SERVICES[@]}"
