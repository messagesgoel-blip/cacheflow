-- Add table for storing OAuth tokens securely
-- Tokens are encrypted before storing

CREATE TABLE IF NOT EXISTS oauth_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL, -- 'google_drive', 'dropbox', etc.
    provider_account_id VARCHAR(255), -- The user's ID on the provider
    access_token TEXT NOT NULL, -- encrypted
    refresh_token TEXT, -- encrypted
    expires_at TIMESTAMP, -- when the access token expires
    scope TEXT, -- what permissions were granted
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_oauth_tokens_user ON oauth_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_expires ON oauth_tokens(expires_at);
