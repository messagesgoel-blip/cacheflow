#!/usr/bin/env node
'use strict';

// Verify that UUID migration would work correctly
const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('Error: DATABASE_URL environment variable is required');
  console.error('Example: DATABASE_URL=postgresql://user:pass@localhost:5432/cacheflow node verify-migration.js');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

async function verifyMigration() {
  const client = await pool.connect();

  try {
    console.log('Verifying UUID migration requirements...\n');

    // 1. Check if files have UUID prefixes
    const uuidCheck = await client.query(`
      SELECT
        COUNT(*) as total_files,
        COUNT(CASE WHEN path ~ '^[0-9a-f]{8}-' THEN 1 END) as files_with_uuid_prefix,
        COUNT(CASE WHEN path LIKE '%/%' THEN 1 END) as files_with_paths
      FROM files
      WHERE status != 'deleted'
    `);

    const stats = uuidCheck.rows[0];
    console.log('File Path Analysis:');
    console.log(`  Total files: ${stats.total_files}`);
    console.log(`  Files with UUID prefix: ${stats.files_with_uuid_prefix}`);
    console.log(`  Files with paths (containing /): ${stats.files_with_paths}`);
    console.log();

    // 2. Show some example paths
    if (stats.files_with_uuid_prefix > 0) {
      const examples = await client.query(`
        SELECT path
        FROM files
        WHERE path ~ '^[0-9a-f]{8}-'
        LIMIT 5
      `);

      console.log('Example paths with UUID prefixes:');
      examples.rows.forEach((row, i) => {
        console.log(`  ${i + 1}. ${row.path}`);
      });
      console.log();
    }

    // 3. Check folder structure
    const folderCheck = await client.query(`
      SELECT
        COUNT(DISTINCT split_part(path, '/', 1)) as top_level_folders,
        COUNT(DISTINCT CASE WHEN path LIKE '%/%/%' THEN split_part(path, '/', 2) END) as second_level_folders
      FROM files
      WHERE status != 'deleted' AND path LIKE '%/%'
    `);

    const folderStats = folderCheck.rows[0];
    console.log('Folder Structure Analysis:');
    console.log(`  Top-level folders: ${folderStats.top_level_folders}`);
    console.log(`  Second-level folders: ${folderStats.second_level_folders}`);
    console.log();

    // 4. Check for potential conflicts after migration
    const conflictCheck = await client.query(`
      WITH cleaned_paths AS (
        SELECT
          id,
          user_id,
          regexp_replace(path, '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/', '') as cleaned_path
        FROM files
        WHERE status != 'deleted'
      )
      SELECT
        COUNT(DISTINCT cleaned_path) as unique_cleaned_paths,
        COUNT(*) as total_files,
        COUNT(*) - COUNT(DISTINCT cleaned_path) as potential_conflicts
      FROM cleaned_paths
    `);

    const conflictStats = conflictCheck.rows[0];
    console.log('Migration Conflict Analysis:');
    console.log(`  Unique cleaned paths: ${conflictStats.unique_cleaned_paths}`);
    console.log(`  Total files: ${conflictStats.total_files}`);
    console.log(`  Potential conflicts (duplicate cleaned paths): ${conflictStats.potential_conflicts}`);
    console.log();

    // 5. Summary and recommendations
    console.log('='.repeat(50));
    console.log('MIGRATION VERIFICATION SUMMARY');
    console.log('='.repeat(50));

    if (stats.files_with_uuid_prefix === 0) {
      console.log('✅ No UUID prefixes found. Migration may not be needed.');
    } else {
      console.log(`⚠️  Found ${stats.files_with_uuid_prefix} files with UUID prefixes.`);
      console.log('   Migration is recommended.');
    }

    if (conflictStats.potential_conflicts > 0) {
      console.log(`❌ WARNING: ${conflictStats.potential_conflicts} potential conflicts detected!`);
      console.log('   Files may have duplicate paths after removing UUID prefixes.');
      console.log('   Check the migration log for details.');
    } else {
      console.log('✅ No path conflicts detected.');
    }

    if (folderStats.top_level_folders > 0) {
      console.log(`📁 Found ${folderStats.top_level_folders} top-level folders.`);
      console.log('   Folder browsing should work after migration.');
    }

    console.log('\nNext steps:');
    console.log('1. Backup database and files');
    console.log('2. Run database migration: psql -d cacheflow -f migrations/remove_uuid_prefixes.sql');
    console.log('3. Run file system migration: node scripts/migrate-files-no-uuid.js');
    console.log('4. Deploy updated API and UI');

  } catch (error) {
    console.error('Verification failed:', error.message);
    console.error('\nMake sure:');
    console.error('1. Database is running and accessible');
    console.error('2. DATABASE_URL is set correctly');
    console.error('3. You have permission to query the files table');
  } finally {
    client.release();
    await pool.end();
  }
}

// Run verification
verifyMigration();