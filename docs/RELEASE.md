# CacheFlow PILOT RELEASE - May 21, 2026

## Overview
CacheFlow is a self-hosted file sync and backup solution with AI-powered conflict resolution.

## Features Implemented

### Core Sync
- File upload/download with SHA-256 deduplication
- Automatic background sync with configurable interval
- Conflict detection and resolution
- Support for multiple storage backends (local, S3, Google Drive, MilesWeb)

### WebDAV Access
- WebDAV server on port 8180
- htpasswd authentication
- Access files from any WebDAV client (Windows Explorer, macOS Finder)

### Security
- AES-256 encryption at rest
- TLS 1.3 for all connections
- Helmet security headers (CSP, HSTS)
- CORS configuration
- Zero-Retention for AI processing (plaintext never stored)

### AI Conflict Resolution
- Multi-format support: .txt, .md, .py, .js, .ts, .tsx, .csv, .json
- Anthropic API integration
- Clean merge with conflict markers

### Monitoring
- Audit logging for all operations
- Performance baseline metrics
- Health check endpoints
- Redis queue monitoring

### Rate Limiting
- Global: 200 req/min
- Upload: 30 req/min
- Auth: 10 req/15 min

## Services
| Service | Port | Status |
|---------|------|--------|
| API | 8100 | Running |
| Web | 3010 | Running |
| WebDAV | 8180 | Running |
| Postgres | 5433 | Running |
| Redis | 6380 | Running |

## Quick Start
1. Access web UI: http://cacheflow.goels.in
2. Register a new account
3. Upload files via web UI or WebDAV
4. Files sync automatically to configured backends

## API Documentation
See `/docs/api.md` for full API reference.

## Known Limitations
- E2E tests require direct network access to API (skipped in containerized QA)
- AI merge requires ANTHROPIC_API_KEY environment variable

## Version
PILOT-1.0.0 (May 21, 2026)
