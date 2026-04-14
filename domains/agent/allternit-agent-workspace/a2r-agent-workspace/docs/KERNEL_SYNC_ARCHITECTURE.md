# Kernel Sync Architecture

This document describes the architecture for synchronizing the agent workspace with the authoritative kernel.

## Current State

Currently, the agent workspace operates independently:
- Policy enforcement is client-side
- No canonical ledger integration
- Context packs are built locally
- Checkpoints are local files

## Target Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  KERNEL (Authoritative)          │  MARKDOWN         │  AGENT       │
│  ─────────────────────           │  ────────         │  ─────       │
│  • System Law                    │  • AGENTS.md      │  • Reads     │
│  • Governance Engine             │  • IDENTITY.md    │  • Decides   │
│  • Policy Enforcement            │  • POLICY.md      │  • Acts      │
│  • Ledger/Receipts               │  • MEMORY.md      │  • Logs      │
│  • Canonical Context Packs       │  • BRAIN.md       │  • Syncs     │
└─────────────────────────────────────────────────────────────────────┘
          ↑                           ↑                         ↑
          │                           │                         │
          └─────────── SYNC ──────────┴──────── REHYDRATE ─────┘
                          ↑
                    ┌─────────────┐
                    │ Sync Engine │
                    └─────────────┘
```

## Sync Flow

### 1. Boot-Time Sync

When the workspace boots, it syncs with the kernel:

```rust
// boot_sequence.rs
async fn boot(&mut self) -> Result<BootContext> {
    // Phase 1: Local validation
    self.validate_structure().await?;
    
    // Phase 2: Kernel sync (NEW)
    let sync = self.sync_with_kernel().await?;
    
    // Apply kernel updates
    if sync.has_updates() {
        self.apply_kernel_updates(sync.updates).await?;
    }
    
    // Phase 3: Load context
    self.load_context().await
}
```

### 2. Kernel Client

```rust
// src/kernel/client.rs

pub struct KernelClient {
    endpoint: String,
    credentials: Credentials,
    workspace_id: String,
}

impl KernelClient {
    pub async fn connect(config: KernelConfig) -> Result<Self> {
        // Establish connection to kernel
        // Authenticate workspace
        // Verify workspace registration
    }
    
    /// Pull receipts from kernel ledger
    pub async fn pull_receipts(&self, since: DateTime) -> Result<Vec<Receipt>> {
        // Query kernel's ledger for this workspace
        // Return receipts since last sync
    }
    
    /// Push local policy to kernel
    pub async fn push_policy(&self, policy: &Policy) -> Result<()> {
        // Submit policy for kernel validation
        // Get back canonical policy hash
    }
    
    /// Get canonical context pack
    pub async fn get_context_pack(&self) -> Result<ContextPack> {
        // Request context pack from kernel
        // Includes WIH scope and active contracts
    }
    
    /// Register a new checkpoint
    pub async fn register_checkpoint(&self, checkpoint: &Checkpoint) -> Result<CheckpointId> {
        // Submit checkpoint to kernel
        // Get canonical checkpoint ID
    }
}
```

### 3. Sync Engine

```rust
// src/sync/engine.rs

pub struct SyncEngine {
    kernel: KernelClient,
    workspace: Workspace,
    last_sync: DateTime,
}

impl SyncEngine {
    /// Full two-way sync
    pub async fn sync(&mut self) -> Result<SyncResult> {
        let mut result = SyncResult::default();
        
        // Pull from kernel
        result.pull = self.pull_from_kernel().await?;
        
        // Push to kernel
        result.push = self.push_to_kernel().await?;
        
        // Update sync timestamp
        self.last_sync = Utc::now();
        
        Ok(result)
    }
    
    async fn pull_from_kernel(&self) -> Result<PullResult> {
        // 1. Fetch new receipts
        let receipts = self.kernel.pull_receipts(self.last_sync).await?;
        
        // 2. Update MEMORY.md with receipts
        self.update_memory_files(&receipts).await?;
        
        // 3. Fetch canonical policy changes
        let policy = self.kernel.get_policy().await?;
        self.update_policy_file(&policy).await?;
        
        // 4. Fetch context pack updates
        let context = self.kernel.get_context_pack().await?;
        
        Ok(PullResult {
            receipts: receipts.len(),
            policy_updated: true,
            context,
        })
    }
    
    async fn push_to_kernel(&self) -> Result<PushResult> {
        // 1. Check for local policy changes
        if self.workspace.policy_changed() {
            let policy = self.workspace.read_policy_md().await?;
            self.kernel.update_policy(&policy).await?;
        }
        
        // 2. Push new checkpoints
        let checkpoints = self.workspace.pending_checkpoints().await?;
        for cp in checkpoints {
            self.kernel.register_checkpoint(&cp).await?;
        }
        
        // 3. Push skill registry updates
        let skills = self.workspace.updated_skills().await?;
        for skill in skills {
            self.kernel.register_skill(&skill).await?;
        }
        
        Ok(PushResult {
            policy_synced: true,
            checkpoints: checkpoints.len(),
            skills: skills.len(),
        })
    }
}
```

## Data Flow

### Memory Sync

```
Kernel Ledger Receipts
         ↓
   ┌─────────────┐
   │ Sync Engine │
   └─────────────┘
         ↓
┌──────────────────┐
│ memory/*.md      │  ← Human-readable session logs
│ MEMORY.md index  │  ← Index of all memories
└──────────────────┘
         ↓
   Agent Context
```

### Policy Sync

```
Local POLICY.md changes
         ↓
   ┌─────────────┐
   │ Kernel API  │  ← Validate and canonicalize
   └─────────────┘
         ↓
   ┌─────────────┐
   │ Sync Engine │  ← Pull back canonical version
   └─────────────┘
         ↓
  Update local POLICY.md
         ↓
   Policy Engine
```

### Context Pack Sync

```
Kernel Context Pack (WIH scope)
         ↓
   ┌─────────────┐
   │ Sync Engine │
   └─────────────┘
         ↓
┌──────────────────┐
│ context-pack.json │  ← Machine-readable
│ .a2r/context/    │  ← Cached contracts
└──────────────────┘
         ↓
   Agent LLM
```

## Implementation Plan

### Phase 1: Read-Only Sync

1. **Kernel Client**
   - Connect to kernel API
   - Authenticate workspace
   - Fetch context packs

2. **Receipt Pulling**
   - Query kernel ledger
   - Convert receipts to memory entries
   - Update MEMORY.md index

3. **Policy Sync**
   - Fetch canonical policy
   - Merge with local overrides
   - Display conflicts

### Phase 2: Bidirectional Sync

1. **Policy Push**
   - Submit local policy changes
   - Handle validation errors
   - Receive canonical version

2. **Checkpoint Sync**
   - Register checkpoints with kernel
   - Restore from kernel checkpoints
   - Sync checkpoint metadata

3. **Skill Registry**
   - Sync installed skills
   - Share custom skills
   - Version control

### Phase 3: Real-Time Sync

1. **WebSocket Connection**
   - Live updates from kernel
   - Push notifications
   - Collaborative editing

2. **Conflict Resolution**
   - Three-way merge
   - User intervention
   - Automatic resolution rules

## API Design

### Kernel API Types

```rust
// src/kernel/types.rs

/// Receipt from kernel ledger
pub struct Receipt {
    pub id: ReceiptId,
    pub timestamp: DateTime,
    pub operation: Operation,
    pub input: JsonValue,
    pub output: JsonValue,
    pub policy_decision: PolicyDecision,
    pub agent_state_hash: String,
}

/// Canonical context pack from kernel
pub struct KernelContextPack {
    pub wih_scope: WIHScope,
    pub active_contracts: Vec<Contract>,
    pub policy_hash: String,
    pub skill_registry: SkillRegistry,
}

/// Sync operation result
pub struct SyncResult {
    pub pull: PullResult,
    pub push: PushResult,
    pub conflicts: Vec<Conflict>,
    pub timestamp: DateTime,
}
```

### CLI Commands

```bash
# Manual sync
a2r-workspace sync

# Force pull from kernel (discard local changes)
a2r-workspace sync --pull --force

# Push only policy changes
a2r-workspace sync --push --policy

# Check sync status
a2r-workspace sync --status

# Configure sync settings
a2r-workspace config sync.endpoint https://kernel.a2r.io
a2r-workspace config sync.auto true
a2r-workspace config sync.interval 300  # seconds
```

## Configuration

```toml
# .a2r/config.toml
[kernel]
endpoint = "https://kernel.a2r.io"
workspace_id = "ws-abc123"
api_key = "${KERNEL_API_KEY}"

[sync]
auto = true
interval = 300  # 5 minutes
on_boot = true
on_shutdown = true

[sync.policies]
conflict_resolution = "ask"  # ask, local, remote, merge
policy_changes_require_approval = true
```

## Security Considerations

### 1. Authentication
- Workspace-specific API keys
- Short-lived access tokens
- Certificate pinning

### 2. Data Integrity
- Hash verification for all synced data
- Signature validation
- Tamper detection

### 3. Privacy
- Optional end-to-end encryption
- Selective sync (exclude sensitive memories)
- Local-only mode support

### 4. Audit Trail
- All sync operations logged
- Conflict resolution tracked
- Rollback capability

## Fallback Strategy

When kernel is unavailable:

1. **Offline Mode**
   - Use cached context pack
   - Queue changes for later sync
   - Continue with local policy

2. **Degraded Mode**
   - Reduced functionality
   - Warnings about stale data
   - Manual sync triggers

3. **Recovery**
   - Replay queued operations
   - Resolve conflicts
   - Re-establish sync

## Migration from Current System

1. **Backwards Compatibility**
   - Existing workspaces continue to work
   - Kernel sync is opt-in
   - Gradual migration path

2. **Data Migration**
   - Import existing checkpoints
   - Convert memories to kernel format
   - Register existing skills

3. **Rollout Plan**
   - Alpha: Internal testing
   - Beta: Opt-in for early adopters
   - GA: Default for new workspaces
