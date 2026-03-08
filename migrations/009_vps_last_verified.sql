ALTER TABLE vps_connections
  ADD COLUMN IF NOT EXISTS last_tested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_host_fingerprint TEXT;
