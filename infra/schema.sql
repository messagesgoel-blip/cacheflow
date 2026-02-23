CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    quota_bytes BIGINT NOT NULL DEFAULT 10737418240,
    used_bytes  BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    path TEXT NOT NULL,
    size_bytes BIGINT NOT NULL,
    hash VARCHAR(64),
    status VARCHAR(20) DEFAULT 'pending',
    last_modified TIMESTAMP,
    synced_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, path)
);

CREATE TABLE cloud_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,
    config_json TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE shared_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id UUID REFERENCES files(id) ON DELETE CASCADE,
    token VARCHAR(64) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    expires_at TIMESTAMP,
    max_downloads INTEGER,
    download_count INTEGER DEFAULT 0,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE conflicts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    local_version_url TEXT,
    cloud_version_url TEXT,
    resolved BOOLEAN DEFAULT FALSE,
    resolution_type VARCHAR(50),
    detected_at TIMESTAMP DEFAULT NOW(),
    resolved_at TIMESTAMP
);

CREATE INDEX idx_files_user_path ON files(user_id, path);
CREATE INDEX idx_files_user_status ON files(user_id, status);
CREATE INDEX idx_files_modified ON files(last_modified DESC);
CREATE INDEX idx_conflicts_unresolved ON conflicts(user_id, resolved);
CREATE INDEX idx_shared_links_token ON shared_links(token);

-- Admin notifications (Day 45)
CREATE TABLE IF NOT EXISTS admin_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(50) NOT NULL,
  message TEXT NOT NULL,
  payload JSONB,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_read ON admin_notifications(read);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_type ON admin_notifications(type);

-- Tenants table (Day 47)
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  plan VARCHAR(50) NOT NULL DEFAULT 'free',
  quota_bytes BIGINT NOT NULL DEFAULT 107374182400,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO tenants (id, name, slug, plan)
VALUES ('00000000-0000-0000-0000-000000000001', 'Default', 'default', 'free')
ON CONFLICT DO NOTHING;

-- tenant_id migration (Day 48)
ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE files ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE conflicts ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE admin_notifications ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_files_tenant_id ON files(tenant_id);
CREATE INDEX IF NOT EXISTS idx_conflicts_tenant_id ON conflicts(tenant_id);
