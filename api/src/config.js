'use strict';

function asInt(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`[config] ${name} must be a positive integer`);
  }
  return parsed;
}

function validateRequired(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`[config] Missing required environment variable: ${name}`);
  }
  return value;
}

function hasDbConnectionSettings() {
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.trim()) return true;
  return Boolean(
    process.env.DB_HOST &&
    process.env.DB_NAME &&
    process.env.DB_USER &&
    process.env.DB_PASSWORD
  );
}

function loadConfig() {
  const jwtSecret = validateRequired('JWT_SECRET');

  if (!hasDbConnectionSettings()) {
    throw new Error(
      '[config] Database configuration missing. Set DATABASE_URL or DB_HOST/DB_NAME/DB_USER/DB_PASSWORD.'
    );
  }

  return {
    port: asInt('PORT', 8100),
    jwtSecret,
    authRateLimitWindowMs: asInt('AUTH_RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000),
    authRateLimitMax: asInt('AUTH_RATE_LIMIT_MAX', 60),
    maxFileSizeMb: asInt('MAX_FILE_SIZE_MB', 500)
  };
}

module.exports = loadConfig();
