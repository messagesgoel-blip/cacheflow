# CacheFlow API Contract

This document defines the production-grade API contract for file actions and observability.

## Standard Response Envelope

All API responses follow a standard JSON envelope.

### Success Path
- **Status:** 200 OK
- **Payload:**
```json
{
  "ok": true,
  "data": { ... },
  "requestId": "uuid-v4",
  "correlationId": "client-provided-correlation-id"
}
```

### Failure Path
- **Status:** 4xx or 5xx
- **Payload:**
```json
{
  "ok": false,
  "error": "Error message",
  "code": 400,
  "details": { ... },
  "requestId": "uuid-v4",
  "correlationId": "client-provided-correlation-id"
}
```

## Status Code Matrix

| Code | Meaning |
|------|---------|
| 200  | Success |
| 400  | Bad Request (missing parameters, invalid format) |
| 401  | Unauthenticated (missing or invalid Bearer token) |
| 403  | Unauthorized (valid token but insufficient permissions) |
| 404  | Not Found (file or path does not exist) |
| 409  | Conflict (file already exists at destination) |
| 500  | Internal Server Error |

## Endpoints

### 1. Rename File
- **Method:** `PATCH`
- **Path:** `/api/files/rename`
- **Body:**
```json
{
  "id": "file-id",
  "newName": "new-name.txt"
}
```

### 2. Move File
- **Method:** `POST`
- **Path:** `/api/files/move`
- **Body:**
```json
{
  "id": "file-id",
  "newParentPath": "path/to/destination"
}
```

### 3. Download File
- **Method:** `POST`
- **Path:** `/api/files/download`
- **Body:**
```json
{
  "id": "file-id"
}
```
- **Response:** Binary stream with `Content-Disposition: attachment`.

### 4. Share File
- **Method:** `POST`
- **Path:** `/api/share`
- **Body:**
```json
{
  "id": "file-id",
  "password": "optional-password",
  "expires_in_hours": 24,
  "max_downloads": 5
}
```

## Observability

### Correlation ID
Clients should pass `X-Correlation-Id` in headers. This ID is propagated back in responses and used in server logs to trace a single UI action through the backend.

### Request ID
Every request is assigned a unique `requestId` by the server, returned in `X-Request-Id` header and the JSON payload.

## Example Curl

```bash
# Rename
curl -X PATCH http://localhost:3011/api/files/rename 
  -H "Authorization: Bearer <token>" 
  -H "Content-Type: application/json" 
  -H "X-Correlation-Id: abc-123" 
  -d '{"id": "file-123", "newName": "renamed.txt"}'

# Move
curl -X POST http://localhost:3011/api/files/move 
  -H "Authorization: Bearer <token>" 
  -H "Content-Type: application/json" 
  -d '{"id": "file-123", "newParentPath": "documents"}'
```
