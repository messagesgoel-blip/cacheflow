# API KNOWLEDGE BASE

**Generated:** 2026-03-04
**Commit:** N/A
**Branch:** N/A

## OVERVIEW
Express.js API server for CacheFlow (runs on port 8100). Handles file operations, cloud provider integrations, authentication, and sync operations.

## STRUCTURE
```
./api/
├── src/
│   ├── routes/       # Express route handlers
│   ├── services/     # Business logic services
│   ├── middleware/   # Express middleware
│   └── utils/        # API-specific utilities
├── tests/            # API unit/integration tests
├── Dockerfile        # Container configuration
└── package.json      # API dependencies
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| File Ops | routes/files.js | Browse, upload, download, move operations |
| Cloud Providers | routes/remotes.js | OAuth flows, provider connections |
| Auth | routes/auth.js | Login, session management |
| Health Checks | routes/health.js | Service status endpoints |
| Business Logic | src/services/ | Core operations implementation |
| Tests | tests/ | API-specific test suites |

## CONVENTIONS
- Express.js route handlers with structured error responses
- JWT authentication with refresh tokens
- Input validation with express-validator
- Database operations with Prisma ORM
- Rate limiting per IP and per-user

## ANTI-PATTERNS (THIS PROJECT)
- Never expose raw database records directly - sanitize responses
- Avoid long-running operations in request handlers
- Don't store sensitive data in plain text

## UNIQUE STYLES
- Dual approach for cloud providers: direct API vs rclone
- Comprehensive OAuth flow with multiple provider types
- File operation immutability with version tracking
- Real-time progress updates via SSE