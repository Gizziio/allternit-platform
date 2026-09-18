# Connectors — Allternit Computer Use Plugin

How external surfaces connect to the ACU gateway and consume this plugin's capabilities.

---

## Architecture

```
Claude / LLM
    ↓
Plugin skill/command layer   (this plugin)
    ↓
Adapter layer
  ├── adapters/mcp.js        MCP tool registration
  └── adapters/http.js       REST client for direct platform calls
    ↓
ACU Gateway  (FastAPI, port 8760)
  ├── /v1/computer-use/execute
  ├── /v1/navigate, /v1/click, /v1/type, /v1/scroll, /v1/screenshot, /v1/inspect
  ├── /v1/computer-use/runs/{id}
  ├── /v1/computer-use/sessions
  └── /v1/computer-use/health
    ↓
  Planning Loop + Adapters
  ├── browser.playwright  (Playwright via session_manager)
  ├── browser.dom_mcp     (DOM MCP Adapter)
  ├── desktop.pyautogui   (PyAutoGUI + mss)
  └── desktop.accessibility (NSAccessibility / UIA)
```

---

## MCP Connector (`adapters/mcp.js`)

Registers five MCP tools on any compatible MCP server instance:

| Tool | Description |
|------|-------------|
| `cu_automate` | Full planning loop with vision grounding |
| `cu_screenshot` | Instant screen capture |
| `cu_extract` | Structured data extraction |
| `cu_record` | Start/stop workflow recording |
| `cu_replay` | Replay recording or export GIF |

### Registration

```js
const { register } = require('./adapters/mcp.js');

register(mcpServer, {
  gateway_url:      'http://localhost:8760',
  max_steps:        20,
  approval_policy:  'on-risk',
  record_by_default: true,
});
```

### Claude Desktop / Claude Code (MCP config)

```json
{
  "mcpServers": {
    "allternit-computer-use": {
      "command": "node",
      "args": ["path/to/allternit-computer-use-mcp-server.js"],
      "env": {
        "GATEWAY_URL": "http://localhost:8760"
      }
    }
  }
}
```

---

## HTTP Connector (`adapters/http.js`)

Typed REST client for platform surfaces (Next.js routes, CLI, internal services).

### Setup

```js
const { ComputerUseHttpAdapter } = require('./adapters/http.js');

const acu = new ComputerUseHttpAdapter({
  gateway_url: process.env.ACU_GATEWAY_URL || 'http://localhost:8760',
  timeout_ms: 120_000,
});
```

### Execute a task

```js
const { ok, data, error } = await acu.execute({
  task:            'Find the top 5 trending repos on GitHub',
  scope:           'browser',
  max_steps:       15,
  approval_policy: 'on-risk',
  record_gif:      true,
});

if (ok) {
  console.log('GIF saved:', data.gif_path);
  console.log('Summary:', data.summary);
}
```

### Streaming (SSE)

```js
const stream = await acu.executeStream({ task: '...', scope: 'browser' });
const reader = stream.getReader();
const decoder = new TextDecoder();

while (true) {
  const { value, done } = await reader.read();
  if (done) break;
  const lines = decoder.decode(value).split('\n');
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const event = JSON.parse(line.slice(6));
      console.log(event.event_type, event.data);
    }
  }
}
```

### Approval gate

```js
// Wait for approval.required event in stream, then:
await acu.approveRun(runId, 'approve');
// or deny:
await acu.approveRun(runId, 'deny', 'Too risky');
```

---

## Gateway — Required Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `ALLTERNIT_VISION_PROVIDER` | Vision provider: `mock`, `anthropic`, `openai`, `gemini` | `mock` |
| `ANTHROPIC_API_KEY` | Anthropic API key (if using anthropic provider) | — |
| `OPENAI_API_KEY` | OpenAI API key (if using openai provider) | — |
| `ACU_GATEWAY_PORT` | Gateway listen port | `8760` |
| `ACU_RECORDINGS_DIR` | Where JSONL recordings are stored | `~/.allternit/recordings` |
| `ACU_GIF_OUTPUT_DIR` | Where GIF files are saved | `/tmp/allternit-recordings` |

---

## Gateway — Starting the Engine

```bash
cd domains/computer-use/core/gateway
source .venv/bin/activate

# Minimal dev start (mock vision):
ALLTERNIT_VISION_PROVIDER=mock uvicorn main:app --port 8760 --reload

# With Anthropic vision:
ALLTERNIT_VISION_PROVIDER=anthropic \
ANTHROPIC_API_KEY=sk-ant-... \
uvicorn main:app --port 8760

# Check health:
curl http://localhost:8760/v1/computer-use/health
```

---

## MCP SSE Server (Port 8765)

The ACU engine also runs an MCP SSE server alongside the gateway:

```
GET  http://localhost:8765/sse        — SSE event stream
POST http://localhost:8765/message    — Send MCP messages
```

Add to Claude Code settings:

```json
{
  "mcpServers": {
    "allternit-computer-use": {
      "type": "sse",
      "url": "http://localhost:8765/sse"
    }
  }
}
```

Available MCP tools via SSE server:

| Tool | Description |
|------|-------------|
| `screenshot` | Capture browser or desktop screen |
| `navigate` | Navigate to a URL |
| `click` | Click an element |
| `type` | Type text into a field |
| `scroll` | Scroll the page |
| `key` | Send keyboard shortcut |
| `find_element` | Locate element by selector/accessibility/vision |
| `read_screen` | Read accessibility tree (no vision tokens) |
| `extract` | Extract structured data |
| `execute_task` | Full planning loop via MCP |
| `record_start` | Begin JSONL + GIF recording |
| `record_stop` | Stop recording and get paths |
| `run_code` | Execute Python/JavaScript in sandboxed environment |

---

## GIF Recording

GIF recording is enabled by default for all `execute_task` and `cu_automate` calls.

- **Format:** Animated GIF, palette-quantized (256 colors, MEDIANCUT)
- **Frame rate:** 2 FPS (configurable via `gif_fps` option)
- **Scale:** 50% of original resolution (configurable via `gif_scale` 0.05–1.0)
- **Max frames:** 600 per session (~5 minutes at 2 FPS)
- **Annotation:** Step counter (top-left), elapsed time (top-right), action label (bottom-left)
- **Output path:** Included in the `gif_path` field of the execute response

To disable GIF recording for a specific run:
```js
await acu.execute({ task: '...', record_gif: false });
```

To export a GIF from a stored recording (without re-running):
```js
await acu.executeReplay({ recording_id: 'rec-abc123', export_gif: true });
// or via /cu:replay rec-abc123 --export-gif
```
