# Code Patterns

## [pattern name]
- use when:
- example:
- do not deviate because:

## Sprint Task Key (`id@gate`)
- use when: Referencing any roadmap task in locks, metrics scripts, dashboard updates, or commit notes.
- example: `scripts/update_cacheflow_metrics.py --complete 1.11@MODAL-1`
- do not deviate because: plain numeric IDs are not globally unique across gates and will corrupt state/history.

## Worker Task Completion (`finish_task.sh`)
- use when: Any non-Codex agent completes a claimed task and needs to finish consistently.
- example: `./scripts/finish_task.sh 0.2@TRANSFER-1 --test "npm run test -- transfer" --commit "feat(transfer): add error taxonomy"`
- do not deviate because: ad-hoc completion (manual commit/push/release + direct metrics edits) causes lock leaks and inconsistent status tracking.

## Fast Finish Shortcut (`done-task`)
- use when: Agent completed implementation and wants one finish command after staging files.
- example: `done-task --test "npm run test -- transfer" --commit "feat(transfer): add retries"` (auto-detects lock when unique).
- do not deviate because: removes inconsistent manual handoff steps while still enforcing hook/commit/push/release order.

## Orchestrator Prompt Contract
- use when: Dispatching work to OpenCode/ClaudeCode/Gemini/Codex from the master orchestrator.
- example: `buildAgentPrompt(task)` in `scripts/lib/buildAgentPrompt.ts` with the fixed five sections (ROLE, ACCEPTANCE CRITERIA, TARGET FILES, CONTRACT OBLIGATION, FORBIDDEN SIDE EFFECTS).
- do not deviate because: consistent scoped prompts are required for deterministic agent behavior and contract-gated handoffs.

## Module Audit Pipeline (Sprint 0-5)
- use when: Needing module-level completion evidence (task completeness, file existence, contract presence, done/last-change/commit timestamps, ownership).
- example: `python3 scripts/generate_module_audit.py && ./scripts/refresh_cacheflow_metrics.sh` then query `cacheflow_module_audit_score`.
- do not deviate because: ad-hoc manual checks miss stale/missing module files and do not provide consistent Grafana-ready lineage columns.

## Dynamic Route Path Checking in Audit
- use when: A manifest `files` entry includes Next.js folder segments like `[id]`, `[uuid]`, `[linkId]`, especially with `**` globs.
- example: Resolve `/app/api/remotes/[uuid]/**/route.ts` by escaping bracket segments to literal before glob matching.
- do not deviate because: treating `[]` as glob classes causes false "missing files" and incorrect partial module reports.

- 2026-03-04T20:14:10Z agent-coord: run cache invalidation hooks on task-claim (invalidate codebase-context on HEAD change; invalidate system-prompt on AGENTS/CORE checksum change).

## Files Route Legacy Column Guard
- use when: Backend route touches optional `files` columns that may not exist in older DB snapshots (`error_reason`, `retry_count`, `immutable_until`, `updated_at`).
- example: Query `information_schema.columns` once, then build SQL expressions with fallbacks like `NULL::text AS error_reason` and `0::int AS retry_count`.
- do not deviate because: direct references to missing columns hard-fail requests and block core file operations.

## Playwright Existing-Server Default
- use when: Running E2E or sprint gates on long-lived environments with app already running in Docker.
- example: default `baseURL=http://127.0.0.1:3010`, only enable `webServer` when `PLAYWRIGHT_USE_DEV_SERVER=1`, and validate base URL via `/api/connections` JSON probe.
- do not deviate because: auto-starting Next dev for every run increases CPU/memory churn, and non-specific port probes can target unrelated services.

## Local API Route Priority over Rewrites
- use when: Adding or maintaining `web/app/api/**` route handlers that proxy/auth-transform backend calls.
- example: keep only explicit legacy rewrites in `next.config.js` (e.g. `/api/files/:path*`) and never use blanket `/api/:path*`.
- do not deviate because: blanket rewrites can intercept dynamic local routes (like `/api/remotes/[uuid]/proxy`) and silently bypass local auth/sanitization logic.

## Chaos Preflight Contract
- use when: Running live chaos checks against `cacheflow.goels.in`.
- example: run `scripts/chaos/preflight_live.sh` first and require `login=true` + `connections>=1` before UI actions.
- do not deviate because: action-level failures become ambiguous when auth/session/seed prerequisites are not established upfront.

## Auth-gated Transfer Polling
- use when: Mounting global transfer context across authenticated and public routes.
- example: verify `/api/auth/session` first, skip `/api/transfers` polling on `/login` and other public auth routes.
- do not deviate because: pre-auth polling creates recurring 401 noise and unnecessary backend load.

## Stable Upload Trigger in Unified File Browser
- use when: Running UI automation and live chaos actions against Files view.
- example: expose `data-testid="cf-action-upload"` with hidden input and provider-targeted upload handler in `UnifiedFileBrowser`.
- do not deviate because: action-level tests need deterministic upload entrypoint and cache invalidation to verify downstream file operations.

## Keyed File-Action Toast Stream
- use when: Triggering file action status banners (open/download/upload/delete/rename/move/copy).
- example: `actions.startTask({ key: 'file-action', title: 'Opening', message: file.name })`.
- do not deviate because: multiple concurrent file-action banners stack and leave stale status messages visible after UI state has already changed.

## File Metadata Normalization at UI Boundary
- use when: Merging provider responses into shared file table/preview components.
- example: map every file through a normalization helper ensuring `id,name,path,pathDisplay,mimeType,isFolder,modifiedTime` are always present before storing in UI state.
- do not deviate because: partial provider payloads or optimistic updates can render blank name cells and break downstream actions that require stable file identity fields.

## Transfer Completion UI Refresh
- use when: A transfer/copy/move action changes file placement across providers or accounts.
- example: Invalidate source and target metadata caches, emit `cacheflow:transfer-complete`, and have the Files view clear stale preview/selection before refetch.
- do not deviate because: queue success without file-list invalidation leaves the UI out of sync with provider state and breaks follow-up actions like delete.

## Server-Backed Files Provider List Only
- use when: Hydrating `UnifiedFileBrowser` or other live multi-provider views from `/api/connections`.
- example: Build visible provider accounts from server connections + remoteId hydration only; do not create a `local` provider entry from the app auth cookie/token.
- do not deviate because: synthetic local-provider entries can surface stale local files in the live table and route actions through the wrong backend contract.
