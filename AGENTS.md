# PROJECT KNOWLEDGE BASE

**Generated:** 2026-03-04
**Commit:** N/A
**Branch:** N/A

## OVERVIEW
CacheFlow - Personal hybrid cloud storage with NVMe cache + rclone sync. Full-stack TypeScript/JavaScript application with Next.js frontend, Express API, and worker processes for cloud provider synchronization.

## STRUCTURE
```
./
├── api/           # Express.js API server (port 8100)
├── web/           # Next.js web application (port 3010)
├── lib/           # Shared TypeScript utilities and services
├── worker/        # Background sync workers
├── scripts/       # Orchestration and utility scripts
├── docs/          # Documentation
└── infra/         # Docker compose infrastructure
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Cloud Providers | lib/providers/ | 20+ provider implementations (Google Drive, OneDrive, etc.) |
| File Sync Logic | lib/transfers/ | Chunked uploads, progress tracking, resume capability |
| Authentication | web/lib/auth/ | JWT, 2FA, provider OAuth flows |
| API Endpoints | api/src/routes/ | Express routes for file operations |
| Vault/Crypto | lib/vault/ | Encrypted credential storage |
| UI Components | web/components/ | React components for file browser, providers, etc. |

## CODE MAP
| Symbol | Type | Location | Role |
|--------|------|----------|------|
| ProviderAdapter | Interface | lib/providers/ | Contract for all cloud providers |
| AppError | Class | lib/errors/ | Structured error handling |
| CredentialVault | Class | lib/vault/ | Encrypted credential storage |
| useOperationError | Hook | web/lib/hooks/ | React error handling |

## CONVENTIONS
- Strict TypeScript everywhere with noImplicitAny
- Jest for testing, Playwright for E2E
- JWT authentication with refresh tokens
- AES-256-GCM encryption for stored credentials
- Per-provider rate limiting with queues

## ANTI-PATTERNS (THIS PROJECT)
- NEVER assume a port is free — always `ss -ltnp` first
- NEVER do giant rewrites — prefer small patch scripts
- NEVER skip Git safety config: `git config --global --add safe.directory`
- JWT verification: always verify signature, never fallback to decode() without verification

## UNIQUE STYLES
- Gate/Task system in JSDoc comments for feature tracking
- Provider interface contracts in `lib/providers/types.ts`
- Chunked upload pattern across all providers
- Atomic Redis operations (INCRBY/DECRBY) for counters

## COMMANDS
```bash
# Development
npm run orchestrate          # Run orchestration script
npm run recover             # Run recovery script
npm run typecheck           # Type check scripts

# Testing
./test-all.sh               # Run all test suites
cd web && npm test          # Web tests
cd api && npm test          # API tests
cd worker && npm test       # Worker tests

# Services
docker compose up -d         # Start all services
ss -ltnp                   # Check port usage
```

## NOTES
- Repo mounted at `/workspace/cacheflow` in container
- Docker socket available for container control
- 20+ cloud providers supported with adapter pattern
- Large files (>500 lines) in provider implementations indicate complexity hotspots
