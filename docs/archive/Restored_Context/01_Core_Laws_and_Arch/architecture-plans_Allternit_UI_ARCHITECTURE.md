# Allternit Complete UI Architecture

**Date:** 2026-01-31  
**Status:** Architecture Documentation

---

## Overview

Allternit has a **multi-layer UI architecture**:

1. **Electron Desktop App** (`apps/shell-electron/`) - Primary GUI
2. **Terminal UI** (`apps/allternit-shell/`) - CLI subprocess wrapper
3. **Web UI** (`apps/shell/`) - Vite-based renderer loaded by Electron

The Terminal UI is **not** the main interface—it's a service wrapper for Allternit kernel CLI tools.

---

## Architecture Layers

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ELECTRON DESKTOP APP                                 │
│                     (apps/shell-electron/)                                   │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                     Main Process (Node.js)                            │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │  │
│  │  │   Window    │  │  Browser    │  │    Allternit      │  │   Service   │  │  │
│  │  │   Manager   │  │   Views     │  │   Kernel    │  │   Wrapper   │  │  │
│  │  │             │  │  (Stage)    │  │   Bridge    │  │  (CLI IPC)  │  │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                    │                                         │
│                          IPC (contextBridge)                                 │
│                                    │                                         │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                    Renderer Process (Chromium)                        │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │  │
│  │  │   Chat      │  │   Model     │  │   Canvas    │  │   Stage     │  │  │
│  │  │  Interface  │  │  Picker     │  │  (Artifacts)│  │  (Browser)  │  │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                    │  │
│  │  │  Onboarding │  │    WIH      │  │   Skills    │                    │  │
│  │  │   Wizard    │  │  Dashboard  │  │  Registry   │                    │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                    │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ (Optional)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         TERMINAL UI (Service Layer)                          │
│                       (apps/allternit-shell/)                                      │
│                                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │  Allternit CLI    │  │  Kernel     │  │   Beads     │  │   Service   │        │
│  │   Wrapper   │  │  Service    │  │   (bd)      │  │   Manager   │        │
│  │             │  │             │  │             │  │             │        │
│  │ - allternit start │  │ - allternit-kernel│  │ - bd init   │  │ - Process   │        │
│  │ - allternit stop  │  │ - allternit-law   │  │ - bd list   │  │   spawning  │        │
│  │ - allternit status│  │ - allternit-shell │  │ - bd create │  │ - IPC       │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Electron Desktop App (`apps/shell-electron/`)

### 1.1 Main Process Architecture

**File:** `main/index.cjs`

The main process manages:
- **Main Window**: Contains the HUMAN UI renderer
- **BrowserViews**: For the "Stage" (embedded browser preview)
- **IPC Handlers**: Communication with renderer
- **Service Management**: Spawning Allternit CLI subprocesses

```typescript
// Main process structure
interface MainProcess {
  // Window management
  mainWindow: BrowserWindow;
  
  // BrowserView tabs for Stage
  tabs: Map<string, TabInfo>;
  currentStageTabId: string | null;
  
  // Methods
  createTab(tabId: string, url?: string): TabInfo;
  closeTab(tabId: string): void;
  navigate(tabId: string, url: string): Promise<void>;
  attachStage(tabId: string, bounds: Rectangle): void;
  detachStage(tabId: string): void;
}
```

**Key Features:**
- **Multi-tab Browser**: Each tab is a BrowserView
- **Stage Attachment**: BrowserViews attach to main window for display
- **Sandboxed**: `nodeIntegration: false`, `contextIsolation: true`
- **Persistent**: Uses `partition: 'persist:browser'` for cookies/storage

### 1.2 Preload Script

**File:** `preload/index.ts`

Exposes safe APIs to renderer via `contextBridge`:

```typescript
// Browser API
window.a2Browser.createTab(url?): Promise<{ tabId, success }>
window.a2Browser.navigate(tabId, url): Promise<void>
window.a2Browser.attachStage(tabId, bounds): Promise<void>
window.a2Browser.onDidNavigate(callback): UnsubscribeFn
// ... more methods

// Shell API
window.a2Shell.getVersion(): Promise<string>
window.a2Shell.quit(): Promise<void>
window.a2Shell.minimize(): Promise<void>
window.a2Shell.maximize(): Promise<void>
window.a2Shell.onThemeChanged(callback): UnsubscribeFn
```

### 1.3 Renderer Process (Web UI)

**Loaded from:** `apps/shell/` (Vite dev server in dev, built files in prod)

**Components to Implement:**

| Component | Purpose | Legacy Equivalent |
|-----------|---------|---------------------|
| **Chat Interface** | Main chat with AI | Legacy TUI chat |
| **Model Picker** | Model selection/catalog | `src/commands/model-picker.ts` |
| **Onboarding Wizard** | First-time setup | `src/wizard/onboarding.ts` |
| **WIH Dashboard** | Work item management | N/A (Allternit-specific) |
| **Canvas** | Artifact display | Legacy canvas |
| **Stage** | Browser preview | Legacy browser view |
| **Skills Registry** | Plugin management | `src/plugins/tools.ts` |

---

## 2. Features to Port from Legacy

### 2.1 Interactive Onboarding Wizard

**Legacy Source:**
- `src/wizard/onboarding.ts` - Main wizard
- `src/commands/onboard-interactive.ts` - Entry point
- `src/wizard/clack-prompter.ts` - CLI prompts

**Features to Port:**

```typescript
interface OnboardingFlow {
  // Step 1: Welcome & Risk Acknowledgment
  showWelcome(): void;
  acknowledgeRisk(): Promise<boolean>;
  
  // Step 2: Authentication Setup
  selectAuthMethod(): Promise<'oauth' | 'token' | 'setup-token'>;
  configureProvider(provider: string): Promise<void>;
  
  // Step 3: Model Selection
  selectDefaultModel(): Promise<ModelRef>;
  configureModelAliases(): Promise<void>;
  
  // Step 4: Workspace Setup
  selectWorkspace(): Promise<string>;
  configureGitSync(): Promise<void>;
  
  // Step 5: Channels (Optional)
  configureChannels(): Promise<void>;
  
  // Step 6: Skills/Plugins
  selectSkills(): Promise<string[]>;
  
  // Step 7: Finalize
  reviewConfiguration(): Promise<void>;
  writeConfig(): Promise<void>;
}
```

**UI Implementation:**
- Use React/TypeScript for wizard steps
- Replace clack prompts with form components
- Progress indicator
- Skip/back navigation

### 2.2 Model Selection & Catalog

**Legacy Source:**
- `src/agents/model-selection.ts` - Model resolution
- `src/agents/model-catalog.ts` - Catalog loading
- `src/commands/model-picker.ts` - Interactive picker

**Features to Port:**

```typescript
interface ModelCatalog {
  // Catalog loading
  loadModelCatalog(): Promise<ModelCatalogEntry[]>;
  
  // Model selection UI
  selectModel(options: {
    allowKeep?: boolean;
    includeManual?: boolean;
    preferredProvider?: string;
  }): Promise<ModelRef>;
  
  // Model aliases
  buildModelAliasIndex(): ModelAliasIndex;
  resolveModelRef(alias: string): ModelRef;
  
  // Provider filtering
  filterByProvider(provider: string): ModelCatalogEntry[];
  filterByAuth(): ModelCatalogEntry[];
  
  // Allowlist support
  buildAllowedModelSet(): { allowedCatalog, deniedCount };
}

interface ModelCatalogEntry {
  provider: string;
  model: string;
  alias?: string;
  description?: string;
  capabilities?: string[];
  contextWindow?: number;
  pricing?: { input: number; output: number };
}
```

**UI Implementation:**
- Searchable model list
- Provider grouping
- Capability badges (vision, tools, etc.)
- Context window display
- Pricing info
- "Test Connection" button

### 2.3 Model Alias Management

**Legacy Source:** `src/agents/model-selection.ts` (buildModelAliasIndex)

**UI Features:**
- Alias editor
- Provider/model mapping
- Validation
- Import/export

### 2.4 Provider Configuration

**Legacy Sources:**
- `src/agents/models-config.providers.ts`
- `src/commands/onboard-auth.*.ts`

**Providers to Support:**
- Anthropic (Claude)
- OpenAI (GPT, Codex)
- Google (Gemini)
- OpenCode/Zen
- Ollama (local)
- GitHub Copilot
- Venice
- Custom/OpenRouter

**UI Implementation:**
- Provider cards with icons
- Auth method selection (OAuth, API key, token)
- Endpoint configuration (for self-hosted)
- Test connection

---

## 3. Terminal UI as Service Wrapper

The Terminal UI (`apps/allternit-shell/`) is **NOT** the main interface. It's a **service wrapper** for Allternit CLI tools.

### 3.1 CLI Services to Wrap

```
Allternit CLI Services:
├── allternit-kernel          # Kernel service daemon
├── allternit-law             # Law layer/policy daemon  
├── allternit-shell           # Terminal UI (this)
├── allternit-gateway         # WebSocket gateway
└── beads (bd)          # Issue tracking
```

### 3.2 Service Manager Interface

```typescript
interface ServiceManager {
  // Service lifecycle
  startService(name: string, config?: object): Promise<Process>;
  stopService(name: string): Promise<void>;
  restartService(name: string): Promise<void>;
  
  // Status monitoring
  getServiceStatus(name: string): ServiceStatus;
  listRunningServices(): string[];
  
  // Log streaming
  streamLogs(name: string): ReadableStream;
  
  // Configuration
  configureService(name: string, config: object): Promise<void>;
  getServiceConfig(name: string): object;
}

type ServiceStatus = 
  | 'stopped' 
  | 'starting' 
  | 'running' 
  | 'error' 
  | 'restarting';
```

### 3.3 Terminal Commands for Service Management

```bash
# Service management via terminal
allternit services start kernel
allternit services stop kernel
allternit services restart kernel
allternit services status
allternit services logs kernel --follow

# Kernel CLI
allternit kernel wih list
allternit kernel wih create "New Task"
allternit kernel wih set P5-T0500
allternit kernel receipt verify RCPT-001

# Law Layer CLI
allternit law policy list
allternit law policy apply development
allternit law audit

# Beads integration
allternit beads list
allternit beads create "New Issue"
allternit beads sync

# Gateway
allternit gateway start
allternit gateway stop
allternit gateway status
```

### 3.4 Service Wrapper Implementation

```typescript
// apps/allternit-shell/src/services/

class ServiceWrapper {
  private processes = new Map<string, ChildProcess>();
  
  async startService(name: string, config: ServiceConfig): Promise<void> {
    const proc = spawn('allternit-' + name, ['--daemon'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, ...config.env },
    });
    
    this.processes.set(name, proc);
    
    // Wait for health check
    await this.waitForHealthy(name);
  }
  
  async stopService(name: string): Promise<void> {
    const proc = this.processes.get(name);
    if (proc) {
      proc.kill('SIGTERM');
      await this.waitForExit(name, 5000);
      this.processes.delete(name);
    }
  }
  
  streamLogs(name: string): AsyncIterable<string> {
    const proc = this.processes.get(name);
    if (!proc) throw new Error('Service not running');
    
    return this.createLogStream(proc);
  }
}
```

---

## 4. Web UI Components (Renderer)

### 4.1 Chat Interface

```typescript
interface ChatInterface {
  // Message display
  messages: Message[];
  addMessage(message: Message): void;
  updateMessage(id: string, updates: Partial<Message>): void;
  
  // Input
  inputValue: string;
  setInput(value: string): void;
  submitInput(): void;
  
  // Tool calls
  showToolCalls: boolean;
  expandToolCall(id: string): void;
  
  // Streaming
  isStreaming: boolean;
  streamChunk(chunk: string): void;
  endStream(): void;
}
```

**Features:**
- Message threading
- Code blocks with syntax highlighting
- Tool call expand/collapse
- File attachments
- Edit/regenerate

### 4.2 Model Picker Component

```typescript
interface ModelPickerProps {
  models: ModelCatalogEntry[];
  selectedModel?: ModelRef;
  onSelect: (model: ModelRef) => void;
  
  // Filters
  filterProvider?: string;
  filterCapability?: string;
  searchQuery?: string;
  
  // Display options
  showPricing?: boolean;
  showContextWindow?: boolean;
  groupByProvider?: boolean;
}
```

**UI Elements:**
- Search bar with fuzzy matching
- Provider filter chips
- Model cards with:
  - Provider icon
  - Model name
  - Capabilities (badges)
  - Context window
  - Pricing
  - "Select" button

### 4.3 Onboarding Wizard Component

```typescript
interface OnboardingWizardProps {
  steps: WizardStep[];
  currentStep: number;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  onComplete: (config: AllternitConfig) => void;
}

type WizardStep =
  | { type: 'welcome' }
  | { type: 'auth'; providers: Provider[] }
  | { type: 'model'; catalog: ModelCatalogEntry[] }
  | { type: 'workspace' }
  | { type: 'skills'; skills: Skill[] }
  | { type: 'review'; config: AllternitConfig };
```

### 4.4 WIH Dashboard

**Allternit-Specific Feature:**

```typescript
interface WihDashboard {
  // WIH list
  wihs: WihItem[];
  filter: WihFilter;
  sort: WihSort;
  
  // Kanban view
  columns: {
    draft: WihItem[];
    ready: WihItem[];
    in_progress: WihItem[];
    blocked: WihItem[];
    review: WihItem[];
    complete: WihItem[];
  };
  
  // Details panel
  selectedWih?: WihItem;
  showDetails: boolean;
  
  // Actions
  createWih(): void;
  editWih(id: string): void;
  setWihStatus(id: string, status: WihStatus): void;
  linkDependencies(childId: string, parentIds: string[]): void;
}
```

### 4.5 Stage (Browser Preview)

**From Legacy:** Embedded browser view

```typescript
interface StageComponent {
  // Tab management
  tabs: BrowserTab[];
  activeTabId: string;
  
  // Navigation
  url: string;
  canGoBack: boolean;
  canGoForward: boolean;
  isLoading: boolean;
  
  // Actions
  navigate(url: string): void;
  goBack(): void;
  goForward(): void;
  reload(): void;
  newTab(url?: string): void;
  closeTab(tabId: string): void;
  
  // Events from main process
  onDidNavigate: Event<{ tabId, url }>;
  onTitleUpdated: Event<{ tabId, title }>;
}
```

### 4.6 Canvas (Artifacts)

**From Legacy:** Artifact display and manipulation

```typescript
interface CanvasComponent {
  items: CanvasItem[];
  selectedItemId?: string;
  
  // View controls
  zoom: number;
  pan: { x, y };
  
  // Actions
  addItem(item: CanvasItem): void;
  updateItem(id: string, updates: Partial<CanvasItem>): void;
  deleteItem(id: string): void;
  selectItem(id: string): void;
  
  // Zoom/pan
  setZoom(zoom: number): void;
  setPan(x: number, y: number): void;
  resetView(): void;
}
```

---

## 5. Integration Points

### 5.1 Electron ↔ Terminal UI

The Electron app can spawn the Terminal UI as an integrated terminal panel:

```typescript
// In Electron main process
const terminalPanel = new BrowserView({
  webPreferences: {
    preload: path.join(__dirname, 'terminal-preload.js'),
  },
});

// Load terminal UI
terminalPanel.webContents.loadURL('allternit-terminal://local');

// Or spawn as subprocess with PTY
const ptyProcess = spawn('allternit', ['shell'], {
  stdio: ['pipe', 'pipe', 'pipe'],
});

// Stream to xterm.js in renderer
```

### 5.2 Renderer ↔ Allternit Services

```typescript
// Services API exposed via preload
window.allternitServices = {
  // Kernel
  async createWih(wih: Partial<WihItem>): Promise<WihItem>;
  async getWih(id: string): Promise<WihItem>;
  async listWihs(filter?: WihFilter): Promise<WihItem[]>;
  
  // Law Layer
  async evaluatePolicy(context: PolicyContext): Promise<PolicyDecision>;
  async listPolicies(): Promise<Policy[]>;
  
  // Gateway
  async sendMessage(message: string): Promise<void>;
  onMessage: Event<Message>;
  
  // Browser (Stage)
  createTab(url?: string): Promise<{ tabId }>;
  navigate(tabId: string, url: string): Promise<void>;
  attachStage(tabId: string, bounds: Rectangle): Promise<void>;
};
```

---

## 6. Implementation Roadmap

### Phase 1: Core Infrastructure
1. ✅ Electron main process (BrowserView management)
2. ✅ Preload script (IPC bridge)
3. ⬜ Web UI shell (layout, navigation)
4. ⬜ Service management (spawn Allternit CLI tools)

### Phase 2: Chat & Basic UI
1. ⬜ Chat interface (messages, input, streaming)
2. ⬜ Tool call display
3. ⬜ Settings panel
4. ⬜ Theme system (connect to Electron)

### Phase 3: Model Management
1. ⬜ Model catalog loading
2. ⬜ Model picker UI
3. ⬜ Provider configuration
4. ⬜ Model aliases

### Phase 4: Onboarding
1. ⬜ Wizard framework
2. ⬜ Auth configuration steps
3. ⬜ Model selection step
4. ⬜ Workspace setup step

### Phase 5: WIH Integration
1. ⬜ WIH dashboard
2. ⬜ Kanban board
3. ⬜ Dependency visualization
4. ⬜ Receipt viewer

### Phase 6: Advanced Features
1. ⬜ Canvas/Artifacts
2. ⬜ Stage (browser preview)
3. ⬜ Skills registry
4. ⬜ Integrated terminal

---

## 7. File Structure

```
apps/
├── shell-electron/           # Electron main + preload
│   ├── main/
│   │   └── index.cjs         # Main process
│   ├── preload/
│   │   └── index.ts          # Preload script
│   └── package.json
│
├── shell/                    # Web UI (Vite + React)
│   ├── src/
│   │   ├── components/
│   │   │   ├── Chat/         # Chat interface
│   │   │   ├── ModelPicker/  # Model selection
│   │   │   ├── Onboarding/   # Setup wizard
│   │   │   ├── WihDashboard/ # Work items
│   │   │   ├── Stage/        # Browser preview
│   │   │   └── Canvas/       # Artifacts
│   │   ├── services/
│   │   │   ├── kernel.ts     # Kernel API client
│   │   │   ├── law.ts        # Law layer client
│   │   │   └── gateway.ts    # Gateway WebSocket
│   │   ├── stores/
│   │   │   ├── chatStore.ts
│   │   │   ├── wihStore.ts
│   │   │   └── modelStore.ts
│   │   ├── App.tsx
│   │   └── main.tsx
│   └── package.json
│
└── allternit-shell/                # Terminal service wrapper
    ├── src/
    │   ├── services/         # CLI service management
    │   ├── cli.ts            # Command definitions
    │   └── shell.ts          # Terminal UI
    └── package.json
```

---

## Summary

**The Allternit UI is a multi-layer system:**

1. **Electron Desktop** is the **primary** UI (GUI)
2. **Terminal UI** is a **service wrapper** for CLI tools
3. **Legacy features** (onboarding, model picker) are **ported** to React components
4. **Allternit services** (kernel, law) run as **subprocesses** managed by both layers

**Key Insight:** The Terminal UI I built earlier is **one component** of the system—the service wrapper layer—not the main interface.
