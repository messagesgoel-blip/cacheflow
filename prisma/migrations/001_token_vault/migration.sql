-- Migration: 001_token_vault
-- Gate: AUTH-2
-- Task: 1.4@AUTH-2
-- Purpose: Create tokens table for encrypted at-rest provider credentials

-- Create tokens table if not exists
CREATE TABLE IF NOT EXISTS tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL,
  encrypted_credentials BYTEA NOT NULL,
  encryption_version INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  
  -- Multi-account support (1.5@AUTH-1)
  account_label VARCHAR(50) DEFAULT 'Primary',
  account_order INTEGER DEFAULT 1,
  is_default BOOLEAN DEFAULT false,
  
  -- Metadata
  remote_id VARCHAR(255),
  last_used_at TIMESTAMP,
  migrated_at TIMESTAMP,
  
  -- Constraints
  UNIQUE(user_id, provider, account_label),
  CHECK(account_order >= 1 AND account_order <= 3),
  CHECK(LENGTH(encrypted_credentials) > 0)
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_tokens_user_id ON tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_tokens_provider ON tokens(provider);
CREATE INDEX IF NOT EXISTS idx_tokens_user_provider ON tokens(user_id, provider);
CREATE INDEX IF NOT EXISTS idx_tokens_user_provider_account ON tokens(user_id, provider, account_order);
CREATE INDEX IF NOT EXISTS idx_tokens_active ON tokens(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_tokens_expires ON tokens(expires_at) WHERE expires_at IS NOT NULL;

-- Unique index for default account per user+provider
CREATE UNIQUE INDEX IF NOT EXISTS idx_tokens_user_provider_default 
ON tokens(user_id, provider) 
WHERE is_default = true AND is_active = true;

-- Comment documenting purpose
COMMENT ON TABLE tokens IS 'Encrypted provider credentials with multi-account support (max 3 accounts per provider per user). Part of Token Vault v1 (AUTH-2).';
COMMENT ON COLUMN tokens.encrypted_credentials IS 'AES-256-GCM encrypted provider credentials. Key derived from user session.';
COMMENT ON COLUMN tokens.encryption_version IS 'Encryption schema version for key rotation support.';
