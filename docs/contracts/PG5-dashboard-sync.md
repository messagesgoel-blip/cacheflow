# Contract: PG5-dashboard-sync

- producer: Codex
- consumer: ClaudeCode (or dashboard/orchestration maintainer)
- created_utc: 2026-03-06T00:00:00Z
- status: completed

## Interface Summary
Dashboard/orchestration artifacts must reflect that the deterministic Version 1 gate is green and Sprint 6 is unblocked, while live smoke remains separate.

## Inputs
- Working tree status in `/home/sanjay/cacheflow_work`
- Canonical roadmap doc in `/home/sanjay/cacheflow_work/docs/roadmap.md`
- GTM backlog doc in `/home/sanjay/cacheflow_work/docs/gtm-commercial-backlog.md`
- Historical roadmap snapshots in `/srv/storage/local/Cacheflow/Roadmap/`
- Current archived full-suite artifact: `/srv/storage/local/green run/20260306-203737/full-suite-20260306-203737`
- Current working-tree deterministic gate: `test-all`, `tsc`, `build`, and Playwright green (`87 passed`, `1 skipped`)
- Baseline commit: `f7f14d3`

## Outputs
- Updated dashboard status docs and monitoring task-state files
- Timestamped change note indicating canonical roadmap path is now `/home/sanjay/cacheflow_work/docs/roadmap.md`

## Invariants
- No runtime code edits
- No fake/assumed live-smoke claims
- Keep JSON/YAML valid

