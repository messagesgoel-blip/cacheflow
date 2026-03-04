# Data Model Architecture

## Overview

This document describes the complete database schema for CacheFlow, covering:
- **AUTH-2**: Token vault with encrypted credentials, multi-account support
- **TRANSFER-1**: Transfer job tracking, rate limiting, audit logging
- **VAULT-1**: Encrypted at-rest storage for provider credentials

## Entity Relationship Diagram

```
Tenant (1) ─────< (N) User
  │                  │
  │                  ├─< (N) File
  │                  ├─< (N) Conflict
  │                  ├─< (N) SharedLink
  │                  ├─< (N) Token (AUTH-2, VAULT-1)
  │                  ├─< (N) OAuthToken (AUTH-1)
  │                  ├─< (N) UserRemote
  │                  ├─< (N) AuditLog (TRANSFER-1)
  │                  ├─< (N) Transfer (TRANSFER-1)
  │                  ├─< (N) RateLimit (TRANSFER-1)
  │                  └─< (N) CloudConfig
  │
  └─< (N) AdminNotification
```

## Core Tables

### Tenant
Multi-tenant support for isolated workspaces.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique tenant identifier |
| name | VARCHAR(255) | NOT NULL | Display name |
| slug | VARCHAR(100) | UNIQUE, NOT NULL | URL-friendly identifier |
| plan | VARCHAR(50) | DEFAULT 'free' | Subscription plan |
| quotaBytes | BIGINT | DEFAULT 100GB | Storage quota |
| active | BOOLEAN | DEFAULT true | Tenant active status |
| createdAt | TIMESTAMP | DEFAULT NOW | Creation timestamp |
| updatedAt | TIMESTAMP | auto | Last modification |

### User
End-user accounts with authentication and quota tracking.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique user identifier |
| email | VARCHAR(255) | UNIQUE, NOT NULL | User email |
| passwordHash | VARCHAR(255) | NOT NULL | Bcrypt hashed password |
| tenantId | UUID | FK → tenants | Tenant association |
| quotaBytes | BIGINT | DEFAULT 10GB | User storage quota |
| usedBytes | BIGINT | DEFAULT 0 | Current usage |
| twoFactorEnabled | BOOLEAN | DEFAULT false | 2FA status |
| twoFactorSecret | BYTEA | NULLABLE | Encrypted TOTP secret |
| twoFactorBackupCodes | TEXT[] | NULLABLE | Hashed backup codes |
| createdAt | TIMESTAMP | DEFAULT NOW | Creation timestamp |
| updatedAt | TIMESTAMP | auto | Last modification |

**Indexes:**
- `idx_users_email` on `email`
- `idx_users_tenant_id` on `tenant_id`

### File
Metadata cache for files tracked by CacheFlow.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique file identifier |
| userId | UUID | FK → users, NOT NULL | Owner |
| tenantId | UUID | FK → tenants | Tenant isolation |
| path | TEXT | NOT NULL | Full path |
| sizeBytes | BIGINT | NOT NULL | File size |
| hash | VARCHAR(64) | NULLABLE | Content hash (SHA-256) |
| status | VARCHAR(20) | DEFAULT 'pending' | sync status |
| lastModified | TIMESTAMP | NULLABLE | Last modification time |
| syncedAt | TIMESTAMP | NULLABLE | Last sync time |
| createdAt | TIMESTAMP | DEFAULT NOW | Creation timestamp |

**Constraints:**
- UNIQUE(`userId`, `path`)

**Indexes:**
- `idx_files_user_path` on `(userId, path)`
- `idx_files_user_status` on `(userId, status)`
- `idx_files_modified` on `last_modified DESC`

## Authentication & Vault (AUTH-2, VAULT-1)

### Token
Encrypted at-rest storage for provider credentials. Part of Token Vault v1.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique token identifier |
| userId | UUID | FK → users, NOT NULL | Owner |
| provider | VARCHAR(50) | NOT NULL | Provider ID (google, dropbox, etc.) |
| encryptedCredentials | BYTEA | NOT NULL | AES-256-GCM encrypted JSON |
| encryptionVersion | INTEGER | DEFAULT 1 | Key rotation support |
| expiresAt | TIMESTAMP | NULLABLE | Token expiration |
| isActive | BOOLEAN | DEFAULT true | Active status |
| accountLabel | VARCHAR(50) | DEFAULT 'Primary' | Account name |
| accountOrder | INTEGER | DEFAULT 1 | Display order (1-3) |
| isDefault | BOOLEAN | DEFAULT false | Default account |
| remoteId | VARCHAR(255) | NULLABLE | Provider's account ID |
| lastUsedAt | TIMESTAMP | NULLABLE | Last usage time |
| createdAt | TIMESTAMP | DEFAULT NOW | Creation timestamp |
| updatedAt | TIMESTAMP | auto | Last modification |

**Constraints:**
- UNIQUE(`userId`, `provider`, `accountLabel`)
- CHECK: `accountOrder` BETWEEN 1 AND 3
- Unique default: `idx_tokens_user_provider_default` on (`userId`, `provider`) WHERE `is_default = true`

**Multi-Account Support:**
- Maximum 3 accounts per provider per user
- `accountOrder` values: 1, 2, or 3
- Only one `is_default = true` per provider

### OAuthToken
OAuth token storage with multi-account support.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique token identifier |
| userId | UUID | FK → users, NOT NULL | Owner |
| provider | VARCHAR(50) | NOT NULL | Provider ID |
| providerAccountId | VARCHAR(255) | NULLABLE | Provider's account ID |
| accessToken | TEXT | NOT NULL | Encrypted access token |
| refreshToken | TEXT | NULLABLE | Encrypted refresh token |
| expiresAt | TIMESTAMP | NULLABLE | Token expiration |
| scope | TEXT | NULLABLE | Granted permissions |
| accountLabel | VARCHAR(50) | DEFAULT 'Primary' | Account name |
| accountOrder | INTEGER | DEFAULT 1 | Display order |
| isDefault | BOOLEAN | DEFAULT false | Default account |
| createdAt | TIMESTAMP | DEFAULT NOW | Creation timestamp |
| updatedAt | TIMESTAMP | auto | Last modification |

**Constraints:**
- UNIQUE(`userId`, `provider`, `providerAccountId`)

### UserRemote
Server-side credential persistence for provider connections.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique remote identifier |
| userId | UUID | FK → users, NOT NULL | Owner |
| provider | VARCHAR(50) | NOT NULL | Provider ID |
| accountKey | VARCHAR(255) | NOT NULL | Account key |
| accountId | VARCHAR(255) | NULLABLE | Provider account ID |
| accountEmail | VARCHAR(255) | NULLABLE | Account email |
| displayName | VARCHAR(255) | NULLABLE | Display name |
| accessTokenEnc | TEXT | NOT NULL | Encrypted access token |
| refreshTokenEnc | TEXT | NULLABLE | Encrypted refresh token |
| expiresAt | TIMESTAMP | NULLABLE | Token expiration |
| disabled | BOOLEAN | DEFAULT false | Connection disabled |
| keyVersion | VARCHAR(16) | DEFAULT '1' | Encryption version |
| createdAt | TIMESTAMP | DEFAULT NOW | Creation timestamp |
| updatedAt | TIMESTAMP | auto | Last modification |
| lastUsedAt | TIMESTAMP | NULLABLE | Last usage |

**Constraints:**
- UNIQUE(`userId`, `provider`, `accountKey`)

## Transfers (TRANSFER-1)

### Transfer
Persistent history of file transfer operations.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique transfer identifier |
| userId | UUID | FK → users, NOT NULL | Owner |
| sourceProvider | VARCHAR(50) | NOT NULL | Source provider |
| destProvider | VARCHAR(50) | NOT NULL | Destination provider |
| fileId | VARCHAR(255) | NOT NULL | File ID on provider |
| fileName | VARCHAR(255) | NOT NULL | File name |
| fileSize | BIGINT | NOT NULL | File size in bytes |
| operation | VARCHAR(20) | NOT NULL | 'copy', 'move', 'upload', 'download' |
| status | VARCHAR(20) | DEFAULT 'pending' | Transfer status |
| progress | INTEGER | DEFAULT 0 | Progress percentage (0-100) |
| sourceFolderId | VARCHAR(255) | NULLABLE | Source folder |
| destFolderId | VARCHAR(255) | NULLABLE | Destination folder |
| errorMessage | TEXT | NULLABLE | Error details |
| retryCount | INTEGER | DEFAULT 0 | Retry attempts |
| startedAt | TIMESTAMP | NULLABLE | Start time |
| completedAt | TIMESTAMP | NULLABLE | Completion time |
| createdAt | TIMESTAMP | DEFAULT NOW | Creation timestamp |
| updatedAt | TIMESTAMP | auto | Last modification |

**Status Values:**
- `pending` - Waiting in queue
- `running` - Currently processing
- `completed` - Successfully finished
- `failed` - Failed with error
- `cancelled` - User cancelled

**Indexes:**
- `idx_transfers_user_id` on `userId`
- `idx_transfers_status` on `status`
- `idx_transfers_created_at` on `createdAt DESC`

**Note:** Active transfers are managed via BullMQ/Redis queue. This table stores persistent history and enables:
- Transfer history viewing
- Retry failed transfers
- Analytics and reporting
- Resume after server restart

### RateLimit
Provider-specific rate limit tracking.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| userId | UUID | NOT NULL | User |
| provider | VARCHAR(50) | NOT NULL | Provider |
| action | VARCHAR(50) | NOT NULL | Action type |
| count | INTEGER | DEFAULT 0 | Request count |
| windowStart | TIMESTAMP | NOT NULL | Window start time |
| createdAt | TIMESTAMP | DEFAULT NOW | Creation timestamp |
| updatedAt | TIMESTAMP | auto | Last modification |

**Constraints:**
- UNIQUE(`userId`, `provider`, `action`, `windowStart`)

## Audit & Logging (TRANSFER-1)

### AuditLog
Comprehensive audit trail for compliance and security.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique log identifier |
| userId | UUID | FK → users, NULLABLE | User (if authenticated) |
| action | VARCHAR(64) | NOT NULL | Action performed |
| resource | VARCHAR(32) | NOT NULL | Resource type ('file', 'share', 'conflict', 'auth') |
| resourceId | UUID | NULLABLE | Resource identifier |
| ipAddress | VARCHAR(45) | NULLABLE | Client IP (IPv4/IPv6) |
| userAgent | VARCHAR(255) | NULLABLE | Client user agent |
| metadata | JSONB | NULLABLE | Additional context |
| createdAt | TIMESTAMP | DEFAULT NOW | Log timestamp |

**Indexes:**
- `idx_audit_logs_user_id` on `userId`
- `idx_audit_logs_created_at` on `createdAt DESC`
- `idx_audit_logs_action` on `action`
- `idx_audit_logs_resource_id` on `resourceId`

## Sharing & Conflicts

### SharedLink
Public share link management.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique link identifier |
| fileId | UUID | FK → files, NOT NULL | Shared file |
| token | VARCHAR(64) | UNIQUE, NOT NULL | Share token |
| passwordHash | VARCHAR(255) | NULLABLE | Optional password protection |
| expiresAt | TIMESTAMP | NULLABLE | Expiration time |
| maxDownloads | INTEGER | NULLABLE | Download limit |
| downloadCount | INTEGER | DEFAULT 0 | Current downloads |
| createdBy | UUID | FK → users, NOT NULL | Creator |
| createdAt | TIMESTAMP | DEFAULT NOW | Creation timestamp |

### Conflict
File sync conflict tracking.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique conflict identifier |
| userId | UUID | FK → users, NOT NULL | Owner |
| tenantId | UUID | FK → tenants | Tenant |
| filePath | TEXT | NOT NULL | Conflict file path |
| localVersionUrl | TEXT | NULLABLE | Local version location |
| cloudVersionUrl | TEXT | NULLABLE | Cloud version location |
| resolved | BOOLEAN | DEFAULT false | Resolution status |
| resolutionType | VARCHAR(50) | NULLABLE | Resolution method |
| detectedAt | TIMESTAMP | DEFAULT NOW | Detection time |
| resolvedAt | TIMESTAMP | NULLABLE | Resolution time |

**Resolution Types:**
- `keep_local` - Use local version
- `keep_cloud` - Use cloud version
- `keep_both` - Keep both versions
- `manual` - User resolved manually

## Multi-Tenant

### AdminNotification
System-wide and tenant-specific notifications.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique notification ID |
| tenantId | UUID | FK → tenants | Target tenant (NULL = global) |
| type | VARCHAR(50) | NOT NULL | Notification type |
| message | TEXT | NOT NULL | Notification content |
| payload | JSONB | NULLABLE | Additional data |
| read | BOOLEAN | DEFAULT false | Read status |
| createdAt | TIMESTAMP | DEFAULT NOW | Creation time |

### CloudConfig
User-specific provider configurations.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique config ID |
| userId | UUID | FK → users, NOT NULL | Owner |
| provider | VARCHAR(50) | NOT NULL | Provider ID |
| configJson | TEXT | NOT NULL | Provider-specific config |
| isActive | BOOLEAN | DEFAULT true | Active status |
| createdAt | TIMESTAMP | DEFAULT NOW | Creation timestamp |

## Relationships Summary

| Parent | Child | Type | Description |
|--------|-------|------|-------------|
| Tenant | User | 1:N | Users belong to tenant |
| Tenant | File | 1:N | Files belong to tenant |
| Tenant | Conflict | 1:N | Conflicts belong to tenant |
| Tenant | AdminNotification | 1:N | Notifications for tenant |
| User | File | 1:N | Files owned by user |
| User | Conflict | 1:N | Conflicts for user |
| User | SharedLink | 1:N | Links created by user |
| User | Token | 1:N | Vault tokens (max 3/provider) |
| User | OAuthToken | 1:N | OAuth tokens |
| User | UserRemote | 1:N | Connected remotes |
| User | AuditLog | 1:N | User's audit trail |
| User | Transfer | 1:N | User's transfers |
| User | RateLimit | 1:N | User's rate limits |
| User | CloudConfig | 1:N | User's cloud configs |
| File | SharedLink | 1:N | Links for file |

## Security Considerations

1. **Encryption at Rest**: `Token.encrypted_credentials` uses AES-256-GCM
2. **Key Derivation**: Vault keys derived from user session via PBKDF2
3. **Multi-Account Isolation**: UNIQUE constraint prevents cross-account access
4. **Tenant Isolation**: Foreign key + application-level checks ensure tenant separation
5. **Audit Trail**: All sensitive operations logged in `AuditLog`
6. **Token Expiration**: `expiresAt` fields enable automatic cleanup

## Migration Notes

- Migrations numbered sequentially (001, 002, etc.)
- Each migration documents: gate, task, purpose
- Use `IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` for idempotency
- Indexes created alongside tables for performance
