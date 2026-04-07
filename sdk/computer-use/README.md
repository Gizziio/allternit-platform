# @allternit/computer-use

TypeScript SDK for the A2R Computer Use Engine - a thin HTTP client over the canonical engine API.

## Installation

```bash
npm install @allternit/computer-use
```

For Node.js environments, you also need to install the `eventsource` package for SSE support:

```bash
npm install eventsource
```

## Quick Start

```typescript
import { A2RComputerUseClient } from '@allternit/computer-use';

const client = new A2RComputerUseClient({
  endpoint: 'http://localhost:8080',
  timeout: 60000,
});

// Execute a task using intent mode
const result = await client.executeIntent('Fill out the contact form', {
  target_scope: 'browser',
  timeout_ms: 30000,
});

console.log('Run completed:', result.run_id);
console.log('Summary:', result.summary);
```

## Usage

### Client Configuration

```typescript
const client = new A2RComputerUseClient({
  endpoint: 'http://localhost:8080',  // Required: Engine HTTP API endpoint
  timeout: 60000,                      // Optional: Request timeout (ms)
  apiKey: 'your-api-key',              // Optional: API key for authentication
  headers: {                           // Optional: Custom headers
    'X-Custom-Header': 'value',
  },
});
```

### Execution Modes

#### Intent Mode (Natural Language)

```typescript
const result = await client.executeIntent(
  'Fill out the contact form with name John Doe',
  {
    target_scope: 'browser',
    timeout_ms: 30000,
    max_steps: 50,
  }
);
```

#### Direct Mode (Explicit Actions)

```typescript
const result = await client.executeDirect(
  [
    {
      kind: 'click',
      target: { selector: '#contact-button' },
    },
    {
      kind: 'type',
      target: { selector: '#name' },
      input: { text: 'John Doe' },
    },
  ],
  {
    target_scope: 'browser',
  }
);
```

#### Assist Mode (Requires Approval)

```typescript
const result = await client.executeAssist(
  'Delete all temporary files',
  {
    target_scope: 'desktop',
  }
);

// Handle approval
if (result.status === 'needs_approval') {
  const approved = await confirm('Approve this action?');
  await client.approve(result.run_id, {
    decision: approved ? 'approve' : 'deny',
    comment: approved ? 'User confirmed' : 'User declined',
  });
}
```

### Event Streaming

Subscribe to real-time events during execution:

```typescript
import { EngineEvent } from '@allternit/computer-use';

const unsubscribe = client.subscribeToRun(
  result.run_id,
  (event: EngineEvent) => {
    console.log(`[${event.event_type}] ${event.message}`);
    
    if (event.event_type === 'action.completed') {
      console.log('Action completed:', event.data);
    }
  }
);

// Unsubscribe when done
unsubscribe();
```

### Wait for Completion

```typescript
// Wait for run to complete
const finalEvent = await client.waitForRun(result.run_id);
console.log('Run finished:', finalEvent.event_type);

// Get final result
const runStatus = await client.getRun(result.run_id);
console.log('Final status:', runStatus.status);
```

### Approval Handling

#### Interactive Approval

```typescript
import { ApprovalHandler, ApprovalPredicates } from '@allternit/computer-use';

const handler = new ApprovalHandler(client);

// Set up interactive approval
type PromptFn = (msg: string) => Promise<boolean>;
const prompt: PromptFn = (msg) => /* your UI prompt */ Promise.resolve(true);

handler.onApprovalRequest = async (request) => {
  return await prompt(`Approve: ${request.message}?`);
};

// Watch a run for approvals
handler.watchRun(result.run_id);
```

#### Auto-Approval with Predicates

```typescript
import { ApprovalHandler, ApprovalPredicates } from '@allternit/computer-use';

// Auto-approve read-only actions
const handler = ApprovalHandler.createAutoApprove(
  client,
  ApprovalPredicates.readOnly()
);

// Or combine predicates
const handler2 = ApprovalHandler.createAutoApprove(
  client,
  ApprovalPredicates.all(
    ApprovalPredicates.readOnly(),
    ApprovalPredicates.allowedAdapters(['safe-adapter'])
  )
);

// Watch the run
handler.watchRun(result.run_id);
```

#### Built-in Predicates

```typescript
import { ApprovalPredicates } from '@allternit/computer-use';

// Always approve (use with caution!)
ApprovalPredicates.always()

// Never approve
ApprovalPredicates.never()

// Match by pattern
ApprovalPredicates.matches(/click|scroll/)

// Safe action whitelist
ApprovalPredicates.safeActions(['navigate', 'scroll', 'screenshot'])

// Not dangerous
ApprovalPredicates.notDangerous(['delete', 'remove', 'drop'])

// Read-only only
ApprovalPredicates.readOnly()

// Allowed adapters only
ApprovalPredicates.allowedAdapters(['browser-adapter'])

// Combine predicates
ApprovalPredicates.all(
  ApprovalPredicates.readOnly(),
  ApprovalPredicates.safeActions(['navigate'])
)

ApprovalPredicates.any(
  ApprovalPredicates.matches(/screenshot/),
  ApprovalPredicates.readOnly()
)
```

### Session Management

```typescript
// Create a session
const session = await client.createSession();
console.log('Session:', session.session_id);

// Execute within session
const result = await client.executeIntent('Task 1', {
  session_id: session.session_id,
});

// Get session state
const state = await client.getSession(session.session_id);
console.log(`Session has ${state.run_count} runs`);

// List all sessions
const sessions = await client.listSessions();

// Close session
await client.closeSession(session.session_id, true); // cleanup=true
```

### Run Control

```typescript
// Get run status
const status = await client.getRun(runId);
console.log('Status:', status.status);

// Cancel a run
await client.cancelRun(runId, {
  actor_id: 'user-123',
  comment: 'User requested cancellation',
});

// Pause a run
await client.pauseRun(runId);

// Resume a run
await client.resumeRun(runId);

// List runs
const runs = await client.listRuns(sessionId, 'completed');
```

## API Reference

### `A2RComputerUseClient`

Main client class for interacting with the A2R Computer Use Engine.

#### Constructor

```typescript
new A2RComputerUseClient(config: ClientConfig)
```

#### Methods

| Method | Description |
|--------|-------------|
| `execute(request)` | Execute a canonical engine request (POST /v1/execute) |
| `executeDirect(actions, options)` | Execute in direct mode |
| `executeIntent(task, options)` | Execute in intent mode |
| `executeAssist(task, options)` | Execute in assist mode |
| `getRun(runId)` | Get run status (GET /v1/runs/{run_id}) |
| `listRuns(sessionId?, status?)` | List runs (GET /v1/runs) |
| `getRunEvents(runId, afterIndex?)` | Get event history (GET /v1/runs/{run_id}/events) |
| `cancelRun(runId, request?)` | Cancel a run (POST /v1/runs/{run_id}/cancel) |
| `pauseRun(runId, request?)` | Pause a run (POST /v1/runs/{run_id}/pause) |
| `resumeRun(runId, request?)` | Resume a run (POST /v1/runs/{run_id}/resume) |
| `approve(runId, approval)` | Submit approval (POST /v1/approve/{run_id}) |
| `createSession(request?)` | Create session (POST /v1/sessions) |
| `getSession(sessionId)` | Get session (GET /v1/sessions/{session_id}) |
| `closeSession(sessionId, cleanup?)` | Close session (DELETE /v1/sessions/{session_id}) |
| `listSessions()` | List sessions (GET /v1/sessions) |
| `subscribeToRun(runId, callback, options?)` | Subscribe to events via SSE |
| `waitForRun(runId)` | Promise that resolves when run completes |
| `waitForApproval(runId)` | Promise that resolves on approval request |

### `ApprovalHandler`

Helper class for managing approval requests.

```typescript
const handler = new ApprovalHandler(client);
handler.watchRun(runId, predicate);
handler.setGlobalPredicate(predicate);
handler.onApprovalRequest = (request) => boolean;
```

### `EventStream`

Low-level SSE event streaming.

```typescript
const stream = new EventStream(endpoint, apiKey);
stream.subscribe(runId, callback);
stream.waitForRun(runId);
stream.waitForApproval(runId);
```

## Types

All engine types are exported for TypeScript users:

```typescript
import {
  EngineMode,
  TargetScope,
  EngineLayer,
  ExecutionStatus,
  EngineExecutionRequest,
  EngineExecutionResult,
  EngineEvent,
  EngineAction,
  EngineArtifact,
  // ... and more
} from '@allternit/computer-use';
```

## Error Handling

```typescript
import { A2RComputerUseError } from '@allternit/computer-use';

try {
  const result = await client.executeIntent('Task');
} catch (error) {
  if (error instanceof A2RComputerUseError) {
    console.error('API Error:', error.status, error.code, error.message);
  } else {
    console.error('Unknown error:', error);
  }
}
```

## License

MIT
