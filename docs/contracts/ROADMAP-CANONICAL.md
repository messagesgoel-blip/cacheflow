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

## Retired Files

- `/docs/roadmap-v4.3.md`
- `/docs/sprints/sprint-6.md`
- `/docs/CacheFlow_AgentRoadmap_v4_3.docx`

## Invariants

- Do not use retired roadmap files as live planning input.
- Do not infer Version 2 work as active while Version 1 is not green.
- Keep GTM / Commercial work separate from Version 1 product sequencing.
