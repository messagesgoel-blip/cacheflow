# CacheFlow Product Roadmap

Canonical roadmap for product planning and orchestration.

- Canonical since: `2026-03-07`
- Replaces: `docs/roadmap-v4.3.md`, the legacy launch-only Sprint 6 plan, and the external duplicate roadmap JSX snapshots as live planning sources
- Scope split:
  - `Version 1`: merged Phase 1 + Phase 1.5
  - `Version 2`: former Phase 2 roadmap only
  - `GTM / Commercial`: separate backlog, tracked in `docs/gtm-commercial-backlog.md`

## Planning Rules

1. `Version 1` is the current product roadmap.
2. `Version 2` does not begin until `Version 1` is fully green.
3. No new Version 1 stage begins until the prior stage exit gate is green.
4. GTM / Commercial work is explicitly outside the Version 1 and Version 2 product sequence.

## Current Status

- Version 1 remains complete in deterministic roadmap/task-state tracking.
- A post-completion live E2E triage hold is open from the external green-run executed on `2026-03-10`.
- Active roadmap state is the `V1-4` live-triage cycle; Sprint 7 remains planning-only for Version 2.
- Draft Sprint 7 decomposition is documented in `docs/sprints/sprint-7.md` and `docs/contracts/7.1.md`.
- Sprint 7 manifest activation remains paused until the live-triage queue returns the repo to a low-drift base state.
- Orchestration runtime state is `idle` with `current_sprint: 6` for the active triage batch.
- Version 1 completion baseline: `f7f14d3`
- Last full-suite artifact: `/srv/storage/local/green run/20260306-203737/full-suite-20260306-203737`
- Latest external live green-run signal (`2026-03-10T23:45:38Z`):
  - `26 passed`
  - `54 failed`
  - `32 skipped`
  - normalized tracking source: `docs/live-e2e-triage-matrix.md`
- Latest deterministic gate validation (`2026-03-07T06:54:42Z`):
  - `test-all`: pass
  - `tsc`: pass
  - `build`: pass
  - `playwright`: pass (`87 passed`, `1 skipped`)
- Live smoke coverage is isolated in `web/playwright.live.config.ts`

## Version 1

Version 1 merges the original core-platform roadmap with the power-user bridge roadmap. This is the advised shipping version.

### V1-0 Release Blocker (Cleared)

Goal: make the existing platform green and trustworthy before starting new feature work.

- Finish post-gate patch cycle.
- Separate deterministic Playwright coverage from live VPS smoke coverage.
- Keep `test-all`, `tsc`, `build`, and deterministic Playwright green at all times.
- Exit gate:
  - full deterministic gate green
  - live smoke failures isolated from product regression signal
  - dashboard and orchestrator state aligned to this roadmap
- Status:
  - cleared on `2026-03-07`
  - superseded by full Version 1 completion on `2026-03-09`

### V1-1 Core Platform

Goal: ship the base multi-cloud file platform already built across Sprints 0-5.

- Auth foundation and secure session model
- Provider connection model and parity baseline
- File browsing, upload, preview, rename, move, delete
- Transfer engine, resumable uploads, zero-disk transfers, SSE progress
- Share links, 2FA, credential security
- Search, duplicate detection, cleanup, vault
- Status:
  - functionally implemented
  - deterministic gate green

### V1-2 Power User Essentials

Goal: deliver the first post-core features with the highest user value and strongest implementation leverage from existing foundations.

Status:
- complete in roadmap/task-state tracking as of `2026-03-09`

#### 6.1 Quota Alerts + Remote URL Import

Acceptance criteria:

- `QUOTA-1`: provider quota surfaces emit configurable `80%` and `95%` threshold alerts through in-app and email notifications
- `RIMPORT-1`: remote URL imports stream directly into the selected provider without buffering the full file on the CacheFlow server

Status note:

- implemented during the Sprint 6 Version 1 completion pass
- tracked complete in `logs/orchestrator-state.json`

#### 6.2 Real-Time Terminal & Log View

Acceptance criteria:

- `LOGS-1`: persistent terminal view shows BullMQ and worker events over SSE with zero polling

Status note:

- implemented during the Sprint 6 Version 1 completion pass
- tracked complete in `logs/orchestrator-state.json`

#### 6.3 Scheduled Backups + Bandwidth Throttle

Acceptance criteria:

- `SCHED-2`: recurring user-scoped backup jobs run with browser closed and expose history
- `THROTTLE-1`: user-controlled bandwidth caps persist per session and affect future transfers

Status note:

- implemented during the Sprint 6 Version 1 completion pass
- tracked complete in `logs/orchestrator-state.json`

### V1-3 Power User Completion

Goal: finish the Version 1 differentiators after the essentials are stable.

Status:
- complete in roadmap/task-state tracking as of `2026-03-09`

#### 6.4 Media Streaming Polish

Acceptance criteria:

- `MEDIA-1`: full HTTP range request behavior for seekable media
- `STREAM-1`: long-lived stream stability without disk buffering or memory growth

#### 6.5 File Versioning + Trash Bin

Acceptance criteria:

- `VERSION-1`: overwrite/delete creates snapshots with one-click restore
- `TRASH-1`: per-user trash with restore and permanent delete

Notes:

- this stage absorbs the old `6.8A` launch-roadmap option

#### 6.6 VPS/SFTP Key Lifecycle

Acceptance criteria:

- `KEYS-1`: dedicated key manager for create, rotate, and test flows with encrypted-at-rest keys
- `NODE-1`: VPS bridge supports custom ports and configurable keep-alive behavior

Status note:

- implemented during the Sprint 6 Version 1 completion pass
- tracked complete in `logs/orchestrator-state.json`

### V1-4 Post-Completion Live E2E Triage Hold

Goal: preserve and close the live-validation backlog exposed by the external green-run before treating Version 1 as fully closed from a live E2E perspective.

Status:
- open as of `2026-03-11`
- tracking source: `docs/live-e2e-triage-matrix.md`
- does not roll back the deterministic Version 1 completion baseline
- must remain visible while Sprint 7 / Version 2 planning continues
- first executable orchestration batch is activated under Sprint `6` runtime so triage work completes before Sprint `7` manifest activation

Entry signal:

- external live run on `2026-03-10T23:45:38Z`
- result: `26 passed`, `54 failed`, `32 skipped`

Scope:

- fix the `AUTH-3` browser-storage security bug
- close the normalized app-bug matrix from `docs/live-e2e-triage-matrix.md`
- close the normalized spec-bug matrix from `docs/live-e2e-triage-matrix.md`
- rerun with `CF_TOTP_SECRET` and stable live fixtures/accounts
- reclassify Version `6.1` through `6.6` live failures as shipped regression, fixture gap, or stale spec issue

Ordered task queue:

1. `SEC-01`
2. `APP-01`
3. `APP-09`
4. `APP-10`
5. `APP-02` to `APP-08`, `APP-12`
6. `SPEC-01`, `SPEC-02`, `SPEC-04`, `SPEC-06` to `SPEC-11`
7. `APP-11`
8. `SPEC-03`, `SPEC-05`, `APP-13`
9. `ENV-01` to `ENV-03`
10. `VERIFY-01` to `VERIFY-06`

Exit gate:

- `AUTH-3` green
- upload/list invalidation green
- `/api/health` green
- transfer tray, provider health attributes, vault PIN gate, empty states, and VPS sidebar re-verified
- false-failure spec bugs removed from the suite
- rerun executed with 2FA secret and stable fixtures
- Version `6.1` through `6.6` explicitly reclassified after rerun

## Version 2

Version 2 starts after Version 1 is green and complete.

Current status:
- entry gate satisfied
- Sprint 7 is the active planning sprint only after the V1-4 live-triage hold is cleared
- draft task decomposition is documented
- executable manifest activation remains intentionally paused

### V2-A Foundation

- Sprint 7: Zero-Knowledge Vault
- Sprint 8: NAS Bridge + Advanced PWA
- Sprint 9: AI FinOps
- Sprint 10: MCP + Team Workspaces
- Sprint 11: Design Refresh + Observability

### V2-B Easy Wins

- Sprint 12: Sync Engine + Rule Engine + Smart Dedup
- Sprint 13: Conflict Resolution + CLI + Webhooks
- Sprint 14: Provider Failover + Cost Scheduling + Bundle Shares

### V2-C Moderate

- Sprint 15: Storage Heatmap + Lifecycle Automation
- Sprint 16: Storage Mirroring + Uptime Dashboard
- Sprint 17: Data Residency Enforcement

### V2-D Advanced

- Sprint 18: AI-Powered File Organisation
- Sprint 19: Embeddable File Picker SDK
- Sprint 20: Carbon + Energy Tracking

## De-duplication Decisions

- The old launch-only Sprint 6 is retired as a product roadmap.
- Old `6.8A` is merged into `V1-3 / 6.5`.
- PWA, SEO landing, billing, tiering, and affiliate work move to the GTM / Commercial backlog.
- External roadmap snapshots under `/srv/storage/local/Cacheflow/Roadmap/` are treated as historical source inputs, not live orchestration sources.

## Canonical Files

- Product roadmap: `docs/roadmap.md`
- Live E2E triage matrix: `docs/live-e2e-triage-matrix.md`
- GTM / Commercial backlog: `docs/gtm-commercial-backlog.md`
- Sprint specs: `docs/sprints/`
- Orchestration manifest: `docs/orchestration/task-manifest.json`
- Dashboard: `docs/sprints-task-dashboard.md`
- Runtime state: `logs/orchestrator-state.json`
