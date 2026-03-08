# Contract: UI-P1-T04 - File Actions for Connected Drives

## Endpoint URLs

- Rename: `POST /api/remotes/[uuid]/actions/rename`
- Move: `POST /api/remotes/[uuid]/actions/move`
- Download: `POST /api/remotes/[uuid]/actions/download`
- Delete: `POST /api/remotes/[uuid]/actions/delete`

## Request/Response Shapes

### Rename Action
**Request:**
```json
{
  "fileId": "string",
  "newName": "string",
  "provider": "string"
}
```

**Response:**
```json
{
  "success": boolean,
  "data"?: any,
  "error"?: string,
  "requiresReauth"?: boolean
}
```

### Move Action
**Request:**
```json
{
  "fileId": "string",
  "newParentId": "string",
  "newName"?: "string"
  "provider": "string"
}
```

**Response:**
```json
{
  "success": boolean,
  "data"?: any,
  "error"?: string,
  "requiresReauth"?: boolean
}
```

### Download Action
**Request:**
```json
{
  "fileId": "string",
  "provider": "string",
  "exportFormat"?: "string"
}
```

**Response:**
- Success: Binary file content with appropriate headers
- Error: JSON response
```json
{
  "success": boolean,
  "error"?: string,
  "requiresReauth"?: boolean
}
```

### Delete Action
**Request:**
```json
{
  "fileId": "string",
  "provider": "string"
}
```

**Response:**
```json
{
  "success": boolean,
  "data"?: any,
  "error"?: string,
  "requiresReauth"?: boolean
}
```

## Error Codes

- `400`: Bad Request - Missing required fields or invalid parameters
- `401`: Unauthorized - Authentication expired, requires re-authentication
- `404`: Not Found - File or parent folder not found
- `500`: Internal Server Error - Unexpected server error

## Edge Cases

- Token refresh failure during operation
- Provider-specific limitations (e.g., Dropbox requires full path, not just file ID)
- Large file downloads that may timeout
- File conflicts during rename/move operations
- Insufficient permissions for the requested operation
- Provider API rate limiting

## Example Payload

**Rename Example:**
```json
{
  "fileId": "1a2b3c4d5e6f",
  "newName": "updated-document.pdf",
  "provider": "google"
}
```

**Move Example:**
```json
{
  "fileId": "1a2b3c4d5e6f",
  "newParentId": "7g8h9i0jklm",
  "provider": "onedrive"
}
```

**Download Example:**
```json
{
  "fileId": "1a2b3c4d5e6f",
  "provider": "google",
  "exportFormat": "application/pdf"
}
```

**Delete Example:**
```json
{
  "fileId": "1a2b3c4d5e6f",
  "provider": "box"
}
```
