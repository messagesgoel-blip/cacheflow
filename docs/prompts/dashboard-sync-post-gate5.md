# Dashboard Sync Prompt — Post-Gate Version 1

This prompt is now historical reference for the dashboard/reporting sync completed on 2026-03-07.

## Scope
Update only dashboard/status artifacts and orchestration visibility docs. Do not modify runtime app/API logic.

## Source of Truth
- Repo: `/home/sanjay/cacheflow_work`
- Current commit: `f7f14d3`
- Canonical roadmap doc: `/home/sanjay/cacheflow_work/docs/roadmap.md`
- GTM backlog doc: `/home/sanjay/cacheflow_work/docs/gtm-commercial-backlog.md`
- Historical roadmap snapshot folder: `/srv/storage/local/Cacheflow/Roadmap/`
- Latest archived full-suite artifact: `/srv/storage/local/green run/20260306-203737/full-suite-20260306-203737`

## Facts to Reflect
- Version 1 is the merged Phase 1 + Phase 1.5 roadmap.
- Version 2 is the former Phase 2 roadmap.
- Legacy launch-only Sprint 6 items are no longer part of the core product roadmap.
- VPS/SFTP backend + UI is implemented on commit `f7f14d3`.
- Live VPS testing uses OCI + India nodes with real PEM auth.
- Deterministic gate is green on the working tree: `test-all`, `tsc`, `build`, and Playwright (`87 passed`, `1 skipped`).
- Live smoke is isolated in `web/playwright.live.config.ts`.

## Files to Update
- `docs/sprints-task-dashboard.md`
- `monitoring/cacheflow_sprint_tasks.yaml`
- `monitoring/cacheflow_task_state.yaml`
- `logs/orchestrator-state.json` (only status fields relevant to post-gate task visibility)

## Required Output
1. Update statuses so downstream agents see accurate in-progress/completed states.
2. Add timestamped note for: canonical roadmap moved to `docs/roadmap.md`, with `/srv/storage/local/Cacheflow/Roadmap/` retained only as historical input.
3. Keep wording factual; distinguish deterministic gate green from separate live smoke coverage.
4. Append a concise changelog entry in `docs/sprints-task-dashboard.md`.

## Validation
- Ensure files remain machine-parseable (JSON/YAML valid).
- Do not touch unrelated tasks/sprints.
- If you reference test outcomes, keep the archived full-suite artifact separate from current working-tree deterministic gate results.
