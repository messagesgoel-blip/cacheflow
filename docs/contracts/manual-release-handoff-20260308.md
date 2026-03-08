# Manual Release Handoff

Date: 2026-03-08

Target repo state:
- Branch: `main`
- Commit: `27786e01b1041ac1cfe961add5106f07e544dd85`
- Short SHA: `27786e0`

Current baseline:
- Workspace git status is clean at `27786e0`.
- Latest known live web image before this handoff: `cacheflow:manual-20260307-220337`
- Live site: `https://cacheflow.goels.in`

Included commit stack:
- `61fd51c` `Stabilize VPS browser create actions`
- `2595da6` `Finish VPS edit and test flow`
- `b67a803` `Optimize preview range loading`
- `27786e0` `Refresh application shell surfaces`

Important deployment note:
- `deploy.sh` only rebuilds and recreates `web`.
- This release also changes `api`, so a safe manual rollout must rebuild/recreate both `api` and `web`.

Pre-deploy checks:
- Confirm `/opt/docker/apps/cacheflow` is on `main` and clean.
- Confirm the database already has `vps_connections.last_tested_at` and `vps_connections.last_host_fingerprint`.
- If those columns are missing, apply the idempotent SQL in `migrations/009_vps_last_verified.sql` before restarting `api`.

Suggested deploy sequence:
```bash
cd /opt/docker/apps/cacheflow
git fetch origin
git checkout main
git pull --ff-only origin main

# Optional safety check
git rev-parse HEAD
git status --short

# Apply DB change only if needed
psql "$DATABASE_URL" -f migrations/009_vps_last_verified.sql

# Rebuild API from current source
docker compose -f infra/docker-compose.yml build api

# Build web image from current source
SHA=$(git rev-parse --short HEAD)
IMAGE="cacheflow:$SHA"
docker build -t "$IMAGE" -t cacheflow:latest .

# Roll out both services
docker compose -f infra/docker-compose.yml up -d --force-recreate api
CACHEFLOW_IMAGE="$IMAGE" docker compose -f infra/docker-compose.yml up -d --force-recreate web
```

Post-deploy checks:
```bash
cd /opt/docker/apps/cacheflow
docker compose -f infra/docker-compose.yml ps
docker logs --tail 100 cacheflow-api
docker logs --tail 100 cacheflow-web
```

Recommended smoke checks:
- Login using mixed-case QA email:
  - `admin@Cacheflow.goels.in`
- Providers page:
  - saved VPS cards render
  - `Test Connection` and `Edit Details` actions are present
- Files page:
  - unified browser loads
  - preview panel opens without downloading full local/VPS text assets first
- Live VPS QA:
  - source label `OCI`
  - target label `test remote`
  - path `/srv/storage/local/mock run`
  - row-menu test `folder row menu can create into that folder with extended starter templates`

Validated from dev before handoff:
- `cd web && npx tsc --noEmit`
- `cd web && npm test -- --runInBand components/__tests__/UnifiedFileBrowser.test.ts components/__tests__/ProviderHub.test.ts components/modals/__tests__/VPSModal.test.tsx lib/files/__tests__/previewSource.test.ts`
- Live Playwright row-menu VPS regression passed twice against `https://cacheflow.goels.in` during stabilization before repo cleanup.
