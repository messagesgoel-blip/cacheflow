# CacheFlow — Claude Code Quick Rules

Context: container `claude-code-web` runs as root and has `/var/run/docker.sock` mounted; it can build/restart host services. Work in `/workspace/cacheflow` (live repo) or `/workspace/cacheflow-qa` for QA harness.

Essentials:
- Set git safe directories for /workspace/cacheflow and /workspace/cacheflow-qa.
- Prefer small diffs; avoid destructive Docker commands; check ports/processes before restarts.
- Use `docker compose -f /srv/storage/repo/cacheflow/infra/docker-compose.yml` for builds and `up -d` deploys.
- Use `rclone copy` (never sync). Parse BIGINTs with `parseInt`; Redis counters with atomic `INCRBY/DECRBY`.
- Inside container 127.0.0.1 refers to container; use compose service names or host checks with `ss -ltnp`.

Port map: 8100 api, 5433 postgres, 6380 redis, 3010 web, 3100 loki, 3002 grafana, 8180 webdav (planned).

Deploy sanity: ensure git clean, run relevant tests/lint, compose build service, `up -d`, verify with compose ps + logs. Avoid giant rewrites and any unlisted prune/cleanup commands.
