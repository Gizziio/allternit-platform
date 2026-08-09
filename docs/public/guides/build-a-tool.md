# Build a Tool

This guide walks through registering a custom tool in the Allternit Tool Belt, testing it, and optionally exposing it through an MCP server.

## 1. Define the tool contract

A tool needs a name, description, JSON Schema input, and an `execute` function. The schema should be strict enough that a model can reliably generate valid arguments.

Here is the JSON descriptor for a simple weather tool:

```json
{
  "name": "weather",
  "description": "Get the current weather for a city",
  "input_schema": {
    "type": "object",
    "properties": {
      "city": { "type": "string", "description": "City name" },
      "units": { "type": "string", "enum": ["metric", "imperial"], "description": "Temperature units" }
    },
    "required": ["city"]
  }
}
```

```typescript
import type { ToolDefinition } from '@allternit/sdk/ai-runtime/tools';

const weatherTool: ToolDefinition = {
  name: 'weather',
  description: 'Get the current weather for a city',
  input_schema: {
    type: 'object',
    properties: {
      city: { type: 'string', description: 'City name' },
      units: { type: 'string', enum: ['metric', 'imperial'], description: 'Temperature units' }
    },
    required: ['city']
  },
  execute: async (args: { city: string; units?: string }) => {
    const { city, units = 'metric' } = args;
    // Replace with a real weather API call
    return { city, temperature: 22, units, condition: 'sunny' };
  }
};
```

## 2. Register the tool

Add the tool to a `ToolRegistry`. Use a namespace if you expect naming collisions with other tools or MCP servers.

```typescript
import { ToolRegistry } from '@allternit/sdk/ai-runtime/tools';

const registry = new ToolRegistry();
registry.registerTool(weatherTool, { namespace: 'demo', strict: true });

console.log(registry.getTool('demo.weather'));
```

Namespaces follow the pattern `^[A-Za-z][A-Za-z0-9_-]*$`. The qualified name becomes `demo.weather`.

## 3. Validate arguments

Before executing, validate inputs against the schema. Strict registration already closed the schema, so unknown keys are rejected.

```typescript
const valid = registry.validateInput('demo.weather', { city: 'Austin', units: 'imperial' });
console.log(valid.valid); // => true

const invalid = registry.validateInput('demo.weather', { city: 'Austin', timezone: 'CDT' });
console.log(invalid.errors); // => ["$.timezone is not allowed"]
```

## 4. Use the tool in a run

Tools are normally executed by the harness, but you can call one directly for testing:

```typescript
const tool = registry.getTool('demo.weather')!;
const result = await tool.execute!(
  { city: 'Austin', units: 'imperial' },
  { callId: 'weather-1' }
);
console.log(result);
// => { city: 'Austin', temperature: 22, units: 'imperial', condition: 'sunny' }
```

## 5. Combine with the native belt

Register custom tools before or after creating the `NativeToolBelt`. Native tools are active by default; custom tools can be active or deferred.

```typescript
import { NativeToolBelt } from '@allternit/sdk/ai-runtime/tools/search';

const registry = new ToolRegistry();
registry.registerTool(weatherTool, { namespace: 'demo', strict: true });

new NativeToolBelt(registry, {
  apiKeys: { tavily: process.env.TAVILY_API_KEY },
});

const active = registry.getActiveTools().map(t => t.name);
console.log(active);
// => ['demo.weather', 'tool_search', 'tool_activate', 'web_search', ...]
```

## 6. Register a deferred tool

Deferred tools are known to the registry but not injected into the active schemas until the model calls `tool_activate`. This is useful for rare or heavy tools.

```typescript
registry.registerDeferredTool({
  id: 'db-tool',
  name: 'query_db',
  description: 'Run a read-only SQL query',
  input_schema: {
    type: 'object',
    properties: { query: { type: 'string' } },
    required: ['query']
  },
  tags: ['database', 'sql']
});

// The model discovers it through tool_search and activates it through tool_activate
const matches = await registry.getTool('tool_search')!.execute!({ query: 'sql' }, {});
// => [{ id: 'db-tool', name: 'query_db', description: 'Run a read-only SQL query' }]

registry.activateTool('db-tool');
console.log(registry.getActiveTools().map(t => t.name));
// => [..., 'query_db']
```

## 7. Snapshot and rehydrate

Tool registry state can be persisted across turns or sessions:

```typescript
const snapshot = registry.snapshot();
// => { activeToolNames, discoveredToolIds, sessionPolicies, deferredDefinitions }

const restored = new ToolRegistry();
restored.rehydrate(snapshot);
console.log(restored.getActiveTools().map(t => t.name));
```

## 8. Expose over MCP (optional)

To make the same tool available to external MCP clients, attach it to the Rust API's internal MCP route or wrap it in a small MCP server using `attachMcpServer`:

```typescript
const belt = new NativeToolBelt(registry);
await belt.attachMcpServer({
  serverId: 'demo',
  listTools: async () => [
    {
      name: 'weather',
      description: weatherTool.description,
      inputSchema: weatherTool.input_schema
    }
  ],
  callTool: async (name, args) => {
    if (name !== 'weather') throw new Error('Unknown tool');
    return weatherTool.execute!(args, { callId: 'mcp-weather' });
  }
});
```

The tool is now callable as `demo.weather` from any model or MCP client that attaches the server.
