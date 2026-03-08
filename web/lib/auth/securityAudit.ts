/**
 * Security Audit Utilities
 * 
 * Gate: AUTH-2
 * Task: 1.18@AUTH-2
 * 
 * Purpose: Detect and prevent secret leakage in API responses
 */

// Patterns that indicate potential secret leakage
const SECRET_PATTERNS = [
  /secret/i,
  /password/i,
  /token(?!ization)/i, // Match "token" but not "tokenization"
  /api[_-]?key/i,
  /private[_-]?key/i,
  /access[_-]?token/i,
  /refresh[_-]?token/i,
  /bearer/i,
  /credential/i,
  /auth[_-]?key/i,
  /signing[_-]?key/i,
];

// Fields that should NEVER appear in client-visible responses
const FORBIDDEN_FIELDS = [
  'jwtSecret',
  'jwt_secret',
  'JWT_SECRET',
  'databaseUrl',
  'database_url',
  'DATABASE_URL',
  'encryptionKey',
  'encryption_key',
  'privateKey',
  'private_key',
  'signingKey',
  'signing_key',
];

const SAFE_OBSERVABILITY_FIELDS = [
  'requestId',
  'request_id',
  'correlationId',
  'correlation_id',
];

/**
 * Check if a value looks like a secret
 */
function looksLikeSecret(key: string, value: any): boolean {
  if (SAFE_OBSERVABILITY_FIELDS.includes(key)) {
    return false;
  }

  // Check key name against patterns
  if (SECRET_PATTERNS.some(pattern => pattern.test(key))) {
    return true;
  }
  
  // Check if value looks like a secret (long random strings)
  if (typeof value === 'string') {
    // JWT pattern
    if (/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/.test(value)) {
      return true;
    }
    
    // Long random-looking strings (potential keys/tokens)
    if (value.length > 32 && /^[A-Za-z0-9+/=_-]+$/.test(value)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Recursively scan object for secret leakage
 */
export function scanForSecrets(obj: any, path = ''): string[] {
  const leaks: string[] = [];
  
  if (!obj || typeof obj !== 'object') {
    return leaks;
  }
  
  for (const [key, value] of Object.entries(obj)) {
    const currentPath = path ? `${path}.${key}` : key;
    
    // Check forbidden fields
    if (FORBIDDEN_FIELDS.includes(key)) {
      leaks.push(`Forbidden field: ${currentPath}`);
      continue;
    }
    
    // Check for secret-like values
    if (looksLikeSecret(key, value)) {
      // Allow if it's clearly not a real secret (e.g., boolean flags)
      if (typeof value !== 'boolean' && value !== null) {
        leaks.push(`Potential secret: ${currentPath}`);
      }
    }
    
    // Recurse into nested objects (but not arrays of primitives)
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      leaks.push(...scanForSecrets(value, currentPath));
    }
    
    // Check array items
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (typeof item === 'object' && item !== null) {
          leaks.push(...scanForSecrets(item, `${currentPath}[${index}]`));
        }
      });
    }
  }
  
  return leaks;
}

/**
 * Sanitize object for client response
 * Removes or masks fields that look like secrets
 */
export function sanitizeForClient<T extends Record<string, any>>(obj: T): T {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }
  
  const result: any = Array.isArray(obj) ? [] : {};
  
  for (const [key, value] of Object.entries(obj)) {
    // Skip forbidden fields entirely
    if (FORBIDDEN_FIELDS.includes(key)) {
      continue;
    }
    
    // Skip secret-like values
    if (looksLikeSecret(key, value)) {
      continue;
    }
    
    // Recursively sanitize nested objects
    if (typeof value === 'object' && value !== null) {
      result[key] = sanitizeForClient(value);
    } else {
      result[key] = value;
    }
  }
  
  return result as T;
}

/**
 * Middleware-style wrapper for API responses
 * Automatically scans and logs potential secret leakage
 */
export function withSecurityScan<T extends Record<string, any>>(
  data: T,
  endpoint: string
): T {
  const leaks = scanForSecrets(data);
  
  if (leaks.length > 0) {
    console.error(
      `[SECURITY AUDIT] Potential secret leakage detected at ${endpoint}:`,
      leaks.join(', ')
    );
    
    // In development, throw to catch issues early
    if (process.env.NODE_ENV !== 'production') {
      throw new Error(
        `Security audit failed at ${endpoint}: ${leaks.join(', ')}`
      );
    }
    
    // In production, sanitize and continue
    return sanitizeForClient(data);
  }
  
  return data;
}

/**
 * Validate environment configuration
 * Returns list of missing required secrets
 */
export function validateEnvConfig(): string[] {
  const missing: string[] = [];
  
  const requiredSecrets = [
    'JWT_SECRET',
    'DATABASE_URL',
  ];
  
  for (const secret of requiredSecrets) {
    if (!process.env[secret]) {
      missing.push(secret);
    }
  }
  
  return missing;
}

/**
 * Check if configuration is production-ready
 */
export function isProductionReady(): boolean {
  if (process.env.NODE_ENV !== 'production') {
    return false;
  }
  
  const missing = validateEnvConfig();
  return missing.length === 0;
}

