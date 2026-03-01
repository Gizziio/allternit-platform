# UI Architecture Correction

## What I Initially Built

I created a **standalone Terminal UI** (`apps/a2r-shell/`) with:
- REPL interface with commands (`/help`, `/wih`, etc.)
- Theme system (dark/light/high-contrast)
- Direct integration with A2R Kernel, Runtime, and Law Layer
- Event-driven architecture

**This is useful but incomplete.**

---

## What Was Actually Needed

A **multi-layer UI architecture**:

### Layer 1: Electron Desktop App (Primary UI)
```
apps/shell-electron/
├── Main Process     (Already exists - manages BrowserViews)
├── Preload Script   (Already exists - IPC bridge)
└── Web UI          (Needs to be built - React app)
    ├── Chat Interface
    ├── Model Picker        ← Port from Legacy
    ├── Onboarding Wizard   ← Port from Legacy
    ├── WIH Dashboard       ← A2R-specific
    ├── Stage (Browser)     ← Port from Legacy
    └── Canvas (Artifacts)  ← Port from Legacy
```

### Layer 2: Terminal UI (Service Wrapper)
```
apps/a2r-shell/
└── Service wrapper for CLI tools:
    ├── a2r services start kernel
    ├── a2r kernel wih list
    ├── a2r law policy apply
    └── a2r gateway start
```

**My implementation was close, but:**
- ❌ Tried to be the main interface
- ❌ Didn't include service wrapper commands
- ✅ Good foundation for service management

---

## Corrected Architecture

```
User Interaction Flow:

1. USER opens Electron App (shell-electron)
   │
   ├── 1a. First time? → Show Onboarding Wizard
   │
   ├── 1b. Regular use → Show Chat Interface
   │
   └── 1c. Need terminal? → Open Terminal Panel (embeds a2r-shell)

2. ELECTRON APP spawns services via a2r-shell CLI:
   │
   ├── a2r services start kernel
   ├── a2r services start gateway
   └── a2r services start law

3. SERVICES run as subprocesses, Electron communicates via:
   │
   ├── WebSocket (to gateway)
   ├── IPC (to main process)
   └── HTTP (to kernel API)

4. USER can also run a2r-shell standalone in terminal:
   │
   └── For automation, CI/CD, or headless operation
```

---

## What Needs to Be Built

### 1. Web UI Components (apps/shell/)

**Port from Legacy:**
- [ ] **Onboarding Wizard** (`src/wizard/onboarding.ts` → React)
  - Step-by-step setup
  - Auth configuration
  - Model selection
  - Workspace setup
  
- [ ] **Model Picker** (`src/commands/model-picker.ts` → React)
  - Searchable catalog
  - Provider filtering
  - Capability badges
  - Pricing display
  
- [ ] **Stage/Browser** (Already in Electron main)
  - Tab management
  - Navigation controls
  - Attach/detach
  
- [ ] **Canvas** (Artifacts)
  - Item display
  - Zoom/pan
  - Selection

**A2R-Specific:**
- [ ] **WIH Dashboard**
  - Kanban board
  - List view
  - Dependency graph
  - Receipt viewer

### 2. Service Wrapper Commands (apps/a2r-shell/)

**Add to existing shell:**
```bash
# Service management
a2r services start <name>
a2r services stop <name>
a2r services restart <name>
a2r services status
a2r services logs <name>

# Kernel CLI
a2r kernel wih list
a2r kernel wih create <title>
a2r kernel wih set <id>
a2r kernel receipt list

# Law CLI
a2r law policy list
a2r law policy apply <preset>
a2r law audit

# Gateway CLI
a2r gateway start
a2r gateway stop
a2r gateway status
```

### 3. Electron ↔ Service Integration

**Main Process:**
```typescript
// Spawn A2R services
const kernelProcess = spawn('a2r', ['services', 'start', 'kernel']);
const gatewayProcess = spawn('a2r', ['services', 'start', 'gateway']);

// Manage lifecycle
app.on('quit', () => {
  kernelProcess.kill();
  gatewayProcess.kill();
});
```

**Preload Script:**
```typescript
// Expose to renderer
contextBridge.exposeInMainWorld('a2rServices', {
  // Service management
  startService: (name) => ipcRenderer.invoke('service:start', name),
  stopService: (name) => ipcRenderer.invoke('service:stop', name),
  getServiceStatus: (name) => ipcRenderer.invoke('service:status', name),
  
  // Kernel API
  createWih: (wih) => ipcRenderer.invoke('kernel:createWih', wih),
  listWihs: () => ipcRenderer.invoke('kernel:listWihs'),
  
  // Gateway
  sendMessage: (msg) => ipcRenderer.invoke('gateway:send', msg),
  onMessage: (cb) => ipcRenderer.on('gateway:message', cb),
});
```

---

## Legacy Features to Port

### 1. Onboarding Wizard

**Source:** `src/wizard/onboarding.ts`

**Steps:**
1. Welcome & Risk Acknowledgment
2. Authentication Setup (OAuth, Token, CLI)
3. Model Selection (with catalog)
4. Workspace Configuration
5. Channels Setup (optional)
6. Skills Selection
7. Review & Finalize

**Implementation:** React wizard with form components replacing clack prompts.

### 2. Model Picker

**Source:** `src/commands/model-picker.ts`, `src/agents/model-selection.ts`

**Features:**
- Model catalog loading
- Provider filtering
- Capability badges (vision, tools, reasoning)
- Context window display
- Pricing information
- Alias resolution
- Fuzzy search

**Implementation:** React component with virtualized list, search, and filter chips.

### 3. Model Catalog

**Source:** `src/agents/model-catalog.ts`

**Features:**
- Fetch from providers
- Cache management
- Provider-specific normalization
- Capability detection

### 4. Auth Configuration

**Source:** `src/commands/onboard-auth*.ts`

**Providers:**
- Anthropic (Claude CLI, setup-token)
- OpenAI (Codex CLI, API key)
- Google (Gemini API key)
- OpenCode/Zen (OAuth)
- Ollama (local, no auth)
- GitHub Copilot (token)
- Venice (API key)

---

## Summary of Corrections

| Aspect | What I Built | What Was Needed |
|--------|--------------|-----------------|
| **Primary UI** | Terminal REPL | Electron + React |
| **Terminal Role** | Main interface | Service wrapper |
| **Onboarding** | ❌ Missing | Port from Legacy |
| **Model Picker** | ❌ Missing | Port from Legacy |
| **Service Mgmt** | ❌ Missing | CLI commands for spawning |
| **Browser View** | ❌ Missing | Port from Legacy |
| **Canvas** | ❌ Missing | Port from Legacy |
| **WIH Dashboard** | Command-based | Visual Kanban board |

**The Terminal UI I built is a good foundation but should be repositioned as a service management tool, not the primary interface.**

---

## Next Steps

1. **Reposition** `apps/a2r-shell/` as service wrapper
2. **Create** `apps/shell/` (Vite + React) for main UI
3. **Port** Legacy onboarding to React wizard
4. **Port** Legacy model picker to React component
5. **Build** WIH Dashboard (Kanban view)
6. **Integrate** existing Electron BrowserView for Stage
