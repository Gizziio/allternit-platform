#!/usr/bin/env node

const { execute } = require('../dist/index');

async function main() {
  const args = process.argv.slice(2);

  const promptIndex = args.indexOf('--prompt');
  const actionIndex = args.indexOf('--action');
  const durationIndex = args.indexOf('--durationInFrames');
  const widthIndex = args.indexOf('--width');
  const heightIndex = args.indexOf('--height');
  const fpsIndex = args.indexOf('--fps');

  const params = {
    prompt: promptIndex !== -1 ? args[promptIndex + 1] : undefined,
    action: actionIndex !== -1 ? args[actionIndex + 1] : 'generate',
    durationInFrames: durationIndex !== -1 ? parseInt(args[durationIndex + 1], 10) : undefined,
    width: widthIndex !== -1 ? parseInt(args[widthIndex + 1], 10) : undefined,
    height: heightIndex !== -1 ? parseInt(args[heightIndex + 1], 10) : undefined,
    fps: fpsIndex !== -1 ? parseInt(args[fpsIndex + 1], 10) : undefined
  };

  if (!params.prompt) {
    console.error('Usage: remotioncard-plugin --prompt <prompt> [--action <generate|preview|render>] [--durationInFrames <n>] [--width <n>] [--height <n>] [--fps <n>]');
    process.exit(1);
  }

  const host = {
    platform: 'cli',
    version: '1.0.0',
    llm: {
      complete: async (prompt) => {
        console.log('[LLM PROMPT]', prompt.slice(0, 200) + '...');
        return `// Dummy Remotion component for: ${params.prompt}\nexport default function Video() { return null; }`;
      }
    },
    tools: {},
    ui: {
      renderMarkdown: (md) => console.log('[UI]', md)
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
