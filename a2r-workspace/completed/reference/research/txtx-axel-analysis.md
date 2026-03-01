# TxTx/Axel Research Analysis

> **Research Date:** 2026-02-13  
> **Focus:** Evaluating txtx/axel for potential integration or reimplementation in a2rchitech's Agent Rails system  
> **Status:** Complete

---

## Executive Summary

The txtx organization's **axel** project provides a task queue and terminal multiplexer for AI coding agents, while **axel-app** offers a native macOS UI. However, axel's task model is significantly simpler than a2rchitech's Rails DAG/WIH system.

**Verdict:** Direct reimplementation is NOT recommended. Instead, **selective adoption** of specific components and patterns can enhance a2rchitech's existing architecture.

---

## 1. TxTx Organization Overview

| Project | Purpose | Language | Stars | Relevance |
|---------|---------|----------|-------|-----------|
| **txtx** | Terraform for Web3 - Smart contract runbooks | Rust | 146 | Low - Different domain |
| **surfpool** | Solana development environment | Rust | 492 | Low - Different domain |
| **axel** | Task queue + terminal multiplexer for AI agents | Rust | 16 | **High** |
| **axel-app** | macOS UI for axel (Things-like task list) | Swift | 105 | **High** |
| **moneymq** | Payment rails engine | Rust | 28 | Low - Different domain |

---

## 2. Axel Architecture Deep Dive

### 2.1 Core Components

```
┌─────────────────────────────────────────────────────────────┐
│                    AXEL-APP (SwiftUI)                       │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐   │
│  │   Inbox     │ │   Tasks     │ │    Terminals        │   │
│  │  (Things-like)│ │  (Priority) │ │  (Ghostty/tmux)     │   │
│  └─────────────┘ └─────────────┘ └─────────────────────┘   │
│  • Automerge CRDT for sync                                 │
│  • Supabase backend                                        │
│  • SSE inbox for real-time events                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    AXEL CLI (Rust)                          │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐   │
│  │   Skills    │ │   Session   │ │    Worktree         │   │
│  │  (Portable) │ │   Manager   │ │    Manager          │   │
│  └─────────────┘ └─────────────┘ └─────────────────────┘   │
│  • tmux grid layouts                                       │
│  • AXEL.md configuration                                   │
│  • Git worktree isolation                                  │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Task Model

Axel uses a **simple linear task queue** - NOT a DAG:

```yaml
# Task in Axel (simplified)
task:
  id: "T123"
  title: "Refactor API"
  status: queued | running | completed
  priority: high | medium | low
  context:
    worktree: "/path/to/branch"
    pane_id: "session:0.1"
  assignee: "claude" | "codex" | "opencode"
```

**Key Limitations for a2rchitech:**
- ❌ No dependency graph (just priority queue)
- ❌ No gate/validation system
- ❌ No role separation (builder/validator/orchestrator)
- ❌ No WIH-style execution contracts
- ❌ No event-sourced ledger

### 2.3 Skills System

Axel's skill portability is its strongest feature:

```yaml
# AXEL.md - Skills configuration
skills:
  - path: ./skills           # Local skills
  - path: ~/.config/axel/skills  # Global skills

# Skills are symlinked to LLM-specific directories:
# ~/.claude/commands/       → Claude Code
# ~/.codex/agents/          → OpenAI Codex
# ~/.opencode/skills/       → OpenCode
```

**Skills format:** Markdown files with frontmatter, similar to a2rchitech's prompts.

### 2.4 Workspace & Session Management

Axel excels at terminal workspace orchestration:

```yaml
# AXEL.md - Workspace layout
workspace: myproject

layouts:
  panes:
    - type: claude
      skills: ["*"]
    - type: custom
      name: backend
      command: npm run dev
      
  grids:
    default:
      type: tmux
      claude: { col: 0, row: 0 }
      backend: { col: 1, row: 0 }
```

---

## 3. Comparative Analysis

### 3.1 Feature Matrix

| Feature | A2rchitech Rails | Axel | Notes |
|---------|-----------------|------|-------|
| **Task Dependencies** | ✅ Full DAG | ❌ None | Axel is priority queue only |
| **Gate System** | ✅ Multi-gate validation | ❌ None | A2r has validator_pass, tests_green, etc. |
| **Role Separation** | ✅ Builder/Validator/Orchestrator | ❌ None | Axel assigns to LLM, not role |
| **Event Sourcing** | ✅ Ledger-based | ❌ None | A2r has full event log |
| **WIH Contracts** | ✅ Execution envelopes | ❌ None | Axel has simple task descriptions |
| **Mail System** | ✅ Built-in | ❌ None | Axel has SSE inbox only |
| **Worktree Isolation** | ✅ Manual | ✅ Automatic | Axel's git integration is smoother |
| **Terminal Multiplexer** | ❌ None | ✅ tmux-native | Axel's tmux integration is superior |
| **Skills Portability** | ⚠️ Limited | ✅ Multi-LLM | Axel supports Claude/Codex/OpenCode/Antigravity |
| **Native UI** | ⚠️ In Progress | ✅ SwiftUI app | Axel-app has polished macOS UI |
| **CRDT Sync** | ❌ None | ✅ Automerge | Axel has conflict-free collaboration |
| **Session Recovery** | ⚠️ Basic | ✅ Full | Axel can restore entire workspace |

### 3.2 Architecture Philosophy

| Aspect | A2rchitech Rails | Axel |
|--------|-----------------|------|
| **Primary Goal** | Enterprise agent governance | Developer productivity |
| **Complexity** | High - Full audit/compliance | Low - Get things done |
| **Safety** | Maximum (gates, policy, receipts) | Moderate (user approval) |
| **Scale** | Multi-agent orchestration | Single-agent sessions |
| **Domain** | Enterprise workflows | Coding tasks |

---

## 4. Recommendations

### 4.1 What NOT to Adopt

| Component | Reason |
|-----------|--------|
| **Axel's Task Queue** | Too simple - a2r's DAG/WIH is more sophisticated |
| **Axel's Event System** | No event sourcing - a2r's ledger is superior |
| **Axel's Gate System** | No gates - a2r's multi-gate validation is required |
| **Full Axel Integration** | Architectural mismatch - axel is for single developers, a2r is for enterprise orchestration |

### 4.2 What TO Adopt (High Value)

#### 4.2.1 Skills Portability System ⭐⭐⭐ HIGH PRIORITY

**Current Gap:** a2rchitech skills are locked into specific LLM directories.

**Proposed Implementation:**

```rust
// 0-substrate/a2r-skill-portability/src/lib.rs
pub struct SkillPortabilityEngine {
    drivers: HashMap<LLMType, Box<dyn SkillDriver>>,
}

pub enum LLMType {
    Claude,
    Codex,
    OpenCode,
    Antigravity,  // Google's agent
    Kimi,         // Add Kimi support
}

pub trait SkillDriver {
    fn install_skill(&self, skill: &Skill, target_dir: &Path) -> Result<()>;
    fn sync_skills(&self, source_dir: &Path) -> Result<()>;
}
```

**Benefits:**
- Write skills once, use across any LLM
- Easier skill versioning and updates
- Vendor independence

#### 4.2.2 Terminal Multiplexer Integration ⭐⭐⭐ HIGH PRIORITY

**Current Gap:** a2rchitech has no native terminal workspace management.

**Proposed Implementation:**

```rust
// 4-services/orchestration/workspace-service/src/tmux.rs
pub struct WorkspaceOrchestrator {
    session_manager: TmuxSessionManager,
    agent_panes: HashMap<AgentId, PaneId>,
}

impl WorkspaceOrchestrator {
    pub async fn spawn_agent_pane(&self, agent: &Agent, wih: &WIH) -> Result<PaneId> {
        // Create tmux pane for agent execution
        // Link to WIH context
        // Enable live log streaming
    }
}
```

**Integration with Rails:**
```yaml
# WIH extension for terminal context
wih_version: 2  # New version
terminal_context:
  session_id: "sess-abc123"
  pane_id: "session:0.2"
  worktree_path: ".a2r/worktrees/feature-xyz"
  log_stream_endpoint: "ws://localhost:3011/stream"
```

#### 4.2.3 Git Worktree Automation ⭐⭐ MEDIUM PRIORITY

**Current Gap:** Worktrees are manual in a2rchitech.

**Borrow from Axel:**
```rust
// 2-governance/worktree-manager/src/lib.rs
pub struct WorktreeManager {
    base_repo: PathBuf,
    worktree_root: PathBuf,
}

impl WorktreeManager {
    pub async fn ensure_worktree(&self, branch: &str) -> Result<WorktreeInfo> {
        // Auto-create branch + worktree
        // Link to DAG node
        // Cleanup on node completion
    }
}
```

**Integration with DAG:**
```yaml
# DAG node with worktree
nodes:
  - id: "N1"
    wih: "work_items/T1042.md"
    depends_on: []
    worktree:
      branch_prefix: "agent/"
      auto_create: true
      cleanup_on_done: false  # Keep for review
```

#### 4.2.4 Native UI Patterns ⭐⭐ MEDIUM PRIORITY

**Borrow from Axel-app:**

- **Things-like inbox** for agent requests
- **Five-column layout**: Tasks | Inbox | Terminals | Skills | Team
- **Live terminal embedding** (Ghostty integration)
- **CRDT sync** for multi-device state

**Proposed for a2rchitech Shell:**
```typescript
// 6-ui/shell/src/components/WorkspaceLayout.tsx
interface WorkspaceLayout {
  columns: {
    dagStatus: DagStatusColumn;      // Current DAG execution
    inbox: InboxColumn;               // Permission requests
    terminals: TerminalGridColumn;    // Live agent panes
    skills: SkillBrowserColumn;       // Available skills
    mail: MailColumn;                 // A2R Mail integration
  }
}
```

#### 4.2.5 Session Recovery ⭐ MEDIUM PRIORITY

**Borrow from Axel:**
```rust
// 4-services/orchestration/session-service/src/recovery.rs
pub struct SessionRecovery {
    ledger: Arc<Ledger>,
}

impl SessionRecovery {
    pub async fn snapshot_session(&self, session_id: &str) -> Result<SessionSnapshot> {
        // Capture: DAG state, active WIHs, terminal layouts, worktrees
    }
    
    pub async fn restore_session(&self, snapshot: SessionSnapshot) -> Result<()> {
        // Reconstruct entire workspace
    }
}
```

### 4.3 Integration Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    A2RCHITECH SHELL (Enhanced)                      │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────────┐   │
│  │  DAG View   │ │   Inbox     │ │   Terminal Grid (NEW)       │   │
│  │  (Existing) │ │  (Existing) │ │   • Live tmux panes         │   │
│  │             │ │             │ │   • Agent session attach    │   │
│  └─────────────┘ └─────────────┘ └─────────────────────────────┘   │
│  ┌─────────────┐ ┌─────────────────────────────────────────────┐   │
│  │ Skills Hub  │ │   Mail / Collaboration                      │   │
│  │ (Enhanced)  │ │   (Existing)                                │   │
│  │ • Cross-LLM │ │                                             │   │
│  │   sync      │ │                                             │   │
│  └─────────────┘ └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      A2R RAILS (3011)                               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────────┐   │
│  │   DAG    │ │   WIH    │ │   Gate   │ │ Workspace (NEW)      │   │
│  │  Engine  │ │  Engine  │ │  Engine  │ │ • tmux orchestration │   │
│  │          │ │          │ │          │ │ • Worktree mgmt      │   │
│  │          │ │          │ │          │ │ • Session recovery   │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 5. Implementation Roadmap

### Phase 1: Skills Portability (2-3 weeks)
1. Create `a2r-skill-portability` crate in 0-substrate
2. Implement drivers for Claude, Codex, OpenCode
3. Add skill sync command to CLI
4. Update skill format to be LLM-agnostic

### Phase 2: Terminal Integration (3-4 weeks)
1. Create `workspace-service` in 4-services
2. Implement tmux session management
3. Add terminal grid to Shell UI
4. Link terminal context to WIH execution

### Phase 3: Worktree Automation (2 weeks)
1. Extend DAG schema with worktree config
2. Auto-create worktrees on node start
3. Cleanup policies (on-done, on-dag-complete, never)
4. Worktree garbage collection

### Phase 4: UI Enhancements (4-6 weeks)
1. Implement five-column layout
2. Add live terminal embedding
3. CRDT sync for multi-device
4. Session recovery UI

---

## 6. Code References

### Axel (Rust CLI)
- **Source:** https://github.com/txtx/axel
- **Key Files:**
  - `crates/core/src/config.rs` - AXEL.md parsing
  - `crates/core/src/tmux.rs` - tmux integration
  - `crates/cli/src/commands/session.rs` - Session management
  - `crates/core/src/drivers/` - LLM-specific skill drivers

### Axel-app (SwiftUI)
- **Source:** https://github.com/txtx/axel-app
- **Key Patterns:**
  - Automerge CRDT for sync
  - SSE inbox for real-time events
  - Ghostty terminal embedding
  - Things-like task list UI

---

## 7. Conclusion

**Axel is complementary, not a replacement.** Its strengths (terminal multiplexing, skills portability, developer UX) can significantly enhance a2rchitech's enterprise-grade Rails system without compromising its governance and audit capabilities.

**Key Takeaway:** Adopt axel's "developer experience" patterns while keeping a2rchitech's "enterprise orchestration" foundation.

---

## Appendix: A2R vs Axel Code Comparison

### Task/DAG Definition

```yaml
# A2rchitech (dag-schema.md) - Full DAG with gates
dag_version: 1
dag_id: "D2026-02-07"
nodes:
  - id: "N1"
    wih: "work_items/T1042.md"
    depends_on: []
    gates: ["validator_pass", "tests_green"]
    roles:
      orchestrator: "agent.orchestrator"
      builder: "agent.builder"
      validator: "agent.validator"
```

```yaml
# Axel - Simple linear task
task:
  id: "T123"
  title: "Refactor API"
  priority: high
  assignee: "claude"
  # No dependencies, no gates, no roles
```

### Session Management

```rust
// A2rchitech - Event-sourced
pub struct DagNode {
    pub node_id: String,
    pub status: String,  // NEW | READY | RUNNING | DONE | FAILED
    pub current_wih_id: Option<String>,
    pub state: HashMap<String, String>,
}
// Events appended to ledger for audit
```

```rust
// Axel - Direct tmux control
pub fn launch_pane(config: &PaneConfig) -> Result<()> {
    tmux::new_session(&session_name)?;
    tmux::split_window(&session_name, &command)?;
    // No event log, direct process management
}
```
