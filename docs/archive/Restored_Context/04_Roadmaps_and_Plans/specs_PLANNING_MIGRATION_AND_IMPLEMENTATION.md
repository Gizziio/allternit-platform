# Allternit Comprehensive Migration & Implementation Plan

## Executive Summary

This document outlines the complete plan to address:
1. **System Law Violations**: Remove all stub/placeholder code from Shell UI components
2. **Kernel Sync**: Implement (not just design) real kernel synchronization
3. **Tauri → Electron Migration**: Unify the desktop shell under Electron
4. **Naming Migration**: Complete opencode → allternit rebrand

**Status**: PLANNING PHASE - No code changes until this plan is approved.

---

## Part 1: Current State Analysis

### 1.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         DESKTOP SHELL                           │
│  ┌─────────────────────┐      ┌─────────────────────────────┐  │
│  │  Tauri (Rust)       │      │  Electron (Node.js)         │  │
│  │  ─────────────      │      │  ─────────────────          │  │
│  │  opencode-desktop   │      │  @allternit/shell-electron │  │
│  │  • src-tauri/       │      │  • main/                    │  │
│  │  • Spawns CLI       │      │  • preload/                 │  │
│  │  • Native features  │      │  • (basic implementation)   │  │
│  └─────────────────────┘      └─────────────────────────────┘  │
│                                                                 │
│  GOAL: Merge into single Electron shell                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                          CLI SERVER                             │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  cmd/cli/src/ (Rust)                                   │  │
│  │  ─────────────────────────                                │  │
│  │  • Binary name: opencode → allternit                            │  │
│  │  • Package: allternit-cli                                │  │
│  │  • Commands use "opencode" naming                         │  │
│  │  • Serves HTTP API on localhost                           │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SHELL UI COMPONENTS                        │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  surfaces/allternit-platform/src/components/workspace/              │  │
│  │  ───────────────────────────────────────────              │  │
│  │  VIOLATION: All components have STUB implementations      │  │
│  │  • Mock data instead of real API calls                    │  │
│  │  • TODO comments for "future implementation"              │  │
│  │  • Placeholder visualizations                             │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Naming Violations Inventory

| Location | Current | Target | Count |
|----------|---------|--------|-------|
| CLI binary | `opencode` | `allternit` | 1 |
| CLI commands | `opencode *` | `allternit *` | All |
| Tauri package | `opencode-desktop` | `allternit-desktop` | 1 |
| Tauri lib | `opencode_lib` | `allternit_desktop` | 1 |
| Env vars | `OPENCODE_*` | `ALLTERNIT_*` | ~20 |
| Config dir | `.opencode/` | `.allternit/` | 1 |
| Binary cache | `.opencode/bin` | `.allternit/bin` | 1 |
| Auth tokens | `opencode_*` | `allternit_*` | Multiple |

### 1.3 Stub Code Inventory (VIOLATIONS)

| Component | Violation | Location |
|-----------|-----------|----------|
| BrainView | Mock tasks instead of real task graph API | `BrainView.tsx:45-80` |
| MemoryEditor | Mock memory entries | `MemoryEditor.tsx:48-90` |
| PolicyDashboard | Mock policy rules | `PolicyDashboard.tsx:47-88` |
| SkillManager | Mock skills | `SkillManager.tsx:48-92` |
| IdentityEditor | Mock identity data | `IdentityEditor.tsx:45-78` |
| WASM wrapper | `// TODO: Implement when WASM bindings complete` | `wasm-wrapper.ts:57-72` |

### 1.4 Kernel Sync Status

**Current**: Architecture document only (`KERNEL_SYNC_ARCHITECTURE.md`)
**Required**: Full implementation including:
- Kernel client with real HTTP/WebSocket connections
- Sync engine with two-way synchronization
- Receipt pulling from ledger
- Policy push/pull
- Conflict resolution

---

## Part 2: Implementation Plan

### Phase 1: Fix System Law Violations (Week 1)

#### 2.1.1 Remove All Stubs from Shell UI Components

**Goal**: Every component must use real API calls, no mock data, no TODOs.

**Implementation Steps**:

1. **Define Real API Types** (shared between frontend and backend)
   ```typescript
   // surfaces/allternit-platform/src/api/types.ts
   export interface Task {
     id: string;
     title: string;
     status: 'pending' | 'active' | 'completed' | 'blocked';
     // ...real fields from backend
   }
   
   export interface BrainAPI {
     getTasks(): Promise<Task[]>;
     createTask(task: CreateTaskRequest): Promise<Task>;
     updateTask(id: string, updates: Partial<Task>): Promise<Task>;
     deleteTask(id: string): Promise<void>;
     getTaskGraph(): Promise<TaskGraph>;
   }
   ```

2. **Implement Real API Client**
   ```typescript
   // surfaces/allternit-platform/src/api/client.ts
   export class AllternitApiClient {
     constructor(private baseUrl: string, private authToken: string) {}
     
     async get<T>(path: string): Promise<T> {
       const response = await fetch(`${this.baseUrl}${path}`, {
         headers: { 'Authorization': `Bearer ${this.authToken}` }
       });
       if (!response.ok) throw new APIError(response.statusText);
       return response.json();
     }
     // ...post, put, delete
   }
   ```

3. **Rewrite Components with Real Data**
   - Replace all `const mockData = [...]` with real API calls
   - Add loading states with skeleton screens
   - Add error handling with retry logic
   - Remove all TODO comments

4. **Backend API Implementation**
   - Implement corresponding endpoints in CLI server
   - Add proper request/response validation
   - Add authentication middleware

#### 2.1.2 Component Implementation Checklist

| Component | Real API Required | Backend Endpoint | Status |
|-----------|------------------|------------------|--------|
| BrainView | Task graph API | `GET /brain/tasks` | Not Started |
| BrainView | Task CRUD | `POST/PUT/DELETE /brain/tasks/:id` | Not Started |
| MemoryEditor | Memory API | `GET/POST /memory/entries` | Not Started |
| MemoryEditor | Search | `GET /memory/search?q=` | Not Started |
| PolicyDashboard | Policy API | `GET /policy/rules` | Not Started |
| PolicyDashboard | Policy updates | `PUT /policy/rules/:id` | Not Started |
| SkillManager | Skills API | `GET /skills` | Not Started |
| SkillManager | Install skill | `POST /skills/:id/install` | Not Started |
| IdentityEditor | Identity API | `GET/PUT /identity` | Not Started |

---

### Phase 2: Implement Kernel Sync (Week 2-3)

#### 2.2.1 Kernel Client Implementation

**File**: `infrastructure/allternit-agent-workspace/src/kernel/client.rs`

```rust
pub struct KernelClient {
    http_client: reqwest::Client,
    ws_client: Option<WebSocketStream>,
    endpoint: String,
    workspace_id: String,
    auth_token: String,
}

impl KernelClient {
    /// Establish connection to kernel
    pub async fn connect(config: KernelConfig) -> Result<Self> {
        // 1. Validate endpoint
        // 2. Authenticate workspace
        // 3. Establish WebSocket for real-time updates
        // 4. Return configured client
    }
    
    /// Pull receipts from kernel ledger
    pub async fn pull_receipts(&self, since: DateTime<Utc>) -> Result<Vec<Receipt>> {
        let url = format!("{}/ledger/receipts", self.endpoint);
        let response = self.http_client
            .get(&url)
            .query(&[("since", since.to_rfc3339())])
            .header("Authorization", format!("Bearer {}", self.auth_token))
            .send()
            .await?;
            
        if !response.status().is_success() {
            return Err(KernelError::PullFailed(response.text().await?).into());
        }
        
        response.json::<Vec<Receipt>>().await.map_err(Into::into)
    }
    
    /// Push local policy changes
    pub async fn push_policy(&self, policy: &PolicyDocument) -> Result<PolicyHash> {
        let url = format!("{}/policy", self.endpoint);
        let response = self.http_client
            .post(&url)
            .json(policy)
            .header("Authorization", format!("Bearer {}", self.auth_token))
            .send()
            .await?;
            
        if !response.status().is_success() {
            return Err(KernelError::PushFailed(response.text().await?).into());
        }
        
        response.json::<PolicyHash>().await.map_err(Into::into)
    }
    
    /// Subscribe to real-time updates
    pub async fn subscribe(&mut self) -> Result<mpsc::Receiver<KernelEvent>> {
        // Establish WebSocket connection
        // Return channel for receiving events
    }
}
```

#### 2.2.2 Sync Engine Implementation

**File**: `infrastructure/allternit-agent-workspace/src/sync/engine.rs`

```rust
pub struct SyncEngine {
    kernel: KernelClient,
    workspace: Workspace,
    last_sync: DateTime<Utc>,
    pending_changes: Vec<Change>,
}

impl SyncEngine {
    /// Perform full two-way sync
    pub async fn sync(&mut self) -> Result<SyncReport> {
        let mut report = SyncReport::default();
        
        // Phase 1: Pull from kernel
        report.pull = self.pull().await?;
        
        // Phase 2: Push to kernel
        report.push = self.push().await?;
        
        // Phase 3: Resolve conflicts
        report.conflicts = self.resolve_conflicts().await?;
        
        // Update last sync time
        self.last_sync = Utc::now();
        self.workspace.save_sync_timestamp(self.last_sync).await?;
        
        Ok(report)
    }
    
    async fn pull(&self) -> Result<PullResult> {
        // 1. Fetch receipts since last sync
        let receipts = self.kernel.pull_receipts(self.last_sync).await?;
        
        // 2. Convert receipts to memory entries
        for receipt in receipts {
            let entry = MemoryEntry::from_receipt(receipt);
            self.workspace.append_memory(entry).await?;
        }
        
        // 3. Fetch canonical policy
        let policy = self.kernel.get_policy().await?;
        if self.workspace.policy_hash() != policy.hash {
            self.workspace.update_policy(policy).await?;
        }
        
        // 4. Fetch context pack
        let context = self.kernel.get_context_pack().await?;
        self.workspace.update_context_pack(context).await?;
        
        Ok(PullResult {
            receipts_imported: receipts.len(),
            policy_updated: true,
        })
    }
    
    async fn push(&self) -> Result<PushResult> {
        let mut result = PushResult::default();
        
        // 1. Push pending checkpoints
        for checkpoint in self.workspace.pending_checkpoints().await? {
            self.kernel.register_checkpoint(&checkpoint).await?;
            result.checkpoints_pushed += 1;
        }
        
        // 2. Push policy changes (if allowed)
        if self.workspace.policy_changed() {
            let policy = self.workspace.read_policy().await?;
            let hash = self.kernel.push_policy(&policy).await?;
            self.workspace.set_policy_hash(hash).await?;
            result.policy_pushed = true;
        }
        
        Ok(result)
    }
}
```

#### 2.2.3 Boot Sequence Integration

**File**: `infrastructure/allternit-agent-workspace/src/boot_sequence.rs`

Modify boot sequence to include sync:

```rust
impl BootSequence {
    pub async fn run(&mut self) -> Result<BootContext> {
        // Phase 1: Validate workspace structure
        self.validate_structure().await?;
        
        // Phase 2: Sync with kernel (NEW)
        if self.config.kernel_sync_enabled {
            self.sync_with_kernel().await?;
        }
        
        // Phase 3: Load core files
        self.load_core_files().await?;
        
        // Phase 4: Initialize skills
        self.init_skills().await?;
        
        // Phase 5: Build context pack
        self.build_context().await
    }
    
    async fn sync_with_kernel(&self) -> Result<()> {
        let kernel_config = self.load_kernel_config().await?;
        let client = KernelClient::connect(kernel_config).await?;
        let mut engine = SyncEngine::new(client, self.workspace.clone());
        
        let report = engine.sync().await?;
        
        if report.has_conflicts() {
            tracing::warn!("Sync conflicts detected: {:?}", report.conflicts);
            // Handle conflicts based on policy
        }
        
        Ok(())
    }
}
```

---

### Phase 3: Tauri → Electron Migration (Week 4-5)

#### 2.3.1 Migration Strategy

**Decision**: Migrate from Tauri to Electron for the following reasons:
1. Allternit Platform is already built with web technologies (React/TypeScript)
2. Electron has better ecosystem for our use case
3. Existing `shell-electron` package can be extended
4. Simpler build process

**Migration Approach**: Gradual migration with feature parity

#### 2.3.2 Step-by-Step Migration Plan

**Step 1: Audit Tauri Features**
List all Tauri features used:
- [ ] Window management
- [ ] System tray
- [ ] Native menus
- [ ] File system access (beyond web)
- [ ] Shell command execution
- [ ] Deep linking
- [ ] Auto-updater
- [ ] Clipboard access
- [ ] Notifications

**Step 2: Implement Electron Equivalents**

For each feature, implement Electron version:

```javascript
// cmd/shell-electron/main/features/window.js
const { BrowserWindow } = require('electron');

class WindowManager {
  createMainWindow() {
    const window = new BrowserWindow({
      width: 1400,
      height: 900,
      webPreferences: {
        preload: path.join(__dirname, '../preload/index.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    
    window.loadURL('http://localhost:5177'); // Dev server
    return window;
  }
}
```

**Step 3: Sidecar Integration (Critical)**

Tauri spawns CLI as sidecar. Electron needs equivalent:

```javascript
// cmd/shell-electron/main/sidecar.js
const { spawn } = require('child_process');
const path = require('path');

class CLISidecar {
  constructor() {
    this.process = null;
    this.port = 0;
  }
  
  async start() {
    // Find CLI binary
    const cliPath = this.findCliBinary();
    
    // Find available port
    this.port = await this.findAvailablePort();
    
    // Spawn CLI server
    this.process = spawn(cliPath, [
      'serve',
      '--hostname', '127.0.0.1',
      '--port', this.port.toString(),
    ], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    
    // Wait for server to be ready
    await this.waitForReady();
    
    return { port: this.port, process: this.process };
  }
  
  stop() {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
  }
}
```

**Step 4: IPC Bridge**

Replace Tauri commands with Electron IPC:

```javascript
// cmd/shell-electron/preload/api.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('allternit', {
  // Server management
  startServer: () => ipcRenderer.invoke('server:start'),
  stopServer: () => ipcRenderer.invoke('server:stop'),
  getServerUrl: () => ipcRenderer.invoke('server:getUrl'),
  
  // File system (if needed beyond web)
  openDirectory: () => ipcRenderer.invoke('fs:openDirectory'),
  
  // Config
  getConfig: (key) => ipcRenderer.invoke('config:get', key),
  setConfig: (key, value) => ipcRenderer.invoke('config:set', key, value),
});
```

```javascript
// cmd/shell-electron/main/ipc/handlers.js
const { ipcMain } = require('electron');
const sidecar = require('../sidecar');

ipcMain.handle('server:start', async () => {
  const result = await sidecar.start();
  return { success: true, port: result.port };
});

ipcMain.handle('server:stop', async () => {
  sidecar.stop();
  return { success: true };
});
```

#### 2.3.3 Package Structure After Migration

```
cmd/
├── shell/                          # NEW: Unified Electron shell
│   ├── package.json
│   ├── main/                       # Main process
│   │   ├── index.js               # Entry point
│   │   ├── window.js              # Window management
│   │   ├── sidecar.js             # CLI sidecar integration
│   │   ├── ipc/                   # IPC handlers
│   │   │   ├── server.js
│   │   │   ├── config.js
│   │   │   └── fs.js
│   │   └── features/              # Feature modules
│   │       ├── tray.js
│   │       ├── updater.js
│   │       └── notifications.js
│   ├── preload/                    # Preload scripts
│   │   └── index.js
│   ├── renderer/                   # UI (from allternit-platform)
│   │   └── (symlink or copy)
│   └── resources/                  # Icons, etc.
│
├── shell-electron/ → REMOVED (merged into shell/)
│
└── agent-shell/allternit-shell/ → REMOVED (Tauri version deprecated)
```

---

### Phase 4: Naming Migration (Week 5-6)

#### 2.4.1 Comprehensive Rename Plan

**Phase 4.1: CLI Binary and Commands**

| File | Changes |
|------|---------|
| `cmd/cli/Cargo.toml` | `name = "allternit"` |
| `cmd/cli/src/main.rs` | Change all "opencode" references |
| All command files | Update descriptions, help text |

```rust
// Before
const BINARY_NAME: &str = "opencode";
const APP_NAME: &str = "OpenCode";

// After
const BINARY_NAME: &str = "allternit";
const APP_NAME: &str = "Allternit";
```

**Phase 4.2: Environment Variables**

| Old | New |
|-----|-----|
| `OPENCODE_SERVER_PASSWORD` | `ALLTERNIT_SERVER_PASSWORD` |
| `OPENCODE_SERVER_USERNAME` | `ALLTERNIT_SERVER_USERNAME` |
| `OPENCODE_CLIENT` | `ALLTERNIT_CLIENT` |
| `OPENCODE_EXPERIMENTAL_*` | `ALLTERNIT_EXPERIMENTAL_*` |

**Migration strategy for env vars**:
1. Support both old and new names during transition
2. Warn when old names are used
3. Remove support after 2 releases

```rust
pub fn get_env_var(name: &str) -> Option<String> {
    // Try new name first
    if let Ok(value) = env::var(format!("ALLTERNIT_{}", name)) {
        return Some(value);
    }
    
    // Fall back to old name with warning
    if let Ok(value) = env::var(format!("OPENCODE_{}", name)) {
        tracing::warn!(
            "OPENCODE_{} is deprecated, use ALLTERNIT_{} instead",
            name, name
        );
        return Some(value);
    }
    
    None
}
```

**Phase 4.3: Config Directory**

| Old Path | New Path |
|----------|----------|
| `~/.opencode/` | `~/.allternit/` |
| `~/.opencode/bin/` | `~/.allternit/bin/` |
| `~/.config/opencode/` | `~/.config/allternit/` |

**Migration code**:

```rust
pub fn get_config_dir() -> PathBuf {
    let new_dir = dirs::config_dir().unwrap().join("allternit");
    let old_dir = dirs::config_dir().unwrap().join("opencode");
    
    // If old exists and new doesn't, migrate
    if old_dir.exists() && !new_dir.exists() {
        tracing::info!("Migrating config from {:?} to {:?}", old_dir, new_dir);
        fs::rename(&old_dir, &new_dir).ok();
    }
    
    new_dir
}
```

**Phase 4.4: Package Names**

| Old | New |
|-----|-----|
| `opencode-desktop` | `allternit-desktop` |
| `opencode_lib` | `allternit_desktop_lib` |
| `@allternit/shell-electron` | `@allternit/shell` |

---

## Part 3: Implementation Order

### Week 1: Fix Violations
- [ ] Define real API types
- [ ] Implement API client
- [ ] Rewrite BrainView with real data
- [ ] Rewrite MemoryEditor with real data
- [ ] Rewrite PolicyDashboard with real data
- [ ] Rewrite SkillManager with real data
- [ ] Rewrite IdentityEditor with real data
- [ ] Implement backend API endpoints

### Week 2: Kernel Sync (Part 1)
- [ ] Implement KernelClient
- [ ] Implement receipt pulling
- [ ] Implement policy sync (read-only)
- [ ] Add sync to boot sequence
- [ ] Write tests

### Week 3: Kernel Sync (Part 2)
- [ ] Implement policy push
- [ ] Implement checkpoint sync
- [ ] Implement conflict resolution
- [ ] Add WebSocket for real-time updates
- [ ] Write integration tests

### Week 4: Electron Migration (Part 1)
- [ ] Audit Tauri features
- [ ] Create new `shell` package structure
- [ ] Implement sidecar integration
- [ ] Implement IPC bridge
- [ ] Port window management

### Week 5: Electron Migration (Part 2)
- [ ] Port system tray
- [ ] Port auto-updater
- [ ] Port notifications
- [ ] Integrate with allternit-platform
- [ ] Write tests

### Week 6: Naming Migration
- [ ] Rename CLI binary and all references
- [ ] Migrate environment variables
- [ ] Migrate config directories
- [ ] Rename packages
- [ ] Update documentation

---

## Part 4: Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking changes for existing users | High | High | Gradual migration with deprecation warnings |
| Electron performance issues | Medium | Medium | Benchmark against Tauri before full switch |
| Kernel sync complexity | Medium | High | Start with read-only, add write later |
| Time overrun | Medium | Medium | Prioritize: 1) Violations, 2) Naming, 3) Kernel, 4) Electron |
| Data loss during migration | Low | Critical | Backup before any file operations |

---

## Part 5: Success Criteria

1. **No Stubs**: `grep -r "mock\|TODO.*implement\|placeholder" --include="*.tsx" surfaces/allternit-platform/src/components/workspace/` returns nothing
2. **Kernel Sync Works**: Can pull receipts from kernel and push policy changes
3. **Electron Shell Works**: Feature parity with Tauri version
4. **Naming Complete**: `grep -r "opencode" --include="*.rs" --include="*.ts" cmd/` returns only historical references
5. **All Tests Pass**: Unit tests, integration tests, e2e tests

---

## Next Steps

1. **Review this plan** - Get approval on approach and timeline
2. **Create detailed tickets** - Break down each task into implementable units
3. **Set up feature branches** - One per phase to isolate changes
4. **Begin implementation** - Start with Week 1 tasks

**DO NOT PROCEED WITH CODE CHANGES UNTIL THIS PLAN IS APPROVED.**
