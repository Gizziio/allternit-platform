# GIZZI Core

Gizzi primitives integrated into Claude Code.

## Modules

### Brand (`brand/`)
Central brand constants and user-facing copy.

```typescript
import { GIZZIBrand, GIZZICopy } from "@gizzi"

console.log(GIZZIBrand.product) // "GIZZI Code"
console.log(GIZZICopy.header.productName) // "GIZZI Code"
```

### Bus (`bus/`)
Event bus for decoupled communication.

```typescript
import { Bus, WorkspaceInitialized } from "@gizzi"

// Subscribe to events
const unsub = Bus.subscribe(WorkspaceInitialized, (event) => {
  console.log("Workspace:", event.properties.path)
})

// Publish events
await Bus.publish(WorkspaceInitialized, { path: "./.gizzi", name: "local" })

// Wildcard subscription
Bus.subscribeAll((event) => console.log("Event:", event.type))
```

### Workspace (`workspace/`)
`.gizzi/` directory management.

```typescript
import { Workspace } from "@gizzi"

// Initialize workspace
await Workspace.init("./.gizzi", { 
  name: "Gizzi", 
  emoji: "⚡",
  vibe: "Sharp, resourceful, autonomous."
})

// Read workspace files
const identity = await Workspace.readFile("./.gizzi", "IDENTITY.md")
```

### Continuity (`continuity/`)
Session handoff and context transfer types.

```typescript
import type { SessionContext, HandoffBaton, DAGTask } from "@gizzi"

const context: SessionContext = {
  session_id: "abc123",
  source_tool: "gizzi",
  workspace_path: "./",
  time_start: Date.now(),
  objective: "Implement feature X",
  progress_summary: ["Created types", "Implemented core logic"],
  open_todos: [],
  dag_tasks: [],
  decisions: [],
  blockers: [],
  files_changed: [],
  commands_executed: { build: [], test: [], lint: [], git: [], other: [] },
  errors_seen: [],
  next_actions: []
}
```

### Verification (`verification/`)
Semi-formal verification system.

```typescript
import { Verification } from "@gizzi"

// Run verification
const result = await Verification.empirical("./src")

if (result.passed) {
  console.log("All checks passed!")
} else {
  console.log("Issues:", result.issues)
}
```

### UI Components (`ui/`)
Ink-based UI components.

```tsx
import { ShimmeringBanner } from "@gizzi"

function App() {
  return <ShimmeringBanner onComplete={() => console.log("Ready!")} />
}
```

## File Structure

```
gizzi/
├── brand/
│   ├── meta.ts          # Brand constants
│   ├── copy.ts          # User-facing strings
│   └── index.ts         # Export
├── bus/
│   ├── types.ts         # Event type definitions
│   ├── index.ts         # Bus implementation
│   ├── events.ts        # Pre-defined events
│   └── index.ts         # Export
├── continuity/
│   └── types.ts         # Session/context types
├── ui/components/
│   └── ShimmeringBanner.tsx
├── verification/
│   ├── types.ts         # Verification types
│   ├── index.ts         # Verification system
│   └── index.ts         # Export
├── workspace/
│   ├── types.ts         # Workspace types
│   ├── index.ts         # Workspace implementation
│   └── index.ts         # Export
├── index.ts             # Main export
└── README.md            # This file
```

## Integration

All Gizzi modules are exported from `@gizzi` (path alias):

```typescript
// Import everything
import { 
  GIZZIBrand, 
  GIZZICopy, 
  Bus, 
  Workspace, 
  Verification,
  ShimmeringBanner 
} from "@gizzi"
```
