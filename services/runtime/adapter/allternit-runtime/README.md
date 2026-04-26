# @allternit/runtime

Allternit Runtime Bridge. Provides adapters, wrappers, and hooks for connecting Allternit governance to the runtime.

## Installation

```bash
pnpm add @allternit/runtime
```

## Quick Start

```typescript
import { AllternitKernelImpl } from '@allternit/governor';
import { RuntimeBridge, wrapGatewayClient } from '@allternit/runtime';

// Initialize kernel
const kernel = new AllternitKernelImpl(storage);

// Create runtime bridge
const bridge = new RuntimeBridge({ 
  kernel,
  enforceWih: true,
});

// Wrap your GatewayClient implementation
const AllternitGatewayClient = wrapGatewayClient(MyGatewayClient, kernel);

// Create governed session
const client = new AllternitGatewayClient({
  wihId: 'P3-T0300',
  workspaceRoot: '/my/project',
  url: 'ws://127.0.0.1:18789',
});
```

## Architecture

### Adapters

- **Session Adapter** (`src/adapters/session-adapter.ts`): Injects WIH governance at session initialization
- **Plugin Adapter** (`src/adapters/plugin-adapter.ts`): Governs plugin loading and tool registration

### Wrappers

- **Tool Wrapper** (`src/wrappers/tool-wrapper.ts`): Intercepts tool execution with routing
- **File Wrapper** (`src/wrappers/file-wrapper.ts`): Governs file operations

### Hooks

- **Hook Manager** (`src/hooks/index.ts`): Lifecycle hooks for session/tool/file events

## API

### Session Management

```typescript
import { prepareSessionInit, getSessionContext } from '@allternit/runtime';

// Initialize session with WIH validation
const result = await prepareSessionInit({
  allternitKernel: kernel,
  wihId: 'P3-T0300',
  workspaceRoot: '/project',
  enforceWih: true,
});

// Access session context
const context = getSessionContext(result.sessionId);
```

### Tool Execution

```typescript
import { wrapToolExecution } from '@allternit/runtime';

const result = await wrapToolExecution(
  {
    kernel,
    sessionId: 'sess-xxx',
    agentId: 'agent-1',
    workspaceRoot: '/project',
    wihId: 'P3-T0301',
    originalExecutor: runtimeExecutor,
  },
  'read_file',
  { path: '/project/file.txt' }
);

if (result.decision === 'allow') {
  console.log('Result:', result.result);
}
```

### File Operations

```typescript
import { createWrappedFileOperations } from '@allternit/runtime';

const fileOps = createWrappedFileOperations({
  kernel,
  sessionId: 'sess-xxx',
  agentId: 'agent-1',
  workspaceRoot: '/project',
  wihId: 'P3-T0302',
});

const { data } = await fileOps.read('/file.txt', 'utf-8');
```

### Plugin Management

```typescript
import { PluginAdapter } from '@allternit/runtime';

const adapter = new PluginAdapter({
  kernel,
  allowedPlugins: ['git', 'github'],
  requireWih: true,
});

await adapter.loadPlugin(myPlugin, { wihId: 'P3-T0303' });
const tools = adapter.getAllTools();
```

## Configuration

```typescript
interface RuntimeBridgeConfig {
  kernel: AllternitKernel;
  enforceWih?: boolean;           // Default: true
  defaultToolPolicy?: ToolPolicy;
  fileAccessMode?: 'standard' | 'read-only' | 'restricted';
  allowedWorkspaces?: string[];
  auditLogging?: {
    enabled: boolean;
    destination?: 'console' | 'file' | 'callback';
    filePath?: string;
    callback?: (log: AuditLogEntry) => void;
  };
}
```

## Integration Points

| Runtime Component | Integration File | Allternit Adapter |
|-------------------|------------------|-------------|
| GatewayClient | `src/gateway/client.ts:94-99` | Session Adapter |
| Tool Policy | `src/agents/tool-policy.ts` | Tool Wrapper |
| File Safe | `src/infra/fs-safe.ts:38-100` | File Wrapper |
| Plugin Loader | `src/plugins/tools.ts:43-129` | Plugin Adapter |

## License

MIT
