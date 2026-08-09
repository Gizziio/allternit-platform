# Native Tool Belt

The Allternit SDK ships a **Native Tool Belt** — a model-facing collection of general-purpose tools that an agent can call without any external MCP server. The belt is initialized by `NativeToolBelt` and registers tools into a `ToolRegistry` so they can be discovered, activated, namespaced, and validated alongside custom or MCP-provided tools.

```typescript
import { ToolRegistry } from '@allternit/sdk/ai-runtime/tools';
import { NativeToolBelt } from '@allternit/sdk/ai-runtime/tools/search';

const registry = new ToolRegistry();
new NativeToolBelt(registry, {
  provider: 'tavily',
  apiKeys: { tavily: process.env.TAVILY_API_KEY },
  workspaceRoot: process.cwd(),
});

const schemas = registry.getActiveTools().map(t => t.name);
console.log(schemas);
// => ['tool_search', 'tool_activate', 'web_search', 'web_fetch',
//     'str_replace_editor', 'bash', 'code_execution', 'memory']
```

## Tool registry primitives

Every tool is registered with a name, description, JSON Schema input contract, optional lifecycle hooks, and metadata. `NativeToolBelt` also installs two registry primitives:

| Tool | Purpose |
|------|---------|
| `tool_search` | Search deferred tools that are known but not yet active in the session. |
| `tool_activate` | Move a deferred tool discovered by `tool_search` into the active set. |

Deferred tools keep the context window small. A custom tool can be registered as deferred and activated on demand; the native tools are active by default.

## Web tools

### `web_search`

Search the web using a configurable adapter. Results are cached per query and clamped to a maximum of 10 entries.

**Supported providers**

| Provider | API key env var | Fallback resolution |
|----------|----------------|---------------------|
| `tavily` | `TAVILY_API_KEY` | `https://api.tavily.com/search` |
| `perplexity` | `PERPLEXITY_API_KEY` | `https://api.perplexity.ai/chat/completions` |
| `bing` | `BING_SEARCH_API_KEY` | `https://api.bing.microsoft.com/v7.0/search` |
| `duckduckgo` | none | `https://html.duckduckgo.com/html/` |

The provider is selected from the `provider` option, then from any configured API key, then DuckDuckGo HTML.

```json
{
  "name": "web_search",
  "description": "Search the web using cached, indexed, or live results.",
  "input_schema": {
    "type": "object",
    "properties": {
      "query": { "type": "string", "description": "Search query" },
      "mode": { "type": "string", "enum": ["cached", "indexed", "live"], "description": "Search source" },
      "limit": { "type": "integer", "description": "Maximum results (1-10)" }
    },
    "required": ["query"]
  }
}
```

```typescript
const results = await registry.getTool('web_search')!.execute!(
  { query: 'Allternit Tool Belt', mode: 'live', limit: 5 },
  { callId: 'search-1' }
);
// => [{ title, url, snippet }, ...]
```

### `web_fetch`

Fetch a URL and return readable text. HTML responses have scripts, styles, and markup stripped; JSON and plain text are returned as-is. Output is truncated at 50,000 characters by default.

```json
{
  "name": "web_fetch",
  "description": "Fetch an HTTP(S) URL and extract readable text content.",
  "input_schema": {
    "type": "object",
    "properties": {
      "url": { "type": "string", "description": "HTTP(S) URL to fetch" }
    },
    "required": ["url"]
  }
}
```

```typescript
const page = await registry.getTool('web_fetch')!.execute!(
  { url: 'https://example.com' },
  { callId: 'fetch-1' }
);
// => { url, contentType, title?, text, truncated }
```

## Workspace tool

### `str_replace_editor` (`text_editor_20250124`)

An Anthropic-compatible text editor that operates inside a single workspace root. All paths are resolved relative to the workspace and constrained to stay within it.

```json
{
  "name": "str_replace_editor",
  "description": "View and edit text files within the active workspace.",
  "input_schema": {
    "type": "object",
    "properties": {
      "command": { "type": "string", "enum": ["view", "str_replace", "create", "insert", "undo", "undo_edit"] },
      "path": { "type": "string", "description": "Absolute or workspace-relative file path" },
      "file_text": { "type": "string", "description": "Contents for create" },
      "old_str": { "type": "string", "description": "Unique text to replace" },
      "new_str": { "type": "string", "description": "Replacement text" },
      "insert_line": { "type": "integer", "description": "Zero-based line after which to insert" },
      "view_range": { "type": "array", "items": { "type": "integer" }, "description": "One-based inclusive [start, end] line range" }
    },
    "required": ["command", "path"]
  }
}
```

```typescript
const editor = registry.getTool('str_replace_editor')!;
await editor.execute!({ command: 'create', path: 'hello.txt', file_text: 'alpha\nbeta\n' }, {});
await editor.execute!({ command: 'str_replace', path: 'hello.txt', old_str: 'beta', new_str: 'gamma' }, {});
await editor.execute!({ command: 'undo', path: 'hello.txt' }, {});
```

## System tools

### `bash`

Execute a shell command with optional timeout and restart control. By default commands run through `sh -c` with a 30-second timeout.

```json
{
  "name": "bash",
  "description": "Execute a shell command with optional timeout and restart control.",
  "input_schema": {
    "type": "object",
    "properties": {
      "command": { "type": "string", "description": "The shell command to execute" },
      "timeout": { "type": "integer", "description": "Timeout in seconds (default: 30)" },
      "restart": { "type": "boolean", "description": "Whether to restart a fresh shell environment" }
    },
    "required": ["command"]
  }
}
```

```typescript
const result = await registry.getTool('bash')!.execute!(
  { command: 'git status --short', timeout: 10 },
  { callId: 'bash-1' }
);
// => { stdout, stderr, exit_code, success }
```

### `code_execution`

Run code in a sandboxed environment. The default runner resolves the interpreter locally and prepends a dependency installer when requested.

```json
{
  "name": "code_execution",
  "description": "Execute code in a sandboxed environment. Supports python, node, bash, and rust.",
  "input_schema": {
    "type": "object",
    "properties": {
      "language": { "type": "string", "enum": ["python", "python3", "node", "javascript", "bash", "sh", "rust"], "description": "Programming language to execute" },
      "code": { "type": "string", "description": "Source code to run" },
      "timeout_seconds": { "type": "integer", "description": "Timeout in seconds (default: 30)" },
      "dependencies": { "type": "array", "items": { "type": "string" }, "description": "Optional package or dependency names to install before running" }
    },
    "required": ["language", "code"]
  }
}
```

```typescript
const result = await registry.getTool('code_execution')!.execute!(
  { language: 'python', code: 'print(21 + 21)', timeout_seconds: 10, dependencies: [] },
  { callId: 'code-1' }
);
// => { stdout: '42', stderr: '', exit_code: 0, success: true, artifacts: [] }
```

### `memory`

Session-scoped key/value store. The default store is in-memory; production deployments typically inject a persistent store.

```json
{
  "name": "memory",
  "description": "Read, write, or delete session-scoped memory values by key.",
  "input_schema": {
    "type": "object",
    "properties": {
      "operation": { "type": "string", "enum": ["read", "write", "delete"], "description": "Memory operation" },
      "key": { "type": "string", "description": "Memory key" },
      "value": { "description": "Value to write (required for write)" }
    },
    "required": ["operation", "key"]
  }
}
```

```typescript
await registry.getTool('memory')!.execute!({ operation: 'write', key: 'mode', value: 'fast' }, {});
const entry = await registry.getTool('memory')!.execute!({ operation: 'read', key: 'mode' }, {});
// => { key: 'mode', value: 'fast', updated_at: '2026-08-09T09:36:29.855Z' }
```

## Computer use

The `ComputerUseCapability` exposes a `computer` tool that follows the Anthropic `computer_20250124` schema. It forwards actions to the Allternit Computer Use gateway (`ALLTERNIT_COMPUTER_USE_URL`, default `http://127.0.0.1:8760`).

```json
{
  "name": "computer",
  "description": "Control the mouse and keyboard, and capture screenshots to interact with the computer.",
  "input_schema": {
    "type": "object",
    "properties": {
      "action": {
        "type": "string",
        "enum": ["key", "type", "mouse_move", "left_click", "left_click_drag", "right_click", "middle_click", "double_click", "triple_click", "left_mouse_down", "left_mouse_up", "screenshot", "cursor_position", "scroll", "hold_key", "wait"],
        "description": "The computer action to perform"
      },
      "text": { "type": "string", "description": "Text to type for the type and key actions" },
      "coordinate": { "type": "array", "items": { "type": "number" }, "minItems": 2, "maxItems": 2, "description": "The absolute [x, y] pixel coordinates for mouse actions" },
      "scroll_direction": { "type": "string", "enum": ["up", "down", "left", "right"], "description": "Direction for scroll" },
      "scroll_amount": { "type": "integer", "description": "Number of scroll ticks" },
      "duration": { "type": "number", "description": "Duration in seconds for hold_key and wait" }
    },
    "required": ["action"]
  }
}
```

```typescript
import { ComputerUseCapability } from '@allternit/sdk/ai-runtime/capabilities/computer-use';

const computer = new ComputerUseCapability({
  displayWidthPx: 1280,
  displayHeightPx: 720,
});

const tool = computer.getTool();
const screenshot = await tool.execute!({ action: 'screenshot' }, {});
// => [{ type: 'image', source: { type: 'base64', media_type: 'image/png', data: '...' } }]
```

## Customizing execution backends

`NativeToolBelt` accepts injectable backends so the same tool contract works in tests, local CLI, and remote sandbox deployments:

| Option | Type | Used by |
|--------|------|---------|
| `runner.run` | `BashRunner` | `bash` |
| `runner.execute` | `CodeExecutionRunner` | `code_execution` |
| `store` | `MemoryStore` | `memory` |
| `fetch` | `typeof fetch` | `web_search`, `web_fetch` |
| `workspaceRoot` | `string` | `str_replace_editor` |

All native tools are registered with `strict: true`, so provider-side validation rejects arguments outside the declared schema.
