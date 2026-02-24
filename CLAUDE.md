# CacheFlow — Claude Code Rules

## Identity
- Project root (SERVER): `/opt/docker/apps/cacheflow/`
- This container: `claude-code-web` (Tier B)
  - Runs as **root** (uid=0) via compose `user: "0:0"`
  - Has **/var/run/docker.sock** mounted → can control host Docker daemon
  - Has **Docker CLI + docker compose plugin** installed (docker compose works)
- Server: OCI ARM64, Ubuntu 24, hostname per SSH config
- Server primary owner: `sanjay` (uid=1002 gid=1002)

## Critical Reality (Tier B)
This container has near-root control of the host via the Docker socket.
- It **CAN** build/pull/push/restart containers on the host
- It **CAN** read/write mounted host paths
- It is reversible: remove `/var/run/docker.sock` mount + drop `user: "0:0"`

## VOLUME MOUNTS (this container)
| Container Path | Host Path | Purpose |
|----------------|-----------|---------|
| `/workspace` | `/srv/docker/apps/claude-code/workspace` | scratch workspace |
| `/workspace/cacheflow` | `/opt/docker/apps/cacheflow` | **LIVE server repo** (preferred) |
| `/workspace/cacheflow-qa` | `/home/sanjay/cacheflow-qa` | QA harness |
| `/mnt` | `/mnt` | shared mount points |
| `/home/node/.claude` | `/srv/docker/apps/claude-code/claude-home` | Claude state |
| `/home/node/.ssh` | `/srv/docker/apps/claude-code/node-ssh` | SSH keys (node path) |
| `/root/.ssh` | `/srv/docker/apps/claude-code/node-ssh` | SSH keys (root path) |
| `/var/run/docker.sock` | `/var/run/docker.sock` | host Docker control |

## LITELLM / CLAUDE GATEWAY
- Inside docker network (proxy): `http://litellm-proxy:4000`
- Host has localhost publish for LiteLLM: `http://127.0.0.1:4000` (typically returns 401 without key; expected)

## GIT SAFETY (required)
Because the repo is mounted and ownership differs, Git may block with “dubious ownership”.
Always ensure these are set inside the container:
- `git config --global --add safe.directory /workspace/cacheflow`
- `git config --global --add safe.directory /workspace/cacheflow-qa`

(These should be applied automatically at container start; if they regress, re-run them.)

## PORT REACHABILITY NOTE
- From inside this container, `127.0.0.1:{port}` refers to the **container**, not the host.
- Prefer:
  - Docker-level checks: `docker ps`, `docker compose ps`, container health
  - Network checks by service name on `proxy` network (e.g., `litellm-proxy:4000`)
  - Host port checks via `ss -ltnp` (run on host or via docker exec into host tools if available)

## NEVER DO THESE
- NEVER assume a port is free — always `ss -ltnp` first
- NEVER do giant rewrites — prefer small patch scripts
- NEVER mark a day done without passing the verification checklist below
- NEVER run destructive Docker commands without listing targets first (e.g., `docker system prune`)

## ALWAYS DO THESE
- Work in `/workspace/cacheflow` (LIVE server repo mount)
- Make changes as small diffs; prefer automated patch scripts
- `git add -A && git commit && git push` after changes
- Use Docker safely:
  - `docker compose -f /opt/docker/apps/cacheflow/infra/docker-compose.yml ...`
  - Prefer `up -d` over `run`
- rclone copy never rclone sync
- parseInt() on all PostgreSQL BIGINT columns — pg driver returns strings
- Atomic Redis INCRBY/DECRBY — never GET then SET for counters

## VERIFICATION CHECKLIST — must pass before marking any day done

### In this container (pre-deploy / pre-push):
1. `git -C /workspace/cacheflow log --oneline -1`
2. `git -C /workspace/cacheflow status -sb`
3. `npm/test/lint checks` as applicable for the patch
4. Grep-level verification: `grep -n 'pattern' /workspace/cacheflow/{file}`

### Deploy on host (can be executed FROM THIS CONTAINER via docker.sock):
1. `git -C /workspace/cacheflow pull --ff-only` (or ensure you’re on correct commit)
2. Build:
   - `docker compose -f /opt/docker/apps/cacheflow/infra/docker-compose.yml build {service}`
3. Deploy:
   - `docker compose -f /opt/docker/apps/cacheflow/infra/docker-compose.yml up -d {service}`
4. Verify:
   - `docker compose -f /opt/docker/apps/cacheflow/infra/docker-compose.yml ps | grep {service}`
   - `ss -ltnp | grep {port}`  (host-side check)
   - `docker logs --tail 120 {container}` for smoke sanity

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
  `echo "SYNC_MIN_AGE_MS=5000" >> .env`
Restore immediately after test:
  `sed -i '/^SYNC_MIN_AGE_MS=5000/d' .env && docker compose up -d worker`

## GIT
- Remote: `github.com:messagesgoel-blip/cacheflow.git`
- Branch: `main`
- Commit format: `Day N: description`

## SESSION START RITUAL — run these 3 commands first, every time
  `git -C /workspace/cacheflow log --oneline -5`
  `ss -ltnp`
  `docker compose -f /opt/docker/apps/cacheflow/infra/docker-compose.yml ps`

## EMBEDDING MODEL DECISION (Day 71)
- Use **Anthropic embeddings API** (`text-embedding-3-small` equivalent via claude-3)
- Rationale: Already have ANTHROPIC_API_KEY in .env, no extra infra, 1536-dim vectors
- Same vendor as AI merge (consistency)
- Check current Anthropic docs for embeddings endpoint
