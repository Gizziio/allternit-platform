/**
 * Tool-schema ↔ route-parameter mapping tests.
 *
 * Every tool in `COMPUTER_TOOL_SPECS` is executed through `executeToolCall`
 * against a mocked `fetch`; the recorded HTTP call (method, path, query,
 * body) is asserted against the REST route the tool claims to wrap. This is
 * the contract that keeps the MCP surface 1:1 with
 * `cmd/allternit-api/src/computer_routes.rs`.
 */

import { describe, it, expect, afterEach } from 'vitest';

import { ComputersApiClient } from '../src/client.js';
import { executeToolCall } from '../src/server.js';
import { COMPUTER_TOOL_SPECS } from '../src/tool-spec.js';
import { jsonResponse, mockFetch, binaryResponse, type RecordedCall } from './mock-fetch.js';

const BASE = 'http://gw:8013';

function specFor(name: string) {
  const spec = COMPUTER_TOOL_SPECS.find((s) => s.name === name);
  if (!spec) throw new Error(`spec missing for ${name}`);
  return spec;
}

function textOf(result: { content: Array<{ type: string; text?: string }>; isError?: boolean }) {
  return result.content[0]?.text ?? '';
}

describe('tool dispatch → REST mapping', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function setup(handler: (call: RecordedCall) => Response = () => jsonResponse({ ok: true })) {
    const calls = mockFetch(handler);
    const client = new ComputersApiClient({ baseUrl: BASE, token: 'tok' });
    return { calls, client };
  }

  function pathOf(call: RecordedCall): string {
    return new URL(call.url).pathname;
  }
  function queryOf(call: RecordedCall): URLSearchParams {
    return new URL(call.url).searchParams;
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  it('computers.create → POST /computers with the full hardware body', async () => {
    const { calls, client } = setup();
    const result = await executeToolCall(client, 'computers.create', {
      kind: 'local',
      owner_type: 'user',
      name: 'demo',
      cpu_cores: 4,
      memory_mb: 8192,
      disk_mb: 40960,
      resolution: '1920x1080',
    });
    expect(result.isError).toBeUndefined();
    expect(calls[0]?.method).toBe('POST');
    expect(pathOf(calls[0]!)).toBe('/api/v1/computers');
    // approvalId is MCP-only and must not leak into the JSON body
    expect(JSON.parse(calls[0]!.body!)).toEqual({
      kind: 'local',
      owner_type: 'user',
      name: 'demo',
      cpu_cores: 4,
      memory_mb: 8192,
      disk_mb: 40960,
      resolution: '1920x1080',
    });
  });

  it('computers.list → GET /computers with filters, omitting empty ones', async () => {
    const { calls, client } = setup(() => jsonResponse({ computers: [] }));
    await executeToolCall(client, 'computers.list', { kind: 'local', bot_id: 'bot-9' });
    expect(calls[0]?.method).toBe('GET');
    expect(pathOf(calls[0]!)).toBe('/api/v1/computers');
    const q = queryOf(calls[0]!);
    expect(q.get('kind')).toBe('local');
    expect(q.get('bot_id')).toBe('bot-9');
    expect(q.get('group_id')).toBeNull();
  });

  it('computers.get → GET /computers/:id (id URL-encoded)', async () => {
    const { calls, client } = setup();
    await executeToolCall(client, 'computers.get', { computer_id: 'c 1/2' });
    expect(calls[0]?.method).toBe('GET');
    expect(pathOf(calls[0]!)).toBe('/api/v1/computers/c%201%2F2');
  });

  it.each(['start', 'stop', 'restart'] as const)('computers.%s → POST /computers/:id/%s', async (verb) => {
    const { calls, client } = setup();
    await executeToolCall(client, `computers.${verb}`, { computer_id: 'c-1', approvalId: 'gr-1' });
    expect(calls[0]?.method).toBe('POST');
    expect(pathOf(calls[0]!)).toBe(`/api/v1/computers/c-1/${verb}`);
    expect(queryOf(calls[0]!).get('approval_id')).toBe('gr-1');
  });

  it('computers.resize → PATCH /computers/:id/resize without computer_id in body', async () => {
    const { calls, client } = setup();
    await executeToolCall(client, 'computers.resize', { computer_id: 'c-1', memory_mb: 16384 });
    expect(calls[0]?.method).toBe('PATCH');
    expect(pathOf(calls[0]!)).toBe('/api/v1/computers/c-1/resize');
    expect(JSON.parse(calls[0]!.body!)).toEqual({ memory_mb: 16384 });
  });

  it('computers.clone → POST /computers/:id/clone with optional name', async () => {
    const { calls, client } = setup();
    await executeToolCall(client, 'computers.clone', { computer_id: 'c-1', name: 'copy-1' });
    expect(pathOf(calls[0]!)).toBe('/api/v1/computers/c-1/clone');
    expect(JSON.parse(calls[0]!.body!)).toEqual({ name: 'copy-1' });
  });

  it('computers.clone omits the name key when not given', async () => {
    const { calls, client } = setup();
    await executeToolCall(client, 'computers.clone', { computer_id: 'c-1' });
    expect(JSON.parse(calls[0]!.body!)).toEqual({});
  });

  it('computers.delete → POST /computers/:id/delete', async () => {
    const { calls, client } = setup(() => new Response(null, { status: 204 }));
    const result = await executeToolCall(client, 'computers.delete', { computer_id: 'c-1' });
    expect(calls[0]?.method).toBe('POST');
    expect(pathOf(calls[0]!)).toBe('/api/v1/computers/c-1/delete');
    expect(JSON.parse(textOf(result))).toEqual({ success: true, note: expect.any(String) });
  });

  // ── Control ────────────────────────────────────────────────────────────────

  it('computers.screenshot → GET screenshot, PNG base64 in result JSON', async () => {
    const { calls, client } = setup(() => binaryResponse(new Uint8Array([137, 80, 78, 71]), 'image/png'));
    const result = await executeToolCall(client, 'computers.screenshot', { computer_id: 'c-1' });
    expect(calls[0]?.method).toBe('GET');
    expect(pathOf(calls[0]!)).toBe('/api/v1/computers/c-1/screenshot');
    const payload = JSON.parse(textOf(result));
    expect(payload.content_type).toBe('image/png');
    expect(payload.base64).toBe(Buffer.from([137, 80, 78, 71]).toString('base64'));
  });

  it('computers.mouse → POST /computers/:id/mouse with action body', async () => {
    const { calls, client } = setup();
    await executeToolCall(client, 'computers.mouse', { computer_id: 'c-1', action: 'click', x: 10, y: 20 });
    expect(pathOf(calls[0]!)).toBe('/api/v1/computers/c-1/mouse');
    expect(JSON.parse(calls[0]!.body!)).toEqual({ action: 'click', x: 10, y: 20 });
  });

  it('computers.keyboard → POST /computers/:id/keyboard', async () => {
    const { calls, client } = setup();
    await executeToolCall(client, 'computers.keyboard', { computer_id: 'c-1', action: 'key', key: 'Return' });
    expect(JSON.parse(calls[0]!.body!)).toEqual({ action: 'key', key: 'Return' });
  });

  it('computers.shell → POST /computers/:id/shell', async () => {
    const { calls, client } = setup(() => jsonResponse({ stdout: 'hi', exit_code: 0 }));
    const result = await executeToolCall(client, 'computers.shell', {
      computer_id: 'c-1',
      command: ['echo', 'hi'],
      timeout: 30,
    });
    expect(pathOf(calls[0]!)).toBe('/api/v1/computers/c-1/shell');
    expect(JSON.parse(calls[0]!.body!)).toEqual({ command: ['echo', 'hi'], timeout: 30 });
    expect(JSON.parse(textOf(result)).stdout).toBe('hi');
  });

  it('computers.files.upload → POST files/upload?path=…, base64-decoded octet-stream', async () => {
    const { calls, client } = setup(() => jsonResponse({ path: '/tmp/x' }));
    await executeToolCall(client, 'computers.files.upload', {
      computer_id: 'c-1',
      path: '/tmp/a file',
      content: Buffer.from('hello').toString('base64'),
    });
    expect(pathOf(calls[0]!)).toBe('/api/v1/computers/c-1/files/upload');
    expect(queryOf(calls[0]!).get('path')).toBe('/tmp/a file');
    expect(calls[0]?.headers['content-type']).toBe('application/octet-stream');
    expect(calls[0]?.body).toBe('hello');
  });

  it('computers.files.download → GET files/download?path=…, base64 in result', async () => {
    const { calls, client } = setup(() => binaryResponse(new Uint8Array([104, 105]), 'application/octet-stream'));
    const result = await executeToolCall(client, 'computers.files.download', {
      computer_id: 'c-1',
      path: '/tmp/x',
    });
    expect(calls[0]?.method).toBe('GET');
    expect(queryOf(calls[0]!).get('path')).toBe('/tmp/x');
    expect(JSON.parse(textOf(result)).base64).toBe(Buffer.from('hi').toString('base64'));
  });

  // ── Snapshots ──────────────────────────────────────────────────────────────

  it('computers.snapshots.list → GET /computers/:id/snapshots', async () => {
    const { calls, client } = setup(() => jsonResponse({ snapshots: [] }));
    await executeToolCall(client, 'computers.snapshots.list', { computer_id: 'c-1' });
    expect(calls[0]?.method).toBe('GET');
    expect(pathOf(calls[0]!)).toBe('/api/v1/computers/c-1/snapshots');
  });

  it('computers.snapshots.create → POST /computers/:id/snapshots with stateful flag', async () => {
    const { calls, client } = setup();
    await executeToolCall(client, 'computers.snapshots.create', { computer_id: 'c-1', stateful: true });
    expect(calls[0]?.method).toBe('POST');
    expect(JSON.parse(calls[0]!.body!)).toEqual({ stateful: true });
  });

  it('computers.snapshots.restore → POST …/snapshots/:sid/restore', async () => {
    const { calls, client } = setup();
    await executeToolCall(client, 'computers.snapshots.restore', { computer_id: 'c-1', snapshot_id: 's 1' });
    expect(pathOf(calls[0]!)).toBe('/api/v1/computers/c-1/snapshots/s%201/restore');
  });

  it('computers.snapshots.delete → DELETE …/snapshots/:sid', async () => {
    const { calls, client } = setup();
    await executeToolCall(client, 'computers.snapshots.delete', { computer_id: 'c-1', snapshot_id: 's-1' });
    expect(calls[0]?.method).toBe('DELETE');
    expect(pathOf(calls[0]!)).toBe('/api/v1/computers/c-1/snapshots/s-1');
  });

  // ── Templates (Phase 4) ────────────────────────────────────────────────────

  it('templates.list → GET /desktop-templates with filters', async () => {
    const { calls, client } = setup(() => jsonResponse({ templates: [] }));
    await executeToolCall(client, 'templates.list', { os: 'linux' });
    expect(pathOf(calls[0]!)).toBe('/api/v1/desktop-templates');
    expect(queryOf(calls[0]!).get('os')).toBe('linux');
    expect(queryOf(calls[0]!).get('tag')).toBeNull();
  });

  it('templates.import → POST /desktop-templates/import as YAML body', async () => {
    const { calls, client } = setup();
    await executeToolCall(client, 'templates.import', { doc: 'apiVersion: allternit.ai/v1' });
    expect(pathOf(calls[0]!)).toBe('/api/v1/desktop-templates/import');
    expect(calls[0]?.headers['content-type']).toBe('application/yaml');
    expect(calls[0]?.body).toBe('apiVersion: allternit.ai/v1');
  });

  it('templates.build → POST /desktop-templates/:id/build with approval', async () => {
    const { calls, client } = setup();
    await executeToolCall(client, 'templates.build', { template_id: 'dtpl-1', approvalId: 'gr-9' });
    expect(pathOf(calls[0]!)).toBe('/api/v1/desktop-templates/dtpl-1/build');
    expect(queryOf(calls[0]!).get('approval_id')).toBe('gr-9');
  });

  // ── Schema contract ─────────────────────────────────────────────────────────

  it('every dispatch-required arg appears in the tool inputSchema', () => {
    for (const spec of COMPUTER_TOOL_SPECS) {
      expect(spec.inputSchema.type).toBe('object');
      const required = (spec.inputSchema.required as string[] | undefined) ?? [];
      const props = Object.keys((spec.inputSchema.properties as Record<string, unknown>) ?? {});
      for (const key of required) {
        expect(props, `${spec.name} required '${key}' missing from properties`).toContain(key);
      }
    }
  });

  it('tools flagged acceptsApproval expose an optional approvalId string', () => {
    for (const spec of COMPUTER_TOOL_SPECS) {
      const approval = (spec.inputSchema.properties as Record<string, unknown> | undefined)?.approvalId;
      if (spec.acceptsApproval) {
        expect(approval, `${spec.name} must expose approvalId`).toBeDefined();
      } else {
        expect(approval, `${spec.name} must not expose approvalId`).toBeUndefined();
      }
    }
  });

  it('missing required arg surfaces a schema-shaped error, not a crash', async () => {
    const { calls, client } = setup();
    const result = await executeToolCall(client, 'computers.get', {});
    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/computer_id/);
    expect(calls).toHaveLength(0);
  });

  it('unknown tool name returns an error result', async () => {
    const { client } = setup();
    const result = await executeToolCall(client, 'computers.nope', {});
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('Unknown tool');
  });

  it('API denials surface the server payload verbatim (approval-gated control stays gated)', async () => {
    const { client } = setup(() => jsonResponse({ error: 'confirmation_required', action_hash: 'h' }, 428));
    const result = await executeToolCall(client, 'computers.shell', {
      computer_id: 'c-1',
      command: ['rm', '-rf', '/'],
    });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toBe(JSON.stringify({ error: 'confirmation_required', action_hash: 'h' }));
  });

  it('every spec tool is dispatchable end-to-end', async () => {
    const { calls, client } = setup(() => jsonResponse({ ok: true }));
    const bodies: Record<string, Record<string, unknown>> = {
      'computers.create': { kind: 'local' },
      'computers.list': {},
      'computers.get': { computer_id: 'c-1' },
      'computers.start': { computer_id: 'c-1' },
      'computers.stop': { computer_id: 'c-1' },
      'computers.restart': { computer_id: 'c-1' },
      'computers.resize': { computer_id: 'c-1', cpu_cores: 2 },
      'computers.clone': { computer_id: 'c-1' },
      'computers.delete': { computer_id: 'c-1' },
      'computers.screenshot': { computer_id: 'c-1' },
      'computers.mouse': { computer_id: 'c-1', action: 'move', x: 1, y: 1 },
      'computers.keyboard': { computer_id: 'c-1', action: 'type', text: 'a' },
      'computers.shell': { computer_id: 'c-1', command: ['true'] },
      'computers.files.upload': { computer_id: 'c-1', path: '/tmp/x', content: 'aGk=' },
      'computers.files.download': { computer_id: 'c-1', path: '/tmp/x' },
      'computers.snapshots.list': { computer_id: 'c-1' },
      'computers.snapshots.create': { computer_id: 'c-1' },
      'computers.snapshots.restore': { computer_id: 'c-1', snapshot_id: 's-1' },
      'computers.snapshots.delete': { computer_id: 'c-1', snapshot_id: 's-1' },
      'templates.list': {},
      'templates.import': { doc: '{}' },
      'templates.build': { template_id: 'dtpl-1' },
    };
    for (const spec of COMPUTER_TOOL_SPECS) {
      const result = await executeToolCall(client, spec.name, bodies[spec.name] ?? {});
      expect(result.isError, `${spec.name} failed: ${textOf(result)}`).toBeUndefined();
    }
    expect(calls).toHaveLength(COMPUTER_TOOL_SPECS.length);
  });
});
