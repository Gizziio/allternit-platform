# Agent Hub Integration Architecture

## Overview
Integrate agency-agents inspired specialist templates into the existing A2R agent system.

## Integration Points

### 1. Template Layer (`src/lib/agents/`)
```
Existing:
├── agent-templates.ts          # Template engine & variables
├── native-agent.store.ts       # Zustand store for agents
├── local-agent-registry.ts     # Local agent registration
└── agent.service.ts            # Agent creation service

New:
├── agent-templates.specialist.ts  # 10 specialist templates
└── agent-hub.store.ts             # Agent Hub specific state
```

### 2. UI Layer (`src/components/agents/`)
```
Existing:
├── AgentCreationWizard.tsx     # 4-step wizard
├── AgentSelector.tsx           # Dropdown selector
├── AskUserQuestion.tsx         # Step-by-step questions
└── index.ts                    # Component exports

New:
├── AgentHub.tsx                # Main hub (browse templates)
├── AgentTemplateCard.tsx       # Template display card
├── AgentHubModal.tsx           # Modal version for integration
└── AgentSelectorWizard.tsx     # AskUserQuestion-style selector
```

### 3. CLI Layer (`cli/` or `cmd/`)
```
Existing:
├── cli/commands/
│   ├── agent.ts               # Agent commands
│   ├── session.ts             # Session management
│   └── init.ts                # Initialization

New:
└── cli/commands/
    └── agent-hub.ts           # Interactive agent hub CLI
```

## Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                      User Interface                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  ShellUI     │  │   Terminal   │  │   CLI        │      │
│  │  (React)     │  │   (Blessed)  │  │  (Command)   │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                 │                 │               │
│         └─────────────────┼─────────────────┘               │
│                           │                                 │
│                           ▼                                 │
│                 ┌──────────────────┐                        │
│                 │  AgentHub Store  │                        │
│                 │  (Zustand)       │                        │
│                 └────────┬─────────┘                        │
└──────────────────────────┼──────────────────────────────────┘
                           │
                           ▼
                 ┌──────────────────┐
                 │  Agent Service   │
                 │  (Creation API)  │
                 └────────┬─────────┘
                          │
                          ▼
                 ┌──────────────────┐
                 │  Backend API     │
                 │  (Native Agent)  │
                 └──────────────────┘
```

## Component Integration

### AgentCreationWizard Integration
```tsx
// Current flow:
Step 1: Identity → Step 2: Character → Step 3: Tools → Step 4: Review

// New flow with templates:
Step 0: Template Selection (NEW - AgentHubModal)
  ├─ Browse 10 specialist templates
  ├─ Preview template details
  └─ Select → Auto-fill Steps 1-3

Step 1: Identity (pre-filled from template)
Step 2: Character (pre-filled from template)
Step 3: Tools (pre-filled from template)
Step 4: Review
```

### AskUserQuestion Integration
```tsx
// AgentSelectorWizard - AskUserQuestion-style
<AgentSelectorWizard
  questions={[
    {
      id: 'category',
      question: 'What type of agent do you need?',
      type: 'select',
      options: [
        { value: 'engineering', label: '💻 Engineering', icon: <CodeIcon /> },
        { value: 'design', label: '🎨 Design', icon: <PaletteIcon /> },
        // ...
      ]
    },
    {
      id: 'specialty',
      question: 'What specialty?',
      type: 'select',
      options: filteredByCategory
    },
    {
      id: 'confirm',
      question: 'Create this agent?',
      type: 'confirm'
    }
  ]}
  onComplete={(answers) => createAgentFromTemplate(answers)}
/>
```

## Terminal CLI Integration

### New Command: `a2r agent-hub`
```bash
# Interactive TUI for browsing templates
a2r agent-hub

# Create from template directly
a2r agent-hub create --template frontend-developer --name "My Frontend Helper"

# List available templates
a2r agent-hub list

# Export/import templates
a2r agent-hub export <agent-id> --output agent.json
a2r agent-hub import agent.json
```

### Terminal UI (using Blessed/Ink)
```
┌────────────────────────────────────────────────────────────┐
│                    A2R Agent Hub                            │
├────────────────────────────────────────────────────────────┤
│  Templates                          My Agents               │
│  ─────────                        ─────────                 │
│  ┌────────────────────────────┐   ┌─────────────────────┐  │
│  │ 💻 Frontend Developer      │   │ │ My Helper Agent   │  │
│  │ React, TypeScript, Components│  │ │ Active            │  │
│  │ [Activate] [Preview]       │   │ │ [Use] [Config]    │  │
│  └────────────────────────────┘   └─────────────────────┘  │
│                                                             │
│  [↑↓] Navigate  [Enter] Select  [Esc] Close  [/] Search    │
└────────────────────────────────────────────────────────────┘
```

## State Management

### AgentHub Store (Zustand)
```typescript
interface AgentHubState {
  // Templates
  templates: SpecialistTemplate[];
  selectedTemplate: SpecialistTemplate | null;
  
  // Instances
  myAgents: NativeAgentSession[];
  activeAgentId: string | null;
  
  // UI State
  view: 'templates' | 'my-agents';
  searchQuery: string;
  selectedCategory: AgentCategory | 'all';
  
  // Actions
  selectTemplate: (id: string) => void;
  createFromTemplate: (templateId: string, config: CreateAgentInput) => Promise<void>;
  activateAgent: (agentId: string) => void;
  exportAgent: (agentId: string) => AgentExportData;
  importAgent: (data: AgentExportData) => Promise<void>;
}
```

## File Locations

### Files to Create
```
/Users/macbook/Desktop/a2rchitech-workspace/a2rchitech/
├── 6-ui/a2r-platform/src/
│   ├── lib/agents/
│   │   ├── agent-templates.specialist.ts    # 10 specialist templates
│   │   ├── agent-hub.store.ts               # Hub state management
│   │   └── agent-hub.types.ts               # Hub-specific types
│   │
│   ├── components/agents/
│   │   ├── AgentHub.tsx                     # Main hub component
│   │   ├── AgentHubModal.tsx                # Modal for wizard integration
│   │   ├── AgentTemplateCard.tsx            # Template card
│   │   └── AgentSelectorWizard.tsx          # AskUserQuestion-style
│   │
│   └── cli/commands/
│       └── agent-hub.ts                     # CLI command
│
└── cli/src/commands/
    └── agent-hub.ts                         # Terminal TUI command
```

### Files to Modify
```
├── 6-ui/a2r-platform/src/
│   ├── lib/agents/
│   │   ├── agent-templates.ts               # Add template engine support
│   │   ├── native-agent.store.ts            # Add hub actions
│   │   └── index.ts                         # Export new components
│   │
│   ├── components/agents/
│   │   ├── AgentCreationWizard.tsx          # Add template selection step
│   │   └── index.ts                         # Export new components
│   │
│   └── index.ts                             # Main exports
│
└── package.json                             # Add new dependencies if needed
```

## Testing Strategy

### Unit Tests
- [ ] Template rendering
- [ ] Store actions
- [ ] Component interactions

### Integration Tests
- [ ] Wizard integration (template → creation flow)
- [ ] Store → API integration
- [ ] CLI command execution

### E2E Tests
- [ ] Create agent from template in ShellUI
- [ ] Create agent from template in Terminal
- [ ] Import/export agent
- [ ] Activate/deactivate agent

## Rollout Plan

### Phase 1: Core Integration (Priority)
1. Add 10 specialist templates to `agent-templates.specialist.ts`
2. Create `AgentHubModal` component
3. Integrate with `AgentCreationWizard` Step 0
4. Wire into `native-agent.store.ts`

### Phase 2: Terminal CLI
1. Create `agent-hub` CLI command
2. Build terminal TUI with Blessed/Ink
3. Add template browsing in terminal

### Phase 3: Enhanced Features
1. Import/export functionality
2. AgentSelectorWizard (AskUserQuestion-style)
3. Search and filter
4. Usage analytics

## Dependencies

### Existing (No New Dependencies)
- ✅ React, Framer Motion (animations)
- ✅ Zustand (state management)
- ✅ Lucide React (icons)
- ✅ Existing design tokens (SAND, GLASS, etc.)

### Optional (Terminal TUI)
- `ink` - React for CLI
- `blessed` or `terminal-kit` - Terminal UI

---

## Success Criteria

- [ ] Can browse 10 specialist templates in ShellUI
- [ ] Can create agent from template in 2 clicks
- [ ] Can browse templates in terminal TUI
- [ ] Can create agent from template via CLI command
- [ ] Templates auto-fill AgentCreationWizard
- [ ] Import/export works between instances
- [ ] All existing tests still pass
- [ ] New E2E tests pass
