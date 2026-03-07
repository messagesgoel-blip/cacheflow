# Contract: PG5-dashboard-sync

- producer: Codex
- consumer: ClaudeCode (or dashboard/orchestration maintainer)
- created_utc: 2026-03-06T00:00:00Z
- status: draft

## Interface Summary
Dashboard/orchestration artifacts must be updated to reflect post-gate Sprint 6 execution reality without claiming final gate pass.

## Inputs
- Working tree status in `/home/sanjay/cacheflow_work`
- Roadmap UI files in `/srv/storage/local/Cacheflow/Roadmap/`
- Current test execution state: VPS live tests in progress, full green not yet declared

## Outputs
- Updated dashboard status docs and monitoring task-state files
- Timestamped change note indicating roadmap source path moved to `/srv/storage/local/Cacheflow/Roadmap/`

## Invariants
- No runtime code edits
- No fake/assumed green test claims
- Keep JSON/YAML valid
