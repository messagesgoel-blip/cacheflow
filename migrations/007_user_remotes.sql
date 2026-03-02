-- Migration: 007_user_remotes
-- Create user_remotes table for server-side credential persistence
-- Supports multiple accounts per provider and encrypts tokens at rest

CREATE TABLE IF NOT EXISTS user_remotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,
    account_key VARCHAR(255) NOT NULL,
    account_id VARCHAR(255),
    account_email VARCHAR(255),
    display_name VARCHAR(255),
    access_token_enc TEXT NOT NULL,
    refresh_token_enc TEXT,
    expires_at TIMESTAMP,
    disabled BOOLEAN NOT NULL DEFAULT false,
    key_version VARCHAR(16) NOT NULL DEFAULT '1',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMP,
    UNIQUE(user_id, provider, account_key)
);

CREATE INDEX IF NOT EXISTS idx_user_remotes_user_provider ON user_remotes(user_id, provider);
CREATE INDEX IF NOT EXISTS idx_user_remotes_user_provider_key ON user_remotes(user_id, provider, account_key);
