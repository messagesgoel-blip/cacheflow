-- Audit Logs Migration
-- Creates audit_logs table for tracking all file operations

CREATE TABLE IF NOT EXISTS audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id),
  action      VARCHAR(64) NOT NULL,
  resource    VARCHAR(32) NOT NULL,   -- 'file', 'share', 'conflict', 'auth'
  resource_id UUID,
  ip_address  VARCHAR(45),
  user_agent  VARCHAR(255),
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS audit_logs_user_id_idx ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_action_idx ON audit_logs(action);
CREATE INDEX IF NOT EXISTS audit_logs_resource_id_idx ON audit_logs(resource_id);
