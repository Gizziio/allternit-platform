# A2R UI Analysis & Integration Plan

**Date:** 2026-01-31  
**Status:** Comprehensive UI Architecture Analysis

---

## Executive Summary

The A2R UI already has a **sophisticated architecture** in `apps/shell/` with many components implemented. My earlier Terminal UI work should be **repositioned** as a service management CLI, not the primary interface.

**Key Insight:** The Shell UI uses:
- **A2UI** - An adaptive UI rendering system (JSON schema → UI)
- **Capsules** - Mini-app architecture with windowing
- **Embodiment Orb** - Already implemented
- **Studio** - Already implemented (agents/tools/skills builder)
- **Marketplace** - Already implemented (asset discovery)

**What's Missing:**
- Legacy's interactive **onboarding wizard**
- Legacy's **model picker/selection** UI
- **Browser capsule** (non-playwright, like browseruse)
- Integration with A2R Kernel WIH system

---

## Existing Architecture

### 1. Layer Structure

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ELECTRON SHELL                                       │
│                    (apps/shell-electron/)                                    │
│                                                                              │
│  Main Process (Node.js)                                                     │
│  ├── BrowserWindow (loads shell/)                                           │
│  ├── BrowserViews (for Stage - external websites)                          │
│  └── IPC handlers                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ loads
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         WEB UI (React)                                       │
│                      (apps/shell/src/)                                       │
│                                                                              │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │
│  │   A2UI       │ │  Capsules    │ │   Studio     │ │ Marketplace  │       │
│  │  Renderer    │ │  (Mini-apps) │ │  (Builder)   │ │  (Assets)    │       │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘       │
│                                                                              │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │
│  │  Embodiment  │ │   Kanban     │ │  Operator    │ │    Chat      │       │
│  │    Orb       │ │   (WIH)      │ │   Console    │ │  Interface   │       │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ spawns
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      TERMINAL UI (Service Wrapper)                           │
│                       (apps/a2r-shell/)                                      │
│                                                                              │
│  Service Management Commands:                                               │
│  ├── a2r services start kernel                                             │
│  ├── a2r services start gateway                                            │
│  ├── a2r kernel wih list                                                   │
│  └── a2r law policy apply                                                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2. Key Components (Already Built)

#### A2UI System (`src/a2ui/`)
Adaptive UI that renders from JSON schema:
```typescript
// Schema-driven UI
const schema = {
  type: 'Container',
  props: {
    layout: 'row',
    children: [
      { type: 'Button', props: { label: 'Click', actionId: 'click' } },
      { type: 'TextField', props: { valuePath: 'input' } }
    ]
  }
};

<A2UISurface schema={schema} dataModel={data} onAction={handleAction} />
```

**Used by:**
- `BrowserAdapter.ts` - Renders browser chrome
- `AgentStepsAdapter.ts` - Renders agent step timeline
- Capsules for adaptive UI

#### Capsule System (`src/components/windowing/`)
Mini-app architecture:

| Component | Purpose |
|-----------|---------|
| `WindowManager.tsx` | Manages floating windows |
| `CapsuleWindowFrame.tsx` | Window chrome/title bar |
| `AgentStepsCapsule.tsx` | Shows agent execution steps |
| `InspectorCapsule.tsx` | Code/object inspector |
| `BrowserAdapter.ts` | Renders browser chrome via A2UI |

**Features:**
- Drag to move
- Dock to sides
- Float freely
- Minimize/maximize
- Tab system

#### Studio (`src/components/StudioView.tsx`)
Full builder interface for:
- **Agents** - Create AI agents with traits, voice, personality
- **Tools** - Define tools with schemas
- **Skills** - Build reusable skill packages
- **Workflows** - ComfyUI-style node graphs
- **Artifacts** - Manage generated outputs
- **Templates** - Browse skill templates

**Features:**
- Voice persona management
- Publisher vault (signing keys)
- JSON editor for skills
- Live preview

#### Marketplace (`src/components/MarketplaceView.tsx`)
Asset discovery and import:
- Search assets
- Filter by type (capsule, agent, tool, etc.)
- Trust tiers (verified, trusted, community)
- Import to local registry

#### Kanban (`src/components/KanbanView.tsx`)
Task/WIH management:
- Drag-and-drop columns
- Task cards
- Agent assignment
- Status tracking

#### Embodiment Orb (`src/components/EmbodimentOrb.tsx`)
Visual presence indicator:
- Canvas-based animation
- SSE connection to backend
- Pulsing when active
- Color changes for status

#### Operator Console (`src/components/OperatorConsole.tsx`)
System activity monitoring:
- Journal event stream
- Agent status
- Workflow progress

---

## Missing Components (Need to Build)

### 1. Onboarding Wizard

**From Legacy:** `src/wizard/onboarding.ts`, `src/commands/onboard-interactive.ts`

**Current State:** ❌ Not implemented

**Should Port:**
```typescript
interface OnboardingWizard {
  // Step 1: Welcome & Risk
  showWelcome(): void;
  acknowledgeRisk(): Promise<boolean>;
  
  // Step 2: Authentication
  selectAuthMethod(): Promise<AuthMethod>; // oauth, token, setup-token
  configureProvider(provider: string): Promise<void>;
  
  // Step 3: Model Selection ⭐ CRITICAL
  selectDefaultModel(): Promise<ModelRef>;
  configureModelAliases(): Promise<void>;
  
  // Step 4: Workspace
  selectWorkspace(): Promise<string>;
  
  // Step 5: Channels (optional)
  configureChannels?(): Promise<void>;
  
  // Step 6: Skills
  selectInitialSkills(): Promise<string[]>;
  
  // Step 7: Review
  reviewConfiguration(): Promise<void>;
  writeConfig(): Promise<void>;
}
```

**Implementation:** React wizard using A2UI or custom components

### 2. Model Picker/Selection

**From Legacy:** `src/commands/model-picker.ts`, `src/agents/model-selection.ts`

**Current State:** ❌ Not implemented

**Critical Feature:** Legacy has an excellent model picker:
- Searchable model catalog
- Provider grouping
- Capability badges (vision, tools, reasoning)
- Context window display
- Pricing info
- Fuzzy matching
- Alias resolution

**Should Port to A2UI schema:**
```typescript
interface ModelPickerSchema {
  type: 'ModelPicker';
  props: {
    catalog: ModelCatalogEntry[];
    selectedModel?: string;
    onSelect: (model: ModelRef) => void;
    searchPlaceholder: string;
    showPricing: boolean;
    showCapabilities: boolean;
  };
}
```

### 3. Browser Capsule (Non-Playwright)

**Concept:** Like browseruse / computer-use but integrated

**Current State:** ⚠️ Partial (BrowserAdapter exists but needs work)

**Architecture:**
```
┌─────────────────────────────────────────────────────────────────┐
│                    BROWSER CAPSULE                               │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  A2UI       │  │  Browser    │  │      Agent Steps        │  │
│  │  Chrome     │  │  View       │  │      Timeline           │  │
│  │  (nav bar)  │  │  (iframe/   │  │      (capsule)          │  │
│  │             │  │   webview)  │  │                         │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
│                                                                  │
│  Events:                                                         │
│  - browser.agent.step → Update timeline                         │
│  - browser.navigate → Update URL bar                            │
│  - user.click → Send to agent                                   │
└─────────────────────────────────────────────────────────────────┘
```

**Implementation Options:**

**Option A: CDP (Chrome DevTools Protocol)**
```typescript
// Connect to Chrome/Edge via CDP
const cdp = await CDP.connect({
  target: 'ws://localhost:9222/devtools/browser/...'
});

// Capture screenshots
const screenshot = await cdp.send('Page.captureScreenshot');

// Inject cursor tracking
await cdp.send('Runtime.evaluate', {
  expression: `
    document.addEventListener('click', (e) => {
      window.__AGENT__.reportClick(e.clientX, e.clientY);
    });
  `
});
```

**Option B: Remote Browser Service**
```typescript
// Similar to Minimax/Browserbase
const browser = await connectToRemoteBrowser({
  type: 'chromium',
  viewport: { width: 1280, height: 720 }
});

// Stream video/screenshots via WebRTC/WebSocket
browser.on('frame', (jpeg) => {
  updateBrowserView(jpeg);
});
```

**Option C: JSON Render (Claude-style)**
```typescript
// Agent outputs structured JSON for UI
const action = {
  type: 'browser_action',
  action: 'click',
  target: { x: 100, y: 200 },
  description: 'Click the submit button'
};

// UI renders visualization
<BrowserVisualization action={action} screenshot={currentScreenshot} />
```

**Recommended:** Hybrid approach
- Use CDP for local browser control
- Stream screenshots to UI
- Agent sends high-level actions (click, type, scroll)
- UI renders cursor/overlay

---

## Integration with A2R Kernel

### Current Gap

The existing Shell UI doesn't integrate with the A2R Kernel WIH system I built.

### Integration Points

```typescript
// 1. WIH Provider (new)
interface WIHProviderProps {
  children: React.ReactNode;
}

const WIHProvider: React.FC<WIHProviderProps> = ({ children }) => {
  const [activeWIH, setActiveWIH] = useState<WihItem | null>(null);
  const kernel = useKernelClient();
  
  useEffect(() => {
    // Load active WIH on mount
    kernel.getActiveWIH().then(setActiveWIH);
  }, []);
  
  return (
    <WIHContext.Provider value={{ activeWIH, setActiveWIH }}>
      {children}
    </WIHContext.Provider>
  );
};

// 2. WIH Status Bar (integrated into App.tsx)
const WIHStatusBar: React.FC = () => {
  const { activeWIH } = useWIH();
  
  if (!activeWIH) return <button onClick={selectWIH}>Select WIH</button>;
  
  return (
    <div className="wih-status">
      <span className="wih-id">{activeWIH.id}</span>
      <span className="wih-title">{activeWIH.title}</span>
      <span className={`wih-status-${activeWIH.status}`}>{activeWIH.status}</span>
    </div>
  );
};

// 3. Kanban Integration
const KanbanWithWIH: React.FC = () => {
  const { activeWIH } = useWIH();
  const [tasks, setTasks] = useState<Task[]>([]);
  
  useEffect(() => {
    if (activeWIH) {
      // Load related tasks from WIH
      loadTasksForWIH(activeWIH.id).then(setTasks);
    }
  }, [activeWIH]);
  
  return <KanbanView tasks={tasks} />;
};
```

---

## Component Inventory

### ✅ Already Built (in `apps/shell/`)

| Component | File | Status | Notes |
|-----------|------|--------|-------|
| A2UI Renderer | `src/a2ui/` | ✅ Complete | Schema-driven UI |
| Window Manager | `src/components/windowing/` | ✅ Complete | Floating capsules |
| Studio | `src/components/StudioView.tsx` | ✅ Complete | Agent/skill builder |
| Marketplace | `src/components/MarketplaceView.tsx` | ✅ Complete | Asset discovery |
| Kanban | `src/components/KanbanView.tsx` | ✅ Complete | Task board |
| Embodiment Orb | `src/components/EmbodimentOrb.tsx` | ✅ Complete | Visual presence |
| Operator Console | `src/components/OperatorConsole.tsx` | ✅ Complete | Activity log |
| Chat Interface | `src/components/ChatInterface.tsx` | ✅ Complete | Message UI |
| Capsule View | `src/components/CapsuleView.tsx` | ✅ Complete | Capsule container |
| Dock Bar | `src/components/dock/` | ✅ Complete | Bottom dock |
| Tab System | `src/components/tabset/` | ✅ Complete | Tab management |
| Onboarding Context | `src/runtime/OnboardingContext.tsx` | ⚠️ Partial | Framework only |

### ❌ Needs to be Built

| Component | Priority | Complexity | Notes |
|-----------|----------|------------|-------|
| **Onboarding Wizard** | 🔴 High | Medium | Port from Legacy |
| **Model Picker** | 🔴 High | Medium | Port from Legacy |
| **Browser Capsule** | 🟡 Medium | High | Non-playwright approach |
| **WIH Integration** | 🔴 High | Low | Connect to A2R Kernel |
| **Model Catalog** | 🟡 Medium | Low | Fetch from providers |
| **Receipt Viewer** | 🟢 Low | Low | Display completion certs |
| **Policy Dashboard** | 🟢 Low | Medium | Law Layer UI |

---

## File Structure (Corrected)

```
apps/
├── shell/                          # Web UI (React) - ALREADY BUILT
│   ├── src/
│   │   ├── components/
│   │   │   ├── a2ui/              # A2UI renderer ✅
│   │   │   ├── windowing/         # Capsule system ✅
│   │   │   ├── onboarding/        # Onboarding (PARTIAL)
│   │   │   │   ├── OnboardingFlow.tsx
│   │   │   │   ├── ModelSelectionStep.tsx      ⬜ NEW
│   │   │   │   ├── AuthConfigurationStep.tsx   ⬜ NEW
│   │   │   │   └── ...
│   │   │   ├── StudioView.tsx     # Studio ✅
│   │   │   ├── MarketplaceView.tsx # Marketplace ✅
│   │   │   ├── KanbanView.tsx     # WIH board ✅
│   │   │   ├── EmbodimentOrb.tsx  # Orb ✅
│   │   │   ├── OperatorConsole.tsx # Console ✅
│   │   │   ├── ChatInterface.tsx  # Chat ✅
│   │   │   ├── ModelPicker.tsx    # Model selection ⬜ NEW
│   │   │   └── BrowserCapsule.tsx # Browser mini-app ⬜ NEW
│   │   ├── runtime/
│   │   │   ├── ShellState.tsx     # Global state ✅
│   │   │   ├── OnboardingContext.tsx # Onboarding ✅
│   │   │   └── WIHContext.tsx     # WIH state ⬜ NEW
│   │   └── App.tsx                # Main app ✅
│   └── package.json
│
├── shell-electron/                # Electron wrapper - ALREADY BUILT
│   ├── main/index.cjs             # Main process ✅
│   ├── preload/index.ts           # Preload script ✅
│   └── package.json
│
└── a2r-shell/                     # Service wrapper - NEEDS REPOSITIONING
    ├── src/
    │   ├── services/              # Service management ⬜ NEW
    │   ├── cli.ts                 # CLI commands ⬜ UPDATE
    │   └── shell.ts               # Terminal UI (KEEP)
    └── package.json
```

---

## Implementation Priority

### Phase 1: Critical Path (Week 1)
1. **WIH Integration** - Connect Kanban to A2R Kernel
2. **Model Picker** - Port from Legacy
3. **Onboarding Wizard** - Port from Legacy

### Phase 2: Enhanced Experience (Week 2)
4. **Browser Capsule** - Non-playwright browser integration
5. **Receipt Viewer** - Show completion certificates
6. **Policy Dashboard** - Law Layer visualization

### Phase 3: Polish (Week 3)
7. Service wrapper CLI commands
8. Documentation
9. Testing

---

## Summary

**What Exists:**
- Sophisticated React UI with A2UI, capsules, studio, marketplace
- Electron wrapper with BrowserView support
- Embodiment orb, kanban, operator console

**What's Missing:**
- Legacy's onboarding wizard
- Legacy's model picker
- Browser capsule (non-playwright)
- WIH integration with A2R Kernel

**What I Built (Needs Repositioning):**
- Terminal UI should be service wrapper, not primary interface

**Next Steps:**
1. Build WIH integration for existing Kanban
2. Port Legacy model picker to A2UI
3. Port Legacy onboarding wizard
4. Design browser capsule architecture
