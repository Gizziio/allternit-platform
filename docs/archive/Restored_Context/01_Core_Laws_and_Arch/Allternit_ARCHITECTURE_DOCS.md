# Allternit UI Enforcement Pack - Architecture Documentation

## Overview

This pack implements an **Anthropic-style extension architecture** with a **receipt ledger** for multi-agent reliability. It enforces visual verification for all UI-affecting work.

## The Problem This Solves

Without enforcement, agents:
- Claim UI fixes work without opening the actual app
- Skip visual verification after code changes
- Say "done" or "fixed" without evidence
- Produce false confidence from code inspection alone

This pack makes completion **structurally impossible** without visual verification.

---

## Architecture Layers

```
┌─────────────────────────────────────────────────────────────┐
│                    USER LAYER                               │
│  Commands: /debug-ui, /verify-ui, /show-receipts, etc.      │
│  (User-facing entrypoints - thin wrappers)                  │
└─────────────────────────────────────────────────────────────┘
                            ↓ routes to
┌─────────────────────────────────────────────────────────────┐
│                    AGENT LAYER                              │
│  Specialists: browser-debugger, electron-debugger, etc.     │
│  (Each has specific tools and workflows)                    │
└─────────────────────────────────────────────────────────────┘
                            ↓ uses
┌─────────────────────────────────────────────────────────────┐
│                 CAPABILITY LAYER                            │
│  MCP Servers: browser, electron, desktop, verify, evidence  │
│  (Actual tool implementations via MCP protocol)             │
└─────────────────────────────────────────────────────────────┘
                            ↓ enforced by
┌─────────────────────────────────────────────────────────────┐
│                 ENFORCEMENT LAYER                           │
│  Hooks: UserPromptSubmit, PreToolUse, PostToolUse, etc.     │
│  (Policy intercepts at lifecycle events)                    │
└─────────────────────────────────────────────────────────────┘
                            ↓ writes to
┌─────────────────────────────────────────────────────────────┐
│                 RELIABILITY LAYER                           │
│  Receipt Ledger: machine-verifiable execution traces        │
│  (Every action produces an auditable receipt)               │
└─────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
allternit-complete-pack/
│
├── .allternit/
│   ├── commands/           # 6 command files (Markdown)
│   │   ├── debug-ui.md
│   │   ├── verify-ui.md
│   │   ├── inspect-electron.md
│   │   ├── inspect-desktop.md
│   │   ├── crawl-site.md
│   │   └── show-receipts.md
│   │
│   ├── agents/             # 5 agent files (Markdown + YAML frontmatter)
│   │   ├── browser-debugger.md
│   │   ├── electron-debugger.md
│   │   ├── desktop-debugger.md
│   │   ├── ui-verifier.md
│   │   └── site-crawler.md
│   │
│   ├── mcp.json            # MCP server registry
│   └── settings.json       # Hooks + ledger configuration
│
├── runtime/
│   ├── receipt-ledger.js   # Receipt storage, queries, replay, diff
│   ├── mcp-loader.js       # MCP server activation
│   ├── tool-registry.js    # Tool management
│   ├── agent-router.js     # Task routing
│   └── hook-engine.js      # Hook execution with ledger integration
│
└── README.md               # Quick start guide
```

---

## Component Details

### 1. Commands (`.allternit/commands/*.md`)

**Purpose:** User-facing entrypoints that route to appropriate agents.

**How they work:**
- User types `/debug-ui http://localhost:3000`
- Command file defines arguments and examples
- Runtime routes to `browser-debugger` agent

**Example flow:**
```
User: /debug-ui http://localhost:3000/form
  ↓
Command: debug-ui.md (parses args)
  ↓
Agent: browser-debugger (executes workflow)
  ↓
Tools: mcp__browser__open_page, mcp__browser__capture_screenshot, etc.
  ↓
Receipts: tool_call_receipt, artifact_receipt, completion_receipt
```

### 2. Agents (`.allternit/agents/*.md`)

**Purpose:** Specialist workers with specific tool permissions and workflows.

**Each agent defines:**
- `name` - Agent identifier
- `description` - What it does
- `tools` - MCP tools it can use
- `model` - Preferred model
- `workflow` - Step-by-step process
- `output_contract` - Required output format

**Example: browser-debugger agent**
```markdown
tools:
  - mcp__browser__open_page
  - mcp__browser__capture_screenshot
  - mcp__browser__snapshot_dom
  - mcp__evidence__emit_receipt

Workflow:
1. Open page
2. Capture before screenshot
3. Inspect DOM
4. Apply fix
5. Reload
6. Capture after screenshot
7. Emit receipt
```

### 3. MCP Servers (`.allternit/mcp.json`)

**Purpose:** External tool providers via Model Context Protocol.

**6 servers defined:**

| Server | Purpose | Tools |
|--------|---------|-------|
| `allternit-browser` | Browser automation | `open_page`, `navigate`, `click`, `fill`, `snapshot_dom`, `capture_screenshot` |
| `allternit-electron` | Electron app inspection | `list_browserviews`, `inspect_bounds`, `inspect_focus`, `inspect_visibility` |
| `allternit-desktop` | Native desktop automation | `list_windows`, `focus_window`, `inspect_accessibility` |
| `allternit-crawl` | Site crawling | `submit_crawl`, `poll_status`, `fetch_results` |
| `allternit-verify` | Verification assertions | `assert_visible`, `assert_layout`, `assert_flow`, `compare_screens`, `score_verification` |
| `allternit-evidence` | Receipt emission | `emit_receipt`, `bundle_artifacts`, `store_trace`, `validate_receipt` |

**Tool naming convention:**
```
mcp__{server}__{tool}

Examples:
- mcp__browser__open_page
- mcp__browser__capture_screenshot
- mcp__verify__assert_flow
- mcp__evidence__emit_receipt
```

### 4. Hooks (`.allternit/settings.json`)

**Purpose:** Policy enforcement at lifecycle events.

**6 hooks defined:**

| Hook | When | Purpose |
|------|------|---------|
| `UserPromptSubmit` | Task creation | Classify task, route to agent |
| `PreToolUse` | Before tool call | Block invalid paths, require approval |
| `PostToolUse` | After tool call | Validate artifacts, write receipts |
| `SubagentStop` | Agent finishing | Require receipt before stopping |
| `CompletionAttempt` | Task completion | Query ledger, block unsupported claims |
| `SessionEnd` | Session close | Persist receipts and traces |

**Example: CompletionAttempt hook**
```javascript
// Queries ledger for actual receipts
const verification = ledger.verifyCompletion(taskId);

// Checks:
// - has_tool_calls: Did agent call MCP tools?
// - has_screenshot: Are there screenshots?
// - has_visual_verification: Was visual verification done?
// - no_blocked: Any blocked actions?
// - confidence_above_threshold: Confidence >= 0.8?

if (!verification.allPassed) {
  return { allowed: false, message: 'Requirements not met' };
}
```

### 5. Receipt Ledger (`runtime/receipt-ledger.js`)

**Purpose:** Machine-verifiable execution traces.

**Receipt types:**
- `tool_call_receipt` - MCP tool invocation
- `artifact_receipt` - Evidence captured
- `verification_receipt` - Verification assertion
- `blocked_receipt` - Blocked action
- `agent_run_receipt` - Subagent completion
- `completion_receipt` - Task completion

**Receipt schema:**
```json
{
  "receipt_id": "rcpt_20260313_220000_ab12",
  "task_id": "task_456",
  "agent_id": "browser-debugger",
  "type": "tool_call_receipt",
  "tool_name": "mcp__browser__capture_screenshot",
  "timestamp": "2026-03-13T22:00:00Z",
  "status": "success",
  "inputs": { "output": "before.png" },
  "outputs": { "file": "before.png", "size_bytes": 45678 },
  "artifacts": { "screenshots": ["before.png"] },
  "verification": { "structural": false, "visual": false, "behavioral": false },
  "confidence": 0.5,
  "checksum": "sha256:abc123..."
}
```

**Key operations:**
```javascript
// Emit receipt
ledger.emit({ task_id, agent_id, type, tool_name, inputs, outputs });

// Query by task
const receipts = ledger.getByTask('task_123');

// Verify completion requirements
const verification = ledger.verifyCompletion('task_123');
// Returns: { has_tool_calls, has_screenshot, has_visual_verification, ... }

// Replay execution sequence
const replay = ledger.replay('task_123');

// Compare two tasks (regression detection)
const diff = ledger.diff('task_before', 'task_after');
```

---

## Runtime Activation Sequence

```javascript
import { activate } from './runtime/mcp-loader.js';
import { ReceiptLedger } from './runtime/receipt-ledger.js';
import { HookEngine } from './runtime/hook-engine.js';
import { AgentRouter } from './runtime/agent-router.js';

// Step 1: Initialize ledger
const ledger = new ReceiptLedger('~/.allternit/ledger');

// Step 2: Load and activate MCP servers
const loader = await activate('.allternit/mcp.json', runtime);
// - Reads .allternit/mcp.json
// - Spawns MCP server processes
// - Discovers tools
// - Registers tools with canonical names
// - Runs health checks

// Step 3: Initialize hook engine
const hooks = new HookEngine('.allternit/settings.json', ledger);
// - Loads hook configurations
// - Compiles regex matchers
// - Connects to ledger

// Step 4: Register agents
const router = new AgentRouter();
router.addRoute('(UI|UX|frontend)', 'browser-debugger');
router.addRoute('(Electron|BrowserView)', 'electron-debugger');
// ... etc

// System ready
```

---

## Execution Flow Example

**User task:** "Fix the submit button not working on the form"

### Step 1: UserPromptSubmit Hook
```javascript
// Hook matches "submit button" → UI-affecting
// Routes to browser-debugger agent
// Mounts allternit-browser, allternit-evidence MCP servers
// Adds policy_tags: ['ui-affecting', 'requires-visual-verification']
```

### Step 2: Agent Executes Workflow
```javascript
// browser-debugger agent:
await mcp__browser__open_page({ url: 'http://localhost:3000' });
// → Emits tool_call_receipt

await mcp__browser__capture_screenshot({ output: 'before.png' });
// → Emits tool_call_receipt + artifact_receipt

await mcp__browser__snapshot_dom({ output: 'before.json' });
// → Emits tool_call_receipt + artifact_receipt

// [Agent applies fix]

await mcp__browser__reload();
await mcp__browser__capture_screenshot({ output: 'after.png' });
// → Emits tool_call_receipt + artifact_receipt

await mcp__evidence__emit_receipt({ status: 'verified' });
// → Emits completion_receipt
```

### Step 3: SubagentStop Hook
```javascript
// Checks required_artifacts: ['receipt']
// Queries ledger for receipts
// If receipt exists → allowed: true
// If no receipt → allowed: false, message: 'Must emit receipt'
```

### Step 4: CompletionAttempt Hook
```javascript
// Queries ledger
const verification = ledger.verifyCompletion(taskId);

// Checks:
// - has_tool_calls: true (5 tool calls found)
// - has_screenshot: true (2 screenshots found)
// - has_visual_verification: true (receipt status = 'verified')

if (verification.allPassed) {
  ledger.emit({ type: 'completion_receipt', status: 'success' });
  return { allowed: true };
} else {
  ledger.emit(createBlockedReceipt(...));
  return { allowed: false };
}
```

---

## The Completion Gate

**The key innovation:** Completion gates query the **ledger**, not the chat transcript.

**Before (without ledger):**
```
Agent: "Done! The button is fixed now."
System: [Parses chat, looks for "done" keyword]
Result: ✅ Allowed (even if no actual verification happened)
```

**After (with ledger):**
```
Agent: "Done! The button is fixed now."
System: [Queries ledger for task receipts]
        - has_tool_calls? NO
        - has_screenshot? NO
        - has_visual_verification? NO
Result: ❌ Blocked - "Cannot claim 'done' without evidence"
```

---

## Multi-Agent Coordination

The receipt ledger enables agents to coordinate without trusting prose:

```
┌─────────────────┐         ┌─────────────────┐
│ browser-debugger│         │   ui-verifier   │
│                 │         │                 │
│ 1. Opens page   │         │ 4. Reads        │
│ 2. Captures     │         │    receipts     │
│    screenshot   │───┐     │ 5. Verifies     │
│ 3. Emits receipt│   │     │    flow         │
└─────────────────┘   │     │ 6. Emits        │
                      │     │    receipt      │
                      ▼     └─────────────────┘
              ┌─────────────────┐
              │ Receipt Ledger  │
              │ (shared truth)  │
              └─────────────────┘
```

**Agent B doesn't read Agent A's summary.**
**Agent B queries Agent A's receipts.**

---

## Why This Is Stronger Than Anthropic

Anthropic has:
- commands
- subagents
- MCP servers
- hooks

Allternit now has:
- commands
- agents
- MCP servers
- hooks
- **receipt ledger** ← NEW

The ledger makes Allternit materially better for:
- **Agent swarms** - Shared truth via receipts
- **UI debugging** - Replayable execution traces
- **Electron/browser/desktop automation** - Full audit trails
- **Completion honesty** - Machine-verifiable evidence
- **Regression detection** - Diff receipts between tasks

---

## Installation

```bash
# 1. Copy pack to project
cp -r allternit-complete-pack/.allternit /your-project/
cp -r allternit-complete-pack/runtime /your-project/

# 2. Install MCP servers
npm install -g @allternit/browser-mcp @allternit/verify-mcp @allternit/evidence-mcp

# 3. Activate on session start
import { activate } from './runtime/mcp-loader.js';
import { ReceiptLedger } from './runtime/receipt-ledger.js';
import { HookEngine } from './runtime/hook-engine.js';

const ledger = new ReceiptLedger();
const loader = await activate('.allternit/mcp.json', runtime);
const hooks = new HookEngine('.allternit/settings.json', ledger);
```

---

## Usage Examples

### Debug UI Issue
```
/debug-ui http://localhost:3000/form
```

### Run Verification
```
/verify-ui form-submit --responsive --edge-cases
```

### Query Receipts
```
/show-receipts --task task_123
/show-receipts --verify --task task_123
/show-receipts --replay --task task_123
/show-receipts --diff task_before task_after
```

---

## Acceptance Checklist

| # | Requirement | Status |
|---|-------------|--------|
| 1 | `.allternit/commands/` - 6 commands | ✅ |
| 2 | `.allternit/agents/` - 5 agents | ✅ |
| 3 | `.allternit/mcp.json` - 6 servers | ✅ |
| 4 | `.allternit/settings.json` - hooks + ledger | ✅ |
| 5 | `runtime/receipt-ledger.js` | ✅ |
| 6 | `runtime/mcp-loader.js` | ✅ |
| 7 | `runtime/tool-registry.js` | ✅ |
| 8 | `runtime/agent-router.js` | ✅ |
| 9 | `runtime/hook-engine.js` | ✅ |
| 10 | Canonical MCP tool naming | ✅ |
| 11 | Fail-closed implementations | ✅ |
| 12 | Ledger integration | ✅ |
| 13 | README matches actual contents | ✅ |
| 14 | Hook routing references existing agents | ✅ |

---

## The Rule

**No completion decision may depend on prose when a receipt is available.**

Completion gates evaluate receipts first, summaries second.
