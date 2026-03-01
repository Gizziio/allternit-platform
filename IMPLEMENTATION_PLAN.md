# A2R Pattern Implementation Plan

## Executive Summary

This document provides a phased implementation plan for cloning incumbent UI patterns into A2R while preserving existing architecture.

---

## Phase 1: Foundation & UI Contracts (Week 1)

### Goals
- Establish TypeScript contracts for all patterns
- Create component directory structure
- Set up state management for new patterns

### Tasks

#### 1.1 Create Type Definitions
**Files:**
- `types/project.ts` - Project, ProjectContext, ProjectSettings
- `types/changeset.ts` - ChangeSet, FileChange, DiffHunk
- `types/artifact.ts` - Artifact, ArtifactVersion
- `types/approval.ts` - ApprovalPolicy, ApprovalRule
- `types/schema-ui.ts` - SchemaUI, SchemaComponent
- `types/sidecar.ts` - SidecarState, Panel states

**Deliverable:** All UI contracts from `UI_CONTRACTS.ts` organized by domain.

#### 1.2 Set Up State Management
**Files:**
- `stores/sidecar-store.ts` - Sidecar visibility, active panel, width
- `stores/changeset-store.ts` - ChangeSet CRUD, review state
- `stores/project-store.ts` - Project management (extract from ChatStore)

**Integration:**
- Connect to existing `nav.store.ts` for view integration
- Persist to localStorage where appropriate

#### 1.3 Directory Structure
```
components/
├── changeset-review/        # NEW
│   ├── ChangeSetReview.tsx
│   ├── FileChangeCard.tsx
│   ├── DiffViewer.tsx
│   └── BatchActions.tsx
├── artifact-sidecar/        # NEW
│   ├── ArtifactSidecar.tsx
│   ├── ArtifactPanel.tsx
│   ├── ContextPanel.tsx
│   └── AgentStatusPanel.tsx
├── schema-renderer/         # NEW
│   ├── SchemaRenderer.tsx
│   ├── ComponentRegistry.tsx
│   └── SchemaContext.tsx
└── ai-elements/             # ENHANCE
    ├── StreamingMessage.tsx
    ├── ToolCallCard.tsx
    └── ApprovalGate.tsx
```

### Acceptance Criteria
- [ ] All TypeScript interfaces compile without errors
- [ ] Store hooks work in React components
- [ ] Directory structure created with placeholder files

### Rollback Plan
- Keep existing types untouched initially
- Use TypeScript union types to support old + new
- Feature flags in stores to disable new features

---

## Phase 2: Header Unification & Sidecar Shell (Week 2)

### Goals
- Unify header controls (remove duplicates)
- Extend ShellFrame for right sidecar
- Make sidecar work in all modes

### Tasks

#### 2.1 Header Refactor
**Files:** `shell/ShellHeader.tsx`

**Changes:**
1. Add Project Switcher dropdown
   ```tsx
   <ProjectSwitcher 
     projects={projects}
     activeProjectId={activeProjectId}
     onSelect={setActiveProject}
   />
   ```

2. Add Artifact Toggle button (always visible)
   ```tsx
   <ArtifactToggle 
     isOpen={sidecar.isOpen && sidecar.activePanel === 'artifact'}
     onClick={() => toggleSidecar('artifact')}
     shortcut="Cmd+Shift+A"
   />
   ```

3. Remove ModeSwitcherWidget from floating overlay
   - Integrate into header properly
   - Single source of truth

#### 2.2 ShellFrame Extension
**Files:** `shell/ShellFrame.tsx`

**Changes:**
```tsx
// Current: 2-column grid
gridTemplateColumns: isRailCollapsed ? '0px 1fr' : 'auto 1fr'

// New: 3-column grid with optional sidecar
gridTemplateColumns: isRailCollapsed 
  ? `0px 1fr ${sidecar.isOpen ? sidecar.width : '0px'}`
  : `auto 1fr ${sidecar.isOpen ? sidecar.width : '0px'}`
```

Add sidecar slot:
```tsx
sidecar?: React.ReactNode;
sidecarWidth?: number;
onSidecarResize?: (width: number) => void;
```

#### 2.3 Sidecar Component
**Files:** `shell/ArtifactSidecar.tsx` (NEW)

**Features:**
- Resizable width (min: 300px, max: 600px)
- Tab navigation: Artifact | Context | Agent | ChangeSet
- Collapsible (slide in/out)
- Keyboard shortcut: Cmd+Shift+A

**Integration:**
```tsx
// ShellApp.tsx
<ShellFrame
  sidecar={
    <ArtifactSidecar 
      state={sidecarState}
      onStateChange={setSidecarState}
    />
  }
  // ... other props
/>
```

### Acceptance Criteria
- [ ] Header shows project switcher
- [ ] Artifact toggle always visible in header
- [ ] Sidecar visible in Chat, Cowork, and Code modes
- [ ] Sidecar resizable and collapsible
- [ ] Cmd+Shift+A toggles sidecar

### Rollback Plan
- Keep old InspectorStack for Code mode as fallback
- Feature flag: `useNewSidecar: boolean`
- Revert grid to 2-column if issues arise

---

## Phase 3: ChangeSet Review System (Week 3)

### Goals
- Formalize ChangeSet types
- Build review UI
- Integrate with drawer

### Tasks

#### 3.1 ChangeSet Types
**Files:** `types/changeset.ts`

**Core Interface:**
```typescript
export interface ChangeSet {
  id: string;
  projectId: string;
  threadId: string;
  messageId: string;
  changes: FileChange[];
  status: 'pending' | 'approved' | 'rejected' | 'applied';
  riskTier: 'safe' | 'low' | 'medium' | 'high' | 'critical';
  requiresApproval: boolean;
  createdAt: Date;
}
```

#### 3.2 ChangeSetReview Component
**Files:** `components/changeset-review/ChangeSetReview.tsx`

**Features:**
- List of file changes
- Expandable diff view per file
- Per-hunk accept/reject
- Per-file accept/reject
- Batch actions (accept all, reject all)
- Risk indicators

**Code Structure:**
```tsx
export function ChangeSetReview({ changeSet }: Props) {
  return (
    <div className="changeset-review">
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
```

#### 3.3 Drawer Integration
**Files:** `views/code/ConsoleDrawer/DrawerRoot.tsx`

**Changes:**
1. Add "Changes" tab
2. Show active ChangeSets
3. Click to open in sidecar for detailed review

**Tab Order:**
1. Queue (Kanban)
2. Changes (NEW)
3. Terminal
4. Logs
5. Context
6. ... etc

#### 3.4 Refactor PatchGate
**Files:** `PatchGate.tsx` → delegate to ChangeSetReview

**Strategy:**
```tsx
// Old PatchGate becomes thin wrapper
export function PatchGate({ changes }) {
  const changeSet = useMemo(() => 
    convertToChangeSet(changes), 
    [changes]
  );
  
  return <ChangeSetReview changeSet={changeSet} />;
}
```

### Acceptance Criteria
- [ ] Every file write creates a ChangeSet
- [ ] ChangeSetReview shows per-file diffs
- [ ] Accept/Reject per hunk and per file
- [ ] Batch "apply all accepted" works
- [ ] Risk tier visualization
- [ ] No silent auto-apply for high-risk

### Rollback Plan
- Keep PatchGate as backup
- Feature flag: `useChangeSetReview: boolean`
- Revert to simple diff view if needed

---

## Phase 4: AI Elements & Streaming (Week 4)

### Goals
- Enhance message components with streaming
- Add tool call visualization
- Integrate approval gates

### Tasks

#### 4.1 Streaming Message Component
**Files:** `components/ai-elements/StreamingMessage.tsx`

**Features:**
- Typewriter effect for streaming text
- Cursor indicator during generation
- Smooth scroll to bottom
- Handle partial tool calls

**Integration:**
```tsx
// In conversation.tsx
<Message 
  content={message.content}
  isStreaming={message.status === 'streaming'}
/>
```

#### 4.2 Tool Call Visualization
**Files:** `components/ai-elements/ToolCallCard.tsx`

**States:**
1. Pending - Waiting for approval
2. Running - Executing
3. Completed - Success
4. Error - Failed
5. Rejected - User denied

**Features:**
- Tool name and icon
- Arguments (collapsible)
- Result preview
- Approval buttons (if pending)
- Retry button (if error)

#### 4.3 Approval Gate Integration
**Files:** `components/ai-elements/ApprovalGate.tsx`

**Features:**
- Show approval reason
- Risk tier badge
- Approve/Reject buttons
- "Remember my choice" checkbox

**Integration with ToolCall:**
```tsx
<ToolCallCard
  toolCall={toolCall}
  approval={approval}
  onApprove={() => approve(toolCall.id)}
  onReject={() => reject(toolCall.id)}
/>
```

#### 4.4 Message Parts Enhancement
**Files:** `views/chat/ChatMessageParts.tsx`

**Changes:**
- Add streaming support for each part type
- Route large artifacts to sidecar
- Show tool calls inline with approval gates

### Acceptance Criteria
- [ ] Streaming messages show typewriter effect
- [ ] Tool calls show execution state
- [ ] Pending tool calls show approval UI
- [ ] Large artifacts auto-route to sidecar
- [ ] Smooth scroll during streaming

### Rollback Plan
- Keep non-streaming message components
- Feature flag: `useStreamingMessages: boolean`
- Disable tool approval if issues

---

## Phase 5: Schema Renderer (Week 5-6)

### Goals
- Build schema-driven UI renderer
- Integrate with Cowork mode
- Support MCP-style miniapps

### Tasks

#### 5.1 Core Renderer
**Files:** `components/schema-renderer/SchemaRenderer.tsx`

**Algorithm:**
```tsx
export function SchemaRenderer({ schema }: Props) {
  const [data, setData] = useState(() => 
    initializeData(schema.dataModel)
  );
  
  return (
    <SchemaContext.Provider value={{ data, setData }}>
      <RenderComponent id={schema.root} />
    </SchemaContext.Provider>
  );
}

function RenderComponent({ id }: { id: string }) {
  const { schema } = useSchemaContext();
  const component = schema.components.find(c => c.id === id);
  const Renderer = COMPONENT_REGISTRY[component.type];
  
  return <Renderer {...component.props} />;
}
```

#### 5.2 Component Registry
**Files:** `components/schema-renderer/registry.tsx`

**Initial Components:**
- Layout: Container, Stack, Grid, Card, Tabs
- Form: TextField, TextArea, Select, Checkbox, Switch
- Display: Text, Heading, Badge, Alert
- AI: Message, ToolCall, Artifact (reuse ai-elements)

#### 5.3 Cowork Integration
**Files:** `views/cowork/CoworkRoot.tsx`

**Changes:**
```tsx
export function CoworkRoot() {
  const { activeWIH } = useCoworkStore();
  
  if (activeWIH?.uiSchema) {
    return (
      <SchemaRenderer 
        schema={activeWIH.uiSchema}
        onAction={handleSchemaAction}
      />
    );
  }
  
  return <DefaultCoworkView />;
}
```

#### 5.4 Schema Validation
**Files:** `components/schema-renderer/validate.ts`

**Validation Rules:**
- Component types must be in registry
- Data model types must be valid
- Actions must reference valid handlers
- Circular dependencies in children

### Acceptance Criteria
- [ ] Schema renders UI from JSON
- [ ] Form components bind to data model
- [ ] Actions trigger handlers
- [ ] Conditional rendering works
- [ ] Validation catches schema errors

### Rollback Plan
- Keep hardcoded Cowork forms as fallback
- Feature flag: `useSchemaRenderer: boolean`
- Schema validation prevents broken renders

---

## Phase 6: Polish & Integration (Week 7-8)

### Goals
- Keyboard shortcuts
- Accessibility audit
- Performance optimization
- Documentation

### Tasks

#### 6.1 Keyboard Shortcuts
**Files:** `vendor/hotkeys.ts`

**Add:**
- `Cmd+Shift+A` - Toggle artifact sidecar
- `Cmd+J` - Toggle terminal drawer
- `Cmd+Y` - Accept current change
- `Cmd+N` - Reject current change
- `Cmd+Up/Down` - Navigate changes

#### 6.2 Accessibility Audit
**Checklist:**
- [ ] Focus rings visible on glass surfaces
- [ ] ARIA labels on all controls
- [ ] Keyboard navigation works
- [ ] Color contrast passes WCAG AA
- [ ] Screen reader tested

#### 6.3 Performance Optimization
**Targets:**
- Message list virtualization (react-window)
- Diff view virtualization for large files
- Schema component lazy loading
- Store selector optimization

#### 6.4 Documentation
**Files:**
- `docs/ui-patterns.md` - Pattern documentation
- `docs/components.md` - Component API docs
- `docs/stores.md` - State management guide

### Acceptance Criteria
- [ ] All keyboard shortcuts work
- [ ] Lighthouse accessibility score 100
- [ ] No performance regressions
- [ ] Documentation complete

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Breaking changes | Feature flags for all new features |
| Performance issues | Lazy loading, virtualization |
| Accessibility gaps | Automated testing, manual audit |
| User confusion | Gradual rollout, tooltips |
| Scope creep | Strict phase boundaries |

---

## Success Metrics

| Metric | Baseline | Target |
|--------|----------|--------|
| Component bundle size | TBD | < 500KB |
| Time to first paint | TBD | < 2s |
| Message render time | TBD | < 16ms |
| ChangeSet review time | TBD | < 30s per file |
| User satisfaction | TBD | > 4.0/5 |

---

## Appendix: File Checklist

### New Files (to create)
- [ ] `types/project.ts`
- [ ] `types/changeset.ts`
- [ ] `types/artifact.ts`
- [ ] `types/approval.ts`
- [ ] `types/schema-ui.ts`
- [ ] `types/sidecar.ts`
- [ ] `stores/sidecar-store.ts`
- [ ] `stores/changeset-store.ts`
- [ ] `components/changeset-review/ChangeSetReview.tsx`
- [ ] `components/changeset-review/FileChangeCard.tsx`
- [ ] `components/changeset-review/DiffViewer.tsx`
- [ ] `components/artifact-sidecar/ArtifactSidecar.tsx`
- [ ] `components/schema-renderer/SchemaRenderer.tsx`
- [ ] `components/ai-elements/StreamingMessage.tsx`
- [ ] `components/ai-elements/ToolCallCard.tsx`

### Modified Files (to update)
- [ ] `shell/ShellApp.tsx` - Add sidecar state
- [ ] `shell/ShellFrame.tsx` - 3-column layout
- [ ] `shell/ShellHeader.tsx` - Project switcher, artifact toggle
- [ ] `shell/ShellRail.tsx` - Project-scoped threads
- [ ] `views/ViewHost.tsx` - Sidecar context
- [ ] `views/code/InspectorStack.tsx` - Migrate to sidecar
- [ ] `views/code/ConsoleDrawer/DrawerRoot.tsx` - Add Changes tab
- [ ] `PatchGate.tsx` - Delegate to ChangeSetReview
- [ ] `components/ai-elements/message.tsx` - Streaming
- [ ] `components/ai-elements/conversation.tsx` - Streaming
- [ ] `views/chat/ChatMessageParts.tsx` - Sidecar routing
- [ ] `views/cowork/CoworkRoot.tsx` - Schema renderer

---

*Implementation plan for cloning incumbent patterns into A2R*
