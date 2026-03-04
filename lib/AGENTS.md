# LIB KNOWLEDGE BASE

**Generated:** 2026-03-04
**Commit:** N/A
**Branch:** N/A

## OVERVIEW
Shared TypeScript utilities and services used across web, API, and worker services.

## STRUCTURE
```
./lib/
├── auth/              # Authentication utilities
├── errors/            # Error handling classes and codes
├── interceptors/      # API request/response interceptors
├── placement/         # Auto-placement engine
├── providers/         # Cloud provider adapters
├── queue/             # Job queue utilities
├── redis/             # Redis client and utilities
├── share/             # File sharing logic
├── transfers/         # File transfer operations
├── uploads/           # Upload handling
├── vault/             # Encrypted credential storage
├── apiClient.ts       # Centralized HTTP client
└── types.ts           # Shared type definitions
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Error Handling | errors/ | AppError class and ErrorCode enums |
| Auth Utilities | auth/ | JWT token handling, user verification |
| Provider Logic | providers/ | 20+ cloud provider adapters |
| Transfer Logic | transfers/ | Chunked uploads, progress tracking |
| Secure Storage | vault/ | AES-256-GCM encrypted credential storage |
| API Requests | apiClient.ts | Centralized HTTP client with auth |

## CONVENTIONS
- Strict TypeScript with noImplicitAny
- All shared utilities follow singleton pattern where applicable
- Error handling with structured AppError class
- Crypto operations use AES-256-GCM for encryption
- Redis operations use atomic INCRBY/DECRBY for counters

## ANTI-PATTERNS (THIS PROJECT)
- No direct imports from outside lib/ to maintain modularity
- No circular dependencies between lib submodules
- Never store plaintext credentials - always use vault/

## UNIQUE STYLES
- Provider adapter pattern for cloud integrations
- Interface-driven design with extensive type safety
- Centralized error codes with structured error handling
- Atomic Redis operations for counter safety