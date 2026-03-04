# Total Roadmap Overview
Each sprint below will track task progress, commits, and changelog entries as work proceeds.

## Sprint 0
- Progress: `[██████████] 100%` (18 / 18 completed)
- Total commits: `1` (update after commit + update script)
- Gate criteria: `/docs/architecture/deployment-constraints.md` + `/scripts/check-deployment-target.sh` must exist and pass before Sprint 0 gate pass.
- Current tasks:

| Task ID | Task Description (Gate) | Assigned Agent | Status | Commit # | Done At | Changelog |
| --- | --- | --- | --- | --- | --- | --- |
| 0.1 | Define and commit ProviderAdapter interface — all adapters implement this (Gate AUTH-1) | ★ CODEX (Master) | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |
| 0.2 | Define AppError taxonomy and ErrorCode enum (Gate AUTH-1) | ◈ OpenCode | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |
| 0.4a | ErrorCode → UI action contract doc; map all ErrorCode enums to deterministic UI behavior and default toast fallback (Gate AUTH-1) | ◆ ClaudeCode | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |
| 0.3 | Define complete Prisma schema baseline — all tables, all relationships (Gate AUTH-2) | ◈ OpenCode | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |
| 0.6 | Define singleton refresh promise pattern — prevent concurrent token refresh race (Gate AUTH-4) | ◈ OpenCode | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |
| 0.1 | Define and commit ProviderAdapter interface — all adapters implement this (Gate TRANSFER-1) | ★ CODEX (Master) | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |
| 0.2 | Define AppError taxonomy and ErrorCode enum (Gate TRANSFER-1) | ◈ OpenCode | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |
| 0.3 | Define complete Prisma schema baseline — all tables, all relationships (Gate TRANSFER-1) | ◈ OpenCode | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |
| 0.4 | Allocate Redis namespaces — document and enforce db separation (Gate TRANSFER-1) | ◈ OpenCode | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |
| 0.4a | ErrorCode → UI action contract doc; map all ErrorCode enums to deterministic UI behavior and default toast fallback (Gate TRANSFER-1) | ◆ ClaudeCode | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |
| 0.5 | Define streaming pipeline pattern — pipeline() + backpressure strategy (Gate TRANSFER-1) | ◈ OpenCode | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |
| 0.9 | Stateful deployment guard — enforce long-running runtime targets and block serverless/edge deployment configs in CI (Gate TRANSFER-1) | ★ CODEX (Master) | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |
| 0.1 | Define and commit ProviderAdapter interface — all adapters implement this (Gate ZERODISK-1) | ★ CODEX (Master) | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |
| 0.5 | Define streaming pipeline pattern — pipeline() + backpressure strategy (Gate ZERODISK-1) | ◈ OpenCode | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |
| 0.4 | Allocate Redis namespaces — document and enforce db separation (Gate SSE-1) | ◈ OpenCode | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |
| 0.7 | Define BullMQ → SSE bridge via Redis pub/sub (Gate SSE-1) | ◈ OpenCode | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |
| 0.9 | Stateful deployment guard — enforce long-running runtime targets and block serverless/edge deployment configs in CI (Gate SSE-1) | ★ CODEX (Master) | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |
| 0.3 | Define complete Prisma schema baseline — all tables, all relationships (Gate VAULT-1) | ◈ OpenCode | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |

## Sprint 1
- Progress: `[██████████] 100%` (22 / 22 completed)
- Total commits: `1` (update after commit + update script)
- Current tasks:

| Task ID | Task Description (Gate) | Assigned Agent | Status | Commit # | Done At | Changelog |
| --- | --- | --- | --- | --- | --- | --- |
| 1.1 | Create global HTTP interceptor for all /api/remotes proxy calls (Gate AUTH-1) | ◈ OpenCode | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |
| 1.5 | Multi-account schema — up to 3 accounts per provider (Gate AUTH-1) | ◈ OpenCode | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |
| 1.7 | Write Playwright token expiry test (Gate AUTH-1) | ◉ Gemini | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |
| 1.17 | Replace SESSION_EXPIRED raw text with actionable component (Gate AUTH-1) | ◆ ClaudeCode | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |
| 1.2 | Implement silent token refresh endpoint (Gate AUTH-2) | ◈ OpenCode | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |
| 1.4 | Token Vault v1 — encrypted at-rest provider credentials (Gate AUTH-2) | ◈ OpenCode | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |
| 1.18 | Security baseline — remove defaults, harden secrets (Gate AUTH-2) | ◈ OpenCode | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |
| 1.19 | Security audit test — verify no secrets in API responses (Gate AUTH-2) | ◉ Gemini | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |
| 1.3 | Migrate from localStorage TokenManager to HttpOnly cookies (Gate AUTH-3) | ◈ OpenCode | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |
| 1.6 | Remove client-side token sync pattern entirely (Gate AUTH-3) | ◆ ClaudeCode | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |
| 1.1 | Create global HTTP interceptor for all /api/remotes proxy calls (Gate AUTH-4) | ◈ OpenCode | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |
| 1.8 | Replace shared modal boolean with provider discriminator enum (Gate MODAL-1) | ◆ ClaudeCode | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |
| 1.9 | Implement correct forms for WebDAV and VPS/SFTP modals (Gate MODAL-1) | ◆ ClaudeCode | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |
| 1.10 | Clear modal state on close and provider switch (Gate MODAL-1) | ◆ ClaudeCode | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |
| 1.11 | Write Playwright modal test — all 9 provider Connect buttons (Gate MODAL-1) | ◉ Gemini | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |
| 1.12 | Audit upload pipeline — locate all UUID injection points (Gate UUID-1) | ★ CODEX (Master) | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |
| 1.13 | Fix upload pipeline to preserve original File.name (Gate UUID-1) | ◈ OpenCode | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |
| 1.14 | Write and run migration script in staging (Gate UUID-1) | ◈ OpenCode | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |
| 1.15 | Validate and apply migration to production (Gate UUID-1) | ★ CODEX (Master) | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |
| 1.16 | Connections page and sidebar read from single server state store (Gate SYNC-1) | ◈ OpenCode | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |
| 1.4 | Token Vault v1 — encrypted at-rest provider credentials (Gate SEC-1) | ◈ OpenCode | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |
| 1.18 | Security baseline — remove defaults, harden secrets (Gate SEC-1) | ◈ OpenCode | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |

## Sprint 2
- Progress: `[██████████] 100%` (25 / 25 completed)
- Total commits: `1` (update after commit + update script)
- Gate criteria: preview flow must show zero CSP console errors and all unsupported-file downloads must be server-proxied (never raw provider URL).
- Current tasks:

| Task ID | Task Description (Gate) | Assigned Agent | Status | Commit # | Done At | Changelog |
| --- | --- | --- | --- | --- | --- | --- |
| 2.1 | Add persistent Upload / New Folder / Refresh action bar (Gate UPLOAD-1) | ◆ ClaudeCode | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |
| 2.2 | Implement file upload with progress and toast (Gate UPLOAD-1) | ◈ OpenCode | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |
| 2.5 | Write E2E tests for all file action entry points (Gate UPLOAD-1) | ◉ Gemini | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |
| 2.6 | Fix preview panel mount — "Opening" toast must open a panel; enforce CSP for image/PDF/text previews with Playwright zero-CSP-error verification (Gate PREVIEW-1) | ◆ ClaudeCode | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |
| 2.7 | Unsupported file types: immediate Download CTA via server-proxied /api/remotes/{uuid}/download/{fileId}; never expose raw provider URLs (Gate PREVIEW-1) | ◆ ClaudeCode | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |
| 2.8 | E2E preview tests — supported and unsupported types (Gate PREVIEW-1) | ◉ Gemini | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |
| 2.3 | File table: single click select + right panel, double click open (Gate ACTIONS-1) | ◆ ClaudeCode | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |
| 2.4 | Three-dot row menu + right-click context menu (identical) (Gate ACTIONS-1) | ◆ ClaudeCode | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |
| 2.5 | Write E2E tests for all file action entry points (Gate ACTIONS-1) | ◉ Gemini | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |
| 2.9 | Merge Cloud Drives / Providers / Integrations → Connections (Gate NAV-1) | ◆ ClaudeCode | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |
| 2.10 | File table visual polish — skeleton loaders, hover, separators (Gate RESP-1) | ◆ ClaudeCode | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |
| 2.11 | Sidebar collapsible accordion per provider group (Gate RESP-1) | ◆ ClaudeCode | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |
| 2.12 | Responsive layout pass — 375px viewport minimum (Gate RESP-1) | ◆ ClaudeCode | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |
| UI-P1-T01 | Fix Cloud Drives page empty or unclear connected state (Gate HOLD-UI-2026-03-02) | ◆ ClaudeCode | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |
| UI-P1-T02 | Fix 401 proxy failures for connected remotes (Gate HOLD-UI-2026-03-02) | ◈ OpenCode | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |
| UI-P1-T03 | Fix preview panel open reliability from file rows and overflow Open (Gate HOLD-UI-2026-03-02) | ◆ ClaudeCode | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |
| UI-P1-T04 | Restore file actions path (rename/move/download/delete) for connected drives (Gate HOLD-UI-2026-03-02) | ◈ OpenCode | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |
| UI-P1-T05 | Add explicit UI error surfaces for failed sync/proxy/favorites requests (Gate HOLD-UI-2026-03-02) | ◈ OpenCode | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |
| UI-P1-T06 | Add clear loading, empty, and error state cards in file pane (Gate HOLD-UI-2026-03-02) | ◆ ClaudeCode | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |
| 2.13 | TOTP setup flow — QR generation, verification, backup codes (Gate 2FA-1) | ◈ OpenCode | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |
| 2.14 | TOTP login challenge UI (Gate 2FA-1) | ◆ ClaudeCode | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |
| 2.15 | Settings: manage 2FA, backup codes, last-used timestamp (Gate 2FA-1) | ◆ ClaudeCode | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |
| 2.16 | E2E 2FA tests — full enable/use/disable cycle (Gate 2FA-1) | ◉ Gemini | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |
| OPS-E2E-READY | Playwright preflight wait-for-api on 127.0.0.1:8100 (Gate QA-1) | ◈ OpenCode | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |
| OPS-QA-WATCH | QA watcher loop for dependency unlock detection, blocker triage, and auto-claim on readiness (Gate QA-1) | ◉ Gemini | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |

## Sprint 3
- Progress: `[██████████] 100%` (17 / 17 completed)
- Total commits: `1` (update after commit + update script)
- Gate criteria: `/docs/decisions/share-link-2fa-scope.md` must be committed and reflected in task 4.7 + 4.10 behavior before Sprint 3 gate pass.
- Current tasks:

| Task ID | Task Description (Gate) | Assigned Agent | Status | Commit # | Done At | Changelog |
| --- | --- | --- | --- | --- | --- | --- |
| 3.14 | Provider health indicators — green means it actually works (Gate SYNC-1) | ◈ OpenCode | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |
| 3.16 | Dashboard + health E2E tests (Gate SYNC-1) | ◉ Gemini | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |
| 3.1 | Persistent Transfer Manager Tray — always visible when active (Gate TRANSFER-1) | ◆ ClaudeCode | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |
| 3.3 | Every file operation produces tray entry + toast (Gate TRANSFER-1) | ◈ OpenCode | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |
| 3.4 | Tray E2E — entry survives navigation, retry works on failure (Gate TRANSFER-1) | ◉ Gemini | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |
| 3.5 | Chunked upload: files >50MB use provider resumable upload APIs (Gate TRANSFER-1) | ◈ OpenCode | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |
| 3.6 | Auto-resume: resume interrupted upload from last successful chunk (Gate TRANSFER-1) | ◈ OpenCode | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |
| 3.7 | Tray: chunk-level progress for large files (Gate TRANSFER-1) | ◆ ClaudeCode | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |
| 3.8 | Auto-resume E2E test — network drop mid-transfer ⚠️ Human verify (Gate TRANSFER-1) | ◉ Gemini | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |
| 3.10 | BullMQ background job queue for async transfers (Gate TRANSFER-1) | ◈ OpenCode | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |
| 3.11 | Conflict resolution modal — shared component used everywhere (Gate TRANSFER-1) | ◆ ClaudeCode | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |
| 3.15 | Rate limit handling layer — per-provider request queue (Gate TRANSFER-1) | ◈ OpenCode | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |
| 3.9 | Server streams source → CacheFlow → target without disk write (Gate ZERODISK-1) | ◈ OpenCode | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |
| 3.12 | Zero-disk verification test + tab-close survival test ⚠️ Human verify (Gate ZERODISK-1) | ◉ Gemini | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |
| 3.2 | Server-Sent Events (SSE) for real-time transfer progress (Gate SSE-1) | ◈ OpenCode | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |
| 3.10 | BullMQ background job queue for async transfers (Gate SSE-1) | ◈ OpenCode | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |
| 3.13 | Storage pooling dashboard — promote aggregate to hero position (Gate SCHED-1) | ◆ ClaudeCode | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |

## Sprint 4
- Progress: `[██████████] 100%` (17 / 17 completed)
- Total commits: `1` (update after commit + update script)
- Current tasks:

| Task ID | Task Description (Gate) | Assigned Agent | Status | Commit # | Done At | Changelog |
| --- | --- | --- | --- | --- | --- | --- |
| 4.1 | Define provider parity checklist — every provider must pass all 5 (Gate AUTH-1) | ★ CODEX (Master) | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |
| 4.2 | Add 2–3 additional providers to reach 3–4 gold-standard total (Gate AUTH-1) | ◈ OpenCode | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |
| 4.3 | E2E parity tests for each new provider (Gate AUTH-1) | ◉ Gemini | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |
| 4.7 | Share link creation — enforce 2FA scope selected in /docs/decisions/share-link-2fa-scope.md (all links vs password-only) (Gate 2FA-1) | ◈ OpenCode | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |
| 4.10 | Share link UI — right-click → Get Share Link panel; 2FA prompt behavior must match /docs/decisions/share-link-2fa-scope.md (Gate 2FA-1) | ◆ ClaudeCode | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |
| 4.12 | Remote upload v1 — HTTP/HTTPS URL to chosen provider (Gate TRANSFER-1) | ◈ OpenCode | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |
| 4.13 | Smart auto-placement engine v1 (Gate TRANSFER-1) | ◈ OpenCode | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |
| 4.14 | Remote upload UI — dropdown in Upload action menu (Gate TRANSFER-1) | ◆ ClaudeCode | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |
| 4.15 | E2E remote upload + placement tests (Gate TRANSFER-1) | ◉ Gemini | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |
| 4.7 | Share link creation — enforce 2FA scope selected in /docs/decisions/share-link-2fa-scope.md (all links vs password-only) (Gate SHARE-1) | ◈ OpenCode | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |
| 4.8 | Share link proxy — hides underlying provider (Gate SHARE-1) | ◈ OpenCode | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |
| 4.9 | Abuse controls — rate limits, throttling, link access logging (Gate SHARE-1) | ◈ OpenCode | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |
| 4.10 | Share link UI — right-click → Get Share Link panel; 2FA prompt behavior must match /docs/decisions/share-link-2fa-scope.md (Gate SHARE-1) | ◆ ClaudeCode | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |
| 4.11 | E2E share link tests — create, access, expire, revoke (Gate SHARE-1) | ◉ Gemini | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |
| 4.4 | SSH2 connection manager with LRU session reuse (Gate SEC-1) | ◈ OpenCode | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |
| 4.5 | AES-256-GCM encrypted credential storage for VPS/WebDAV (Gate SEC-1) | ◈ OpenCode | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |
| 4.6 | VPS parity test + credential security test (Gate SEC-1) | ◉ Gemini | Done | bb46644 | 2026-03-04T21:27:38+00:00 | chore: sprint 4 task output — tracked file changes |

## Sprint 5
- Progress: `[░░░░░░░░░░] 0%` (0 / 13 completed)
- Total commits: `0` (update after commit + update script)
- Current tasks:

| Task ID | Task Description (Gate) | Assigned Agent | Status | Commit # | Done At | Changelog |
| --- | --- | --- | --- | --- | --- | --- |
| 5.5 | Vault data model and enable/disable API (Gate VAULT-1) | ◈ OpenCode | Planned | — | — | — |
| 5.6 | Vault access gate — TOTP or PIN required to unlock (Gate VAULT-1) | ◈ OpenCode | Planned | — | — | — |
| 5.7 | Vault UI — lock icon in sidebar, hidden from All Files; non-encryption disclaimer at setup, unlock modal, and folder header; user-facing name follows /docs/decisions/vault-naming-decision.md (Gate VAULT-1) | ◆ ClaudeCode | Planned | — | — | — |
| 5.8 | E2E vault tests — enable, lock, unlock, auto-lock (Gate VAULT-1) | ◉ Gemini | Planned | — | — | — |
| 5.1 | Scheduled job data model and Schedules management UI (Gate SCHED-1) | ◈ OpenCode | Planned | — | — | — |
| 5.2 | BullMQ cron worker — jobs run server-side, browser closed (Gate SCHED-1) | ◈ OpenCode | Planned | — | — | — |
| 5.3 | Schedules page UI — create, edit, pause, delete jobs (Gate SCHED-1) | ◆ ClaudeCode | Planned | — | — | — |
| 5.4 | E2E scheduled job test — runs with browser closed ⚠️ Human verify (Gate SCHED-1) | ◉ Gemini | Planned | — | — | — |
| 5.9 | Duplicate detection — filename + size cross-provider comparison (Gate SEARCH-1) | ◈ OpenCode | Planned | — | — | — |
| 5.10 | Stale file detection + cleanup UI (Gate SEARCH-1) | ◆ ClaudeCode | Planned | — | — | — |
| 5.11 | Global cross-provider search v1 — name/metadata, ephemeral cache (Gate SEARCH-1) | ◈ OpenCode | Planned | — | — | — |
| 5.12 | Search UI + performance test (Gate SEARCH-1) | ◆ ClaudeCode | Planned | — | — | — |
| 5.13 | E2E search + duplicate detection tests (Gate SEARCH-1) | ◉ Gemini | Planned | — | — | — |

## Sprint 6
- Progress: `[░░░░░░░░░░] 0%` (0 / 10 completed)
- Total commits: `0` (update after commit + update script)
- Current tasks:

| Task ID | Task Description (Gate) | Assigned Agent | Status | Commit # | Done At | Changelog |
| --- | --- | --- | --- | --- | --- | --- |
| 6.1 | PWA manifest + next-pwa service worker (app shell only) (Gate LAUNCH-1) | ◆ ClaudeCode | Planned | — | — | — |
| 6.2 | SEO landing page — storage calculator + provider grid (Gate LAUNCH-1) | ◆ ClaudeCode | Planned | — | — | — |
| 6.3 | PWA install + offline E2E tests (Gate LAUNCH-1) | ◉ Gemini | Planned | — | — | — |
| 6.4 | Billing and subscription tier model (Gate LAUNCH-1) | ◈ OpenCode | Planned | — | — | — |
| 6.5 | Tier enforcement — limits enforced reliably at API layer (Gate LAUNCH-1) | ◈ OpenCode | Planned | — | — | — |
| 6.6 | Affiliate storage calculator — only shown post-transfer-reliability (Gate LAUNCH-1) | ◆ ClaudeCode | Planned | — | — | — |
| 6.7 | Billing E2E — limits enforced, upgrade/downgrade safe (Gate LAUNCH-1) | ◉ Gemini | Planned | — | — | — |
| 6.8A | [OPTION A] Rich version history + unified trash — RECOMMENDED (Gate LAUNCH-1) | ◈ OpenCode | Planned | — | — | — |
| 6.8B | [OPTION B] Collabora Online (full Office editing) — HIGH INFRA COST (Gate LAUNCH-1) | ◈ OpenCode | Planned | — | — | — |
| 6.8C | [OPTION C] Magnet/torrent remote upload — REQUIRES ABUSE CONTROLS (Gate LAUNCH-1) | ◈ OpenCode | Planned | — | — | — |
