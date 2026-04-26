#!/usr/bin/env node

const { execute } = require('../dist/index');

async function main() {
  const args = process.argv.slice(2);

  const pathIndex = args.indexOf('--path');
  const projectTypeIndex = args.indexOf('--projectType');
  const targetIndex = args.indexOf('--target');
  const schemeIndex = args.indexOf('--scheme');
  const simulatorNameIndex = args.indexOf('--simulatorName');
  const configurationIndex = args.indexOf('--configuration');
  const clean = args.includes('--clean');

  const params = {
    path: pathIndex !== -1 ? args[pathIndex + 1] : undefined,
    projectType: projectTypeIndex !== -1 ? args[projectTypeIndex + 1] : 'react-native',
    target: targetIndex !== -1 ? args[targetIndex + 1] : 'simulator',
    scheme: schemeIndex !== -1 ? args[schemeIndex + 1] : undefined,
    simulatorName: simulatorNameIndex !== -1 ? args[simulatorNameIndex + 1] : 'iPhone 15',
    configuration: configurationIndex !== -1 ? args[configurationIndex + 1] : 'Debug',
    clean
  };

  if (!params.path) {
    console.error('Usage: iosappbuild-plugin --path <path> [--projectType <react-native|expo|swift|flutter>] [--target <simulator|device|archive>] [--scheme <scheme>] [--simulatorName <name>] [--configuration <Debug|Release>] [--clean]');
    process.exit(1);
  }

  const host = {
    platform: 'cli',
    version: '1.0.0',
    llm: {},
    tools: {},
    ui: {
      renderMarkdown: (content) => console.log(content)
    },
    storage: {},
    session: {},
    config: {
      get: (key) => process.env[key]
    },
    logger: {
      debug: console.debug,
      info: console.info,
      warn: console.warn,
      error: console.error
    }
  };

  const result = await execute(host, params);

  if (result.success) {
    console.log(JSON.stringify(result.content, null, 2));
    process.exit(0);
  } else {
    console.error(result.error?.message || 'Unknown error');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
