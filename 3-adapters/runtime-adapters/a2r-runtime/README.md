# @a2r/runtime

A2R Runtime Bridge. Provides adapters, wrappers, and hooks for connecting A2R governance to the runtime.

## Installation

```bash
pnpm add @a2r/runtime
```

## Quick Start

```typescript
import { A2RKernelImpl } from '@a2r/governor';
import { RuntimeBridge, wrapGatewayClient } from '@a2r/runtime';

// Initialize kernel
const kernel = new A2RKernelImpl(storage);

// Create runtime bridge
const bridge = new RuntimeBridge({ 
  kernel,
  enforceWih: true,
});

// Wrap your GatewayClient implementation
const A2RGatewayClient = wrapGatewayClient(MyGatewayClient, kernel);

// Create governed session
const client = new A2RGatewayClient({
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
import { prepareSessionInit, getSessionContext } from '@a2r/runtime';

// Initialize session with WIH validation
const result = await prepareSessionInit({
  a2rKernel: kernel,
  wihId: 'P3-T0300',
  workspaceRoot: '/project',
  enforceWih: true,
});

// Access session context
const context = getSessionContext(result.sessionId);
```

### Tool Execution

```typescript
import { wrapToolExecution } from '@a2r/runtime';

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
import { createWrappedFileOperations } from '@a2r/runtime';

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
import { PluginAdapter } from '@a2r/runtime';

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
  kernel: A2RKernel;
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

| Runtime Component | Integration File | A2R Adapter |
|-------------------|------------------|-------------|
| GatewayClient | `src/gateway/client.ts:94-99` | Session Adapter |
| Tool Policy | `src/agents/tool-policy.ts` | Tool Wrapper |
| File Safe | `src/infra/fs-safe.ts:38-100` | File Wrapper |
| Plugin Loader | `src/plugins/tools.ts:43-129` | Plugin Adapter |

## License

MIT
