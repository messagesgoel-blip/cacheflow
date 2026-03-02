-- Migration: 002_multi_account
-- Gate: AUTH-1
-- Task: 1.5@AUTH-1
-- Purpose: Support up to 3 accounts per provider per user

-- Add account tracking to oauth_tokens table
ALTER TABLE oauth_tokens 
ADD COLUMN IF NOT EXISTS account_label VARCHAR(50) DEFAULT 'Primary',
ADD COLUMN IF NOT EXISTS account_order INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false;

-- Create index for efficient multi-account lookups
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_user_provider_account 
ON oauth_tokens(user_id, provider, account_order);

-- Add unique constraint for default account per user+provider
-- First remove the legacy unique constraint if it exists
ALTER TABLE oauth_tokens DROP CONSTRAINT IF EXISTS oauth_tokens_user_id_provider_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_oauth_tokens_user_provider_default 
ON oauth_tokens(user_id, provider) 
WHERE is_default = true;

-- Add unique constraint for provider_account_id per user+provider to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_oauth_tokens_user_provider_account_id
ON oauth_tokens(user_id, provider, provider_account_id);

-- Add migration timestamp
ALTER TABLE oauth_tokens 
ADD COLUMN IF NOT EXISTS migrated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Comment documenting the multi-account constraint
COMMENT ON TABLE oauth_tokens IS 'Provider tokens with multi-account support (max 3 accounts per provider per user)';
