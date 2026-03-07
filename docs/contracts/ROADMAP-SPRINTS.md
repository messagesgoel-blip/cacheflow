# Roadmap Sprint Canonicalization Contract

Canonical sprint definitions aligned to `docs/roadmap.md`.

## Purpose

- Define Sprint 6 through Sprint 20 under the merged Version 1 / Version 2 roadmap.
- Keep executable orchestration scope separate from future planning scope.
- Remove dependence on the retired launch-only Sprint 6 document.

## Canonical Rules

- Sprints 0-5 remain the completed Version 1 core-platform record.
- Sprint 6 is the active Version 1 implementation sprint.
- Sprints 7-20 are defined planning specs only until Version 1 is fully green.
- `docs/orchestration/task-manifest.json` remains the executable source for active work.
- `docs/sprints/` is the human-readable sprint planning directory for the full roadmap.

## Outputs

- `docs/sprints/sprint-6.md`
- `docs/sprints/sprint-7.md` through `docs/sprints/sprint-20.md`
- `docs/orchestration/README.md`

## Operational Note

- Version 2 sprint specs are sequencing documents, not executable manifests.
- Dashboard and monitoring state should treat Sprint 6 as the live roadmap sprint until Version 1 is complete.
