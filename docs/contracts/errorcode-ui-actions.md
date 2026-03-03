# ErrorCode → UI Action Contract

> **Binding contract** between API and UI implementations. All API error responses MUST return the appropriate `ErrorCode`, and UI MUST handle each code as specified below.

## ErrorCode → UI Response Mapping

| ErrorCode | UI Response |
| --- | --- |
| `TOKEN_EXPIRED` | SessionExpiredBanner with Reconnect button (Sprint 1.17) |
| `REFRESH_FAILED` | Force logout → redirect to `/login?reason=session_expired` |
| `RATE_LIMITED` | Amber tray status `Rate limited — retrying in Xs` with countdown |
| `PROVIDER_UNAVAILABLE` | Red health dot in sidebar + `Provider offline` badge on Connections page |
| `CHUNK_FAILED` | Transfer tray shows `Chunk failed — retrying (attempt N of 5)` |
| `QUOTA_EXCEEDED` | Upgrade modal with storage summary (modal, not toast) |
| `SHARE_ABUSE_LIMIT` | Inline error on Share Link panel: `Daily limit reached` |
| `VAULT_LOCKED` | Redirect to vault unlock modal |
| `NOT_FOUND` | Bottom-right toast: `File not found — it may have been moved or deleted` |
| `FORBIDDEN` | Contextual handling by action-specific flows (share links, vault, etc.) |

## Default Fallback

Any `ErrorCode` not listed above defaults to a **bottom-right error toast** using `AppError.message`.

## Implementation Requirements

### API
- OpenCode MUST return these `ErrorCode` values in matching API scenarios
- Error response format:
  ```json
  {
    "error": {
      "code": "TOKEN_EXPIRED",
      "message": "Access token has expired"
    }
  }
  ```

### UI
- All API errors MUST be caught and routed through this contract
- No raw error messages should be displayed to users
- Toast notifications use the `toast.error()` component with appropriate duration

## Related Tasks

- Task 0.2: Define AppError taxonomy and ErrorCode enum (`/lib/errors/AppError.ts`, `/lib/errors/ErrorCode.ts`)
- Task 1.17: Replace SESSION_EXPIRED raw text with actionable component (`SessionExpiredBanner.tsx`)
