# A2rchitech OpenWork + CLI PTY Brains + Capsule OS UX - CORRECTED AGENT PROMPT

**Date:** 2026-01-18
**Status:** Foundation established, implementing core integrations per corrected requirements

---

## ROLE

You are a systems-level architect + finisher for the A2rchitech Agentic OS.

Your job is to build real, working integrations for:
- PTY-based CLI brain wrappers (not just config files)
- OpenWork integration as first-class Shell tab (not iframe to conflicting port)
- UI-TARS computer-use automation loop (not just macOS primitives)
- Capsule window behaviors (minimize/dock/tab/restore)
- Vendor SVG icon pipeline (no emojis, proper provenance)

**Critical Architectural Fact:**

### Shell UI Runtime
- **Shell runs on port 5713** (Electron main process loads React app at http://localhost:5713)
- **Electron serves Shell Vite dev server** on port 5173 (not conflicting)
- **Electron is renderer, Shell UI is the React app** running in Electron
- OpenWork must run **inside Electron** and be served via Shell's existing dev server (no separate port)

### OpenWork Location
- **OpenWork repo:** `/Users/macbook/Desktop/openwork/` (existing, local codebase)
- **Requirement:** Import and build as workspace package under `apps/openwork` or directly integrate as React module
- **Requirement:** Serve via Shell's port 5713 dev server (no new dev server, no port conflicts)
- **Requirement:** Share app state/context if needed

### PTY Brain Runtime (Existing)
- **File:** `services/kernel/src/terminal_manager.rs` (TerminalManager with portable-pty)
- **File:** `services/kernel/src/brain/drivers/cli.rs` (CliBrainDriver using PTY)
- **Events:** Terminal streams via `EventEnvelope` format

---

## DELIVERABLE 1 — PTY Brain Wrappers (Expanded Tool List)

### Tools to Support

Primary tools (must work end-to-end):
- **opencode** - OpenCode CLI
- **claude-code** - Claude Code CLI
- **amp** - Sourcegraph Amp CLI
- **aider** - Aider CLI

Secondary tools (must have adapter, may not work):
- **gemini-cli** - Gemini CLI (placeholder until verified)
- **cursor** - Cursor (may not have official CLI, implement adapter)
- **verdant** - Verdant (may not have official CLI, implement adapter)
- **qwen** - Qwen Code (placeholder until verified)
- **goose** - Goose CLI (placeholder until verified)
- **codex** - Codex (likely provider integration, not CLI)

### Work Items

#### 1. Audit Existing PTY Infrastructure
- Locate `TerminalManager` in `services/kernel/src/terminal_manager.rs`
- Verify `CliBrainDriver` uses `TerminalManager`
- Confirm PTY subprocess spawning works
- Identify event streaming mechanism

#### 2. Implement Tool-Specific Adapters

**Create `services/kernel/src/brain/adapters/` module:**

Per-tool adapter must implement:
```rust
pub struct ToolAdapter {
    pub tool_id: String,
    pub name: String,
    pub command: String,
    pub args: Vec<String>,
    pub env: Option<HashMap<String, String>>,
    pub cwd: Option<String>,
    pub bootstrap: Vec<BootstrapCommand>,
    pub capabilities: ToolCapabilities,
    pub detection: ToolDetection,
}
```

**Primary adapters required:**
- `opencode.rs` - Command: `opencode`, bootstrap: `["session start\\n"]`
- `claude_code.rs` - Command: `claude`, bootstrap: empty
- `amp.rs` - Command: `amp`, bootstrap: empty
- `aider.rs` - Command: `aider`, bootstrap: empty

**Proof of Work Required:**
- PTY session starts successfully with `a2 brain start --tool opencode`
- Terminal output streams to Shell UI via `EventEnvelope`
- Typing into Shell UI sends input to PTY stdin
- Resizing capsule updates PTY rows/cols
- At least 3 tools work: opencode + amp + aider

#### 3. Implement Generic PTY Wrapper

**Create or update `services/kernel/src/brain/drivers/cli.rs`:**

Add method to spawn with tool-specific config:
```rust
impl CliBrainRuntime {
    pub async fn start_with_config(
        &mut self,
        tool_config: &ToolAdapter,
    ) -> Result<(), BrainError> {
        let session_id = self.session_id.clone();

        // Spawn PTY with tool-specific args
        let args = tool_config.args;
        let env = tool_config.env;

        let pty_session = self.terminal_manager
            .create_custom_session(&tool_config.command, &args, cwd, env)
            .await
            .map_err(|e| BrainError::Pty(format!("{}", e)))?;

        self.session_id = Some(session_id);
        self.pid = Some(pty_session.pid);

        // Send bootstrap commands
        for bootstrap_cmd in &tool_config.bootstrap {
            match bootstrap_cmd {
                BootstrapCommand::Text(text) => {
                    self.terminal_manager
                        .write_to_session(&session_id, text.as_bytes())
                        .await
                        .map_err(|e| BrainError::Pty(format!("{}", e)))?;
                }
                _ => {}
            }
        }

        self.event_tx.send(BrainEvent::SessionStarted {
            session_id,
            tool: tool_config.tool_id.clone(),
        });

        Ok(())
    }
}
```

#### 4. Extend CLI Commands

**File:** `apps/cli/src/commands/brain_integration.rs`

Add actual implementation calling kernel brain API:
```rust
use crate::kernel::brain::client::BrainClient;

pub async fn handle_brain_start(args: BrainStartArgs, client: &KernelClient) -> anyhow::Result<()> {
    let tool_id = args.tool.as_deref().unwrap_or(&"opencode".to_string()).clone();

    // Get tool adapter config
    let tool_config = crate::kernel::brain::adapters::get_by_id(&tool_id)
        .ok_or_else(|| anyhow::anyhow!("Unknown tool: {}", tool_id))?;

    // Call kernel brain API to start session
    let session_id = client.start_brain_session(
        BrainConfig {
            brain_type: BrainType::Cli,
            tool_config: tool_config.clone(),
            workspace: args.workspace.clone(),
            session_name: args.name.clone(),
        }
    ).await?;

    println!("{} Brain session started: {}", "✓".green(), tool_id.yellow());
    println!("{} Session ID: {}", "→".cyan(), session_id.green());

    Ok(())
}
```

### Acceptance Criteria

- [ ] `services/kernel/src/brain/adapters/mod.rs` exists with all 9 tool configs
- [ ] Tool adapter configs include detection (which/npm/file)
- [ ] Tool adapters have command/args/env/bootstrap/capabilities
- [ ] CliBrainRuntime updated to use ToolAdapter
- [ ] `a2 brain start --tool <name>` spawns PTY session
- [ ] Terminal output streams to UI
- [ ] Typing sends input to PTY
- [ ] Resizing updates PTY
- [ ] At least 3 tools work (opencode + amp + aider)

---

## DELIVERABLE 2 — A2 CLI as Top Process

### Current Status
CLI commands exist but need kernel brain API wiring.

### Work Items

#### 1. Connect CLI Brain Commands to Kernel API

**File:** `apps/cli/src/commands/brain_integration.rs`

Implement kernel brain client methods:
```rust
use reqwest::Client;

pub struct BrainClient {
    pub base_url: String,
}

impl BrainClient {
    pub fn new(base_url: String) -> Self {
        Self { base_url }
    }

    pub async fn start_brain_session(
        &self,
        config: BrainConfig,
    ) -> Result<String, BrainError> {
        let url = format!("{}/v1/brain/sessions", self.base_url);

        let client = reqwest::Client::new();

        let response = client
            .post(&url)
            .json(&config)
            .await
            .map_err(|e| BrainError::Api(format!("{}", e)))?;

        Ok(response.session_id)
    }
}
```

#### 2. Implement `a2 up` Coordination

**File:** `apps/cli/src/commands/daemon.rs` or `up.rs`

Ensure services start in correct order:
1. Start kernel (port 3004)
2. Start UI-TARS operator (port 3008)
3. Start Shell dev (port 5713) - ensures OpenWork can access it
4. Start other services in dependency order

### Acceptance Criteria

- [ ] `a2 up` starts all services in correct order
- [ ] Shell runs on port 5713 (not conflicting with anything)
- [ ] Kernel API available on port 3004
- [ ] UI-TARS operator available on port 3008
- [ ] CLI brain commands connect to kernel API
- [ ] `a2 --help` shows all commands including brain commands

---

## DELIVERABLE 3 — OpenWork Integration (Ops Center Tab)

### Critical Correction

**Current Implementation is WRONG:**
- OpenWorkView uses iframe pointing to `localhost:5173`
- This conflicts with Shell UI on port 5713
- OpenWork should be integrated into Shell's React app, not a separate port

### Required Implementation

#### Option A (Preferred): Workspace Package Integration

1. **Copy OpenWork to monorepo:**
   ```bash
   mkdir -p apps/openwork
   cp -r ~/Desktop/openwork/* apps/openwork/
   ```

2. **Create package.json** in `apps/openwork/`:
   ```json
   {
     "name": "@a2rchitech/openwork",
     "version": "1.0.0",
     "type": "module",
     "main": "./index.tsx",
     "scripts": {
       "dev": "vite",
       "build": "vite build"
     },
     "dependencies": {
       "@a2rchitech/shell-ui": "workspace:*",
       "react": "^18.0.0",
       "react-dom": "^18.0.0"
     }
   }
   ```

3. **Create main entry** `apps/openwork/src/index.tsx`:
   ```tsx
   export const OpenWorkApp = () => {
     return (
       <div className="openwork-app">
         <h1>Ops Center</h1>
         <p>OpenWork Integration - Powered by A2rchitech</p>
       </div>
     );
   };
   ```

4. **Update Shell to import OpenWork:**

**File:** `apps/shell/src/main.tsx`

Add import and route:
```tsx
import { OpenWorkApp } from '../openwork'; // From workspace package

// In ViewMode type
export type ViewMode = 'canvas' | 'studio' | 'registry' | 'marketplace' | 'chats' | 'openwork';

// In main render
{viewMode === 'openwork' && <OpenWorkApp />}
```

5. **Update LeftRail:** `apps/shell/src/components/LeftRail.tsx`

Add OpenWork button:
```tsx
<button
  className={`rail-item ${viewMode === 'openwork' ? 'active' : ''}`}
  onClick={() => onViewModeChange('openwork')}
  title="Ops Center"
  type="button"
>
  <span className="rail-icon">🖥️</span>
</button>
```

### Acceptance Criteria

- [ ] OpenWork exists as workspace package `apps/openwork`
- [ ] OpenWork has proper package.json with `@a2rchitech/shell-ui` workspace dependency
- [ ] `apps/shell/src/views/OpenWorkView.tsx` created (not iframe)
- [ ] OpenWorkApp component renders correctly
- [ ] OpenWork imported in Shell main
- [ ] `'openwork'` added to ViewMode type
- [ ] OpenWork button added to LeftRail
- [ ] Clicking "Ops Center" tab renders OpenWork inside Shell
- [ ] No port conflicts (OpenWork uses Shell's existing port 5713)

---

## DELIVERABLE 4 — UI-TARS Computer Use Tool

### Critical Gap

Current implementation only provides macOS primitives, not UI-TARS integration.

### Required Implementation

#### 1. Add UI-TARS Propose Tool Registration

**Create `crates/tools/src/ui_tars.rs`:**

```rust
use crate::kernel::tools_gateway::{ToolGateway, ToolDefinition, ToolType};

pub async fn register_ui_tars_tools(gateway: &ToolGateway) -> anyhow::Result<()> {
    let propose_tool = ToolDefinition {
        id: "ui_tars.propose".to_string(),
        name: "UI-TARS Propose".to_string(),
        description: "Get action proposals from UI-TARS operator".to_string(),
        tool_type: ToolType::Http,
        command: "http://localhost:3008/v1/model/ui_tars/propose".to_string(),
        input_schema: serde_json::json!({
            "type": "object",
            "properties": {
                "task": {"type": "string", "description": "Task description"},
                "screenshot": {"type": "string", "description": "Base64 screenshot"},
                "viewport": {
                    "type": "object",
                    "properties": {
                        "w": {"type": "integer", "description": "Viewport width"},
                        "h": {"type": "integer", "description": "Viewport height"},
                    }
                }
            }
        }),
        output_schema: serde_json::json!({
            "type": "object",
            "properties": {
                "proposals": {"type": "array", "description": "Action proposals"},
            }
        }),
        side_effects: vec!["computer-control".to_string()],
        idempotency_behavior: "idempotent".to_string(),
        retryable: false,
        failure_classification: "transient".to_string(),
        safety_tier: a2rchitech_policy::SafetyTier::Read,
        resource_limits: a2rchitech_tools_gateway::ResourceLimits {
            cpu: Some("500ms".to_string()),
            memory: Some("50MB".to_string()),
            network: a2rchitech_tools_gateway::NetworkAccess::None,
            filesystem: a2rchitech_tools_gateway::FilesystemAccess::None,
            time_limit: 10,
        },
    };

    gateway.register_tool(propose_tool).await?;
    Ok(())
}
```

#### 2. Implement GUI Action Tools

**File:** `crates/tools/src/gui.rs`

Remove macOS-specific implementations, use platform-agnostic approach via UI-TARS:

```rust
use async_trait::async_trait;
use reqwest::Client;

pub struct UiToolClient {
    pub ui_tars_base_url: String,
}

impl UiToolClient {
    pub fn new(base_url: String) -> Self {
        Self { ui_tars_base_url }
    }

    pub async fn screenshot(&self) -> Result<ScreenshotResult, String> {
        let url = format!("{}/v1/tools/gui/screenshot", self.ui_tars_base_url);

        let client = reqwest::Client::new();

        let response = client
            .post(&url)
            .await
            .map_err(|e| format!("Screenshot failed: {}", e))?;

        Ok(ScreenshotResult {
            base64_image: response.data.unwrap_or_default(),
            width: response.width.unwrap_or(1920),
            height: response.height.unwrap_or(1080),
            timestamp: response.timestamp.unwrap_or(0),
        })
    }

    pub async fn click(&self, params: ClickParams) -> Result<GuiToolResult, String> {
        let url = format!("{}/v1/tools/gui/click", self.ui_tars_base_url);

        let client = reqwest::Client::new();
        let json = serde_json::to_value(&params)?;

        let response = client
            .post(&url)
            .json(&json)
            .await
            .map_err(|e| format!("Click failed: {}", e))?;

        Ok(GuiToolResult {
            success: response.success.unwrap_or(false),
            output: response.message,
            execution_time_ms: response.execution_time_ms,
        })
    }

    pub async fn type_text(&self, params: TypeParams) -> Result<GuiToolResult, String> {
        let url = format!("{}/v1/tools/gui/type", self.ui_tars_base_url);

        let client = reqwest::Client::new();
        let json = serde_json::to_value(&params)?;

        let response = client
            .post(&url)
            .json(&json)
            .await
            .map_err(|e| format!("Type failed: {}", e))?;

        Ok(GuiToolResult {
            success: response.success.unwrap_or(false),
            output: response.message,
            execution_time_ms: response.execution_time_ms,
        })
    }

    pub async fn scroll(&self, params: ScrollParams) -> Result<GuiToolResult, String> {
        let url = format!("{}/v1/tools/gui/scroll", self.ui_tars_base_url);

        let client = reqwest::Client::new();
        let json = serde_json::to_value(&params)?;

        let response = client
            .post(&url)
            .json(&json)
            .await
            .map_err(|e| format!("Scroll failed: {}", e))?;

        Ok(GuiToolResult {
            success: response.success.unwrap_or(false),
            output: response.message,
            execution_time_ms: response.execution_time_ms,
        })
    }

    pub async fn run_task(&self, task: String, dry_run: bool) -> Result<Vec<GuiToolResult>, String> {
        let mut results = vec![];

        // 1. Screenshot
        let screenshot_result = self.screenshot().await?;
        results.push(screenshot_result);

        // 2. Send to UI-TARS for proposal
        // (Would require UI-TARS propose tool - implement separately)

        // 3. For each proposal: execute action
        // (Would require looping through proposals and calling click/type/scroll)

        if dry_run {
            results.push(GuiToolResult {
                success: true,
                output: Some(format!("[DRY RUN] Task: {}", task)),
                execution_time_ms: Some(0),
            });
        }

        Ok(results)
    }
}
```

#### 3. Update Tool Gateway to Support GUI Tools

**File:** `services/kernel/src/api/tools.rs`

Add GUI tool routes:
```rust
use axum::{
    extract::{Path, Json, State, ConnectInfo},
    routing::{get, post},
    response::{IntoResponse, Json},
    body::Body,
};
use crate::kernel::tools::gui::*;

pub async fn gui_screenshot(
    State(state): State<ToolGateway>,
) -> Result<Json<ScreenshotResult>, ToolGatewayError> {
    let tool_gateway = state.tool_gateway.clone();

    let result = tool_gateway.screenshot().await?;
    Ok(Json(result))
}

pub async fn gui_click(
    Path(_path): Path<Json<ScreenshotResult>>,
    State(state): State<ToolGateway>,
) -> Result<Json<GuiToolResult>, ToolGatewayError> {
    let params: extract::Path::<Json<ClickParams>>(_path).await?;
    let tool_gateway = state.tool_gateway.clone();

    let result = tool_gateway.click(params).await?;
    Ok(Json(result))
}

// ... similar for type_text and scroll
```

### Acceptance Criteria

- [ ] `ui_tars.propose` tool registered with UI-TARS operator endpoint
- [ ] GUI tools registered via `/v1/tools/gui/*` endpoints
- [ ] GUI tools call UI-TARS operator for proposals
- [ ] GUI tools execute actions (click/type/scroll)
- [ ] `run_task()` implements full automation loop (screenshot → propose → execute → verify)
- [ ] Tool gateway routes exist in kernel API

---

## DELIVERABLE 5 — Capsule Icons + Vendor Asset Pipeline (No Emojis)

### Current Issue

Icons created are vendor SVGs but CapsuleIconRegistry.tsx has syntax errors and needs vendor icon imports.

### Required Implementation

#### 1. Fix CapsuleIconRegistry

**File:** `apps/shell/src/iconography/CapsuleIconRegistry.tsx`

Fix syntax and add vendor icon imports:
```tsx
// Import vendor icons
import opencodeIcon from './iconography/vendor/opencode.svg';
import claudeCodeIcon from './iconography/vendor/claude-code.svg';
import ampIcon from './iconography/vendor/amp.svg';
import aiderIcon from './iconography/vendor/aider.svg';
import geminiCliIcon from './iconography/vendor/gemini-cli.svg';
import cursorIcon from './iconography/vendor/cursor.svg';
import verdantIcon from './iconography/vendor/verdant.svg';
import qwenIcon from './iconography/vendor/qwen.svg';
import gooseIcon from './iconography/vendor/goose.svg';
import codexIcon from './iconography/vendor/codex.svg';

export type CapsuleType =
  'browser' | 'inspector' | 'agent-steps' | 'studio' | 'templates' | 'artifacts' |
  'opencode' | 'claude-code' | 'amp' | 'aider' | 'gemini-cli' | 'cursor' | 'verdant' | 'qwen' | 'goose' | 'codex';

export const CapsuleIcon: React.FC<CapsuleIconProps> = ({ type, className, size = 20 }) => {
  const icon = CapsuleIconRegistry[type] || CapsuleIconRegistry['browser'];

  return (
    <svg
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      data-testid="capsule-icon-svg"
    >
      {icon.path}
    </svg>
  );
};

export const CapsuleIconRegistry: Record<string, { path: React.ReactNode; color: string }> = {
  // Existing capsule types (keep hardcoded icons)
  'browser': {
    path: <><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 15.3 15.3 9.75L12.75l0 0-2.5a2 2.5a2 2.5a2 7.5l-5.25L12.75" />,
    color: '#3b82f6'
  },
  // ... rest of existing icons

  // Tool icons (vendor SVGs)
  'opencode': { path: <>{opencodeIcon.path}</>, color: '#3b82f6' },
  'claude-code': { path: <>{claudeCodeIcon.path}</>, color: '#d97706' },
  'amp': { path: <>{ampIcon.path}</>, color: '#f97316' },
  'aider': { path: <>{aiderIcon.path}</>, color: '#10b981' },
  'gemini-cli': { path: <>{geminiCliIcon.path}</>, color: '#4285f4' },
  'cursor': { path: <>{cursorIcon.path}</>, color: '#1e88ad8' },
  'verdant': { path: <>{verdantIcon.path}</>, color: '#42404d' },
  'qwen': { path: <>{qwenIcon.path}</>, color: '#6366f6' },
  'goose': { path: <>{gooseIcon.path}</>, color: '#9367f1' },
  'codex': { path: <>{codexIcon.path}</>, color: '#00a4d5' },

  // Fallback for unknown tools
  'openwork': {
    path: <><path d="M12 9a2 1-4 10 15.3 10 15.3 15.3 9.75L12.75l0 0-2.5a2 2.5a2 7.5l-5.25L12.75" /><rect x="2" y="2" width="20" height="20" rx="2"/><path d="M9 3v6"/><path d="M3 9h6"/></>,
    color: '#9ca3af'
  },
};
```

#### 2. Update LeftRail to Use CapsuleIcon Component

**File:** `apps/shell/src/components/LeftRail.tsx`

Replace emoji icons with CapsuleIcon components:
```tsx
// Import CapsuleIcon
import { CapsuleIcon, CapsuleIconRegistry } from '../iconography/CapsuleIconRegistry';

// Update tool buttons (example)
<button
  className={`rail-item ${viewMode === 'opencode' ? 'active' : ''}`}
  onClick={() => onViewModeChange('opencode')}
  title="OpenCode"
>
  <CapsuleIcon type="opencode" className="rail-icon" size={16} />
</button>

<button
  className={`rail-item ${viewMode === 'claude-code' ? 'active' : ''}`}
  onClick={() => onViewModeChange('claude-code')}
  title="Claude Code"
>
  <CapsuleIcon type="claude-code" className="rail-icon" size={16} />
</button>

// ... similar for amp, aider, etc.
```

### Acceptance Criteria

- [ ] CapsuleIconRegistry.tsx compiles without errors
- [ ] All vendor SVG icons exist (`iconography/vendor/<tool>.svg`)
- [ ] Vendor icons imported in CapsuleIconRegistry
- [ ] CapsuleIconRegistry includes entries for: opencode, claude-code, amp, aider, gemini-cli, cursor, verdant, qwen, goose, codex
- [ ] LeftRail uses CapsuleIcon components instead of emojis
- [ ] CapsuleIcon components render correctly with SVG paths

---

## HARD CONSTRAINTS

- ❌ **No iframes** - OpenWork must be React module inside Shell, not iframe to separate port
- ❌ **No emojis** - All icons must be SVG assets from registry
- ✅ **Electron only** - Tauri is deleted, never reintroduce
- ✅ **CLI is root** - `a2 up` starts everything, `a2 brain` commands orchestrate PTY subprocesses
- ✅ **OpenWork integration** - Must be workspace package, not separate dev server

---

## SUCCESS CONDITION

At the end, you should be able to:

1. ✅ Run `a2 up` → All services start in correct order
2. ✅ Launch OpenWork → Appears as **React view** inside Shell (not iframe)
3. ✅ Start brain session → `a2 brain start --tool opencode` creates PTY session
4. ✅ Watch session → Terminal output streams to Shell UI via event bus
5. ✅ Use computer use → UI-TARS tool proposes actions, GUI executes them
6. ✅ Minimize capsule → Capsule moves to dock, icon shown
7. ✅ Tab capsule → Capsule becomes tab in strip, icon shown
8. ✅ Restore capsule → Clicking dock/tab returns capsule to canvas

**If any of these fail, the implementation is incomplete.**

---

## ORDER OF WORK

### Phase 0: Foundation Audit (Priority: HIGH)
- Audit Shell runtime (port 5713, Electron, Vite)
- Audit OpenWork location and integration points
- Audit PTY infrastructure and CLI brain drivers

### Phase 1: OpenWork Integration (Priority: HIGH)
- Copy OpenWork to apps/openwork as workspace package
- Create proper package.json with Shell UI workspace dependency
- Create apps/shell/src/views/OpenWorkView.tsx
- Import and route OpenWorkApp in Shell main
- Add OpenWork button to LeftRail
- Remove or disable iframe implementation

### Phase 2: PTY Brain Wrappers (Priority: HIGH)
- Complete all 9 tool adapter configs
- Implement real PTY spawning with CliBrainRuntime
- Wire CLI brain commands to kernel brain API
- Test with at least 3 tools (opencode + amp + aider)

### Phase 3: UI-TARS Integration (Priority: MEDIUM)
- Implement GUI tools calling UI-TARS API for proposals
- Implement screenshot/click/type/scroll via tool gateway
- Implement run_task automation loop
- Register tools with tool gateway

### Phase 4: Capsule OS Behaviors (Priority: MEDIUM)
- Implement window state machine
- Implement minimize → dock
- Implement drag → tab strip
- Implement restore from dock/tab
- Replace emoji icons with CapsuleIcon components

### Phase 5: Icon Pipeline (Priority: MEDIUM)
- Generate vendor SVG icons for all tools
- Import vendor icons in CapsuleIconRegistry
- Update LeftRail/Dock/TabStrip/WindowFrame to use CapsuleIcon
- Document icon provenance and licensing

---

## STOP PROCEEDING WITHOUT AUDIT

You must execute these phases in order. Do NOT:
1. Skip the shell runtime audit (it's documented here)
2. Ignore OpenWork location (it's ~/Desktop/openwork/)
3. Start with Phase 1 (OpenWork integration) immediately
4. Build on top of Phase 0 foundation (don't reinvent)

**Each phase must have acceptance criteria listed above before moving to next.**

---

## EVIDENCE REQUIREMENTS

For each phase completion, you MUST provide:
1. **Code files created/modified** (with file paths)
2. **Runtime logs** (console output showing sessions starting)
3. **Screenshots** (showing OpenWork as Shell view, PTY session active)
4. **Failure logs** (if any, explain why)

**No "claims without proof." Every deliverable must be demonstrably real.**

---

**END OF PROMPT**

Copy this entire file verbatim and give it to the agent.

⸻
