# Contract: OPS-E2E-READY
## Add Playwright preflight wait-for-api on 127.0.0.1:8100

### Endpoint URL
- Primary: `http://127.0.0.1:8100/health`
- Fallback: `http://127.0.0.1:8100/api/health`

### Request/Response Shape
#### Health Check Request:
```
GET /health HTTP/1.1
Accept: application/json
Host: 127.0.0.1:8100
```

#### Expected Response:
```
HTTP/1.1 200 OK
Content-Type: application/json

{
  "status": "ok",
  "timestamp": "2026-03-04T12:00:00Z"
}
```

### Error Codes
- `200`: API service is healthy and responding
- `401`: API service is reachable (for `/api/health` endpoint, indicates auth is working)
- Network Error: API service is not accessible

### Edge Cases
- API server is starting up but not fully ready
- Port 8100 is blocked by firewall
- API server is running on different host/port
- Environment variable `PLAYWRIGHT_API_URL` overrides default URL
- Authentication required for health endpoints

### Example Payload
```typescript
// Example successful response
{
  "status": "ok",
  "version": "1.0.0",
  "uptime": 12345
}

// Example error scenario
throw new Error(
  `\n❌ E2E Preflight Failed: API not reachable\n` +
  `   URL: http://127.0.0.1:8100\n` +
  `   Attempts: 30\n` +
  `   Timeout: 30s\n`
);
```

### Configuration
- Max Retries: 30 attempts
- Retry Delay: 1000ms between attempts
- Total Timeout: 30 seconds
- Environment Variable: `PLAYWRIGHT_API_URL` (optional override)