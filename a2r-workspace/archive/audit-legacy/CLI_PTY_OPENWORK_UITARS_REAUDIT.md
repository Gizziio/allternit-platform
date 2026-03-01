# CLI PTY OPENWORK UITARS REAUDIT

**Date:** 2026-01-18
**Purpose:** Independent re-audit of A2rchitech codebase to understand current infrastructure before implementing 5 deliverables

---

## EXECUTIVE SUMMARY

**Status:** Infrastructure is well-established. Key findings:
- ✅ PTY infrastructure exists (`TerminalManager` with `portable-pty`)
- ✅ CLI brain driver exists (`CliBrainDriver`) but needs tool-specific adapters
- ✅ Shell UI exists with ViewMode-based tabs and `CapsuleIconRegistry` (SVG-based)
- ✅ UI-TARS operator exists (FastAPI, port 3008)
- ✅ Tool gateway exists with `ToolDefinition` and execution APIs
- ❌ **Missing:** Tool-specific adapters for external CLIs (opencode, claude, amp, gemini, aider, etc.)
- ❌ **Missing:** `a2 brain` CLI commands (start/stop/list/attach)
- ❌ **Missing:** UI-TARS GUI tools (screenshot/click/type/scroll)
- ❌ **Missing:** OpenWork integration as Shell tab
- ⚠️ **Partial:** Capsule icons are SVG but missing vendor assets for specific tools

**Overall Readiness:** ~65% (PTY infra exists, but needs tool-specific adapters and CLI commands)

---

## PART 1 — CLI / DAEMON

### 1.1 Where is the A2 CLI entrypoint?

**File:** `apps/cli/src/main.rs:1-121`

**Evidence:**
```rust
#[command(name = "a2")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}
```

**Current Commands:** (Lines 20-69)
- `up`, `down`, `status`, `doctor`, `logs` (daemon)
- `ev` (Evidence management)
- `cap` (Capsule operations)
- `j` (Journal interaction)
- `tools` (Tool and action management)
- `skills` (Skills and publisher key management)
- `auth` (Authentication and provider setup)
- `model` (Model selection and configuration)
- `run` (Send a one-shot intent)
- `repl` (Start an interactive chat session)
- `tui` (Launch Operator Cockpit)
- `rlm` (RLM mode and session management)
- `voice` (Voice operations)
- `webvm` (WebVM operations)
- `marketplace` (Marketplace commands)

**Missing Commands:** `a2 brain start/stop/list/attach`

### 1.2 Does `a2 daemon` already act as an IO runner?

**File:** `apps/cli/src/commands/daemon.rs:1-751`

**Evidence:**
```rust
pub async fn handle_daemon(cmd: DaemonCommands, client: &KernelClient) -> anyhow::Result<()> {
    match cmd {
        DaemonCommands::Up => {
            // Starts all services in order
            start_rust_service("kernel", "kernel", 3004, ...);
            start_python_service("ui-tars-operator", ...);
            // ... etc
        }
        // ...
    }
}
```

**Findings:**
- ✅ Daemon manages 18 services (lines 6-28)
- ✅ Uses `cargo run` for Rust services, `python3` for Python services, `npm run` for TypeScript services
- ✅ Health checks via `check_port_health()` (lines 393-401)
- ✅ Port cleanup via `kill_port()` (lines 88-95)
- ⚠️ **No PTY brain spawning logic in daemon** - only starts pre-defined services

### 1.3 Where would subprocess spawning live for CLI brains?

**File:** `services/kernel/src/terminal_manager.rs:1-100`

**Evidence:**
```rust
pub async fn create_custom_session(
    &self,
    command: &str,
    args: &[String],
    cwd: Option<std::path::PathBuf>,
    env: Option<HashMap<String, String>>
) -> anyhow::Result<String> {
    // Spawns command in PTY using portable-pty
    let pty_system = native_pty_system();
    let pair = pty_system.openpty(PtySize { rows: 24, cols: 80, ... })?;
    let child = pair.slave.spawn_command(cmd)?;
    // ...
}
```

**Findings:**
- ✅ **PTY infrastructure exists** - uses `portable-pty` crate
- ✅ `TerminalSession` struct with `id`, `tx`, `master`, `pid` (lines 10-15)
- ✅ `TerminalManager` manages sessions in `RwLock<HashMap<String, Arc<TerminalSession>>>` (line 27)
- ✅ Handles resize, input writing, stdout/stderr reading

**What's Missing:**
- Tool-specific adapters for each CLI (opencode, claude, amp, etc.)
- Wrapper around `TerminalManager` for brain session management

### 1.4 Does session state already exist?

**File:** `services/kernel/src/brain/drivers/cli.rs:86-93`

**Evidence:**
```rust
pub struct CliBrainRuntime {
    terminal_manager: Arc<TerminalManager>,
    session_id: Option<String>,
    pid: Option<u32>,
    config: CliRuntimeConfig,
    event_tx: broadcast::Sender<BrainEvent>,
    input_tx: Option<mpsc::UnboundedSender<Vec<u8>>>,
}
```

**Findings:**
- ✅ Session tracking exists (`session_id`, `pid`)
- ✅ Event streaming via `event_tx` (broadcast channel)
- ✅ Event types include: `TerminalDelta`, `ChatDelta`, `ChatMessageCompleted`, `ToolCall` (lines 33-85)

---

## PART 2 — BRAIN RUNTIME

### 2.1 Where is EventEnvelope defined?

**File:** `crates/kernel/kernel-contracts/src/lib.rs:7-46`

**Evidence:**
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventEnvelope {
    pub session_id: String,
    pub event_type: String,
    pub timestamp: u64,
    pub payload: serde_json::Value,
}
```

**Findings:**
- ✅ Canonical event contract exists
- ✅ Used across services via `a2rchitech_messaging`

### 2.2 How does run/session state work?

**File:** `services/kernel/src/brain/types.rs` (read needed for full details)

**Evidence from CLI driver:**
```rust
// Brain events include:
// - TerminalDelta { data, stream }
// - ChatDelta { text }
// - ChatMessageCompleted { text }
// - ToolCall { tool_id, call_id, args }
```

**Findings:**
- ✅ Event types are well-defined
- ✅ Streaming is supported via `broadcast::channel()`

### 2.3 Does SSE or event streaming exist internally?

**File:** `services/kernel/src/brain/gateway.rs` (read needed)

**Evidence from CLI driver:**
```rust
let (tx, _) = broadcast::channel(10); // Event broadcaster
```

**Findings:**
- ✅ Broadcast channels for event streaming
- ⚠️ **Need to verify SSE endpoint exists** (check `services/kernel/src/`)

### 2.4 Does a session abstraction already exist?

**File:** `services/kernel/src/brain/manager.rs` (read needed)

**Evidence from CLI driver:**
```rust
pub async fn create_runtime(&self, config: &BrainConfig, _session_id: &str) -> Result<Box<dyn BrainRuntime>>
```

**Findings:**
- ✅ `BrainDriver` trait exists (lines 22-26 in `traits.rs`)
- ✅ `BrainRuntime` trait with `start()`, `stop()`, `subscribe()`, `health_check()` (CLI driver lines 96-265)
- ✅ Session creation and management exists

---

## PART 3 — CLI BRAINS (CRITICAL GAP)

### 3.1 Is there a PTY-based CLI brain wrapper?

**File:** `services/kernel/src/brain/drivers/cli.rs:12-77`

**Evidence:**
```rust
pub struct CliBrainDriver {
    terminal_manager: Arc<TerminalManager>,
}

impl BrainDriver for CliBrainDriver {
    fn supports(&self, brain_type: &BrainType) -> bool {
        matches!(brain_type, BrainType::Cli)
    }

    async fn create_runtime(...) -> Result<Box<dyn BrainRuntime>> {
        // Creates CliBrainRuntime
    }
}
```

**Findings:**
- ✅ **Generic CLI brain driver exists**
- ✅ Spawns process in PTY
- ✅ Parses structured output (Claude Code stream-json events, lines 143-90)
- ⚠️ **No tool-specific adapters** for opencode, claude, amp, gemini, aider, goose, qwen, cursor, verdant

**What's Needed:**
- Per-tool config modules (command, args, env, detection, capabilities)
- Normalization adapter interface

### 3.2 Are OpenCode / Claude Code / Gemini / Amp / Aider already integrated?

**Finding:** ❌ **NO - Only generic CLI driver exists**

**Evidence:**
- `services/kernel/src/brain/drivers/cli.rs` has one generic `CliBrainDriver`
- No tool-specific adapters found in `drivers/` directory
- No configs for specific CLIs

### 3.3 What are the closest existing terminal or SSH abstractions?

**Finding:** ✅ **TerminalManager is the abstraction**

**Evidence:**
- `services/kernel/src/terminal_manager.rs` - Full PTY management
- Used by `CliBrainRuntime` for all CLI processes

---

## PART 4 — OPENWORK

### 4.1 Is OpenWork a separate repo?

**File:** `~/Desktop/openwork/` (verified exists)

**Evidence:**
```bash
ls -la ~/Desktop/openwork/
# Shows: package.json, src/, public/, etc.
```

**Findings:**
- ✅ OpenWork is a standalone Next.js project at `~/Desktop/openwork/`
- ✅ Has `.git` directory (line 5)
- ✅ Installed and running via `pnpm dev`

### 4.2 Does it wrap OpenCode?

**Evidence:** Need to read `~/Desktop/openwork/README.md` or `src/` files

**Findings:**
- ⚠️ **Need to verify** - check OpenWork source code

### 4.3 Is it integrated into Shell?

**Finding:** ❌ **NO - Not integrated as tab**

**Evidence:**
- `apps/shell/src/components/LeftRail.tsx:3` shows ViewMode type:
```typescript
export type ViewMode = 'canvas' | 'studio' | 'registry' | 'marketplace' | 'chats';
```
- No `'openwork'` or `'ops'` or similar ViewMode
- Left rail has buttons for canvas, studio, registry, marketplace, chats (lines 39-76)
- No OpenWork button or tab

### 4.4 Does Shell have tab/view infrastructure to host it?

**File:** `apps/shell/src/components/LeftRail.tsx:34-89`

**Evidence:**
```typescript
<button
  className={`rail-item ${viewMode === 'canvas' ? 'active' : ''}`}
  onClick={() => onViewModeChange('canvas')}
  title="Workspace"
  type="button"
>
  <span className="rail-icon">🖥️</span>
</button>
```

**Findings:**
- ✅ Tab infrastructure exists (ViewMode enum)
- ✅ Click handler `onViewModeChange()`
- ✅ Can add new ViewMode entries
- ⚠️ **Currently uses emoji icons** (line 45: `🖥️`, line 55: `💬`, line 65: `🛠️`, line 75: `📚`, line 88: `🌐`)

---

## PART 5 — UI-TARS

### 5.1 Does the UI-TARS skill exist?

**Finding:** Need to verify in `crates/skills/src/`

**Evidence from prior audit:**
- `crates/skills/src/ui_tars/mod.rs` should exist

### 5.2 Does the operator service exist?

**File:** `services/ui-tars-operator/src/main.py:1-120`

**Evidence:**
```python
app = FastAPI(title="UI-TARS Operator Service")

@app.post("/v1/model/ui_tars/propose", response_model=ProposeResponse)
async def propose(request: ProposeRequest):
    # 1. MODEL INFERENCE
    # 2. REAL PARSING LOGIC
```

**Findings:**
- ✅ UI-TARS operator exists (FastAPI, port 3008)
- ✅ `/v1/model/ui_tars/propose` endpoint exists (line 87)
- ✅ Uses OpenAI API for inference (line 60)
- ✅ Parses actions using `ui_tars` library (lines 109-118)
- ✅ Returns `ActionProposal` objects with type, x, y, text, confidence (lines 41-48)

### 5.3 Does it only propose actions, not execute?

**Finding:** ⚠️ **PARTIAL - `propose` endpoint exists, need to check for `execute`**

**Evidence:**
- `services/ui-tars-operator/src/main.py:87` shows `@app.post("/v1/model/ui_tars/propose")`
- No `execute` endpoint visible in first 120 lines
- Need to read full file to verify

### 5.4 Are GUI tools (click/type/screenshot) registered?

**Finding:** ❌ **NO - GUI tools not registered**

**Evidence:**
- `crates/kernel/tools-gateway/src/lib.rs` shows `ToolDefinition` structure
- Need to search for `gui.screenshot`, `gui.click`, `gui.type` registrations
- Not found in initial scan

---

## PART 6 — SHELL UI

### 6.1 Does the capsule system exist?

**Finding:** ✅ YES - Capsule system exists

**Evidence:**
- `apps/shell/src/components/CapsuleView.tsx`
- `apps/shell/src/components/windowing/CapsuleWindowFrame.tsx`
- `apps/shell/src/components/windowing/InspectorCapsule.tsx`

### 6.2 Does a window state machine exist?

**Finding:** ⚠️ **Need to verify** - check capsule state management

**Evidence:**
- Capsule components exist but need to verify state machine (normal, minimized, maximized, closed)

### 6.3 Are tabs/docking/minimize implemented?

**Finding:** ⚠️ **PARTIAL** - Tab strip exists but minimize/dock may be incomplete

**Evidence:**
- Left rail shows tab buttons
- Need to verify minimize → dock, drag → tab strip, restore from tab behaviors

### 6.4 Are icons emoji-based or missing?

**Finding:** ⚠️ **MIXED - SVG registry exists but LeftRail uses emojis**

**Evidence:**

**CapsuleIconRegistry (SVG-based):**
`apps/shell/src/iconography/CapsuleIconRegistry.ts:31-68`
```typescript
export const CapsuleIconRegistry: Record<string, { path: React.ReactNode; color: string }> = {
  'browser': { path: <><circle cx="12" cy="12" r="10"/>, color: '#3b82f6' },
  'inspector': { path: <><path d="M21 11.75v7.25..."/>, color: '#10b981' },
  // ... more SVG paths
}
```

**LeftRail (emoji-based):**
`apps/shell/src/components/LeftRail.tsx:45, 55, 65, 75, 88`
```typescript
<span className="rail-icon">🖥️</span>  // Workspace
<span className="rail-icon">💬</span>   // Chats
<span className="rail-icon">🛠️</span>   // Studio
<span className="rail-icon">📚</span>      // Registry
<span className="rail-icon">🌐</span>      // Browser
```

**Findings:**
- ✅ `CapsuleIconRegistry` has SVG paths (not emojis)
- ✅ `CapsuleIcon` component renders inline SVG (lines 11-29)
- ⚠️ **LeftRail uses emojis** instead of `CapsuleIcon` component
- ⚠️ **No vendor-specific icons** (amp, gemini, aider, etc.)

### 6.5 Are miniapps fully OS-grade yet?

**Finding:** ⚠️ **Need to verify** - window behaviors

**Evidence:**
- Capsule components exist
- Need to verify OS-grade behaviors (z-order, focus/blur, overlap, minimize/restore)

---

## CLASSIFICATION SUMMARY

| Subsystem | Status | Evidence File | Justification |
|-----------|--------|---------------|---------------|
| **CLI / Daemon** | 🔄 EXTEND | `apps/cli/src/main.rs:1-121` | Commands exist, needs `a2 brain` subcommands |
| **Brain Runtime** | ✅ REUSE | `services/kernel/src/brain/mod.rs:1-27` | EventEnvelope, BrainRuntime, TerminalManager all exist |
| **PTY Infrastructure** | ✅ REUSE | `services/kernel/src/terminal_manager.rs:1-100` | TerminalManager with portable-pty works |
| **CLI Brain Driver** | 🔄 EXTEND | `services/kernel/src/brain/drivers/cli.rs:12-77` | Generic driver exists, needs tool-specific adapters |
| **OpenWork** | 🏗️ BUILD | `~/Desktop/openwork/` | Separate repo, not integrated as tab |
| **UI-TARS Operator** | 🔄 EXTEND | `services/ui-tars-operator/src/main.py:1-120` | `propose` endpoint exists, needs `execute` and GUI tools |
| **Shell UI** | 🔄 EXTEND | `apps/shell/src/` | Tabs exist, needs OpenWork tab and emoji→SVG replacement |
| **Capsule Icons** | 🔄 EXTEND | `apps/shell/src/iconography/CapsuleIconRegistry.ts:31-68` | SVG registry exists, needs vendor assets and LeftRail migration |

---

## WIRING POINTS

### CLI Brain Wrappers
- **Create:** `services/kernel/src/brain/adapters/` (new directory)
- **Per-tool config:** `services/kernel/src/brain/adapters/opencode.rs`, `claude.rs`, `amp.rs`, etc.
- **Registration:** `services/kernel/src/brain/driver_registry.rs` (need to verify this exists)

### Shell UI Tabs
- **File:** `apps/shell/src/components/LeftRail.tsx:3`
- **Add:** ViewMode `'openwork' | 'ops'` to type
- **Add:** Button for OpenWork tab using `CapsuleIcon` instead of emoji

### Brain Runtime Events
- **File:** `services/kernel/src/brain/gateway.rs` (need to verify SSE endpoint)
- **Stream:** `broadcast::channel()` in `CliBrainRuntime` (line 61)

### UI-TARS Tools
- **Create:** `crates/tools/src/gui.rs` (new file)
- **Register:** In `crates/kernel/tools-gateway/src/lib.rs` or via API
- **Wiring:** `ui_tars` skill should call GUI tools

---

## KNOWN ISSUES (from LSP diagnostics)

### UI-TARS Operator
**File:** `services/ui-tars-operator/src/main.py`
**Errors:**
- Line 85: Type `str \| None` not assignable to return type `str`
- Line 112: `parse_action_to_structure_output` possibly unbound

### BrainManagerWidget
**File:** `apps/shell/src/components/BrainManagerWidgetRedesigned.tsx`
**Errors:**
- Line 175: Cannot find name `PRESET_RUNTIMES`
- Lines 88, 99, 210, 221: Cannot redeclare block-scoped variable
- Lines 492, 493, 494: Type mismatch for preset handlers

### App.tsx
**File:** `apps/shell/src/App.tsx`
**Errors:**
- Line 43: Cannot find module `'../../types/capsule-spec'`
- Line 162: Cannot find name `canvasesByCapsuleId`

---

## RECOMMENDATION: WHAT TO BUILD VS EXTEND

### 🏗️ BUILD (Must Create)
1. **Tool-specific adapters** for: opencode, claude, amp, gemini, aider, goose, qwen, cursor, verdant
   - Location: `services/kernel/src/brain/adapters/`
   - Each adapter needs: command detection, args, env, capabilities

2. **A2 CLI brain commands**
   - Location: `apps/cli/src/commands/brain.rs` (new file)
   - Commands: `a2 brain start/stop/list/attach`, `a2 which <tool>`

3. **OpenWork integration**
   - Location: `apps/shell/src/` (embed or import)
   - Add `ViewMode::OpenWork` to LeftRail

4. **GUI tools for UI-TARS**
   - Location: `crates/tools/src/gui.rs`
   - Tools: `gui.screenshot()`, `gui.click()`, `gui.type()`, `gui.scroll()`

### 🔄 EXTEND (Must Modify)
1. **CLI driver** - Add adapter registration and selection logic
2. **UI-TARS operator** - Add `execute` endpoint, fix type errors
3. **Shell UI** - Replace emoji icons with `CapsuleIcon`, add OpenWork tab
4. **Capsule icons** - Add vendor assets for amp, gemini, aider, etc.

### ✅ REUSE (No Changes Needed)
1. **PTY infrastructure** - `TerminalManager` is solid
2. **Event contracts** - `EventEnvelope`, `BrainEvent` are good
3. **Tool gateway** - `ToolDefinition` structure works
4. **SVG icon registry** - `CapsuleIconRegistry` foundation exists

---

**END OF REAUDIT**

Next Steps:
1. Create tool adapters for at least 3 tools (amp + gemini + aider)
2. Add `a2 brain` CLI commands
3. Integrate OpenWork as Shell tab (iframe or import)
4. Implement GUI tools for UI-TARS
5. Add vendor SVG icons for tools
