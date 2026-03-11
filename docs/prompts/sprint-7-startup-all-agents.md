# Sprint 7 Startup Prompts (All Agents)

Use these prompts when bootstrapping the active Sprint 7 planning window.
Roadmap source: `docs/roadmap.md`
Sprint spec: `docs/sprints/sprint-7.md`
Task board source: `docs/sprints-task-dashboard.md`

## Shared Startup Block

```text
You are starting Sprint 7 planning for CacheFlow.

CACHEFLOW_ROOT=/opt/docker/apps/cacheflow

Before coding:
1) cd "$CACHEFLOW_ROOT"
2) git pull --rebase
3) Read AGENTS.md and STATUS.md fully
4) Read docs/roadmap.md, docs/sprints/sprint-7.md, docs/contracts/7.1.md, docs/sprints-task-dashboard.md, and docs/orchestration/task-manifest.json
5) Read .context/decisions.md, .context/patterns.md, .context/mistakes.md, .context/dependencies.md when relevant to touched scope
6) Confirm sprint state in logs/orchestrator-state.json and docs/orchestration/task-manifest.json
7) Draft task keys live in docs/sprints/sprint-7.md and docs/contracts/7.1.md; do not claim them until Sprint 7 is activated in docs/orchestration/task-manifest.json
8) Update STATUS.md Active section with your current planning task + machine + agent + started time

Planning rules:
- Sprint 7 has a draft decomposition and agent scopes, but it is still a planning-only sprint until manifest activation.
- Do not invent task keys in shared dashboards by hand.
- First produce decomposition, contracts, ownership boundaries, and gate criteria alignment.
- Keep GTM / Commercial work separate from Sprint 7 product planning.
- No change is considered done until it is tested, committed, and deployed from a clean git worktree in `$CACHEFLOW_ROOT`.
- Do not treat dirty-tree builds, uncommitted local changes, or dev-only verification as done for live.

Session end:
1) cd "$CACHEFLOW_ROOT"
2) Move Active -> Last Session in STATUS.md
3) Add unfinished items to Queue
4) Commit STATUS.md with: git commit -m "chore: update status"
5) git push
```

## Prompt: OpenCode

```text
Use the Shared Startup Block first.

Agent: OpenCode
Sprint: 7
Repo: $CACHEFLOW_ROOT

Primary planning ownership:
- `7.2@ZKV-1`: client key hierarchy and ciphertext envelope primitives
- `7.3@MIGRATE-1`: provider wrapping, metadata isolation, and migration boundary

Do not start implementation work until Sprint 7 is promoted into manifest-backed tasks.
```

## Prompt: ClaudeCode

```text
Use the Shared Startup Block first.

Agent: ClaudeCode
Sprint: 7
Repo: $CACHEFLOW_ROOT

Primary planning ownership:
- `7.4@RECOVERY-1`: unlock, recovery-kit, and irreversible-loss UX
- `7.5@RECOVERY-1`: locked-item boundary behavior in files, search, and share flows

Do not start implementation work until Sprint 7 is promoted into manifest-backed tasks.
```

## Prompt: Gemini

```text
Use the Shared Startup Block first.

Agent: Gemini
Sprint: 7
Repo: $CACHEFLOW_ROOT

Primary planning ownership:
- `7.6@ZKV-1`: deterministic crypto and recovery test contract
- `7.7@MIGRATE-1`: cross-device unlock and migration safety gate plan

Do not start implementation work until Sprint 7 is promoted into manifest-backed tasks.
```

## Prompt: Codex

```text
Use the Shared Startup Block first.

Agent: Codex
Sprint: 7
Repo: $CACHEFLOW_ROOT

Responsibilities:
- `7.1@ZKV-1`: architecture and gate freeze
- define contracts, worker scopes, and gate coverage
- keep roadmap/status/dashboard artifacts aligned while planning transitions to execution
- decide when the repo is stable enough to activate Sprint 7 in the executable manifest
- do not start implementation work until Sprint 7 is promoted into manifest-backed tasks
```
