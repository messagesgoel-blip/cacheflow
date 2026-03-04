# WEB APP ROUTES KNOWLEDGE BASE

**Generated:** 2026-03-04
**Commit:** N/A
**Branch:** N/A

## OVERVIEW
Next.js App Router pages for the CacheFlow web application. Defines all route structures and page-level components.

## STRUCTURE
```
./web/app/
├── layout.tsx           # Root layout
├── page.tsx             # Home/dashboard page
├── globals.css          # Global styles
├── api/                 # Next.js API routes
│   ├── auth/           # Authentication endpoints
│   │   ├── 2fa/       # Two-factor authentication
│   │   └── [...auth]   # OAuth and session management
│   └── remotes/        # Cloud provider API routes
│       └── [uuid]/     # Dynamic provider routes
├── dashboard/          # Dashboard pages
├── files/              # File browser pages
├── settings/           # User settings pages
├── providers/          # Provider configuration pages
└── [...more routes]    # Additional page routes
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Main Dashboard | page.tsx | Home screen and overview |
| File Browser | /files | File browsing interface |
| Auth Flow | /api/auth | Next.js API routes for auth |
| Provider Setup | /providers | Connect cloud accounts |
| Settings | /settings | User preferences |
| API Routes | /api | Server-side operations |

## CONVENTIONS
- Next.js 13+ App Router pattern
- Server Components by default for data fetching
- Client Components only when interactivity required
- Route handlers for API endpoints
- TypeScript strict mode

## ANTI-PATTERNS (THIS PROJECT)
- Don't perform heavy operations in Server Components
- Avoid client-side navigation when server actions are appropriate
- Never expose sensitive data in client components

## UNIQUE STYLES
- Server Actions for mutations
- Streaming responses for large datasets
- Route handlers for API operations
- Middleware for authentication