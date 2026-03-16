# A2R Agent Workspace

> **⚠️ IMPORTANT:** This is the **CLIENT-SIDE** agent workspace runtime, NOT the kernel.

[![Crates.io](https://img.shields.io/crates/v/a2r-agent-workspace)](https://crates.io/crates/a2r-agent-workspace)
[![Documentation](https://docs.rs/a2r-agent-workspace/badge.svg)](https://docs.rs/a2r-agent-workspace)
[![License](https://img.shields.io/badge/license-MIT%2FApache--2.0-blue)](LICENSE)

## Overview

The `a2r-agent-workspace` crate provides the **5-layer living workspace architecture** for AI agents. It is the bridge between users/agents and the kernel's deterministic enforcement systems.

### Key Principle

```
┌─────────────────────────────────────────────────────────────────────┐
│  KERNEL (Authoritative)          │  MARKDOWN         │  AGENT       │
│  ─────────────────────           │  ────────         │  ─────       │
│  • System Law                    │  • AGENTS.md      │  • Reads     │
│  • Governance Engine             │  • IDENTITY.md    │  • Decides   │
│  • Policy Enforcement            │  • POLICY.md      │  • Acts      │
│  • Ledger/Receipts               │  • MEMORY.md      │  • Logs      │
└─────────────────────────────────────────────────────────────────────┘
          ↑                           ↑                         ↑
          │                           │                         │
          └─────────── SYNC ──────────┴──────── REHYDRATE ─────┘
```

**The Kernel enforces.** The Markdown distills. The Agent consumes.

## Installation

### As a Dependency

```toml
[dependencies]
a2r-agent-workspace = "0.1.0"
```

### CLI Binary

```bash
cargo install a2r-agent-workspace --bin workspace-cli
```

## Quick Start

### 1. Initialize a Workspace

```rust
use a2r_agent_workspace::initialize_workspace;
use std::path::Path;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let workspace = Path::new("./my-agent");
    let context = initialize_workspace(workspace).await?;
    
    println!("Agent: {}", context.agent_name());
    println!("Focus: {}", context.current_focus());
    
    Ok(())
}
```

### 2. Check Policy

```rust
use a2r_agent_workspace::{PolicyEngine, PolicyDecision};
use std::collections::HashMap;

let engine = PolicyEngine::from_workspace("./my-agent")?;
let args = HashMap::new();

match engine.check_tool("filesystem.delete", &args) {
    PolicyDecision::Allow => println!("Tool allowed"),
    PolicyDecision::RequireApproval(reason) => {
        println!("Approval required: {}", reason)
    }
    PolicyDecision::Deny(reason) => println!("Denied: {}", reason),
}
```

### 3. Build Context Pack

```rust
use a2r_agent_workspace::ContextPackBuilder;

let mut builder = ContextPackBuilder::new("./my-agent");
builder.load_identity()?;
builder.load_governance()?;
builder.load_cognitive()?;
builder.load_skills()?;
builder.build_summary()?;

let pack = builder.build()?;
println!("Context pack: {} bytes", pack.total_size_bytes());
```

## The 5 Layers

### Layer 1: Cognitive Persistence
- `BRAIN.md` - Task graph human view
- `MEMORY.md` - Memory index
- `memory/*.md` - Daily session logs
- `memory/active-tasks.md` - Current task queue
- `memory/lessons.md` - Curated learnings

### Layer 2: Identity Stabilization
- `IDENTITY.md` - Agent identity (name, nature, vibe)
- `SOUL.md` - Agent behavior guidelines
- `USER.md` - User preferences
- `VOICE.md` - Voice configuration
- `POLICY.md` - Runtime policy overrides

### Layer 3: Governance & Decision
- `AGENTS.md` - Supreme law (constitution)
- `PLAYBOOK.md` - Operational procedures
- `TOOLS.md` - Tool configuration
- `HEARTBEAT.md` - Periodic tasks
- `SYSTEM.md` - Environment constraints

### Layer 4: Modular Skills
- `skills/{name}/SKILL.md` - Human-readable skill procedure
- `skills/{name}/contract.json` - Machine-readable skill contract
- `skills/_template/` - Template for new skills

### Layer 5: Business Topology
- `CLIENTS.md` - Client registry
- `business/crm/` - Contact management
- `business/projects/` - Project workspaces
- `business/content/` - Content templates

## CLI Usage

The `workspace-cli` binary provides command-line access:

```bash
# Initialize a new workspace
a2r-workspace init --name my-agent --nature "Code Assistant"

# Boot the workspace
a2r-workspace boot

# Check workspace status
a2r-workspace status

# Check policy for a tool
a2r-workspace check filesystem.delete

# List skills
a2r-workspace skills

# Build context pack
a2r-workspace build-pack
```

## API Reference

### Boot Sequence

```rust
use a2r_agent_workspace::BootSequence;

let mut boot = BootSequence::new("./workspace");
let context = boot.run().await?;

// Access boot events
for event in boot.events() {
    println!("{:?}: {}", event.phase, event.description);
}
```

### Policy Engine

```rust
use a2r_agent_workspace::{PolicyEngine, PolicyDecision, SafetyTier};

let engine = PolicyEngine::from_workspace("./workspace")?;

// Check tool call
let decision = engine.check_tool("tool_id", &args);

// Check file operation
use std::path::Path;
let decision = engine.check_file_op(Path::new("file.txt"), FileOperation::Write);

// Add temporary permission
engine.grant_temporary("permission".to_string());
```

### Skills Registry

```rust
use a2r_agent_workspace::SkillsRegistry;

let registry = SkillsRegistry::from_directory("./workspace/skills")?;

// Find matching skills
let context = HashMap::new();
let matches = registry.find_matching("search query", &context);

// Get skill by ID
if let Some(skill) = registry.get("skill-id") {
    println!("Skill: {} - {}", skill.id, skill.intent);
}
```

### Checkpoint System

```rust
use a2r_agent_workspace::checkpoint::{CheckpointManager, AgentState, TaskState};

let manager = CheckpointManager::new("./workspace");

// Create checkpoint
let checkpoint = manager.create(
    "session-1",
    AgentState { /* ... */ },
    TaskState { /* ... */ },
)?;

// Get latest checkpoint
if let Some(latest) = manager.latest()? {
    println!("Latest checkpoint: {}", latest.id);
}

// Restore from checkpoint
manager.restore(&checkpoint.id)?;
```

## Integration with Kernel

The Agent Workspace is **NOT** the kernel. It syncs with kernel infrastructure:

| Function | Kernel (Authoritative) | Agent Workspace (Client) |
|----------|------------------------|--------------------------|
| Policy Enforcement | PreToolUse gates | Fast client-side checks |
| Ledger | Canonical receipts | Human-readable logs |
| Context Packs | WIH scope, contracts | 5-layer agent context |
| Skills | SkillRegistry | Skills index + routing |
| Checkpoints | State machine | Session recovery |

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  KERNEL (Rust)           │  MARKDOWN                │  AGENT         │
│  ───────────             │  ────────                │  ─────         │
│  • System Law            │  • AGENTS.md             │  • Reads       │
│  • Governance Engine     │  • IDENTITY.md           │  • Decides     │
│  • Policy Enforcement    │  • POLICY.md             │  • Acts        │
│  • Ledger/Receipts       │  • MEMORY.md             │  • Logs        │
│  • Context Pack Builder  │  • BRAIN.md              │  • Syncs       │
└─────────────────────────────────────────────────────────────────────┘
          ↑                           ↑                         ↑
          │                           │                         │
          └─────────── SYNC ──────────┴──────── REHYDRATE ─────┘
```

## File Locations

### Global (5-agents/)
- `AGENTS.md` - Supreme law (locked)
- `POLICY.md` - Base policy
- `spec/` - Specifications and contracts
- `packs/` - Prompt packs
- `roles/` - Role envelopes
- `cookbooks/` - Deterministic procedures

### Per-Workspace (.a2r/)
```
.a2r/
├── manifest.json                # Workspace metadata
├── brain/
│   └── BRAIN.md                 # Task graph human view
├── memory/                      # Session logs
├── identity/                    # IDENTITY.md, SOUL.md, USER.md
├── governance/                  # PLAYBOOK.md, TOOLS.md
├── skills/                      # Skill definitions
├── business/                    # Client/project topology
├── contracts/                   # Indices
└── state/                       # Machine-readable state
```

## Deterministic Rehydration

At every context boundary, the agent is rehydrated:

1. **New session** → Full boot sequence
2. **Post-compaction** → Load checkpoint + recent memory
3. **Subagent spawn** → Inherit parent context pack
4. **Tool call boundary** → Policy check + receipt logging
5. **Crash recovery** → Restore from checkpoint

## WASM Build for Shell UI

The crate can be compiled to WebAssembly for use in browser environments:

### Prerequisites

```bash
cargo install wasm-bindgen-cli --version 0.2.89
```

### Build Commands

```bash
# Build for std (CLI usage)
cargo build --features std

# Build WASM package for browser
cargo build --target wasm32-unknown-unknown --no-default-features --features wasm --release

# Generate JS/TS bindings
wasm-bindgen target/wasm32-unknown-unknown/release/a2r_agent_workspace.wasm \
  --out-dir pkg \
  --typescript \
  --target web
```

Or use the build script:

```bash
./scripts/build-wasm.sh
```

### TypeScript Integration

```typescript
// Import the WASM module
import { WorkspaceApi } from '@a2r/agent-workspace';

// Create workspace instance
const workspace = new WorkspaceApi('/path/to/workspace');

// Boot the workspace
const result = await workspace.boot();
console.log(result);

// Check policy
const policyResult = workspace.checkTool('filesystem.write');
console.log(policyResult);

// Get metadata
const meta = workspace.getMetadata();
```

See `6-ui/a2r-platform/src/agent-workspace/` for full TypeScript integration.

## License

Licensed under either of:

- Apache License, Version 2.0 ([LICENSE-APACHE](LICENSE-APACHE))
- MIT license ([LICENSE-MIT](LICENSE-MIT))

at your option.

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for details.

## See Also

- `5-agents/AGENT_WORKSPACE_ARCHITECTURE.md` - Full architecture documentation
- `5-agents/AGENTS.md` - Supreme law (all agents must read)
- `7-apps/cli/` - CLI implementation using this crate
