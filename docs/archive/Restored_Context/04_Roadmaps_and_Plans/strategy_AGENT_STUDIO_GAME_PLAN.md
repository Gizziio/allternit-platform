# Agent Studio - Comprehensive Implementation Game Plan

## Executive Summary

**Status:** UI shell built, backend integration incomplete  
**Goal:** Fully functional Agent Studio with Rails integration, voice support, and agent communication

---

## Phase 1: Agent Creation Enhancement (Week 1)

### 1.1 Voice Settings Integration
**Current:** No voice settings in agent creation  
**Required:** Add voice selection and persona configuration

#### UI Changes
```typescript
// Add to CreateAgentInput type
interface CreateAgentInput {
  // ... existing fields
  voice?: {
    voiceId: string;        // From voice service
    speed: number;          // 0.5 - 2.0
    pitch: number;          // -10 to +10
    persona?: string;       // "professional", "friendly", "technical"
  };
  personaTemplate?: string;  // Pre-defined persona
}
```

#### Implementation Steps
1. **Voice Service Integration**
   - Call `GET /api/v1/voice/voices` to get available voices
   - Add voice selector dropdown to agent creation form
   - Add speed/pitch sliders
   - Add persona template selector

2. **Store Voice Config**
   - Store voice settings in agent.config.voice
   - API endpoint: `PUT /api/v1/agents/:id/voice`

3. **Files to Modify**
   - `agent.types.ts` - Add voice config types
   - `CreateAgentForm` - Add voice UI section
   - `agent.service.ts` - Add voice config methods
   - `6-apps/api/src/agents.rs` - Add voice endpoints

### 1.2 Agent Type Differentiation
**Current:** All agents are the same type  
**Required:** Orchestrator, Sub-agent, Worker, Reviewer types

#### UI Changes
```typescript
enum AgentType {
  ORCHESTRATOR = 'orchestrator',  // Coordinates other agents
  SUB_AGENT = 'sub-agent',        // Child of orchestrator
  WORKER = 'worker',              // Executes tasks
  REVIEWER = 'reviewer',          // Reviews/approves work
  STANDALONE = 'standalone'       // Independent agent
}

interface CreateAgentInput {
  agentType: AgentType;
  parentAgentId?: string;        // For sub-agents
  executionMode: 'sequential' | 'parallel' | 'swarm';
  triggerConditions?: TriggerCondition[];
}
```

#### Implementation Steps
1. **Agent Type Selector**
   - Add dropdown in create form
   - Show/hide fields based on type
   - Orchestrator: Shows "Add Sub-agent" button
   - Sub-agent: Shows parent selector

2. **Agent Hierarchy**
   - Store parent-child relationships
   - Visual tree view in agent list
   - API: `GET /api/v1/agents/:id/subagents`

3. **Execution Mode**
   - Sequential: Tasks execute one after another
   - Parallel: Tasks execute simultaneously
   - Swarm: Multiple agents collaborate

---

## Phase 2: Real Rails Integration (Week 2-3)

### 2.1 Fix Run Execution Pipeline
**Current:** `startRun()` creates DAG but doesn't execute  
**Required:** Full execution pipeline with Kernel

#### Execution Flow
```
User Input
    ↓
Agent Studio UI
    ↓
1. Create DAG (Rails) - POST /api/v1/rails/v1/plan
    ↓
2. Create WIHs (Rails) - Automatic from DAG
    ↓
3. Pick up WIH (Rails) - POST /api/v1/rails/v1/wihs/pickup
    ↓
4. Execute via Kernel - POST /api/v1/sessions
    ↓
5. Stream events (Ledger) - GET /api/v1/rails/v1/ledger/tail
    ↓
6. Update WIH status (Rails) - POST /api/v1/rails/v1/wihs/:id/close
```

#### Implementation Steps

**Backend (6-apps/api/src/agents.rs)**
```rust
// New endpoint for agent execution
POST /api/v1/agents/:id/execute
{
  "input": "user task description",
  "context": { ... },
  "options": { ... }
}

// Implementation:
1. Get agent config from registry
2. Create DAG via Rails plan_new()
3. Get WIHs for the DAG
4. For each WIH:
   - Pick up WIH
   - Create Kernel session with agent profile
   - Send input to session
   - Stream events to client
   - Close WIH with result
```

**Frontend (agent.service.ts)**
```typescript
export async function executeAgent(agentId: string, input: string) {
  // 1. Create execution plan
  const plan = await railsApi.plan.new({ text: input });
  
  // 2. Get WIHs
  const { wihs } = await railsApi.wihs.list({ dag_id: plan.dag_id });
  
  // 3. Execute each WIH via Kernel
  for (const wih of wihs) {
    // Pick up work
    await railsApi.wihs.pickup({
      dag_id: plan.dag_id,
      node_id: wih.node_id,
      agent_id: agentId
    });
    
    // Create kernel session
    const session = await api.createSession(agentId);
    
    // Send input
    await api.sendMessage(session.id, input);
    
    // Stream events (handle in component)
    
    // Close WIH
    await railsApi.wihs.close(wih.wih_id, {
      status: 'completed',
      evidence: [result]
    });
  }
}
```

### 2.2 Event Streaming
**Current:** No real-time updates  
**Required:** Live event stream from Ledger

#### Implementation
```typescript
// In AgentView.tsx
useEffect(() => {
  if (!selectedAgentId) return;
  
  // Connect to Rails ledger stream
  const eventSource = new EventSource(
    `${API_BASE_URL}/rails/v1/ledger/stream?agent_id=${selectedAgentId}`
  );
  
  eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    handleLedgerEvent(data);
  };
  
  return () => eventSource.close();
}, [selectedAgentId]);
```

---

## Phase 3: Prompt Pack Integration (Week 3-4)

### 3.1 Prompt Pack Service
**Current:** No prompt pack UI  
**Required:** Browse, select, and execute prompts

#### New Service: Prompt Pack
```
Location: services/prompt-pack/ (new)
Port: 3005

Endpoints:
GET  /api/v1/prompts              - List all prompts
GET  /api/v1/prompts/:id          - Get prompt details
POST /api/v1/prompts/:id/execute  - Execute prompt with params
GET  /api/v1/categories           - List categories
GET  /api/v1/tags                 - List tags
```

#### UI Components
1. **Prompt Browser**
   - Grid of prompt cards
   - Filter by category/tag
   - Search functionality
   - Preview prompt content

2. **Prompt Selector in Agent Studio**
   - Add "Select from Prompt Pack" button in create form
   - Shows prompt browser modal
   - Auto-fills agent config from selected prompt

3. **Prompt → Rails Conversion**
   ```typescript
   // When prompt is selected
   async function loadPromptToAgent(promptId: string) {
     const prompt = await promptApi.getPrompt(promptId);
     
     // Convert to Rails DAG
     const dag = await railsApi.plan.new({
       text: prompt.template,
       dag_id: undefined  // Create new
     });
     
     // Store DAG reference in agent
     await api.updateAgent(agentId, {
       config: {
         ...agent.config,
         promptDagId: dag.dag_id
       }
     });
   }
   ```

### 3.2 Agent Runner Integration
**Current:** RunnerView is a static mock  
**Required:** Live execution monitor

#### Unified Agent Runner
```typescript
// Merge Agent Studio detail view with Runner
function AgentRunnerView({ agentId }: { agentId: string }) {
  const { runs, activeRun, executionState } = useAgentStore();
  
  return (
    <div>
      {/* Left: Agent Config (from Agent Studio) */}
      <AgentConfigPanel agentId={agentId} />
      
      {/* Center: Execution Monitor (Runner) */}
      <ExecutionMonitor runId={activeRun?.id}>
        {/* DAG Visualization */}
        <DagVisualization dagId={activeRun?.dagId} />
        
        {/* Live Task List */}
        <TaskList wihs={activeRun?.wihs} />
        
        {/* Event Log */}
        <EventLog events={executionState.events} />
      </ExecutionMonitor>
      
      {/* Right: Agent Communication */}
      <AgentCommunicationPanel agentId={agentId} />
    </div>
  );
}
```

---

## Phase 4: Agent Communication (Week 4-5)

### 4.1 Rails Mail Integration
**Current:** Not exposed in UI  
**Required:** Full messaging system

#### UI Components
```typescript
// New: AgentCommunication component
function AgentCommunication({ agentId }: { agentId: string }) {
  const [threads, setThreads] = useState<MailThread[]>([]);
  const [activeThread, setActiveThread] = useState<string>();
  
  useEffect(() => {
    // Fetch threads for this agent
    railsApi.mail.inbox({}).then(({ messages }) => {
      setThreads(groupByThread(messages));
    });
  }, [agentId]);
  
  return (
    <div className="communication-panel">
      <ThreadList threads={threads} onSelect={setActiveThread} />
      <MessageThread threadId={activeThread} />
      <MessageComposer onSend={handleSendMessage} />
    </div>
  );
}
```

#### Features
1. **Thread List** - Shows all conversations
2. **Message View** - Shows messages in thread
3. **Compose** - Send new message
4. **Reviews** - Handle review requests
5. **Attachments** - Share files/context

### 4.2 Review/Approval Workflow
**Required:** Gate integration for human-in-the-loop

```typescript
// When agent needs approval
async function requestReview(wihId: string, diff: string) {
  // Create review thread
  const { thread_id } = await railsApi.mail.ensureThread({
    topic: `Review: ${wihId}`
  });
  
  // Send review request
  await railsApi.mail.requestReview({
    thread_id,
    wih_id: wihId,
    diff_ref: diff
  });
  
  // Pause execution until decision
  await waitForDecision(thread_id);
}

// Human reviews
async function submitDecision(threadId: string, approve: boolean) {
  await railsApi.mail.decide({
    thread_id: threadId,
    approve,
    notes_ref: 'Review notes...'
  });
}
```

---

## Phase 5: Advanced Features (Week 5-6)

### 5.1 Agent Swarm Support
**Required:** Multiple agents working together

```typescript
interface SwarmConfig {
  coordinatorId: string;      // Orchestrator agent
  workerIds: string[];        // Worker agents
  strategy: 'round-robin' | 'load-balanced' | 'priority';
  consensusRequired: boolean;
}

// Create swarm
async function createSwarm(config: SwarmConfig) {
  // Create coordination DAG
  const plan = await railsApi.plan.new({
    text: `Coordinate ${config.workerIds.length} agents for task execution`
  });
  
  // Assign WIHs to different agents
  for (const workerId of config.workerIds) {
    await railsApi.wihs.pickup({
      dag_id: plan.dag_id,
      node_id: getNextNodeId(),
      agent_id: workerId
    });
  }
}
```

### 5.2 Resource Leases UI
**Required:** Visual file/resource locking

```typescript
// Show active leases in agent detail
function ResourceLeases({ agentId }: { agentId: string }) {
  const [leases, setLeases] = useState<Lease[]>();
  
  useEffect(() => {
    railsApi.leases.list({ agent_id: agentId }).then(setLeases);
  }, [agentId]);
  
  return (
    <div className="leases-panel">
      {leases?.map(lease => (
        <LeaseCard key={lease.id} lease={lease} />
      ))}
    </div>
  );
}
```

### 5.3 Vault/Checkpoint Management
**Required:** Browse and restore checkpoints

```typescript
function CheckpointManager({ agentId }: { agentId: string }) {
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>();
  
  const handleRestore = async (checkpointId: string) => {
    // Create new run from checkpoint
    const run = await agentService.restoreCheckpoint(agentId, checkpointId);
    // Navigate to new run
    selectRun(run.id);
  };
  
  return (
    <CheckpointList checkpoints={checkpoints} onRestore={handleRestore} />
  );
}
```

---

## Implementation Priority

### Must Have (MVP)
1. ✅ Phase 1.1 - Voice settings in agent creation
2. ✅ Phase 1.2 - Agent type differentiation
3. ✅ Phase 2.1 - Working run execution
4. ✅ Phase 4.1 - Basic agent communication

### Should Have
5. Phase 3.1 - Prompt pack browser
6. Phase 3.2 - Agent Runner unification
7. Phase 4.2 - Review workflow

### Nice to Have
8. Phase 5.1 - Swarm support
9. Phase 5.2 - Resource leases UI
10. Phase 5.3 - Advanced checkpointing

---

## File Structure Changes

### New Files
```
5-ui/allternit-platform/src/
├── lib/agents/
│   ├── voice.service.ts          # Voice service integration
│   ├── prompt-pack.service.ts    # Prompt pack API client
│   └── swarm.service.ts          # Swarm orchestration
├── components/agent-studio/
│   ├── VoiceSelector.tsx         # Voice selection UI
│   ├── AgentTypeSelector.tsx     # Agent type dropdown
│   ├── PromptBrowser.tsx         # Prompt pack browser
│   ├── DagVisualization.tsx      # Visual DAG display
│   ├── AgentCommunication.tsx    # Mail/communication UI
│   └── ExecutionMonitor.tsx      # Live execution view
└── views/
    └── AgentRunnerView.tsx       # Unified runner (replaces RunnerView)

6-apps/api/src/
├── agents.rs                      # Add voice, type endpoints
├── agent_execution.rs             # NEW: Execution pipeline
├── prompt_pack.rs                 # NEW: Prompt pack proxy
└── voice.rs                       # NEW: Voice service proxy

services/ (or allternit-agent-system-rails/)
└── prompt-pack/                   # NEW: Prompt pack service
    ├── src/
    │   ├── main.rs
    │   └── prompts/
    │       ├── index.json         # Prompt catalog
    │       └── *.md               # Individual prompts
    └── Cargo.toml
```

---

## Dependencies

### Backend
- Rails service: ✅ Already exists
- Kernel service: ✅ Already exists
- Voice service: ✅ Already exists (port 8001)
- Prompt pack: ❌ Needs to be built

### Frontend
- Voice components: ✅ Already imported
- DAG visualization: ❌ Need react-flow or similar
- Real-time streaming: ⚠️ EventSource exists, needs wiring

---

## Success Criteria

1. **Agent Creation**
   - [ ] Can select voice during creation
   - [ ] Can choose agent type
   - [ ] Can set parent agent for sub-agents
   - [ ] Can select from prompt pack

2. **Execution**
   - [ ] Run button creates actual Rails DAG
   - [ ] WIHs are created and assigned
   - [ ] Kernel executes with agent config
   - [ ] Events stream to UI in real-time
   - [ ] Can pause/resume/cancel runs

3. **Communication**
   - [ ] Agents can send messages
   - [ ] Threads are visible in UI
   - [ ] Review requests work
   - [ ] Human can approve/reject

4. **Monitoring**
   - [ ] DAG visualization shows progress
   - [ ] Task list updates live
   - [ ] Checkpoints can be created/restored
   - [ ] Event log shows full history

---

## Estimated Timeline

| Phase | Duration | Key Deliverables |
|-------|----------|------------------|
| 1.1 - Voice | 2 days | Voice selector, API endpoints |
| 1.2 - Agent Types | 2 days | Type selector, hierarchy |
| 2.1 - Run Execution | 5 days | Working pipeline, event streaming |
| 2.2 - Event Streaming | 3 days | Live updates, DAG viz |
| 3.1 - Prompt Pack | 4 days | Service, browser, integration |
| 3.2 - Runner Unification | 3 days | Combined view |
| 4.1 - Communication | 4 days | Mail UI, messaging |
| 4.2 - Reviews | 3 days | Approval workflow |
| 5.x - Advanced | 5 days | Swarm, leases, checkpoints |

**Total: ~4-5 weeks for full implementation**

**MVP (Phases 1-2): ~2 weeks**

---

## Next Steps

1. **Approve this plan**
2. **Choose MVP scope** (Phases 1-2 only?)
3. **Start with Phase 1.1** (Voice settings)
4. **Weekly check-ins** on progress

Ready to begin Phase 1?
