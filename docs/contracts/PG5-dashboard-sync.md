# Contract: PG5-dashboard-sync

Historical note: this contract records a completed dashboard sync from the earlier `/home/sanjay/cacheflow_work` workspace. The active working and deploy repo later moved to `/opt/docker/apps/cacheflow`.

- producer: Codex
- consumer: ClaudeCode (or dashboard/orchestration maintainer)
- created_utc: 2026-03-06T00:00:00Z
- status: completed

## Interface Summary
Dashboard/orchestration artifacts must reflect that the deterministic Version 1 gate is green and Sprint 6 is unblocked, while live smoke remains separate.

## Historical Inputs
- Working tree status in `/home/sanjay/cacheflow_work`
- Canonical roadmap doc in `/home/sanjay/cacheflow_work/docs/roadmap.md`
- GTM backlog doc in `/home/sanjay/cacheflow_work/docs/gtm-commercial-backlog.md`
- Historical roadmap snapshots in `/srv/storage/local/Cacheflow/Roadmap/`
- Current archived full-suite artifact: `/srv/storage/local/green run/20260306-203737/full-suite-20260306-203737`
- Current working-tree deterministic gate: `test-all`, `tsc`, `build`, and Playwright green (`87 passed`, `1 skipped`)
- Baseline commit: `f7f14d3`

## Current Repo Note
- Active working repo: `/opt/docker/apps/cacheflow`
- Canonical deploy checkout: `/opt/docker/apps/cacheflow`
- Keep the original `/home/sanjay/cacheflow_work` references only as historical provenance for this completed contract.

## Outputs
- Updated dashboard status docs and monitoring task-state files
- Timestamped change note indicating canonical roadmap path is now `/home/sanjay/cacheflow_work/docs/roadmap.md`

## Invariants
- No runtime code edits
- No fake/assumed live-smoke claims
- Keep JSON/YAML valid
