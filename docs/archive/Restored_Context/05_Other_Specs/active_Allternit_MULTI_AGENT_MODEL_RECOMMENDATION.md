# Allternit Multi-Agent Model - Design Recommendations

## Executive Summary

After analyzing the codebase and the Allternit architecture spec, here are my recommendations for the multi-agent workspace model.

---

## 1. Recommended: Hybrid Agent Model

### Core Concept: "Agent as Profile + Session"

An "Agent" in Allternit is not a full isolated instance, but rather:
- A **Profile** (IDENTITY.md + SOUL.md + capabilities)
- A **Session** (context pack + working memory)
- A **Scope** (file permissions + tool access)

```
┌─────────────────────────────────────────────────────────────────┐
│                    Allternit Workspace                                │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │   Primary   │  │  Reviewer   │  │  Researcher │             │
│  │   Agent     │  │  Subagent   │  │  Subagent   │             │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘             │
│         │                │                │                     │
│         └────────────────┼────────────────┘                     │
│                          │                                      │
│         ┌────────────────▼────────────────┐                    │
│         │     Shared Workspace State      │                    │
│         │  • AGENTS.md (constitution)     │                    │
│         │  • USER.md (user preferences)   │                    │
│         │  • TOOLS.md (environment)       │                    │
│         │  • memory/ (logs, tasks)        │                    │
│         │  • outputs/ (artifacts)         │                    │
│         └─────────────────────────────────┘                    │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              .allternit/ System Directory                      │   │
│  │  • agents/{name}/manifest.json  (per-agent config)      │   │
│  │  • agents/{name}/state/         (per-agent state)       │   │
│  │  • agents/{name}/context/       (per-agent context)     │   │
│  │  • shared/                      (cross-agent state)     │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Directory Structure (Recommended)

### Single Agent (Default)
```
workspace/
├── AGENTS.md              # Constitution
├── IDENTITY.md            # Agent identity (default/primary)
├── SOUL.md                # Style
├── USER.md                # User preferences
├── TOOLS.md               # Environment
└── .allternit/
    └── agents/
        └── default/       # Primary agent state
            ├── manifest.json
            └── state/
```

### Multi-Agent Workspace
```
workspace/
├── AGENTS.md              # Workspace constitution (applies to all)
├── agents/                # [OPTIONAL] Multi-agent profiles
│   ├── primary/
│   │   ├── IDENTITY.md    # "You are the main coding assistant..."
│   │   └── SOUL.md
│   ├── reviewer/
│   │   ├── IDENTITY.md    # "You are a code reviewer..."
│   │   └── SOUL.md
│   └── researcher/
│       ├── IDENTITY.md    # "You are a research specialist..."
│       └── SOUL.md
│
├── IDENTITY.md            # Fallback/default identity
├── SOUL.md                # Fallback/default soul
├── USER.md                # Shared user preferences
└── .allternit/
    └── agents/
        ├── primary/
        │   ├── manifest.json
        │   └── state/
        ├── reviewer/
        │   ├── manifest.json
        │   └── state/
        └── researcher/
            ├── manifest.json
            └── state/
```

---

## 3. Open Questions - Recommendations

### Q1: Agent Isolation - Memory Directory

**Recommendation: Shared Memory with Namespacing**

```
memory/
├── YYYY-MM-DD.md              # Shared daily log (all agents append)
├── active-tasks.md            # Shared task ledger
│                              #   (agents claim tasks by ID)
├── lessons.md                 # Shared lessons learned
├── self-review.md             # Shared health checks
└── agents/
    ├── primary/
    │   └── scratchpad.md      # Private working notes
    ├── reviewer/
    │   └── scratchpad.md
    └── researcher/
        └── scratchpad.md
```

**Rationale:**
- Agents collaborate on same codebase → shared context
- Daily logs should capture ALL agent activity
- Private scratchpads for agent-specific notes
- Task ledger shows what ANY agent is working on

---

### Q2: AGENTS.md Multiplicity

**Recommendation: Hierarchical Constitution**

```
workspace/
├── AGENTS.md              # Workspace constitution (applies to all)
└── agents/
    └── reviewer/
        ├── AGENTS.md      # [OPTIONAL] Agent-specific overrides
        ├── IDENTITY.md
        └── SOUL.md
```

**Merge Order (weakest → strongest):**
1. `agents/{name}/SOUL.md` (style)
2. `agents/{name}/IDENTITY.md` (identity)
3. `agents/{name}/AGENTS.md` (agent-specific rules)
4. `AGENTS.md` (workspace constitution - FINAL AUTHORITY)

**Conflict Resolution:**
- Workspace AGENTS.md wins over agent-specific AGENTS.md
- Use "unless overridden" clauses for flexibility

---

### Q3: Context Pack Size

**Recommendation: Streaming with Compression**

```rust
pub struct ContextPack {
    /// Unique pack ID
    pub id: String,
    
    /// Timestamp
    pub created_at: DateTime<Utc>,
    
    /// Size limit: 100KB compressed
    pub max_size: usize = 100_000,
    
    /// Compression: zstd
    pub compression: CompressionAlgorithm = Zstd,
    
    /// If pack exceeds limit, split into chunks
    pub chunks: Option<Vec<String>>, // IDs of chunk files
    
    /// Summary for quick reference (always loaded)
    pub summary: ContextSummary,
}

pub struct ContextSummary {
    pub agent_name: String,
    pub agent_role: String,
    pub current_task: String,
    pub recent_lessons: Vec<String>, // Last 5
    pub key_preferences: Vec<String>, // User preferences
}
```

**Size Limits:**
- Summary: Always loaded (< 2KB)
- Full pack: Loaded on demand (< 100KB)
- Historical packs: Archived after 7 days

---

### Q4: Heartbeat Frequency

**Recommendation: Configurable with Sensible Defaults**

```json
{
  "automation": {
    "heartbeat": {
      "enabled": true,
      "interval_seconds": 300,  // 5 minutes default
      "max_runtime_seconds": 60,
      "agent_specific": {
        "primary": { "interval_seconds": 300 },
        "reviewer": { "interval_seconds": 600 },  // Less frequent
        "researcher": { "enabled": false }  // On-demand only
      }
    }
  }
}
```

**Heartbeat Tasks by Agent Type:**
- **Primary**: Check tasks, self-review, context pressure
- **Reviewer**: Check for pending reviews, stale PRs
- **Researcher**: Update indices, refresh external data

---

### Q5: Receipt Retention

**Recommendation: Tiered Retention with Compression**

```
.allternit/receipts/
├── current/                    # Last 7 days (uncompressed)
│   └── YYYY-MM-DD.jsonl
├── archive/                    # 7-90 days (compressed)
│   └── YYYY-MM-DD.jsonl.zst
└── cold/                       # 90+ days (offload to storage)
    └── (configurable: delete or move to S3/etc)
```

**Retention Policy:**
```json
{
  "receipts": {
    "enabled": true,
    "retention": {
      "hot_days": 7,      // Keep uncompressed
      "warm_days": 90,    // Keep compressed
      "cold_storage": {   // After 90 days
        "enabled": true,
        "destination": "s3://my-bucket/allternit-receipts/"
      }
    }
  }
}
```

---

### Q6: Migration Strategy

**Recommendation: In-Place with Backup**

```rust
pub enum MigrationStrategy {
    /// Migrate files in place, create backup
    InPlace { backup_suffix: String },
    
    /// Copy to new location, leave original
    CopyTo { destination: PathBuf },
    
    /// Keep both, symlink .allternit to new location
    Dual { primary: PathBuf },
}

impl Default for MigrationStrategy {
    fn default() -> Self {
        MigrationStrategy::InPlace { 
            backup_suffix: ".openclaw-backup".to_string() 
        }
    }
}
```

**Migration Process:**
1. Detect legacy format
2. Show migration plan
3. Create backup (`.openclaw-backup/`)
4. Create `.allternit/` directory
5. Copy/move files
6. Generate manifest
7. Verify boot order works
8. Mark as migrated

---

## 4. Agent Creation Wizard (Updated)

### Flow for Multi-Agent Workspace

```
/agent create
    ↓
"Create new agent in workspace?"
    ↓
Agent Name: [________]
    ↓
Agent Role:
  [1] Primary - Main coding assistant
  [2] Reviewer - Code review specialist
  [3] Researcher - Exploration agent
  [4] Custom - Define your own
    ↓
"Create in:"
  [1] agents/{name}/ (multi-agent workspace)
  [2] Root workspace (single agent)
    ↓
"Inherit from workspace AGENTS.md?"
  [Y/n]
    ↓
"Copy settings from existing agent?"
  [1] None (start fresh)
  [2] Primary (copy and modify)
  [3] Reviewer (copy and modify)
    ↓
Configure Identity (emoji, nature, vibe)
    ↓
Configure Mode (primary/subagent/all)
    ↓
Configure Tools (multi-select)
    ↓
Configure Scope (file paths)
    ↓
System Prompt (manual or AI)
    ↓
Review & Create
```

---

## 5. Implementation Priority

### P0 (Critical Path)
1. Single-agent Allternit workspace (Foundation)
2. Boot order B0 with all phases
3. `.allternit/` directory structure
4. Context pack builder

### P1 (High Priority)
5. OpenClaw migration wizard
6. Multi-agent directory structure
7. Agent switching in TUI
8. Per-agent state isolation

### P2 (Medium Priority)
9. Subagent spawning with scope
10. Concurrent agent execution
11. File locking system
12. Shared memory model

### P3 (Future)
13. Heartbeat per-agent configuration
14. Receipt archival system
15. Cold storage integration

---

## 6. Summary

**Key Decisions:**

| Question | Recommendation |
|----------|----------------|
| Memory isolation | Shared with private scratchpads |
| AGENTS.md | Hierarchical (workspace + per-agent) |
| Context packs | 100KB limit, streaming, compression |
| Heartbeat | Configurable per-agent |
| Receipts | Tiered retention (hot/warm/cold) |
| Migration | In-place with backup |
| Multi-agent | agents/ directory, shared workspace |

**Next Action:**
Start implementing **P0 (Single-agent Allternit foundation)** while keeping the multi-agent structure in mind for P1.
