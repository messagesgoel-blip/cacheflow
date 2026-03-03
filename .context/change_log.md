# Change Log

| UTC | Agent | File | Reason |
|---|---|---|---|
| 2026-03-02T11:52:55Z | sanjay | web/app.ts | unplanned touch for hotfix |
| 2026-03-02T11:54:19Z | sanjay | api/src/test.ts | mcp publish verification |
| 2026-03-02T20:58:59Z | sanjay | 1.4@AUTH-2 | prisma/migrations/001_token_vault/migration.sql |
| 2026-03-02T20:59:00Z | sanjay | 1.18@AUTH-2 | web/app/api/auth/refresh/route.ts |
| 2026-03-02T20:59:01Z | sanjay | 1.18@AUTH-2 | web/lib/auth/securityAudit.ts |
| 2026-03-02T21:20:17Z | sanjay | 1.2@AUTH-2 | web/app/api/auth/refresh/route.ts |
| 2026-03-02T21:20:19Z | sanjay | 1.3@AUTH-3 | web/lib/auth/cookieAuth.ts |
| 2026-03-02T21:20:24Z | sanjay | 1.4@SEC-1 | web/lib/vault/tokenVault.ts |
| 2026-03-02T21:20:29Z | sanjay | 1.18@AUTH-2 | web/lib/auth/securityAudit.ts |
| 2026-03-02T21:27:09Z | sanjay | web/lib/api.ts | 1.1@AUTH-1: wrapped all API calls with authInterceptor for automatic 401/refresh handling |
| 2026-03-02T21:27:09Z | sanjay | prisma/migrations/002_multi_account/migration.sql | 1.5@AUTH-1: updated migration to target oauth_tokens table and added multi-account constraints |
| 2026-03-02T21:27:09Z | sanjay | api/src/routes/tokens.js | 1.5@AUTH-1: updated tokens API to support multi-account storage and decryption |
| 2026-03-02T21:27:09Z | sanjay | web/app/api/connections/route.ts | 1.5@AUTH-1: updated connections proxy to map multi-account tokens to provider connections |
| 2026-03-02T23:57:11Z | sanjay | OPS-E2E-READY@QA-1 | web/e2e/fixtures/global-setup.ts |
| 2026-03-02T23:57:12Z | sanjay | OPS-E2E-READY@QA-1 | web/e2e/fixtures/global-teardown.ts |
| 2026-03-02T23:57:13Z | sanjay | OPS-E2E-READY@QA-1 | web/playwright.config.ts |
| 2026-03-03T00:27:24Z | sanjay | UI-P1-T02@HOLD-UI-2026-03-02 | web/app/api/remotes/[uuid]/proxy/route.ts |
| 2026-03-03T00:27:25Z | sanjay | UI-P1-T02@HOLD-UI-2026-03-02 | web/lib/providers/StorageProvider.ts |
| 2026-03-03T00:27:25Z | sanjay | UI-P1-T05@HOLD-UI-2026-03-02 | web/components/errors/ |
| 2026-03-03T00:27:26Z | sanjay | UI-P1-T05@HOLD-UI-2026-03-02 | web/lib/hooks/useOperationError.ts |
| 2026-03-03T01:24:39Z | sanjay | web/app/api/connections/route.ts | Fix server connections fetch to use remotes and internal API base |
| 2026-03-03T01:24:39Z | sanjay | web/components/UnifiedFileBrowser.tsx | Hydrate tokenManager from server remotes for seeded QA accounts |
| 2026-03-03T01:24:39Z | sanjay | web/lib/providers/StorageProvider.ts | Route remote proxy through backend with bearer token to avoid session-expired loop |
| 2026-03-03T01:24:39Z | sanjay | web/lib/apiClient.ts | Normalize /api/connections payload and send bearer token |
| 2026-03-03T02:42:02Z | sanjay | 2.13@2FA-1 | web/lib/auth/totp.ts |
| 2026-03-03T02:42:03Z | sanjay | 2.13@2FA-1 | web/app/api/auth/2fa/ |
| 2026-03-03T02:42:04Z | sanjay | 2.13@2FA-1 | prisma/migrations/003_2fa/migration.sql |
| 2026-03-03T02:42:04Z | sanjay | 2.14@2FA-1 | web/app/auth/2fa-challenge/page.tsx |
| 2026-03-03T02:42:05Z | sanjay | 2.14@2FA-1 | web/components/auth/TOTPInput.tsx |
| 2026-03-03T03:09:57Z | sanjay | 3.10@TRANSFER-1 | worker/queues/transferQueue.ts |
| 2026-03-03T03:09:58Z | sanjay | 3.10@TRANSFER-1 | worker/workers/transferWorker.ts |
| 2026-03-03T03:09:58Z | sanjay | 3.10@TRANSFER-1 | web/app/api/transfers/route.ts |
| 2026-03-03T03:09:59Z | sanjay | 3.3@TRANSFER-1 | web/components/transfers/TransferTray.tsx |
| 2026-03-03T03:10:00Z | sanjay | 3.3@TRANSFER-1 | web/lib/hooks/useTransfer.ts |
| 2026-03-03T03:11:34Z | sanjay | 3.5@TRANSFER-1 | web/app/api/transfers/chunk/route.ts |
| 2026-03-03T03:11:35Z | sanjay | 3.6@TRANSFER-1 | web/lib/hooks/useChunkedUpload.ts |
| 2026-03-03T03:13:41Z | sanjay | 3.15@TRANSFER-1 | worker/queues/rateLimitQueue.ts |
| 2026-03-03T03:13:42Z | sanjay | 3.15@TRANSFER-1 | worker/workers/rateLimitWorker.ts |
| 2026-03-03T03:13:43Z | sanjay | 3.15@TRANSFER-1 | web/app/api/rate-limits/route.ts |
