import { describe, it, expect, beforeEach } from 'vitest';
import { AllternitAgent } from '../agents/controller.js';
import { AllternitHarness } from '../harness/index.js';
import { AgentRun } from '../agents/run.js';
import { NativeToolBelt } from '../tools/search.js';
import { ToolRegistry } from '../tools/registry.js';
import { toStrictJsonSchema } from '../tools/schema.js';
import { ComputerUseCapability } from '../capabilities/computer-use.js';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('Native Agent Tool Belt', () => {
  let harness: AllternitHarness;
  let agent: AllternitAgent;

  beforeEach(() => {
    harness = new AllternitHarness({ mode: 'local', local: { baseURL: 'http://localhost:11434' } });
    agent = new AllternitAgent(harness, { persistencePath: ':memory:' });
  });

  function createRun(messages: any[] = [], tools?: any[]): AgentRun {
    const run = new AgentRun('test-run', agent, {
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      messages,
      ...(tools ? { tools } : {})
    });
    // Fork the global registry like AllternitAgent.run() does
    run.runState.toolRegistry = (agent as any).globalToolRegistry.fork();
    run.runState.toolBelt = new NativeToolBelt(run.runState.toolRegistry);
    return run;
  }

  it('should support deferred tool registration and discovery', async () => {
    agent.registerDeferredTool({
      id: 'browser-tool',
      name: 'browse',
      description: 'Web browsing capability',
      input_schema: { type: 'object', properties: {} },
      tags: ['web', 'automation']
    });

    const run = createRun();

    // Discover via tool_search
    const searchTool = run.runState.toolRegistry.getActiveTools().find(t => t.name === 'tool_search');
    expect(searchTool).toBeDefined();

    const results = await searchTool!.execute!({ query: 'web' }, { callId: '1' });
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('browser-tool');
  });

  it('should support tool activation mid-run', async () => {
    agent.registerDeferredTool({
      id: 'git-tool',
      name: 'git_commit',
      description: 'Commit changes',
      input_schema: { type: 'object', properties: {} }
    });

    const run = createRun();

    // Initially not in active tools
    expect(run.runState.getActiveToolSchemas().find(t => t.name === 'git_commit')).toBeUndefined();

    // Activate
    const activateTool = run.runState.toolRegistry.getActiveTools().find(t => t.name === 'tool_activate');
    await activateTool!.execute!({ toolId: 'git-tool' }, { callId: '2' });

    // Now it should be active
    expect(run.runState.getActiveToolSchemas().find(t => t.name === 'git_commit')).toBeDefined();
  });

  it('should support session snapshot and rehydration', async () => {
    agent.registerDeferredTool({
      id: 'db-tool',
      name: 'query_db',
      description: 'SQL query',
      input_schema: { type: 'object', properties: {} }
    });

    const run1 = createRun();

    // Activate a tool in run 1
    await run1.runState.toolRegistry.activateTool('db-tool');
    const snapshot = run1.runState.toolRegistry.snapshot();

    // Rehydrate in run 2
    const run2 = createRun();
    run2.hydrate('thinking', [], snapshot);

    expect(run2.runState.getActiveToolSchemas().find(t => t.name === 'query_db')).toBeDefined();
  });

  it('should use active tool schemas from registry for provider injection', async () => {
    const run = createRun([], [{ name: 'existing_tool', description: 'desc', input_schema: { type: 'object', properties: {} } }]);

    const schemas = run.runState.getActiveToolSchemas();
    // Should include tool_search and tool_activate by default
    expect(schemas.map(s => s.name)).toContain('tool_search');
    expect(schemas.map(s => s.name)).toContain('tool_activate');
    expect(schemas.map(s => s.name)).toContain('web_search');
    expect(schemas.map(s => s.name)).toContain('web_fetch');
    expect(schemas.map(s => s.name)).toContain('str_replace_editor');
  });

  it('supports cached, indexed, and live web search modes', async () => {
    const registry = new ToolRegistry();
    const cache = new Map([['cached query', [{ title: 'Cached', url: 'https://cached.test', snippet: 'hit' }]]]);
    const belt = new NativeToolBelt(registry, {
      cache,
      searchIndex: async query => [{ title: 'Index', url: 'https://index.test', snippet: query }],
      liveSearch: async query => [{ title: 'Live', url: 'https://live.test', snippet: query }],
    });
    const search = belt.getRegistry().getTool('web_search')!;

    expect((await search.execute!({ query: 'cached query', mode: 'cached' }, {}))[0].title).toBe('Cached');
    expect((await search.execute!({ query: 'index query', mode: 'indexed' }, {}))[0].title).toBe('Index');
    expect((await search.execute!({ query: 'live query', mode: 'live' }, {}))[0].title).toBe('Live');
    expect((await search.execute!({ query: 'live query', mode: 'cached' }, {}))[0].title).toBe('Live');
  });

  it('fetches URLs and extracts readable HTML content', async () => {
    const registry = new ToolRegistry();
    new NativeToolBelt(registry, {
      fetch: async () => new Response(
        '<html><head><title>Example &amp; Test</title><style>hidden</style></head><body><h1>Hello</h1><script>bad()</script><p>World</p></body></html>',
        { status: 200, headers: { 'content-type': 'text/html' } },
      ),
    });

    const result = await registry.getTool('web_fetch')!.execute!({ url: 'https://example.test/page' }, {});
    expect(result.title).toBe('Example & Test');
    expect(result.text).toContain('Hello World');
    expect(result.text).not.toContain('bad()');
  });

  it.each([
    {
      provider: 'tavily' as const,
      apiKeys: { tavily: 'tavily-key' },
      response: { results: [{ title: 'Tavily', url: 'https://tavily.test', content: 'result' }] },
      assertRequest: (url: string, init?: RequestInit) => {
        expect(url).toBe('https://api.tavily.com/search');
        expect(JSON.parse(String(init?.body))).toMatchObject({ api_key: 'tavily-key', query: 'tools', max_results: 2 });
      },
    },
    {
      provider: 'perplexity' as const,
      apiKeys: { perplexity: 'perplexity-key' },
      response: { search_results: [{ title: 'Perplexity', url: 'https://perplexity.test', snippet: 'result' }] },
      assertRequest: (url: string, init?: RequestInit) => {
        expect(url).toBe('https://api.perplexity.ai/chat/completions');
        expect((init?.headers as Record<string, string>).authorization).toBe('Bearer perplexity-key');
      },
    },
    {
      provider: 'bing' as const,
      apiKeys: { bing: 'bing-key' },
      response: { webPages: { value: [{ name: 'Bing', url: 'https://bing.test', snippet: 'result' }] } },
      assertRequest: (url: string, init?: RequestInit) => {
        expect(url).toContain('api.bing.microsoft.com/v7.0/search');
        expect((init?.headers as Record<string, string>)['Ocp-Apim-Subscription-Key']).toBe('bing-key');
      },
    },
  ])('uses the $provider search adapter with injected fetch', async ({ provider, apiKeys, response, assertRequest }) => {
    const registry = new ToolRegistry();
    new NativeToolBelt(registry, {
      provider,
      apiKeys,
      fetch: async (input, init) => {
        assertRequest(String(input), init);
        return Response.json(response);
      },
    });

    const results = await registry.getTool('web_search')!.execute!({ query: 'tools', limit: 2 }, {});
    expect(results).toHaveLength(1);
    expect(results[0].snippet).toBe('result');
  });

  it('edits workspace text files and undoes the last edit', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'allternit-editor-'));
    try {
      await writeFile(join(workspaceRoot, 'example.txt'), 'alpha\nbeta\n', 'utf8');
      const registry = new ToolRegistry();
      new NativeToolBelt(registry, { workspaceRoot });
      const editor = registry.getTool('str_replace_editor')!;

      expect(await editor.execute!({ command: 'view', path: 'example.txt', view_range: [2, 2] }, {})).toBe('2: beta');
      await editor.execute!({ command: 'str_replace', path: 'example.txt', old_str: 'beta', new_str: 'gamma' }, {});
      await editor.execute!({ command: 'insert', path: 'example.txt', insert_line: 1, new_str: 'inserted' }, {});
      expect(await readFile(join(workspaceRoot, 'example.txt'), 'utf8')).toBe('alpha\ninserted\ngamma\n');
      await editor.execute!({ command: 'undo', path: 'example.txt' }, {});
      expect(await readFile(join(workspaceRoot, 'example.txt'), 'utf8')).toBe('alpha\ngamma\n');
      await expect(editor.execute!({ command: 'view', path: '../outside.txt' }, {})).rejects.toThrow('within the active workspace');
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it('uses computer_20250124 actions and returns screenshot image blocks', async () => {
    const capability = new ComputerUseCapability({
      fetch: async () => Response.json({ screenshot: 'data:image/png;base64,cG5n' }),
      displayWidthPx: 1280,
      displayHeightPx: 720,
    });
    const tool = capability.getTool();

    expect(tool.metadata).toMatchObject({ anthropicType: 'computer_20250124', display_width_px: 1280, display_height_px: 720 });
    expect(tool.input_schema.properties.action.enum).toContain('scroll');
    expect(await tool.execute!({ action: 'screenshot' }, {})).toEqual([{
      type: 'image',
      source: { type: 'base64', media_type: 'image/png', data: 'cG5n' },
    }]);
  });

  it('namespaces tools and validates strict schemas', () => {
    const registry = new ToolRegistry();
    registry.registerTool({
      name: 'lookup',
      description: 'Lookup a record',
      input_schema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    }, { namespace: 'crm', strict: true });

    expect(registry.getTool('crm.lookup')).toBeDefined();
    expect(registry.validateInput('crm.lookup', { id: '1' }).valid).toBe(true);
    expect(registry.validateInput('crm.lookup', { id: '1', extra: true }).errors).toContain('$.extra is not allowed');
    expect(toStrictJsonSchema({ type: 'object', properties: { nested: { type: 'object', properties: {} } } }).properties!.nested.additionalProperties).toBe(false);
  });

  it('attaches MCP server tools as namespaced model-facing tools', async () => {
    const registry = new ToolRegistry();
    const belt = new NativeToolBelt(registry);
    const calls: unknown[] = [];
    const names = await belt.attachMcpServer({
      serverId: 'docs',
      listTools: async () => [{
        name: 'read',
        description: 'Read a document',
        inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      }],
      callTool: async (name, args) => { calls.push({ name, args }); return { content: 'document' }; },
    });

    expect(names).toEqual(['docs.read']);
    const tool = registry.getTool('docs.read')!;
    expect(tool.input_schema.additionalProperties).toBe(false);
    expect(await tool.execute!({ id: 'abc' }, {})).toEqual({ content: 'document' });
    expect(calls).toEqual([{ name: 'read', args: { id: 'abc' } }]);
  });
});
