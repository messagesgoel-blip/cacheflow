#!/bin/bash
set -euo pipefail

REPO_DIR="/srv/storage/repo/cacheflow"
COMPOSE_FILE="infra/docker-compose.yml"
APP_SERVICES=(api worker web)
OPTIONAL_COMPOSE_FILE_SERVICES=(
  "infra/docker-compose.tailnet.yml:web-tailnet"
)

compose_args() {
  local args=(-f "$COMPOSE_FILE")
  local entry file services

  for entry in "${OPTIONAL_COMPOSE_FILE_SERVICES[@]}"; do
    IFS=':' read -r file services <<< "$entry"
    if [[ -f "$file" ]]; then
      args+=(-f "$file")
    fi
  done

  printf '%s\n' "${args[@]}"
}

collect_app_services() {
  local services=("${APP_SERVICES[@]}")
  local entry file extra_services

  for entry in "${OPTIONAL_COMPOSE_FILE_SERVICES[@]}"; do
    IFS=':' read -r file extra_services <<< "$entry"
    [[ -f "$file" ]] || continue
    read -r -a extra_service_array <<< "$extra_services"
    services+=("${extra_service_array[@]}")
  done

  printf '%s\n' "${services[@]}"
}

verify_deploy() {
  local attempts=30
  local delay_seconds=2
  local all_ready=0
  local service container_id state health

  echo "==> Verifying deployed services..."

  for ((attempt = 1; attempt <= attempts; attempt+=1)); do
    all_ready=1

    for service in "${DEPLOY_SERVICES[@]}"; do
      container_id="$(docker compose "${COMPOSE_ARGS[@]}" ps -q "$service")"
      if [[ -z "$container_id" ]]; then
        all_ready=0
        break
      fi

      state="$(docker inspect --format '{{.State.Status}}' "$container_id")"
      health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$container_id")"

      case "$state:$health" in
        running:healthy|running:none)
          ;;
        exited:*|dead:*|removing:*|restarting:unhealthy|running:unhealthy)
          echo "==> Deployment verification failed for service $service (state=$state, health=$health)." >&2
          docker compose "${COMPOSE_ARGS[@]}" logs --tail 100 "${DEPLOY_SERVICES[@]}"
          exit 1
          ;;
        *)
          all_ready=0
          break
          ;;
      esac
    done

    if (( all_ready == 1 )); then
      return 0
    fi

    sleep "$delay_seconds"
  done

  echo "==> Deployment verification timed out." >&2
  docker compose "${COMPOSE_ARGS[@]}" ps "${DEPLOY_SERVICES[@]}"
  docker compose "${COMPOSE_ARGS[@]}" logs --tail 100 "${DEPLOY_SERVICES[@]}"
  exit 1
}

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

mapfile -t COMPOSE_ARGS < <(compose_args)
mapfile -t DEPLOY_SERVICES < <(collect_app_services)

SHA=$(git rev-parse --short HEAD)
IMAGE="cacheflow:$SHA"

echo "==> Building API and worker images..."
docker compose "${COMPOSE_ARGS[@]}" build api worker

echo "==> Building image $IMAGE..."
docker build -t "$IMAGE" -t cacheflow:latest .

echo "==> Deploying..."
CACHEFLOW_IMAGE="$IMAGE" docker compose "${COMPOSE_ARGS[@]}" up -d --force-recreate "${DEPLOY_SERVICES[@]}"

verify_deploy

prune_cacheflow_images

echo "==> Done. Live image: $IMAGE"
docker compose "${COMPOSE_ARGS[@]}" ps "${DEPLOY_SERVICES[@]}"
