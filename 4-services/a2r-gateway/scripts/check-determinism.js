#!/usr/bin/env node

/**
 * Determinism Enforcement Lint Check
 * 
 * Verifies that eventBus.publish() does NOT appear in transport layer.
 * All canonical event emission must originate from kernel adapter only.
 * 
 * Usage:
 *   node scripts/check-determinism.js
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const GATEWAY_ROOT = join(__dirname, '..');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Directories where eventBus.publish() is FORBIDDEN
const FORBIDDEN_DIRS = [
  'transports',
  'compat',
];

// Directories where eventBus.publish() is ALLOWED
const ALLOWED_DIRS = [
  'adapters/a2r-kernel',
  'core',
];

function findTsFiles(dir, baseDir = dir) {
  const files = [];
  
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        files.push(...findTsFiles(fullPath, baseDir));
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.js'))) {
        const relativePath = fullPath.replace(baseDir + '/', '');
        files.push(relativePath);
      }
    }
  } catch {
    // Ignore errors
  }
  
  return files;
}

function checkFile(filePath) {
  const fullPath = join(GATEWAY_ROOT, filePath);
  
  try {
    let content = readFileSync(fullPath, 'utf-8');
    
    // Remove comments before checking
    content = content
      .replace(/\/\/.*$/gm, '')  // Remove single-line comments
      .replace(/\/\*[\s\S]*?\*\//g, '');  // Remove multi-line comments
    
    const violations = [];
    
    // Check for eventBus.publish() calls
    const publishRegex = /eventBus\.publish\(|this\.eventBus\.publish\(|kernel\._publish\(/g;
    let match;
    
    while ((match = publishRegex.exec(content)) !== null) {
      violations.push({
        type: 'eventBus.publish()',
        position: match.index,
      });
    }
    
    // Check for direct event emission in forbidden directories
    const emitRegex = /eventBus\.emit\(|this\.eventBus\.emit\(/g;
    
    while ((match = emitRegex.exec(content)) !== null) {
      violations.push({
        type: 'eventBus.emit()',
        position: match.index,
      });
    }
    
    return violations;
  } catch {
    return [];
  }
}

function main() {
  log('\n🔍 Determinism Enforcement Check', 'yellow');
  log('=' .repeat(50), 'gray');
  log('Verifying: eventBus.publish() only in kernel adapter\n', 'gray');

  const results = {
    passed: [],
    failed: [],
  };

  // Check all TypeScript files
  const allFiles = findTsFiles(GATEWAY_ROOT);
  
  for (const file of allFiles) {
    // Skip test files and this script
    if (file.includes('.test.') || file.includes('check-determinism')) {
      continue;
    }

    const violations = checkFile(file);
    
    // Check if file is in forbidden directory
    const isInForbiddenDir = FORBIDDEN_DIRS.some(dir => file.startsWith(dir));
    const isInAllowedDir = ALLOWED_DIRS.some(dir => file.startsWith(dir));
    
    if (isInForbiddenDir && violations.length > 0) {
      results.failed.push({
        file,
        violations,
        reason: 'eventBus.publish() in forbidden directory',
      });
    } else if (violations.length > 0 && !isInAllowedDir) {
      // File is not in allowed directory but has publish calls - flag for review
      log(`  ⚠️  Review: ${file} has eventBus.publish()`, 'yellow');
    }
  }

  // Summary
  log('\n' + '='.repeat(50), 'gray');
  
  if (results.failed.length === 0) {
    log('✅ PASS: No eventBus.publish() in transport/compat layers', 'green');
    log('\nDeterminism constraints enforced.\n', 'green');
    process.exit(0);
  } else {
    log('❌ FAIL: eventBus.publish() found in forbidden directories:\n', 'red');
    
    for (const failure of results.failed) {
      log(`  ${failure.file}`, 'red');
      log(`    Reason: ${failure.reason}`, 'red');
      for (const violation of failure.violations) {
        log(`    - ${violation.type}`, 'red');
      }
    }
    
    log('\n⚠️  All canonical event emission must originate from:', 'yellow');
    log('   adapters/a2r-kernel/* only\n', 'yellow');
    
    process.exit(1);
  }
}

main();
