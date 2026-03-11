# URM-69: APP-10 Auth Noise Audit

## Scope

Audit and fix authentication-related noise in layout, prefetch, and background requests.

## Issues Identified

1. Inconsistent credential handling across API calls
2. Unnecessary console 401 noise when handling unauthenticated states
3. Background requests not consistently sending credentials where required
4. Auth interceptor causing false-negative E2E failures

## Solution Approach

1. Standardize credential handling to consistently use `credentials: 'include'` for same-origin requests
2. Improve unauthenticated state handling to reduce console noise
3. Ensure all auth-intercepted requests properly include credentials
4. Fix redirect behavior in auth interceptor to prevent unnecessary navigation

## Files Modified

- `web/lib/interceptors/authInterceptor.ts` - Improve credential handling and error management
- `web/lib/api.ts` - Ensure consistent credential usage
- `web/components/SessionExpiredBannerHost.tsx` - Reduce console noise
- Various page and component files with fetch calls

## Verification

- Test auth flow with expired sessions
- Verify background requests work properly
- Confirm E2E tests pass without auth noise
