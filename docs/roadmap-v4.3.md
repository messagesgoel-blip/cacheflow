# CacheFlow Agent Execution Roadmap v4.3

## Final Acceptance Criteria

| ID | Description | Sprint | Status |
| --- | --- | --- | --- |
| --- | --- | --- | --- |
| AUTH-1 | Two auth runs 90 min apart — zero 401 loops, full file listings both times | 1 · 1.1–1.7 | ☐ OPEN |
| AUTH-2 | All tokens stored server-side; no accessToken/refreshToken in any client-visible API response | 1 · 1.2–1.4 | ☐ OPEN |
| AUTH-3 | HttpOnly cookies only; localStorage contains no token data | 1 · 1.3 | ☐ OPEN |
| AUTH-4 | Singleton refresh promise — concurrent 401s resolve to a single refresh, never multiple | 0 · 0.6 | ☐ OPEN |
| MODAL-1 | All 9 Connect buttons open correct modal with correct form (automated Playwright) | 1 · 1.11 | ☐ OPEN |
| UUID-1 | Zero UUID-named folders in any connected provider after clean run | 1 · 1.12–1.15 | ☐ OPEN |
| SYNC-1 | Connections page = Sidebar — identical on 10 consecutive loads | 1 · 1.16 | ☐ OPEN |
| UPLOAD-1 | File upload produces visible feedback (success + failure); list refreshes; zero silent outcomes | 2 · 2.2 | ☐ OPEN |
| PREVIEW-1 | Supported types open preview panel; unsupported show Download CTA; toast bottom-right only | 2 · 2.6–2.7 | ☐ OPEN |
| ACTIONS-1 | Right-click menu = three-dot menu exactly; multi-select toolbar on ≥2 selections only | 2 · 2.4 | ☐ OPEN |
| NAV-1 | Exactly 6 nav items; Connections is sole source of truth; no orphaned routes | 2 · 2.9 | ☐ OPEN |
| RESP-1 | All core views render at 375px — no horizontal scroll | 2 · 2.12 | ☐ OPEN |
| HOLD-UI-2026-03-02 | Phase 1 UI stabilization tasks block non-UI feature work until complete | 2 · UI-P1-T01-UI-P1-T06 | ☐ OPEN |
| QA-1 | E2E preflight validates API readiness and watcher-driven unblock flow for Playwright execution | 2 · OPS-E2E-READY, OPS-QA-WATCH | ☐ OPEN |
| 2FA-1 | 2FA enable/use/disable full cycle passes; backup codes work; share links blocked without 2FA | 2 · 2.13–2.16 | ☐ OPEN |
| TRANSFER-1 | 1GB transfer with mid-transfer network drop resumes from last chunk, not from 0 | 3 · 3.5–3.6 | ☐ OPEN |
| ZERODISK-1 | No file bytes written to server disk during cross-provider transfer (instrumented) | 3 · 3.9 | ☐ OPEN |
| SSE-1 | BullMQ worker progress reaches SSE client via Redis pub/sub — works across multiple Node instances | 0 · 0.7 | ☐ OPEN |
| SHARE-1 | Share link: create/access/expire/revoke all work; abuse controls enforced | 4 · 4.7–4.11 | ☐ OPEN |
| VAULT-1 | Vault hides content from All Files + Search; requires PIN; auto-locks; 2FA prerequisite enforced | 5 · 5.5–5.8 | ☐ OPEN |
| SCHED-1 | Scheduled job runs with browser closed; produces job history log | 5 · 5.1–5.4 | ☐ OPEN |
| SEARCH-1 | Cross-provider search returns results within 3s for ≤10k files; no persistent server-side index | 5 · 5.11 | ☐ OPEN |
| SEC-1 | VPS/WebDAV credentials never in API response after save; provider secrets never in browser | 4 · 4.5 | ☐ OPEN |
| LAUNCH-1 | Affiliate panel hidden from users with zero successful transfers §2  Master Orchestration Model How Codex Coordinates Sub-Agents Responsibility Description Tooling Codex breaks each sprint into atomic tasks, assigns to sub-agents, sets dependency order and concurrency rules. Codex CLI + task manifest Task Dispatch Codex sends scoped prompts with: (a) target files, (b) acceptance criteria, (c) forbidden side-effects, (d) rollback plan, (e) contract file to produce. Codex → sub-agent API Contract Enforcement Before dispatching any dependent task, Codex verifies the producer's contract file exists at /docs/contracts/{task-id}.md. No contract = no dispatch. File check + gate manifest Gate Enforcement Codex runs gate checklist after every sprint. Sub-agents cannot proceed to next sprint tasks without Codex gate-pass signal. Playwright + gate manifest Conflict Resolution When two sub-agents touch the same file, Codex mediates merge. No sub-agent merges unilaterally. Git + Codex review Rollback Authority Only Codex can trigger a rollback. It reverts to last green gate commit and re-dispatches affected tasks with updated failure context. Git tag per gate Audit Log Codex writes every task dispatch, contract check, result, and gate outcome to /logs/codex-audit.jsonl. Append-only JSONL Agent Scope Constraints Agent CAN touch CANNOT touch without Codex approval ★ CODEX (Master) All files (read). Task manifests. Gate verdicts. Merge decisions. Sprint 0 contracts. Production deploys. Secret rotation. Billing config. ◈ OpenCode /api/**, /lib/**, /prisma/**, /server/**, package.json (server deps) Frontend components. Auth cookie logic. Any client-visible API response shape change. ◆ ClaudeCode /app/**, /components/**, /styles/**, /hooks/**, /context/** API route implementations. Database schema. Token storage logic. ◉ Gemini /tests/**, /e2e/**, /scripts/**, /.github/workflows/** Production source files. Environment variables. Secrets. Inter-Agent Handoff Protocol When a task produces output consumed by another agent, a formal contract file must be created. This prevents agents from making assumptions about interfaces. Field Specification Producer Agent completing the task that generates an output consumed by another agent Contract file /docs/contracts/{task-id}.md — created by producer before marking task complete Required fields Endpoint URL or file path · Request/response shape · Error codes · Edge cases · Example payload Consumer rule Read contract before starting dependent task. If contract missing, block and ping Codex — do not infer Codex rule Verify contract file exists before dispatching any dependent task. Gate checks contract count matches expected Environment Matrix Env URL Database Gate to promote local localhost:3000 postgres:local — staging staging.cacheflow.io postgres:staging Codex gate-pass tag production cacheflow.io postgres:prod Codex gate-pass + human sign-off | Planning | ☐ OPEN |

## Gate AUTH-1

| ID | Description | Sprint | Files | Agent |
| --- | --- | --- | --- | --- |
| 0.1 | Define and commit ProviderAdapter interface — all adapters implement this | 0 | /lib/providers/ProviderAdapter.interface.ts, /lib/providers/types.ts | ★ CODEX (Master) |
| 0.2 | Define AppError taxonomy and ErrorCode enum | 0 | /lib/errors/AppError.ts, /lib/errors/ErrorCode.ts | ◈ OpenCode |
| 1.1 | Create global HTTP interceptor for all /api/remotes proxy calls | 1 | /lib/apiClient.ts, /lib/interceptors/authInterceptor.ts | ◈ OpenCode |
| 1.5 | Multi-account schema — up to 3 accounts per provider | 1 | /prisma/migrations/002_multi_account/, /lib/vault/tokenVault.ts | ◈ OpenCode |
| 1.7 | Write Playwright token expiry test | 1 | /e2e/tests/tokenExpiry.spec.ts | ◉ Gemini |
| 1.17 | Replace SESSION_EXPIRED raw text with actionable component | 1 | /components/SessionExpiredBanner.tsx, /components/Sidebar/AccountRow.tsx | ◆ ClaudeCode |
| 4.1 | Define provider parity checklist — every provider must pass all 5 | 4 | /docs/provider-parity.md, /lib/providers/ProviderAdapter.interface.ts | ★ CODEX (Master) |
| 4.2 | Add 2–3 additional providers to reach 3–4 gold-standard total | 4 | /lib/providers/box/**, /lib/providers/pcloud/**, /lib/providers/yandex/** | ◈ OpenCode |
| 4.3 | E2E parity tests for each new provider | 4 | /e2e/tests/providers/box.spec.ts, /e2e/tests/providers/pcloud.spec.ts | ◉ Gemini |

## Gate AUTH-2

| ID | Description | Sprint | Files | Agent |
| --- | --- | --- | --- | --- |
| 0.3 | Define complete Prisma schema baseline — all tables, all relationships | 0 | /prisma/schema.prisma, /docs/architecture/data-model.md | ◈ OpenCode |
| 1.2 | Implement silent token refresh endpoint | 1 | /app/api/auth/refresh/route.ts | ◈ OpenCode |
| 1.4 | Token Vault v1 — encrypted at-rest provider credentials | 1 | /lib/vault/tokenVault.ts, /prisma/migrations/001_token_vault/ | ◈ OpenCode |
| 1.18 | Security baseline — remove defaults, harden secrets | 1 | /lib/auth/**, /app/api/**/route.ts (audit), /middleware.ts | ◈ OpenCode |
| 1.19 | Security audit test — verify no secrets in API responses | 1 | /e2e/tests/securityAudit.spec.ts | ◉ Gemini |

## Gate AUTH-3

| ID | Description | Sprint | Files | Agent |
| --- | --- | --- | --- | --- |
| 1.3 | Migrate from localStorage TokenManager to HttpOnly cookies | 1 | /lib/tokenManager.ts (deprecated), /lib/auth/cookieAuth.ts (new) | ◈ OpenCode |
| 1.6 | Remove client-side token sync pattern entirely | 1 | /app/api/auth/sync-token/ (delete), /components/providers/** (audit) | ◆ ClaudeCode |

## Gate AUTH-4

| ID | Description | Sprint | Files | Agent |
| --- | --- | --- | --- | --- |
| 0.6 | Define singleton refresh promise pattern — prevent concurrent token refresh race | 0 | /lib/auth/refreshGuard.ts, /docs/architecture/auth-patterns.md, /tests/unit/refreshGuard.test.ts | ◈ OpenCode |
| 1.1 | Create global HTTP interceptor for all /api/remotes proxy calls | 1 | /lib/apiClient.ts, /lib/interceptors/authInterceptor.ts | ◈ OpenCode |

## Gate MODAL-1

| ID | Description | Sprint | Files | Agent |
| --- | --- | --- | --- | --- |
| 1.8 | Replace shared modal boolean with provider discriminator enum | 1 | /context/IntegrationContext.tsx, /components/modals/ConnectProviderModal.tsx | ◆ ClaudeCode |
| 1.9 | Implement correct forms for WebDAV and VPS/SFTP modals | 1 | /components/modals/WebDAVModal.tsx, /components/modals/VPSModal.tsx | ◆ ClaudeCode |
| 1.10 | Clear modal state on close and provider switch | 1 | /context/IntegrationContext.tsx, /components/modals/ConnectProviderModal.tsx | ◆ ClaudeCode |
| 1.11 | Write Playwright modal test — all 9 provider Connect buttons | 1 | /e2e/tests/providerModals.spec.ts | ◉ Gemini |

## Gate UUID-1

| ID | Description | Sprint | Files | Agent |
| --- | --- | --- | --- | --- |
| 1.12 | Audit upload pipeline — locate all UUID injection points | 1 | /api/remotes/**, /lib/providers/**, /lib/uploads/** | ★ CODEX (Master) |
| 1.13 | Fix upload pipeline to preserve original File.name | 1 | /lib/providers/googleDrive.ts, /lib/providers/onedrive.ts, /lib/providers/dropbox.ts, /lib/uploads/uploadManager.ts | ◈ OpenCode |
| 1.14 | Write and run migration script in staging | 1 | /scripts/migrate-files-no-uuid.js | ◈ OpenCode |
| 1.15 | Validate and apply migration to production | 1 | /scripts/migrate-files-no-uuid.js --env=production | ★ CODEX (Master) |

## Gate SYNC-1

| ID | Description | Sprint | Files | Agent |
| --- | --- | --- | --- | --- |
| 1.16 | Connections page and sidebar read from single server state store | 1 | /app/api/connections/route.ts, /components/Sidebar.tsx, /app/connections/page.tsx | ◈ OpenCode |
| 3.14 | Provider health indicators — green means it actually works | 3 | /lib/providers/healthCheck.ts, /app/api/connections/health/route.ts | ◈ OpenCode |
| 3.16 | Dashboard + health E2E tests | 3 | /e2e/tests/storageDashboard.spec.ts | ◉ Gemini |

## Gate UPLOAD-1

| ID | Description | Sprint | Files | Agent |
| --- | --- | --- | --- | --- |
| 2.1 | Add persistent Upload / New Folder / Refresh action bar | 2 | /app/files/page.tsx, /components/files/ActionBar.tsx | ◆ ClaudeCode |
| 2.2 | Implement file upload with progress and toast | 2 | /app/api/remotes/[uuid]/upload/route.ts, /lib/providers/*/upload.ts | ◈ OpenCode |
| 2.5 | Write E2E tests for all file action entry points | 2 | /e2e/tests/fileActions.spec.ts | ◉ Gemini |

## Gate PREVIEW-1

| ID | Description | Sprint | Files | Agent |
| --- | --- | --- | --- | --- |
| 2.6 | Fix preview panel mount — "Opening" toast must open a panel | 2 | /components/files/PreviewPanel.tsx, /components/files/previewTypes.ts | ◆ ClaudeCode |
| 2.7 | Unsupported file types: immediate Download CTA | 2 | /components/files/PreviewPanel.tsx, /lib/files/mimeTypes.ts | ◆ ClaudeCode |
| 2.8 | E2E preview tests — supported and unsupported types | 2 | /e2e/tests/filePreview.spec.ts | ◉ Gemini |

## Gate ACTIONS-1

| ID | Description | Sprint | Files | Agent |
| --- | --- | --- | --- | --- |
| 2.3 | File table: single click select + right panel, double click open | 2 | /components/files/FileTable.tsx, /components/files/FileDetailPanel.tsx | ◆ ClaudeCode |
| 2.4 | Three-dot row menu + right-click context menu (identical) | 2 | /components/files/FileContextMenu.tsx, /components/files/MultiSelectToolbar.tsx | ◆ ClaudeCode |
| 2.5 | Write E2E tests for all file action entry points | 2 | /e2e/tests/fileActions.spec.ts | ◉ Gemini |

## Gate NAV-1

| ID | Description | Sprint | Files | Agent |
| --- | --- | --- | --- | --- |
| 2.9 | Merge Cloud Drives / Providers / Integrations → Connections | 2 | /app/connections/page.tsx, /components/Sidebar/NavItems.tsx, /app/providers/ (delete), /app/integrations/ (delete) | ◆ ClaudeCode |

## Gate RESP-1

| ID | Description | Sprint | Files | Agent |
| --- | --- | --- | --- | --- |
| 2.10 | File table visual polish — skeleton loaders, hover, separators | 2 | /components/files/FileTable.tsx, /components/Sidebar/AccountRow.tsx, /styles/files.css | ◆ ClaudeCode |
| 2.11 | Sidebar collapsible accordion per provider group | 2 | /components/Sidebar/ProviderGroup.tsx | ◆ ClaudeCode |
| 2.12 | Responsive layout pass — 375px viewport minimum | 2 | /components/Sidebar/**, /app/files/page.tsx, /app/connections/page.tsx, /styles/layout.css | ◆ ClaudeCode |

## Gate HOLD-UI-2026-03-02

| ID | Description | Sprint | Files | Agent |
| --- | --- | --- | --- | --- |
| UI-P1-T01 | Fix Cloud Drives page empty or unclear connected state | 2 | /components/Sidebar.tsx, /components/UnifiedFileBrowser.tsx, /app/connections/page.tsx | ◆ ClaudeCode |
| UI-P1-T02 | Fix 401 proxy failures for connected remotes (/api/remotes/:id/proxy) | 2 | /app/api/remotes/[uuid]/proxy/route.ts, /lib/apiClient.ts, /lib/interceptors/authInterceptor.ts | ◈ OpenCode |
| UI-P1-T03 | Fix preview panel open reliability from file rows and overflow Open | 2 | /components/PreviewPanel.tsx, /components/UnifiedFileBrowser.tsx | ◆ ClaudeCode |
| UI-P1-T04 | Restore file actions path (rename/move/download/delete) for connected drives | 2 | /components/UnifiedFileBrowser.tsx, /app/api/remotes/[uuid]/** | ◈ OpenCode |
| UI-P1-T05 | Add explicit UI error surfaces for failed sync/proxy/favorites requests | 2 | /components/UnifiedFileBrowser.tsx, /lib/ui/toast.ts, /app/api/connections/route.ts | ◈ OpenCode |
| UI-P1-T06 | Add clear loading, empty, and error state cards in file pane | 2 | /components/UnifiedFileBrowser.tsx, /components/Sidebar.tsx | ◆ ClaudeCode |

## Gate QA-1

| ID | Description | Sprint | Files | Agent |
| --- | --- | --- | --- | --- |
| OPS-E2E-READY | Add Playwright preflight wait-for-api on 127.0.0.1:8100 | 2 | /web/playwright.config.ts, /web/e2e/fixtures/global-setup.ts, /web/e2e/fixtures/global-teardown.ts, /web/e2e/fixtures/README.md | ◈ OpenCode |
| OPS-QA-WATCH | Run QA watcher loop: detect dependency unlocks, claim ready Gemini E2E tasks, and emit blocker reports | 2 | /web/e2e/**, /monitoring/task_history.yaml, /docs/prompts/**, /BLOCKER_QA_SEED.md | ◉ Gemini |

## Gate 2FA-1

| ID | Description | Sprint | Files | Agent |
| --- | --- | --- | --- | --- |
| 2.13 | TOTP setup flow — QR generation, verification, backup codes | 2 | /app/api/auth/2fa/**, /lib/auth/totp.ts, /prisma/migrations/003_2fa/ | ◈ OpenCode |
| 2.14 | TOTP login challenge UI | 2 | /app/auth/2fa-challenge/page.tsx, /components/auth/TOTPInput.tsx | ◆ ClaudeCode |
| 2.15 | Settings: manage 2FA, backup codes, last-used timestamp | 2 | /app/settings/security/page.tsx, /components/settings/TwoFAPanel.tsx | ◆ ClaudeCode |
| 2.16 | E2E 2FA tests — full enable/use/disable cycle | 2 | /e2e/tests/twoFA.spec.ts | ◉ Gemini |
| 4.7 | Share link creation — requires 2FA enabled on account | 4 | /app/api/share/route.ts, /lib/share/shareLinkService.ts | ◈ OpenCode |
| 4.10 | Share link UI — right-click → Get Share Link panel | 4 | /components/share/ShareLinkPanel.tsx, /components/share/ShareLinkList.tsx | ◆ ClaudeCode |

## Gate TRANSFER-1

| ID | Description | Sprint | Files | Agent |
| --- | --- | --- | --- | --- |
| 0.1 | Define and commit ProviderAdapter interface — all adapters implement this | 0 | /lib/providers/ProviderAdapter.interface.ts, /lib/providers/types.ts | ★ CODEX (Master) |
| 0.2 | Define AppError taxonomy and ErrorCode enum | 0 | /lib/errors/AppError.ts, /lib/errors/ErrorCode.ts | ◈ OpenCode |
| 0.3 | Define complete Prisma schema baseline — all tables, all relationships | 0 | /prisma/schema.prisma, /docs/architecture/data-model.md | ◈ OpenCode |
| 0.4 | Allocate Redis namespaces — document and enforce db separation | 0 | /docs/architecture/redis-namespaces.md, /lib/redis/client.ts (per-db connections) | ◈ OpenCode |
| 0.5 | Define streaming pipeline pattern — pipeline() + backpressure strategy | 0 | /lib/transfers/streamPipeline.ts, /tests/unit/streamPipeline.test.ts | ◈ OpenCode |
| 3.1 | Persistent Transfer Manager Tray — always visible when active | 3 | /components/transfers/TransferTray.tsx, /components/transfers/TransferItem.tsx, /context/TransferContext.tsx | ◆ ClaudeCode |
| 3.3 | Every file operation produces tray entry + toast | 3 | /lib/transfers/transferRegistry.ts, /app/api/remotes/[uuid]/**/route.ts | ◈ OpenCode |
| 3.4 | Tray E2E — entry survives navigation, retry works on failure | 3 | /e2e/tests/transferTray.spec.ts | ◉ Gemini |
| 3.5 | Chunked upload: files >50MB use provider resumable upload APIs | 3 | /lib/providers/googleDrive/chunkedUpload.ts, /lib/providers/onedrive/chunkedUpload.ts, /lib/providers/dropbox/chunkedUpload.ts | ◈ OpenCode |
| 3.6 | Auto-resume: resume interrupted upload from last successful chunk | 3 | /app/api/transfers/[id]/chunks/route.ts, /lib/transfers/chunkStateManager.ts | ◈ OpenCode |
| 3.7 | Tray: chunk-level progress for large files | 3 | /components/transfers/TransferItem.tsx | ◆ ClaudeCode |
| 3.8 | Auto-resume E2E test — network drop mid-transfer ⚠️ Human verify | 3 | /e2e/tests/chunkedResume.spec.ts | ◉ Gemini |
| 3.10 | BullMQ background job queue for async transfers | 3 | /lib/queue/transferQueue.ts, /lib/queue/workers/transferWorker.ts | ◈ OpenCode |
| 3.11 | Conflict resolution modal — shared component used everywhere | 3 | /components/transfers/ConflictResolutionModal.tsx | ◆ ClaudeCode |
| 3.15 | Rate limit handling layer — per-provider request queue | 3 | /lib/providers/rateLimitQueue.ts, /lib/apiClient.ts | ◈ OpenCode |
| 4.12 | Remote upload v1 — HTTP/HTTPS URL to chosen provider | 4 | /app/api/remote-upload/route.ts, /lib/transfers/remoteUpload.ts | ◈ OpenCode |
| 4.13 | Smart auto-placement engine v1 | 4 | /lib/placement/autoPlacementEngine.ts | ◈ OpenCode |
| 4.14 | Remote upload UI — dropdown in Upload action menu | 4 | /components/files/ActionBar.tsx, /components/files/RemoteUploadModal.tsx | ◆ ClaudeCode |
| 4.15 | E2E remote upload + placement tests | 4 | /e2e/tests/remoteUpload.spec.ts | ◉ Gemini |

## Gate ZERODISK-1

| ID | Description | Sprint | Files | Agent |
| --- | --- | --- | --- | --- |
| 0.1 | Define and commit ProviderAdapter interface — all adapters implement this | 0 | /lib/providers/ProviderAdapter.interface.ts, /lib/providers/types.ts | ★ CODEX (Master) |
| 0.5 | Define streaming pipeline pattern — pipeline() + backpressure strategy | 0 | /lib/transfers/streamPipeline.ts, /tests/unit/streamPipeline.test.ts | ◈ OpenCode |
| 3.9 | Server streams source → CacheFlow → target without disk write | 3 | /lib/transfers/streamTransfer.ts | ◈ OpenCode |
| 3.12 | Zero-disk verification test + tab-close survival test ⚠️ Human verify | 3 | /e2e/tests/zeroDiskTransfer.spec.ts | ◉ Gemini |

## Gate SSE-1

| ID | Description | Sprint | Files | Agent |
| --- | --- | --- | --- | --- |
| 0.4 | Allocate Redis namespaces — document and enforce db separation | 0 | /docs/architecture/redis-namespaces.md, /lib/redis/client.ts (per-db connections) | ◈ OpenCode |
| 0.7 | Define BullMQ → SSE bridge via Redis pub/sub | 0 | /lib/transfers/progressBridge.ts, /docs/architecture/sse-pattern.md | ◈ OpenCode |
| 3.2 | Server-Sent Events (SSE) for real-time transfer progress | 3 | /app/api/transfers/[id]/progress/route.ts, /lib/transfers/progressEmitter.ts | ◈ OpenCode |
| 3.10 | BullMQ background job queue for async transfers | 3 | /lib/queue/transferQueue.ts, /lib/queue/workers/transferWorker.ts | ◈ OpenCode |

## Gate SHARE-1

| ID | Description | Sprint | Files | Agent |
| --- | --- | --- | --- | --- |
| 4.7 | Share link creation — requires 2FA enabled on account | 4 | /app/api/share/route.ts, /lib/share/shareLinkService.ts | ◈ OpenCode |
| 4.8 | Share link proxy — hides underlying provider | 4 | /app/s/[linkId]/route.ts | ◈ OpenCode |
| 4.9 | Abuse controls — rate limits, throttling, link access logging | 4 | /lib/share/abuseControls.ts, /app/api/share/[id]/revoke/route.ts | ◈ OpenCode |
| 4.10 | Share link UI — right-click → Get Share Link panel | 4 | /components/share/ShareLinkPanel.tsx, /components/share/ShareLinkList.tsx | ◆ ClaudeCode |
| 4.11 | E2E share link tests — create, access, expire, revoke | 4 | /e2e/tests/shareLinks.spec.ts | ◉ Gemini |

## Gate VAULT-1

| ID | Description | Sprint | Files | Agent |
| --- | --- | --- | --- | --- |
| 0.3 | Define complete Prisma schema baseline — all tables, all relationships | 0 | /prisma/schema.prisma, /docs/architecture/data-model.md | ◈ OpenCode |
| 5.5 | Vault data model and enable/disable API | 5 | /prisma/migrations/005_vault/, /app/api/vault/route.ts | ◈ OpenCode |
| 5.6 | Vault access gate — TOTP or PIN required to unlock | 5 | /app/api/vault/[id]/unlock/route.ts, /lib/vault/vaultSession.ts | ◈ OpenCode |
| 5.7 | Vault UI — lock icon in sidebar, hidden from All Files | 5 | /components/Sidebar/VaultFolderRow.tsx, /components/vault/UnlockVaultModal.tsx, /app/files/page.tsx (filter vault items) | ◆ ClaudeCode |
| 5.8 | E2E vault tests — enable, lock, unlock, auto-lock | 5 | /e2e/tests/vault.spec.ts | ◉ Gemini |

## Gate SCHED-1

| ID | Description | Sprint | Files | Agent |
| --- | --- | --- | --- | --- |
| 3.13 | Storage pooling dashboard — promote aggregate to hero position | 3 | /app/dashboard/page.tsx, /components/dashboard/StorageHero.tsx, /components/dashboard/ProviderCapacityBar.tsx | ◆ ClaudeCode |
| 5.1 | Scheduled job data model and Schedules management UI | 5 | /prisma/migrations/004_scheduled_jobs/, /app/api/jobs/route.ts, /lib/jobs/scheduledJobService.ts | ◈ OpenCode |
| 5.2 | BullMQ cron worker — jobs run server-side, browser closed | 5 | /lib/queue/workers/scheduledJobWorker.ts, /lib/jobs/jobEngine.ts | ◈ OpenCode |
| 5.3 | Schedules page UI — create, edit, pause, delete jobs | 5 | /app/schedules/page.tsx, /components/schedules/JobCard.tsx, /components/schedules/CreateJobModal.tsx | ◆ ClaudeCode |
| 5.4 | E2E scheduled job test — runs with browser closed ⚠️ Human verify | 5 | /e2e/tests/scheduledJobs.spec.ts | ◉ Gemini |

## Gate SEARCH-1

| ID | Description | Sprint | Files | Agent |
| --- | --- | --- | --- | --- |
| 5.9 | Duplicate detection — filename + size cross-provider comparison | 5 | /lib/cleanup/duplicateDetector.ts, /app/api/cleanup/duplicates/route.ts | ◈ OpenCode |
| 5.10 | Stale file detection + cleanup UI | 5 | /app/cleanup/page.tsx, /components/cleanup/DuplicateGroup.tsx, /components/cleanup/StaleFileList.tsx | ◆ ClaudeCode |
| 5.11 | Global cross-provider search v1 — name/metadata, ephemeral cache | 5 | /app/api/search/route.ts, /lib/search/crossProviderSearch.ts | ◈ OpenCode |
| 5.12 | Search UI + performance test | 5 | /components/search/GlobalSearchBar.tsx, /components/search/SearchResults.tsx | ◆ ClaudeCode |
| 5.13 | E2E search + duplicate detection tests | 5 | /e2e/tests/search.spec.ts, /e2e/tests/duplicateCleanup.spec.ts | ◉ Gemini |

## Gate SEC-1

| ID | Description | Sprint | Files | Agent |
| --- | --- | --- | --- | --- |
| 1.4 | Token Vault v1 — encrypted at-rest provider credentials | 1 | /lib/vault/tokenVault.ts, /prisma/migrations/001_token_vault/ | ◈ OpenCode |
| 1.18 | Security baseline — remove defaults, harden secrets | 1 | /lib/auth/**, /app/api/**/route.ts (audit), /middleware.ts | ◈ OpenCode |
| 4.4 | SSH2 connection manager with LRU session reuse | 4 | /lib/providers/vps/sshConnectionManager.ts, /lib/providers/vps/VPSAdapter.ts | ◈ OpenCode |
| 4.5 | AES-256-GCM encrypted credential storage for VPS/WebDAV | 4 | /lib/vault/credentialVault.ts, /app/api/connections/vps/route.ts | ◈ OpenCode |
| 4.6 | VPS parity test + credential security test | 4 | /e2e/tests/providers/vps.spec.ts | ◉ Gemini |

## Gate LAUNCH-1

| ID | Description | Sprint | Files | Agent |
| --- | --- | --- | --- | --- |
| 6.1 | PWA manifest + next-pwa service worker (app shell only) | 6 | /public/manifest.json, /next.config.js (next-pwa), /app/offline/page.tsx | ◆ ClaudeCode |
| 6.2 | SEO landing page — storage calculator + provider grid | 6 | /app/(marketing)/page.tsx, /components/marketing/StorageCalculator.tsx, /app/(marketing)/layout.tsx | ◆ ClaudeCode |
| 6.3 | PWA install + offline E2E tests | 6 | /e2e/tests/pwa.spec.ts | ◉ Gemini |
| 6.4 | Billing and subscription tier model | 6 | /lib/billing/stripe.ts, /app/api/billing/**, /prisma/migrations/006_billing/ | ◈ OpenCode |
| 6.5 | Tier enforcement — limits enforced reliably at API layer | 6 | /lib/billing/tierEnforcement.ts, /middleware.ts | ◈ OpenCode |
| 6.6 | Affiliate storage calculator — only shown post-transfer-reliability | 6 | /components/dashboard/AffiliatePanel.tsx | ◆ ClaudeCode |
| 6.7 | Billing E2E — limits enforced, upgrade/downgrade safe | 6 | /e2e/tests/billing.spec.ts | ◉ Gemini |
| 6.8A | [OPTION A] Rich version history + unified trash — RECOMMENDED | 6 | /lib/providers/*/trash.ts, /app/trash/page.tsx, /components/files/VersionHistoryPanel.tsx | ◈ OpenCode |
| 6.8B | [OPTION B] Collabora Online (full Office editing) — HIGH INFRA COST | 6 | /docker-compose.collabora.yml, /app/api/wopi/**, /components/editor/CollaboraEditor.tsx | ◈ OpenCode |
| 6.8C | [OPTION C] Magnet/torrent remote upload — REQUIRES ABUSE CONTROLS | 6 | /lib/transfers/torrentUpload.ts, /lib/queue/workers/torrentWorker.ts | ◈ OpenCode |
