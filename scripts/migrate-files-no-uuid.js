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
const VALID_ENVIRONMENTS = new Set(['development', 'staging', 'production']);

function createPool() {
  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required');
  }
  return new Pool({ connectionString: DATABASE_URL });
}

const UUID_REGEX = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/)+/i;

async function migrateFiles(options) {
  let pool;
  let client;

  try {
    pool = createPool();
    client = await pool.connect();
    console.log(`Starting file system migration to remove UUID prefixes (${options.environment})...`);

    // Get all files from database
    const result = await client.query(`
      SELECT id, user_id, path, status, hash
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
          // Check for duplicate in database
          const duplicate = await client.query(
            'SELECT id, hash FROM files WHERE user_id = $1 AND path = $2 AND status != \'deleted\'',
            [file.user_id, newPath]
          );

          if (duplicate.rows.length > 0) {
            if (duplicate.rows[0].hash === file.hash) {
              console.log(`Same hash for duplicate ${newPath}. Deleting redundant UUID-prefixed entry ${file.id}`);
              await client.query('UPDATE files SET status = \'deleted\' WHERE id = $1', [file.id]);
              // Also try to remove the file from disk if it's different from the clean path one
              if (fs.existsSync(oldLocalPath) && oldLocalPath !== newLocalPath) {
                fs.unlinkSync(oldLocalPath);
              }
              if (fs.existsSync(oldPoolPath) && oldPoolPath !== newPoolPath) {
                fs.unlinkSync(oldPoolPath);
              }
            } else {
              console.warn(`Different hash for duplicate ${newPath}. Skipping for manual resolution.`);
              errorCount++;
              continue;
            }
          } else {
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

            // Update database
            await client.query('UPDATE files SET path = $1 WHERE id = $2', [newPath, file.id]);
            console.log(`Updated DB: ${file.id} path set to ${newPath}`);
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
    console.error('Migration failed:', error.message || error);
    throw error;
  } finally {
    if (client) {
      client.release();
    }
    if (pool) {
      await pool.end();
    }
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
async function dryRun(options) {
  let pool;
  let client;

  try {
    pool = createPool();
    client = await pool.connect();
    console.log(`DRY RUN (${options.environment}): Checking files that would be migrated...`);

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
    console.error('Dry run failed:', error.message || error);
    throw error;
  } finally {
    if (client) {
      client.release();
    }
    if (pool) {
      await pool.end();
    }
  }
}

function printHelp() {
  console.log(`
Usage: node migrate-files-no-uuid.js [options]

Options:
  --dry-run              Check what would be migrated without making changes
  --env=<name>           Set execution environment (development|staging|production)
  --confirm-production   Required to apply changes when --env=production
  --help                 Show this help message

This script migrates files from UUID-prefixed paths to clean paths.
Run the database migration first, then run this script.
  `);
}

function parseArgs(argv) {
  const options = {
    dryRun: false,
    help: false,
    confirmProduction: false,
    environment: (process.env.MIGRATION_ENV || process.env.NODE_ENV || 'development').toLowerCase()
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }

    if (arg === '--help') {
      options.help = true;
      continue;
    }

    if (arg === '--confirm-production') {
      options.confirmProduction = true;
      continue;
    }

    if (arg.startsWith('--env=')) {
      const value = arg.slice('--env='.length).trim().toLowerCase();
      if (!value) {
        throw new Error('Missing value for --env');
      }
      options.environment = value;
      continue;
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  if (!VALID_ENVIRONMENTS.has(options.environment)) {
    throw new Error(`Invalid environment "${options.environment}". Use development, staging, or production.`);
  }

  return options;
}

// Parse command line arguments
const args = process.argv.slice(2);
let options;

try {
  options = parseArgs(args);
} catch (error) {
  console.error(`Error: ${error.message || error}`);
  printHelp();
  process.exit(1);
}

if (options.help) {
  printHelp();
  process.exit(0);
}

if (options.environment === 'production' && !options.dryRun && !options.confirmProduction) {
  console.error('Error: Applying migration in production requires --confirm-production');
  process.exit(1);
}

const runner = options.dryRun ? dryRun : migrateFiles;
runner(options)
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
