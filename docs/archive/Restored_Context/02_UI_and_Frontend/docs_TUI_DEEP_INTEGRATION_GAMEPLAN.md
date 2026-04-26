# TUI Deep Integration Gameplan

## Core Philosophy

**"Know What You're Using"** - Every visual element must communicate:
- Which subsystem you're interacting with
- Whether a feature is actually wired (real) vs placeholder (stub)
- Current mode context and available actions

## Visual Architecture: The Four Modes

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Allternit TUI v0.2.0                    MODE: WORK ▓▓▓▓▓▓░░░░  DAG: proj_123     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [Mode indicator shows context: CHAT | WORK | OPS | SYS]                    │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ CONVERSATION                                                        │   │
│  │                                                                     │   │
│  │  User: How do I refactor this?                                     │   │
│  │  Agent: I'll create a plan...                                      │   │
│  │                                                                     │   │
│  │  [System] DAG created: proj_123                                     │   │
│  │  [System] 3 WIHs ready for pickup                                   │   │
│  │                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  > /work pickup node_001     [typing in work mode context]                  │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│ ▓ WORK MODE ▓  │ Agent: main │ Session: sess_789 │ WIH: wih_456 (active)   │
│    [live]      │             │                     │ Lease: /src/*.rs        │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Mode System

| Mode | Color | Header | Purpose | Real APIs |
|------|-------|--------|---------|-----------|
| **CHAT** | Blue | `CHAT MODE` | Talk to agent | ✓ Kernel chat |
| **WORK** | Amber | `WORK MODE` | Agent Rails: DAGs, WIHs, planning | ✗ Currently stub |
| **OPS** | Green | `OPS MODE` | OpenClaw: Cron, logs, channels | ✗ Currently missing |
| **SYS** | Cyan | `SYS MODE` | System: Health, config, sessions | ✓ Partial |

### Mode Transition

```
User types: /work
┌─────────────────────────────────────────────────────────────────────────────┐
│ Allternit TUI v0.2.0                    MODE: WORK ▓▓▓▓▓▓░░░░                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ╔═══════════════════════════════════════════════════════════════════════╗  │
│  ║  WORK MODE - Agent Rails Integration                                   ║  │
│  ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║  │
│  ║                                                                        ║  │
│  ║  Active DAG: none                                                      ║  │
│  ║  Ready WIHs: 0                                                         ║  │
│  ║  Current Lease: none                                                   ║  │
│  ║                                                                        ║  │
│  ║  Commands:                                                             ║  │
│  ║    /plan new "<goal>" [--project <id>]  Create new plan               ║  │
│  ║    /plan show <dag_id>                  Show DAG structure            ║  │
│  ║    /wih list --ready                    List ready work items         ║  │
│  ║    /wih pickup <node_id>                Pick up work item             ║  │
│  ║    /wih close --status DONE             Complete work item            ║  │
│  ║    /gate status                         Show gate configuration       ║  │
│  ║    /lease request <wih_id> --paths "*"  Request file lease            ║  │
│  ║                                                                        ║  │
│  ╚═══════════════════════════════════════════════════════════════════════╝  │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│ ▓ WORK MODE ▓  │ Agent: main │ Session: sess_789 │ Status: idle            │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Feature Wiring Status

### Currently WIRED (Real APIs)
- [x] `/session`, `/sessions` - List brain sessions
- [x] `/model`, `/models` - List/switch models
- [x] `/skills` - List marketplace skills
- [x] `/status` - Health check
- [x] Chat dispatch - Send messages to kernel
- [x] Session attach - Stream events

### Currently STUBS (UI Only)
- [ ] `/plan` - Just prints template, no DAG created
- [ ] `/ultrathink` - Flag not sent to API
- [ ] `/subagent` - Just formats message
- [ ] `/todo` - Local only, not persisted
- [ ] `/hooks` - Local shell execution only

### Currently MISSING (Need Implementation)
- [ ] Agent Rails: `/plan new`, `/wih pickup`, `/gate check`
- [ ] OpenClaw Ops: `/cron`, `/channels`, `/logs follow`
- [ ] Config: `/config set`, `/config apply`

## Implementation Strategy

### Phase 1: Mode System Foundation

**T1.1: Mode State Machine**
```rust
enum TuiMode {
    Chat,      // Default, blue theme
    Work,      // Agent Rails, amber theme
    Ops,       // OpenClaw, green theme
    Sys,       // System, cyan theme
}

struct ModeContext {
    mode: TuiMode,
    active_dag: Option<String>,      // Work mode
    active_wih: Option<String>,      // Work mode
    active_lease: Option<String>,    // Work mode
    log_follow: bool,                // Ops mode
    log_sources: Vec<String>,        // Ops mode
}
```

**T1.2: Visual Mode Indicator**
- Header bar color changes per mode
- Status line shows mode-specific context
- Footer badge shows `[MODE NAME]`

**T1.3: Mode-Specific Help**
- `/help` shows different commands per mode
- Context-aware completions
- Mode transition commands: `/work`, `/ops`, `/sys`, `/chat`

### Phase 2: Deep Work Mode Integration (Agent Rails)

**T2.1: Agent Rails API Client**
```rust
// New client methods
impl KernelClient {
    async fn rails_plan_new(&self, goal: &str, project: Option<&str>) -> Result<Dag>;
    async fn rails_plan_show(&self, dag_id: &str) -> Result<DagProjection>;
    async fn rails_wih_list(&self, dag_id: Option<&str>) -> Result<Vec<WIH>>;
    async fn rails_wih_pickup(&self, node_id: &str, agent_id: &str) -> Result<WIH>;
    async fn rails_wih_close(&self, wih_id: &str, status: WIHStatus) -> Result<()>;
    async fn rails_gate_status(&self) -> Result<GateStatus>;
    async fn rails_lease_request(&self, wih_id: &str, paths: &str) -> Result<Lease>;
}
```

**T2.2: Real /plan new**
- Calls `rails_plan_new()` API
- Creates actual DAG in Agent Rails
- Returns DAG ID, stores in mode context
- Shows DAG structure in response

**T2.3: Real /wih pickup**
- Calls `rails_wih_pickup()` API
- Assigns WIH to current session
- Updates mode context with active WIH
- Shows WIH context on pickup

**T2.4: DAG Visualization**
- Text-based DAG render in overlay
- Show node status (ready/active/done)
- Highlight critical path

### Phase 3: Deep Ops Mode Integration (OpenClaw)

**T3.1: OpenClaw API Client**
```rust
impl KernelClient {
    async fn cron_list(&self) -> Result<Vec<CronJob>>;
    async fn cron_add(&self, job: &CronJobSpec) -> Result<CronJob>;
    async fn cron_remove(&self, id: &str) -> Result<()>;
    async fn cron_run(&self, id: &str) -> Result<RunResult>;
    async fn logs_tail(&self, sources: &[&str], follow: bool) -> Result<mpsc::Receiver<LogEntry>>;
    async fn channels_list(&self) -> Result<Vec<Channel>>;
    async fn channels_login(&self, channel: &str) -> Result<LoginFlow>;
}
```

**T3.2: Real /cron Commands**
- Full cron management overlay
- Add/remove/enable/disable/run jobs
- Show run history

**T3.3: Real /logs follow**
- Streaming log viewer
- Source filtering
- Search/highlight

**T3.4: Real /channels login**
- QR code display for WhatsApp/etc
- ASCII art QR rendering
- Status polling

### Phase 4: Deep Sys Mode Integration

**T4.1: Real Config Editor**
- JSON config tree view
- Path-based editing `/config set gateway.port 8080`
- Validation before apply
- Apply with confirmation

**T4.2: Session Management**
- Better session list with metadata
- Session switching with context preservation
- Session cleanup/termination

## Visual Polish

### Status Line Context

```rust
// Chat mode
"Chat │ Agent: main │ Session: sess_789 │ Status: idle"

// Work mode  
"▓ WORK ▓ │ Agent: main │ DAG: proj_123 │ WIH: wih_456 │ Lease: /src/*.rs"

// Ops mode
"◈ OPS ◈ │ Agent: main │ Cron: 3 jobs │ Logs: following kernel"

// Sys mode
"◆ SYS ◆ │ Agent: main │ Health: ok │ Kernel: 127.0.0.1:3004"
```

### Mode Transition Animation

```
[User types /work]

CHAT MODE ▓▓▓▓▓▓▓▓▓▓
↓ (transition)
WORK MODE ░░░░░░░░░░ 0%
WORK MODE ▓▓▓░░░░░░░ 25%
WORK MODE ▓▓▓▓▓░░░░░ 50%
WORK MODE ▓▓▓▓▓▓▓░░░ 75%
WORK MODE ▓▓▓▓▓▓▓▓▓▓ 100%

[Show work mode splash/help]
```

### Color Themes Per Mode

```rust
struct ModeTheme {
    primary: Color,      // Header, borders
    secondary: Color,    // Highlights, selections
    text: Color,         // Main text
    muted: Color,        // Secondary text
    success: Color,      // Success states
    error: Color,        // Error states
}

const CHAT_THEME: ModeTheme = ModeTheme {
    primary: Color::Blue,
    secondary: Color::Cyan,
    text: Color::White,
    muted: Color::Gray,
    success: Color::Green,
    error: Color::Red,
};

const WORK_THEME: ModeTheme = ModeTheme {
    primary: Color::Rgb(255, 165, 0), // Amber
    secondary: Color::Yellow,
    text: Color::White,
    muted: Color::Gray,
    success: Color::Green,
    error: Color::Red,
};
```

## API Verification

Before implementing each feature, verify API exists:

```bash
# Check Agent Rails endpoints
curl http://localhost:3004/v1/rails/plan/new    # POST
curl http://localhost:3004/v1/rails/wih/list    # GET
curl http://localhost:3004/v1/rails/gate/status # GET

# Check OpenClaw endpoints
curl http://localhost:3004/v1/cron              # GET/POST
curl http://localhost:3004/v1/logs/tail         # GET
curl http://localhost:3004/v1/channels          # GET
```

If endpoint doesn't exist, either:
1. Implement in kernel first (ideal)
2. Mark as "[stub - API pending]" in UI
3. Use alternative endpoint

## Testing Strategy

### Unit Tests
- Mode state transitions
- Theme application
- Command routing per mode

### Integration Tests
- `/work` → show work commands work
- `/plan new` → DAG actually created
- `/wih pickup` → WIH assigned
- `/ops` → show ops commands work
- `/cron list` → jobs fetched from API

### Visual Tests
- Mode colors render correctly
- Status line updates properly
- Help context switches

## Success Criteria

1. **User always knows their mode** - Visual indicator is impossible to miss
2. **Commands work or clearly don't** - No silent stubs; either API call succeeds or shows "[API unavailable]"
3. **Context is preserved** - Switching modes doesn't lose work
4. **Help is contextual** - `/help` in work mode shows work commands
5. **Deep integration real** - `/plan new` creates real DAG, not just text

## Open Questions

1. **Agent Rails API availability** - Are the endpoints already implemented in kernel?
2. **OpenClaw integration** - Is there a separate OpenClaw service or unified kernel?
3. **Mode persistence** - Should mode be saved per session or reset to chat?
4. **Work mode auto-detect** - Should we auto-switch to work mode when DAG created?
