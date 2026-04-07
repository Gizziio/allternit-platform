#!/usr/bin/env node

/**
 * Create a new migration file
 * 
 * Usage:
 *   node scripts/create-migration.js <name>
 *   
 * Example:
 *   node scripts/create-migration.js add_user_table
 */

const fs = require('fs');
const path = require('path');

const migrationsDir = path.join(__dirname, '..', 'migrations');

function generateTimestamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

function createMigration(name) {
  if (!name) {
    console.error('Error: Migration name is required');
    console.log('Usage: node create-migration.js <name>');
    process.exit(1);
  }

  // Sanitize name
  const sanitizedName = name.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  const timestamp = generateTimestamp();
  const filename = `${timestamp}_${sanitizedName}.sql`;
  const filepath = path.join(migrationsDir, filename);

  // Ensure migrations directory exists
  if (!fs.existsSync(migrationsDir)) {
    fs.mkdirSync(migrationsDir, { recursive: true });
  }

  // Check if file already exists
  if (fs.existsSync(filepath)) {
    console.error(`Error: Migration file already exists: ${filename}`);
    process.exit(1);
  }

  // Template content
  const template = `-- Migration: ${sanitizedName}
-- Created at: ${new Date().toISOString()}

-- Up migration



-- Note: Down migration should be added below if needed
-- Down migration

`;

  fs.writeFileSync(filepath, template);
  console.log(`✅ Created migration: ${filename}`);
}

const name = process.argv[2];
createMigration(name);
