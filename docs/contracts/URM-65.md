# Contract: URM-65 - APP-09 Health Endpoint


## Feature Description

Implement an unauthenticated GET `/api/health` endpoint that returns system health metrics including status, timestamp, memory usage, and uptime.


## Scope

- Add Next.js API route at `/web/app/api/health/route.ts`
- Endpoint returns health data without authentication
- Response includes:
  - status: Current system status ("ok" or "error")
  - timestamp: ISO-formatted current timestamp
  - memory: Memory usage statistics (rss, heapTotal, heapUsed, external)
  - uptime: System uptime in seconds


## Implementation Details

- Route: `GET /api/health`
- Method: GET
- Authentication: None (unauthenticated)
- Response Format: JSON
- Success Status: 200 OK (forwarded from backend)
- Error Status: 502 Bad Gateway when backend is unreachable


## Verification Steps

1. Access `/api/health` endpoint without authentication
2. Verify response matches backend /health endpoint response
3. Confirm non-2xx responses from backend are forwarded unchanged
4. Test error handling when backend is unreachable (should return 502)
5. Validate timeout behavior when backend is unresponsive


## API Response Schema

```json

{
  "status": "ok",
  "timestamp": "2026-03-11T12:00:00.000Z",
  "memory": {
    "rss": 123456789,
    "heapTotal": 123456789,
    "heapUsed": 123456789,
    "external": 123456789
  },
  "uptime": 12345
}

```


## Error Response Schema

```json

{
  "status": "error",
  "timestamp": "2026-03-11T12:00:00.000Z",
  "error": "Backend health service unavailable"
}

```


## Integration Notes

- Proxies the existing /health endpoint in the backend at http://127.0.0.1:8100/health
- Non-2xx responses from backend are forwarded unchanged
- Returns 502 when backend is unreachable or times out
- Uses 10 second timeout for backend requests
- Should be accessible without authentication for infrastructure monitoring
