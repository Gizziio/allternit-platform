# A2R Agent Workspace - Shell UI Integration

This module provides the integration layer between the A2R Shell UI and the Agent Workspace.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  SHELL UI (6-ui/a2r-platform)                                       │
├─────────────────────────────────────────────────────────────────────┤
│  Agent Workspace Integration                                        │
│  ├── wasm-wrapper.ts       - WASM bindings (in-browser)             │
│  ├── http-client.ts        - HTTP API client                        │
│  ├── types.ts              - TypeScript definitions                 │
│  └── index.ts              - Main exports                           │
└─────────────────────────────────────────────────────────────────────┘
                              ↑↓ USES
┌─────────────────────────────────────────────────────────────────────┐
│  AGENT WORKSPACE (0-substrate/a2r-agent-workspace)                  │
├─────────────────────────────────────────────────────────────────────┤
│  ├── WASM Build (pkg/)     - For browser use                        │
│  └── HTTP API              - For server use                         │
└─────────────────────────────────────────────────────────────────────┘
```

## Installation

```bash
# The agent-workspace is part of a2r-platform
# No additional installation needed
```

## Usage

### Basic Usage

```typescript
import { createWorkspace, Backend } from './agent-workspace';

// Create workspace with WASM backend (preferred)
const api = await createWorkspace('/path/to/workspace', Backend.WASM);

// Or with HTTP backend
const api = createWorkspace('/path/to/workspace', Backend.HTTP, {
  baseUrl: 'http://localhost:8080/api/v1'
});

// Boot the workspace
await api.workspace.boot();

// Check policy
const result = await api.policy.checkTool('filesystem.write');
if (result.allowed) {
  console.log('Tool is allowed');
} else if (result.requires_approval) {
  console.log('Approval required:', result.reason);
}
```

### React Hook

```typescript
import { useWorkspace } from './agent-workspace/wasm-wrapper';

function WorkspaceComponent({ path }: { path: string }) {
  const { api, loading, error } = useWorkspace(path);
  
  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  
  return (
    <div>
      <h1>Workspace: {api.workspace.getVersion()}</h1>
      {/* ... */}
    </div>
  );
}
```

### Auto-Detect Backend

```typescript
import { createWorkspaceAuto } from './agent-workspace';

// Automatically choose WASM or HTTP based on environment
const api = await createWorkspaceAuto('/path/to/workspace');
```

## Backend Options

### WASM (WebAssembly)

**Pros:**
- Fastest execution (no network round-trips)
- Works offline
- Direct access to filesystem (via WASM-FS)

**Cons:**
- Requires WASM support in browser
- Larger bundle size (~500KB)
- Limited to browser capabilities

**When to use:** Desktop Shell UI, offline mode

### HTTP

**Pros:**
- Works in any environment
- Smaller bundle size
- Can use server-side resources

**Cons:**
- Requires network connection
- Higher latency
- Needs running CLI server

**When to use:** Web Shell UI, server-side rendering

## Building WASM

```bash
cd /Users/macbook/Desktop/a2rchitech-workspace/a2rchitech/0-substrate/a2r-agent-workspace

# Install wasm-pack
cargo install wasm-pack

# Build for web
wasm-pack build --target web --out-dir pkg

# Build for bundler (webpack, rollup, etc.)
wasm-pack build --target bundler --out-dir pkg
```

## API Reference

### Workspace

```typescript
interface IWorkspace {
  isValid(): boolean;
  getVersion(): string | null;
  getMetadata(): Promise<WorkspaceMetadata>;
  boot(): Promise<void>;
  getBootEvents(): BootEvent[];
}
```

### Policy Engine

```typescript
interface IPolicyEngine {
  checkTool(toolId: string): Promise<PolicyCheckResult>;
  checkFileOp(path: string, operation: FileOperation): Promise<PolicyCheckResult>;
}
```

### Skills Registry

```typescript
interface ISkillsRegistry {
  listSkills(): Promise<SkillDefinition[]>;
  getSkill(id: string): Promise<SkillDefinition | null>;
  findMatching(query: string): Promise<SkillDefinition[]>;
}
```

### Checkpoint Manager

```typescript
interface ICheckpointManager {
  create(sessionId: string): Promise<ICheckpoint>;
  getLatest(): Promise<ICheckpoint | null>;
  restore(checkpointId: string): Promise<void>;
  list(limit: number): Promise<ICheckpoint[]>;
}
```

## File Structure

```
agent-workspace/
├── README.md              # This file
├── index.ts               # Main exports and factory
├── types.ts               # TypeScript type definitions
├── wasm-wrapper.ts        # WASM bindings wrapper
└── http-client.ts         # HTTP API client
```

## Integration with Shell UI Components

### Visual Markdown Editor

```typescript
import { createWorkspace } from './agent-workspace';

async function loadPolicyMd(path: string) {
  const api = await createWorkspace(path);
  
  // Read POLICY.md
  const policy = await fetch(`/api/workspace/${path}/policy.md`)
    .then(r => r.text());
  
  // Edit and save
  const editor = new MarkdownEditor(policy);
  await editor.save((content) => {
    return fetch(`/api/workspace/${path}/policy.md`, {
      method: 'PUT',
      body: content,
    });
  });
}
```

### Workspace Browser

```typescript
import { createWorkspaceAuto } from './agent-workspace';

async function browseWorkspace(path: string) {
  const api = await createWorkspaceAuto(path);
  
  const metadata = await api.workspace.getMetadata();
  const skills = await api.skills.listSkills();
  
  return {
    metadata,
    skills,
    isValid: api.workspace.isValid(),
  };
}
```

### Policy Visualization

```typescript
import { createWorkspace } from './agent-workspace';

async function visualizePolicy(path: string) {
  const api = await createWorkspace(path, Backend.WASM);
  
  // Check multiple tools
  const tools = ['read', 'write', 'delete', 'network.http'];
  const results = await Promise.all(
    tools.map(tool => api.policy.checkTool(tool))
  );
  
  return tools.map((tool, i) => ({
    tool,
    ...results[i],
  }));
}
```

## Future Enhancements

1. **Web Workers** - Run WASM in background thread
2. **Streaming API** - Real-time updates from kernel
3. **Caching Layer** - Cache workspace state for faster access
4. **Offline Sync** - Queue changes when offline
5. **Multi-workspace** - Manage multiple workspaces simultaneously

## See Also

- `0-substrate/a2r-agent-workspace/` - Rust implementation
- `5-agents/AGENT_WORKSPACE_ARCHITECTURE.md` - Full architecture docs
- `7-apps/cli/` - CLI that also uses the workspace
