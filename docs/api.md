# CacheFlow API Documentation

## Base URL
```
Production: https://cacheflow.goels.in
Development: http://127.0.0.1:8100
```

## Authentication
All endpoints (except `/auth/*` and `/health`) require a Bearer token:
```
Authorization: Bearer <token>
```

## Endpoints

### Health
- `GET /health` - Service health check
  - Returns: `{ status, db, ts }`

### Auth
- `POST /auth/register` - Register new user
  - Body: `{ email, password, name }`
  - Returns: `{ user, token }`

- `POST /auth/login` - Login
  - Body: `{ email, password }`
  - Returns: `{ token, user }`

### Files
- `GET /files` - List user's files
  - Query: `?status=synced&limit=50`
  - Returns: `{ files: [...] }`

- `POST /files/upload` - Upload file (multipart)
  - Body: `file` (multipart form)
  - Returns: `{ file }`

- `GET /files/:id` - Get file metadata
  - Returns: `{ file }`

- `GET /files/:id/download` - Download file
  - Returns: File stream

- `DELETE /files/:id` - Delete file
  - Returns: `{ success }`

- `POST /files/:id/retry` - Retry failed sync
  - Returns: `{ success }` or 404 if not in error state

### Shares
- `POST /share` - Create share link
  - Body: `{ file_id, expires_in }`
  - Returns: `{ share_id, url }`

- `GET /share/:share_id` - Download via share link
  - Returns: File stream (public, no auth needed)

### Conflicts
- `GET /conflicts` - List active conflicts
  - Returns: `{ conflicts: [...] }`

- `GET /conflicts/:id` - Get conflict details
  - Returns: `{ conflict }`

- `POST /conflicts/:id/resolve` - Resolve manually
  - Body: `{ resolution: "keep_local" | "keep_remote" }`
  - Returns: `{ success, resolution }`

- `POST /conflicts/:id/ai-merge` - AI-powered merge
  - Body: `{ model }` (optional)
  - Returns: `{ merged_content, merge_type, model }`
  - Supported types: .txt, .md, .py, .js, .ts, .tsx, .csv, .json

### Search
- `GET /search?q=query` - Search files by name
  - Returns: `{ results: [...] }`

### Admin
- `GET /admin/audit` - View audit logs (admin only)
  - Query: `?limit=50&action=upload`
  - Returns: `{ logs: [...] }`

- `GET /admin/stats` - System statistics
  - Returns: `{ files, users, storage }`

## Rate Limits
- Global: 200 requests/minute
- Upload: 30 requests/minute
- Auth: 10 requests/15 minutes

## Error Codes
- 400 - Bad Request
- 401 - Unauthorized
- 404 - Not Found
- 422 - Unprocessable Entity
- 429 - Too Many Requests
- 500 - Internal Server Error
