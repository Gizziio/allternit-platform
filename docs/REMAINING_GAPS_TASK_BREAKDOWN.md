# 📋 REMAINING GAPS - REVISED TASK BREAKDOWN

**Created:** March 15, 2026  
**Updated:** March 15, 2026 (Post-ShellUI Analysis)  
**Status:** Ready for Execution

---

## 🎯 CRITICAL REVISION: INTEGRATE WITH EXISTING SHELLUI

### What We Already Have

**AgentHub** (`surfaces/platform/src/views/AgentHub.tsx`)
- Main agent management view
- 4 tabs: Studio, Registry, Sessions, Memory
- Dropdown menu for view switching
- CreateAgentForm already exists
- Integrated with agent store

**AgentDashboard** (`surfaces/platform/src/components/AgentDashboard/`)
- Individual agent dashboard
- 12 tabs: overview, runs, tasks, checkpoints, tools, comms, monitoring, environment, swarm, character, workspace, settings
- Full agent lifecycle management
- Character system with stats/avatar
- Skill management

**Rail Navigation** (`surfaces/platform/src/shell/rail/rail.config.tsx`)
- Mode switching (Chat, Cowork, Code, etc.)
- Agent mode already exists
- Navigation integrated with views

**Agent-Workspace** (`surfaces/platform/src/agent-workspace/`)
- Already has hooks: useWorkspace, useA2RStream, useWorkspaceWebSocket
- HTTP client, WebSocket client
- Types and discovery
- WASM wrapper

---

## REVISED GAP ANALYSIS

### Gap 1: ShellUI Components - REVISED ✅

**What We Actually Need:**
- NOT new standalone components
- INTEGRATION with existing AgentHub
- ADD new tab to AgentHub for GizziClaw workspace
- ADD layer visualization to AgentDashboard workspace tab

**Revised Tasks:**

#### Task 1.1: Add GizziClaw Tab to AgentHub (2 hours)

**File:** `surfaces/platform/src/views/AgentHub.tsx`

**What To Do:**
1. Add new tab: 'gizziclaw' to TABS array
2. Create GizziClawTab component
3. Integrate with GizziClaw workspace API
4. Show agent.so workspaces

**Code Structure:**
```typescript
// Update TABS in AgentHub.tsx
const TABS = [
  { id: 'studio' as AgentTab, label: 'Agent Studio', icon: Paintbrush },
  { id: 'registry' as AgentTab, label: 'Agent Registry', icon: Globe },
  { id: 'sessions' as AgentTab, label: 'Sessions', icon: MessageSquareText },
  { id: 'memory' as AgentTab, label: 'Memory', icon: Brain },
  { id: 'gizziclaw' as AgentTab, label: 'GizziClaw', icon: Bot }, // ADD THIS
] as const;

// Add GizziClawTab component
function GizziClawTab() {
  const { workspaces, loading } = useGizziClawWorkspaces();
  
  return (
    <div className="gizziclaw-tab">
      <WorkspaceSelector workspaces={workspaces} />
      <LayerPanel />
      <SkillInstaller />
    </div>
  );
}
```

**Subtasks:**
- [ ] 1.1.1: Add 'gizziclaw' tab to TABS array
- [ ] 1.1.2: Create GizziClawTab component
- [ ] 1.1.3: Create useGizziClawWorkspaces hook
- [ ] 1.1.4: Add WorkspaceSelector (reuse existing or create new)
- [ ] 1.1.5: Add LayerPanel component
- [ ] 1.1.6: Add SkillInstaller (integrate with existing skill system)
- [ ] 1.1.7: Test integration

---

#### Task 1.2: Add Layer Visualization to AgentDashboard (2 hours)

**File:** `surfaces/platform/src/components/AgentDashboard/index.tsx`

**What To Do:**
1. Add new tab: 'layers' to TabId type
2. Add Layers tab to dashboard tabs
3. Create LayersTab component showing 5 GizziClaw layers
4. Integrate with existing character system

**Code Structure:**
```typescript
// Update TabId type
type TabId = 'overview' | 'runs' | 'tasks' | 'checkpoints' | 'tools' | 'comms' | 'monitoring' | 'environment' | 'swarm' | 'character' | 'workspace' | 'settings' | 'layers'; // ADD THIS

// Add LayersTab to render
function renderTab(tabId: TabId) {
  switch (tabId) {
    case 'layers':
      return <LayersTab agent={agent} />;
    // ... other tabs
  }
}

// Create LayersTab component
function LayersTab({ agent }: { agent: Agent }) {
  const { layers } = useGizziClawLayers(agent.id);
  
  return (
    <div className="layers-tab">
      <h3>5-Layer Architecture</h3>
      {layers.map(layer => (
        <LayerCard key={layer.name} layer={layer} />
      ))}
    </div>
  );
}
```

**Subtasks:**
- [ ] 1.2.1: Add 'layers' to TabId type
- [ ] 1.2.2: Add Layers tab to dashboard UI
- [ ] 1.2.3: Create useGizziClawLayers hook
- [ ] 1.2.4: Create LayersTab component
- [ ] 1.2.5: Create LayerCard component
- [ ] 1.2.6: Integrate with existing character system
- [ ] 1.2.7: Test integration

---

#### Task 1.3: Add GizziClaw to Rail Navigation (1 hour)

**File:** `surfaces/platform/src/shell/rail/rail.config.tsx`

**What To Do:**
1. Add GizziClaw mode to rail config
2. Add navigation to AgentHub with gizziclaw tab
3. Integrate with existing mode switching

**Code Structure:**
```typescript
// Add to RAIL_CONFIG
{
  id: 'gizziclaw',
  title: 'GizziClaw',
  icon: Bot, // or new icon
  payload: 'agent-hub?tab=gizziclaw',
  shortcut: 'G',
}
```

**Subtasks:**
- [ ] 1.3.1: Add GizziClaw to rail config
- [ ] 1.3.2: Add icon (use existing or new)
- [ ] 1.3.3: Configure navigation payload
- [ ] 1.3.4: Add keyboard shortcut
- [ ] 1.3.5: Test navigation

---

#### Task 1.4: Create GizziClaw Hooks (1 hour)

**Files:**
- `surfaces/platform/src/lib/agents/useGizziClawWorkspaces.ts`
- `surfaces/platform/src/lib/agents/useGizziClawLayers.ts`
- `surfaces/platform/src/lib/agents/useGizziClawSkills.ts`

**What To Do:**
1. Create hooks that wrap GizziClaw API
2. Integrate with existing agent store
3. Add state management

**Code Structure:**
```typescript
// useGizziClawWorkspaces.ts
export function useGizziClawWorkspaces() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    // Load from GizziClaw API
    loadWorkspaces().then(setWorkspaces).finally(() => setLoading(false));
  }, []);
  
  return { workspaces, loading, refresh };
}
```

**Subtasks:**
- [ ] 1.4.1: Create useGizziClawWorkspaces hook
- [ ] 1.4.2: Create useGizziClawLayers hook
- [ ] 1.4.3: Create useGizziClawSkills hook
- [ ] 1.4.4: Integrate with agent store
- [ ] 1.4.5: Add error handling
- [ ] 1.4.6: Test hooks

---

### Gap 2: Layer Implementations (4-6 hours) 🔴

**Status:** UNCHANGED - Still need to implement 5 layers

**Files:**
- `domains/agent/gizziclaw/src/layers/layer1-cognitive.ts`
- `domains/agent/gizziclaw/src/layers/layer2-identity.ts`
- `domains/agent/gizziclaw/src/layers/layer3-governance.ts`
- `domains/agent/gizziclaw/src/layers/layer4-skills.ts`
- `domains/agent/gizziclaw/src/layers/layer5-business.ts`

**See original task breakdown for details**

---

### Gap 3-6: Other Gaps (18-31 hours) 🟡

**Status:** UNCHANGED

---

## REVISED EXECUTION PLAN

### Phase 1: ShellUI Integration (6 hours) 🔴

**Day 1:**
- Task 1.1: Add GizziClaw Tab to AgentHub (2 hours)
- Task 1.2: Add Layer Visualization to AgentDashboard (2 hours)

**Day 2:**
- Task 1.3: Add GizziClaw to Rail Navigation (1 hour)
- Task 1.4: Create GizziClaw Hooks (1 hour)
- Testing & Polish (2 hours)

### Phase 2: Layer Implementations (4-6 hours) 🔴

**Day 3:**
- Implement all 5 layers (4-6 hours)

### Phase 3: Remaining Gaps (18-31 hours) 🟡

**Days 4-10:**
- Vision Model (8-12 hours)
- Connector APIs (4-6 hours)
- Plugin Marketplace (4-6 hours)
- Build/Test Infra (2-3 hours)

---

## INTEGRATION POINTS

### AgentHub Integration

```
AgentHub (existing)
├── Agent Studio Tab (existing)
├── Agent Registry Tab (existing)
├── Sessions Tab (existing)
├── Memory Tab (existing)
└── GizziClaw Tab (NEW) ← We add this
    ├── Workspace Selector
    ├── Layer Panel
    └── Skill Installer
```

### AgentDashboard Integration

```
AgentDashboard (existing)
├── Overview Tab (existing)
├── Runs Tab (existing)
├── Tasks Tab (existing)
├── Checkpoints Tab (existing)
├── Tools Tab (existing)
├── Comms Tab (existing)
├── Monitoring Tab (existing)
├── Environment Tab (existing)
├── Swarm Tab (existing)
├── Character Tab (existing)
├── Workspace Tab (existing)
├── Settings Tab (existing)
└── Layers Tab (NEW) ← We add this
    ├── Layer 1: Cognitive
    ├── Layer 2: Identity
    ├── Layer 3: Governance
    ├── Layer 4: Skills
    └── Layer 5: Business
```

### Rail Navigation Integration

```
Rail Navigation (existing)
├── Chat Mode (existing)
├── Cowork Mode (existing)
├── Code Mode (existing)
└── GizziClaw Mode (NEW) ← We add this
    └── Opens AgentHub with gizziclaw tab
```

---

## SUCCESS CRITERIA

After ShellUI integration:

- [ ] GizziClaw tab visible in AgentHub
- [ ] Can create GizziClaw workspace from AgentHub
- [ ] Can view 5 layers in AgentDashboard
- [ ] Can switch to GizziClaw mode from rail
- [ ] Hooks working and returning data
- [ ] No breaking changes to existing functionality

---

## IMMEDIATE NEXT STEPS

**Start with Task 1.1: Add GizziClaw Tab to AgentHub**

**Files to modify:**
1. `surfaces/platform/src/views/AgentHub.tsx`
2. `surfaces/platform/src/views/GizziClawTab.tsx` (new)
3. `surfaces/platform/src/lib/agents/useGizziClawWorkspaces.ts` (new)

**Estimated time:** 2 hours

**Ready to begin?**
