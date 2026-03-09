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
1) git pull --rebase
2) Read AGENTS.md and STATUS.md fully
3) Read docs/roadmap.md, docs/sprints/sprint-7.md, docs/sprints-task-dashboard.md, and docs/orchestration/task-manifest.json
4) Read .context/decisions.md, .context/patterns.md, .context/mistakes.md, .context/dependencies.md when relevant to touched scope
5) Confirm sprint state in logs/orchestrator-state.json and docs/orchestration/task-manifest.json
6) Confirm decomposition is approved before claiming any executable task key
7) Update STATUS.md Active section with your current planning task + machine + agent + started time

Planning rules:
- This sprint remains planning-only until decomposition is approved and executable task keys exist.
- Do not invent task keys in shared dashboards by hand.
- First produce decomposition, contracts, ownership boundaries, and gate criteria alignment.
- Keep GTM / Commercial work separate from Sprint 7 product planning.
- No change is considered done until it is tested, committed, and deployed from a clean git worktree in `$CACHEFLOW_ROOT`.
- Do not treat dirty-tree builds, uncommitted local changes, or dev-only verification as done for live.

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
Sprint: 7
Repo: $CACHEFLOW_ROOT

Primary planning ownership:
- backend and cryptographic feasibility for zero-knowledge vault architecture
- provider metadata isolation implications
- server-side recovery and migration constraints

Do not start implementation work until Sprint 7 task decomposition is approved and task keys exist.
```

## Prompt: ClaudeCode

```text
Use the Shared Startup Block first.

Agent: ClaudeCode
Sprint: 7
Repo: $CACHEFLOW_ROOT

Primary planning ownership:
- vault lifecycle UX
- unlock/recover/share boundary UX
- user messaging around encryption, recovery kits, and irreversible failure modes

Do not start implementation work until Sprint 7 task decomposition is approved and task keys exist.
```

## Prompt: Gemini

```text
Use the Shared Startup Block first.

Agent: Gemini
Sprint: 7
Repo: $CACHEFLOW_ROOT

Primary planning ownership:
- test strategy for cross-device unlock, key-loss handling, and migration safety
- deterministic gate design for zero-knowledge flows
- contract and E2E feasibility review for Sprint 7 acceptance criteria

Do not start implementation work until Sprint 7 task decomposition is approved and task keys exist.
```

## Prompt: Codex

```text
Use the Shared Startup Block first.

Agent: Codex
Sprint: 7
Repo: $CACHEFLOW_ROOT

Responsibilities:
- own Sprint 7 decomposition into executable task keys
- define contracts, worker scopes, and gate coverage
- keep roadmap/status/dashboard artifacts aligned while planning transitions to execution
- do not start implementation work until Sprint 7 decomposition and executable task keys are produced and approved
```
