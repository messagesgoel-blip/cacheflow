# Deploy Script Multi-Service Rollout

Date: 2026-03-08

Scope:
- prevent web-only deploys when the release also changes API or worker code
- fail fast if the live repo worktree is dirty before `git pull`

Changed paths:
- `deploy.sh`

Behavior:
- deployment now requires a clean git worktree before pulling from `main`
- `git pull` uses `--ff-only`
- deploy builds compose-managed `api` and `worker` images before building the root `cacheflow:<sha>` web image
- deploy recreates `api`, `worker`, and `web` together instead of only `web`
- final status output reports all three application services via `docker compose ps`

Verification:
- `bash -n deploy.sh`
