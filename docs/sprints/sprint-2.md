# Sprint 2 Tasks

| ID | Description | Files | Agent | Gates |
| --- | --- | --- | --- | --- |
| 2.1 | Add persistent Upload / New Folder / Refresh action bar | /app/files/page.tsx, /components/files/ActionBar.tsx | ◆ ClaudeCode | UPLOAD-1 |
| 2.10 | File table visual polish — skeleton loaders, hover, separators | /components/files/FileTable.tsx, /components/Sidebar/AccountRow.tsx, /styles/files.css | ◆ ClaudeCode | RESP-1 |
| 2.11 | Sidebar collapsible accordion per provider group | /components/Sidebar/ProviderGroup.tsx | ◆ ClaudeCode | RESP-1 |
| 2.12 | Responsive layout pass — 375px viewport minimum | /components/Sidebar/**, /app/files/page.tsx, /app/connections/page.tsx, /styles/layout.css | ◆ ClaudeCode | RESP-1 |
| 2.13 | TOTP setup flow — QR generation, verification, backup codes | /app/api/auth/2fa/**, /lib/auth/totp.ts, /prisma/migrations/003_2fa/ | ◈ OpenCode | 2FA-1 |
| 2.14 | TOTP login challenge UI | /app/auth/2fa-challenge/page.tsx, /components/auth/TOTPInput.tsx | ◆ ClaudeCode | 2FA-1 |
| 2.15 | Settings: manage 2FA, backup codes, last-used timestamp | /app/settings/security/page.tsx, /components/settings/TwoFAPanel.tsx | ◆ ClaudeCode | 2FA-1 |
| 2.16 | E2E 2FA tests — full enable/use/disable cycle | /e2e/tests/twoFA.spec.ts | ◉ Gemini | 2FA-1 |
| 2.2 | Implement file upload with progress and toast | /app/api/remotes/[uuid]/upload/route.ts, /lib/providers/*/upload.ts | ◈ OpenCode | UPLOAD-1 |
| 2.3 | File table: single click select + right panel, double click open | /components/files/FileTable.tsx, /components/files/FileDetailPanel.tsx | ◆ ClaudeCode | ACTIONS-1 |
| 2.4 | Three-dot row menu + right-click context menu (identical) | /components/files/FileContextMenu.tsx, /components/files/MultiSelectToolbar.tsx | ◆ ClaudeCode | ACTIONS-1 |
| 2.5 | Write E2E tests for all file action entry points | /e2e/tests/fileActions.spec.ts | ◉ Gemini | ACTIONS-1, UPLOAD-1 |
| 2.6 | Fix preview panel mount — "Opening" toast must open a panel | /components/files/PreviewPanel.tsx, /components/files/previewTypes.ts | ◆ ClaudeCode | PREVIEW-1 |
| 2.7 | Unsupported file types: immediate Download CTA | /components/files/PreviewPanel.tsx, /lib/files/mimeTypes.ts | ◆ ClaudeCode | PREVIEW-1 |
| 2.8 | E2E preview tests — supported and unsupported types | /e2e/tests/filePreview.spec.ts | ◉ Gemini | PREVIEW-1 |
| 2.9 | Merge Cloud Drives / Providers / Integrations → Connections | /app/connections/page.tsx, /components/Sidebar/NavItems.tsx, /app/providers/ (delete), /app/integrations/ (delete) | ◆ ClaudeCode | NAV-1 |

