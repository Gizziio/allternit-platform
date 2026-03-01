#!/usr/bin/env node

const parityRoutes = [
  'chat',
  'overview',
  'channels',
  'instances',
  'sessions',
  'cron',
  'skills',
  'nodes',
  'config',
  'debug',
  'logs',
];

const parityRpcMethods = [
  'chat.history',
  'chat.send',
  'chat.abort',
  'chat.inject',
  'channels.status',
  'sessions.list',
  'sessions.patch',
  'cron.list',
  'cron.add',
  'cron.run',
  'skills.install',
  'node.list',
  'config.get',
  'config.set',
  'config.apply',
  'config.schema',
  'logs.tail',
  'update.run',
];

function getArg(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function normalizeBaseUrl(raw) {
  return raw.replace(/\/+$/, '');
}

async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      cache: 'no-store',
    });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchText(url, timeoutMs) {
  const response = await fetchWithTimeout(url, timeoutMs);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  return response.text();
}

function printHeader(title) {
  console.log(`\n=== ${title} ===`);
}

async function main() {
  const timeoutMs = Number(getArg('--timeout-ms') || process.env.OPENCLAW_SMOKE_TIMEOUT_MS || 5000);
  const configuredPort = process.env.OPENCLAW_PORT || '18789';
  const baseUrl = normalizeBaseUrl(
    getArg('--base-url') || process.env.OPENCLAW_BASE_URL || `http://127.0.0.1:${configuredPort}`,
  );

  printHeader('OpenClaw parity smoke');
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Timeout : ${timeoutMs}ms`);

  printHeader('Health');
  const healthResponse = await fetchWithTimeout(`${baseUrl}/health`, timeoutMs);
  if (!healthResponse.ok) {
    throw new Error(`Gateway health check failed with HTTP ${healthResponse.status}`);
  }
  const healthBody = await healthResponse.text();
  console.log(`Health OK: ${healthBody.slice(0, 200)}`);

  printHeader('Bundle discovery');
  const html = await fetchText(`${baseUrl}/`, timeoutMs);
  const scriptMatches = [...html.matchAll(/<script[^>]+src=\"([^\"]+)\"/g)];
  if (scriptMatches.length === 0) {
    throw new Error('No script tags found in control-ui HTML');
  }

  const scriptUrls = scriptMatches.map((match) => new URL(match[1], `${baseUrl}/`).toString());
  const bundleUrl = scriptUrls.find((url) => /index-.*\.js($|\?)/.test(url)) || scriptUrls[0];
  console.log(`Bundle URL: ${bundleUrl}`);

  printHeader('Parity tokens');
  const bundle = await fetchText(bundleUrl, timeoutMs);

  const missingRoutes = parityRoutes.filter((token) => !bundle.includes(token));
  const missingRpcMethods = parityRpcMethods.filter((token) => !bundle.includes(token));

  if (missingRoutes.length > 0) {
    console.error(`Missing route tokens: ${missingRoutes.join(', ')}`);
  } else {
    console.log(`Routes present: ${parityRoutes.join(', ')}`);
  }

  if (missingRpcMethods.length > 0) {
    console.error(`Missing RPC tokens: ${missingRpcMethods.join(', ')}`);
  } else {
    console.log(`RPC methods present: ${parityRpcMethods.length} checks passed`);
  }

  if (missingRoutes.length > 0 || missingRpcMethods.length > 0) {
    process.exitCode = 1;
    return;
  }

  printHeader('Result');
  console.log('Parity smoke passed.');
}

main().catch((error) => {
  console.error('\nSmoke failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
