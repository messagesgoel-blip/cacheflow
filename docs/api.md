# CacheFlow API Documentation

## Base URL
- Production: `https://cacheflow.goels.in`
- Development: `http://127.0.0.1:8100`

## Authentication
All endpoints are bearer-token protected except:
- `GET /health`
- `GET /share/:token`
- `POST /auth/register`
- `POST /auth/login`

Header format:
`Authorization: Bearer <token>`

## Endpoints

### Health
- `GET /health`
  - Returns: `{ status, db, ts }`

### Auth
- `POST /auth/register`
  - Body: `{ email, password }`
  - Returns: `{ user, token }`
- `POST /auth/login`
  - Body: `{ email, password }`
  - Returns: `{ user, token }`
- `GET /auth/me`
  - Returns: `{ user }`

### Files
- `GET /files`
  - Returns: `{ files, count }`
- `POST /files/upload`
  - Multipart body: `file`
  - Optional query: `?path=<folder-or-filepath>`
  - Returns: `{ file }`
- `GET /files/:id/download`
  - Returns: file stream
- `PATCH /files/:id`
  - Body (optional): `{ path, status, synced_at, hash }`
  - Returns: `{ file }`
- `DELETE /files/:id`
  - Returns: `{ deleted, id }`
- `POST /files/:id/share`
  - Body (optional): `{ password, expires_in_hours, max_downloads }`
  - Returns: `{ share_url, token, expires_at, max_downloads, password_protected }`
- `POST /files/:id/retry`
  - Returns: `{ retrying, id, retry_count }`
- `GET /files/usage`
  - Returns usage summary for authenticated user
- `GET /files/browse?path=/optional/subdir`
  - Returns folder/file listing for browser UI
- `POST /files/folders`
  - Body: `{ path }`
  - Returns: created folder metadata
- `DELETE /files/folders?path=/folder/to/delete`
  - Returns delete result
- `PATCH /files/:id/move`
  - Body: `{ newPath }`
  - Returns moved file metadata

### Shares
- `GET /share/:token`
  - Public download by token
  - If password-protected, pass via `x-share-password` header or `?password=` query

### Conflicts
- `GET /conflicts`
  - Returns: `{ conflicts }`
- `GET /conflicts/:id`
  - Returns: `{ conflict }`
- `POST /conflicts/:id/resolve`
  - Body: `{ resolution: "keep_local" | "keep_remote" }`
  - Returns: `{ success, resolution, note }`
- `POST /conflicts/:id/ai-merge`
  - Body (optional): `{ model }`
  - Returns: `{ merged_content, merge_type, model }`

### Search
- `GET /search?q=<query>`
  - Returns: `{ results, count }`

### Storage
- `GET /storage/locations`
  - Returns storage locations and sync summary
- `GET /storage/usage`
  - Returns quota and usage breakdown

### Admin
- `POST /admin/files/:id/lock`
  - Body: `{ retention_days }`
  - Returns: `{ immutable_until }`
- `DELETE /admin/files/:id/lock`
  - Returns: `{ success }`
- `GET /admin/audit?limit=50&offset=0&user_id=&action=`
  - Returns: `{ audit_logs, limit, offset }`

## Rate Limits
Configured in API middleware:
- Global: `200 requests / minute / IP`
- Upload endpoint: `30 requests / minute / IP`
- Auth endpoints: default `60 requests / 15 minutes / IP` (configurable via env)
- Local/private IP traffic is exempt for some limiters

## Common Error Codes
- `400` bad request
- `401` unauthorized
- `403` forbidden
- `404` not found
- `409` conflict
- `413` payload too large / quota exceeded
- `422` unprocessable entity
- `429` too many requests
- `500` internal server error

