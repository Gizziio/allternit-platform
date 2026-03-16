#!/usr/bin/env node

/**
 * Database migration script
 * 
 * Usage:
 *   node scripts/migrate.js up    - Run all pending migrations
 *   node scripts/migrate.js down  - Rollback last migration
 *   node scripts/migrate.js status - Check migration status
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Load environment variables
require('dotenv').config();

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'a2r_infrastructure',
  user: process.env.DB_USER || 'a2r_user',
  password: process.env.DB_PASSWORD || 'secure_password',
});

const migrationsDir = path.join(__dirname, '..', 'migrations');

async function ensureMigrationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) UNIQUE NOT NULL,
      executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function getExecutedMigrations() {
  const result = await pool.query('SELECT filename FROM migrations ORDER BY id');
  return result.rows.map(row => row.filename);
}

async function executeMigration(filename, sql) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('INSERT INTO migrations (filename) VALUES ($1)', [filename]);
    await client.query('COMMIT');
    console.log(`✅ Executed migration: ${filename}`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function rollbackMigration(filename) {
  // Note: This is a simplified rollback that just removes the migration record
  // In production, you would have down migrations
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM migrations WHERE filename = $1', [filename]);
    await client.query('COMMIT');
    console.log(`✅ Rolled back migration: ${filename}`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function migrateUp() {
  await ensureMigrationsTable();
  
  const executedMigrations = await getExecutedMigrations();
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  let executedCount = 0;

  for (const file of files) {
    if (!executedMigrations.includes(file)) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      await executeMigration(file, sql);
      executedCount++;
    }
  }

  if (executedCount === 0) {
    console.log('No pending migrations');
  } else {
    console.log(`\n✨ Executed ${executedCount} migration(s)`);
  }
}

async function migrateDown() {
  await ensureMigrationsTable();
  
  const executedMigrations = await getExecutedMigrations();
  
  if (executedMigrations.length === 0) {
    console.log('No migrations to rollback');
    return;
  }

  const lastMigration = executedMigrations[executedMigrations.length - 1];
  await rollbackMigration(lastMigration);
  
  console.log('\n⚠️  Note: This only removes the migration record.');
  console.log('   Database schema changes are NOT reverted automatically.');
}

async function migrationStatus() {
  await ensureMigrationsTable();
  
  const executedMigrations = await getExecutedMigrations();
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log('\n📊 Migration Status:\n');
  console.log('Filename                    | Status');
  console.log('----------------------------|--------');
  
  for (const file of files) {
    const status = executedMigrations.includes(file) ? '✅ executed' : '⏳ pending';
    console.log(`${file.padEnd(27)} | ${status}`);
  }

  console.log(`\nTotal: ${executedMigrations.length}/${files.length} executed`);
}

async function main() {
  const command = process.argv[2] || 'up';

  try {
    switch (command) {
      case 'up':
        await migrateUp();
        break;
      case 'down':
        await migrateDown();
        break;
      case 'status':
        await migrationStatus();
        break;
      default:
        console.log(`Unknown command: ${command}`);
        console.log('Usage: node migrate.js [up|down|status]');
        process.exit(1);
    }
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
