# CacheFlow — Claude Code Rules

## Identity
- Project: /opt/docker/apps/cacheflow/
- Server: OCI ARM64, Ubuntu 24
- Runtime user: sanjay (uid=1002, gid=1002)
- All containers run as 1002:1002

## NEVER DO THESE
- NEVER write files to /tmp — it is cleared on reboot and between sessions
- NEVER use /workspace — the correct path is /opt/docker/apps/cacheflow/
- NEVER run docker compose run — always use docker compose up -d
- NEVER assume a port is free — always run ss -ltnp first
- NEVER mark a day complete without running the verification checklist below

## ALWAYS DO THESE
- Always write files directly to /opt/docker/apps/cacheflow/{service}/
- Always git add -A && git commit after every day milestone
- Always run ss -ltnp before any docker compose up
- Always use rclone copy — never rclone sync
- Always parseInt() on PostgreSQL BIGINT columns (pg driver returns strings)
- Always use atomic Redis INCRBY/DECRBY — never GET then SET for counters
- Always prefer small Python patch scripts over large file rewrites
- Always use docker compose -f /opt/docker/apps/cacheflow/infra/docker-compose.yml

## VERIFICATION CHECKLIST (must pass before marking any day done)
1. ss -ltnp | grep {expected_port}   → port is LISTEN
2. docker compose ps | grep {service} → container is Up
3. curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:{port} → HTTP 200
4. git log --oneline -1               → commit exists
5. ls /opt/docker/apps/cacheflow/{service}/ → files exist on disk

## PORT MAP (do not conflict)
- 8100 → cacheflow-api
- 5433 → cacheflow-postgres
- 6380 → cacheflow-redis (internal: 6379)
- 3100 → loki
- 3002 → grafana
- 3010 → cacheflow-web (Next.js)
- 8180 → WebDAV (Day 76, not yet deployed)

## STACK
- Node 22 (API + Worker), Node 18 (Web)
- PostgreSQL 17
- Redis 7-alpine
- rclone, chokidar, MergerFS
- Next.js 14, TypeScript, Tailwind

## SYNC_MIN_AGE_MS
- Default: 1,200,000ms (20 min) — NEVER leave this overridden
- Test override: echo "SYNC_MIN_AGE_MS=5000" >> .env, restore after: sed -i '/^SYNC_MIN_AGE_MS=5000/d' .env

## GIT
- Remote: github.com:messagesgoel-blip/cacheflow.git
- Branch: main
- Commit format: "Day N: {what was built}"
- Git is the handoff between Claude.ai (planning) and Claude Code CLI (execution)

## SESSION START RITUAL
Run this at the start of every session:
  git log --oneline -5
  ss -ltnp
  docker compose -f /opt/docker/apps/cacheflow/infra/docker-compose.yml ps
