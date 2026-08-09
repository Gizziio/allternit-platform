import assert from 'node:assert/strict';
import test from 'node:test';
import { Command } from 'commander';
import { createAdminCommand } from './admin.js';

function buildProgram(): Command {
  const program = new Command();
  program
    .exitOverride()
    .option('--api-url <url>', 'Allternit API base URL', 'https://api.example')
    .option('--token <token>', 'Clerk bearer token')
    .option('--json', 'emit machine-readable JSON');
  // Commander exitOverride is per-command; propagate it to subcommands so
  // validation errors (e.g. missing required options) reject in tests.
  function enableExitOverride(command: Command): void {
    command.exitOverride();
    for (const sub of command.commands) enableExitOverride(sub);
  }
  const adminCommand = createAdminCommand();
  enableExitOverride(adminCommand);
  program.addCommand(adminCommand);
  return program;
}

async function withMockedFetch(
  respond: (request: Request) => Response,
  fn: () => Promise<void>,
): Promise<Request[]> {
  const originalFetch = globalThis.fetch;
  const seen: Request[] = [];
  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    seen.push(request);
    return respond(request);
  };
  try {
    await fn();
  } finally {
    globalThis.fetch = originalFetch;
  }
  return seen;
}

test('admin mcp-tunnels list sends GET /api/v1/mcp-tunnels', async () => {
  const seen = await withMockedFetch(
    () => new Response(JSON.stringify({ tunnels: [] }), { status: 200, headers: { 'content-type': 'application/json' } }),
    async () => {
      await buildProgram().parseAsync(['node', 'allternit', 'admin', 'mcp-tunnels', 'list']);
    },
  );
  assert.equal(seen.length, 1);
  assert.equal(seen[0]?.method, 'GET');
  assert.equal(seen[0]?.url, 'https://api.example/api/v1/mcp-tunnels');
});

test('admin mcp-tunnels create sends POST with name body', async () => {
  const seen = await withMockedFetch(
    () => new Response(JSON.stringify({ id: 'tun_1' }), { status: 200, headers: { 'content-type': 'application/json' } }),
    async () => {
      await buildProgram().parseAsync(['node', 'allternit', 'admin', 'mcp-tunnels', 'create', '--name', 'my-tunnel']);
    },
  );
  assert.equal(seen.length, 1);
  assert.equal(seen[0]?.method, 'POST');
  assert.equal(seen[0]?.url, 'https://api.example/api/v1/mcp-tunnels');
  assert.deepEqual(await seen[0]?.json(), { name: 'my-tunnel' });
});

test('admin mcp-tunnels rotate sends POST to /:id/rotate', async () => {
  const seen = await withMockedFetch(
    () => new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } }),
    async () => {
      await buildProgram().parseAsync(['node', 'allternit', 'admin', 'mcp-tunnels', 'rotate', '--id', 'tun_1']);
    },
  );
  assert.equal(seen.length, 1);
  assert.equal(seen[0]?.method, 'POST');
  assert.equal(seen[0]?.url, 'https://api.example/api/v1/mcp-tunnels/tun_1/rotate');
  assert.equal(seen[0]?.body, null);
});

test('admin mcp-tunnels delete sends DELETE to /:id', async () => {
  const seen = await withMockedFetch(
    () => new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } }),
    async () => {
      await buildProgram().parseAsync(['node', 'allternit', 'admin', 'mcp-tunnels', 'delete', '--id', 'tun_1']);
    },
  );
  assert.equal(seen.length, 1);
  assert.equal(seen[0]?.method, 'DELETE');
  assert.equal(seen[0]?.url, 'https://api.example/api/v1/mcp-tunnels/tun_1');
});

test('admin mcp-tunnels create with missing --name rejects', async () => {
  await assert.rejects(() =>
    buildProgram().parseAsync(['node', 'allternit', 'admin', 'mcp-tunnels', 'create']),
  );
});
