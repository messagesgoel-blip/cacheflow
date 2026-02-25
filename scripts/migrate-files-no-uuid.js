#!/usr/bin/env node
'use strict';

// File system migration script to remove UUID prefixes from file paths
// This script moves files from UUID-prefixed directories to clean paths

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const LOCAL_PATH = process.env.LOCAL_CACHE_PATH || '/mnt/local';
const POOL_PATH = process.env.POOL_PATH || '/mnt/pool';
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('Error: DATABASE_URL environment variable is required');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

const UUID_REGEX = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/)+/i;

async function migrateFiles() {
  const client = await pool.connect();

  try {
    console.log('Starting file system migration to remove UUID prefixes...');

    // Get all files from database
    const result = await client.query(`
      SELECT id, user_id, path, status
      FROM files
      WHERE status != 'deleted'
      ORDER BY user_id, path
    `);

    const files = result.rows;
    console.log(`Found ${files.length} files to check`);

    let migratedCount = 0;
    let errorCount = 0;
    const changes = [];

    for (const file of files) {
      const oldPath = file.path;

      // Check if path has UUID prefix
      if (UUID_REGEX.test(oldPath)) {
        const newPath = oldPath.replace(UUID_REGEX, '');

        // Check both local and pool paths
        const oldLocalPath = path.join(LOCAL_PATH, file.user_id, oldPath);
        const newLocalPath = path.join(LOCAL_PATH, file.user_id, newPath);

        const oldPoolPath = path.join(POOL_PATH, file.user_id, oldPath);
        const newPoolPath = path.join(POOL_PATH, file.user_id, newPath);

        try {
          // Move file if it exists in local path
          if (fs.existsSync(oldLocalPath)) {
            fs.mkdirSync(path.dirname(newLocalPath), { recursive: true });
            fs.renameSync(oldLocalPath, newLocalPath);
            console.log(`Moved local: ${oldPath} -> ${newPath}`);
          }

          // Move file if it exists in pool path
          if (fs.existsSync(oldPoolPath)) {
            fs.mkdirSync(path.dirname(newPoolPath), { recursive: true });
            fs.renameSync(oldPoolPath, newPoolPath);
            console.log(`Moved pool: ${oldPath} -> ${newPath}`);
          }

          // Remove empty UUID directories
          removeEmptyUUIDDirectories(file.user_id, oldPath);

          changes.push({
            fileId: file.id,
            userId: file.user_id,
            oldPath,
            newPath,
            timestamp: new Date().toISOString()
          });

          migratedCount++;
        } catch (error) {
          console.error(`Error migrating file ${file.id} (${oldPath}):`, error.message);
          errorCount++;
        }
      }
    }

    // Save migration log
    const logPath = path.join(__dirname, '..', 'migration-log-uuid-removal.json');
    fs.writeFileSync(logPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      totalFiles: files.length,
      migratedCount,
      errorCount,
      changes
    }, null, 2));

    console.log('\nMigration completed:');
    console.log(`  Total files checked: ${files.length}`);
    console.log(`  Files migrated: ${migratedCount}`);
    console.log(`  Errors: ${errorCount}`);
    console.log(`  Log saved to: ${logPath}`);

    if (errorCount > 0) {
      console.warn('\nWarning: Some files failed to migrate. Check the log for details.');
    }

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

function removeEmptyUUIDDirectories(userId, oldPath) {
  const pathSegments = oldPath.split('/');

  // Start from the first segment (should be UUID)
  for (let i = 1; i <= pathSegments.length; i++) {
    const dirPath = path.join(LOCAL_PATH, userId, ...pathSegments.slice(0, i));

    if (fs.existsSync(dirPath)) {
      try {
        const files = fs.readdirSync(dirPath);
        if (files.length === 0) {
          fs.rmdirSync(dirPath);
          console.log(`Removed empty directory: ${dirPath}`);
        }
      } catch (error) {
        // Directory might not be empty or we don't have permission
        console.warn(`Could not remove directory ${dirPath}:`, error.message);
      }
    }

    // Also check pool path
    const poolDirPath = path.join(POOL_PATH, userId, ...pathSegments.slice(0, i));
    if (fs.existsSync(poolDirPath)) {
      try {
        const files = fs.readdirSync(poolDirPath);
        if (files.length === 0) {
          fs.rmdirSync(poolDirPath);
          console.log(`Removed empty pool directory: ${poolDirPath}`);
        }
      } catch (error) {
        console.warn(`Could not remove pool directory ${poolDirPath}:`, error.message);
      }
    }
  }
}

// Dry-run mode
async function dryRun() {
  const client = await pool.connect();

  try {
    console.log('DRY RUN: Checking files that would be migrated...');

    const result = await client.query(`
      SELECT id, user_id, path, status
      FROM files
      WHERE status != 'deleted'
      ORDER BY user_id, path
    `);

    const files = result.rows;
    let wouldMigrate = 0;

    for (const file of files) {
      if (UUID_REGEX.test(file.path)) {
        const newPath = file.path.replace(UUID_REGEX, '');
        console.log(`Would migrate: ${file.path} -> ${newPath}`);
        wouldMigrate++;
      }
    }

    console.log(`\nDry run completed:`);
    console.log(`  Total files: ${files.length}`);
    console.log(`  Would migrate: ${wouldMigrate}`);

  } catch (error) {
    console.error('Dry run failed:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
if (args.includes('--dry-run')) {
  dryRun().then(() => process.exit(0));
} else if (args.includes('--help')) {
  console.log(`
Usage: node migrate-files-no-uuid.js [options]

Options:
  --dry-run    Check what would be migrated without making changes
  --help       Show this help message

This script migrates files from UUID-prefixed paths to clean paths.
Run the database migration first, then run this script.
  `);
  process.exit(0);
} else {
  migrateFiles().then(() => process.exit(0));
}