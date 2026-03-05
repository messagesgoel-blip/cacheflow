# CacheFlow Web — Agent Context

## Stack
Next.js 14, TypeScript, Tailwind CSS, React.
App Router (app/ directory). No Pages Router.

## Key Directories
- app/           Next.js pages and API routes
- components/    React components
- context/       React context providers (TransferContext, etc.)
- lib/           Client-side utilities and provider clients
- e2e/           Playwright tests
- public/        Static assets

## API Routes
All in app/api/. Proxy to backend at http://127.0.0.1:8100.
Never use Docker service names (api:8100) — always 127.0.0.1:8100.

## Auth Pattern
- Session via NextAuth at /api/auth/
- HttpOnly cookies set by server
- apiClient.ts uses fetch with credentials: 'include'
- Never use localStorage for auth tokens

## Component Rules  
- Use existing ui/ primitives before creating new ones
- data-testid attributes required on interactive elements
- Tailwind only — no custom CSS files

## Testing
- Config: playwright.config.ts (testDir: ./e2e)
- Run: npx playwright test from web/ directory
- Auth bypass in tests: mock /api/auth/session, use page.goto('/files')
- Always mock /api/connections, /api/files, /api/remotes in E2E tests
