# Contract: UI-P1-T02
## Endpoint or File Path
- `app/api/remotes/[uuid]/proxy/route.ts`
- Endpoint: `POST /api/remotes/[uuid]/proxy`

## Request / Response Shape
- Request body:
  - `method: string`
  - `url: string`
  - `headers?: Record<string, string>`
  - `body?: any`
- Success response:
  - `{ success: true, data: any }`
- Error response:
  - `{ success: false, error: string, requiresReauth?: boolean }`
- Behavior:
  - Proxies request to target URL.
  - On upstream `401`, performs single refresh via `/api/auth/refresh` and retries once.

## Error Codes
- `400`: missing target `url`.
- `401`: refresh failed or retry still unauthorized (`requiresReauth: true`).
- `500`: proxy execution/parsing failure.

## Edge Cases
- Concurrent refresh is deduplicated by singleton `refreshPromise`.
- Upstream non-JSON responses are supported (falls back to text parsing).
- Security scan wrapper (`withSecurityScan`) is applied before returning payload.

## Example Payload
```json
{
  "method": "GET",
  "url": "https://www.googleapis.com/drive/v3/files",
  "headers": {
    "Accept": "application/json"
  }
}
```

