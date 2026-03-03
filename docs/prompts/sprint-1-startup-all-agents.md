# Sprint 1 Startup Prompts (All Agents)

Use these prompts as-is when bootstrapping Sprint 1.  
Roadmap source: `docs/roadmap-v4.3.md`  
Task board source: `docs/sprints-task-dashboard.md`

## Shared Startup Block

```text
You are starting Sprint 1 for CacheFlow.

Before coding:
1) git pull --rebase
2) Read AGENTS.md and STATUS.md fully
3) Read .context/decisions.md, .context/patterns.md, .context/mistakes.md, .context/dependencies.md
4) Read docs/roadmap-v4.3.md and only work Sprint 1 task keys assigned below
5) Claim each task key before touching files:
   - claim_task <task_key>
   - verify with get_active_tasks
6) For any unplanned file touch, log it:
   - log_change <file> <reason>
7) Update STATUS.md Active section with your current task key + machine + agent + started time

Execution rules:
- Do not touch production systems.
- No scope creep outside assigned task keys.
- Write/update contracts for producer tasks:
  - write_contract <task_key> ...
  - consumers must read_contract <task_key> before implementation.
- Keep commits scoped per task key when possible.
- On completion of each task key:
  - run tests relevant to changed files
  - stage task files (`git add <files>`)
  - run `./scripts/finish_task.sh <task_key> --test "<targeted test>" --commit "<message>"`
  - do not update shared metrics/dashboard files directly
  - Codex finalizes task state + dashboard + metrics refresh after lock release

Session end:
1) Move Active -> Last Session in STATUS.md
2) Add unfinished items to Queue
3) Commit STATUS.md with: git commit -m "chore: update status"
4) git push
```

## Prompt: OpenCode

```text
Use the Shared Startup Block first.

Agent: OpenCode
Sprint: 1
Repo: /opt/docker/apps/cacheflow

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

Deliverables:
- Implementation + tests for each key
- Contract files for interfaces consumed by Claude/Gemini
- .context updates for decisions/patterns/mistakes/dependencies
```

## Prompt: ClaudeCode

```text
Use the Shared Startup Block first.

Agent: ClaudeCode
Sprint: 1
Repo: /opt/docker/apps/cacheflow

Assigned task keys:
- 1.17@AUTH-1
- 1.6@AUTH-3
- 1.8@MODAL-1
- 1.9@MODAL-1
- 1.10@MODAL-1

Deliverables:
- UI/UX implementation + Playwright/UI tests where applicable
- Read contracts from OpenCode before dependent changes
- Keep action/state behavior consistent across all modal entry points
```

## Prompt: Gemini

```text
Use the Shared Startup Block first.

Agent: Gemini
Sprint: 1
Repo: /opt/docker/apps/cacheflow

Assigned task keys:
- 1.7@AUTH-1
- 1.19@AUTH-2
- 1.11@MODAL-1

Deliverables:
- E2E coverage for assigned keys
- Failure artifacts for any regression (screenshots/logs)
- Release task locks after each passing task; Codex handles shared metrics/dashboard sync
```

## Prompt: Codex (Master)

```text
Use the Shared Startup Block first.

Agent: Codex (Master)
Sprint: 1
Repo: /opt/docker/apps/cacheflow

Assigned task keys:
- 1.12@UUID-1
- 1.15@UUID-1

Master responsibilities:
- Gate sequencing and dependency checks
- Contract presence verification before dependent dispatch
- Merge/conflict mediation
- Rollback decision authority
- Final gate pass/fail signal for Sprint 1
```
