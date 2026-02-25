-- Migration: Remove UUID prefixes from file paths
-- This migration cleans up file paths by removing UUID prefixes that were previously added
-- Run this migration BEFORE updating the API and UI to use clean paths

-- Remove UUID prefixes from file paths
UPDATE files
SET path = regexp_replace(path, '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/', '')
WHERE path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/';

-- Also handle nested paths with UUID prefixes
UPDATE files
SET path = regexp_replace(path, '^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/)+', '')
WHERE path ~ '^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/)+';

-- Verify migration
SELECT COUNT(*) as total_files,
       COUNT(CASE WHEN path ~ '^[0-9a-f]{8}-' THEN 1 END) as still_with_uuid,
       COUNT(CASE WHEN path LIKE '%/%' THEN 1 END) as files_with_paths
FROM files;

-- Create a backup table for rollback
CREATE TABLE IF NOT EXISTS files_backup_uuid_migration AS
SELECT * FROM files WHERE 1=0;

-- Insert backup of original data (optional, for safety)
-- INSERT INTO files_backup_uuid_migration SELECT * FROM files;