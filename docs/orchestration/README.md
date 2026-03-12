# CacheFlow Orchestration

This directory contains the self-running sprint orchestrator for the canonical CacheFlow roadmap.

Current planning model:
- Version 1 = merged Phase 1 + Phase 1.5
- Version 2 = future roadmap only, starts after Version 1 is fully green
- GTM / Commercial work is tracked separately and is not part of the executable product manifest

## Files
- `task-manifest.json`: source-of-truth machine manifest parsed from roadmap tasks.
- `../roadmap.md`: canonical product roadmap.
- `../sprints/`: human sprint specs and sequencing notes.
- `scripts/orchestrate.ts`: main orchestration loop.
- `scripts/lib/buildAgentPrompt.ts`: scoped prompt builder used for all agent dispatches.
- `scripts/recover.ts`: manual recovery tool after gate failures.
- `.github/workflows/orchestrate.yml`: CI entrypoint for orchestrator branch/manual dispatch.

Manifest scope:
- Sprints 0-6 are the completed executable Version 1 manifest.
- Version 1 is complete and green.
- The active runtime loop is the V1-4 live-triage batch under Sprint 6 state.
- Sprint 7 remains planning-only until the live-triage hold is closed.
- Sprints 7-20 are defined in `docs/sprints/` for sequencing, but are not yet decomposed into executable manifest tasks.

## Start
Run from repository root:

```bash
npx ts-node scripts/orchestrate.ts
```

The orchestrator:
1. Loads `/logs/orchestrator-state.json` (or creates it).
2. Runs Wave 1 tasks sequentially and waits for contracts.
3. Runs Wave 2 tasks in parallel with timeout and completion-marker checks.
4. Runs Playwright gate and tags `sprint-{N}-gate-pass` on success.

## Monitor
Watch these files during execution:
- `/logs/orchestrator-state.json`
- `/logs/codex-audit.jsonl`
- `/logs/notifications.txt`
- `/logs/gate-results.json`
- `/logs/gate-failures/sprint-{N}.md` (on failure)

## Recover
After a gate failure:

```bash
npx ts-node scripts/recover.ts --sprint=3 --requeue=3.9,3.11
```

Recovery actions:
1. Verifies `/logs/gate-failures/sprint-{N}.md` exists.
2. Resets requeued tasks to `pending` in orchestrator state.
3. Deletes matching contract files.
4. Rolls the repo back to `sprint-{N-1}-gate-pass` through the automated recovery flow.
5. Logs rollback event to `/logs/codex-audit.jsonl`.

## Notes
- Production promotion is never automatic.
- If `SLACK_WEBHOOK_URL` is missing, notifications are written to `/logs/notifications.txt`.
- Orchestration state lives only in log JSON files; no DB/Redis state is used.
