# Sprint 6 Tasks

| ID | Description | Files | Agent | Gates |
| --- | --- | --- | --- | --- |
| 6.1 | PWA manifest + next-pwa service worker (app shell only) | /public/manifest.json, /next.config.js (next-pwa), /app/offline/page.tsx | ◆ ClaudeCode | LAUNCH-1 |
| 6.2 | SEO landing page — storage calculator + provider grid | /app/(marketing)/page.tsx, /components/marketing/StorageCalculator.tsx, /app/(marketing)/layout.tsx | ◆ ClaudeCode | LAUNCH-1 |
| 6.3 | PWA install + offline E2E tests | /e2e/tests/pwa.spec.ts | ◉ Gemini | LAUNCH-1 |
| 6.4 | Billing and subscription tier model | /lib/billing/stripe.ts, /app/api/billing/**, /prisma/migrations/006_billing/ | ◈ OpenCode | LAUNCH-1 |
| 6.5 | Tier enforcement — limits enforced reliably at API layer | /lib/billing/tierEnforcement.ts, /middleware.ts | ◈ OpenCode | LAUNCH-1 |
| 6.6 | Affiliate storage calculator — only shown post-transfer-reliability | /components/dashboard/AffiliatePanel.tsx | ◆ ClaudeCode | LAUNCH-1 |
| 6.7 | Billing E2E — limits enforced, upgrade/downgrade safe | /e2e/tests/billing.spec.ts | ◉ Gemini | LAUNCH-1 |
| 6.8A | [OPTION A] Rich version history + unified trash — RECOMMENDED | /lib/providers/*/trash.ts, /app/trash/page.tsx, /components/files/VersionHistoryPanel.tsx | ◈ OpenCode | LAUNCH-1 |
| 6.8B | [OPTION B] Collabora Online (full Office editing) — HIGH INFRA COST | /docker-compose.collabora.yml, /app/api/wopi/**, /components/editor/CollaboraEditor.tsx | ◈ OpenCode | LAUNCH-1 |
| 6.8C | [OPTION C] Magnet/torrent remote upload — REQUIRES ABUSE CONTROLS | /lib/transfers/torrentUpload.ts, /lib/queue/workers/torrentWorker.ts | ◈ OpenCode | LAUNCH-1 |
