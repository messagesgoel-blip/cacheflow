# CacheFlow Orchestration

This directory contains the self-running sprint orchestrator for CacheFlow v4.3.

## Files
- `task-manifest.json`: source-of-truth machine manifest parsed from roadmap tasks.
- `scripts/orchestrate.ts`: main orchestration loop.
- `scripts/lib/buildAgentPrompt.ts`: scoped prompt builder used for all agent dispatches.
- `scripts/recover.ts`: manual recovery tool after gate failures.
- `.github/workflows/orchestrate.yml`: CI entrypoint for orchestrator branch/manual dispatch.

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
4. Runs `git reset --hard sprint-{N-1}-gate-pass`.
5. Logs rollback event to `/logs/codex-audit.jsonl`.

## Notes
- Production promotion is never automatic.
- If `SLACK_WEBHOOK_URL` is missing, notifications are written to `/logs/notifications.txt`.
- Orchestration state lives only in log JSON files; no DB/Redis state is used.
