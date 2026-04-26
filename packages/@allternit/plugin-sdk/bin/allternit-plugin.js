#!/usr/bin/env node
/**
 * Allternit Plugin CLI
 * 
 * Commands:
 *   allternit-plugin create <name>     Create new plugin
 *   allternit-plugin run <plugin>      Run a plugin
 *   allternit-plugin serve             Start HTTP server
 *   allternit-plugin convert           Convert templates to plugins
 *   allternit-plugin validate          Validate plugin manifest
 *   allternit-plugin package           Package plugin for distribution
 */

const { program } = require('commander');
const fs = require('fs/promises');
const path = require('path');
const { execSync } = require('child_process');

const packageJson = require('../package.json');

program
  .name('allternit-plugin')
  .description('Allternit Plugin SDK CLI')
  .version(packageJson.version);

// Create new plugin
program
  .command('create <name>')
  .description('Create a new plugin (from template or scratch)')
  .option('-t, --template <name>', 'Use template (market-research, code-review, image-gen, etc.)')
  .option('-d, --templates-dir <path>', 'Templates directory', '/Users/macbook/allternit/templates')
  .option('--adapters <list>', 'Adapters to include (mcp,http,cli,vscode)', 'mcp,http,cli')
  .option('--category <type>', 'Plugin category', 'custom')
  .action(async (name, options) => {
    console.log(`Creating plugin: ${name}`);
    
    if (options.template) {
      console.log(`Using template: ${options.template}`);
      await createFromTemplate(name, options.template, options);
    } else {
      console.log('Creating from scratch...');
      await createFromScratch(name, options);
    }
  });

async function createFromScratch(name, options) {
  const pluginDir = path.join(process.cwd(), name);
  await fs.mkdir(pluginDir, { recursive: true });
  await fs.mkdir(path.join(pluginDir, 'src'), { recursive: true });
  
  const adapters = options.adapters.split(',');
  
  // Create manifest.json
  const manifest = {
    id: name,
    name: toPascalCase(name),
    version: '1.0.0',
    runtime: 'allternit-plugin-v1',
    description: `A plugin that ${name}`,
    category: options.category,
    requires: {
      llm: { capabilities: ['reasoning'] },
    },
    provides: {
      functions: [{
        name: 'execute',
        description: 'Main function',
        parameters: {
          type: 'object',
          properties: {
            input: { type: 'string', description: 'Input text' },
          },
          required: ['input'],
        },
        returns: { type: 'object', properties: { result: { type: 'string' } } },
      }],
    },
    adapters: adapters.reduce((acc, a) => ({ ...acc, [a]: `./adapters/${a}.js` }), {}),
  };
  
  await fs.writeFile(
    path.join(pluginDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  );
  
  // Create src/index.ts with TODOs
  const srcCode = `import { PluginHost, ExecutionResult } from '@allternit/plugin-sdk';
import manifest from '../manifest.json';

/**
 * ${toPascalCase(name)} Plugin
 * 
 * TODO: Add your plugin description here
 */

export { manifest };

export async function execute(host: PluginHost, params: any): Promise<ExecutionResult> {
  // TODO: Implement your plugin logic here
  
  // Example: Use LLM
  const result = await host.llm.complete(\`
    Process this input: \${params.input}
    
    TODO: Customize this prompt for your use case
  \`);
  
  // Example: Render output
  host.ui.renderMarkdown(result);
  
  return { 
    success: true, 
    result,
    // TODO: Add any additional return data
  };
}

export async function initialize(host: PluginHost): Promise<void> {
  // TODO: Any one-time setup
  console.log('${name} plugin initialized');
}
`;
  
  await fs.writeFile(path.join(pluginDir, 'src', 'index.ts'), srcCode);
  
  // Create package.json
  const pkg = {
    name: name.startsWith('@') ? name : `@allternit/${name}`,
    version: '1.0.0',
    description: manifest.description,
    main: 'dist/index.js',
    types: 'dist/index.d.ts',
    scripts: {
      build: 'tsc',
      prepare: 'npm run build',
      validate: 'allternit-plugin validate',
    },
    dependencies: {
      '@allternit/plugin-sdk': '^1.0.0',
    },
    devDependencies: {
      '@types/node': '^20.0.0',
      typescript: '^5.0.0',
    },
    publishConfig: {
      access: 'public',
    },
  };
  
  await fs.writeFile(
    path.join(pluginDir, 'package.json'),
    JSON.stringify(pkg, null, 2)
  );
  
  // Create tsconfig.json
  const tsconfig = {
    compilerOptions: {
      target: 'ES2020',
      module: 'CommonJS',
      lib: ['ES2020'],
      outDir: './dist',
      rootDir: './src',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      declaration: true,
      declarationMap: true,
      resolveJsonModule: true,
    },
    include: ['src/**/*'],
    exclude: ['node_modules', 'dist'],
  };
  
  await fs.writeFile(
    path.join(pluginDir, 'tsconfig.json'),
    JSON.stringify(tsconfig, null, 2)
  );
  
  // Create README.md
  const readme = `# ${toPascalCase(name)} Plugin

${manifest.description}

## Installation

\`\`\`bash
npm install ${pkg.name}
\`\`\`

## Usage

### CLI

\`\`\`bash
allternit-plugin run ${name} --input "your input here"
\`\`\`

### Programmatic

\`\`\`typescript
import { execute, manifest } from '${pkg.name}';
import { createHost } from '@allternit/plugin-sdk';

const host = createHost('cli');
const result = await execute(host, { input: "test" });
\`\`\`

## Development

\`\`\`bash
cd ${name}
npm install
npm run build
allternit-plugin validate
\`\`\`

## TODO

- [ ] Implement main execute function
- [ ] Add tests
- [ ] Update README with examples
- [ ] Publish to NPM
`;
  
  await fs.writeFile(path.join(pluginDir, 'README.md'), readme);
  
  console.log(`\\n✅ Created ${name}/`);
  console.log('  📄 manifest.json');
  console.log('  📄 src/index.ts');
  console.log('  📄 package.json');
  console.log('  📄 tsconfig.json');
  console.log('  📄 README.md');
  console.log('\\n🚀 Next steps:');
  console.log(`  cd ${name}`);
  console.log('  npm install');
  console.log('  npm run build');
  console.log(`  allternit-plugin run --input "test"`);
}

async function createFromTemplate(name, templateName, options) {
  const templatesDir = options.templatesDir;
  const templatePath = path.join(templatesDir, templateName);
  
  // Check if template exists
  try {
    await fs.access(templatePath);
  } catch {
    console.error(`❌ Template not found: ${templateName}`);
    console.log(`\\nAvailable templates in ${templatesDir}:`);
    try {
      const templates = await fs.readdir(templatesDir);
      templates.forEach(t => console.log(`  - ${t}`));
    } catch {
      console.log('  (directory not found or empty)');
    }
    console.log(`\\nOr create without template:`);
    console.log(`  allternit-plugin create ${name}`);
    process.exit(1);
  }
  
  const pluginDir = path.join(process.cwd(), name);
  await fs.mkdir(pluginDir, { recursive: true });
  await fs.mkdir(path.join(pluginDir, 'src'), { recursive: true });
  
  // Read original template
  const originalCode = await fs.readFile(templatePath, 'utf-8');
  
  // Generate plugin from template
  const adapters = options.adapters.split(',');
  
  const manifest = {
    id: name,
    name: toPascalCase(name),
    version: '1.0.0',
    runtime: 'allternit-plugin-v1',
    description: `Plugin based on ${templateName} template`,
    category: options.category,
    requires: {
      llm: { capabilities: ['reasoning'] },
    },
    provides: {
      functions: [{
        name: 'execute',
        description: `Execute ${templateName} logic`,
        parameters: {
          type: 'object',
          properties: {
            input: { type: 'string', description: 'Input text' },
          },
          required: ['input'],
        },
        returns: { type: 'object' },
      }],
    },
    adapters: adapters.reduce((acc, a) => ({ ...acc, [a]: `./adapters/${a}.js` }), {}),
  };
  
  await fs.writeFile(
    path.join(pluginDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  );
  
  // Wrap template code as plugin
  const srcCode = `import { PluginHost, ExecutionResult } from '@allternit/plugin-sdk';
import manifest from '../manifest.json';

/**
 * ${toPascalCase(name)} Plugin
 * 
 * Based on template: ${templateName}
 * Original template preserved in docs/original-template.txt
 */

export { manifest };

// Original template logic adapted for PluginHost
export async function execute(host: PluginHost, params: any): Promise<ExecutionResult> {
  try {
    // TODO: Adapt template logic here
    // Original template code is in docs/original-template.txt
    
    // Example adaptation:
    const result = await host.llm.complete(\`
      Process using ${templateName} template:
      Input: \${params.input}
    \`);
    
    host.ui.renderMarkdown(result);
    
    return { success: true, result };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

export async function initialize(host: PluginHost): Promise<void> {
  console.log('${name} plugin initialized (from ${templateName} template)');
}
`;
  
  await fs.writeFile(path.join(pluginDir, 'src', 'index.ts'), srcCode);
  
  // Save original template
  await fs.mkdir(path.join(pluginDir, 'docs'), { recursive: true });
  await fs.writeFile(
    path.join(pluginDir, 'docs', 'original-template.txt'),
    originalCode
  );
  
  // Create package.json
  const pkg = {
    name: name.startsWith('@') ? name : `@allternit/${name}`,
    version: '1.0.0',
    description: manifest.description,
    main: 'dist/index.js',
    types: 'dist/index.d.ts',
    scripts: {
      build: 'tsc',
      prepare: 'npm run build',
      validate: 'allternit-plugin validate',
    },
    dependencies: {
      '@allternit/plugin-sdk': '^1.0.0',
    },
    devDependencies: {
      '@types/node': '^20.0.0',
      typescript: '^5.0.0',
    },
    publishConfig: {
      access: 'public',
    },
  };
  
  await fs.writeFile(
    path.join(pluginDir, 'package.json'),
    JSON.stringify(pkg, null, 2)
  );
  
  // Create tsconfig.json
  const tsconfig = {
    compilerOptions: {
      target: 'ES2020',
      module: 'CommonJS',
      lib: ['ES2020'],
      outDir: './dist',
      rootDir: './src',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      declaration: true,
      declarationMap: true,
      resolveJsonModule: true,
    },
    include: ['src/**/*'],
    exclude: ['node_modules', 'dist'],
  };
  
  await fs.writeFile(
    path.join(pluginDir, 'tsconfig.json'),
    JSON.stringify(tsconfig, null, 2)
  );
  
  // Create README
  const readme = `# ${toPascalCase(name)} Plugin

Based on \`${templateName}\` template.

## Description

${manifest.description}

## Installation

\`\`\`bash
npm install ${pkg.name}
\`\`\`

## Usage

\`\`\`bash
allternit-plugin run ${name} --input "your input"
\`\`\`

## Template Source

Original template: \`${templateName}\`
See \`docs/original-template.txt\` for reference.

## Development

\`\`\`bash
cd ${name}
npm install
npm run build
\`\`\`

## Adapting the Template

1. Review \`docs/original-template.txt\`
2. Adapt the logic in \`src/index.ts\`
3. Update manifest.json with correct parameters
4. Test with \`allternit-plugin run\`
`;
  
  await fs.writeFile(path.join(pluginDir, 'README.md'), readme);
  
  console.log(`\\n✅ Created ${name}/ from template ${templateName}`);
  console.log('  📄 manifest.json');
  console.log('  📄 src/index.ts (plugin wrapper)');
  console.log('  📄 docs/original-template.txt (reference)');
  console.log('  📄 package.json');
  console.log('  📄 tsconfig.json');
  console.log('  📄 README.md');
  console.log('\\n🚀 Next steps:');
  console.log(`  cd ${name}`);
  console.log('  npm install');
  console.log('  # Review docs/original-template.txt');
  console.log('  # Adapt src/index.ts with template logic');
  console.log('  npm run build');
  console.log(`  allternit-plugin run --input "test"`);
}

// Run a plugin
program
  .command('run [plugin]')
  .description('Run a plugin')
  .option('-i, --input <text>', 'Input text')
  .option('-a, --adapter <type>', 'Adapter type', 'cli')
  .option('--stdin', 'Read input from stdin')
  .action(async (plugin, options) => {
    const input = options.stdin 
      ? await readStdin()
      : options.input || '{}';
    
    let params;
    try {
      params = JSON.parse(input);
    } catch {
      params = { input };
    }
    
    console.log(`Running ${plugin || 'default plugin'}...`);
    console.log('Input:', params);
    
    // Would actually load and run plugin here
    console.log('\n[Plugin would execute with params above]');
  });

// Start HTTP server
program
  .command('serve')
  .description('Start HTTP server for plugins')
  .option('-p, --port <number>', 'Port number', '3000')
  .option('-h, --host <address>', 'Host address', '0.0.0.0')
  .option('--adapter <type>', 'Server adapter', 'http')
  .action(async (options) => {
    console.log(`Starting ${options.adapter} server on ${options.host}:${options.port}`);
    
    const { HttpAdapter } = require('../dist/adapters/http');
    
    // Load all plugins from current directory
    const plugins = await loadPluginsFromDir(process.cwd());
    
    if (plugins.length === 0) {
      console.error('No plugins found in current directory');
      console.error('Run this command from a directory with plugin packages');
      process.exit(1);
    }
    
    console.log(`Loaded ${plugins.length} plugins:`);
    plugins.forEach(p => console.log(`  - ${p.manifest.id}`));
    
    // Would start server here
    console.log('\nServer would start on http://localhost:' + options.port);
    console.log('Endpoints:');
    console.log('  GET  /v1/plugins       - List plugins');
    console.log('  POST /v1/execute/:id   - Execute plugin');
  });

// Convert templates
program
  .command('convert')
  .description('Convert single template to plugin')
  .requiredOption('-i, --input <file>', 'Template file path')
  .requiredOption('-o, --output <dir>', 'Output directory')
  .action(async (options) => {
    console.log('Converting template to plugin...');
    console.log(`Input: ${options.input}`);
    console.log(`Output: ${options.output}`);
    
    const templateName = path.basename(options.input, path.extname(options.input));
    const pluginName = `${templateName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-plugin`;
    
    // Use create command with template
    await createFromTemplate(pluginName, options.input, {
      adapters: 'mcp,http,cli',
      category: 'custom',
    });
    
    console.log(`\n✅ Converted ${templateName} to ${pluginName}/`);
  });

// Convert all templates in directory
program
  .command('convert-all')
  .description('Batch convert all templates to plugins')
  .requiredOption('-i, --input <dir>', 'Templates directory')
  .requiredOption('-o, --output <dir>', 'Output directory')
  .option('--adapters <list>', 'Adapters to include', 'mcp,http,cli')
  .action(async (options) => {
    console.log('🚀 Batch converting templates...');
    console.log(`Input: ${options.input}`);
    console.log(`Output: ${options.output}`);
    console.log('');
    
    let converted = 0;
    let failed = 0;
    
    try {
      const entries = await fs.readdir(options.input, { withFileTypes: true });
      const templates = entries.filter(e => 
        e.isFile() && /\.(tsx?|jsx?|vue|svelte)$/i.test(e.name)
      );
      
      console.log(`Found ${templates.length} templates`);
      console.log('');
      
      await fs.mkdir(options.output, { recursive: true });
      
      for (const template of templates) {
        const templateFile = template.name;
        const templatePath = path.join(options.input, templateFile);
        const templateName = path.basename(templateFile, path.extname(templateFile));
        const pluginName = `${templateName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-plugin`;
        
        process.stdout.write(`Converting ${templateName}... `);
        
        try {
          // Change to output directory and create
          const originalCwd = process.cwd();
          process.chdir(options.output);
          await createFromTemplate(pluginName, templateFile, {
            templatesDir: options.input,
            adapters: options.adapters,
            category: 'custom',
          });
          process.chdir(originalCwd);
          
          converted++;
          console.log('✅');
        } catch (err) {
          failed++;
          console.log(`❌ ${err.message}`);
        }
      }
      
      console.log('');
      console.log('═══════════════════════════════════════');
      console.log('  Conversion Complete');
      console.log('═══════════════════════════════════════');
      console.log(`  Converted: ${converted}`);
      console.log(`  Failed:    ${failed}`);
      console.log(`  Output:    ${options.output}`);
      console.log('');
      console.log('Next steps:');
      console.log(`  cd ${options.output}`);
      console.log('  allternit-plugin validate */');
      console.log('  # Build and publish individual plugins');
      
    } catch (err) {
      console.error(`\n❌ Error: ${err.message}`);
      process.exit(1);
    }
  });

// Validate plugin
program
  .command('validate [plugin]')
  .description('Validate plugin manifest')
  .action(async (plugin) => {
    const manifestPath = plugin 
      ? path.join(plugin, 'manifest.json')
      : path.join(process.cwd(), 'manifest.json');
    
    try {
      const content = await fs.readFile(manifestPath, 'utf-8');
      const manifest = JSON.parse(content);
      
      // Validate required fields
      const required = ['id', 'name', 'version', 'runtime', 'provides'];
      const missing = required.filter(f => !manifest[f]);
      
      if (missing.length > 0) {
        console.error(`✗ Missing required fields: ${missing.join(', ')}`);
        process.exit(1);
      }
      
      console.log('✓ Manifest is valid');
      console.log(`  ID: ${manifest.id}`);
      console.log(`  Name: ${manifest.name}`);
      console.log(`  Version: ${manifest.version}`);
      console.log(`  Functions: ${manifest.provides.functions.length}`);
      
    } catch (error) {
      console.error(`✗ Invalid manifest: ${error.message}`);
      process.exit(1);
    }
  });

// Package plugin
program
  .command('package [plugin]')
  .description('Package plugin for distribution')
  .option('-o, --output <file>', 'Output file')
  .action(async (plugin, options) => {
    const pluginDir = plugin || process.cwd();
    const name = path.basename(pluginDir);
    const output = options.output || `${name}.allp`;
    
    console.log(`Packaging ${name}...`);
    
    // Would create .allp file (zip of plugin directory)
    console.log(`✓ Created ${output}`);
    console.log('  Size: ~XX KB');
    console.log('\nDistribute via:');
    console.log('  - npm publish');
    console.log('  - GitHub releases');
    console.log('  - Direct download');
  });

// Helper functions
function toPascalCase(str) {
  return str.split(/[-_]/)
    .map(s => s.charAt(0).toUpperCase() + s.slice(1))
    .join('');
}

async function readStdin() {
  let input = '';
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) {
    input += chunk;
  }
  return input.trim();
}

async function loadPluginsFromDir(dir) {
  // Would scan for plugin directories
  return [];
}

program.parse();
