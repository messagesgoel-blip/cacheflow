# CacheFlow Provider Integration Setup (Step-by-Step)

This guide standardizes provider setup so each adapter has clear, reproducible onboarding steps.

Scope:
- Google Drive
- OneDrive
- Dropbox
- Box
- pCloud
- Filen
- Yandex Disk
- WebDAV
- VPS / SFTP

## 1. Prerequisites

1. Decide your web app origin:
- Local dev: `http://localhost:3010`
- Prod: your deployed web URL (for example, `https://cacheflow.goels.in`)

2. Confirm API URL used by web:
- `NEXT_PUBLIC_API_URL` in web runtime env.

3. Add provider env vars in web runtime:
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
- `NEXT_PUBLIC_MSAL_CLIENT_ID`
- `NEXT_PUBLIC_DROPBOX_APP_KEY`
- `NEXT_PUBLIC_BOX_CLIENT_ID`
- `NEXT_PUBLIC_PCLOUD_CLIENT_ID`
- `NEXT_PUBLIC_FILEN_CLIENT_ID`
- `NEXT_PUBLIC_YANDEX_CLIENT_ID`

4. Restart web after env changes so Next.js picks up public env vars.

5. Verify OAuth callback endpoints match code paths:
- Dropbox: `${APP_ORIGIN}/api/auth/dropbox/callback`
- Box: `${APP_ORIGIN}/api/auth/box/callback`
- pCloud: `${APP_ORIGIN}/api/auth/pcloud/callback`
- Filen: `${APP_ORIGIN}/api/auth/filen/callback`
- Yandex: `${APP_ORIGIN}/api/auth/yandex/callback`

Notes:
- Google adapter uses Google Identity Services token flow (origin-based popup).
- OneDrive adapter uses MSAL popup with redirect URI set to `${APP_ORIGIN}`.

## 2. Global Validation Checklist (Use For Every Provider)

1. Open CacheFlow and go to providers/remotes UI.
2. Click `Connect` for the provider.
3. Complete OAuth (or credential form for non-OAuth).
4. Confirm account appears as connected in UI.
5. Verify list, upload, download, and search for that provider.
6. Disconnect and reconnect once to validate token persistence/refresh.

## 3. Google Drive

Code refs:
- Env var: `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
- Adapter: `web/lib/providers/googleDrive.ts`

Steps:
1. In Google Cloud Console, create/select a project.
2. Enable `Google Drive API`.
3. Configure OAuth consent screen (external/internal as needed).
4. Create OAuth Client ID for a web app.
5. Add Authorized JavaScript origins:
- `http://localhost:3010`
- Your production web origin
6. Copy Client ID and set `NEXT_PUBLIC_GOOGLE_CLIENT_ID`.
7. Restart web app and test connect flow.

Expected scopes in code:
- `email`
- `profile`
- `https://www.googleapis.com/auth/drive`

## 4. OneDrive (Microsoft Graph)

Code refs:
- Env var: `NEXT_PUBLIC_MSAL_CLIENT_ID`
- Adapter: `web/lib/providers/oneDrive.ts`

Steps:
1. Open Azure Portal -> App registrations -> New registration.
2. Choose supported account types:
- Recommended: `Accounts in any organizational directory and personal Microsoft accounts`.
3. Create app and copy `Application (client) ID`.
4. In Authentication:
- Add Platform: `Single-page application (SPA)`.
- Add Redirect URI:
  - `http://localhost:3010`
  - Production web origin
5. In API permissions (Microsoft Graph, Delegated):
- `Files.ReadWrite.All`
- `offline_access`
- `User.Read`
6. If your tenant requires it, grant admin consent.
7. Set `NEXT_PUBLIC_MSAL_CLIENT_ID` to client ID.
8. Restart web and test `OneDrive Connect`.

Expected behavior:
- Popup login via MSAL.
- Account metadata fetched from `/me`.

## 5. Dropbox

Code refs:
- Env var: `NEXT_PUBLIC_DROPBOX_APP_KEY`
- Adapter: `web/lib/providers/dropbox.ts`

Steps:
1. Open Dropbox App Console -> Create app.
2. Choose `Scoped access` and desired access level.
3. Add redirect URIs:
- `${APP_ORIGIN}/api/auth/dropbox/callback`
4. Enable scopes needed for file operations (read/write + account info).
5. Copy App key and set `NEXT_PUBLIC_DROPBOX_APP_KEY`.
6. Restart web and run connect flow.

PKCE details in code:
- Authorization URL: `https://www.dropbox.com/oauth2/authorize`
- Token URL: `https://api.dropboxapi.com/oauth2/token`
- `token_access_type=offline`

## 6. Box

Code refs:
- Env var: `NEXT_PUBLIC_BOX_CLIENT_ID`
- Adapter: `web/lib/providers/box.ts`

Steps:
1. Open Box Developer Console -> Create app.
2. Select OAuth 2.0 app type compatible with user auth.
3. Enable PKCE for OAuth if required by app template.
4. Add redirect URI:
- `${APP_ORIGIN}/api/auth/box/callback`
5. Copy Client ID and set `NEXT_PUBLIC_BOX_CLIENT_ID`.
6. Restart web and test connect flow.

PKCE details in code:
- Authorization URL: `https://account.box.com/api/oauth2/authorize`
- Token URL: `https://api.box.com/oauth2/token`

## 7. pCloud

Code refs:
- Env var: `NEXT_PUBLIC_PCLOUD_CLIENT_ID`
- Adapter: `web/lib/providers/pcloud.ts`

Steps:
1. Register app in pCloud developer console.
2. Add redirect URI:
- `${APP_ORIGIN}/api/auth/pcloud/callback`
3. Copy client ID and set `NEXT_PUBLIC_PCLOUD_CLIENT_ID`.
4. Restart web and test connect flow.

OAuth details in code:
- Authorization URL: `https://my.pcloud.com/oauth2/authorize`
- Token URL: `https://my.pcloud.com/oauth2/token`

## 8. Filen

Code refs:
- Env var: `NEXT_PUBLIC_FILEN_CLIENT_ID`
- Adapter: `web/lib/providers/filen.ts`

Steps:
1. Register OAuth app with Filen.
2. Add redirect URI:
- `${APP_ORIGIN}/api/auth/filen/callback`
3. Copy client ID and set `NEXT_PUBLIC_FILEN_CLIENT_ID`.
4. Restart web and test connect flow.

OAuth details in code:
- Authorization URL: `https://filen.io/oauth/authorize`
- Token URL: `https://filen.io/oauth/token`
- Scope: `files:read files:write user:read`

## 9. Yandex Disk

Code refs:
- Env var: `NEXT_PUBLIC_YANDEX_CLIENT_ID`
- Adapter: `web/lib/providers/yandex.ts`

Steps:
1. Register OAuth app in Yandex OAuth console.
2. Add redirect URI:
- `${APP_ORIGIN}/api/auth/yandex/callback`
3. Copy client ID and set `NEXT_PUBLIC_YANDEX_CLIENT_ID`.
4. Restart web and test connect flow.

OAuth details in code:
- Authorization URL: `https://oauth.yandex.com/authorize`
- Token URL: `https://oauth.yandex.com/token`
- Scope: `cloud_api:disk.read cloud_api:disk.write`

## 10. WebDAV

Code refs:
- Adapter: `web/lib/providers/webdav.ts`

Steps:
1. Collect server details:
- Base URL
- Username
- Password
- Optional path prefix
2. Enter WebDAV config in UI.
3. Connect (adapter tests with `PROPFIND`).
4. Validate list/upload/download/delete.

Notes:
- No OAuth env var required.
- Quota may be unavailable depending on server.

## 11. VPS / SFTP

Code refs:
- Adapter: `web/lib/providers/vps.ts`
- API route family: `/sftp/*`

Steps:
1. Confirm API is reachable from web (`NEXT_PUBLIC_API_URL`).
2. Ensure backend SFTP endpoints are enabled:
- `POST /sftp/connect`
- `GET /sftp/:id/files`
- `GET /sftp/:id/quota`
- and related upload/download/delete routes
3. Gather connection details:
- Host, port, username
- Auth type (password or private key)
- Root path
4. Connect in UI and verify file operations.

Notes:
- OAuth is not used.
- Credentials are proxied via backend SFTP service.

## 12. Troubleshooting Matrix

`Popup closes and nothing happens`
- Check browser popup blocking.
- Verify callback URL exactly matches provider app config.

`invalid_redirect_uri`
- Confirm exact scheme/host/port/path match between provider console and code callback URL.

`No refresh token`
- Verify provider app is configured for offline/refresh token access.
- Re-consent account if provider requires explicit offline consent.

`401 after connect`
- Check env var value and provider app permissions/scopes.
- Disconnect and reconnect provider from UI to regenerate token.

`Provider not shown as connected`
- Confirm env var exists in web runtime (not only shell).
- Restart web and hard refresh browser.

## 13. PR Checklist For Provider Setup Changes

1. Update this document when adding/changing provider OAuth flow.
2. Update env var list if new `NEXT_PUBLIC_*` key is introduced.
3. Verify callback URI section reflects code path.
4. Validate connect/disconnect/list/upload for affected provider.
5. Include QA evidence (screenshots/logs) in PR description.
