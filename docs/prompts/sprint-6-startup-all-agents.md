# Sprint 6 Startup Prompts (All Agents)

Use these prompts when bootstrapping the active Sprint 6 execution window.
Roadmap source: `docs/roadmap.md`
Sprint spec: `docs/sprints/sprint-6.md`
Task board source: `docs/sprints-task-dashboard.md`

## Shared Startup Block

```text
You are starting Sprint 6 for CacheFlow.

Before coding:
1) git pull --rebase
2) Read AGENTS.md and STATUS.md fully
3) Read docs/roadmap.md, docs/sprints/sprint-6.md, and docs/sprints-task-dashboard.md
4) Read .context/decisions.md, .context/patterns.md, .context/mistakes.md, .context/dependencies.md when relevant to touched scope
5) Claim each task key before touching files:
   - claim_task <task_key>
   - verify with get_active_tasks
6) For any unplanned file touch, log it:
   - log_change <file> <reason>
7) Update STATUS.md Active section with your current task key + machine + agent + started time

Execution rules:
- Do not touch production systems.
- Sprint 6 tasks are cross-agent umbrella tasks owned by Codex.
- Worker agents only claim Sprint 6 task keys after Codex dispatches the exact scope.
- Write/update contracts for producer tasks before dependent work.
- Keep commits scoped to the assigned Sprint 6 task key whenever possible.
- On completion of each task key:
  - run tests relevant to changed files
  - stage task files (`git add <files>`)
  - run `done-task <task_key> --test "<targeted test>" --commit "<message>"`
  - if only one active lock exists, task key can be omitted: `done-task --test "<targeted test>" --commit "<message>"`
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
Sprint: 6
Repo: /home/sanjay/cacheflow_work

Primary ownership:
- Backend/API/DB work for 6.1, 6.3, and 6.6
- SSE/logging and route support for 6.2
- Stream/range backend support for 6.4
- Trash/version adapter support for 6.5

Do not claim Sprint 6 keys until Codex dispatches the exact task key and file scope.
```

## Prompt: ClaudeCode

```text
Use the Shared Startup Block first.

Agent: ClaudeCode
Sprint: 6
Repo: /home/sanjay/cacheflow_work

Primary ownership:
- UI/UX work for 6.1 through 6.6
- Terminal/log presentation, trash/version UX, media preview UX, and VPS key-manager UI

Do not claim Sprint 6 keys until Codex dispatches the exact task key and file scope.
```

## Prompt: Gemini

```text
Use the Shared Startup Block first.

Agent: Gemini
Sprint: 6
Repo: /home/sanjay/cacheflow_work

Primary ownership:
- Deterministic Playwright and targeted QA for each Sprint 6 task
- Failure artifact capture and live-smoke isolation

Do not claim Sprint 6 keys until Codex dispatches the exact task key and test scope.
```

## Prompt: Codex

```text
Use the Shared Startup Block first.

Agent: Codex
Sprint: 6
Repo: /home/sanjay/cacheflow_work

Owned task keys:
- 6.1@QUOTA-1+RIMPORT-1
- 6.2@LOGS-1
- 6.3@SCHED-2+THROTTLE-1
- 6.4@MEDIA-1+STREAM-1
- 6.5@VERSION-1+TRASH-1
- 6.6@KEYS-1+NODE-1

Responsibilities:
- Claim, split, and sequence Sprint 6 work.
- Keep the release blocker green before feature execution.
- Finalize dashboard, task-state, and metrics updates.
```

