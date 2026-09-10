import { describe, it, expect, afterEach } from 'vitest';
import { ComputersClient, ComputersApiError } from '../src/index.js';

interface RecordedCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | null;
}

function mockFetch(handler: (call: RecordedCall) => Response) {
  const calls: RecordedCall[] = [];
  globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : (input as Request).url;
    const headers: Record<string, string> = {};
    new Headers(init?.headers).forEach((value, key) => {
      headers[key] = value;
    });
    const call: RecordedCall = {
      url,
      method: init?.method ?? 'GET',
      headers,
      body: typeof init?.body === 'string' ? init.body : null,
    };
    calls.push(call);
    return handler(call);
  }) as typeof fetch;
  return calls;
}

const jsonResponse = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

describe('ComputersClient', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('threads the bearer token on every request', async () => {
    const calls = mockFetch(() => jsonResponse({ computers: [] }));
    const client = new ComputersClient({ baseUrl: 'http://gw:8013', token: 'tok-1' });
    await client.listComputers();
    expect(calls[0]?.headers['authorization']).toBe('Bearer tok-1');
    expect(calls[0]?.url).toBe('http://gw:8013/api/v1/computers');
  });

  it('defaults baseUrl to http://127.0.0.1:8013', async () => {
    const calls = mockFetch(() => jsonResponse({ computers: [] }));
    const client = new ComputersClient();
    await client.listComputers();
    expect(calls[0]?.url).toBe('http://127.0.0.1:8013/api/v1/computers');
  });

  it('lists computers with query filters', async () => {
    const calls = mockFetch(() => jsonResponse({ computers: [{ id: 'c-1' }] }));
    const client = new ComputersClient({ baseUrl: 'http://gw' });
    const computers = await client.listComputers({
      bot_id: 'bot-9',
      kind: 'cloud_desktop',
      group_id: 'grp-1',
      include_roles: true,
    });
    expect(computers).toEqual([{ id: 'c-1' }]);
    expect(calls[0]?.method).toBe('GET');
    const url = new URL(calls[0]!.url);
    expect(url.searchParams.get('bot_id')).toBe('bot-9');
    expect(url.searchParams.get('kind')).toBe('cloud_desktop');
    expect(url.searchParams.get('group_id')).toBe('grp-1');
    expect(url.searchParams.get('include_roles')).toBe('1');
  });

  it('omits empty query params on list', async () => {
    const calls = mockFetch(() => jsonResponse({ computers: [] }));
    const client = new ComputersClient({ baseUrl: 'http://gw' });
    await client.listComputers();
    expect(calls[0]?.url).toBe('http://gw/api/v1/computers');
  });

  it('creates a computer with a JSON body and approval_id', async () => {
    const calls = mockFetch(() =>
      jsonResponse({ id: 'computer-1', status: 'running', sandbox_id: 'sb-1' }, 201),
    );
    const client = new ComputersClient({ baseUrl: 'http://gw' });
    const created = await client.createComputer(
      { kind: 'cloud_desktop', name: 'dev-box', cpu_cores: 4, memory_mb: 8192 },
      'appr-42',
    );
    expect(created.id).toBe('computer-1');
    expect(calls[0]?.method).toBe('POST');
    expect(calls[0]?.url).toBe('http://gw/api/v1/computers?approval_id=appr-42');
    expect(calls[0]?.headers['content-type']).toBe('application/json');
    expect(JSON.parse(calls[0]!.body!)).toEqual({
      kind: 'cloud_desktop',
      name: 'dev-box',
      cpu_cores: 4,
      memory_mb: 8192,
    });
  });

  it('gets a computer by id with path encoding', async () => {
    const calls = mockFetch(() => jsonResponse({ id: 'a/b' }));
    const client = new ComputersClient({ baseUrl: 'http://gw' });
    await client.getComputer('a/b');
    expect(calls[0]?.url).toBe('http://gw/api/v1/computers/a%2Fb');
  });

  it.each(['start', 'stop', 'restart'] as const)('posts %s with approval_id', async (action) => {
    const calls = mockFetch(() => jsonResponse({ id: 'c-1', status: 'running' }));
    const client = new ComputersClient({ baseUrl: 'http://gw' });
    const method = { start: 'startComputer', stop: 'stopComputer', restart: 'restartComputer' }[
      action
    ] as 'startComputer';
    await client[method]('c-1', 'appr-9');
    expect(calls[0]?.method).toBe('POST');
    expect(calls[0]?.url).toBe(`http://gw/api/v1/computers/c-1/${action}?approval_id=appr-9`);
  });

  it('resizes with PATCH body and approval_id', async () => {
    const calls = mockFetch(() =>
      jsonResponse({ id: 'c-1', status: 'running', cpu_cores: 8, memory_mb: 16384, disk_mb: null }),
    );
    const client = new ComputersClient({ baseUrl: 'http://gw' });
    await client.resizeComputer('c-1', { cpu_cores: 8, memory_mb: 16384 }, 'appr-3');
    expect(calls[0]?.method).toBe('PATCH');
    expect(calls[0]?.url).toBe('http://gw/api/v1/computers/c-1/resize?approval_id=appr-3');
    expect(JSON.parse(calls[0]!.body!)).toEqual({ cpu_cores: 8, memory_mb: 16384 });
  });

  it('clones with optional name and approval_id', async () => {
    const calls = mockFetch(() => jsonResponse({ id: 'computer-2', status: 'running' }));
    const client = new ComputersClient({ baseUrl: 'http://gw' });
    await client.cloneComputer('c-1', 'copy', 'appr-7');
    expect(calls[0]?.url).toBe('http://gw/api/v1/computers/c-1/clone?approval_id=appr-7');
    expect(JSON.parse(calls[0]!.body!)).toEqual({ name: 'copy' });
  });

  it('deletes via POST /delete with approval_id and tolerates 204', async () => {
    const calls = mockFetch(() => new Response(null, { status: 204 }));
    const client = new ComputersClient({ baseUrl: 'http://gw' });
    await expect(client.deleteComputer('c-1', 'appr-5')).resolves.toBeUndefined();
    expect(calls[0]?.method).toBe('POST');
    expect(calls[0]?.url).toBe('http://gw/api/v1/computers/c-1/delete?approval_id=appr-5');
  });

  it('fetches a screenshot as a PNG blob', async () => {
    const calls = mockFetch(() =>
      new Response(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), {
        status: 200,
        headers: { 'Content-Type': 'image/png' },
      }),
    );
    const client = new ComputersClient({ baseUrl: 'http://gw' });
    const blob = await client.screenshot('c-1');
    expect(blob).toBeInstanceOf(Blob);
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(
      new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
    );
    expect(calls[0]?.url).toBe('http://gw/api/v1/computers/c-1/screenshot');
  });

  it('sends mouse input with approval_id', async () => {
    const calls = mockFetch(() => jsonResponse({ success: true }));
    const client = new ComputersClient({ baseUrl: 'http://gw' });
    await client.sendMouse('c-1', { action: 'click', x: 10, y: 20 }, 'appr-1');
    expect(calls[0]?.url).toBe('http://gw/api/v1/computers/c-1/mouse?approval_id=appr-1');
    expect(JSON.parse(calls[0]!.body!)).toEqual({ action: 'click', x: 10, y: 20 });
  });

  it('sends keyboard input without approval_id when omitted', async () => {
    const calls = mockFetch(() => jsonResponse({ success: true }));
    const client = new ComputersClient({ baseUrl: 'http://gw' });
    await client.sendKeyboard('c-1', { action: 'type', text: 'hello' });
    expect(calls[0]?.url).toBe('http://gw/api/v1/computers/c-1/keyboard');
  });

  it('runs a shell command and parses the response', async () => {
    const calls = mockFetch(() =>
      jsonResponse({ exit_code: 0, stdout: 'hi', stderr: '', duration_ms: 42 }),
    );
    const client = new ComputersClient({ baseUrl: 'http://gw' });
    const result = await client.runShell(
      'c-1',
      { command: ['echo', 'hi'], env: { A: '1' }, timeout: 10 },
      'appr-2',
    );
    expect(result.stdout).toBe('hi');
    expect(calls[0]?.url).toBe('http://gw/api/v1/computers/c-1/shell?approval_id=appr-2');
    expect(JSON.parse(calls[0]!.body!)).toEqual({
      command: ['echo', 'hi'],
      env: { A: '1' },
      timeout: 10,
    });
  });

  it('uploads raw bytes with ?path= and octet-stream', async () => {
    const calls = mockFetch(() => jsonResponse({ success: true }));
    const client = new ComputersClient({ baseUrl: 'http://gw' });
    const result = await client.uploadFile(
      'c-1',
      '/tmp/a file.txt',
      new Uint8Array([1, 2, 3]),
      'appr-8',
    );
    expect(result).toEqual({ success: true });
    expect(calls[0]?.method).toBe('POST');
    const url = new URL(calls[0]!.url);
    expect(url.pathname).toBe('/api/v1/computers/c-1/files/upload');
    expect(url.searchParams.get('path')).toBe('/tmp/a file.txt');
    expect(url.searchParams.get('approval_id')).toBe('appr-8');
    expect(calls[0]?.headers['content-type']).toBe('application/octet-stream');
  });

  it('downloads a file with ?path= and returns a blob', async () => {
    const calls = mockFetch(() =>
      new Response(new Uint8Array([9, 9]), { status: 200 }),
    );
    const client = new ComputersClient({ baseUrl: 'http://gw' });
    const blob = await client.downloadFile('c-1', '/tmp/out.bin');
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(new Uint8Array([9, 9]));
    const url = new URL(calls[0]!.url);
    expect(url.pathname).toBe('/api/v1/computers/c-1/files/download');
    expect(url.searchParams.get('path')).toBe('/tmp/out.bin');
    expect(url.search).not.toContain('approval_id');
  });

  it('lists snapshots', async () => {
    const calls = mockFetch(() =>
      jsonResponse({ snapshots: [{ id: 'snap-1', created_at: 'now', stateful: true }] }),
    );
    const client = new ComputersClient({ baseUrl: 'http://gw' });
    const snapshots = await client.listSnapshots('c-1');
    expect(snapshots).toHaveLength(1);
    expect(calls[0]?.url).toBe('http://gw/api/v1/computers/c-1/snapshots');
  });

  it('creates a snapshot with stateful flag', async () => {
    const calls = mockFetch(() =>
      jsonResponse({ success: true, snapshot_id: 'snap-2' }, 201),
    );
    const client = new ComputersClient({ baseUrl: 'http://gw' });
    const result = await client.createSnapshot('c-1', true);
    expect(result.snapshot_id).toBe('snap-2');
    expect(calls[0]?.method).toBe('POST');
    expect(JSON.parse(calls[0]!.body!)).toEqual({ stateful: true });
  });

  it('restores a snapshot', async () => {
    const calls = mockFetch(() => jsonResponse({ success: true, snapshot_id: 'snap-2' }));
    const client = new ComputersClient({ baseUrl: 'http://gw' });
    await client.restoreSnapshot('c-1', 'snap-2');
    expect(calls[0]?.method).toBe('POST');
    expect(calls[0]?.url).toBe('http://gw/api/v1/computers/c-1/snapshots/snap-2/restore');
  });

  it('deletes a snapshot', async () => {
    const calls = mockFetch(() => jsonResponse({ success: true, snapshot_id: 'snap-2' }));
    const client = new ComputersClient({ baseUrl: 'http://gw' });
    await client.deleteSnapshot('c-1', 'snap-2');
    expect(calls[0]?.method).toBe('DELETE');
    expect(calls[0]?.url).toBe('http://gw/api/v1/computers/c-1/snapshots/snap-2');
  });

  it('lists templates with os/tag filters', async () => {
    const calls = mockFetch(() => jsonResponse({ templates: [{ id: 't-1', name: 'base' }] }));
    const client = new ComputersClient({ baseUrl: 'http://gw' });
    const templates = await client.listTemplates({ os: 'linux', tag: 'dev' });
    expect(templates[0]?.id).toBe('t-1');
    const url = new URL(calls[0]!.url);
    expect(url.pathname).toBe('/api/v1/desktop-templates');
    expect(url.searchParams.get('os')).toBe('linux');
    expect(url.searchParams.get('tag')).toBe('dev');
  });

  it('imports a template doc as JSON', async () => {
    const calls = mockFetch(() => jsonResponse({ id: 't-2', name: 'imported' }));
    const client = new ComputersClient({ baseUrl: 'http://gw' });
    const doc = {
      apiVersion: 'allternit.ai/v1' as const,
      kind: 'ComputerTemplate' as const,
      metadata: { name: 'imported' },
      os: { name: 'linux' },
    };
    await client.importTemplate(doc);
    expect(calls[0]?.method).toBe('POST');
    expect(calls[0]?.url).toBe('http://gw/api/v1/desktop-templates/import');
    expect(calls[0]?.headers['content-type']).toBe('application/json');
    expect(JSON.parse(calls[0]!.body!)).toEqual(doc);
  });

  it('imports a raw YAML string verbatim', async () => {
    const calls = mockFetch(() => jsonResponse({ id: 't-3' }));
    const client = new ComputersClient({ baseUrl: 'http://gw' });
    const yaml = 'apiVersion: allternit.ai/v1\nkind: ComputerTemplate\n';
    await client.importTemplate(yaml);
    expect(calls[0]?.body).toBe(yaml);
  });

  it('builds a template with approval_id (ACI-gated)', async () => {
    const calls = mockFetch(() => jsonResponse({ id: 't-1', build_status: 'building' }, 202));
    const client = new ComputersClient({ baseUrl: 'http://gw' });
    const result = await client.buildTemplate('t-1', 'appr-77');
    expect(result.build_status).toBe('building');
    expect(calls[0]?.method).toBe('POST');
    expect(calls[0]?.url).toBe('http://gw/api/v1/desktop-templates/t-1/build?approval_id=appr-77');
  });

  it('hits the Phase 5 status and embed-token routes', async () => {
    const calls = mockFetch(() => jsonResponse({ id: 'c-1', status: 'running' }));
    const client = new ComputersClient({ baseUrl: 'http://gw' });
    await client.getComputerStatus('c-1');
    await client.createEmbedToken('c-1');
    expect(calls[0]?.url).toBe('http://gw/api/v1/computers/c-1/status');
    expect(calls[1]?.method).toBe('POST');
    expect(calls[1]?.url).toBe('http://gw/api/v1/computers/c-1/embed-token');
  });

  it('updates idle_timeout_secs via PATCH /computers/:id', async () => {
    const calls = mockFetch(() => jsonResponse({ id: 'c-1', idle_timeout_secs: 300 }));
    const client = new ComputersClient({ baseUrl: 'http://gw' });
    const updated = await client.updateComputer('c-1', { idle_timeout_secs: 300 });
    expect(updated.idle_timeout_secs).toBe(300);
    expect(calls[0]?.method).toBe('PATCH');
    expect(calls[0]?.url).toBe('http://gw/api/v1/computers/c-1');
    expect(JSON.parse(calls[0]!.body!)).toEqual({ idle_timeout_secs: 300 });
  });

  it('clears the idle timeout with null', async () => {
    const calls = mockFetch(() => jsonResponse({ id: 'c-1', idle_timeout_secs: null }));
    const client = new ComputersClient({ baseUrl: 'http://gw' });
    await client.updateComputer('c-1', { idle_timeout_secs: null });
    expect(JSON.parse(calls[0]!.body!)).toEqual({ idle_timeout_secs: null });
  });

  it('posts session-end with approval_id', async () => {
    const calls = mockFetch(() => jsonResponse({ id: 'c-1', status: 'stopped' }));
    const client = new ComputersClient({ baseUrl: 'http://gw' });
    await client.sessionEnd('c-1', 'appr-4');
    expect(calls[0]?.method).toBe('POST');
    expect(calls[0]?.url).toBe('http://gw/api/v1/computers/c-1/session-end?approval_id=appr-4');
  });

  it('gets a template by id', async () => {
    const calls = mockFetch(() => jsonResponse({ id: 't-1', name: 'base', build_status: 'ready' }));
    const client = new ComputersClient({ baseUrl: 'http://gw' });
    const template = await client.getTemplate('t-1');
    expect(template.build_status).toBe('ready');
    expect(calls[0]?.method).toBe('GET');
    expect(calls[0]?.url).toBe('http://gw/api/v1/desktop-templates/t-1');
  });

  it('gets a template by id with path encoding', async () => {
    const calls = mockFetch(() => jsonResponse({ id: 'a/b' }));
    const client = new ComputersClient({ baseUrl: 'http://gw' });
    await client.getTemplate('a/b');
    expect(calls[0]?.url).toBe('http://gw/api/v1/desktop-templates/a%2Fb');
  });

  it('throws ComputersApiError with status and body on failure', async () => {
    mockFetch(() => jsonResponse({ error: 'computer not found' }, 404));
    const client = new ComputersClient({ baseUrl: 'http://gw' });
    const error = await client.getComputer('missing').catch((e) => e);
    expect(error).toBeInstanceOf(ComputersApiError);
    expect(error.status).toBe(404);
    expect(error.body).toContain('computer not found');
  });
});
