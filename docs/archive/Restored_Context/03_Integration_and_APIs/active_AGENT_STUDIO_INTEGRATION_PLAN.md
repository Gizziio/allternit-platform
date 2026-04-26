# Agent Studio Integration Plan

**Goal:** Enable full agent workflow: Create → Select → Send Messages

## Current State

### ✅ What Works:
1. Agent Studio view exists (AgentView.tsx)
2. Agent creation wizard works
3. Agent store has fetchAgents(), createAgent()
4. ChatView has "Agent On" toggle and "Choose Agent" button
5. useSurfaceAgentSelection() hook exists

### ❌ What's Broken:
1. Agents aren't being fetched on app load
2. "Choose Agent" dropdown doesn't show available agents
3. Can't select an agent for sessions
4. Agent sessions can't be created with real agents

## Root Cause

The `useAgentStore` needs to call `fetchAgents()` to populate the agent list, but this isn't happening automatically. The agent registry API might also not be running.

## Solution

### Step 1: Fetch Agents on App Load
**File:** `surfaces/allternit-platform/src/allternit-usage/ui/App.tsx`

Add agent fetching to the existing useEffect:

```typescript
// Fetch agents on mount (along with plugin settings)
useEffect(() => {
  let isMounted = true

  const loadSettings = async () => {
    try {
      // Fetch available agents from registry
      const { fetchAgents } = await import('@/lib/agents/agent.store')
      fetchAgents()  // Fetch agents in parallel with plugins
      
      const availablePlugins = await invoke<PluginMeta[]>("list_plugins")
      // ... rest of existing code
    }
  }

  loadSettings()
  // ...
}, [])
```

### Step 2: Create Agent Selector Component
**File:** `surfaces/allternit-platform/src/components/agents/AgentSelector.tsx` (NEW)

```typescript
import { useSurfaceAgentSelection } from '@/lib/agents/surface-agent-context'
import { useAgentStore } from '@/lib/agents/agent.store'
import { useAgentSurfaceModeStore } from '@/stores/agent-surface-mode.store'

export function AgentSelector({ surface }: { surface: AgentModeSurface }) {
  const { agentModeEnabled, selectedAgent } = useSurfaceAgentSelection(surface)
  const agents = useAgentStore((state) => state.agents)
  const setSelectedAgent = useAgentSurfaceModeStore(
    (state) => state.setSelectedAgent
  )

  if (!agentModeEnabled) return null

  return (
    <select
      value={selectedAgent?.id || ''}
      onChange={(e) => setSelectedAgent(surface, e.target.value || null)}
    >
      <option value="">Choose Agent...</option>
      {agents.map(agent => (
        <option key={agent.id} value={agent.id}>
          {agent.name} ({agent.model})
        </option>
      ))}
    </select>
  )
}
```

### Step 3: Wire Agent Selector to Chat Composer
**File:** `surfaces/allternit-platform/src/views/chat/ChatComposer.tsx`

Replace "Choose Agent" button with actual selector:

```typescript
import { AgentSelector } from '@/components/agents/AgentSelector'

// In composer row:
{agentModeEnabled && (
  <AgentSelector surface="chat" />
)}
```

### Step 4: Enable Agent Session Creation
**File:** `surfaces/allternit-platform/src/lib/agents/native-agent.store.ts`

Update createSession to use selected agent:

```typescript
createSession: async (name, description, options = {}) => {
  const request: CreateNativeAgentSessionRequest = {
    name,
    description,
    agentId: options.agentId,  // From selected agent
    agentName: options.agentName,
    origin_surface: options.originSurface,
    session_mode: options.sessionMode,
    // ... rest of fields
  }
  // ...
}
```

### Step 5: Test End-to-End Flow

1. **Open Agent Studio** → Create an agent
2. **Switch to Chat** → Toggle "Agent On"
3. **Click "Choose Agent"** → See created agent in dropdown
4. **Select agent** → Agent name appears
5. **Send message** → Session created with agent metadata
6. **Verify backend** → Check session has correct metadata

## Implementation Order

1. ✅ Examine current code (DONE)
2. ⏳ Add agent fetching to App.tsx
3. ⏳ Create AgentSelector component
4. ⏳ Wire to Chat Composer
5. ⏳ Test with browser agent
6. ⏳ Fix any issues

## Backend Requirements

The following API endpoints must be working:

- `GET /api/v1/registry/agents` - List agents
- `POST /api/v1/registry/agents` - Create agent
- `GET /api/v1/agent-sessions` - List sessions
- `POST /api/v1/agent-sessions` - Create session with agent

If these aren't running, we'll need to start the backend API server.
