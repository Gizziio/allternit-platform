import assert from 'node:assert/strict';
import test from 'node:test';
import { Command } from 'commander';
import { createCloudCommand } from './cloud.js';
import { createFabricCommand } from './fabric.js';

function buildProgram(commands: Command[]): Command {
  const program = new Command();
  program
    .exitOverride()
    .option('--api-url <url>', 'Allternit API base URL', 'https://api.example')
    .option('--token <token>', 'Clerk bearer token')
    .option('--json', 'emit machine-readable JSON');
  function enableExitOverride(command: Command): void {
    command.exitOverride();
    for (const sub of command.commands) enableExitOverride(sub);
  }
  for (const cmd of commands) {
    enableExitOverride(cmd);
    program.addCommand(cmd);
  }
  return program;
}

async function withMockedFetch(
  respond: (request: Request) => Response,
  fn: () => Promise<void>,
): Promise<Request[]> {
  const originalFetch = globalThis.fetch;
  const seen: Request[] = [];
  globalThis.fetch = (async (input, init) => {
    const request = new Request(input, init);
    seen.push(request);
    return respond(request);
  }) as typeof globalThis.fetch;
  try {
    await fn();
  } finally {
    globalThis.fetch = originalFetch;
  }
  return seen;
}

test('cloud resources create sends POST with class and display name', async () => {
  const seen = await withMockedFetch(
    () => new Response(JSON.stringify({ resource_id: 'r-1' }), { status: 200, headers: { 'content-type': 'application/json' } }),
    async () => {
      await buildProgram([createCloudCommand()]).parseAsync([
        'node', 'allternit', 'cloud', 'resources', 'create',
        '--class', 'gpu.m',
        '--display-name', 'training-worker',
      ]);
    },
  );
  assert.equal(seen.length, 1);
  assert.equal(seen[0]?.method, 'POST');
  assert.equal(seen[0]?.url, 'https://api.example/api/v1/fabric/resources');
  assert.deepEqual(await seen[0]?.json(), { class: 'gpu.m', display_name: 'training-worker' });
});

test('cloud resources terminate sends POST to terminate endpoint', async () => {
  const seen = await withMockedFetch(
    () => new Response(JSON.stringify({ id: 'r-1', status: 'terminated' }), { status: 200, headers: { 'content-type': 'application/json' } }),
    async () => {
      await buildProgram([createCloudCommand()]).parseAsync([
        'node', 'allternit', 'cloud', 'resources', 'terminate', 'r-1',
      ]);
    },
  );
  assert.equal(seen.length, 1);
  assert.equal(seen[0]?.method, 'POST');
  assert.equal(seen[0]?.url, 'https://api.example/api/v1/fabric/resources/r-1/terminate');
});

test('cloud credits buy sends POST purchase with amount and method', async () => {
  const seen = await withMockedFetch(
    () => new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'content-type': 'application/json' } }),
    async () => {
      await buildProgram([createCloudCommand()]).parseAsync([
        'node', 'allternit', 'cloud', 'credits', 'buy',
        '--amount', '5000',
        '--method', 'stripe',
      ]);
    },
  );
  assert.equal(seen.length, 1);
  assert.equal(seen[0]?.method, 'POST');
  assert.equal(seen[0]?.url, 'https://api.example/api/v1/credits/purchase');
  const body = await seen[0]?.json();
  assert.equal(body.amount_cents, 5000);
  assert.equal(body.method, 'stripe');
  assert.equal(typeof body.idempotency_key, 'string');
});

test('cloud credits balance sends GET', async () => {
  const seen = await withMockedFetch(
    () => new Response(JSON.stringify({ balance_cents: 1000 }), { status: 200, headers: { 'content-type': 'application/json' } }),
    async () => {
      await buildProgram([createCloudCommand()]).parseAsync([
        'node', 'allternit', 'cloud', 'credits', 'balance',
      ]);
    },
  );
  assert.equal(seen.length, 1);
  assert.equal(seen[0]?.method, 'GET');
  assert.equal(seen[0]?.url, 'https://api.example/api/v1/credits/balance');
});

test('fabric node enroll sends POST with enrollment token auth', async () => {
  const seen = await withMockedFetch(
    () => new Response(JSON.stringify({ node_id: 'n-1', node_token: 'ntok' }), { status: 200, headers: { 'content-type': 'application/json' } }),
    async () => {
      await buildProgram([createFabricCommand()]).parseAsync([
        'node', 'allternit', 'fabric', 'node', 'enroll',
        '--enrollment-token', 'enroll-token',
        '--org', 'org-1',
        '--display-name', 'desktop-rig',
        '--region', 'us-east',
        '--vcpu', '8',
        '--memory-mib', '32768',
      ]);
    },
  );
  assert.equal(seen.length, 1);
  assert.equal(seen[0]?.method, 'POST');
  assert.equal(seen[0]?.url, 'https://api.example/v1/fabric/nodes/enroll');
  assert.equal(seen[0]?.headers.get('authorization'), 'Bearer enroll-token');
  const body = await seen[0]?.json();
  assert.equal(body.organization_id, 'org-1');
  assert.equal(body.display_name, 'desktop-rig');
  assert.equal(body.region, 'us-east');
  assert.equal(body.capacity.total_vcpu, 8);
  assert.equal(body.capacity.total_memory_mib, 32768);
  assert.equal(body.capacity.free_vcpu, 8);
  assert.equal(body.capacity.free_memory_mib, 32768);
});

test('cloud resources create rejects without --class', async () => {
  await assert.rejects(() =>
    buildProgram([createCloudCommand()]).parseAsync([
      'node', 'allternit', 'cloud', 'resources', 'create',
    ]),
  );
});

test('fabric node enroll rejects without --enrollment-token', async () => {
  await assert.rejects(() =>
    buildProgram([createFabricCommand()]).parseAsync([
      'node', 'allternit', 'fabric', 'node', 'enroll',
      '--org', 'org-1',
      '--display-name', 'rig',
    ]),
  );
});
