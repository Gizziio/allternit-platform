# Agent Studio - Production Implementation

## Overview

A comprehensive agent management system for the allternit platform, supporting single agents, subagents, multi-agent swarms, and workflow orchestration.

## Features

### Core Agent Features
- ✅ **Agent CRUD** - Create, read, update, delete agents
- ✅ **Agent Execution** - Start, pause, resume, cancel runs
- ✅ **Task Management** - Track tasks with status and results
- ✅ **Checkpoints** - Save and restore execution state
- ✅ **Versioning** - Git-like commits for agent state
- ✅ **Queue System** - Priority-based task queue
- ✅ **Real-time Updates** - Event streaming for live status

### Advanced Features (New)

#### Subagents
Agents that can spawn other specialized agents:
- Trigger conditions (tool-call, step-count, state-change, manual)
- Input/output mapping between parent and child
- Parallel or sequential execution
- Timeout and retry configuration

```typescript
const subagentConfig: SubagentConfig = {
  id: 'code-reviewer-sub',
  name: 'Code Reviewer',
  parentAgentId: 'parent-agent',
  triggerConditions: [{ type: 'tool-call', toolName: 'generateCode' }],
  parallel: false,
  timeout: 60000,
  maxRetries: 3,
};
```

#### Multi-Agent Swarms
Multiple agents working collaboratively:
- **Strategies**: Round-robin, hierarchical, democratic, competitive, collaborative, specialist, adaptive
- **Roles**: Leader, worker, critic, planner, specialist, observer
- **Communication**: Broadcast, direct, mailbox, shared-memory
- **Consensus**: Voting-based decision making

```typescript
const swarm: AgentSwarm = {
  id: 'dev-team',
  name: 'Development Team',
  strategy: 'hierarchical',
  agents: [
    { agentId: 'lead-dev', role: 'leader', weight: 1.0, canInitiate: true },
    { agentId: 'code-reviewer', role: 'critic', weight: 0.8 },
    { agentId: 'tester', role: 'worker', weight: 0.6 },
  ],
  consensusThreshold: 0.7,
};
```

#### Workflow DAGs
Directed Acyclic Graph execution patterns:
- **Step Types**: Agent, tool, subworkflow, decision, parallel, wait
- **Branching**: Conditional execution paths
- **Parallel Execution**: Concurrent step processing
- **Variables**: Shared state across steps
- **Retries**: Per-step retry configuration

```typescript
const workflow: AgentWorkflow = {
  id: 'deploy-pipeline',
  name: 'Deploy Pipeline',
  steps: [
    { id: 'test', name: 'Run Tests', agentId: 'tester', type: 'agent', dependencies: [] },
    { id: 'build', name: 'Build', agentId: 'builder', type: 'agent', dependencies: ['test'] },
    { id: 'deploy', name: 'Deploy', agentId: 'deployer', type: 'agent', dependencies: ['build'] },
  ],
};
```

#### Loop Control
Configurable iteration control:
- Max iterations
- Step delay
- Abort conditions (time, cost, condition, state)
- Error handling strategy
- Termination conditions

```typescript
const loopControl: LoopControlConfig = {
  maxIterations: 20,
  stepDelay: 1000,
  abortConditions: [
    { type: 'time-limit', timeLimit: 300000 },
    { type: 'cost-limit', costLimit: 500 },
  ],
  terminationStrategy: 'condition-met',
};
```

#### Call Options
Per-request configuration:
- Temperature, maxTokens, topP, topK
- Frequency/presence penalties
- Stop sequences
- Tool choice (auto, required, none, specific)
- Response format (text, JSON, structured)
- Streaming options

```typescript
const callOptions: AgentCallOptions = {
  temperature: 0.2,
  maxTokens: 4096,
  toolChoice: 'auto',
  responseFormat: { type: 'json', schema: mySchema },
  streaming: { enabled: true, emitToolCalls: true },
};
```

#### Tool Configuration
Fine-grained tool control:
- Enable/disable per tool
- Custom timeouts
- Retry policies
- Cost tracking
- Rate limiting
- Confirmation requirements
- Output transformation

```typescript
const toolConfig: AgentToolConfig = {
  toolId: 'webSearch',
  name: 'Web Search',
  enabled: true,
  timeout: 30000,
  retry: { maxAttempts: 3, delay: 1000 },
  costPerCall: 5,
  requireConfirmation: false,
};
```

#### Memory & Context
Configurable memory systems:
- Providers: Local, Redis, Vector DB, Kernel
- Context window management
- Summarization thresholds
- Persistent vs working memory
- Compression strategies
- History windows

#### Cost Control
Budget management:
- Per-run cost limits
- Daily budget caps
- Alert thresholds
- Cost tracking by model/tool
- Hard stop on limit

#### Safety & Guardrails
Security configuration:
- Input validation rules
- Output filtering
- Blocked patterns
- Allowed domains
- Approval workflows
- Content moderation
- Sandbox levels

#### Observability
Debugging and monitoring:
- Log levels (debug, info, warn, error)
- Execution tracing
- Metrics collection
- Reasoning visibility
- Tool call logging
- Artifact storage
- Real-time events

#### Agent Templates
Pre-configured agent setups:
- Software Engineer
- Research Analyst
- Code Reviewer
- Multi-Agent Orchestrator
- Custom templates

```typescript
// Apply a template
const agent = await applyTemplate('software-engineer', {
  name: 'My Developer Agent',
  model: 'claude-3-5-sonnet',
});
```

#### Agent Relationships
Define agent hierarchies:
- Parent/child relationships
- Peer connections
- Dependencies
- Delegation chains

## Architecture

### File Structure

```
src/lib/agents/
├── agent.types.ts           # Base agent types
├── agent.service.ts         # API service layer
├── agent.store.ts           # Zustand store (basic)
├── agent-advanced.types.ts  # Advanced features types
├── agent-advanced.store.ts  # Advanced features store
├── index.ts                 # Exports
└── README.md                # This file
```

### Data Flow

```
AgentView (UI)
    ↓
AgentStore / AdvancedAgentStore (State)
    ↓
AgentService (API Client)
    ↓
Gateway (Port 8013)
    ↓
Backend Services
```

### Stores

#### `useAgentStore`
Basic agent management:
- `agents` - List of agents
- `selectedAgentId` - Currently selected agent
- `runs` - Execution runs by agent
- `tasks` - Tasks by agent
- `checkpoints` - Checkpoints by agent
- `commits` - Commits by agent
- CRUD operations
- Execution control

#### `useAdvancedAgentStore`
Advanced features:
- `subagents` - Subagent configurations
- `swarms` - Swarm definitions
- `workflows` - Workflow DAGs
- `templates` - Agent templates
- `advancedConfigs` - Advanced settings
- Swarm orchestration
- Workflow execution

## Usage Examples

### Create a Basic Agent

```typescript
import { useAgentStore, AGENT_CAPABILITIES, AGENT_MODELS } from '@/lib/agents';

const { createAgent } = useAgentStore();

const agent = await createAgent({
  name: 'My Assistant',
  description: 'A helpful AI assistant',
  model: 'gpt-4o',
  provider: 'openai',
  capabilities: ['web-search', 'file-operations'],
  systemPrompt: 'You are a helpful assistant.',
  maxIterations: 10,
  temperature: 0.7,
});
```

### Start an Agent Run

```typescript
const { startRun, selectAgent } = useAgentStore();

await selectAgent(agentId);
const run = await startRun(agentId, 'Analyze this codebase and suggest improvements');
```

### Create a Swarm

```typescript
import { useAdvancedAgentStore } from '@/lib/agents';

const { createSwarm, startSwarmRun } = useAdvancedAgentStore();

const swarm = await createSwarm({
  name: 'Dev Team',
  description: 'Software development team',
  strategy: 'hierarchical',
  agents: [
    { agentId: 'lead', role: 'leader', weight: 1, priority: 1, canInitiate: true, canTerminate: true },
    { agentId: 'reviewer', role: 'critic', weight: 0.8, priority: 2, canInitiate: false },
  ],
  communication: { pattern: 'broadcast', synchronous: false },
  consensusThreshold: 0.7,
  maxRounds: 10,
});

const runId = await startSwarmRun(swarm.id, 'Design a new API endpoint');
```

### Create a Workflow

```typescript
const { createWorkflow, executeWorkflow } = useAdvancedAgentStore();

await createWorkflow(agentId, {
  name: 'Data Pipeline',
  description: 'Extract, transform, load workflow',
  steps: [
    { id: 'extract', name: 'Extract', agentId: 'extractor', type: 'agent', dependencies: [], retry: { maxAttempts: 3, delay: 1000 }, timeout: 60000 },
    { id: 'transform', name: 'Transform', agentId: 'transformer', type: 'agent', dependencies: ['extract'], retry: { maxAttempts: 3, delay: 1000 }, timeout: 120000 },
    { id: 'load', name: 'Load', agentId: 'loader', type: 'agent', dependencies: ['transform'], retry: { maxAttempts: 3, delay: 1000 }, timeout: 60000 },
  ],
  entryPoints: ['extract'],
  errorHandling: { defaultRetries: 3, onFailure: 'stop' },
});
```

### Use Templates

```typescript
const { templates, applyTemplate } = useAdvancedAgentStore();

// List available templates
console.log(templates); // Software Engineer, Research Analyst, etc.

// Apply a template
const agent = await applyTemplate('software-engineer', {
  name: 'My Custom Developer',
  temperature: 0.5,
});
```

### Configure Advanced Options

```typescript
const { updateLoopControl, updateCallOptions, updateMemoryConfig } = useAdvancedAgentStore();

// Loop control
await updateLoopControl(agentId, {
  maxIterations: 50,
  stepDelay: 500,
  abortConditions: [{ type: 'time-limit', timeLimit: 600000 }],
});

// Call options
await updateCallOptions(agentId, {
  temperature: 0.2,
  maxTokens: 8192,
  toolChoice: 'auto',
});

// Memory config
await updateMemoryConfig(agentId, {
  provider: 'vector-db',
  maxContextTokens: 200000,
  persistentMemory: true,
});
```

## API Endpoints

The following endpoints need to be implemented on the backend:

### Agents
- `GET /api/v1/agents` - List agents
- `POST /api/v1/agents` - Create agent
- `GET /api/v1/agents/:id` - Get agent
- `PATCH /api/v1/agents/:id` - Update agent
- `DELETE /api/v1/agents/:id` - Delete agent
- `GET /api/v1/agents/:id/config` - Get advanced config
- `PATCH /api/v1/agents/:id/config` - Update advanced config

### Runs
- `POST /api/v1/agents/:id/runs` - Start run
- `GET /api/v1/agents/:id/runs` - List runs
- `POST /api/v1/agents/:id/runs/:runId/cancel` - Cancel run
- `POST /api/v1/agents/:id/runs/:runId/pause` - Pause run
- `POST /api/v1/agents/:id/runs/:runId/resume` - Resume run

### Subagents
- `GET /api/v1/agents/:id/subagents` - List subagents
- `POST /api/v1/agents/:id/subagents` - Create subagent
- `PATCH /api/v1/agents/:id/subagents/:subId` - Update subagent
- `DELETE /api/v1/agents/:id/subagents/:subId` - Delete subagent
- `POST /api/v1/agents/:id/subagents/:subId/spawn` - Spawn subagent

### Swarms
- `GET /api/v1/swarms` - List swarms
- `POST /api/v1/swarms` - Create swarm
- `PATCH /api/v1/swarms/:id` - Update swarm
- `DELETE /api/v1/swarms/:id` - Delete swarm
- `POST /api/v1/swarms/:id/agents` - Join swarm
- `DELETE /api/v1/swarms/:id/agents/:agentId` - Leave swarm
- `POST /api/v1/swarms/:id/runs` - Start swarm run
- `GET /api/v1/swarms/runs/:runId/messages` - Get messages
- `POST /api/v1/swarms/runs/:runId/messages` - Send message

### Workflows
- `GET /api/v1/agents/:id/workflows` - List workflows
- `POST /api/v1/agents/:id/workflows` - Create workflow
- `PATCH /api/v1/agents/:id/workflows/:wfId` - Update workflow
- `DELETE /api/v1/agents/:id/workflows/:wfId` - Delete workflow
- `POST /api/v1/agents/:id/workflows/:wfId/execute` - Execute workflow
- `POST /api/v1/workflows/runs/:runId/pause` - Pause workflow
- `POST /api/v1/workflows/runs/:runId/resume` - Resume workflow

### Templates
- `POST /api/v1/agent-templates` - Create template
- `DELETE /api/v1/agent-templates/:id` - Delete template
- `POST /api/v1/agents/from-template` - Create agent from template

## Event Streaming

Real-time updates via Server-Sent Events:

```
GET /api/v1/sessions/:id/events
```

Event types:
- `agent.status.changed`
- `run.started`, `run.completed`, `run.failed`
- `task.created`, `task.updated`, `task.completed`
- `checkpoint.created`
- `commit.created`
- `swarm.message`
- `swarm.status`
- `workflow.step.*`

## UI Integration

The Agent Studio is accessible via the "Agent Studio" and "Studio" navigation items in the Shell rail. Both route to the `AgentView` component.

### View Modes
- **List View** - Grid of all agents
- **Detail View** - Agent configuration and runs
- **Create View** - New agent form
- **Edit View** - Edit agent form

### Tabs in Detail View
- **Runs** - Execution history
- **Tasks** - Task monitoring
- **Checkpoints** - State snapshots
- **Commits** - Version history
- **Queue** - Pending tasks

## Roadmap

### Implemented
- ✅ Basic agent CRUD
- ✅ Agent execution (run, pause, resume, cancel)
- ✅ Task management
- ✅ Checkpoints and versioning
- ✅ Real-time event streaming
- ✅ Subagent configuration types
- ✅ Swarm orchestration types
- ✅ Workflow DAG types
- ✅ Advanced configuration types
- ✅ Agent templates

### Planned
- 🔄 Visual workflow editor
- 🔄 Swarm visualization
- 🔄 Agent marketplace
- 🔄 Import/export agents
- 🔄 Agent versioning
- 🔄 A/B testing for agents
- 🔄 Agent performance analytics
- 🔄 Collaborative agent editing

## Contributing

When adding new features:
1. Define types in `agent-advanced.types.ts`
2. Add store methods in `agent-advanced.store.ts`
3. Update UI in `AgentView.tsx`
4. Add API endpoints to backend
5. Update this README

## References

- [AI SDK Agents Documentation](https://ai-sdk.dev/docs/agents)
- [Building Agents Guide](https://ai-sdk.dev/docs/agents/building-agents)
- [Workflow Patterns](https://ai-sdk.dev/docs/agents/workflow-patterns)
- [Loop Control](https://ai-sdk.dev/docs/agents/loop-control)
- [Configuring Call Options](https://ai-sdk.dev/docs/agents/configuring-call-options)
