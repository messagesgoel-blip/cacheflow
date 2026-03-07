-- Task 2A: VPS/SFTP PEM-backed provider connections
-- Stores encrypted PEM material only (AES-256-GCM ciphertext + IV).

CREATE TABLE IF NOT EXISTS vps_connections (
  id          VARCHAR(191) PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label       TEXT NOT NULL,
  host        TEXT NOT NULL,
  port        INTEGER NOT NULL DEFAULT 22,
  username    TEXT NOT NULL,
  auth_method TEXT NOT NULL DEFAULT 'pem',
  pem_key     BYTEA NOT NULL,
  pem_iv      BYTEA NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vps_connections_user_id
  ON vps_connections(user_id);

CREATE INDEX IF NOT EXISTS idx_vps_connections_user_host_username
  ON vps_connections(user_id, host, username);
