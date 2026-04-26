#!/usr/bin/env node

/**
 * Check for version folder naming violations
 * 
 * Usage:
 *   node scripts/check-version-folders.js
 */

import { readdirSync } from 'fs';
import { join } from 'path';

const GATEWAY_ROOT = join(process.cwd());

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Pattern: folder names containing 'v' followed by a number (version naming)
const VERSION_FOLDER_PATTERN = /.*v[0-9]+.*/i;

// Allowed exceptions (these contain 'v' but are not version folders)
const ALLOWED_PATTERNS = [
  'node_modules',
  '.git',
  '.github',
  '.vscode',
  'vitest',
  'env',
  'dev',
  'srv',
];

function findVersionFolders(dir, baseDir = dir, results = []) {
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        const fullPath = join(dir, entry.name);
        const relativePath = fullPath.replace(baseDir + '/', '');
        
        // Skip allowed patterns
        if (ALLOWED_PATTERNS.some(p => entry.name.includes(p))) {
          continue;
        }
        
        // Check for version folder naming
        if (VERSION_FOLDER_PATTERN.test(entry.name)) {
          results.push(relativePath);
        }
        
        // Recurse into subdirectories
        findVersionFolders(fullPath, baseDir, results);
      }
    }
  } catch {
    // Ignore errors
  }
  
  return results;
}

function main() {
  log('\n🔍 Version Folder Naming Check', 'yellow');
  log('=' .repeat(50), 'gray');
  log('Rule: Versions live in spec/constants, not directory names\n', 'gray');

  const violations = findVersionFolders(GATEWAY_ROOT);

  log('='.repeat(50), 'gray');
  
  if (violations.length === 0) {
    log('✅ PASS: No version folder naming detected', 'green');
    log('\nNaming conventions enforced.\n', 'green');
    process.exit(0);
  } else {
    log('❌ FAIL: Version folder naming detected:\n', 'red');
    
    for (const folder of violations) {
      log(`  - ${folder}`, 'red');
    }
    
    log('\n⚠️  Use role-based names instead:', 'yellow');
    log('   runtime/ (not core/v1/)');
    log('   bindings/ui_contract_legacy/ (not bindings/ui_v0/)');
    log('   adapters/kernel/ (not adapters/allternit-kernel-v1/)');
    log('   transports/http_server/ (not transports/http-v1/)\n', 'yellow');
    
    process.exit(1);
  }
}

main();
