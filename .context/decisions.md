# Decisions

## YYYY-MM-DD — [title]
- decision:
- rationale:
- alternatives rejected:
- files:
- commit:
- agent:

## 2026-03-11 — Keep Sprint 7 decomposed in docs but off the executable manifest until repo drift settles
- decision: Document Sprint 7 draft task keys, gates, and agent scopes in the sprint spec and contract docs, but do not activate Sprint 7 in `docs/orchestration/task-manifest.json` or generated monitoring yet.
- rationale: Open cleanup PRs on shared CacheFlow surfaces would make immediate manifest activation likely to create rebase churn and prematurely start Version 2 implementation while review state is still unstable.
- alternatives rejected: Leave Sprint 7 undecomposed and keep stale queue items; activate Sprint 7 execution immediately despite active cleanup drift.
- files: docs/roadmap.md, docs/sprints/sprint-7.md, docs/contracts/7.1.md, docs/prompts/sprint-7-startup-all-agents.md, docs/sprints-task-dashboard.md, STATUS.md
- commit: pending
- agent: codex

## 2026-03-07 — Consolidate product planning into one canonical V1/V2 roadmap
- decision: Replace the legacy launch-only Sprint 6 roadmap with a canonical roadmap where Version 1 = merged Phase 1 + Phase 1.5, Version 2 = former Phase 2, and GTM / Commercial work lives in a separate backlog.
- rationale: The repo had two competing sprint-6 definitions and multiple roadmap sources, which caused orchestration, dashboards, and fresh context windows to disagree about what work was actually next.
- alternatives rejected: Keep both roadmaps and rely on prompt-level clarification; keep the launch-only Sprint 6 as the active roadmap.
- files: docs/roadmap.md, docs/gtm-commercial-backlog.md, docs/orchestration/task-manifest.json, docs/sprints-task-dashboard.md, logs/orchestrator-state.json
- commit: pending
- agent: codex

## 2026-03-02 — Use `id@gate` as canonical task key for sprint tracking
- decision: Treat roadmap tasks as `task_id@gate` in metrics, task state, and lock operations.
- rationale: Numeric task IDs repeat across gates, and unique keys are required for accurate status, commit metadata, and lock ownership.
- alternatives rejected: Keep plain numeric IDs only; this causes collisions and ambiguous ownership in dashboards/automation.
- files: monitoring/cacheflow_task_state.yaml, monitoring/cacheflow_metrics.yaml, scripts/update_cacheflow_metrics.py
- commit: 6e25175
- agent: codex

## 2026-03-02 — Agent name alias: `claude` = `ClaudeCode`
- decision: Use `claude` as alias for `ClaudeCode` when claiming tasks via agent-coord.sh.
- rationale: Shorter alias for convenience; both map to same agent identity in task locks.
- alternatives rejected: Keep strict full-name only input and require manual correction on mismatch.
- files: agent-coord.sh, .context/task_locks/*
- commit: a24bcfb5ac1a
- agent: sanjay

## 2026-03-02 — Security baseline: remove defaults, harden secrets (SEC-1)
- decision: Require DB_PASSWORD and CREDENTIAL_ENCRYPTION_KEY environment variables; remove hardcoded defaults.
- rationale: Hardcoded default passwords and encryption keys are a critical security vulnerability. Production must explicitly configure secrets.
- alternatives rejected: Keep defaults with warnings - insufficient; defaults often remain in place in production.
- files: api/src/middleware/auth.js, api/src/routes/tokens.js
- commit: a083219
- agent: ClaudeCode

## 2026-03-03 — Add `OPS-QA-WATCH@QA-1` to keep Gemini productive during dependency blocks
- decision: Track a dedicated QA watcher task under gate `QA-1` for dependency-unblock monitoring, blocker triage, and immediate E2E pickup when prerequisites merge.
- rationale: Prevent idle agent time and keep continuous QA feedback while feature dependencies are unmerged.
- alternatives rejected: Passive wait-only mode for Gemini; this delays blocker visibility and slows handoff timing.
- files: docs/roadmap.md, docs/sprints-task-dashboard.md, monitoring/cacheflow_task_state.yaml, monitoring/cacheflow_metrics.yaml
- commit: pending
- agent: codex

## 2026-03-03 — Use remotes-backed connections + remoteId hydration for QA-seeded accounts
- decision: Treat `/api/remotes` as canonical source for frontend connections, hydrate `tokenManager` entries with `remoteId`, and proxy provider requests with bearer auth against `/api/remotes/:id/proxy`.
- rationale: QA seeded accounts are stored in `user_remotes`; relying on `/api/tokens` and local token-only state left providers visible but file operations failing with empty views or `SESSION_EXPIRED`.
- alternatives rejected: Keep `/api/tokens`-based connection mapping; keep Next cookie-refresh proxy as primary path for seeded remotes.
- files: web/app/api/connections/route.ts, web/components/UnifiedFileBrowser.tsx, web/lib/apiClient.ts, web/lib/providers/StorageProvider.ts
- commit: pending
- agent: codex

## 2026-03-03 — Integrate March gap-analysis controls into roadmap baseline
- decision: Add task `0.9` (stateful deployment guard) and task `0.4a` (ErrorCode→UI action contract) as canonical roadmap tasks, and amend `2.6`, `2.7`, `4.7`, `4.10`, and `5.7` with CSP, proxy, 2FA-scope, and naming/disclaimer requirements.
- rationale: These gaps carry operational/security/legal risk if left implicit; codifying them in roadmap + sprint board + generated task state prevents drift across agents.
- alternatives rejected: Keep requirements only in ad-hoc prompt text; this would not propagate into monitoring/task-state or dispatch artifacts.
- files: docs/roadmap.md, docs/sprints-task-dashboard.md, monitoring/cacheflow_task_state.yaml, monitoring/cacheflow_metrics.yaml, monitoring/cacheflow_sprint_tasks.yaml, monitoring/task_history.yaml
- commit: pending
- agent: codex

## 2026-03-03 — Keep TOTP secret server-side during setup response
- decision: `/api/auth/2fa/setup` sets `totpSecret` in an `httpOnly` cookie and returns only QR + backup codes (no raw secret in JSON).
- rationale: `withSecurityScan` rejects secret leakage in API payloads, which otherwise hard-fails setup and blocks 2FA UI flows.
- alternatives rejected: Returning raw secret to client; bypassing security scan.
- files: web/app/api/auth/2fa/setup/route.ts, web/components/settings/TwoFAPanel.tsx
- commit: pending
- agent: codex

## 2026-03-03 — Keep web API routes isolated from worker runtime modules
- decision: `/web/app/api/transfers` and `/web/app/api/rate-limits` now import queue adapters from `web/lib/transfer/*` rather than `../worker/queues/*`.
- rationale: The web container builds from `../web` context only, so cross-context imports into `worker/` cause module resolution failures and pull in unavailable worker-only dependencies.
- alternatives rejected: Keeping worker imports with corrected relative paths; adding worker queue dependencies to web/root build graph.
- files: web/app/api/transfers/route.ts, web/app/api/rate-limits/route.ts, web/lib/transfer/jobQueue.ts, web/lib/transfer/rateLimitQueue.ts
- commit: pending
- agent: codex

## 2026-03-03 — Worker completion protocol enforced via hook + finish script
- decision: Enforce Codex-owned dashboard/metrics files with a repo pre-commit hook for non-Codex agents, and standardize worker completion on `scripts/finish_task.sh`.
- rationale: Agents were applying completion steps inconsistently (commit/push/release/metrics updates), creating lock/status drift and duplicate dashboard edits.
- alternatives rejected: Prompt-only instructions without local guardrails; letting each agent update monitoring files directly.
- files: .githooks/pre-commit, scripts/finish_task.sh, scripts/start_sprint.sh, scripts/sync_status_running_sprint.py, scripts/agent-prompts/*
- commit: pending
- agent: codex

## 2026-03-03 — Add `done-task` shortcut as canonical worker finish entrypoint
- decision: Provide `done-task`/`dt` wrapper for worker completion, with optional task auto-detection from active lock metadata.
- rationale: `finish_task.sh` is reliable but still verbose; reducing it to one command increases protocol compliance without relaxing safeguards.
- alternatives rejected: Keep only `finish_task.sh` and rely on manual task-key entry every time.
- files: scripts/done_task.sh, scripts/start_sprint.sh, scripts/sync_status_running_sprint.py, scripts/agent-prompts/*, docs/prompts/sprint-6-startup-all-agents.md
- commit: pending
- agent: codex

## 2026-03-03 — Introduce file-based sprint orchestrator state machine
- decision: Add a TypeScript orchestrator (`scripts/orchestrate.ts`) driven by `docs/orchestration/task-manifest.json`, with resumable state in `logs/orchestrator-state.json` and append-only audit in `logs/codex-audit.jsonl`.
- rationale: Multi-agent execution needs deterministic sequencing, contract gates, and restart-safe progress tracking without relying on database state.
- alternatives rejected: In-memory orchestration only; ad-hoc shell orchestration without persisted state transitions.
- files: docs/orchestration/task-manifest.json, scripts/orchestrate.ts, scripts/lib/buildAgentPrompt.ts, scripts/recover.ts, .github/workflows/orchestrate.yml
- commit: pending
- agent: codex

## 2026-03-04 — Drive dashboard metrics from orchestrator state transitions
- decision: Trigger `scripts/refresh_cacheflow_metrics.sh` directly from `scripts/orchestrate.ts` on task/gate state transitions, with in-process throttling and failure notifications.
- rationale: Manual dashboard refreshes lag live execution and can report stale completion/running counts during active waves.
- alternatives rejected: Cron-only refresh loop; requiring human-triggered metric sync after each state change.
- files: scripts/orchestrate.ts
- commit: pending
- agent: codex

## 2026-03-05 — Add Sprint 0–5 module audit dataset + dedicated Grafana dashboard
- decision: Generate `monitoring/cacheflow_module_audit.yaml/.csv` from manifest + orchestrator state + task history + git metadata, publish `cacheflow_module_audit_*` Prometheus metrics, and maintain a dedicated dashboard `cacheflow-module-audit`.
- rationale: Sprint readiness needed per-module evidence (completeness checks, done/last-change/commit timestamps, local/git file locations, commit owner, worker owner) instead of aggregate-only sprint progress.
- alternatives rejected: Reusing only `cacheflow_task_status` labels; this lacked file-location and commit-lineage details required for module-level audit.
- files: scripts/generate_module_audit.py, scripts/push_cacheflow_metrics.py, scripts/refresh_cacheflow_metrics.sh, monitoring/grafana-cacheflow-module-audit.json
- commit: pending
- agent: codex

## 2026-03-05 — Treat Next.js dynamic route folders as literals in module-audit path checks
- decision: Update `scripts/generate_module_audit.py` path resolution to treat `[id]`/`[uuid]` folders as literal path segments, not glob classes, and prefer `web/` candidates first for frontend agents.
- rationale: Module audit incorrectly marked completed tasks as partial because dynamic-route paths (`/app/.../[id]/...`) failed glob resolution and frontend paths were resolved against root duplicates.
- alternatives rejected: Marking tasks pending/resetting status for false partials; relaxing file checks globally.
- files: scripts/generate_module_audit.py, docs/orchestration/task-manifest.json
- commit: pending
- agent: codex

- 2026-03-04T20:14:10Z mcp-cache-server: namespace resolution order is argument -> tags(repo/branch for set) -> MCP headers -> DEFAULT_NAMESPACE; cache_get uses semantic top-k=5 within namespace.

## 2026-03-05 — Add files-route schema compatibility for legacy databases
- decision: `api/src/routes/files.js` now detects optional `files` columns (`error_reason`, `retry_count`, `immutable_until`, `updated_at`) via `information_schema` and dynamically shapes SELECT/UPDATE queries.
- rationale: Production DB reset removed newer columns, causing `/files` hard 500 errors and broken file listing/deletion/retry flows.
- alternatives rejected: Immediate destructive DB migration in production without staged validation; leaving route strict and failing on old schemas.
- files: api/src/routes/files.js
- commit: pending
- agent: codex

## 2026-03-05 — Default Playwright/gate traffic to existing CacheFlow server with API signature probe
- decision: Default Playwright `baseURL` to `http://127.0.0.1:3010`, run dev webServer only when explicitly enabled, and make orchestrator pick gate base URL only when `GET /api/connections` returns JSON with auth-ish status.
- rationale: Generic "any HTTP response" probing selected unrelated services on port 3000, causing false gate failures and wasted test load.
- alternatives rejected: Keeping `4020`/`3000` heuristic ordering without API signature validation; always spawning a fresh Next dev server during gate runs.
- files: web/playwright.config.ts, scripts/orchestrate.ts, web/next.config.js
- commit: pending
- agent: codex

## 2026-03-05 — Stabilize live QA/chaos path with same-origin proxy + targeted API rewrites
- decision: Remove blanket `'/api/:path*'` rewrite in `web/next.config.js`, keep only explicit legacy rewrites (`/api/files`, `/api/tokens`, etc.), and force provider proxy calls through same-origin `/api/remotes/:uuid/proxy`.
- rationale: Broad API rewrite intercepted local dynamic route handlers, bypassed security/refresh logic, and caused repeated `ECONNREFUSED` and empty file table states.
- alternatives rejected: Keeping broad rewrite with route-level workarounds; direct cross-origin provider proxy calls from browser.
- files: web/next.config.js, web/lib/providers/StorageProvider.ts, web/app/api/remotes/[uuid]/proxy/route.ts
- commit: pending
- agent: codex

## 2026-03-05 — Seed QA remotes for admin/test users, not only legacy sup@goels.in
- decision: Extend startup QA seed to target configured admin/test emails (`CACHEFLOW_QA_ADMIN_EMAILS`, `ADMIN_EMAIL`, `CACHEFLOW_TEST_USER_EMAIL`, optional `QA_SEED_EMAILS`) with idempotent upserts.
- rationale: Chaos/gate verification used `admin@cacheflow.goels.in`; seeding only `sup@goels.in` left admin with zero connections and no actionable file operations.
- alternatives rejected: Manual one-off DB seeding each run; chaos scripts that assume remotes already exist.
- files: api/src/services/qaSeed.js
- commit: pending
- agent: codex

## 2026-03-05 — Transfer auth + remotes health hardening for live chaos stability
- decision: Resolve transfer user identity via `resolveAccessToken` + verified JWT decode fallback to backend `/auth/me`, and add local `GET /api/remotes/[uuid]/health` proxy route.
- rationale: Transfer polling was returning false 401s for valid backend-issued access tokens, and sidebar health checks spammed 404 due missing Next route.
- alternatives rejected: Keeping `jsonwebtoken.verify` with local secret only; relying on client-side suppression of failed health checks.
- files: web/app/api/transfers/route.ts, web/app/api/transfers/chunk/route.ts, web/app/api/remotes/[uuid]/health/route.ts
- commit: pending
- agent: codex

## 2026-03-05 — Unify Integrations entrypoint on server-state Connections route
- decision: Route `/remotes` to `/connections` and rely on `/api/connections` as the single source of truth for integrations rendering.
- rationale: Legacy remotes flow depended on localStorage token + deprecated APIs, producing infinite loading and split-brain behavior versus sidebar state.
- alternatives rejected: Patching legacy `RemotesPanel` API calls in-place while keeping duplicate data sources active.
- files: web/app/remotes/page.tsx, web/app/connections/page.tsx
- commit: pending
- agent: codex

## 2026-03-05 — Consolidate file action toasts into a keyed single stream
- decision: Add keyed task banners (`key: 'file-action'`) so Opening/Downloading/Rename/Delete operations replace each other instead of stacking.
- rationale: Chaos run showed stale "Opening" toasts persisting and stacking with subsequent actions.
- alternatives rejected: Keeping per-action independent toasts and trying to manually dismiss each call site.
- files: web/components/ActionCenterProvider.tsx, web/components/UnifiedFileBrowser.tsx
- commit: pending
- agent: codex

## 2026-03-05 — Invalidate file-browser state on transfer completion
- decision: On cross-provider copy/move completion, invalidate metadata cache for both source and target accounts and broadcast a browser `cacheflow:transfer-complete` event so the Files view refreshes immediately.
- rationale: Queue completion alone left grouped file lists and preview state stale, causing successful transfers to look like failures and leaving follow-up actions bound to the wrong file context.
- alternatives rejected: Poll transfer queue only; refresh only the queue panel; rely on manual user refresh.
- files: web/components/TransferQueueProvider.tsx, web/components/UnifiedFileBrowser.tsx
- commit: pending
- agent: codex

## 2026-03-06 — Keep web runtime self-contained inside `web/`
- decision: Any Next.js route or helper used by the `web` build must import from `web/lib/**` or local app files only; legacy references to root-level `lib/**` are not allowed in deployable web code.
- rationale: Clean deploys reset untracked files, and the web Docker build context does not include ad-hoc root helpers that were never committed under `web/`.
- alternatives rejected: Relying on dirty live repos with extra helper files; importing root runtime modules from web-only builds.
- files: web/app/api/remotes/[uuid]/upload/route.ts, web/app/api/jobs/route.ts, web/app/api/vault/[id]/unlock/route.ts, web/lib/jobs/scheduledJobService.ts, web/lib/providers/healthCheck.ts, web/lib/vault/vaultSession.ts
- commit: pending
- agent: codex

## 2026-03-06 — Web session route must fall back to backend auth when local JWT verification is unavailable
- decision: `/web/app/api/auth/session` first verifies locally when `JWT_SECRET` is present, otherwise it validates the access token against backend `/auth/me` and only uses `userData` cookie as a last-resort compatibility fallback.
- rationale: The web container does not always carry the backend JWT signing secret in production-like deployments, but session checks still need to confirm authenticated state after login.
- alternatives rejected: Hard-failing session checks when `JWT_SECRET` is absent; returning the raw access token to the browser for client-side verification.
- files: web/app/api/auth/session/route.ts
- commit: pending
- agent: codex

## 2026-03-06 — Files view must not synthesize a `local` provider from the auth session token
- decision: `UnifiedFileBrowser` now uses only server-backed provider connections and explicitly removes stale `local` provider tokens from `tokenManager` when hydrating the Files view.
- rationale: Treating the app auth token as a `local` storage provider created a ghost fifth account, surfaced stale local rows ahead of real remotes, and routed file actions through `/api/files/download` with invalid non-UUID IDs.
- alternatives rejected: Leaving the synthetic `local` provider in place and masking server errors; adding more fallback behavior to `/api/files/download` for malformed remote IDs.
- files: web/components/UnifiedFileBrowser.tsx
- commit: pending
- agent: codex
