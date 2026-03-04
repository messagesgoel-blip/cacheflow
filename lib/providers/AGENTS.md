# PROVIDERS KNOWLEDGE BASE

**Generated:** 2026-03-04
**Commit:** N/A
**Branch:** N/A

## OVERVIEW
Cloud provider adapter implementations. Contains 20+ provider implementations following the ProviderAdapter interface contract.

## STRUCTURE
```
./lib/providers/
├── types.ts                    # Interface contracts and type definitions
├── ProviderAdapter.interface.ts # Core provider interface
├── rateLimitQueue.ts           # Per-provider rate limiting
├── index.ts                    # Provider registry and factory
├── googleDrive.ts              # Google Drive implementation
├── oneDrive.ts                 # Microsoft OneDrive implementation
├── dropbox.ts                  # Dropbox implementation
├── box/                        # Box provider (separate directory)
├── [...other providers]        # Additional cloud providers
└── utils/                      # Provider utilities
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Interface Contract | types.ts | Core ProviderAdapter interface |
| Rate Limiting | rateLimitQueue.ts | Per-provider request queuing |
| Google Drive | googleDrive.ts | Most complex provider implementation |
| Box Provider | box/ | Multi-file provider implementation |
| Provider Registry | index.ts | Factory for provider instantiation |
| Utilities | utils/ | Shared provider functions |

## CONVENTIONS
- All providers implement the ProviderAdapter interface
- Chunked upload pattern for large files (>100MB)
- OAuth 2.0 flow with refresh token handling
- Rate limiting with exponential backoff
- Provider-specific error mapping to standard errors

## ANTI-PATTERNS (THIS PROJECT)
- Never make direct API calls without rate limiting
- Don't store provider credentials in plain text
- Avoid provider-specific logic outside adapter classes

## UNIQUE STYLES
- Adapter pattern for consistent provider interface
- Chunked upload implementation across all providers
- Provider-specific retry strategies
- Unified error handling despite diverse provider APIs