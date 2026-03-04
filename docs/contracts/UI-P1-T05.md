# Contract: UI-P1-T05 - Explicit UI Error Surfaces for Failed Requests

## Overview
This contract defines the explicit UI error surfaces for failed sync, proxy, and favorites requests in the CacheFlow application.

## Files Created/Modified

### 1. components/UnifiedFileBrowser.tsx
- **Purpose**: Enhanced file browser component with explicit error handling surfaces
- **Location**: `/web/components/UnifiedFileBrowser.tsx`
- **Changes**: Added error handling methods for sync, proxy, and favorites requests with toast notifications

### 2. lib/ui/toast.ts
- **Purpose**: Toast notification API for UI error surfaces
- **Location**: `/web/lib/ui/toast.ts`
- **Changes**: Created toast utility module with consistent error notification functionality

### 3. app/api/connections/route.ts
- **Purpose**: API routes for connection management with explicit error surfaces
- **Location**: `/web/app/api/connections/route.ts`
- **Changes**: Enhanced existing connections API with explicit error responses for sync, proxy, and favorites requests

## API Endpoints

### GET /api/connections
- **Purpose**: Fetch all provider connections
- **Request Headers**:
  - `Authorization`: Required authentication token
  - `Cookie`: Session cookies (if applicable)
- **Success Response**:
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "string",
        "provider": "string",
        "accountKey": "string",
        "remoteId": "string",
        "accountName": "string",
        "accountEmail": "string",
        "accountLabel": "string",
        "isDefault": "boolean",
        "status": "connected|disconnected|error",
        "lastSyncAt": "string|null"
      }
    ]
  }
  ```
- **Error Response**:
  ```json
  {
    "success": false,
    "error": "string",
    "requestError": {
      "type": "sync",
      "message": "string",
      "operation": "string",
      "details": {
        "statusCode": "number",
        "statusText": "string",
        "error": "string",
        "stack": "string"
      }
    }
  }
  ```

### POST /api/connections/test-proxy
- **Purpose**: Test proxy requests with explicit error surfaces
- **Request Body**:
  ```json
  {
    "url": "string",
    "method": "string",
    "headers": "object",
    "body": "any"
  }
  ```
- **Success Response**:
  ```json
  {
    "success": true,
    "data": "any"
  }
  ```
- **Error Response**:
  ```json
  {
    "success": false,
    "error": "string",
    "requestError": {
      "type": "proxy",
      "message": "string",
      "url": "string",
      "operation": "string",
      "details": {
        "statusCode": "number",
        "statusText": "string",
        "error": "string",
        "stack": "string"
      }
    }
  }
  ```

### PUT /api/connections/favorites
- **Purpose**: Handle favorites requests with explicit error surfaces
- **Request Headers**:
  - `Authorization`: Required authentication token
- **Request Body**:
  ```json
  {
    "action": "string",
    "fileId": "string",
    "provider": "string",
    "accountKey": "string"
  }
  ```
- **Success Response**:
  ```json
  {
    "success": true,
    "data": {
      "message": "string",
      "fileId": "string",
      "provider": "string",
      "accountKey": "string"
    }
  }
  ```
- **Error Response**:
  ```json
  {
    "success": false,
    "error": "string",
    "requestError": {
      "type": "favorites",
      "message": "string",
      "operation": "string",
      "details": {
        "requiredFields": ["string"],
        "providedFields": ["string"],
        "error": "string",
        "stack": "string"
      }
    }
  }
  ```

## Error Codes

| Code | Type | Description |
|------|------|-------------|
| 400 | Client Error | Missing required fields in request |
| 401 | Authentication Error | Unauthorized access - invalid or missing authentication |
| 500 | Server Error | Internal server error during request processing |

## Error Types

### Sync Errors (`type: "sync"`)
- Occur during provider connection synchronization
- Include details about the specific operation that failed
- Examples: GET /api/remotes, connection establishment

### Proxy Errors (`type: "proxy"`)
- Occur during proxy requests to external services
- Include details about the URL and operation that failed
- Examples: External API calls, file downloads/uploads

### Favorites Errors (`type: "favorites"`)
- Occur during favorites operations
- Include details about the action and file that failed
- Examples: Adding/removing favorite files

## Edge Cases

1. **Network Timeout**: Requests that timeout will return a 500 error with a timeout-specific message
2. **Invalid Authentication Token**: Expired or malformed tokens return 401 errors
3. **Provider Service Unavailable**: When external provider services are down, errors include provider-specific details
4. **Malformed Request Bodies**: Invalid JSON or missing required fields return 400 errors

## Example Payloads

### Sync Error Example:
```json
{
  "success": false,
  "error": "Failed to fetch connections from server",
  "requestError": {
    "type": "sync",
    "message": "Failed to fetch connections from server. Status: 503",
    "operation": "GET /api/remotes",
    "details": {
      "statusCode": 503,
      "statusText": "Service Unavailable"
    }
  }
}
```

### Proxy Error Example:
```json
{
  "success": false,
  "error": "Proxy request failed with status 404",
  "requestError": {
    "type": "proxy",
    "message": "Proxy request failed. Status: 404",
    "url": "https://api.example.com/data",
    "operation": "POST /api/connections/test-proxy",
    "details": {
      "statusCode": 404,
      "statusText": "Not Found"
    }
  }
}
```

### Favorites Error Example:
```json
{
  "success": false,
  "error": "Action and fileId are required for favorites operations",
  "requestError": {
    "type": "favorites",
    "message": "Missing required fields for favorites operation",
    "operation": "PUT /api/connections/favorites",
    "details": {
      "requiredFields": ["action", "fileId"],
      "providedFields": ["provider"]
    }
  }
}
```