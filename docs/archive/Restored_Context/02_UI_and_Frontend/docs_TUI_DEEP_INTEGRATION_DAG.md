# TUI Deep Integration Task DAG

## Overview
Deep integration of Agent Rails and OpenClaw into Allternit TUI with clear visual mode system.

**Core Principle:** Every feature must be actually wired to real APIs or clearly marked as stub.

## Milestone Dependency Graph

```
M0: Foundation
    │
    ├──► M1: Mode System (Visual Architecture)
    │       │
    │       ├──► M2: Agent Rails - Real Integration (Work Mode)
    │       │       ├──► M2.1: Core Rails API
    │       │       ├──► M2.2: DAG/Planning
    │       │       ├──► M2.3: WIH Management
    │       │       └──► M2.4: Gates & Leases
    │       │
    │       └──► M3: OpenClaw - Real Integration (Ops Mode)
    │               ├──► M3.1: Core Ops API
    │               ├──► M3.2: Cron Management
    │               ├──► M3.3: Live Logs
    │               └──► M3.4: Channels
    │
    └──► M4: System Mode Hardening
            ├──► M4.1: Real Config Editor
            └──► M4.2: Session Management

M5: Polish & Integration Testing
```

---

## M0: Foundation

### T0.1: API Endpoint Discovery
**Purpose:** Verify which APIs exist before implementing

- [ ] **T0.1.1:** Document Agent Rails endpoints (check kernel)
  - Test: `GET /v1/rails/status` returns 200
  - Test: `POST /v1/rails/plan/new` creates DAG
  - Test: `GET /v1/rails/wih/list` returns WIHs
  
- [ ] **T0.1.2:** Document OpenClaw endpoints
  - Test: `GET /v1/cron` returns jobs
  - Test: `GET /v1/logs/tail` streams logs
  - Test: `GET /v1/channels` returns channels

- [ ] **T0.1.3:** Document missing endpoints
  - List endpoints that return 404
  - Mark features as "[stub - API pending]" for these

**Deliverable:** `API_STATUS.md` with endpoint availability matrix

---

## M1: Mode System (Visual Architecture)

### T1.1: Core Mode State
**Files:** `cmd/cli/src/commands/tui/mode.rs` (new)

- [ ] **T1.1.1:** Define `TuiMode` enum
```rust
pub enum TuiMode {
    Chat,   // Blue - Default conversation
    Work,   // Amber - Agent Rails
    Ops,    // Green - OpenClaw operations
    Sys,    // Cyan - System management
}
```

- [ ] **T1.1.2:** Define `ModeContext` struct
```rust
pub struct ModeContext {
    mode: TuiMode,
    // Work mode context
    active_dag: Option<String>,
    active_wih: Option<String>,
    active_lease: Option<String>,
    // Ops mode context
    log_follow_sources: Vec<String>,
    log_filter: String,
}
```

- [ ] **T1.1.3:** Add mode to TuiApp state
```rust
pub struct TuiApp<'a> {
    // ... existing fields ...
    mode: TuiMode,
    mode_context: ModeContext,
    theme: ModeTheme,  // Dynamic based on mode
}
```

**Tests:**
- Mode transitions correctly
- Context preserved across transitions

---

### T1.2: Visual Mode System
**Files:** `cmd/cli/src/commands/tui/theme.rs` (new)

- [ ] **T1.2.1:** Define `ModeTheme` struct with colors
```rust
pub struct ModeTheme {
    pub primary: Color,      // Header, borders
    pub secondary: Color,    // Highlights
    pub text: Color,
    pub muted: Color,
    pub success: Color,
    pub error: Color,
    pub indicator: &'static str,  // Mode badge text
}
```

- [ ] **T1.2.2:** Create theme constants
```rust
const CHAT_THEME: ModeTheme = ModeTheme {
    primary: Color::Blue,
    secondary: Color::Cyan,
    text: Color::White,
    muted: Color::Gray,
    success: Color::Green,
    error: Color::Red,
    indicator: "CHAT",
};

const WORK_THEME: ModeTheme = ModeTheme {
    primary: Color::Rgb(255, 165, 0), // Amber
    secondary: Color::Yellow,
    text: Color::White,
    muted: Color::Gray,
    success: Color::Green,
    error: Color::Red,
    indicator: "▓ WORK ▓",
};
// ... OPS_THEME, SYS_THEME ...
```

- [ ] **T1.2.3:** Implement dynamic theme application
  - Header bar uses theme.primary
  - Borders use theme.secondary
  - Status line updates based on mode

**Tests:**
- Theme changes on mode switch
- All widgets use correct colors

---

### T1.3: Mode Switching Commands
**Files:** `cmd/cli/src/commands/tui/slash_commands/mode.rs` (new)

- [ ] **T1.3.1:** Implement `/chat` command
  - Switches to Chat mode
  - Shows chat context help
  - Resets relevant state

- [ ] **T1.3.2:** Implement `/work` command
  - Switches to Work mode
  - Shows work mode splash with commands
  - Displays active DAG/WIH if any

- [ ] **T1.3.3:** Implement `/ops` command
  - Switches to Ops mode
  - Shows ops mode splash
  - Displays cron/logs status

- [ ] **T1.3.4:** Implement `/sys` command
  - Switches to Sys mode
  - Shows system status
  - Health, config, session info

**Mode Splash Screen:**
```
╔══════════════════════════════════════════════════════════════╗
║  WORK MODE - Agent Rails Integration                         ║
║  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  ║
║                                                              ║
║  Active Context:                                             ║
║    DAG: none                                                 ║
║    WIH: none                                                 ║
║    Lease: none                                               ║
║                                                              ║
║  Available Commands:                                         ║
║    /plan new "<goal>"           Create work plan             ║
║    /plan show <dag_id>          View DAG structure           ║
║    /wih list --ready            List ready work              ║
║    /wih pickup <node_id>        Pick up work item            ║
║    /wih status                  Show active WIH              ║
║    /gate status                 Show gate config             ║
║    /lease request <paths>       Request file lease           ║
║                                                              ║
║  [API Status: ✓ Connected]  [Type /help for full list]       ║
╚══════════════════════════════════════════════════════════════╝
```

**Tests:**
- Each mode command works
- Splash renders correctly
- API status indicator accurate

---

### T1.4: Contextual Help System
**Files:** `cmd/cli/src/commands/tui/help.rs` (new)

- [ ] **T1.4.1:** Create mode-specific help content
```rust
fn get_chat_help() -> Vec<HelpItem>
fn get_work_help() -> Vec<HelpItem>
fn get_ops_help() -> Vec<HelpItem>
fn get_sys_help() -> Vec<HelpItem>
```

- [ ] **T1.4.2:** Mark stub commands clearly
```rust
pub struct HelpItem {
    command: &'static str,
    description: &'static str,
    status: FeatureStatus,  // Wired, Stub, Pending
}

enum FeatureStatus {
    Wired,      // ✓ - Fully implemented
    Stub,       // ○ - UI only, no API
    Pending,    // ◌ - API not available
}
```

- [ ] **T1.4.3:** Update `/help` to show mode-specific help
  - Show current mode commands first
  - Include legend: "✓=wired ○=stub ◌=pending"

**Help Output:**
```
CHAT MODE COMMANDS                    LEGEND: ✓=wired  ○=stub  ◌=pending
━━━━━━━━━━━━━━━━━━
✓ /help              Show this help
✓ /status            Show system status
✓ /agent <id>        Switch agent
✓ /session <key>     Switch session
✓ /model <id>        Set model
○ /plan "<goal>"     Create work plan [stub - no API]
✓ /work              Switch to WORK mode
✓ /ops               Switch to OPS mode
```

**Tests:**
- Help shows correct commands per mode
- Stub markers accurate
- Legend explains symbols

---

### T1.5: Status Line Mode Context
**Files:** `cmd/cli/src/commands/tui/render.rs` (modify)

- [ ] **T1.5.1:** Create mode-aware status formatter
```rust
fn format_status_line(&self) -> String {
    match self.mode {
        TuiMode::Chat => format!("Chat │ Agent: {} │ Session: {} │ Status: {}",
            self.current_agent, self.current_session, self.activity_status),
        TuiMode::Work => format!("▓ WORK ▓ │ Agent: {} │ DAG: {} │ WIH: {}",
            self.current_agent, 
            self.mode_context.active_dag.as_deref().unwrap_or("none"),
            self.mode_context.active_wih.as_deref().unwrap_or("none")),
        // ... etc
    }
}
```

- [ ] **T1.5.2:** Render status with mode theme colors
  - Mode indicator uses theme.primary
  - Values use theme.text
  - Separators use theme.muted

**Tests:**
- Status line updates on mode change
- Correct info shown per mode
- Colors apply correctly

---

## M2: Agent Rails - Real Integration (Work Mode)

### M2.1: Core Rails API Client
**Files:** `cmd/cli/src/client.rs` (extend)

- [ ] **M2.1.1:** Define Agent Rails types
```rust
// types/rails.rs
pub struct Dag {
    pub id: String,
    pub title: String,
    pub status: DagStatus,
    pub nodes: Vec<DagNode>,
    pub created_at: String,
}

pub struct DagNode {
    pub id: String,
    pub title: String,
    pub status: NodeStatus,  // ready, active, done, blocked
    pub blocked_by: Vec<String>,
}

pub struct WIH {
    pub id: String,
    pub node_id: String,
    pub dag_id: String,
    pub status: WIHStatus,  // open, signed, closed
    pub agent_id: Option<String>,
}

pub struct GateStatus {
    pub enabled: bool,
    pub rules: Vec<GateRule>,
}

pub struct Lease {
    pub id: String,
    pub wih_id: String,
    pub paths: Vec<String>,
    pub expires_at: Option<String>,
}
```

- [ ] **M2.1.2:** Implement plan API methods
```rust
impl KernelClient {
    pub async fn rails_plan_new(
        &self, 
        goal: &str, 
        project: Option<&str>
    ) -> Result<Dag>;
    
    pub async fn rails_plan_show(&self, dag_id: &str) -> Result<Dag>;
    
    pub async fn rails_dag_render(
        &self, 
        dag_id: &str, 
        format: &str
    ) -> Result<String>;
}
```

- [ ] **M2.1.3:** Implement WIH API methods
```rust
impl KernelClient {
    pub async fn rails_wih_list(
        &self, 
        dag_id: Option<&str>,
        ready_only: bool
    ) -> Result<Vec<WIH>>;
    
    pub async fn rails_wih_pickup(
        &self, 
        node_id: &str, 
        agent_id: &str
    ) -> Result<WIH>;
    
    pub async fn rails_wih_close(
        &self, 
        wih_id: &str, 
        status: &str,
        evidence: &[&str]
    ) -> Result<()>;
}
```

- [ ] **M2.1.4:** Implement gate/lease API methods
```rust
impl KernelClient {
    pub async fn rails_gate_status(&self) -> Result<GateStatus>;
    
    pub async fn rails_gate_check(
        &self, 
        wih_id: &str
    ) -> Result<GateCheckResult>;
    
    pub async fn rails_lease_request(
        &self, 
        wih_id: &str, 
        paths: &str,
        ttl_secs: Option<u64>
    ) -> Result<Lease>;
    
    pub async fn rails_lease_release(&self, lease_id: &str) -> Result<()>;
}
```

**API Verification Required:**
- [ ] `POST /v1/rails/plan/new` exists
- [ ] `GET /v1/rails/dag/{id}` exists
- [ ] `GET /v1/rails/wih/list` exists
- [ ] `POST /v1/rails/wih/pickup` exists
- [ ] `GET /v1/rails/gate/status` exists

**If APIs missing:**
- Mark all work commands as "◌ pending" in help
- Show "Agent Rails API not available" in work mode splash

---

### M2.2: DAG/Planning Commands
**Files:** `cmd/cli/src/commands/tui/slash_commands/work.rs`

- [ ] **M2.2.1:** Implement `/plan new "<goal>" [--project <id>]`
```rust
async fn handle_plan_new(&mut self, goal: &str, project: Option<&str>) {
    // Call API
    match self.client.rails_plan_new(goal, project).await {
        Ok(dag) => {
            // Store in mode context
            self.mode_context.active_dag = Some(dag.id.clone());
            
            // Show success with DAG structure
            self.push_system(format!("✓ DAG created: {}", dag.id));
            self.push_system(format!("  Title: {}", dag.title));
            self.push_system(format!("  Nodes: {} total", dag.nodes.len()));
            
            // Show ready nodes
            let ready: Vec<_> = dag.nodes.iter()
                .filter(|n| n.status == NodeStatus::Ready)
                .collect();
            if !ready.is_empty() {
                self.push_system(format!("  Ready WIHs: {}", ready.len()));
                for node in ready.iter().take(3) {
                    self.push_system(format!("    - {}: {}", node.id, node.title));
                }
            }
        }
        Err(e) => self.push_error(format!("Failed to create plan: {}", e)),
    }
}
```

- [ ] **M2.2.2:** Implement `/plan show [dag_id]`
  - If no dag_id, use `mode_context.active_dag`
  - Fetch DAG structure from API
  - Render text-based DAG visualization

- [ ] **M2.2.3:** Implement `/dag render <dag_id> [--format md|json]`
  - Calls `rails_dag_render()`
  - Shows rendered DAG in overlay

**DAG Text Visualization:**
```
DAG: proj_123
━━━━━━━━━━━━━

n_001 [DONE]    Project Setup
  │
  ├─► n_002 [READY]   Analyze codebase
  │   └─► n_003 [BLOCKED]  Design solution
  │       └─► n_004 [BLOCKED]  Implement
  │
  └─► n_005 [READY]   Write tests

Legend: [READY] [ACTIVE] [DONE] [BLOCKED]
```

---

### M2.3: WIH Management Commands
**Files:** `cmd/cli/src/commands/tui/slash_commands/work.rs`

- [ ] **M2.3.1:** Implement `/wih list [--ready] [--dag <id>]`
  - Lists WIHs from API
  - Shows status, agent assignment
  - Filter by ready status

- [ ] **M2.3.2:** Implement `/wih pickup <node_id>`
```rust
async fn handle_wih_pickup(&mut self, node_id: &str) {
    match self.client.rails_wih_pickup(node_id, &self.current_agent).await {
        Ok(wih) => {
            self.mode_context.active_wih = Some(wih.id.clone());
            self.push_system(format!("✓ Picked up WIH: {}", wih.id));
            
            // Show context
            if let Ok(ctx) = self.client.rails_wih_context(&wih.id).await {
                self.push_system("WIH Context:".to_string());
                self.push_system(format!("  {}", ctx));
            }
        }
        Err(e) => self.push_error(format!("Failed to pickup WIH: {}", e)),
    }
}
```

- [ ] **M2.3.3:** Implement `/wih status`
  - Shows active WIH details
  - Shows context pack if available
  - Shows lease status

- [ ] **M2.3.4:** Implement `/wih close --status DONE|FAILED [--evidence <ref>]`
  - Closes WIH with status
  - Submits evidence refs
  - Clears mode context

---

### M2.4: Gates & Leases Commands
**Files:** `cmd/cli/src/commands/tui/slash_commands/work.rs`

- [ ] **M2.4.1:** Implement `/gate status`
  - Shows gate configuration
  - Lists active rules
  - Shows policy constraints

- [ ] **M2.4.2:** Implement `/gate check <wih_id>`
  - Runs gate checks on WIH
  - Shows pass/fail with reasons

- [ ] **M2.4.3:** Implement `/lease request <wih_id> --paths "<glob>" [--ttl <secs>]`
  - Requests file lease for WIH
  - Updates mode context with lease

- [ ] **M2.4.4:** Implement `/lease release [lease_id]`
  - Releases lease
  - If no id, releases active_lease

---

### M2.5: Work Mode Overlays
**Files:** `cmd/cli/src/commands/tui/overlays/work.rs` (new)

- [ ] **M2.5.1:** Create `WorkOverlay` enum variant
```rust
enum Overlay {
    // ... existing ...
    DagView,        // DAG structure view
    WIHList,        // WIH list
    WIHDetail,      // Single WIH detail
    GateStatus,     // Gate configuration
}
```

- [ ] **M2.5.2:** Implement DAG view overlay
  - Tree visualization
  - Node status colors
  - Navigation (up/down to select nodes)

- [ ] **M2.5.3:** Implement WIH list overlay
  - Table of WIHs
  - Sort by status, agent, created
  - Action: pickup, close

**Tests:**
- All commands call real APIs
- Error handling shows clear messages
- Mode context updates correctly
- Overlays render properly

---

## M3: OpenClaw - Real Integration (Ops Mode)

### M3.1: Core Ops API Client
**Files:** `cmd/cli/src/client.rs` (extend)

- [ ] **M3.1.1:** Define OpenClaw Ops types
```rust
// types/ops.rs
pub struct CronJob {
    pub id: String,
    pub name: String,
    pub schedule: String,  // cron expression
    pub command: String,
    pub enabled: bool,
    pub last_run: Option<String>,
    pub next_run: Option<String>,
    pub run_count: u64,
}

pub struct CronRun {
    pub id: String,
    pub job_id: String,
    pub started_at: String,
    pub finished_at: Option<String>,
    pub status: String,  // success, failed, running
    pub output: Option<String>,
}

pub struct LogEntry {
    pub timestamp: String,
    pub source: String,  // kernel, gateway, agent
    pub level: String,   // info, warn, error
    pub message: String,
}

pub struct Channel {
    pub id: String,
    pub name: String,
    pub kind: String,    // whatsapp, telegram, discord, slack
    pub status: String,  // connected, disconnected, pending_auth
    pub qr_code: Option<String>,  // Base64 QR for auth
}
```

- [ ] **M3.1.2:** Implement cron API methods
```rust
impl KernelClient {
    pub async fn cron_list(&self) -> Result<Vec<CronJob>>;
    
    pub async fn cron_add(&self, spec: &CronJobSpec) -> Result<CronJob>;
    
    pub async fn cron_update(
        &self, 
        id: &str, 
        patch: &CronJobPatch
    ) -> Result<CronJob>;
    
    pub async fn cron_remove(&self, id: &str) -> Result<()>;
    
    pub async fn cron_run(&self, id: &str) -> Result<CronRun>;
    
    pub async fn cron_history(&self, id: &str) -> Result<Vec<CronRun>>;
}
```

- [ ] **M3.1.3:** Implement logs API methods
```rust
impl KernelClient {
    pub async fn logs_tail(
        &self,
        sources: &[&str],
        lines: usize,
        filter: Option<&str>,
    ) -> Result<Vec<LogEntry>>;
    
    pub async fn logs_follow(
        &self,
        sources: &[&str],
        filter: Option<&str>,
    ) -> Result<mpsc::Receiver<LogEntry>>;  // Streaming
}
```

- [ ] **M3.1.4:** Implement channels API methods
```rust
impl KernelClient {
    pub async fn channels_list(&self) -> Result<Vec<Channel>>;
    
    pub async fn channels_status(&self, id: &str) -> Result<Channel>;
    
    pub async fn channels_login_start(&self, id: &str) -> Result<LoginFlow>;
    
    pub async fn channels_login_poll(&self, flow_id: &str) -> Result<LoginStatus>;
}
```

**API Verification Required:**
- [ ] `GET /v1/cron` exists
- [ ] `POST /v1/cron` exists
- [ ] `GET /v1/logs/tail` exists
- [ ] `GET /v1/channels` exists

---

### M3.2: Cron Management Commands
**Files:** `cmd/cli/src/commands/tui/slash_commands/ops.rs`

- [ ] **M3.2.1:** Implement `/cron list`
```rust
async fn handle_cron_list(&mut self) {
    match self.client.cron_list().await {
        Ok(jobs) => {
            self.push_system(format!("Cron Jobs ({} total):", jobs.len()));
            for job in jobs {
                let status = if job.enabled { "✓" } else { "○" };
                let next = job.next_run.as_deref().unwrap_or("-");
                self.push_system(format!(
                    "  {} [{}] {} | {} | Next: {}",
                    status, job.id, job.name, job.schedule, next
                ));
            }
        }
        Err(e) => self.push_error(format!("Failed to list cron jobs: {}", e)),
    }
}
```

- [ ] **M3.2.2:** Implement `/cron add <name> <schedule> <command>`
  - Parses schedule (cron expression)
  - Creates job via API
  - Shows confirmation

- [ ] **M3.2.3:** Implement `/cron remove <id>`
  - Confirmation prompt
  - Removes via API

- [ ] **M3.2.4:** Implement `/cron enable <id>` / `/cron disable <id>`
  - Toggles job enabled status

- [ ] **M3.2.5:** Implement `/cron run <id>`
  - Triggers immediate execution
  - Shows run result

- [ ] **M3.2.6:** Implement `/cron history <id>`
  - Shows recent run history
  - Exit codes, output preview

---

### M3.3: Live Logs Commands
**Files:** `cmd/cli/src/commands/tui/slash_commands/ops.rs`

- [ ] **M3.3.1:** Implement `/logs [sources...]`
```rust
async fn handle_logs(&mut self, sources: Vec<&str>) {
    let sources = if sources.is_empty() {
        vec!["kernel", "gateway"]
    } else {
        sources
    };
    
    match self.client.logs_tail(&sources, 50, None).await {
        Ok(entries) => {
            self.push_system(format!("Recent logs ({} entries):", entries.len()));
            for entry in entries {
                self.push_system(format!(
                    "[{}] {}: {}",
                    entry.timestamp, entry.source, entry.message
                ));
            }
        }
        Err(e) => self.push_error(format!("Failed to fetch logs: {}", e)),
    }
}
```

- [ ] **M3.3.2:** Implement `/logs follow [sources...]`
  - Enters log follow mode
  - Updates mode context
  - Spawns async receiver for log stream
  - Displays logs as they arrive

- [ ] **M3.3.3:** Implement `/logs filter <pattern>`
  - Sets log filter pattern
  - Filters displayed logs

- [ ] **M3.3.4:** Implement `/logs stop`
  - Stops following logs
  - Clears mode context

**Log Viewer UI:**
```
◈ OPS MODE - Following logs ◈
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[2024-01-15 10:23:45] kernel: Session sess_789 created
[2024-01-15 10:23:46] gateway: WebSocket connected
[2024-01-15 10:23:47] agent: Processing message...
[2024-01-15 10:23:48] agent: Tool call: read_file
[2024-01-15 10:23:49] agent: Tool result: success

[Following... Press 'q' to stop]
```

---

### M3.4: Channels Commands
**Files:** `cmd/cli/src/commands/tui/slash_commands/ops.rs`

- [ ] **M3.4.1:** Implement `/channels list`
```rust
async fn handle_channels_list(&mut self) {
    match self.client.channels_list().await {
        Ok(channels) => {
            self.push_system(format!("Channels ({} total):", channels.len()));
            for ch in channels {
                let icon = match ch.kind.as_str() {
                    "whatsapp" => "📱",
                    "telegram" => "✈️",
                    "discord" => "💬",
                    "slack" => "#️⃣",
                    _ => "📡",
                };
                self.push_system(format!(
                    "  {} [{}] {} | Status: {}",
                    icon, ch.id, ch.name, ch.status
                ));
            }
        }
        Err(e) => self.push_error(format!("Failed to list channels: {}", e)),
    }
}
```

- [ ] **M3.4.2:** Implement `/channels status <id>`
  - Shows detailed channel status
  - Connection health, recent messages

- [ ] **M3.4.3:** Implement `/channels login <id>`
  - Initiates login flow
  - Polls for QR code
  - Displays ASCII QR code
  - Waits for user scan

**QR Code Display:**
```
WhatsApp Login - Scan with phone
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

█████████████████████████
██ ▄▄▄▄▄ █▀▄▀▄█ ▄▄▄▄▄ ██
██ █   █ █ ▄▀▄█ █   █ ██
██ █▄▄▄█ █▀▄▀▄█ █▄▄▄█ ██
██▄▄▄▄▄▄▄█ ▄▀▄█▄▄▄▄▄▄▄██
██ ▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄██
██▄▄▄▄▄▄▄█▄▀▄▀█▄▄▄▄▄▄▄██
█████████████████████████

Waiting for scan...
```

---

## M4: System Mode Hardening

### M4.1: Real Config Editor
**Files:** `cmd/cli/src/commands/tui/slash_commands/sys.rs`

- [ ] **M4.1.1:** Implement `/config get [path]`
```rust
async fn handle_config_get(&mut self, path: Option<&str>) {
    match self.client.config_get(path).await {
        Ok(value) => {
            if let Some(p) = path {
                self.push_system(format!("{} = {}", p, value));
            } else {
                // Show full config tree
                self.push_system("Current configuration:");
                self.push_system(serde_json::to_string_pretty(&value).unwrap());
            }
        }
        Err(e) => self.push_error(format!("Failed to get config: {}", e)),
    }
}
```

- [ ] **M4.1.2:** Implement `/config set <path> <value>`
  - Parses value (detect int/string/bool)
  - Sets config via API
  - Validates before setting

- [ ] **M4.1.3:** Implement `/config edit`
  - Opens config in $EDITOR
  - Validates JSON on save
  - Applies changes via API

- [ ] **M4.1.4:** Implement `/config apply`
  - Validates current config
  - Applies with confirmation
  - Shows validation errors

---

### M4.2: Session Management
**Files:** `cmd/cli/src/commands/tui/slash_commands/sys.rs`

- [ ] **M4.2.1:** Enhance `/sessions`
  - Show more metadata (created, last active)
  - Filter by status, agent
  - Sort options

- [ ] **M4.2.2:** Implement `/session cleanup`
  - List inactive sessions
  - Bulk terminate option

---

## M5: Polish & Integration Testing

### M5.1: Visual Polish
- [ ] **M5.1.1:** Mode transition animation
- [ ] **M5.1.2:** Consistent spacing and alignment
- [ ] **M5.1.3:** Error message formatting
- [ ] **M5.1.4:** Loading states for async operations

### M5.2: Integration Tests
- [ ] **M5.2.1:** Test all mode transitions
- [ ] **M5.2.2:** Test each wired command
- [ ] **M5.2.3:** Test error handling
- [ ] **M5.2.4:** Test context preservation

### M5.3: Documentation
- [ ] **M5.3.1:** Update README with mode system
- [ ] **M5.3.2:** Document all slash commands
- [ ] **M5.3.3:** API dependency matrix

---

## Implementation Order

### Week 1: M0 + M1 Foundation
1. T0.1 - API discovery (1 day)
2. T1.1 - Mode state (1 day)
3. T1.2 - Theme system (1 day)
4. T1.3 - Mode commands (1 day)
5. T1.4 - Contextual help (1 day)

### Week 2: M2 Agent Rails
1. M2.1 - Rails API client (2 days)
2. M2.2 - Plan commands (1 day)
3. M2.3 - WIH commands (1 day)
4. M2.4 - Gate/lease commands (1 day)

### Week 3: M3 OpenClaw Ops
1. M3.1 - Ops API client (2 days)
2. M3.2 - Cron commands (1 day)
3. M3.3 - Logs commands (1 day)
4. M3.4 - Channels commands (1 day)

### Week 4: M4 + M5 Polish
1. M4.1 - Config editor (2 days)
2. M4.2 - Session hardening (1 day)
3. M5.1 - Visual polish (1 day)
4. M5.2 - Testing (1 day)

---

## Success Metrics

- [ ] User can always see current mode
- [ ] `/help` shows correct commands for current mode
- [ ] `/plan new` creates real DAG (not stub)
- [ ] `/wih pickup` assigns real WIH
- [ ] `/cron list` shows real cron jobs
- [ ] `/logs follow` streams real logs
- [ ] All stub commands marked with ○
- [ ] All pending APIs marked with ◌
