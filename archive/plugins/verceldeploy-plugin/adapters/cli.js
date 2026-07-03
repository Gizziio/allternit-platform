#!/usr/bin/env node

const { execute } = require('../dist/index');

async function main() {
  const args = process.argv.slice(2);

  const pathIndex = args.indexOf('--path');
  const prod = args.includes('--prod');
  const projectNameIndex = args.indexOf('--projectName');

  const params = {
    path: pathIndex !== -1 ? args[pathIndex + 1] : undefined,
    prod,
    projectName: projectNameIndex !== -1 ? args[projectNameIndex + 1] : undefined
  };

  if (!params.path) {
    console.error('Usage: verceldeploy-plugin --path <path> [--prod] [--projectName <name>]');
    process.exit(1);
  }

  const host = {
    platform: 'cli',
    version: '1.0.0',
    llm: {},
    tools: {},
    ui: {},
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
    console.log(result.content || JSON.stringify(result.data, null, 2));
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
