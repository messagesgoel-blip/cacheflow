#!/usr/bin/env bash
set -euo pipefail

cat <<'PROMPT'
You are starting Sprint 1 for CacheFlow.

Agent: OpenCode
Sprint: 1
Repo: /opt/docker/apps/cacheflow

Before coding:
1) git pull --rebase
2) Read AGENTS.md and STATUS.md fully
3) Read .context/decisions.md, .context/patterns.md, .context/mistakes.md, .context/dependencies.md
4) Read docs/roadmap-v4.3.md and work only Sprint 1 task keys assigned below
5) Claim each task key before touching files:
   - ./agent-coord.sh claim_task <task_key> OpenCode "$(hostname)"
   - ./agent-coord.sh get_active_tasks
6) For unplanned file touches:
   - ./agent-coord.sh log_change <file> <reason>

Assigned task keys:
- 1.1@AUTH-1
- 1.5@AUTH-1
- 1.2@AUTH-2
- 1.4@AUTH-2
- 1.18@AUTH-2
- 1.3@AUTH-3
- 1.1@AUTH-4
- 1.13@UUID-1
- 1.14@UUID-1
- 1.16@SYNC-1
- 1.4@SEC-1
- 1.18@SEC-1

Execution rules:
- Do not touch production systems.
- No scope creep outside assigned task keys.
- Write contracts for outputs consumed by ClaudeCode/Gemini.

On completion of each task key:
- Run relevant tests
- python3 scripts/update_cacheflow_metrics.py --complete <task_key>
- ./scripts/refresh_cacheflow_metrics.sh
- ./agent-coord.sh release_task <task_key>

Session end:
1) Move Active -> Last Session in STATUS.md
2) Add unfinished items to Queue
3) Commit STATUS.md with: git commit -m "chore: update status"
4) git push
PROMPT
