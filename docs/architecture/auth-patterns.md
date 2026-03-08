# Auth Patterns

## Singleton Refresh Promise Pattern (AUTH-4)

### Problem

When multiple concurrent requests receive a 401 (Unauthorized) response, each request might independently trigger a token refresh. This leads to:

- **Race conditions**: Multiple refresh requests executing simultaneously
- **Unnecessary API calls**: Redundant token refresh operations
- **State inconsistency**: Some requests might use stale tokens while refresh is in progress

### Solution

The `RefreshGuard` class implements a singleton refresh promise pattern that ensures only one token refresh executes at a time, even when multiple 401s occur concurrently.

### Implementation

```typescript
import { initRefreshGuard, getRefreshGuard } from './refreshGuard';

// Initialize with your refresh function
initRefreshGuard(async () => {
  const response = await fetch('/api/auth/refresh', {
    method: 'POST',
    credentials: 'include',
  });
  const data = await response.json();
  return data.accessToken;
});

// Use in your auth flow
async function getValidToken(): Promise<string> {
  const guard = getRefreshGuard();
  return guard.getToken();
}
```

### Key Features

1. **Singleton Promise**: Returns the same promise for all concurrent requests during refresh
2. **Automatic Cleanup**: Clears the promise after refresh completes (success or failure)
3. **Initialization Required**: Must be initialized before use with `initRefreshGuard()`

### API

| Method | Description |
|--------|-------------|
| `initRefreshGuard(fn)` | Initialize with a refresh function |
| `getRefreshGuard()` | Get the singleton instance |
| `guard.getToken()` | Get token, waits for ongoing refresh if active |
| `guard.isRefreshing()` | Check if refresh is in progress |
| `guard.reset()` | Manually reset state |

### Integration with Auth Interceptor

The refresh guard integrates with the auth interceptor to prevent concurrent refresh race conditions while handling 401 responses.

