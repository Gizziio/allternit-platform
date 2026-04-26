# A2 Ops Center + PTY Brains + Vendor Icons + UI-TARS Demo

This document provides a comprehensive demo guide for the Allternit Ops Center integration.

## Prerequisites

### System Requirements
- macOS (for UI-TARS GUI tools)
- Node.js 18+ and pnpm
- Rust 1.70+ (for kernel CLI)
- Python 3.11+ (for UI-TARS operator)

### Required Ports
| Service | Port | Purpose |
|---------|------|---------|
| Shell UI | 5713 | Main Allternit desktop |
| Kernel API | 3004 | Brain/session management |
| UI-TARS Operator | 3008 | Computer use automation |

## Quick Start

### 1. Start the Kernel (Terminal 1)

```bash
cd /Users/macbook/Desktop/allternit-workspace/allternit/services/kernel
cargo run
```

Expected output:
```
2024-01-19T10:00:00Z INFO - Kernel starting on port 3004
2024-01-19T10:00:00Z INFO - Brain manager initialized
2024-01-19T10:00:00Z INFO - Session manager ready
2024-01-19T10:00:00Z INFO - API routes registered
2024-01-19T10:00:00Z INFO - Kernel ready on http://localhost:3004
```

### 2. Start the Shell UI (Terminal 2)

```bash
cd /Users/macbook/Desktop/allternit-workspace/allternit/apps/shell
pnpm dev
```

Expected output:
```
VITE v5.4.21  ready in 300 ms

  ➜  Local:   http://localhost:5713/
  ➜  Network: use --host to expose
  ➜  press h+enter to show help
```

### 3. Start UI-TARS Operator (Terminal 3)

```bash
cd /Users/macbook/Desktop/allternit-workspace/allternit/services/ui-tars-operator
python -m uvicorn src.main:app --host 0.0.0.0 --port 3008
```

Expected output:
```
INFO:     Uvicorn running on http://0.0.0.0:3008
INFO:     Application startup complete
```

## Demo Checklist

### ✅ Deliverable 1: OpenWork as Native Shell Tab

**Verification Steps:**

1. Open browser to `http://localhost:5713`
2. Click the **Ops Center** icon in the LeftRail (between Home and Studio)
3. Verify the OpenWork dashboard appears inside the Shell UI

**Expected Result:**
```
┌─────────────────────────────────────────────────────┐
│  Allternit Shell UI (port 5713)                    │
├─────────────────────────────────────────────────────┤
│  [Home] [Studio] [Ops Center] [Registry] [...]      │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌─────────────────────────────────────────────┐    │
│  │  OpenWork - Ops Center                      │    │
│  │  ┌─────────────────────────────────────┐    │    │
│  │  │  Dashboard                          │    │    │
│  │  │  Active Sessions: 2                 │    │    │
│  │  │  Integration Status: Connected      │    │    │
│  │  └─────────────────────────────────────┘    │    │
│  │                                             │    │
└─────────────────────────────────────────────────────┘
```

**Console Log Verification:**
```
[OpenWorkView] OpenWork mounted as React component
[OpenWorkView] No iframe - native integration confirmed
```

### ✅ Deliverable 2: PTY Brain Sessions via CLI

**Verification Steps:**

1. Ensure kernel is running (port 3004)
2. Test brain commands:

```bash
# List available tools
a2 brain which opencode
a2 brain which claude-code
a2 brain which aider

# Start a brain session
a2 brain start --tool opencode

# List active sessions
a2 brain list

# Attach to session
a2 brain attach --session-id <session-id>

# Stop session
a2 brain stop --session-id <session-id>
```

**Expected Output - Start:**
```
Starting Brain Session
═══════════════════════════════════════════════════
  → Tool: opencode
  → Workspace: /Users/macbook/Desktop/allternit-workspace

✓ Brain session created successfully!

  → Session ID: abc123-def456
  → Status: Running
  → Process ID: 12345
```

**Expected Output - List:**
```
Active Brain Sessions
═══════════════════════════════════════════════════

  ●
    Session ID: abc123-def456
    Brain ID:   opencode
    Status:     Running
    PID:        12345

ℹ️  Total: 1 session(s)
```

### ✅ Deliverable 3: Vendor Icons (No Emojis)

**Verification Steps:**

1. Open Shell UI at `http://localhost:5713`
2. Verify LeftRail icons are SVG (not emoji):
   - OpenWork icon (layers/cube)
   - Brain tool icons (opencode, claude-code, etc.)
3. Verify TabStrip icons use SVG
4. Verify DockBar icons use SVG

**Expected Icons:**

| Location | Icon Type | Format |
|----------|-----------|--------|
| LeftRail | Ops Center | SVG (cube/layers) |
| LeftRail | Brain Tools | SVG (10 vendor icons) |
| TabStrip | Active Tabs | SVG |
| DockBar | Minimized Apps | SVG |

**Verification Command:**
```bash
# Check that no emoji icons are used
grep -r "🖥️\|📋\|🔧\|🚀" apps/shell/src/components/LeftRail.tsx
# Should return no matches
```

### ✅ Deliverable 4: UI-TARS Computer Use Tools (Real Integration with Configurable Vision Brain)

**Configuration Options (Priority Order):**

1. **Environment Variable** (recommended)
```bash
export A2_VISION_BRAIN=qwen  # Use Qwen for vision tasks
export A2_VISION_BRAIN=claude-code  # Use Claude Code
export A2_VISION_BRAIN=gemini-cli  # Use Gemini CLI
```

2. **Per-Request Override**
```bash
# Override vision brain for specific task
curl -X POST http://localhost:3004/v1/tools/gui/run-task \
  -H "Content-Type: application/json" \
  -d '{
    "task": "Click the login button",
    "vision_brain": "qwen",
    "background": true
  }'
```

3. **Default** (falls back to `claude-code` if not configured)

**Check Current Configuration:**
```bash
curl http://localhost:3004/v1/tools/gui/status

{
  "status": "ready",
  "vision_config": {
    "configured_brain": "qwen",
    "source": "A2_VISION_BRAIN environment variable",
    "default_brain": "claude-code",
    "available_brains": ["claude-code", "gemini-cli", "qwen", "opencode", "cursor"],
    "set_via_env": "export A2_VISION_BRAIN=<brain>",
    "example": "export A2_VISION_BRAIN=qwen"
  }
}
```

**Start with Qwen for Vision:**
```bash
# Set environment variable
export A2_VISION_BRAIN=qwen

# Start the platform
a2 up

# Now all GUI tasks use Qwen for vision analysis
curl -X POST http://localhost:3004/v1/tools/gui/run-task \
  -H "Content-Type: application/json" \
  -d '{"task": "Click on search bar", "max_steps": 3, "background": true}'

# Response shows which brain is being used:
{
  "success": true,
  "task_id": "abc-123",
  "vision_brain": "qwen",
  "status": "running"
}
```

**Background Mode Workflow:**
```
┌─────────────────────────────────────────────────────────────────────┐
│ 1. POST /v1/tools/gui/run-task (background: true)                   │
│    └─→ Returns immediately with task_id, status: "running"          │
│                                                                     │
│ 2. Task runs in background (screenshot → propose → execute → verify)│
│                                                                     │
│ 3. POST /v1/tools/gui/task-status (poll or stream)                  │
│    └─→ Returns current status + results                             │
│                                                                     │
│ 4. Status changes to "completed" or "failed"                        │
└─────────────────────────────────────────────────────────────────────┘
```

**Expected Response - Status:**
```json
{
  "status": "ready",
  "platform": "macos",
  "tools": ["screenshot", "click", "type", "scroll", "run_task"],
  "ui_tars_operator": {
    "url": "http://localhost:3008",
    "available": true,
    "endpoints": {
      "propose": "http://localhost:3008/v1/model/ui_tars/propose",
      "health": "http://localhost:3008/health"
    }
  }
}
```

**Expected Response - Run Task:**
```json
{
  "success": true,
  "task": "Click on the search bar and type Hello World",
  "steps_executed": 1,
  "results": [
    {
      "step": 1,
      "action": "screenshot",
      "success": true,
      "output": "Screenshot captured (45000 bytes)",
      "duration_ms": 150
    },
    {
      "step": 1,
      "action": "propose",
      "success": true,
      "output": "click @ (456, 89) - 0.95 confidence, 450ms",
      "duration_ms": 480
    },
    {
      "step": 1,
      "action": "execute",
      "success": true,
      "output": "Clicked at (456, 89)",
      "duration_ms": 50
    },
    {
      "step": 1,
      "action": "verify",
      "success": true,
      "output": "Verification screenshot captured",
      "duration_ms": 120
    }
  ],
  "total_time_ms": 800,
  "error": null
}
```

**Architecture - Real UI-TARS Integration:**
```
┌─────────────────────────────────────────────────────────────┐
│ Kernel API (3004)                                           │
├─────────────────────────────────────────────────────────────┤
│ POST /v1/tools/gui/run-task                                 │
│     ↓                                                       │
│  ┌─ Step 1: screenshot ──→ screencapture CLI ───┐          │
│  │                                                    │          │
│  ↓                                                    ↓          │
│  ┌─ Step 2: propose ──→ UI-TARS Operator (3008) ──┐          │
│  │    POST /v1/model/ui_tars/propose              │          │
│  │    Body: {task, screenshot_b64, viewport}      │          │
│  │    Response: {proposals: [{action, x, y, ...}]}│          │
│  │                                                    │          │
│  ↓                                                    ↓          │
│  ┌─ Step 3: execute ──→ cliclick/osascript CLI ───┐          │
│  │                                                    │          │
│  ↓                                                    ↓          │
│  ┌─ Step 4: verify ──→ screencapture CLI ──────────┐          │
│  └──────────────────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────────┘
```

## Troubleshooting Matrix

| Symptom | Likely Cause | Solution |
|---------|--------------|----------|
| Shell won't start on 5713 | Port in use | Kill process: `lsof -ti:5713 \| xargs kill -9` |
| Kernel won't start on 3004 | Port in use | Kill process: `lsof -ti:3004 \| xargs kill -9` |
| OpenWork shows blank screen | Import resolution | Restart Vite dev server |
| Brain commands fail | Kernel not running | Start kernel first: `cargo run` in kernel/ |
| Icons show as boxes | SVG path error | Check CapsuleIconRegistry.tsx for syntax |
| UI-TARS tools timeout | Operator not running | Start operator: `python -m uvicorn src.main:app --port 3008` |
| `run-task` returns fallback messages | UI-TARS operator not available | Check operator health: `curl http://localhost:3008/health` |
| `screenshot` fails | macOS screencapture not found | Install via Xcode: `xcode-select --install` |
| `click` fails | cliclick not installed | Install: `brew install cliclick` |
| `type` fails | osascript blocked | Check Accessibility permissions in System Settings |

## UI-TARS Operator Status Check

```bash
# Check if UI-TARS operator is available
curl http://localhost:3008/health

# Check UI-TARS availability via kernel
curl http://localhost:3004/v1/tools/gui/status | jq '.ui_tars_operator'

# Expected output when available:
{
  "url": "http://localhost:3008",
  "available": true,
  "endpoints": {
    "propose": "http://localhost:3008/v1/model/ui_tars/propose",
    "health": "http://localhost:3008/health"
  }
}
```

## Architecture Reference

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Allternit Shell UI (5713)                            │
├─────────────────────────────────────────────────────────────────────────────┤
│  LeftRail          │  Canvas Area                                           │
│  ─────────────     │  ─────────────────────────────────                     │
│  [Home]            │  ┌─────────────────────────────────────────────────┐   │
│  [Studio]          │  │  OpenWork Dashboard                             │   │
│  [Ops Center] ◄───►│  │  ┌───────────────────────────────────────────┐ │   │
│  [Registry]        │  │  │  Session Management                         │ │   │
│  [Brain Tools]     │  │  │  Brain Status                               │ │   │
│     ├─[opencode]   │  │  │  Integration Links                          │ │   │
│     ├─[claude]     │  │  └───────────────────────────────────────────┘ │   │
│     └─[aider]      │  └─────────────────────────────────────────────────┘   │
│                                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                          Kernel API (3004)                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ Brain Session Management                                             │    │
│  │ POST /v1/sessions           - Create brain session                   │    │
│  │ GET  /v1/sessions           - List sessions                          │    │
│  │ POST /v1/sessions/:id/attach - Attach to session                     │    │
│  │ POST /v1/sessions/:id/input - Send input to brain                    │    │
│  │ DELETE /v1/sessions/:id     - Terminate session                      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ GUI Tools (Computer Use)                                            │    │
│  │ GET  /v1/tools/gui/status      - Check status + UI-TARS availability │    │
│  │ POST /v1/tools/gui/screenshot  - Capture screen (screencapture)      │    │
│  │ POST /v1/tools/gui/click       - Click at coordinates (cliclick)     │    │
│  │ POST /v1/tools/gui/type        - Type text (osascript)               │    │
│  │ POST /v1/tools/gui/scroll      - Scroll (osascript key codes)        │    │
│  │ POST /v1/tools/gui/run-task    - Full automation loop                │    │
│  │                              screenshot → propose → execute → verify │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────────────────────┤
│                     UI-TARS Operator (3008)                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ POST /v1/model/ui_tars/propose                                       │    │
│  │                                                                       │    │
│  │ Request Body:                                                        │    │
│  │ {                                                                    │    │
│  │   "session_id": "kernel-gui",                                        │    │
│  │   "task": "Click on the search bar and type hello",                  │    │
│  │   "screenshot": "<base64_image>",                                    │    │
│  │   "viewport": {"w": 1920, "h": 1080}                                 │    │
│  │ }                                                                    │    │
│  │                                                                       │    │
│  │ Response:                                                            │    │
│  │ {                                                                    │    │
│  │   "proposals": [{                                                     │    │
│  │     "action_type": "click",                                          │    │
│  │     "x": 456,                                                        │    │
│  │     "y": 89,                                                         │    │
│  │     "confidence": 0.95,                                              │    │
│  │     "target": "search_bar",                                          │    │
│  │     "thought": "The search bar is at the top..."                     │    │
│  │   }],                                                                │    │
│  │   "model": "ui-tars-7b-qwen",                                        │    │
│  │   "latency_ms": 450                                                  │    │
│  │ }                                                                    │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

## File Changes Summary

### OpenWork Integration
- `apps/shell/src/components/OpenWorkView.tsx` - Removed iframe, added React component import
- `apps/shell/src/App.tsx` - Added OpenWork view routing
- `apps/shell/src/components/LeftRail.tsx` - Added Ops Center button with SVG icon
- `apps/openwork/src/index.tsx` - New OpenWork React module
- `apps/shell/vite.config.ts` - Added `@allternit/openwork` alias
- `apps/shell/tsconfig.json` - Added path mapping
- `apps/openwork/package.json` - New workspace package

### PTY Brain CLI
- `apps/cli/src/commands/brain_integration.rs` - Wired to kernel API
- `apps/cli/src/client.rs` - Added brain session API methods
- `services/kernel/src/brain/adapters/mod.rs` - Tool adapter configs
- `services/kernel/src/brain/adapters/tool_adapter.rs` - 10 tool definitions

### Vendor Icons
- `apps/shell/src/iconography/CapsuleIconRegistry.tsx` - Fixed duplicate, added 10 vendor icons

### UI-TARS Integration (Real, Not Mock)
- `services/kernel/src/gui_tools.rs` - **Complete rewrite with real UI-TARS wiring**
- `services/kernel/src/main.rs` - Added gui_tools routes
- `services/kernel/Cargo.toml` - Added base64 dependency

**Key Implementation Details:**
- `UiTarsOperatorClient` - HTTP client that calls UI-TARS operator at `localhost:3008`
- `propose()` method - Sends screenshot + task to `/v1/model/ui_tars/propose`
- `capture_screenshot()` - Uses macOS `screencapture` CLI
- `execute_click()` - Uses macOS `cliclick` for precise clicking
- `execute_type()` - Uses AppleScript `osascript` for text input
- `execute_scroll()` - Uses AppleScript key codes for scrolling
- `run_task` endpoint - Full loop: screenshot → propose → execute → verify

## Verification Commands

```bash
# Check OpenWork integration
curl -s http://localhost:5713 | grep -o "Ops Center" && echo "✓ OpenWork tab found"

# Check brain API
curl -s http://localhost:3004/v1/sessions | head -c 100 && echo "✓ Kernel brain API responding"

# Check UI-TARS operator
curl -s http://localhost:3008/health && echo "✓ UI-TARS operator healthy"

# Verify no emoji icons
grep -r "🖥️\|📋\|🔧\|🚀\|🤖\|💡" apps/shell/src/ | grep -v "node_modules" | wc -l
# Should return 0
```

## Next Steps

1. **Full UI-TARS Integration**: Implement `ui_tars_loop` tool that combines screenshot → propose → execute → verify
2. **Event Streaming**: Complete SSE/WebSocket event streaming for brain sessions
3. **Shell UI Behaviors**: Implement minimize→dock, restore→tab patterns

---

**Last Updated:** 2024-01-19
**Version:** 1.0.0
