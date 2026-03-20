# Contract: PG5-dashboard-sync

Historical note: this contract records a completed dashboard sync from an earlier cacheflow workspace. The active working and deploy repo later moved to `/srv/storage/repo/cacheflow`.

- producer: Codex
- consumer: ClaudeCode (or dashboard/orchestration maintainer)
- created_utc: 2026-03-06T00:00:00Z
- status: completed

## Interface Summary
Dashboard/orchestration artifacts must reflect that the deterministic Version 1 gate is green and Sprint 6 is unblocked, while live smoke remains separate.

## Historical Inputs
- Working tree status in `/srv/storage/repo/cacheflow`
- Canonical roadmap doc in `/srv/storage/repo/cacheflow/docs/roadmap.md`
- GTM backlog doc in `/srv/storage/repo/cacheflow/docs/gtm-commercial-backlog.md`
- Historical roadmap snapshots in `/srv/storage/local/Cacheflow/Roadmap/`
- Current archived full-suite artifact: `/srv/storage/local/green run/20260306-203737/full-suite-20260306-203737`
- Current working-tree deterministic gate: `test-all`, `tsc`, `build`, and Playwright green (`87 passed`, `1 skipped`)
- Baseline commit: `f7f14d3`

## Current Repo Note
- Active working repo: `/srv/storage/repo/cacheflow`
- Canonical deploy checkout: `/srv/storage/repo/cacheflow`
- Keep the original workspace references only as historical provenance for this completed contract.

## Outputs
- Updated dashboard status docs and monitoring task-state files
- Timestamped change note indicating canonical roadmap path is now `/srv/storage/repo/cacheflow/docs/roadmap.md`

## Invariants
- No runtime code edits
- No fake/assumed live-smoke claims
- Keep JSON/YAML valid
