# Contract: ROADMAP-CANONICAL

- producer: Codex
- consumer: all agents
- created_utc: 2026-03-07T06:00:01Z
- status: active

## Canonical Sources

- Product roadmap: `/docs/roadmap.md`
- Whimsy migration gate: `/docs/contracts/WHIMSY-UI-MIGRATION-GATE.md`
- Whimsy migration map: `/docs/whimsy-ui-migration-map.md`
- GTM / Commercial backlog: `/docs/gtm-commercial-backlog.md`
- Execution manifest: `/docs/orchestration/task-manifest.json`
- Dashboard: `/docs/sprints-task-dashboard.md`
- Runtime state: `/logs/orchestrator-state.json`

## Non-Canonical Intake

- Ideas notepad: `/docs/IDEAS_NOTEPAD.md`

## Migration Decisions

- Version 1 is the merged Phase 1 + Phase 1.5 roadmap.
- Version 2 is the former Phase 2 roadmap only.
- The old launch-only Sprint 6 is retired from the core product roadmap.
- The old `6.8A` option is absorbed into Version 1 stage `6.5`.
- `docs/sprints/sprint-6.md` now points at the canonical Version 1 Sprint 6 spec.
- Whimsy Panel Suite is the canonical end-state UI spec, but it is implemented inside `cacheflow/web`, not as a second production frontend.

## Retired Files

- Legacy roadmap files and duplicate external snapshots are removed from live planning use.
- `/CACHEFLOW_ROADMAP.md` is not a live planning source.

## Invariants

- Do not use retired roadmap files as live planning input.
- `Version 2` work must not be started or inferred as active until `Version 1` is fully green and `Version 2` work has been decomposed into executable manifest tasks.
- Keep GTM / Commercial work separate from Version 1 product sequencing.
- Do not treat `/docs/IDEAS_NOTEPAD.md` as approved roadmap scope.
- Agents may read the ideas notepad, but they must not promote or execute its contents as roadmap work until orchestrator agreement is reflected in `/docs/roadmap.md`.
