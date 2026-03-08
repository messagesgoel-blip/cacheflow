# Sprint 4 Tasks

| ID | Description | Files | Agent | Gates |
| --- | --- | --- | --- | --- |
| 4.1 | Define provider parity checklist — every provider must pass all 5 | /docs/provider-parity.md, /lib/providers/ProviderAdapter.interface.ts | ★ CODEX (Master) | AUTH-1 |
| 4.10 | Share link UI — right-click → Get Share Link panel | /components/share/ShareLinkPanel.tsx, /components/share/ShareLinkList.tsx | ◆ ClaudeCode | 2FA-1, SHARE-1 |
| 4.11 | E2E share link tests — create, access, expire, revoke | /e2e/tests/shareLinks.spec.ts | ◉ Gemini | SHARE-1 |
| 4.12 | Remote upload v1 — HTTP/HTTPS URL to chosen provider | /app/api/remote-upload/route.ts, /lib/transfers/remoteUpload.ts | ◈ OpenCode | TRANSFER-1 |
| 4.13 | Smart auto-placement engine v1 | /lib/placement/autoPlacementEngine.ts | ◈ OpenCode | TRANSFER-1 |
| 4.14 | Remote upload UI — dropdown in Upload action menu | /components/files/ActionBar.tsx, /components/files/RemoteUploadModal.tsx | ◆ ClaudeCode | TRANSFER-1 |
| 4.15 | E2E remote upload + placement tests | /e2e/tests/remoteUpload.spec.ts | ◉ Gemini | TRANSFER-1 |
| 4.2 | Add 2–3 additional providers to reach 3–4 gold-standard total | /lib/providers/box/**, /lib/providers/pcloud/**, /lib/providers/yandex/** | ◈ OpenCode | AUTH-1 |
| 4.3 | E2E parity tests for each new provider | /e2e/tests/providers/box.spec.ts, /e2e/tests/providers/pcloud.spec.ts | ◉ Gemini | AUTH-1 |
| 4.4 | SSH2 connection manager with LRU session reuse | /lib/providers/vps/sshConnectionManager.ts, /lib/providers/vps/VPSAdapter.ts | ◈ OpenCode | SEC-1 |
| 4.5 | AES-256-GCM encrypted credential storage for VPS/WebDAV | /lib/vault/credentialVault.ts, /app/api/connections/vps/route.ts | ◈ OpenCode | SEC-1 |
| 4.6 | VPS parity test + credential security test | /e2e/tests/providers/vps.spec.ts | ◉ Gemini | SEC-1 |
| 4.7 | Share link creation — requires 2FA enabled on account | /app/api/share/route.ts, /lib/share/shareLinkService.ts | ◈ OpenCode | 2FA-1, SHARE-1 |
| 4.8 | Share link proxy — hides underlying provider | /app/s/[linkId]/route.ts | ◈ OpenCode | SHARE-1 |
| 4.9 | Abuse controls — rate limits, throttling, link access logging | /lib/share/abuseControls.ts, /app/api/share/[id]/revoke/route.ts | ◈ OpenCode | SHARE-1 |

