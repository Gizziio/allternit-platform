# Allternit Persistent Agent Architecture - Full Implementation Plan

## Executive Summary

Implement the complete Allternit architecture that unifies the codebase under a deterministic workspace model with extended boot order, migration support, and multi-agent capabilities.

---

## 1. Extended Boot Order B0 (Enhanced)

Based on codebase analysis, here is the complete boot sequence:

```
B0 - Deterministic Boot Order
═══════════════════════════════════════════════════════════════

PHASE 1: SYSTEM INITIALIZATION
─────────────────────────────────────────────────────────────
1. Lock Acquisition
   └─> Obtain workspace lock: .allternit/state/locks/workspace.lock
   └─> TTL-based advisory lock with heartbeat refresh

2. Load Manifest
   └─> Read .allternit/manifest.json
   └─> Validate workspace version, engine version
   └─> Load policies (workspace_boundary, network, destructive, etc.)

3. Crash Recovery
   └─> Read memory/active-tasks.md FIRST
   └─> Load .allternit/state/taskgraph.json
   └─> Reconcile active-tasks.md ↔ taskgraph.json
   └─> Detect stale tasks (>2h no update)

PHASE 2: IDENTITY & GOVERNANCE
─────────────────────────────────────────────────────────────
4. Load IDENTITY.md
   └─> Agent name, nature, vibe, emoji, avatar
   └─> Parse into structured identity pack

5. Load AGENTS.md (Agent Constitution)
   └─> Binding operational law
   └─> Parse sections: Boot, Permissions, Safety, Workflow, Escalation
   └─> Extract: allowed paths, tool tiers, approval requirements, DoD

6. Load SOUL.md (Style Profile)
   └─> Non-binding behavioral guidelines
   └─> Tone/personality constraints
   └─> Merged with but does not override AGENTS.md

7. Load USER.md (User Contract)
   └─> Stable user preferences
   └─> Operating assumptions
   └─> Communication style preferences

PHASE 3: ENVIRONMENT & TOOLS
─────────────────────────────────────────────────────────────
8. Load TOOLS.md (Environment Profile)
   └─> Commands, repo roots, test runners
   └─> Secrets policy (env var names only)
   └─> External tool configurations

9. Load SYSTEM.md (System Law) [NEW]
   └─> Hardware/environment constraints
   └─> Rate limits, quotas
   └─> Integration endpoints
   └─> Platform-specific rules

10. Load CHANNELS.md (Channel Configuration) [NEW]
    └─> Multi-channel messaging setup
    └─> Platform integrations (Discord, Slack, etc.)
    └─> Routing rules for outputs

11. Load POLICY.md (Dynamic Policies) [NEW]
    └─> Runtime policy overrides
    └─> Experiment flags
    └─> A/B test configurations

PHASE 4: MEMORY HYDRATION
─────────────────────────────────────────────────────────────
12. Load MEMORY.md (Curated Long-Term Memory)
    └─> Small, stable "what matters"
    └─> Key decisions, lessons, preferences

13. Load memory/YYYY-MM-DD.md (Daily Logs)
    └─> Today + yesterday (if exists)
    └─> Append-only, timestamped events
    └─> Index into .allternit/state/checkpoints.jsonl

14. Load memory/active-tasks.md (Crash Recovery Ledger)
    └─> Human-readable resume file
    └─> In Progress / Blocked / Recently Completed
    └─> Sync with .allternit/state/taskgraph.json

15. Load memory/lessons.md (Policy Delta Feedstock)
    └─> Mistakes that must not repeat
    └─> Tagged for: policy gates, skill routing, tool restrictions

16. Load memory/self-review.md (Self-Audit Record)
    └─> Periodic introspection
    └─> Health/metrics updates
    └─> Stuck detection notes

PHASE 5: CAPABILITIES
─────────────────────────────────────────────────────────────
17. Index Skills
    └─> Scan skills/ directory
    └─> Parse each SKILL.md + contract.json
    └─> Build .allternit/contracts/skills.index.json
    └─> Compile routing predicates

18. Load Tool Registry
    └─> Read .allternit/contracts/tools.registry.json
    └─> Load schemas from .allternit/contracts/schemas/
    └─> Validate tool definitions

19. Load Provider Config
    └─> Read provider-specific prompts (anthropic.txt, etc.)
    └─> Load model configurations
    └─> Initialize API credentials (env vars only)

PHASE 6: CONTEXT BUILD
─────────────────────────────────────────────────────────────
20. Build Context Pack
    └─> Compile all loaded files into deterministic bundle
    └─> Emit .allternit/context/pack.current.json
    └─> Archive previous pack to .allternit/context/pack.history/
    └─> Hash and sign context pack

21. Resume Work
    └─> Continue from active-tasks.md
    └─> Check heartbeat status
    └─> Run scheduled tasks if due
    └─> WITHOUT asking "what are we doing?"

═══════════════════════════════════════════════════════════════
```

---

## 2. Complete Directory Structure

### Workspace Root
```
workspace/
│
├── AGENTS.md                 # Agent Constitution (binding law)
├── SOUL.md                   # Style Profile (non-binding)
├── USER.md                   # User Contract
├── IDENTITY.md               # Role Declaration
├── TOOLS.md                  # Environment Profile
├── SYSTEM.md                 # System Law [NEW]
├── CHANNELS.md               # Channel Configuration [NEW]
├── POLICY.md                 # Dynamic Policies [NEW]
├── HEARTBEAT.md              # Automation Spec
├── MEMORY.md                 # Curated Long-Term Memory
│
├── memory/
│   ├── YYYY-MM-DD.md         # Daily event logs
│   ├── active-tasks.md       # Crash recovery ledger
│   ├── lessons.md            # Policy delta feedstock
│   └── self-review.md        # Self-audit record
│
├── outputs/                  # Generated artifacts
│   └── YYYY-MM-DD/
│       ├── artifacts/
│       └── receipts/
│
├── skills/                   # Procedure library
│   ├── _template/
│   │   ├── SKILL.md
│   │   └── contract.json
│   └── {skill-name}/
│       ├── SKILL.md
│       ├── contract.json
│       └── tests/
│
└── .allternit/                     # SYSTEM DIRECTORY (machine-managed)
    ├── manifest.json
    ├── workspace.lock
    │
    ├── state/
    │   ├── session.json
    │   ├── taskgraph.json
    │   ├── checkpoints.jsonl
    │   └── locks/
    │       ├── workspace.lock
    │       └── {agent-id}.lock
    │
    ├── contracts/
    │   ├── tools.registry.json
    │   ├── skills.index.json
    │   └── schemas/
    │       ├── WorkspaceManifest.schema.json
    │       ├── SkillContract.schema.json
    │       ├── TaskGraph.schema.json
    │       └── ToolsRegistry.schema.json
    │
    ├── context/
    │   ├── pack.current.json
    │   └── pack.history/
    │       └── {timestamp}.json
    │
    ├── receipts/
    │   ├── YYYY-MM-DD.jsonl
    │   └── toolcalls/
    │
    ├── observability/
    │   ├── metrics.jsonl
    │   └── traces.jsonl
    │
    └── quarantine/
        └── {timestamp}/
```

---

## 3. Migration: OpenClaw → Allternit

### 3.1 Detection
```rust
pub fn detect_legacy_workspace() -> Option<LegacyFormat> {
    // Check for OpenClaw structure
    if Path::new(".agent/IDENTITY.md").exists() 
        || Path::new("~/.openclaw/workspace/IDENTITY.md").exists() {
        return Some(LegacyFormat::OpenClaw);
    }
    
    // Check for Agent Studio structure
    if Path::new(".opencode/agent/").exists() {
        return Some(LegacyFormat::AgentStudio);
    }
    
    None
}
```

### 3.2 Migration Wizard
```
╔══════════════════════════════════════════════════════════════╗
║  Allternit Workspace Migration                                     ║
╠══════════════════════════════════════════════════════════════╣
║  Detected: OpenClaw workspace                                ║
║  Location: ~/.openclaw/workspace/                            ║
╚══════════════════════════════════════════════════════════════╝

Migration Plan:
  ✓ IDENTITY.md → IDENTITY.md (copy)
  ✓ SOUL.md → SOUL.md (copy)
  ✓ HEARTBEAT.md → HEARTBEAT.md (copy)
  ✓ memory/ → memory/ (copy)
  ✓ Create .allternit/manifest.json (new)
  ✓ Create .allternit/contracts/ (new)
  ✓ Create system directory structure (new)

Files to be created:
  - AGENTS.md (template with your identity)
  - USER.md (template)
  - TOOLS.md (template)
  - SYSTEM.md (template)
  - .allternit/ (entire system directory)

Proceed with migration? [y/n]: 
```

### 3.3 Migration Implementation
```rust
pub struct Migration;

impl Migration {
    /// Migrate from OpenClaw to Allternit
    pub fn from_openclaw(source: &Path, dest: &Path) -> Result<MigrationReport> {
        // 1. Copy core markdown files
        Self::copy_identity_files(source, dest)?;
        
        // 2. Create Allternit system directory
        Self::create_system_directory(dest)?;
        
        // 3. Generate manifest from OpenClaw metadata
        Self::generate_manifest(source, dest)?;
        
        // 4. Create template files that didn't exist in OpenClaw
        Self::create_template_files(dest)?;
        
        // 5. Index any existing skills
        Self::index_skills(dest)?;
        
        // 6. Build initial context pack
        Self::build_initial_context(dest)?;
        
        Ok(MigrationReport { /* ... */ })
    }
    
    /// Migrate from Agent Studio to Allternit
    pub fn from_agent_studio(source: &Path, dest: &Path) -> Result<MigrationReport> {
        // Similar process but parsing YAML frontmatter
        // Extracting identity, tools, mode from .md files
    }
}
```

### 3.4 Backward Compatibility
During transition period:
- Allternit loader checks `.allternit/` first
- Falls back to legacy locations if not found
- Warns user about legacy format
- Offers migration on startup

---

## 4. Multi-Agent Workspace Model

### 4.1 Concept: Workspace as Agent Capsule

Instead of "one workspace = one agent", the Allternit model supports:

```
Single Workspace with Multiple Agents
═══════════════════════════════════════════════════════════════

workspace/
├── AGENTS.md           # Primary agent constitution
├── agents/             # [NEW] Multi-agent directory
│   ├── primary/
│   │   ├── IDENTITY.md
│   │   ├── SOUL.md
│   │   └── HEARTBEAT.md
│   ├── reviewer/
│   │   ├── IDENTITY.md
│   │   ├── SOUL.md
│   │   └── HEARTBEAT.md
│   └── researcher/
│       ├── IDENTITY.md
│       ├── SOUL.md
│       └── HEARTBEAT.md
│
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

### 4.2 Agent Roles

| Role | Purpose | Mode | Scope |
|------|---------|------|-------|
| **Primary** | Main user-facing agent | primary | Full workspace |
| **Subagent** | Task-specific worker | subagent | Scoped paths |
| **Reviewer** | Code review specialist | subagent | Read-only + comments |
| **Researcher** | Exploration agent | subagent | Read-only |
| **Executor** | Tool runner | subagent | Specific toolsets |

### 4.3 Concurrency Model

```rust
pub struct AgentConcurrency {
    /// Maximum concurrent agents
    max_agents: usize,
    
    /// File locking required
    file_locking: bool,
    
    /// Lock directory
    lock_dir: PathBuf,
}

impl AgentConcurrency {
    /// Acquire write lock on file scope
    pub fn acquire_scope(&self, agent: &str, paths: &[PathBuf]) -> Result<ScopeLock> {
        // Check for conflicts with other agents
        // Create .allternit/state/locks/{agent}.lock
        // Register scope in lock file
    }
    
    /// No two agents may write the same file
    pub fn check_write_conflict(&self, path: &Path) -> Option<String> {
        // Returns Some(agent_id) if another agent holds lock
    }
}
```

### 4.4 Agent Selection in TUI

```
/agent                          # Shows current agent
/agent list                     # List all agents in workspace
/agent switch <name>            # Switch to agent
/agent create                   # Create new agent
/agent delete <name>            # Remove agent
```

### 4.5 Subagent Spawning

```rust
// From TUI or orchestrator
let subagent = Agent::spawn(SubagentConfig {
    parent: "primary",
    name: "code-reviewer",
    scope: Scope {
        read_paths: vec!["src/", "tests/"],
        write_paths: vec![], // Read-only reviewer
    },
    success_criteria: "Review complete with actionable feedback",
    timeout: Duration::from_minutes(10),
});
```

---

## 5. Implementation Phases

### Phase 1: Foundation (Week 1-2)
- [ ] Create `.allternit/` directory structure
- [ ] Implement `manifest.json` schema
- [ ] Build boot order B0 with existing files
- [ ] Update wizard to create Allternit structure
- [ ] Add migration detection

### Phase 2: Core Features (Week 3-4)
- [ ] Implement all B0 phases
- [ ] Context pack builder
- [ ] Tool registry loader
- [ ] Skills indexer
- [ ] Memory reconciliation

### Phase 3: Migration (Week 5)
- [ ] OpenClaw migration wizard
- [ ] Agent Studio migration
- [ ] Backward compatibility layer
- [ ] Migration tests

### Phase 4: Multi-Agent (Week 6)
- [ ] Agent directory structure
- [ ] Concurrency/locking
- [ ] Scope management
- [ ] Subagent spawning

### Phase 5: Advanced Features (Week 7-8)
- [ ] Heartbeat runner
- [ ] Task graph execution
- [ ] Receipt system
- [ ] Observability

---

## 6. New File Specifications

### SYSTEM.md
```markdown
# SYSTEM.md — System Law

## Hardware Constraints
- Max memory per agent: 4GB
- Max disk usage: 10GB
- Max runtime per task: 2 hours

## Rate Limits
- API calls per minute: 60
- File writes per minute: 120
- Network requests per minute: 30

## Integration Endpoints
- Kernel API: http://localhost:3004
- Metrics endpoint: http://localhost:9090
- Log aggregator: http://localhost:3100

## Platform Rules
- No secrets in workspace files
- All external calls must use allowlist
- Destructive actions require quarantine
```

### CHANNELS.md
```markdown
# CHANNELS.md — Channel Configuration

## Output Routing
- Primary: TUI
- Secondary: Discord (#agent-updates)
- Alerts: Slack (#alerts)

## Platform Integrations
### Discord
- Webhook: ${DISCORD_WEBHOOK_URL}
- Default channel: #general

### Slack
- Token: ${SLACK_BOT_TOKEN}
- Default channel: #agent-log

## Message Formatting
- Code blocks: Enabled
- Emoji: Enabled
- Mentions: Disabled (unless explicit)
```

---

## 7. Open Questions

1. **Agent Isolation**: Should each agent have its own memory/ directory, or share workspace memory?

2. **AGENTS.md Multiplicity**: One AGENTS.md for workspace, or per-agent AGENTS.md in agents/{name}/?

3. **Context Pack Size**: Max size limit? Compression? Streaming?

4. **Heartbeat Frequency**: Fixed 5 min, or configurable per agent?

5. **Receipt Retention**: How long to keep receipts? Archive policy?

6. **Migration Strategy**: In-place migration or copy to new location?

---

## 8. Next Steps

1. **Review this plan** - Confirm scope and priorities
2. **Answer open questions** - Resolve design decisions
3. **Start Phase 1** - Begin implementation
4. **Create test workspaces** - Validate boot order
5. **Document migration path** - User-facing guide
