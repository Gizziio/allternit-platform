import { describe, it, expect, beforeEach } from 'vitest';
import { AllternitAgent } from '../agents/controller.js';
import { AllternitHarness } from '../harness/index.js';
import { AgentRun } from '../agents/run.js';
import { NativeToolBelt } from '../tools/search.js';
import { ToolRegistry } from '../tools/registry.js';
import { toStrictJsonSchema } from '../tools/schema.js';

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
