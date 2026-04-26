#!/usr/bin/env node

/**
 * Allternit Plugin Template Initialization Script
 * 
 * This script replaces template placeholders with actual values provided by the user.
 * It should be run after creating a new repository from the template.
 * 
 * Usage:
 *   node scripts/init.js
 * 
 * The script will:
 * 1. Prompt for plugin information
 * 2. Replace placeholders in all files
 * 3. Update file names and paths
 * 4. Delete itself after completion
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// ============================================================================
// CONFIGURATION
// ============================================================================

const PLACEHOLDERS = {
  PLUGIN_ID: '{{PLUGIN_ID}}',
  PLUGIN_NAME: '{{PLUGIN_NAME}}',
  PLUGIN_TAGLINE: '{{PLUGIN_TAGLINE}}',
  PLUGIN_DESCRIPTION: '{{PLUGIN_DESCRIPTION}}',
  AUTHOR_NAME: '{{AUTHOR_NAME}}',
  AUTHOR_EMAIL: '{{AUTHOR_EMAIL}}',
  GITHUB_USERNAME: '{{GITHUB_USERNAME}}',
  REPO_NAME: '{{REPO_NAME}}',
  YEAR: '{{YEAR}}',
};

const FILES_TO_PROCESS = [
  'README.md',
  'plugin.json',
  'marketplace.json',
  'LICENSE',
  'src/index.ts',
  'docs/README.md',
  'examples/basic-usage.js',
  'examples/basic-usage.ts',
  'examples/README.md',
];

const IGNORE_PATTERNS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  '.DS_Store',
];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create readline interface for user input
 */
function createInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

/**
 * Prompt for user input with a default value
 */
function ask(rl, question, defaultValue = '') {
  return new Promise((resolve) => {
    const prompt = defaultValue 
      ? `${question} [${defaultValue}]: ` 
      : `${question}: `;
    
    rl.question(prompt, (answer) => {
      resolve(answer.trim() || defaultValue);
    });
  });
}

/**
 * Validate plugin ID format (kebab-case)
 */
function validatePluginId(id) {
  const kebabCaseRegex = /^[a-z0-9]+(-[a-z0-9]+)*$/;
  return kebabCaseRegex.test(id);
}

/**
 * Validate email format
 */
function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate GitHub username
 */
function validateGitHubUsername(username) {
  const githubRegex = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/;
  return githubRegex.test(username);
}

/**
 * Convert a string to kebab-case
 */
function toKebabCase(str) {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

/**
 * Convert a string to Title Case
 */
function toTitleCase(str) {
  return str
    .split(/[-_\s]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Read file content
 */
function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch (error) {
    console.warn(`⚠️  Could not read ${filePath}: ${error.message}`);
    return null;
  }
}

/**
 * Write file content
 */
function writeFile(filePath, content) {
  try {
    fs.writeFileSync(filePath, content, 'utf-8');
    return true;
  } catch (error) {
    console.error(`❌ Could not write ${filePath}: ${error.message}`);
    return false;
  }
}

/**
 * Replace placeholders in content
 */
function replacePlaceholders(content, values) {
  let result = content;
  for (const [key, value] of Object.entries(values)) {
    const placeholder = PLACEHOLDERS[key];
    if (placeholder) {
      result = result.replace(new RegExp(escapeRegex(placeholder), 'g'), value);
    }
  }
  return result;
}

/**
 * Escape special regex characters
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Process a single file
 */
function processFile(filePath, values) {
  const content = readFile(filePath);
  if (content === null) return false;

  const newContent = replacePlaceholders(content, values);
  
  if (content !== newContent) {
    if (writeFile(filePath, newContent)) {
      console.log(`  ✅ ${filePath}`);
      return true;
    }
  } else {
    console.log(`  ⏭️  ${filePath} (no changes needed)`);
    return false;
  }
}

/**
 * Recursively find files containing placeholders
 */
function findFilesWithPlaceholders(dir, results = []) {
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    // Skip ignored patterns
    if (IGNORE_PATTERNS.some(pattern => fullPath.includes(pattern))) {
      continue;
    }
    
    if (stat.isDirectory()) {
      findFilesWithPlaceholders(fullPath, results);
    } else if (stat.isFile()) {
      const content = readFile(fullPath);
      if (content && Object.values(PLACEHOLDERS).some(p => content.includes(p))) {
        results.push(fullPath);
      }
    }
  }
  
  return results;
}

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

/**
 * Collect information from the user
 */
async function collectInfo() {
  const rl = createInterface();
  
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║     🧩 Allternit Plugin Template Initialization               ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('\n');
  console.log('This script will customize the template for your plugin.');
  console.log('Press Enter to accept the default values [in brackets].\n');

  const info = {};

  // Plugin ID
  while (true) {
    const input = await ask(rl, 'Plugin ID (kebab-case, e.g., my-awesome-plugin)');
    if (!input) {
      console.log('❌ Plugin ID is required');
      continue;
    }
    if (!validatePluginId(input)) {
      console.log('❌ Plugin ID must be lowercase kebab-case (e.g., "my-awesome-plugin")');
      continue;
    }
    info.PLUGIN_ID = input;
    break;
  }

  // Plugin Name
  const defaultName = toTitleCase(info.PLUGIN_ID);
  info.PLUGIN_NAME = await ask(rl, 'Plugin display name', defaultName);

  // Plugin Tagline
  info.PLUGIN_TAGLINE = await ask(rl, 'Short tagline (max 100 chars)', `A powerful plugin for ${info.PLUGIN_NAME}`);

  // Plugin Description
  info.PLUGIN_DESCRIPTION = await ask(rl, 'Description', `${info.PLUGIN_NAME} extends the Allternit Platform with amazing features.`);

  // Author Name
  info.AUTHOR_NAME = await ask(rl, 'Your name');
  while (!info.AUTHOR_NAME) {
    console.log('❌ Author name is required');
    info.AUTHOR_NAME = await ask(rl, 'Your name');
  }

  // Author Email
  info.AUTHOR_EMAIL = await ask(rl, 'Your email');
  while (!info.AUTHOR_EMAIL || !validateEmail(info.AUTHOR_EMAIL)) {
    if (info.AUTHOR_EMAIL) {
      console.log('❌ Invalid email format');
    } else {
      console.log('❌ Email is required');
    }
    info.AUTHOR_EMAIL = await ask(rl, 'Your email');
  }

  // GitHub Username
  info.GITHUB_USERNAME = await ask(rl, 'GitHub username');
  while (!info.GITHUB_USERNAME || !validateGitHubUsername(info.GITHUB_USERNAME)) {
    if (info.GITHUB_USERNAME) {
      console.log('❌ Invalid GitHub username format');
    } else {
      console.log('❌ GitHub username is required');
    }
    info.GITHUB_USERNAME = await ask(rl, 'GitHub username');
  }

  // Repository Name (default: allternit-{plugin-id})
  const defaultRepo = `allternit-${info.PLUGIN_ID}`;
  info.REPO_NAME = await ask(rl, 'Repository name', defaultRepo);

  // Year
  info.YEAR = new Date().getFullYear().toString();

  rl.close();
  return info;
}

/**
 * Display collected information
 */
function displayInfo(info) {
  console.log('\n');
  console.log('┌──────────────────────────────────────────────────────────┐');
  console.log('│           📋 Summary                                     │');
  console.log('├──────────────────────────────────────────────────────────┤');
  console.log(`│ Plugin ID:        ${info.PLUGIN_ID.padEnd(40)}│`);
  console.log(`│ Plugin Name:      ${info.PLUGIN_NAME.padEnd(40)}│`);
  console.log(`│ Tagline:          ${info.PLUGIN_TAGLINE.substring(0, 38).padEnd(40)}│`);
  console.log(`│ Author:           ${info.AUTHOR_NAME.padEnd(40)}│`);
  console.log(`│ Email:            ${info.AUTHOR_EMAIL.padEnd(40)}│`);
  console.log(`│ GitHub:           ${info.GITHUB_USERNAME.padEnd(40)}│`);
  console.log(`│ Repository:       ${info.REPO_NAME.padEnd(40)}│`);
  console.log(`│ Year:             ${info.YEAR.padEnd(40)}│`);
  console.log('└──────────────────────────────────────────────────────────┘');
  console.log('\n');
}

/**
 * Process all template files
 */
async function processFiles(info) {
  console.log('📝 Processing files...\n');

  const processed = [];
  const failed = [];

  // Process known files
  for (const file of FILES_TO_PROCESS) {
    const filePath = path.join(process.cwd(), file);
    if (fs.existsSync(filePath)) {
      if (processFile(filePath, info)) {
        processed.push(file);
      }
    }
  }

  // Find and process any other files with placeholders
  const additionalFiles = findFilesWithPlaceholders(process.cwd())
    .map(f => path.relative(process.cwd(), f))
    .filter(f => !FILES_TO_PROCESS.includes(f));

  if (additionalFiles.length > 0) {
    console.log('\n📁 Processing additional files...');
    for (const file of additionalFiles) {
      const filePath = path.join(process.cwd(), file);
      if (processFile(filePath, info)) {
        processed.push(file);
      }
    }
  }

  return { processed, failed };
}

/**
 * Update package.json if it exists
 */
function updatePackageJson(info) {
  const packagePath = path.join(process.cwd(), 'package.json');
  
  if (!fs.existsSync(packagePath)) {
    return;
  }

  console.log('\n📦 Updating package.json...');

  try {
    const content = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
    
    // Update fields
    content.name = info.PLUGIN_ID.startsWith('allternit-') 
      ? info.PLUGIN_ID 
      : `allternit-${info.PLUGIN_ID}`;
    content.version = '1.0.0';
    content.description = info.PLUGIN_DESCRIPTION;
    content.author = `${info.AUTHOR_NAME} <${info.AUTHOR_EMAIL}>`;
    content.repository = {
      type: 'git',
      url: `https://github.com/${info.GITHUB_USERNAME}/${info.REPO_NAME}.git`,
    };
    content.bugs = {
      url: `https://github.com/${info.GITHUB_USERNAME}/${info.REPO_NAME}/issues`,
    };
    content.homepage = `https://github.com/${info.GITHUB_USERNAME}/${info.REPO_NAME}#readme`;

    fs.writeFileSync(packagePath, JSON.stringify(content, null, 2), 'utf-8');
    console.log('  ✅ package.json updated');
  } catch (error) {
    console.error('  ❌ Failed to update package.json:', error.message);
  }
}

/**
 * Create additional files
 */
function createAdditionalFiles(info) {
  console.log('\n📄 Creating additional files...');

  // Create .gitignore if it doesn't exist
  const gitignorePath = path.join(process.cwd(), '.gitignore');
  if (!fs.existsSync(gitignorePath)) {
    const gitignoreContent = `# Dependencies
node_modules/
package-lock.json
yarn.lock
pnpm-lock.yaml

# Build outputs
dist/
build/
*.tsbuildinfo

# Environment
.env
.env.local
.env.*.local

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
*.log
logs/

# Testing
coverage/
.nyc_output/

# Temporary files
*.tmp
*.temp
.cache/
`;
    fs.writeFileSync(gitignorePath, gitignoreContent, 'utf-8');
    console.log('  ✅ .gitignore created');
  }

  // Create CHANGELOG.md if it doesn't exist
  const changelogPath = path.join(process.cwd(), 'CHANGELOG.md');
  if (!fs.existsSync(changelogPath)) {
    const changelogContent = `# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - ${info.YEAR}-01-01

### Added
- ✨ Initial release
- 🎉 Basic functionality implemented
- 📚 Documentation added

[Unreleased]: https://github.com/${info.GITHUB_USERNAME}/${info.REPO_NAME}/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/${info.GITHUB_USERNAME}/${info.REPO_NAME}/releases/tag/v1.0.0
`;
    fs.writeFileSync(changelogPath, changelogContent, 'utf-8');
    console.log('  ✅ CHANGELOG.md created');
  }

  // Create CONTRIBUTING.md if it doesn't exist
  const contributingPath = path.join(process.cwd(), 'CONTRIBUTING.md');
  if (!fs.existsSync(contributingPath)) {
    const contributingContent = `# Contributing to ${info.PLUGIN_NAME}

Thank you for your interest in contributing! 🎉

## Development Setup

1. Fork and clone the repository
2. Install dependencies: \`npm install\`
3. Run in development mode: \`npm run dev\`

## Submitting Changes

1. Create a feature branch: \`git checkout -b feature/amazing-feature\`
2. Make your changes
3. Run tests: \`npm test\`
4. Commit: \`git commit -m 'Add amazing feature'\`
5. Push: \`git push origin feature/amazing-feature\`
6. Open a Pull Request

## Code Style

- Follow the existing code style
- Run \`npm run lint\` before committing
- Add tests for new features

## Reporting Issues

Please use the [GitHub issue tracker](https://github.com/${info.GITHUB_USERNAME}/${info.REPO_NAME}/issues).

## Questions?

Join our [Discord community](https://discord.gg/allternit)!
`;
    fs.writeFileSync(contributingPath, contributingContent, 'utf-8');
    console.log('  ✅ CONTRIBUTING.md created');
  }
}

/**
 * Self-destruct the script
 */
function selfDestruct() {
  console.log('\n🗑️  Cleaning up...');
  
  try {
    const scriptPath = __filename;
    
    // Delete this script
    fs.unlinkSync(scriptPath);
    console.log('  ✅ Initialization script deleted');

    // Optionally remove the scripts directory if empty
    const scriptsDir = path.dirname(scriptPath);
    const remaining = fs.readdirSync(scriptsDir);
    
    if (remaining.length === 0) {
      fs.rmdirSync(scriptsDir);
      console.log('  ✅ Scripts directory removed');
    }

  } catch (error) {
    console.warn('  ⚠️  Could not delete script:', error.message);
    console.log('     You can manually delete scripts/init.js');
  }
}

/**
 * Print next steps
 */
function printNextSteps(info) {
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║              🎉 Initialization Complete!                 ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('\n');
  console.log('Next steps:');
  console.log('');
  console.log('  1. 📦 Install dependencies:');
  console.log('     npm install');
  console.log('');
  console.log('  2. 📝 Review and customize plugin.json');
  console.log('');
  console.log('  3. 💻 Implement your plugin in src/index.ts');
  console.log('');
  console.log('  4. 🧪 Test locally:');
  console.log('     npm run build');
  console.log('     npm run validate');
  console.log('');
  console.log('  5. 📤 Create a GitHub repository:');
  console.log(`     git init`);
  console.log(`     git add .`);
  console.log(`     git commit -m "Initial commit"`);
  console.log(`     git remote add origin https://github.com/${info.GITHUB_USERNAME}/${info.REPO_NAME}.git`);
  console.log(`     git push -u origin main`);
  console.log('');
  console.log('  6. 🚀 Publish to Allternit Marketplace');
  console.log('     Visit: https://marketplace.allternit.dev/submit');
  console.log('');
  console.log('Happy coding! 🎈');
  console.log('\n');
}

/**
 * Main function
 */
async function main() {
  try {
    // Check if running from correct directory
    if (!fs.existsSync(path.join(process.cwd(), 'plugin.json'))) {
      console.error('❌ Error: plugin.json not found.');
      console.error('   Please run this script from the plugin root directory.');
      process.exit(1);
    }

    // Collect information
    const info = await collectInfo();

    // Display summary
    displayInfo(info);

    // Confirm
    const rl = createInterface();
    const confirm = await ask(rl, 'Is this correct? (yes/no)', 'yes');
    rl.close();

    if (confirm.toLowerCase() !== 'yes' && confirm.toLowerCase() !== 'y') {
      console.log('\n❌ Initialization cancelled.');
      console.log('   Run the script again to start over.\n');
      process.exit(0);
    }

    // Process files
    const { processed } = await processFiles(info);

    // Update package.json
    updatePackageJson(info);

    // Create additional files
    createAdditionalFiles(info);

    // Self-destruct
    selfDestruct();

    // Print next steps
    printNextSteps(info);

  } catch (error) {
    console.error('\n❌ An error occurred:', error.message);
    process.exit(1);
  }
}

// Run main function
main();
