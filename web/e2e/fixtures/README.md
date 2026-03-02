# E2E Test Fixtures

## Preflight Checks (OPS-E2E-READY@QA-1)

Before running E2E tests, the suite performs preflight checks to ensure the API is ready.

### API Readiness Check

- **Endpoint**: `http://127.0.0.1:8100/api/health`
- **Max Retries**: 30
- **Retry Delay**: 1000ms
- **Total Timeout**: 30 seconds

### Configuration

Set environment variables to customize preflight behavior:

```bash
# Custom API URL (default: http://127.0.0.1:8100)
export PLAYWRIGHT_API_URL="http://localhost:8100"

# Run tests
npm run test:e2e
```

### Error Messages

If the API is not reachable, you'll see a clear error message:

```
❌ E2E Preflight Failed: API not reachable
   URL: http://127.0.0.1:8100
   Attempts: 30
   Timeout: 30s

   Troubleshooting:
   1. Ensure API server is running: npm run dev (API port 8100)
   2. Check API logs for startup errors
   3. Verify port 8100 is not blocked by firewall
   4. Set PLAYWRIGHT_API_URL env var if using non-default port
```

### Files

- `global-setup.ts` - Preflight checks before tests
- `global-teardown.ts` - Cleanup after tests
- `playwright.config.ts` - Updated with global setup/teardown hooks

### Running Tests

```bash
# Run all E2E tests (includes preflight)
npm run test:e2e

# Run specific test file
npm run test:e2e -- e2e/localhost-qa.spec.ts

# Run with custom API URL
PLAYWRIGHT_API_URL=http://localhost:8100 npm run test:e2e

# Run in headed mode for debugging
npm run test:e2e:headed
```
