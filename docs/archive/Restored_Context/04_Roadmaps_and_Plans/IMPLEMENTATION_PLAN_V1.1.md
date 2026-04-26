# Allternit Pattern Implementation Plan v1.1

## Executive Summary

Phased implementation plan for cloning incumbent UI patterns into Allternit.

**CORRECTIONS IN v1.1:**
- Removed "placeholder files" - all files must compile or not be created
- Added ShellFrame reality check (2-pane → 3-pane)
- Added Pattern 0: Remove floating widgets
- All Date types → ISODate (string)

---

## Phase 0: Cleanup (Day 1) - DO FIRST

### Goal
Remove floating widget duplicates before any other work.

### Tasks

#### 0.1 Remove Floating Widgets
**File:** `shell/ShellApp.tsx`

**Remove:**
```tsx
// DELETE these lines:
<SidebarToggleWidget isCollapsed={isRailCollapsed}
      onToggle={() => setIsRailCollapsed(!isRailCollapsed)} />
<ModeSwitcherWidget activeMode={activeMode} onModeChange={handleModeChange} />
```

**Keep:**
```tsx
// These already exist and are the single source of truth:
<ShellRail onToggle={() => setIsRailCollapsed(!isRailCollapsed)} />
<ShellHeader mode={activeMode} onModeChange={handleModeChange} />
```

**Verification:**
- [ ] No floating widgets visible
- [ ] Rail collapse still works (via ShellRail)
- [ ] Mode switch still works (via ShellHeader)

---

## Phase 1: Contracts & State (Days 2-3)

### Goals
- Create type definitions (real files, not placeholders)
- Set up state management
- All files must compile

### Tasks

#### 1.1 Create Type Definitions
**Files to create:**

```typescript
// core/contracts/project.ts
export interface Project {
  readonly id: string;
  readonly createdAt: string; // ISODate
  // ... full interface
}

// core/contracts/thread.ts
export interface Thread {
  readonly id: string;
  readonly projectId: string;
  // ... normalized references only
}

// core/contracts/changeset.ts
export interface ChangeSet {
  readonly id: string;
  status: 'generating' | 'pending' | 'in_review' | 'approved' | 'rejected' | 'applied';
  // ... strict state machine
}

// core/contracts/artifact.ts
export interface Artifact {
  readonly id: string;
  // ... with versioning
}

// core/contracts/run.ts (NEW)
export interface Run {
  readonly id: string;
  // ... agent execution tracking
}

// core/contracts/workitem.ts (NEW)
export interface WorkItem {
  readonly id: string;
  // ... WIH for queue
}

// core/contracts/index.ts
export * from './project';
export * from './thread';
// ... etc
```

**Acceptance Criteria:**
- [ ] All interfaces compile with `tsc --noEmit`
- [ ] No `any` types
- [ ] All Dates are `string` (ISODate)
- [ ] All entity references are normalized (ids, not nested objects)

#### 1.2 Create Stores
**Files:**

```typescript
// stores/sidecar-store.ts
import { create } from 'zustand';
import { SidecarState } from '../core/contracts';

export const useSidecarStore = create<SidecarState>((set) => ({
  isOpen: false,
  activePanel: 'artifact',
  width: 350,
  // ... full implementation
}));

// stores/changeset-store.ts
export const useChangeSetStore = create<ChangeSetStore>((set, get) => ({
  changeSets: {}, // Map by id
  activeChangeSetId: null,
  // ... CRUD operations
}));

// stores/project-store.ts
export const useProjectStore = create<ProjectStore>((set, get) => ({
  projects: {},
  activeProjectId: null,
  // ... full implementation
}));
```

**Acceptance Criteria:**
- [ ] Stores compile without errors
- [ ] Stores have basic CRUD operations
- [ ] State shape matches contracts

---

## Phase 2: Sidecar Shell (Days 4-6)

### Goals
- Extend ShellFrame from 2-pane to 3-pane
- Create ArtifactSidecar component
- Wire up header toggle

### Tasks

#### 2.1 Extend ShellFrame
**File:** `shell/ShellFrame.tsx`

**Current (2-pane):**
```tsx
gridTemplateColumns: isRailCollapsed ? '0px 1fr' : 'auto 1fr'
```

**Target (3-pane):**
```tsx
gridTemplateColumns: isRailCollapsed 
  ? `0px 1fr ${sidecarOpen ? sidecarWidth : '0px'}`
  : `auto 1fr ${sidecarOpen ? sidecarWidth : '0px'}`
```

**Add sidecar slot:**
```tsx
interface ShellFrameProps {
  rail: React.ReactNode;
  canvas: React.ReactNode;
  sidecar?: React.ReactNode;  // NEW
  sidecarOpen?: boolean;      // NEW
  sidecarWidth?: number;      // NEW
  // ...
}
```

**Acceptance Criteria:**
- [ ] ShellFrame accepts sidecar props
- [ ] 3-column grid renders correctly
- [ ] Sidebar collapse still works

#### 2.2 Create ArtifactSidecar
**File:** `shell/ArtifactSidecar.tsx`

```tsx
export function ArtifactSidecar() {
  const { isOpen, activePanel, width } = useSidecarStore();
  
  if (!isOpen) return null;
  
  return (
    <div style={{ width, height: '100%' }}>
      <SidecarTabs active={activePanel} />
      <SidecarPanel panel={activePanel} />
    </div>
  );
}

function SidecarPanel({ panel }: { panel: SidecarPanel }) {
  switch (panel) {
    case 'artifact': return <ArtifactPanel />;
    case 'context': return <ContextPanel />;
    case 'agent': return <AgentPanel />;
    case 'changeset': return <ChangeSetPanel />;
  }
}
```

**Acceptance Criteria:**
- [ ] Sidecar renders in ShellFrame
- [ ] Tabs switch panels
- [ ] Resizable (future: drag handle)

#### 2.3 Add Header Toggle
**File:** `shell/ShellHeader.tsx`

```tsx
export function ShellHeader() {
  const { isOpen, toggle } = useSidecarStore();
  
  return (
    <header>
      <ProjectSwitcher />        {/* NEW */}
      <ModeSwitcher />
      <ArtifactToggle           {/* NEW */}
        isOpen={isOpen}
        onClick={toggle}
        shortcut="Cmd+Shift+A"
      />
      {/* ... */}
    </header>
  );
}
```

**Acceptance Criteria:**
- [ ] Project switcher visible
- [ ] Artifact toggle visible
- [ ] Click toggles sidecar
- [ ] Keyboard shortcut works

---

## Phase 3: ChangeSet Review (Days 7-9)

### Goals
- Build ChangeSetReview component
- Integrate with drawer
- Replace PatchGate

### Tasks

#### 3.1 ChangeSetReview Component
**Files:**

```tsx
// components/changeset-review/ChangeSetReview.tsx
export function ChangeSetReview({ changeSetId }: Props) {
  const changeSet = useChangeSetStore(s => s.changeSets[changeSetId]);
  
  return (
    <div>
      <ChangeSetHeader changeSet={changeSet} />
      <FileChangeList>
        {changeSet.changes.map(change => (
          <FileChangeCard key={change.id} change={change} />
        ))}
      </FileChangeList>
      <BatchActions changeSet={changeSet} />
    </div>
  );
}

// components/changeset-review/FileChangeCard.tsx
export function FileChangeCard({ change }: { change: FileChange }) {
  return (
    <Card>
      <FileHeader change={change} />
      <DiffViewer hunks={change.hunks} />
      <ReviewButtons change={change} />
    </Card>
  );
}
```

**Acceptance Criteria:**
- [ ] Shows file changes
- [ ] Expandable diff view
- [ ] Per-hunk accept/reject
- [ ] Per-file accept/reject
- [ ] Risk tier badges

#### 3.2 Drawer Integration
**File:** `views/code/ConsoleDrawer/DrawerRoot.tsx`

**Add tab:**
```tsx
const tabs = [
  { id: 'queue', label: 'Queue' },
  { id: 'changes', label: 'Changes' }, // NEW
  { id: 'terminal', label: 'Terminal' },
  // ...
];

function renderContent(tab: string) {
  switch (tab) {
    case 'queue': return <KanbanBoard />;
    case 'changes': return <ChangeSetQueue />; // NEW
    case 'terminal': return <Terminal />;
    // ...
  }
}
```

**Acceptance Criteria:**
- [ ] Changes tab visible
- [ ] Shows pending ChangeSets
- [ ] Click opens in sidecar

#### 3.3 Refactor PatchGate
**File:** `PatchGate.tsx`

```tsx
// Old PatchGate becomes thin wrapper
export function PatchGate({ changes }) {
  const changeSet = useMemo(() => 
    convertToChangeSet(changes), 
    [changes]
  );
  
  return <ChangeSetReview changeSetId={changeSet.id} />;
}
```

**Acceptance Criteria:**
- [ ] PatchGate still works
- [ ] Uses ChangeSetReview internally
- [ ] No duplicate code

---

## Phase 4: AI Elements & Schema (Days 10-12)

### Goals
- Port/enhance AI Elements components
- Build schema renderer
- Integrate with Cowork

### Tasks

#### 4.1 Streaming Message Component
**File:** `components/ai-elements/StreamingMessage.tsx`

```tsx
export function StreamingMessage({ message }: Props) {
  const { isStreaming, chunksReceived } = message.streamState || {};
  
  return (
    <MessageContainer>
      {message.parts.map((part, i) => (
        <MessagePart key={i} part={part} />
      ))}
      {isStreaming && <StreamingCursor />}
    </MessageContainer>
  );
}
```

**Acceptance Criteria:**
- [ ] Shows streaming indicator
- [ ] Smooth scroll to bottom
- [ ] Tool calls show progress

#### 4.2 Tool Call Card
**File:** `components/ai-elements/ToolCallCard.tsx`

```tsx
export function ToolCallCard({ toolCall }: Props) {
  const { status, approval } = toolCall;
  
  return (
    <Card>
      <ToolHeader toolCall={toolCall} />
      {status === 'pending' && approval?.required && (
        <ApprovalGate toolCall={toolCall} />
      )}
      {status === 'running' && <ProgressIndicator />}
      {status === 'completed' && <ResultPreview result={toolCall.result} />}
    </Card>
  );
}
```

**Acceptance Criteria:**
- [ ] Shows tool name + args
- [ ] Pending shows approval UI
- [ ] Running shows progress
- [ ] Completed shows result

#### 4.3 Schema Renderer
**File:** `components/schema-renderer/SchemaRenderer.tsx`

```tsx
export function SchemaRenderer({ schema }: Props) {
  const [data, setData] = useState(() => 
    initializeData(schema.dataModel)
  );
  
  return (
    <SchemaContext.Provider value={{ data, setData, schema }}>
      <RenderComponent id={schema.root} />
    </SchemaContext.Provider>
  );
}
```

**Acceptance Criteria:**
- [ ] Renders from JSON schema
- [ ] Form inputs bind to data
- [ ] Actions trigger handlers
- [ ] Conditional rendering works

---

## Phase 5: Polish (Days 13-14)

### Goals
- Keyboard shortcuts
- Accessibility
- Performance

### Tasks

#### 5.1 Keyboard Shortcuts
**File:** `vendor/hotkeys.ts`

```typescript
export const PLATFORM_SHORTCUTS = {
  // ... existing shortcuts
  SIDECAR: {
    TOGGLE: { keys: 'Cmd+Shift+A', description: 'Toggle artifact sidecar' },
  },
  DRAWER: {
    TOGGLE_TERMINAL: { keys: 'Cmd+J', description: 'Toggle terminal drawer' },
  },
  CHANGESET: {
    ACCEPT: { keys: 'Cmd+Y', description: 'Accept current change' },
    REJECT: { keys: 'Cmd+N', description: 'Reject current change' },
    NEXT: { keys: 'Cmd+Down', description: 'Next change' },
    PREV: { keys: 'Cmd+Up', description: 'Previous change' },
  },
};
```

#### 5.2 Accessibility
- [ ] Focus rings on glass surfaces
- [ ] ARIA labels on all controls
- [ ] Keyboard navigation
- [ ] Color contrast audit
- [ ] Reduced motion support

#### 5.3 Performance
- [ ] Message list virtualization
- [ ] Diff view virtualization
- [ ] Store selector optimization
- [ ] Bundle analysis

---

## Acceptance Criteria by Phase

### Phase 0
- [ ] No floating widgets
- [ ] All controls work via ShellRail/ShellHeader

### Phase 1
- [ ] All contracts compile
- [ ] Stores have CRUD operations
- [ ] No placeholder files (all compile or don't exist)

### Phase 2
- [ ] ShellFrame has 3 columns
- [ ] Sidecar visible in all modes
- [ ] Header has project switcher + artifact toggle
- [ ] Cmd+Shift+A toggles sidecar

### Phase 3
- [ ] ChangeSetReview shows diffs
- [ ] Accept/Reject per hunk and file
- [ ] Batch apply works
- [ ] Risk tier visualization

### Phase 4
- [ ] Streaming messages work
- [ ] Tool approval UI works
- [ ] Schema renderer works

### Phase 5
- [ ] All keyboard shortcuts work
- [ ] Lighthouse accessibility 100
- [ ] No performance regressions

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Breaking changes | Phase 0 cleanup first |
| Type errors | Strict compilation checks |
| Scope creep | Phase boundaries enforced |
| Performance | Virtualization for lists |

---

## Rollback Plan

**If critical issues:**
1. Revert ShellFrame to 2-column
2. Disable sidecar store
3. Keep ChangeSetReview as separate view
4. Revert to PatchGate

**Feature flags:**
```typescript
const FEATURES = {
  useNewSidecar: true,
  useChangeSetReview: true,
  useStreamingMessages: true,
};
```

---

*Implementation Plan v1.1 - Production-ready execution*
