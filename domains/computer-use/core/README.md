# Allternit Computer Use Engine

Autonomous browser and desktop automation with a Plan→Act→Observe→Reflect loop, multi-provider vision grounding, session recording, GIF replay, and human-in-the-loop approval gates.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Quick Start](#quick-start)
4. [Components](#components)
   - [Gateway REST API](#gateway-rest-api-port-8760)
   - [MCP SSE Server](#mcp-sse-server-port-8765)
   - [Planning Loop](#planning-loop)
   - [Vision Providers](#vision-providers)
   - [Adapters](#adapters)
   - [Session Manager](#session-manager)
   - [Action Recorder](#action-recorder)
   - [GIF Recorder](#gif-recorder)
5. [API Reference](#api-reference)
6. [Configuration](#configuration)
7. [Plugin](#plugin)
8. [Data Schemas](#data-schemas)
9. [Development](#development)

---

## Overview

The ACU Engine gives Claude (or any LLM) the ability to control a real browser or desktop application. It runs as two server processes:

- **Gateway** (port 8760) — FastAPI HTTP server. Manages browser sessions, handles direct actions, and runs the autonomous planning loop.
- **MCP Server** (port 8765) — Exposes 12 tools over the Model Context Protocol so Claude Code can call them natively.

On every `execute_task` call the engine runs a loop:

```
screenshot → vision provider analyzes → action planned → adapter executes → screenshot → repeat
```

Every step is recorded to JSONL. Every session produces an annotated GIF.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  Claude / LLM                                                    │
│    ↓ MCP tool calls              ↓ /cu:automate slash command    │
├──────────────────────────────────────────────────────────────────┤
│  MCP SSE Server  :8765           Plugin  allternit-computer-use  │
│  (acu_mcp/server.py)             (packages/computer-use/plugins) │
│    ↓ HTTP POST                       ↓ HTTP adapter              │
├──────────────────────────────────────────────────────────────────┤
│  Gateway REST API  :8760                                         │
│  (gateway/main.py + computer_use_router.py)                      │
│                                                                  │
│  /v1/execute        ← direct browser actions (goto, click, …)   │
│  /v1/computer-use/  ← planning loop, run management, sessions   │
├──────────────────────────────────────────────────────────────────┤
│  Planning Loop  (core/planning_loop.py)                          │
│    ├── VisionProvider (core/vision_providers.py)                 │
│    │     Anthropic · OpenAI · Gemini · UITARS · Mock · +5 more  │
│    ├── Adapter (adapters/)                                       │
│    │     browser.playwright  (via GatewayProxyAdapter)           │
│    │     browser.dom_mcp     (DomMcpAdapter)                     │
│    │     desktop.pyautogui   (PyAutoGUIAdapter)                  │
│    │     desktop.accessibility (AccessibilityAdapter)            │
│    └── ActionRecorder (core/action_recorder.py)                  │
│          ├── JSONL recording  (~/.allternit/recordings/)         │
│          └── GIFRecorder (core/gif_recorder.py)                  │
├──────────────────────────────────────────────────────────────────┤
│  Session Manager  (gateway/session_manager.py)                   │
│    Playwright Chromium · up to 10 sessions · 30-min idle timeout │
└──────────────────────────────────────────────────────────────────┘
```

---

## Quick Start

### Prerequisites

- Python 3.11+
- Node 18+ (for plugin adapters)
- `playwright install chromium`
- GIF support (optional): `pip install Pillow imageio`

### Install

```bash
cd domains/computer-use/core/gateway
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
playwright install chromium
```

### Start the gateway

```bash
# Dev mode — mock vision, no API key needed
ALLTERNIT_VISION_PROVIDER=mock uvicorn main:app --port 8760 --reload

# With Anthropic vision
ALLTERNIT_VISION_PROVIDER=anthropic \
ANTHROPIC_API_KEY=sk-ant-... \
uvicorn main:app --port 8760

# With OpenAI vision
ALLTERNIT_VISION_PROVIDER=openai \
OPENAI_API_KEY=sk-... \
uvicorn main:app --port 8760
```

### Start the MCP server (for Claude Code)

```bash
# SSE mode — add to Claude Code settings as type: sse
ALLTERNIT_VISION_PROVIDER=mock python -m acu_mcp.server sse

# stdio mode — add to Claude Desktop config
ALLTERNIT_VISION_PROVIDER=mock python -m acu_mcp.server stdio
```

### Health check

```bash
curl http://localhost:8760/health
curl http://localhost:8760/v1/computer-use/health
```

### Run a task

```bash
curl -X POST http://localhost:8760/v1/computer-use/execute \
  -H "Content-Type: application/json" \
  -d '{
    "task": "Go to github.com and find the trending repositories",
    "target_scope": "browser",
    "options": { "record_gif": true, "max_steps": 10 }
  }'
```

---

## Components

### Gateway REST API (port 8760)

**Files:** `gateway/main.py` · `gateway/computer_use_router.py`

FastAPI application with two route groups.

---

#### Direct browser actions (`/v1/`)

Hit the Playwright session directly without the planning loop.

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/health` | Gateway health — sessions, version |
| `POST` | `/v1/execute` | Execute a single browser action |
| `POST` | `/v1/finalize` | Build replay artifacts for a completed run |
| `GET`  | `/v1/recordings/{run_id}` | Get recording metadata for a run |

**`POST /v1/execute` — `ExecuteRequest` fields:**

| Field | Type | Notes |
|-------|------|-------|
| `action` | string | `goto` `click` `fill` `extract` `screenshot` `inspect` `close` `scroll` `key` `type` |
| `session_id` | string | Required |
| `run_id` | string | Required |
| `target` | string | URL for `goto`; CSS selector for `click`/`fill` |
| `goal` | string | Required for `execute` action |
| `parameters` | object | Action-specific (see below) |
| `adapter_preference` | string | `playwright` `browser-use` `cdp` `desktop` |

**Per-action `parameters`:**

| Action | Parameters |
|--------|-----------|
| `goto` | `timeout` (ms, default 30000), `wait_until` (`domcontentloaded`\|`load`\|`networkidle`) |
| `screenshot` | `full_page` (bool, default false) |
| `click` | `x`, `y` (coordinate click) OR use `target` as CSS selector. Waits 500ms after. |
| `fill` | `text` (required), `submit` (bool, default false), `timeout` (ms, default 5000) |
| `extract` | `format` (`text`\|`html`\|`json`). `json` returns `{title, url, headings[], links[20]}` |
| `inspect` | `strategy` (`selector`\|`text`\|`accessibility`), `target` (description) |
| `scroll` | `direction` (`down`\|`up`\|`right`\|`left`), `amount` (steps × 100px, default 3) |
| `key` | `keys` — e.g. `"Enter"`, `"Control+a"` |
| `type` | `text` |

**`ExecuteResponse` fields:**

| Field | Type | Notes |
|-------|------|-------|
| `run_id` | string | |
| `session_id` | string | |
| `adapter_id` | string | Which adapter handled it |
| `family` | string | `browser`\|`desktop`\|`retrieval`\|`hybrid` |
| `mode` | string | `execute`\|`inspect`\|`assist` |
| `status` | string | `completed`\|`failed`\|`cancelled` |
| `summary` | string | Human-readable result |
| `extracted_content` | any | Populated by `extract` action |
| `artifacts` | array | Screenshots, downloads, JSON blobs |
| `receipts` | array | Integrity-signed action records |
| `error` | object | `{code, message}` on failure |
| `trace_id` | string | Correlation ID |

---

#### Planning loop surface (`/v1/computer-use/`)

| Method | Path | Description |
|--------|------|-------------|
| `POST`   | `/v1/computer-use/execute`              | Start a planning loop run |
| `GET`    | `/v1/computer-use/runs/{id}`            | Get current run state |
| `GET`    | `/v1/computer-use/runs/{id}/events`     | SSE event stream for a run |
| `POST`   | `/v1/computer-use/runs/{id}/approve`    | Approve or deny a pending action |
| `POST`   | `/v1/computer-use/runs/{id}/cancel`     | Cancel a running loop |
| `GET`    | `/v1/computer-use/sessions`             | List active browser sessions |
| `POST`   | `/v1/computer-use/sessions`             | Create a new session |
| `DELETE` | `/v1/computer-use/sessions/{id}`        | Close a session |
| `GET`    | `/v1/computer-use/adapters`             | List registered adapters and capabilities |
| `GET`    | `/v1/computer-use/health`               | Planning subsystem health |

**`POST /v1/computer-use/execute` request body:**

```json
{
  "mode": "intent",
  "task": "Fill out the job application form",
  "session_id": "sess-abc123",
  "run_id": "cu-xyz789",
  "target_scope": "browser",
  "options": {
    "max_steps": 20,
    "max_cost_usd": 1.0,
    "timeout_ms": 120000,
    "approval_policy": "on-risk",
    "record": true,
    "record_gif": true,
    "gif_fps": 2,
    "gif_scale": 0.5,
    "adapter_preference": "browser.playwright"
  }
}
```

**`mode` values:**

| Value | Behavior |
|-------|----------|
| `intent` | Full planning loop — vision analyzes screen, plans and executes steps autonomously |
| `direct` | Single-action execution, no planning |
| `assist` | Read-only — analyzes screen and suggests next action |

**`target_scope` values:**

| Value | Adapter selected |
|-------|-----------------|
| `browser` | `browser.playwright` (GatewayProxyAdapter) |
| `desktop` | `desktop.pyautogui` if available, else `desktop.accessibility` |
| `hybrid` | `browser.playwright` |
| `auto` | `browser.playwright` |

**Non-streaming response:**

```json
{
  "run_id": "cu-xyz789",
  "session_id": "sess-abc123",
  "status": "completed",
  "summary": "Completed 7 step(s): navigate, click, fill, click. Stopped: done",
  "result": {
    "stop_reason": "done",
    "steps": [...],
    "total_tokens": 14820,
    "total_cost_usd": 0.089,
    "duration_ms": 34500,
    "gif_path": "/tmp/allternit-recordings/session-cu-xyz789.gif"
  }
}
```

**Streaming (`?stream=true`):** Returns `text/event-stream`. Each line:

```
data: {"event_type": "plan.created", "run_id": "...", "message": "...", "data": {...}}
```

SSE event types: `plan.created` · `action.started` · `screenshot.captured` · `action.completed` · `reflection.done` · `approval.required` · `approval.received` · `run.completed` · `run.failed` · `run.ended`

**Approving a pending action:**

```bash
curl -X POST http://localhost:8760/v1/computer-use/runs/cu-xyz789/approve \
  -H "Content-Type: application/json" \
  -d '{"decision": "approve"}'
  # decision: "approve" | "deny" | "cancel"
```

Approvals time out after **120 seconds** and default to denied.

---

### MCP SSE Server (port 8765)

**File:** `acu_mcp/server.py`

Exposes 12 tools over the Model Context Protocol. Proxies to the gateway HTTP API.

**Add to Claude Code (`~/.claude/settings.json`):**

```json
{
  "mcpServers": {
    "allternit-computer-use": {
      "type": "sse",
      "url": "http://localhost:8765/mcp"
    }
  }
}
```

**Add to Claude Desktop (`~/.claude/claude_desktop_config.json`):**

```json
{
  "mcpServers": {
    "allternit-computer-use": {
      "command": "python",
      "args": ["-m", "acu_mcp.server", "stdio"],
      "cwd": "/path/to/domains/computer-use/core",
      "env": {
        "ALLTERNIT_VISION_PROVIDER": "anthropic",
        "ANTHROPIC_API_KEY": "sk-ant-..."
      }
    }
  }
}
```

#### MCP tool reference

| Tool | Params | Returns |
|------|--------|---------|
| `screenshot` | `session_id`, `full_page=false` | `{screenshot: b64, url, width, height}` |
| `navigate` | `session_id`, `url`, `wait_until="domcontentloaded"` | `{success, url, title}` |
| `click` | `session_id`, `x?`, `y?`, `selector?` | `{success, element}` |
| `type` | `session_id`, `text`, `selector?` | `{success, chars_typed}` |
| `scroll` | `session_id`, `direction="down"`, `amount=3` | `{success, position}` |
| `key` | `session_id`, `keys` | `{success, keys}` |
| `find_element` | `session_id`, `description`, `strategy="accessibility"` | `{found, selector, text, bounds}` |
| `read_screen` | `session_id`, `mode="accessibility"` | `{content, elements}` |
| `run_code` | `session_id`, `code`, `language="python"`, `timeout=30` | `{success, output, error}` |
| `record_start` | `session_id`, `name?` | `{recording_id, path}` |
| `record_stop` | `session_id`, `recording_id` | `{success, frames, path}` |
| `execute_task` | `session_id`, `task`, `mode="intent"`, `max_steps=20` | `{success, summary, steps, run_id}` |

**`find_element` strategies:** `selector` (CSS) · `text` (visible text match) · `accessibility` (a11y tree) · `vision` (visual description)

**`read_screen` modes:** `text` · `accessibility` · `structured`

**`run_code`** runs in a subprocess with a minimal environment — only `PATH`, `HOME`, `TMPDIR`, `TEMP`, `TMP`, `LANG`, `LC_ALL` are passed through. Maximum timeout 120s.

---

### Planning Loop

**File:** `core/planning_loop.py`

The core execution engine. Iterates Plan→Act→Observe→Reflect until the task is done or a stop condition is hit.

#### `PlanningLoopConfig`

| Field | Default | Notes |
|-------|---------|-------|
| `max_steps` | `20` | Hard ceiling on iterations |
| `max_cost_usd` | `1.0` | Stop if cumulative cost exceeds (stub — not yet wired) |
| `timeout_ms` | `120000` | Wall-clock timeout for the entire run |
| `reflect_after_each_step` | `true` | Ask vision provider to compare before/after screenshots |
| `approval_policy` | `"on-risk"` | `"never"` · `"on-risk"` · `"always"` |
| `record` | `true` | Write JSONL recording |
| `vision_provider` | `null` | Per-run provider override (stored in recorder metadata; loop itself still uses env) |

#### Stop reasons

| Reason | Status | Trigger |
|--------|--------|---------|
| `DONE` | `completed` | Vision provider set `plan.done = true` |
| `MAX_STEPS` | `completed` | Reached `max_steps` |
| `MAX_COST` | `completed` | Exceeded `max_cost_usd` (stub) |
| `TIMEOUT` | `failed` | Exceeded `timeout_ms` |
| `ERROR` | `failed` | Exception or stall (3 consecutive screenshot-only responses) |
| `APPROVAL_DENIED` | `needs_approval` | User denied a risky action |
| `CANCELLED` | `cancelled` | `cancel_event` was set |

#### Stall detection

If the vision provider returns a `screenshot` action 3 consecutive times with no actual action, the loop aborts with `StopReason.ERROR`. Prevents infinite loops when the provider is confused or stuck.

#### Approval gate

When `approval_policy = "on-risk"` and the provider flags `requires_approval = true`, the loop pauses and emits `approval.required`. POST to `/v1/computer-use/runs/{id}/approve` to resolve. Times out after 120s (defaults to denied).

#### `LoopStep` fields

| Field | Notes |
|-------|-------|
| `step` | Step number (1-indexed) |
| `reasoning` | Vision provider chain-of-thought |
| `plan_steps` | Remaining high-level steps |
| `risk_level` | `low` · `medium` · `high` |
| `requires_approval` | Whether this action was gated |
| `action_type` | `click` · `type` · `navigate` · etc. |
| `action_target` | Element description or URL |
| `action_params` | `{coordinates: [x, y], text: "..."}` |
| `before_screenshot_b64` | Screenshot before action |
| `after_screenshot_b64` | Screenshot after action |
| `reflection` | Vision provider's analysis of what changed |
| `action_succeeded` | False if adapter raised an exception |
| `tokens_used` | Tokens consumed by this step's vision call |

---

### Vision Providers

**File:** `core/vision_providers.py`

Pluggable vision backends. All implement `analyze_image()` and `ground_and_reason()`.

#### Provider selection

Set `ALLTERNIT_VISION_PROVIDER`. If set to `auto` or unset, auto-detection runs in this priority order:

1. `Allternit_VISION_INFERENCE_BASE` → `allternit`
2. `ACU_SKILLS_URL` → `uitars`
3. `ALLTERNIT_BRAIN_CMD` → `subprocess`
4. `ANTHROPIC_API_KEY` → `anthropic`
5. `OPENAI_API_KEY` → `openai`
6. `GOOGLE_API_KEY` → `gemini`
7. `QWEN_BASE_URL` → `qwen`

#### Provider reference

| Value | Backend | Default model | Required env vars |
|-------|---------|---------------|-------------------|
| `anthropic` | Anthropic API | `claude-3-opus-20240229` | `ANTHROPIC_API_KEY` |
| `openai` | OpenAI API | `gpt-4o` | `OPENAI_API_KEY` |
| `gemini` | Google Gemini | `gemini-2.0-flash-exp` | `GOOGLE_API_KEY` |
| `azure` | Azure OpenAI | `gpt-4o` | `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_DEPLOYMENT_NAME` |
| `qwen` | Qwen-VL endpoint | `Qwen2.5-VL-7B-Instruct` | `QWEN_BASE_URL` |
| `showui` | ShowUI-2B local | `showlab/ShowUI-2B` | `SHOWUI_MODEL_PATH` (optional) |
| `uitars` | UI-TARS skills API | — | `ACU_SKILLS_URL` (default `http://localhost:8770`) |
| `allternit` | Allternit internal | `gpt-4o` | `Allternit_VISION_INFERENCE_BASE`, `Allternit_VISION_INFERENCE_KEY` |
| `subprocess` | Any CLI brain | — | `ALLTERNIT_BRAIN_CMD` (default `claude`) |
| `mock` | Hardcoded test | — | — (always available) |

#### `ActionPlan` — vision provider output

| Field | Type | Notes |
|-------|------|-------|
| `reasoning` | string | Chain-of-thought explanation |
| `plan_steps` | list | Remaining steps to complete the task |
| `immediate_action` | `VisionAction` | What to execute next |
| `confidence` | float | 0.0–1.0 |
| `requires_approval` | bool | Provider flagged this as risky |
| `risk_level` | string | `low` · `medium` · `high` |
| `done` | bool | Set `true` when task is complete |
| `tokens_used` | int | Tokens consumed by this call |

#### `VisionAction`

| Field | Notes |
|-------|-------|
| `type` | `click` · `type` · `scroll` · `navigate` · `key` · `screenshot` |
| `target` | Element description, URL, or key combo |
| `reason` | Why this action was chosen |
| `coordinates` | `[x, y]` pixels — populated for click/move actions |

#### Registering a custom provider

```python
from core.vision_providers import VisionProviderFactory, VisionProvider

class MyProvider(VisionProvider):
    def analyze_image(self, image_bytes, task, **kwargs):
        ...
    def is_available(self):
        return True

VisionProviderFactory.register_provider("my-provider", MyProvider)
```

---

### Adapters

Adapters are the bridge between the planning loop and the actual browser or desktop. All are duck-typed.

#### `GatewayProxyAdapter` (`browser.playwright`)

**File:** `adapters/browser/gateway_proxy_adapter.py`

Default browser adapter. Delegates actions to the gateway's own `/v1/execute` endpoint over HTTP. Creates a self-loop: `PlanningLoop → GatewayProxyAdapter → /v1/execute → Playwright session`.

Action type mapping (VisionAction → gateway action):

```
click → click      type / fill → fill      navigate / goto → goto
screenshot → screenshot    scroll → scroll    key / press → key
extract → extract    inspect → inspect    close → close
```

#### `DomMcpAdapter` (`browser.dom_mcp`)

**File:** `adapters/browser/dom_mcp_adapter.py`

DOM-first adapter with its own Playwright instance. Strategy: match against accessibility tree first (zero vision tokens), fall back to returning the tree snapshot for vision grounding.

Methods: `navigate()` · `find_element()` · `click()` · `type_text()` · `scroll()` · `screenshot()` · `read_screen()` · `execute_js()`

#### `PyAutoGUIAdapter` (`desktop.pyautogui`)

**File:** `adapters/desktop/pyautogui/pyautogui_adapter.py`

Cross-platform desktop automation. Uses `mss` for fast screenshots, PyAutoGUI for mouse/keyboard.

Safety: `FAILSAFE = True` (move mouse to corner to abort), `PAUSE = 0.1s` between actions.

Platform permissions required:
- **macOS:** Accessibility + Screen Recording in System Preferences → Privacy & Security
- **Windows:** Run with sufficient user rights
- **Linux:** `$DISPLAY` set, X11 accessible

Supported execute actions: `click` · `type` · `fill` · `scroll` · `key` · `press` · `move`

#### `AccessibilityAdapter` (`desktop.accessibility`)

**File:** `adapters/desktop/accessibility_adapter.py`

Reads native accessibility trees without screenshots — cheaper than vision for structural queries. macOS uses `NSAccessibility`/`AXUIElement` via pyobjc with AppleScript fallback. Windows uses UI Automation (comtypes). Linux is not yet implemented.

Best used for reading app state and finding elements by role/label. Pair with `PyAutoGUIAdapter` for click/type execution.

---

### Session Manager

**File:** `gateway/session_manager.py`

Manages persistent Playwright browser sessions. One shared Chromium instance, isolated `BrowserContext` per session.

| Setting | Default | Notes |
|---------|---------|-------|
| `max_sessions` | `10` | Evicts oldest session on overflow |
| `idle_timeout` | `1800s` | Sessions closed after 30 min idle |
| Viewport | `1280×720` | Set on context creation |
| Downloads | enabled | `accept_downloads=True` |
| Cleanup loop | every 60s | Background task, scans for idle sessions |

Sessions are keyed by `session_id` string. If a page is closed by navigation, a new page is created in the same context automatically.

---

### Action Recorder

**File:** `core/action_recorder.py`

Records every planning loop step to a JSONL file. One file per run. Optionally co-drives `GIFRecorder`.

#### JSONL file format

```
Line 0: RecordingManifest  (_type: "manifest")
Line 1: RecordedFrame      (step 1)
Line 2: RecordedFrame      (step 2)
...
```

All entries are single-line JSON.

#### `RecordingManifest` fields

| Field | Notes |
|-------|-------|
| `recording_id` | `rec-{12 hex chars}` |
| `task` | Original task string |
| `session_id` | Browser/desktop session |
| `run_id` | Planning loop run |
| `vision_provider` | Provider used |
| `adapter_id` | Adapter used |
| `started_at` | ISO UTC timestamp |
| `completed_at` | Set on `stop()` |
| `total_steps` | Frame count — set on `stop()` |
| `status` | `recording` → `completed` |
| `gif_path` | Absolute path to GIF (if recording was enabled) |

#### `RecordedFrame` fields

| Field | Notes |
|-------|-------|
| `step` | Step number |
| `action_type` | `click` · `type` · `navigate` · etc. |
| `action_target` | Element description or URL |
| `action_params` | `{coordinates, text}` |
| `before_screenshot_b64` | Base64 PNG before action |
| `after_screenshot_b64` | Base64 PNG after action |
| `reasoning` | Vision provider chain-of-thought |
| `reflection` | Post-action analysis |
| `action_succeeded` | False if adapter raised |
| `risk_level` | `low` · `medium` · `high` |
| `tokens_used` | Tokens for this step |

#### Constructor

```python
ActionRecorder(
    recording_id=None,      # auto-generated: rec-{12 hex}
    task="",
    session_id="",
    run_id="",
    output_dir=None,        # default: ~/.allternit/recordings/
    vision_provider="",
    adapter_id="",
    record_gif=False,       # True to co-record GIF
    gif_fps=2,
    gif_scale=0.5,
    gif_annotate=True,
)
```

#### Loading and replaying

```python
from core.action_recorder import ActionRecorder, list_recordings

# List all recordings (sorted newest first)
recordings = list_recordings()

# Load
manifest, frames = ActionRecorder.load(Path("~/.allternit/recordings/rec-abc.jsonl"))

# Replay through an adapter
result = await ActionRecorder.replay(path, adapter, session_id)
```

---

### GIF Recorder

**File:** `core/gif_recorder.py`

Buffers screenshots and renders an annotated animated GIF. Lazy-imports Pillow and imageio — loads cleanly without them, `is_available()` returns `False`.

#### Constructor

```python
GIFRecorder(
    fps=2,                  # frames per second (1–30)
    scale=0.5,              # output scale (0.05–1.0)
    max_frames=600,         # hard cap — ~5 min at 2 FPS
    output_dir="/tmp/allternit-recordings",
)
```

#### Usage

```python
from core.gif_recorder import GIFRecorder, is_available

if is_available():
    rec = GIFRecorder(fps=2, scale=0.5)
    rec.start()

    rec.add_frame_b64(screenshot_b64, action_label="click Submit", step=3)
    # or:
    rec.add_frame_bytes(png_bytes, action_label="navigate", step=1)

    path = rec.save(run_id="cu-abc123", annotate=True)
    # → /tmp/allternit-recordings/session-cu-abc123.gif
```

#### Frame annotations (`annotate=True`)

- **Top-left:** `Step N`
- **Top-right:** Elapsed time `MM:SS`
- **Bottom-left:** Action label (truncated to 60 chars)

All text has a semi-transparent black background.

#### Build GIF from stored JSONL (no re-run)

```python
_, frames = ActionRecorder.load(recording_path)
frame_dicts = [f.to_dict() for f in frames]

recorder = GIFRecorder.from_jsonl_frames(frame_dicts, fps=2, scale=0.5)
path = recorder.save(run_id="rec-abc123", annotate=True)
```

This is what `/cu:replay --export-gif` uses internally.

#### Install deps

```bash
pip install Pillow imageio
```

---

## API Reference

### HTTP status codes

| Code | Meaning |
|------|---------|
| `200` | Success |
| `400` | Bad request — missing required field or invalid action params |
| `404` | Run, session, or recording not found |
| `409` | Conflict — no pending approval, or approval already resolved |
| `500` | Internal error |
| `503` | Service unavailable — session manager not initialized |

### Error response shape

```json
{
  "status": "failed",
  "error": {
    "code": "SELECTOR_ERROR",
    "message": "Element '#submit-btn' not found after 5000ms"
  }
}
```

#### Error codes

| Code | Action |
|------|--------|
| `NAVIGATION_ERROR` | `goto` |
| `SCREENSHOT_ERROR` | `screenshot` |
| `SELECTOR_ERROR` | `click` or `fill` element not found |
| `CLICK_ERROR` | `click` failed after finding element |
| `FILL_ERROR` | `fill` / `type` failed |
| `EXTRACT_ERROR` | `extract` |
| `INSPECT_ERROR` | `inspect` |
| `CLOSE_ERROR` | `close` |
| `SCROLL_ERROR` | `scroll` |
| `KEY_ERROR` | `key` |
| `TYPE_ERROR` | `type` |
| `UNKNOWN_ACTION` | Unrecognized action type |

---

## Configuration

### Environment variables

| Variable | Default | Notes |
|----------|---------|-------|
| `ALLTERNIT_VISION_PROVIDER` | `auto` | `mock` `anthropic` `openai` `gemini` `uitars` `allternit` `subprocess` `azure` `qwen` `showui` |
| `ANTHROPIC_API_KEY` | — | Required for `anthropic` |
| `OPENAI_API_KEY` | — | Required for `openai` |
| `GOOGLE_API_KEY` | — | Required for `gemini` |
| `AZURE_OPENAI_API_KEY` | — | Required for `azure` |
| `AZURE_OPENAI_ENDPOINT` | — | Required for `azure` |
| `AZURE_OPENAI_DEPLOYMENT_NAME` | — | Required for `azure` |
| `QWEN_BASE_URL` | `http://localhost:8000/v1` | |
| `QWEN_API_KEY` | `not-required` | |
| `QWEN_MODEL_NAME` | `Qwen/Qwen2.5-VL-7B-Instruct` | |
| `GEMINI_MODEL_NAME` | `gemini-2.0-flash-exp` | |
| `SHOWUI_MODEL_PATH` | `showlab/ShowUI-2B` | |
| `ACU_GATEWAY_PORT` | `8760` | Gateway listen port |
| `ACU_MCP_PORT` | `8765` | MCP server listen port |
| `ACU_GATEWAY_URL` | `http://localhost:8760` | Used by MCP server and GatewayProxyAdapter |
| `ACU_SKILLS_URL` | `http://localhost:8770` | UI-TARS skills API base |
| `ACU_RECORDINGS_DIR` | `~/.allternit/recordings` | JSONL output directory |
| `ACU_GIF_OUTPUT_DIR` | `/tmp/allternit-recordings` | GIF output directory |
| `Allternit_VISION_INFERENCE_BASE` | — | Internal vision endpoint base URL |
| `Allternit_VISION_INFERENCE_KEY` | — | Internal vision endpoint API key |
| `Allternit_VISION_MODEL_NAME` | `gpt-4o` | Internal vision model |
| `ALLTERNIT_BRAIN_CMD` | `claude` | CLI binary for subprocess provider |
| `ALLTERNIT_BRAIN_ARGS` | — | Additional args for brain subprocess |

### `options` on execute requests

| Option | Type | Default | Notes |
|--------|------|---------|-------|
| `max_steps` | int | `20` | Planning loop iteration limit |
| `max_cost_usd` | float | `1.0` | Cost ceiling (stub — not active) |
| `timeout_ms` | int | `120000` | Wall-clock timeout |
| `approval_policy` | string | `"on-risk"` | `never` · `on-risk` · `always` |
| `record` | bool | `true` | Write JSONL recording |
| `record_gif` | bool | `true` | Produce GIF replay |
| `gif_fps` | int | `2` | GIF frame rate |
| `gif_scale` | float | `0.5` | GIF output scale |
| `adapter_preference` | string | scope default | Force a specific adapter key |

---

## Plugin

The `allternit-computer-use` plugin packages this engine as a full Allternit capability. It does not run independently — it provides the instructions, slash commands, skills, and adapters that wire Claude into the engine.

**Location:** `packages/computer-use/plugins/allternit-computer-use/`

### Slash commands

| Command | Description |
|---------|-------------|
| `/cu:automate <task>` | Full autonomous execution with planning loop |
| `/cu:browse <url>` | Navigate and optionally perform a task |
| `/cu:desktop <task>` | Control a native desktop application |
| `/cu:screenshot` | Instant screen capture |
| `/cu:extract <what>` | Extract structured data from a page |
| `/cu:record start/stop` | Start or stop session recording |
| `/cu:replay <id>` | Replay recording or export GIF |
| `/cu:assist <intent>` | Co-pilot mode — suggest next action |

### Skills auto-loaded when plugin is active

`browser-navigation` · `form-filling` · `data-extraction` · `desktop-control` · `screen-reading` · `workflow-recording` · `visual-grounding` · `error-recovery`

### Subagents

| Subagent | Role |
|----------|------|
| `planning-agent` | Primary executor — runs the PLAN/ACT/OBSERVE/REFLECT loop |
| `verification-agent` | Post-action verifier — screenshot comparison, outcome classification |
| `recovery-agent` | Failure analyst — 7-category diagnosis, 3-ranked recovery alternatives |

### Cookbooks

`web-scraping` · `form-automation` · `login-flow` · `multi-step-workflow` · `desktop-app-automation` · `data-pipeline` · `invoice-processing` · `job-application`

### Plugin adapters

| File | Purpose |
|------|---------|
| `adapters/mcp.js` | Registers 5 MCP tools on any MCP server instance |
| `adapters/http.js` | `ComputerUseHttpAdapter` — typed REST client for platform surfaces |

See `CONNECTORS.md` for full connector setup, gateway startup, and GIF config reference.

---

## Data Schemas

### `Artifact`

```json
{
  "type": "screenshot",
  "path": "/tmp/screenshot.png",
  "url": null,
  "mime": "image/png",
  "content": "<base64 PNG>"
}
```

Type values: `screenshot` · `download` · `json` · `text` · `html` · `dom_snapshot`

### `Receipt`

```json
{
  "receipt_id": "rcpt_abc123",
  "timestamp": "2026-04-22T09:00:00Z",
  "run_id": "cu-xyz",
  "session_id": "sess-abc",
  "action_type": "click",
  "adapter_id": "browser.playwright",
  "target": "Submit button",
  "status": "success",
  "integrity_hash": "<sha256 of {action, result}>",
  "duration_ms": 342,
  "artifact_refs": ["art-1"]
}
```

### Recording JSONL

```jsonc
// Line 0 — manifest
{
  "_type": "manifest",
  "recording_id": "rec-abc123",
  "task": "Fill out the job application",
  "session_id": "sess-1",
  "run_id": "cu-xyz",
  "started_at": "2026-04-22T09:00:00Z",
  "completed_at": "2026-04-22T09:00:45Z",
  "total_steps": 7,
  "status": "completed",
  "gif_path": "/tmp/allternit-recordings/session-cu-xyz.gif"
}

// Lines 1+ — steps
{
  "recording_id": "rec-abc123",
  "step": 1,
  "timestamp": "2026-04-22T09:00:05Z",
  "action_type": "navigate",
  "action_target": "https://jobs.company.com/apply",
  "action_params": {},
  "before_screenshot_b64": "...",
  "after_screenshot_b64": "...",
  "reasoning": "I need to navigate to the application page first.",
  "reflection": "Page loaded. I can see the application form.",
  "action_succeeded": true,
  "risk_level": "low",
  "tokens_used": 1240
}
```

---

## Development

### Running tests

```bash
cd domains/computer-use/core
source gateway/.venv/bin/activate

# Core unit tests (no live browser required)
ALLTERNIT_VISION_PROVIDER=mock python -m pytest tests/integration/test_adapter_classes.py -v

# Integration suite
ALLTERNIT_VISION_PROVIDER=mock python -m pytest tests/integration/ -v \
  --ignore=tests/test_e2e.py --ignore=tests/test_real_adapters.py
```

### Adding a vision provider

1. Subclass `VisionProvider` in `core/vision_providers.py`
2. Implement `analyze_image(image_bytes, task) -> VisionResponse` and `is_available() -> bool`
3. Override `ground_and_reason()` for native planning support
4. Add to `ProviderType` enum and `VisionProviderFactory._providers`
5. Add detection to `PROVIDER_AUTO_DETECT_ORDER`

### Adding an adapter

1. Create module in `adapters/browser/` or `adapters/desktop/`
2. Implement `execute(req)`, `screenshot(session_id) -> bytes`, `capabilities()`, `close()`
3. Duck-type against `ActionRequest`: reads `action_type`, `target`, `parameters`, `session_id`
4. Register in `_build_adapter_registry()` in `computer_use_router.py`
5. Add to `select_adapter()` scope map if it should be auto-selected

### Project structure

```
domains/computer-use/core/
├── gateway/
│   ├── main.py                    App factory, direct action routes (/v1/execute)
│   ├── computer_use_router.py     Planning loop routes (/v1/computer-use/)
│   ├── session_manager.py         Playwright session pool
│   └── observability_integration.py
├── core/
│   ├── planning_loop.py           Plan→Act→Observe→Reflect engine
│   ├── vision_providers.py        All vision backends + factory
│   ├── action_recorder.py         JSONL recorder + GIF co-recorder
│   ├── gif_recorder.py            Animated GIF builder
│   ├── base_adapter.py            Adapter contracts + data schemas
│   └── perceptual_layer.py        Legacy perceptual API
├── adapters/
│   ├── browser/
│   │   ├── gateway_proxy_adapter.py   Proxies to /v1/execute
│   │   ├── dom_mcp_adapter.py         DOM-first with a11y tree
│   │   ├── playwright_adapter.py      Direct Playwright
│   │   └── skyvern_adapter.py         Skyvern integration
│   └── desktop/
│       ├── pyautogui/pyautogui_adapter.py
│       └── accessibility_adapter.py
├── acu_mcp/
│   └── server.py                  MCP SSE server (port 8765)
├── observability/                 Recording, replay, analysis
├── conformance/                   Conformance test suites
└── tests/
    └── integration/
```
