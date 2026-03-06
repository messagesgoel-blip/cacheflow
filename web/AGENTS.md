# CacheFlow Web — Quick Sheet

Stack: Next.js 14 + TS + Tailwind, App Router only.

Directories: app/ (routes + API), components/, context/, lib/ (client utils), e2e/, public/.

API proxy: app/api/* should hit backend at http://127.0.0.1:8100 (never docker service names).

Auth: NextAuth at /api/auth; HttpOnly cookies; apiClient fetches with credentials: 'include'; never use localStorage for tokens.

Components: prefer components/ui primitives; add data-testid to interactive elements; Tailwind only (no css files).

Tests: run from web/: npx playwright test. Mock /api/auth/session plus /api/connections, /api/files, /api/remotes; start pages via page.goto('/files').
