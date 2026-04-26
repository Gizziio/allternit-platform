#!/usr/bin/env node

/**
 * Plugin Validation Script
 * 
 * Validates the plugin structure and plugin.json before publishing.
 */

const fs = require('fs');
const path = require('path');

// ============================================================================
// VALIDATION RULES
// ============================================================================

const RULES = {
  requiredFiles: [
    'plugin.json',
    'README.md',
    'LICENSE',
  ],
  requiredFields: [
    'id',
    'name',
    'version',
    'description',
    'author',
  ],
  validCategories: [
    'productivity',
    'developer',
    'design',
    'data',
    'automation',
    'integration',
    'utility',
    'ai',
    'other',
  ],
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function success(message) {
  console.log(`  ✅ ${message}`);
}

function error(message) {
  console.error(`  ❌ ${message}`);
}

function warning(message) {
  console.warn(`  ⚠️  ${message}`);
}

function info(message) {
  console.log(`  ℹ️  ${message}`);
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate required files exist
 */
function validateRequiredFiles() {
  console.log('\n📁 Checking required files...\n');
  
  let allExist = true;
  
  for (const file of RULES.requiredFiles) {
    const filePath = path.join(process.cwd(), file);
    if (fs.existsSync(filePath)) {
      success(`${file} exists`);
    } else {
      error(`${file} is missing`);
      allExist = false;
    }
  }
  
  return allExist;
}

/**
 * Validate plugin.json exists and is valid JSON
 */
function validatePluginJsonExists() {
  console.log('\n📄 Checking plugin.json...\n');
  
  const pluginPath = path.join(process.cwd(), 'plugin.json');
  
  if (!fs.existsSync(pluginPath)) {
    error('plugin.json not found');
    return null;
  }
  
  try {
    const content = fs.readFileSync(pluginPath, 'utf-8');
    const plugin = JSON.parse(content);
    success('plugin.json is valid JSON');
    return plugin;
  } catch (err) {
    error(`plugin.json is invalid: ${err.message}`);
    return null;
  }
}

/**
 * Validate required fields in plugin.json
 */
function validateRequiredFields(plugin) {
  console.log('\n🔍 Checking required fields...\n');
  
  let allValid = true;
  
  for (const field of RULES.requiredFields) {
    if (plugin[field] && typeof plugin[field] === 'string' && plugin[field].trim() !== '') {
      success(`${field}: ${plugin[field]}`);
    } else {
      error(`${field} is missing or empty`);
      allValid = false;
    }
  }
  
  return allValid;
}

/**
 * Validate plugin ID format
 */
function validatePluginId(plugin) {
  console.log('\n🏷️  Checking plugin ID format...\n');
  
  const id = plugin.id;
  const kebabCaseRegex = /^[a-z0-9]+(-[a-z0-9]+)*$/;
  
  // Check for placeholders
  if (id.includes('{{') || id.includes('}}')) {
    error('Plugin ID contains template placeholders');
    info('Run: node scripts/init.js');
    return false;
  }
  
  if (!kebabCaseRegex.test(id)) {
    error(`Plugin ID "${id}" is not valid kebab-case`);
    info('Must be lowercase with hyphens (e.g., "my-awesome-plugin")');
    return false;
  }
  
  if (id.length > 50) {
    warning('Plugin ID is longer than 50 characters');
  }
  
  success(`Plugin ID "${id}" is valid`);
  return true;
}

/**
 * Validate version format
 */
function validateVersion(plugin) {
  console.log('\n🔢 Checking version format...\n');
  
  const version = plugin.version;
  const semverRegex = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?(\+[a-zA-Z0-9.-]+)?$/;
  
  if (!semverRegex.test(version)) {
    error(`Version "${version}" is not valid SemVer`);
    info('Format: MAJOR.MINOR.PATCH (e.g., "1.0.0")');
    return false;
  }
  
  success(`Version "${version}" is valid`);
  return true;
}

/**
 * Validate description length
 */
function validateDescription(plugin) {
  console.log('\n📝 Checking description...\n');
  
  const desc = plugin.description;
  
  if (desc.length > 200) {
    error(`Description is ${desc.length} characters (max 200)`);
    return false;
  }
  
  if (desc.length < 10) {
    warning('Description is very short (min 10 recommended)');
  }
  
  success(`Description is ${desc.length} characters`);
  return true;
}

/**
 * Validate author format
 */
function validateAuthor(plugin) {
  console.log('\n👤 Checking author...\n');
  
  const author = plugin.author;
  
  if (author.includes('{{') || author.includes('}}')) {
    error('Author contains template placeholders');
    info('Run: node scripts/init.js');
    return false;
  }
  
  success(`Author: ${author}`);
  return true;
}

/**
 * Validate entry point exists
 */
function validateEntryPoint(plugin) {
  console.log('\n🚪 Checking entry point...\n');
  
  const entry = plugin.entry || 'src/index.js';
  const entryPath = path.join(process.cwd(), entry);
  
  if (fs.existsSync(entryPath)) {
    success(`Entry point exists: ${entry}`);
    return true;
  } else {
    warning(`Entry point not found: ${entry}`);
    info('This is OK if you have not built yet');
    return true; // Not a critical error
  }
}

/**
 * Validate permissions
 */
function validatePermissions(plugin) {
  console.log('\n🔐 Checking permissions...\n');
  
  const validPermissions = [
    'storage',
    'network',
    'filesystem',
    'clipboard',
    'notifications',
    'webview',
    'commands',
    'events',
  ];
  
  const permissions = plugin.permissions || [];
  
  if (permissions.length === 0) {
    info('No permissions requested (plugin will have limited functionality)');
    return true;
  }
  
  let allValid = true;
  for (const perm of permissions) {
    if (validPermissions.includes(perm)) {
      success(`Permission: ${perm}`);
    } else {
      warning(`Unknown permission: ${perm}`);
    }
  }
  
  return allValid;
}

/**
 * Validate optional fields
 */
function validateOptionalFields(plugin) {
  console.log('\n🔧 Checking optional fields...\n');
  
  // Category
  if (plugin.category) {
    if (RULES.validCategories.includes(plugin.category)) {
      success(`Category: ${plugin.category}`);
    } else {
      warning(`Unknown category: ${plugin.category}`);
    }
  }
  
  // Tags
  if (plugin.tags && Array.isArray(plugin.tags)) {
    if (plugin.tags.length > 10) {
      warning('More than 10 tags (max recommended: 10)');
    }
    success(`Tags: ${plugin.tags.join(', ')}`);
  }
  
  // License
  if (plugin.license) {
    success(`License: ${plugin.license}`);
  } else {
    info('No license specified (using default from package.json)');
  }
  
  return true;
}

/**
 * Check for template placeholders
 */
function checkPlaceholders() {
  console.log('\n🔎 Checking for template placeholders...\n');
  
  const filesToCheck = [
    'plugin.json',
    'marketplace.json',
    'README.md',
    'package.json',
    'src/index.ts',
  ];
  
  let foundPlaceholders = false;
  
  for (const file of filesToCheck) {
    const filePath = path.join(process.cwd(), file);
    if (!fs.existsSync(filePath)) continue;
    
    const content = fs.readFileSync(filePath, 'utf-8');
    const matches = content.match(/\{\{[^}]+\}\}/g);
    
    if (matches) {
      warning(`${file} contains placeholders: ${[...new Set(matches)].join(', ')}`);
      foundPlaceholders = true;
    }
  }
  
  if (foundPlaceholders) {
    info('Run: node scripts/init.js to replace placeholders');
    return false;
  } else {
    success('No placeholders found');
    return true;
  }
}

/**
 * Validate marketplace.json if it exists
 */
function validateMarketplaceJson() {
  console.log('\n🏪 Checking marketplace.json...\n');
  
  const marketplacePath = path.join(process.cwd(), 'marketplace.json');
  
  if (!fs.existsSync(marketplacePath)) {
    info('marketplace.json not found (optional file)');
    return true;
  }
  
  try {
    const content = fs.readFileSync(marketplacePath, 'utf-8');
    JSON.parse(content);
    success('marketplace.json is valid JSON');
    return true;
  } catch (err) {
    error(`marketplace.json is invalid: ${err.message}`);
    return false;
  }
}

// ============================================================================
// MAIN
// ============================================================================

function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║           🧩 Allternit Plugin Validation                       ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  
  const results = {
    requiredFiles: validateRequiredFiles(),
    plugin: null,
    requiredFields: false,
    pluginId: false,
    version: false,
    description: false,
    author: false,
    entryPoint: false,
    permissions: false,
    optionalFields: false,
    placeholders: false,
    marketplace: false,
  };
  
  // Load and validate plugin.json
  results.plugin = validatePluginJsonExists();
  
  if (results.plugin) {
    results.requiredFields = validateRequiredFields(results.plugin);
    results.pluginId = validatePluginId(results.plugin);
    results.version = validateVersion(results.plugin);
    results.description = validateDescription(results.plugin);
    results.author = validateAuthor(results.plugin);
    results.entryPoint = validateEntryPoint(results.plugin);
    results.permissions = validatePermissions(results.plugin);
    results.optionalFields = validateOptionalFields(results.plugin);
  }
  
  // Other validations
  results.placeholders = checkPlaceholders();
  results.marketplace = validateMarketplaceJson();
  
  // Summary
  console.log('\n┌──────────────────────────────────────────────────────────┐');
  console.log('│                  📊 Validation Summary                   │');
  console.log('├──────────────────────────────────────────────────────────┤');
  
  const criticalChecks = [
    ['Required Files', results.requiredFiles],
    ['plugin.json', !!results.plugin],
    ['Required Fields', results.requiredFields],
    ['Plugin ID', results.pluginId],
    ['Version Format', results.version],
    ['Description', results.description],
    ['Author', results.author],
  ];
  
  const optionalChecks = [
    ['Entry Point', results.entryPoint],
    ['Permissions', results.permissions],
    ['Optional Fields', results.optionalFields],
    ['Placeholders', results.placeholders],
    ['Marketplace JSON', results.marketplace],
  ];
  
  let criticalPassed = 0;
  let optionalPassed = 0;
  
  for (const [name, passed] of criticalChecks) {
    const status = passed ? '✅' : '❌';
    console.log(`│ ${status} ${name.padEnd(52)}│`);
    if (passed) criticalPassed++;
  }
  
  console.log('├──────────────────────────────────────────────────────────┤');
  
  for (const [name, passed] of optionalChecks) {
    const status = passed ? '✅' : '⚠️';
    console.log(`│ ${status} ${name.padEnd(52)}│`);
    if (passed) optionalPassed++;
  }
  
  console.log('├──────────────────────────────────────────────────────────┤');
  console.log(`│ Critical: ${criticalPassed}/${criticalChecks.length} passed${' '.repeat(32)}│`);
  console.log(`│ Optional: ${optionalPassed}/${optionalChecks.length} passed${' '.repeat(32)}│`);
  console.log('└──────────────────────────────────────────────────────────┘');
  
  // Final result
  const allCriticalPassed = criticalPassed === criticalChecks.length;
  
  console.log('\n');
  if (allCriticalPassed) {
    console.log('✅ Validation passed! Your plugin is ready to publish.\n');
    process.exit(0);
  } else {
    console.log('❌ Validation failed. Please fix the errors above.\n');
    process.exit(1);
  }
}

main();
