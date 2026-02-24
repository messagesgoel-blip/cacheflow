# CacheFlow — Claude Code Rules

## Identity
- Project root: /opt/docker/apps/cacheflow/ (on SERVER, not accessible here)
- This container: Claude Code runtime (node uid=1000)
- Server: OCI ARM64, Ubuntu 24 at hostname (see ~/.ssh/known_hosts)
- Server files owned by: sanjay uid=1002 gid=1002
- All Docker app containers run as 1002:1002

## VOLUME MOUNTS (this container)
| Container Path | Host Path | Purpose |
|----------------|-----------|---------|
| /workspace/cacheflow | /srv/docker/apps/claude-code/workspace | Local git clone |
| /workspace/cacheflow-qa | /home/sanjay/cacheflow-qa | QA test harness |
| /workspace/cacheflow/worker/sync-worker.js | (same) | Worker source (git-synced) |
| /workspace/cacheflow/web/app/page.tsx | (same) | Web app source (git-synced) |

**IMPORTANT**: /opt/docker/apps/cacheflow does NOT exist in this container. It only exists on the server.
- Use /workspace/cacheflow for all file editing
- After git push, SERVER must pull/rebuild
- Docker is NOT available in this container

## SSH ACCESS
- SSH key available at ~/.ssh/id_ed25519
- Can SSH to server if needed: `ssh <hostname>`
- Useful for remote debugging or triggering builds

## PORT REACHABILITY NOTE
- You CANNOT curl http://127.0.0.1:{port} from inside this container — that is normal
- Verify ports are listening on the HOST by checking git log and docker ps output instead
- Do NOT fail a day milestone just because curl to 8100/3010 returns 000

## NEVER DO THESE
- NEVER write files to /tmp — cleared on reboot and between sessions
- NEVER try to access /opt/docker/apps/cacheflow — it doesn't exist here
- NEVER assume docker is available — it's on the server only
- NEVER run docker compose run — always docker compose up -d
- NEVER assume a port is free — always ss -ltnp first
- NEVER mark a day done without passing the verification checklist below

## ALWAYS DO THESE
- Write files to /workspace/cacheflow/{service}/ (git clone)
- git add -A && git commit && git push after changes
- After push, trigger server build: ssh to server and run docker compose build
- rclone copy never rclone sync
- parseInt() on all PostgreSQL BIGINT columns — pg driver returns strings
- Atomic Redis INCRBY/DECRBY — never GET then SET for counters
- Prefer small Python patch scripts over large file rewrites
- docker compose -f /opt/docker/apps/cacheflow/infra/docker-compose.yml (on SERVER)

## VERIFICATION CHECKLIST — must pass before marking any day done

### In this container (pre-push):
1. git log --oneline -1            → commit exists
2. git push                        → successful
3. grep -c 'pattern' /workspace/cacheflow/{file} → verify code

### On server (post-push):
1. ssh to server
2. git pull
3. docker compose -f /opt/docker/apps/cacheflow/infra/docker-compose.yml build {service}
4. docker compose -f /opt/docker/apps/cacheflow/infra/docker-compose.yml up -d {service}
5. ss -ltnp | grep {port}        → LISTEN
6. docker compose ps | grep {svc} → Up
7. curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:{port} → 200

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
