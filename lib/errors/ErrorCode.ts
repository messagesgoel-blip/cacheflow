/**
 * Canonical error codes for CacheFlow APIs and workers.
 *
 * Gate: AUTH-1, TRANSFER-1
 * Task: 0.2@TRANSFER-1
 */

export enum ErrorCode {
  UNKNOWN = 'UNKNOWN',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  RATE_LIMITED = 'RATE_LIMITED',

  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  REFRESH_FAILED = 'REFRESH_FAILED',

  PROVIDER_UNAVAILABLE = 'PROVIDER_UNAVAILABLE',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',

  CHUNK_FAILED = 'CHUNK_FAILED',
  TRANSFER_FAILED = 'TRANSFER_FAILED',

  SHARE_ABUSE_LIMIT = 'SHARE_ABUSE_LIMIT',

  VAULT_LOCKED = 'VAULT_LOCKED',
}

export type ErrorCategory =
  | 'auth'
  | 'transfer'
  | 'provider'
  | 'share'
  | 'vault'
  | 'validation'
  | 'system';

const ERROR_CATEGORY_MAP: Record<ErrorCode, ErrorCategory> = {
  [ErrorCode.UNKNOWN]: 'system',
  [ErrorCode.INTERNAL_ERROR]: 'system',
  [ErrorCode.VALIDATION_FAILED]: 'validation',
  [ErrorCode.UNAUTHORIZED]: 'auth',
  [ErrorCode.FORBIDDEN]: 'auth',
  [ErrorCode.NOT_FOUND]: 'validation',
  [ErrorCode.CONFLICT]: 'validation',
  [ErrorCode.RATE_LIMITED]: 'provider',
  [ErrorCode.TOKEN_EXPIRED]: 'auth',
  [ErrorCode.REFRESH_FAILED]: 'auth',
  [ErrorCode.PROVIDER_UNAVAILABLE]: 'provider',
  [ErrorCode.QUOTA_EXCEEDED]: 'provider',
  [ErrorCode.CHUNK_FAILED]: 'transfer',
  [ErrorCode.TRANSFER_FAILED]: 'transfer',
  [ErrorCode.SHARE_ABUSE_LIMIT]: 'share',
  [ErrorCode.VAULT_LOCKED]: 'vault',
};

const DEFAULT_MESSAGES: Record<ErrorCode, string> = {
  [ErrorCode.UNKNOWN]: 'Unexpected error',
  [ErrorCode.INTERNAL_ERROR]: 'Internal server error',
  [ErrorCode.VALIDATION_FAILED]: 'Invalid request',
  [ErrorCode.UNAUTHORIZED]: 'Authentication required',
  [ErrorCode.FORBIDDEN]: 'Action is not allowed',
  [ErrorCode.NOT_FOUND]: 'Resource not found',
  [ErrorCode.CONFLICT]: 'Resource conflict',
  [ErrorCode.RATE_LIMITED]: 'Rate limited',
  [ErrorCode.TOKEN_EXPIRED]: 'Session expired',
  [ErrorCode.REFRESH_FAILED]: 'Failed to refresh session',
  [ErrorCode.PROVIDER_UNAVAILABLE]: 'Provider unavailable',
  [ErrorCode.QUOTA_EXCEEDED]: 'Storage quota exceeded',
  [ErrorCode.CHUNK_FAILED]: 'Chunk upload failed',
  [ErrorCode.TRANSFER_FAILED]: 'Transfer failed',
  [ErrorCode.SHARE_ABUSE_LIMIT]: 'Share daily limit reached',
  [ErrorCode.VAULT_LOCKED]: 'Vault is locked',
};

const DEFAULT_HTTP_STATUS: Record<ErrorCode, number> = {
  [ErrorCode.UNKNOWN]: 500,
  [ErrorCode.INTERNAL_ERROR]: 500,
  [ErrorCode.VALIDATION_FAILED]: 400,
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.CONFLICT]: 409,
  [ErrorCode.RATE_LIMITED]: 429,
  [ErrorCode.TOKEN_EXPIRED]: 401,
  [ErrorCode.REFRESH_FAILED]: 401,
  [ErrorCode.PROVIDER_UNAVAILABLE]: 503,
  [ErrorCode.QUOTA_EXCEEDED]: 507,
  [ErrorCode.CHUNK_FAILED]: 502,
  [ErrorCode.TRANSFER_FAILED]: 500,
  [ErrorCode.SHARE_ABUSE_LIMIT]: 429,
  [ErrorCode.VAULT_LOCKED]: 423,
};

export function getErrorCategory(code: ErrorCode): ErrorCategory {
  return ERROR_CATEGORY_MAP[code] ?? 'system';
}

export function getDefaultErrorMessage(code: ErrorCode): string {
  return DEFAULT_MESSAGES[code] ?? DEFAULT_MESSAGES[ErrorCode.UNKNOWN];
}

export function getDefaultHttpStatus(code: ErrorCode): number {
  return DEFAULT_HTTP_STATUS[code] ?? DEFAULT_HTTP_STATUS[ErrorCode.UNKNOWN];
}

