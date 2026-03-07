# CacheFlow Product Roadmap

Canonical roadmap for product planning and orchestration.

- Canonical since: `2026-03-07`
- Replaces: `docs/roadmap-v4.3.md`, `docs/sprints/sprint-6.md`, and the external duplicate roadmap JSX snapshots as live planning sources
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

- Version 1 release blocker is still active.
- Orchestration state remains `patching-post-gate-failures`.
- Baseline under patching: `f7f14d3`
- Last full-suite artifact: `/srv/storage/local/green run/20260306-203737/full-suite-20260306-203737`

## Version 1

Version 1 merges the original core-platform roadmap with the power-user bridge roadmap. This is the advised shipping version.

### V1-0 Release Blocker

Goal: make the existing platform green and trustworthy before starting new feature work.

- Finish post-gate patch cycle.
- Separate deterministic Playwright coverage from live VPS smoke coverage.
- Keep `test-all`, `tsc`, `build`, and deterministic Playwright green at all times.
- Exit gate:
  - full deterministic gate green
  - live smoke failures isolated from product regression signal
  - dashboard and orchestrator state aligned to this roadmap

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
  - still blocked on final green gate

### V1-2 Power User Essentials

Goal: deliver the first post-core features with the highest user value and strongest implementation leverage from existing foundations.

#### 6.1 Quota Alerts + Remote URL Import

Acceptance criteria:

- `QUOTA-1`: provider quota surfaces emit configurable `80%` and `95%` threshold alerts through in-app and email notifications
- `RIMPORT-1`: remote URL imports stream directly into the selected provider without buffering the full file on the CacheFlow server

Current assessment:

- quota gauges already exist in dashboard and sidebar
- threshold alerting does not exist yet
- remote upload UI exists, but backend implementation is still placeholder and buffers data in memory

#### 6.2 Real-Time Terminal & Log View

Acceptance criteria:

- `LOGS-1`: persistent terminal view shows BullMQ and worker events over SSE with zero polling

Current assessment:

- transfer SSE foundation exists
- no terminal/log product surface exists yet

#### 6.3 Scheduled Backups + Bandwidth Throttle

Acceptance criteria:

- `SCHED-2`: recurring user-scoped backup jobs run with browser closed and expose history
- `THROTTLE-1`: user-controlled bandwidth caps persist per session and affect future transfers

Current assessment:

- schedule UI and worker foundations exist but are split between prototype and real services
- throttle controls do not exist yet

### V1-3 Power User Completion

Goal: finish the Version 1 differentiators after the essentials are stable.

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

Current assessment:

- encryption and dry-run connection foundations already exist
- key manager and lifecycle UI do not exist yet

## Version 2

Version 2 starts only after Version 1 is green and complete.

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
- GTM / Commercial backlog: `docs/gtm-commercial-backlog.md`
- Orchestration manifest: `docs/orchestration/task-manifest.json`
- Dashboard: `docs/sprints-task-dashboard.md`
- Runtime state: `logs/orchestrator-state.json`
