# File Browser UI Migration Guide

This guide explains how to migrate from the old flat file list to the new file browser UI with drive visualization.

## Overview

The new file browser UI introduces:
- Folder hierarchy navigation
- Storage location visualization
- Folder operations (create, delete, move)
- Improved file management with context menus
- Two-pane layout (folder tree + file browser)

## Migration Steps

### Phase 0: UUID Prefix Migration (Required)

Before enabling the new UI, you must migrate existing file paths to remove UUID prefixes.

#### Step 1: Backup
1. Backup your database:
   ```bash
   pg_dump cacheflow > cacheflow-backup-$(date +%Y%m%d).sql
   ```

2. Backup file storage:
   ```bash
   cp -r /mnt/local /mnt/local-backup-$(date +%Y%m%d)
   cp -r /mnt/pool /mnt/pool-backup-$(date +%Y%m%d)
   ```

#### Step 2: Database Migration
Run the database migration script:
```bash
psql -d cacheflow -f migrations/remove_uuid_prefixes.sql
```

#### Step 3: File System Migration
Run the file system migration script (dry run first):
```bash
# Dry run to see what would be migrated
node scripts/migrate-files-no-uuid.js --dry-run

# Actual migration
node scripts/migrate-files-no-uuid.js
```

#### Step 4: Verify Migration
Check the migration log:
```bash
cat migration-log-uuid-removal.json
```

### Phase 1: API Deployment

1. Deploy the updated API with new endpoints:
   - `GET /files/browse` - Folder browsing
   - `POST /files/folders` - Create folder
   - `DELETE /files/folders` - Delete folder
   - `PATCH /files/:id/move` - Move file/folder
   - `GET /storage/locations` - Storage locations
   - `GET /storage/usage` - Storage usage

2. Restart the API service:
   ```bash
   docker compose -f infra/docker-compose.yml restart api
   ```

### Phase 2: UI Deployment

1. Deploy the updated web UI with new components:
   - `FileBrowser` - Main file browser component
   - `FolderTree` - Folder tree navigation
   - `DrivePanel` - Storage visualization
   - `ContextMenu` - Right-click context menus
   - Updated `FileTable` with move functionality
   - Updated `Breadcrumb` with clickable navigation

2. Restart the web service:
   ```bash
   docker compose -f infra/docker-compose.yml restart web
   ```

## New Features

### Folder Navigation
- Click on folders in the tree view to navigate
- Use breadcrumb navigation to go back
- Create new folders with the "New Folder" button
- Delete empty folders

### File Operations
- Move files between folders
- Upload files to specific folders
- Right-click context menus for quick actions
- Drag & drop support (future enhancement)

### Storage Visualization
- View storage locations (local cache, pool, cloud)
- See usage statistics and quotas
- Monitor sync status across locations

### Keyboard Shortcuts
- `Enter` - Open folder/file
- `F2` - Rename selected item
- `Delete` - Delete selected item
- `Ctrl+C` / `Ctrl+V` - Copy/paste (future enhancement)

## Backward Compatibility

The new UI maintains backward compatibility:
- Existing flat file list API (`GET /files`) still works
- File upload API (`POST /files/upload`) supports both old and new paths
- All existing file operations continue to work
- UUID prefix stripping is handled automatically during migration

## Troubleshooting

### Common Issues

1. **"Folder already exists" error**
   - Check if there are files in the folder path
   - Use the browse API to see existing folders

2. **"Folder not empty" error when deleting**
   - Delete all files in the folder first
   - Use the file browser to view folder contents

3. **Missing folders in tree view**
   - Folders only appear when they contain files
   - Create a file in the folder or use the folder marker

4. **Storage locations not showing**
   - Check cloud configurations in database
   - Verify local and pool paths exist

### Rollback Procedure

If issues occur, you can rollback:

1. Restore database from backup
2. Restore file system from backup
3. Revert to previous UI version
4. Contact support if migration logs show errors

## Performance Considerations

- Large folder trees are loaded lazily
- File listings are paginated (future enhancement)
- Storage calculations are cached
- Tree view supports virtual scrolling

## Security Notes

- Folder permissions follow existing file permissions
- Users can only access their own folders
- Path traversal attacks are prevented by API validation
- Audit logs track all folder operations

## Future Enhancements

Planned features:
- Multi-select and bulk operations
- Drag & drop file movement
- Folder sharing
- Advanced search within folders
- Folder synchronization rules
- Version history for folders