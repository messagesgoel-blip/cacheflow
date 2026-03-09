# Contract: ROADMAP-CANONICAL

- producer: Codex
- consumer: all agents
- created_utc: 2026-03-07T06:00:01Z
- status: active

## Canonical Sources

- Product roadmap: `/docs/roadmap.md`
- GTM / Commercial backlog: `/docs/gtm-commercial-backlog.md`
- Execution manifest: `/docs/orchestration/task-manifest.json`
- Dashboard: `/docs/sprints-task-dashboard.md`
- Runtime state: `/logs/orchestrator-state.json`

## Migration Decisions

- Version 1 is the merged Phase 1 + Phase 1.5 roadmap.
- Version 2 is the former Phase 2 roadmap only.
- The old launch-only Sprint 6 is retired from the core product roadmap.
- The old `6.8A` option is absorbed into Version 1 stage `6.5`.
- `docs/sprints/sprint-6.md` now points at the canonical Version 1 Sprint 6 spec.

## Retired Files

- Legacy roadmap files and duplicate external snapshots are removed from live planning use.

## Invariants

- Do not use retired roadmap files as live planning input.
- Do not infer Version 2 implementation work as active until it is decomposed into executable manifest tasks.
- Keep GTM / Commercial work separate from Version 1 product sequencing.
