-- Migration: 003_2fa
-- Gate: 2FA-1
-- Task: 2.13@2FA-1
-- Purpose: Add 2FA support to users table

-- Add 2FA columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS two_factor_secret BYTEA,
ADD COLUMN IF NOT EXISTS two_factor_backup_codes TEXT[],
ADD COLUMN IF NOT EXISTS two_factor_enabled_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS two_factor_disabled_at TIMESTAMP;

-- Create index for 2FA lookups
CREATE INDEX IF NOT EXISTS idx_users_2fa_enabled ON users(two_factor_enabled) WHERE two_factor_enabled = true;

-- Add comment
COMMENT ON COLUMN users.two_factor_enabled IS 'Whether 2FA is enabled for this user';
COMMENT ON COLUMN users.two_factor_secret IS 'Encrypted TOTP secret (AES-256)';
COMMENT ON COLUMN users.two_factor_backup_codes IS 'Array of hashed backup codes';
