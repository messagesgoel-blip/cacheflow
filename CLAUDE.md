# CacheFlow — Claude Code Rules

## Identity
- Project root: /opt/docker/apps/cacheflow/
- Server: OCI ARM64, Ubuntu 24
- Runtime user: sanjay uid=1002 gid=1002
- All containers run as 1002:1002

## NEVER DO THESE
- NEVER write files to /tmp — cleared on reboot and between sessions
- NEVER use /workspace — correct path is /opt/docker/apps/cacheflow/
- NEVER run docker compose run — always docker compose up -d
- NEVER assume a port is free — always ss -ltnp first
- NEVER mark a day done without passing the verification checklist below

## ALWAYS DO THESE
- Write files directly to /opt/docker/apps/cacheflow/{service}/
- git add -A && git commit after every day milestone
- ss -ltnp before every docker compose up
- rclone copy never rclone sync
- parseInt() on all PostgreSQL BIGINT columns — pg driver returns strings
- Atomic Redis INCRBY/DECRBY — never GET then SET for counters
- Prefer small Python patch scripts over large file rewrites
- docker compose -f /opt/docker/apps/cacheflow/infra/docker-compose.yml always

## VERIFICATION CHECKLIST — must pass before marking any day done
1. ss -ltnp | grep {port}          → LISTEN
2. docker compose ps | grep {svc}  → Up
3. curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:{port} → 200
4. git log --oneline -1            → commit exists
5. ls /opt/docker/apps/cacheflow/{service}/ → files on disk

## PORT MAP — do not conflict
- 8100  → cacheflow-api
- 5433  → cacheflow-postgres
- 6380  → cacheflow-redis (internal 6379)
- 3100  → loki
- 3002  → grafana
- 3010  → cacheflow-web (Next.js)
- 8180  → WebDAV (Day 76, not yet deployed)

## SYNC_MIN_AGE_MS
Default: 1200000ms (20 min). Test override:
  echo "SYNC_MIN_AGE_MS=5000" >> .env
Restore immediately after test:
  sed -i '/^SYNC_MIN_AGE_MS=5000/d' .env && docker compose up -d worker

## GIT
- Remote: github.com:messagesgoel-blip/cacheflow.git
- Branch: main
- Commit format: "Day N: description"
- Git is the handoff between Claude.ai (planning) and Claude Code CLI (execution)

## SESSION START RITUAL — run these 3 commands first, every time
  git log --oneline -5
  ss -ltnp
  docker compose -f /opt/docker/apps/cacheflow/infra/docker-compose.yml ps
