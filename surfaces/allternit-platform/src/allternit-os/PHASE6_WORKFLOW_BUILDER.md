# Phase 6: Workflow Builder Program - Allternit Rails Integration

## Overview

The Workflow Builder Program is a visual workflow editor that integrates with the **Allternit Agent System Rails** (Rust-based agent orchestration system). It provides a canvas for viewing and editing agent workflows while leveraging the Rails infrastructure for message passing, work management, and policy enforcement.

## Architecture

### Integration Points

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           allternit UI (Electron)                          │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                    WorkflowBuilderProgram                              │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │  │
│  │  │ DAG Canvas  │  │ Bus Messages│  │  Ledger     │  │  Terminal   │ │  │
│  │  │             │  │   Panel     │  │  Events     │  │  Spawner    │ │  │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘ │  │
│  │         └─────────────────┴─────────────────┴─────────────────┘      │  │
│  │                            │                                         │  │
│  │              ┌─────────────┴─────────────┐                          │  │
│  │              │     useAllternitRails Hook      │                          │  │
│  │              └─────────────┬─────────────┘                          │  │
│  └────────────────────────────┼─────────────────────────────────────────┘  │
└───────────────────────────────┼─────────────────────────────────────────────┘
                                │ HTTP API
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      Allternit Agent System Rails (Rust)                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │  Work/DAG   │  │  Bus/Queue  │  │   Ledger    │  │ Workspace Service   │ │
│  │  (.allternit/work)│  │(.allternit/bus)   │  │  (.allternit/     │  │   (:3021)           │ │
│  │             │  │             │  │   ledger)   │  │                     │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  Gate (Policy Enforcement) - 6 Gates: Plan → Checklist → Tool → ...    ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
```

## Key Components

### 1. AllternitRailsBridge (`kernel/AllternitRailsBridge.ts`)

The bridge connects the UI to the Rails workspace service.

**Features:**
- HTTP client for Rails workspace API (port 3021)
- Type-safe interfaces for DAG, WIH, BusMessage, LedgerEvent
- React hook `useAllternitRails()` for reactive state management
- Auto-polling with configurable intervals

**Usage:**
```typescript
const rails = useAllternitRails({
  workspaceId: 'my-workspace',
  autoPoll: true,
  pollInterval: 3000,
});

// Access DAGs
rails.dags: DagState[]

// Access Bus messages
rails.messages: BusMessage[]

// Send a message
await rails.sendMessage({
  to: 'agent-1',
  from: 'workflow-builder',
  kind: 'command',
  payload: { action: 'run-task' },
  transport: 'internal',
});
```

### 2. WorkflowBuilderProgram (`programs/WorkflowBuilderProgram.tsx`)

Visual workflow editor with three main tabs:

#### Canvas Tab
- Interactive DAG visualization with drag-and-drop nodes
- Edge rendering (blocked_by, related_to relationships)
- Node status indicators (NEW, READY, RUNNING, DONE, FAILED)
- Properties panel for selected nodes
- Terminal spawning for work execution

#### Messages Tab
- Real-time Bus message viewer
- Pending/delivered/failed message status
- Send new messages interface
- JSON payload editor

#### Logs Tab
- Ledger event stream viewer
- Chronological event display
- Actor/type/payload breakdown

### 3. Program Integration

Registered in `AllternitCanvas.tsx`:
```typescript
const PROGRAM_REGISTRY: Record<AllternitProgramType, ProgramComponent> = {
  // ... other programs
  'workflow-builder': WorkflowBuilderProgram,
  // ...
};
```

Launch function in `launchProtocol.ts`:
```typescript
launchWorkflowBuilder(title: string, workspaceId: string, sourceThreadId: string)
```

## Rails System Connection

### Workspace Service API

The bridge expects the Rails workspace service to expose:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/sessions` | POST | Create tmux session |
| `/sessions/:id` | GET | Get session info |
| `/sessions/:id/panes` | POST | Create pane in session |
| `/panes/:id` | DELETE | Kill pane |
| `/panes/:id/capture` | GET | Capture pane output |
| `/panes/:id/send` | POST | Send keys to pane |
| `/workspace/:id/dags` | GET | List DAGs |
| `/workspace/:id/bus/send` | POST | Send Bus message |
| `/workspace/:id/bus/poll` | GET | Poll pending messages |
| `/workspace/:id/ledger` | GET | Get ledger events |

### Data Flow

```
1. Rails Work Surface creates DAG (.allternit/work/dags/<dag_id>.json)
2. Workspace service reads DAG files
3. UI polls workspace service via HTTP
4. WorkflowBuilder displays DAG as visual nodes
5. User interacts with nodes (view, spawn terminal, etc.)
6. UI can send Bus messages to agents
```

## Usage Examples

### Launch from Agent

```typescript
import { wrapLaunchCommand } from '../utils/launchProtocol';

// Agent generates this command
const command = wrapLaunchCommand('workflow-builder', 'My Workflow', {
  workspaceId: 'project-alpha',
});
// <launch_utility type="workflow-builder" title="My Workflow">
// {"workspaceId":"project-alpha"}
// </launch_utility>
```

### Launch from UI

```typescript
import { launchWorkflowBuilder } from '../utils/launchProtocol';

const programId = launchWorkflowBuilder(
  'Project Workflow',
  'project-alpha',
  currentThreadId,
  { focus: true }
);
```

### React Hook Usage

```typescript
import { useLaunchProtocol } from '../utils/launchProtocol';

function MyComponent() {
  const { launchWorkflowBuilder } = useLaunchProtocol(threadId);
  
  const openWorkflow = () => {
    launchWorkflowBuilder('My Workflow', 'workspace-1');
  };
  
  return <button onClick={openWorkflow}>Open Workflow</button>;
}
```

## Integration with Existing Systems

### AgentCommunicationPanel
The Workflow Builder doesn't replace the AgentCommunicationPanel - it extends it:
- AgentCommunicationPanel: User ↔ Single Agent chat
- Workflow Builder: Visual DAG + Bus messaging + Multi-agent orchestration

### OrchestratorEngine
- OrchestratorEngine: Client-side MoA orchestration
- Workflow Builder: Visualizes Rails-managed DAGs (server-side)
- Both can coexist - OrchestratorEngine for quick tasks, Rails for durable workflows

### KernelProtocol
- Workflow Builder uses the same HTTP-based communication
- Can trigger kernel actions via Bus messages

## State Types

Added to `types/programs.ts`:
```typescript
export type AllternitProgramType = 
  | 'research-doc'
  | 'data-grid'
  | 'presentation'
  | 'code-preview'
  | 'asset-manager'
  | 'image-studio'
  | 'audio-studio'
  | 'telephony'
  | 'browser'
  | 'orchestrator'
  | 'workflow-builder'  // NEW
  | 'custom';
```

## Configuration

### Environment Variables

```bash
# Rails workspace service URL
ALLTERNIT_RAILS_URL=http://127.0.0.1:3021

# Polling interval (ms)
ALLTERNIT_POLL_INTERVAL=3000
```

### Workspace ID

The workspace ID connects the UI to a specific Rails workspace:
- Default: `'default'`
- Custom: Any string matching a Rails workspace directory

## Future Enhancements

1. **Bi-directional sync**: Allow editing DAGs in the UI and saving back to Rails
2. **Real-time updates**: WebSocket connection instead of polling
3. **Gate visualization**: Show policy enforcement points in the workflow
4. **WIH execution**: Direct execution control from the canvas
5. **Multi-DAG view**: Display multiple workflows simultaneously

## Files Added/Modified

### New Files
- `kernel/AllternitRailsBridge.ts` - Rails HTTP client and React hook
- `kernel/index.ts` - Kernel module exports
- `programs/WorkflowBuilderProgram.tsx` - Main workflow builder UI
- `PHASE6_WORKFLOW_BUILDER.md` - This documentation

### Modified Files
- `types/programs.ts` - Added 'workflow-builder' to AllternitProgramType
- `stores/useSidecarStore.ts` - Added icon for workflow-builder
- `components/AllternitCanvas.tsx` - Registered WorkflowBuilderProgram
- `utils/launchProtocol.ts` - Added launchWorkflowBuilder function

## Testing

### Manual Test

1. Start Rails workspace service on port 3021
2. Create a DAG in `.allternit/work/dags/`
3. Launch Workflow Builder from the UI
4. Verify DAG nodes appear on canvas
5. Send test Bus messages
6. Check Ledger events appear in Logs tab

### Expected Behavior

- ✅ Connection status shows "Connected to Allternit Rails"
- ✅ DAG nodes render with correct status colors
- ✅ Edges show dependency relationships
- ✅ Messages appear in real-time
- ✅ Terminal spawning works for nodes
- ✅ Properties panel shows node details

## References

- Allternit Rails System: `/Users/macbook/Desktop/allternit-workspace/allternit/0-substrate/allternit-agent-system-rails`
- Workspace Service: Port 3021
- Bus Queue: `.allternit/bus/queue.db` (SQLite)
- Work DAGs: `.allternit/work/dags/*.json`
- Ledger: `.allternit/ledger/events/*.jsonl`
