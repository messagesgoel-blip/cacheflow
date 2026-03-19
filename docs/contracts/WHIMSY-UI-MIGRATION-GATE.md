# Contract: WHIMSY-UI-MIGRATION-GATE

- producer: Codex
- consumer: roadmap planners, UI implementers, orchestration owners
- created_utc: 2026-03-18T00:00:00Z
- status: active

## Purpose

Define the entry and exit criteria for adopting Whimsy Panel Suite as the canonical UI inside CacheFlow's existing Next.js application.

## Invariants

- `cacheflow/web` remains the only production frontend runtime.
- Production CacheFlow frontend must not depend on Supabase auth or `react-router-dom`.
- Whimsy provides the visual system, shell structure, and end-state IA.
- CacheFlow provides auth, API routes, backend integration, and production routing.
- Shared product capability must not be duplicated as a second roadmap lane just because the UI is changing.

## Entry Gate

All of the following must be true before the migration gate starts execution:

1. `V1-4` live E2E triage hold is cleared.
2. `docs/whimsy-ui-migration-map.md` is current and accepted as the route/feature mapping source.
3. No active plan assumes a separate Vite production frontend.

## Exit Criteria

### `MIGRATE-UI-1` Shell Parity

- Authenticated routes run under a Whimsy-derived shell inside Next App Router.
- Navigation, top bar, command palette, and responsive layout are no longer split across duplicate shell systems.

### `MIGRATE-UI-2` Common Surface Parity

- `dashboard`, `files/library`, `connections`, `transfers`, `activity`, `security`, and `settings` render under the new shell.
- Each common surface uses live CacheFlow session and API data rather than Whimsy mock data.

### `MIGRATE-UI-3` Runtime Seam Replacement

- No Supabase auth flows remain in production UI paths.
- No `react-router-dom` runtime dependency remains in production UI paths.
- Next navigation and CacheFlow session/auth flows replace those seams completely.

### `MIGRATE-UI-4` Roadmap De-duplication

- Shared surfaces are not duplicated as new product epics.
- `Pricing` remains GTM / Commercial only.
- `Design System` remains internal-only and not a customer roadmap stage.
- Sprint 11 does not carry a duplicate standalone design-refresh epic.

### `MIGRATE-UI-5` Missing Surface Stability

- Placeholder or staged-entry routes exist for `spaces`, `integrations`, `automations`, `analytics`, and `organization`.
- Each placeholder explicitly references the owning roadmap stage so IA stays stable while implementation catches up.

### `MIGRATE-UI-6` Evidence Pack

- Roadmap, gate, and migration map remain aligned and sufficient to explain migration status.
- Visual verification exists for desktop and mobile shell parity.
- Route mapping remains aligned with `docs/roadmap.md`.

## Non-Goals

- Running Whimsy as a second production frontend.
- Replacing CacheFlow's backend or auth architecture with Supabase.
- Inventing new product roadmap stages solely to explain renamed pages.

## Canonical References

- roadmap: `/docs/roadmap.md`
- migration map: `/docs/whimsy-ui-migration-map.md`
- ideas intake only: `/docs/IDEAS_NOTEPAD.md`
