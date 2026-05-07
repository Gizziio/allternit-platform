import { describe, it, expect, beforeEach } from 'vitest';
import { AllternitAgent } from '../agents/controller.js';
import { AllternitHarness } from '../harness/index.js';
import { AgentRun } from '../agents/run.js';
import { NativeToolBelt } from '../tools/search.js';

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
  });
});
