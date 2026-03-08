# Sprint 1 Tasks

| ID | Description | Files | Agent | Gates |
| --- | --- | --- | --- | --- |
| 1.1 | Create global HTTP interceptor for all /api/remotes proxy calls | /lib/apiClient.ts, /lib/interceptors/authInterceptor.ts | ◈ OpenCode | AUTH-1, AUTH-4 |
| 1.10 | Clear modal state on close and provider switch | /context/IntegrationContext.tsx, /components/modals/ConnectProviderModal.tsx | ◆ ClaudeCode | MODAL-1 |
| 1.11 | Write Playwright modal test — all 9 provider Connect buttons | /e2e/tests/providerModals.spec.ts | ◉ Gemini | MODAL-1 |
| 1.12 | Audit upload pipeline — locate all UUID injection points | /api/remotes/**, /lib/providers/**, /lib/uploads/** | ★ CODEX (Master) | UUID-1 |
| 1.13 | Fix upload pipeline to preserve original File.name | /lib/providers/googleDrive.ts, /lib/providers/onedrive.ts, /lib/providers/dropbox.ts, /lib/uploads/uploadManager.ts | ◈ OpenCode | UUID-1 |
| 1.14 | Write and run migration script in staging | /scripts/migrate-files-no-uuid.js | ◈ OpenCode | UUID-1 |
| 1.15 | Validate and apply migration to production | /scripts/migrate-files-no-uuid.js --env=production | ★ CODEX (Master) | UUID-1 |
| 1.16 | Connections page and sidebar read from single server state store | /app/api/connections/route.ts, /components/Sidebar.tsx, /app/connections/page.tsx | ◈ OpenCode | SYNC-1 |
| 1.17 | Replace SESSION_EXPIRED raw text with actionable component | /components/SessionExpiredBanner.tsx, /components/Sidebar/AccountRow.tsx | ◆ ClaudeCode | AUTH-1 |
| 1.18 | Security baseline — remove defaults, harden secrets | /lib/auth/**, /app/api/**/route.ts (audit), /middleware.ts | ◈ OpenCode | AUTH-2, SEC-1 |
| 1.19 | Security audit test — verify no secrets in API responses | /e2e/tests/securityAudit.spec.ts | ◉ Gemini | AUTH-2 |
| 1.2 | Implement silent token refresh endpoint | /app/api/auth/refresh/route.ts | ◈ OpenCode | AUTH-2 |
| 1.3 | Migrate from localStorage TokenManager to HttpOnly cookies | /lib/tokenManager.ts (deprecated), /lib/auth/cookieAuth.ts (new) | ◈ OpenCode | AUTH-3 |
| 1.4 | Token Vault v1 — encrypted at-rest provider credentials | /lib/vault/tokenVault.ts, /prisma/migrations/001_token_vault/ | ◈ OpenCode | AUTH-2, SEC-1 |
| 1.5 | Multi-account schema — up to 3 accounts per provider | /prisma/migrations/002_multi_account/, /lib/vault/tokenVault.ts | ◈ OpenCode | AUTH-1 |
| 1.6 | Remove client-side token sync pattern entirely | /app/api/auth/sync-token/ (delete), /components/providers/** (audit) | ◆ ClaudeCode | AUTH-3 |
| 1.7 | Write Playwright token expiry test | /e2e/tests/tokenExpiry.spec.ts | ◉ Gemini | AUTH-1 |
| 1.8 | Replace shared modal boolean with provider discriminator enum | /context/IntegrationContext.tsx, /components/modals/ConnectProviderModal.tsx | ◆ ClaudeCode | MODAL-1 |
| 1.9 | Implement correct forms for WebDAV and VPS/SFTP modals | /components/modals/WebDAVModal.tsx, /components/modals/VPSModal.tsx | ◆ ClaudeCode | MODAL-1 |

