# WEB KNOWLEDGE BASE

**Generated:** 2026-03-04
**Commit:** N/A
**Branch:** N/A

## OVERVIEW
Next.js web application frontend for CacheFlow (runs on port 3010). Implements file browser, provider configuration, and user authentication UI.

## STRUCTURE
```
./web/
├── app/               # Next.js 13+ app router pages
├── components/        # React UI components
├── e2e/              # Playwright end-to-end tests
├── lib/              # Web-specific utilities
├── __tests__/        # Unit and integration tests
├── context/          # React context providers
├── middleware.ts     # Next.js middleware
├── next.config.js    # Next.js configuration
└── package.json      # Web app dependencies
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Main Pages | app/ | Dashboard, file browser, settings UI |
| UI Components | components/ | File browser, provider cards, file actions |
| Auth Flow | app/api/auth/ | Next.js API routes for authentication |
| Hooks | lib/hooks/ | Custom React hooks for data fetching |
| Providers | app/api/remotes/ | Cloud provider API routes |
| E2E Tests | e2e/ | Playwright tests for UI flows |

## CONVENTIONS
- Next.js 13+ App Router pattern
- TypeScript strict mode
- React Server Components where possible
- Client Components only when interactivity required
- Jest for unit tests, Playwright for E2E tests

## ANTI-PATTERNS (THIS PROJECT)
- No direct API calls from client components - use server actions
- Never expose credentials in client-side code
- Avoid large bundles - use code splitting appropriately

## UNIQUE STYLES
- Server Actions for mutations
- Streaming responses for large file operations
- React Server Components for initial data loading
- Client Components for interactive elements
- Form state management with React Hook Form