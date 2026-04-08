#!/usr/bin/env node
/**
 * Vendor Plugins Script
 * 
 * Downloads plugins from marketplace sources and saves them to src/plugins/vendor/
 * 
 * Usage:
 *   node scripts/vendor-plugins.js              # Sync all plugins
 *   node scripts/vendor-plugins.js --check      # Check for updates
 *   node scripts/vendor-plugins.js --plugin=ID  # Sync specific plugin
 *   node scripts/vendor-plugins.js --source=REPO # Sync all from source
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// Configuration
const VENDOR_DIR = path.join(__dirname, '..', 'src', 'plugins', 'vendor');
const GITHUB_API = 'https://api.github.com';
const REQUEST_TIMEOUT = 30000;

// ANSI colors for output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

// Plugin definitions to vendor
const PLUGINS_TO_VENDOR = [
  // Anthropic Official
  {
    id: 'claude-artifacts',
    name: 'Claude Artifacts',
    sourceRepo: 'anthropics/claude-plugins-official',
    sourcePath: 'plugins/artifacts',
    category: 'create',
  },
  {
    id: 'claude-deep-research',
    name: 'Claude Deep Research',
    sourceRepo: 'anthropics/claude-plugins-official',
    sourcePath: 'plugins/deep-research',
    category: 'analyze',
  },
  {
    id: 'claude-data-analyst',
    name: 'Claude Data Analyst',
    sourceRepo: 'anthropics/claude-plugins-official',
    sourcePath: 'plugins/data-analyst',
    category: 'analyze',
  },
  {
    id: 'claude-web-search',
    name: 'Claude Web Search',
    sourceRepo: 'anthropics/claude-plugins-official',
    sourcePath: 'plugins/web-search',
    category: 'analyze',
  },
  // Anthropic Claude Code
  {
    id: 'claude-code-expert',
    name: 'Claude Code Expert',
    sourceRepo: 'anthropics/claude-code',
    sourcePath: 'plugins/code-expert',
    category: 'build',
  },
  {
    id: 'claude-git-assistant',
    name: 'Claude Git Assistant',
    sourceRepo: 'anthropics/claude-code',
    sourcePath: 'plugins/git-assistant',
    category: 'build',
  },
  {
    id: 'claude-debugger',
    name: 'Claude Debugger',
    sourceRepo: 'anthropics/claude-code',
    sourcePath: 'plugins/debugger',
    category: 'build',
  },
  {
    id: 'claude-test-generator',
    name: 'Claude Test Generator',
    sourceRepo: 'anthropics/claude-code',
    sourcePath: 'plugins/test-generator',
    category: 'build',
  },
  // Anthropic Life Sciences
  {
    id: 'claude-bio-research',
    name: 'Claude Bio Research',
    sourceRepo: 'anthropics/life-sciences',
    sourcePath: 'plugins/bio-research',
    category: 'analyze',
  },
  {
    id: 'claude-drug-discovery',
    name: 'Claude Drug Discovery',
    sourceRepo: 'anthropics/life-sciences',
    sourcePath: 'plugins/drug-discovery',
    category: 'analyze',
  },
  // Docker
  {
    id: 'docker-dev-assistant',
    name: 'Docker Dev Assistant',
    sourceRepo: 'docker/claude-plugins',
    sourcePath: 'plugins/dev-assistant',
    category: 'build',
  },
  {
    id: 'docker-compose-generator',
    name: 'Docker Compose Generator',
    sourceRepo: 'docker/claude-plugins',
    sourcePath: 'plugins/compose-generator',
    category: 'build',
  },
  {
    id: 'docker-security-scanner',
    name: 'Docker Security Scanner',
    sourceRepo: 'docker/claude-plugins',
    sourcePath: 'plugins/security-scanner',
    category: 'analyze',
  },
];

// Utility: HTTP request with timeout
function fetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: REQUEST_TIMEOUT, ...options }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data, headers: res.headers }));
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

// Utility: Create directory recursively
function mkdirp(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Utility: Write file with directory creation
function writeFile(filePath, content) {
  mkdirp(path.dirname(filePath));
  fs.writeFileSync(filePath, content);
}

// Utility: Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    check: args.includes('--check'),
    verbose: args.includes('--verbose') || args.includes('-v'),
  };
  
  const pluginArg = args.find(a => a.startsWith('--plugin='));
  if (pluginArg) {
    options.pluginId = pluginArg.split('=')[1];
  }
  
  const sourceArg = args.find(a => a.startsWith('--source='));
  if (sourceArg) {
    options.sourceRepo = sourceArg.split('=')[1];
  }
  
  return options;
}

// Get GitHub API token from environment
function getGitHubToken() {
  return process.env.GITHUB_TOKEN || process.env.GH_TOKEN || null;
}

// Fetch directory contents from GitHub
async function fetchGitHubDirectory(repo, path_in_repo, ref = 'main') {
  const token = getGitHubToken();
  const headers = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'allternit-vendor-script',
  };
  if (token) {
    headers['Authorization'] = `token ${token}`;
  }
  
  const url = `${GITHUB_API}/repos/${repo}/contents/${path_in_repo}?ref=${ref}`;
  console.log(`${colors.dim}Fetching: ${url}${colors.reset}`);
  
  const response = await fetch(url, { headers });
  
  if (response.status === 404) {
    throw new Error(`Path not found: ${repo}/${path_in_repo}`);
  }
  if (response.status === 403) {
    throw new Error('GitHub API rate limit exceeded. Set GITHUB_TOKEN env variable.');
  }
  if (response.status !== 200) {
    throw new Error(`GitHub API error: ${response.status}`);
  }
  
  return JSON.parse(response.data);
}

// Fetch file content from GitHub
async function fetchGitHubFile(repo, path_in_repo, ref = 'main') {
  const token = getGitHubToken();
  const headers = {
    'Accept': 'application/vnd.github.v3.raw',
    'User-Agent': 'allternit-vendor-script',
  };
  if (token) {
    headers['Authorization'] = `token ${token}`;
  }
  
  const url = `${GITHUB_API}/repos/${repo}/contents/${path_in_repo}?ref=${ref}`;
  const response = await fetch(url, { headers });
  
  if (response.status !== 200) {
    throw new Error(`Failed to fetch file: ${response.status}`);
  }
  
  return response.data;
}

// Download a plugin recursively
async function downloadPlugin(plugin, targetDir, options = {}) {
  console.log(`\n${colors.cyan}Downloading: ${colors.bright}${plugin.name}${colors.reset}`);
  console.log(`${colors.dim}Source: ${plugin.sourceRepo}/${plugin.sourcePath}${colors.reset}`);
  console.log(`${colors.dim}Target: ${targetDir}${colors.reset}`);
  
  let fileCount = 0;
  
  async function downloadRecursive(repo, sourcePath, targetPath) {
    const items = await fetchGitHubDirectory(repo, sourcePath);
    
    for (const item of items) {
      const itemTargetPath = path.join(targetPath, item.name);
      
      if (item.type === 'dir') {
        // Skip common non-source directories
        const skipDirs = ['node_modules', '.git', 'dist', 'build', '.next', '__pycache__', 'venv'];
        if (skipDirs.includes(item.name)) {
          console.log(`${colors.dim}  Skipping: ${item.path}${colors.reset}`);
          continue;
        }
        
        await downloadRecursive(repo, item.path, itemTargetPath);
      } else if (item.type === 'file') {
        // Check file size (skip large files)
        if (item.size > 1024 * 1024) { // 1MB limit
          console.log(`${colors.yellow}  Skipping large file: ${item.name} (${Math.round(item.size / 1024)}KB)${colors.reset}`);
          continue;
        }
        
        try {
          const content = await fetchGitHubFile(repo, item.path);
          writeFile(itemTargetPath, content);
          fileCount++;
          
          if (options.verbose) {
            console.log(`${colors.green}  ✓${colors.reset} ${item.path}`);
          }
        } catch (err) {
          console.log(`${colors.red}  ✗${colors.reset} ${item.path}: ${err.message}`);
        }
      }
    }
  }
  
  try {
    await downloadRecursive(plugin.sourceRepo, plugin.sourcePath, targetDir);
    console.log(`${colors.green}✓ Downloaded ${fileCount} files${colors.reset}`);
    return { success: true, fileCount };
  } catch (err) {
    console.log(`${colors.red}✗ Failed: ${err.message}${colors.reset}`);
    return { success: false, error: err.message };
  }
}

// Create plugin.json manifest for vendored plugin
function createPluginManifest(plugin, targetDir) {
  const manifest = {
    $schema: 'https://anthropic.com/claude-code/plugin.schema.json',
    id: plugin.id,
    name: plugin.name,
    description: plugin.description || `${plugin.name} plugin`,
    version: plugin.version || '1.0.0',
    author: plugin.author || { name: 'Unknown' },
    category: plugin.category || 'development',
    tags: plugin.tags || [],
    source: {
      type: 'vendored',
      originalRepo: plugin.sourceRepo,
      originalPath: plugin.sourcePath,
      vendoredDate: new Date().toISOString(),
    },
  };
  
  const manifestPath = path.join(targetDir, '.claude-plugin', 'plugin.json');
  writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`${colors.green}✓ Created plugin.json${colors.reset}`);
}

// Main function
async function main() {
  const options = parseArgs();
  
  console.log(`${colors.bright}${colors.blue}
╔════════════════════════════════════════════════════════════════╗
║           Allternit Plugin Vendor Script                       ║
║                                                                ║
║  Downloads marketplace plugins to src/plugins/vendor/          ║
╚════════════════════════════════════════════════════════════════╝
${colors.reset}`);
  
  // Filter plugins based on arguments
  let pluginsToProcess = PLUGINS_TO_VENDOR;
  
  if (options.pluginId) {
    pluginsToProcess = pluginsToProcess.filter(p => p.id === options.pluginId);
    if (pluginsToProcess.length === 0) {
      console.log(`${colors.red}Plugin not found: ${options.pluginId}${colors.reset}`);
      process.exit(1);
    }
  }
  
  if (options.sourceRepo) {
    pluginsToProcess = pluginsToProcess.filter(p => p.sourceRepo === options.sourceRepo);
  }
  
  console.log(`\n${colors.bright}Processing ${pluginsToProcess.length} plugins...${colors.reset}\n`);
  
  const results = {
    success: [],
    failed: [],
  };
  
  for (const plugin of pluginsToProcess) {
    // Determine target directory
    const [org, repo] = plugin.sourceRepo.split('/');
    const targetDir = path.join(VENDOR_DIR, org, plugin.id);
    
    if (options.check) {
      // Check mode - just verify plugin exists remotely
      try {
        await fetchGitHubDirectory(plugin.sourceRepo, plugin.sourcePath);
        console.log(`${colors.green}✓${colors.reset} ${plugin.name} - Available`);
        results.success.push(plugin);
      } catch (err) {
        console.log(`${colors.red}✗${colors.reset} ${plugin.name} - ${err.message}`);
        results.failed.push({ plugin, error: err.message });
      }
    } else {
      // Download mode
      const result = await downloadPlugin(plugin, targetDir, options);
      
      if (result.success) {
        createPluginManifest(plugin, targetDir);
        results.success.push(plugin);
      } else {
        results.failed.push({ plugin, error: result.error });
      }
    }
  }
  
  // Summary
  console.log(`\n${colors.bright}${colors.cyan}═══════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bright}SUMMARY${colors.reset}`);
  console.log(`${colors.green}  Success: ${results.success.length}${colors.reset}`);
  console.log(`${colors.red}  Failed: ${results.failed.length}${colors.reset}`);
  
  if (results.failed.length > 0) {
    console.log(`\n${colors.red}Failed plugins:${colors.reset}`);
    for (const { plugin, error } of results.failed) {
      console.log(`  - ${plugin.name}: ${error}`);
    }
  }
  
  console.log(`\n${colors.dim}Vendored plugins directory: ${VENDOR_DIR}${colors.reset}`);
  console.log(`${colors.dim}Update src/plugins/vendor/vendored-plugins.ts with new metadata${colors.reset}\n`);
  
  process.exit(results.failed.length > 0 ? 1 : 0);
}

// Run main
main().catch(err => {
  console.error(`${colors.red}Fatal error: ${err.message}${colors.reset}`);
  process.exit(1);
});
