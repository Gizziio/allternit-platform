# Capsule SDK v0.1 Architecture

## Overview

The Capsule SDK is a **headless** SDK that defines contracts, lifecycle, capabilities, and guardrails for Allternit capsules. It explicitly **does not prescribe UI** - that remains the sovereign domain of A2UI/AG-UI.

## Design Principles (Non-Negotiable)

1. **SDK defines WHERE and WHEN UI happens, never WHAT it looks like**
2. **A2UI/AG-UI remains the source of visual truth**
3. **SDK only enforces**:
   - Lifecycle phases and transitions
   - Capability declarations
   - Event semantics
   - Containment (capsule vs stage)
   - UX minimums (states must exist, not how they look)

Think of the SDK as the OS kernel, and A2UI as the window compositor + renderer.

## Layer Separation

```
┌──────────────────────────────┐
│        AG-UI / A2UI           │  ← generates/patches UI dynamically
│  (schemas, diffs, renderers) │    - Decides layout, styling, controls
│                               │    - Animations, visual feedback
└────────────▲─────────────────┘    - Platform-specific rendering
             │
┌────────────┴─────────────────┐
│        Capsule SDK            │  ← lifecycle, contracts, guardrails
│  (state machine + events)    │    - Lifecycle phases
│                               │    - Capability registry
│  ┌─────────────────────────┐  │    - Event bus
│  │ • CapsuleController     │  │    - Stage controller
│  │ • StageController       │  │    - Renderer controller
│  │ • RendererController    │  │    - Action registry
│  │ • EventBus              │  │    - Runtime guards
│  │ • ActionRegistry        │  │
│  └─────────────────────────┘  │
└────────────▲─────────────────┘
             │
┌────────────┴─────────────────┐
│        Shell Runtime          │  ← windowing, stage, focus, routing
│  (capsule host, IPC, etc.)   │    - Hosts capsules
└──────────────────────────────┘    - Manages stage lifecycle
                                   - IPC between layers
```

## Package Structure

```
packages/capsule-sdk/
├── src/
│   ├── core/
│   │   ├── ids.ts           # SpaceId, CapsuleId, TabId, ActionId, EventId
│   │   ├── lifecycle.ts     # Phase types, lifecycle controller
│   │   ├── capabilities.ts  # Capability types and controller
│   │   ├── events.ts        # Event bus, event types
│   │   ├── actions.ts       # Action registry, action builder
│   │   └── presentation.ts  # Presentation, StagePreset
│   ├── controllers/
│   │   ├── CapsuleController.ts  # Per-capsule lifecycle/capabilities
│   │   ├── StageController.ts    # Per-space stage management
│   │   └── RendererController.ts # Per-tab renderer mode
│   ├── guards/
│   │   ├── invariants.ts    # Runtime invariant validation
│   │   └── actionGuard.ts   # Dead-button prevention
│   └── index.ts             # Public API exports
└── package.json
```

## Core Concepts

### Identifiers

All identifiers are opaque strings - the SDK never inspects their content:

```typescript
type SpaceId = string;      // Workspace identifier
type CapsuleId = string;    // Capsule instance identifier
type TabId = string;        // Tab within a capsule
type ActionId = string;     // Action identifier
type EventId = string;      // Event instance identifier
```

### Lifecycle

Universal phases all capsules must follow:

```typescript
type CapsulePhase =
  | 'init'         // Capsule is initializing
  | 'connecting'   // Connecting to service/resource
  | 'ready'        // Ready for interaction
  | 'busy'         // Processing operation
  | 'error'        // Error state - requires attention
  | 'suspended'    // Paused - can be resumed
  | 'disposed';    // Cleaned up - no longer functional
```

### Capabilities

Declared capabilities (not inferred):

```typescript
interface CapsuleCapabilities {
  staged?: boolean;           // Can enter stage
  streaming?: boolean;        // Emits frames, supports live input
  gpu?: boolean;              // Supports GPU renderer
  multiTab?: boolean;         // Supports multiple tabs
  agentControllable?: boolean; // Can be controlled by agents
}
```

### Events

Single canonical event format:

```typescript
interface A2Event<T = unknown> {
  id: EventId;                // Unique event ID
  ts: number;                 // Timestamp
  type: string;               // Event type
  spaceId?: SpaceId;          // Optional space context
  capsuleId?: CapsuleId;      // Optional capsule context
  tabId?: TabId;              // Optional tab context
  payload: T;                 // Event-specific payload
}
```

### Actions

Dead-button prevention:

```typescript
interface CapsuleAction {
  id: ActionId;               // Unique action ID
  label?: string;             // Optional display label
  icon?: string;              // Optional icon
  enabled: boolean;           // Is the action available?
  run: () => void | Promise<void>;  // Action handler
}
```

A2UI must render actions **only** from the registry. Unknown actions trigger a warning event.

## Controllers

### CapsuleController

Headless controller for a single capsule:

```typescript
interface CapsuleController {
  id: CapsuleId;
  spaceId: SpaceId;
  type: string;

  // Lifecycle
  getLifecycle(): CapsuleLifecycleState;
  setLifecycle(next: Partial<CapsuleLifecycleState>): void;

  // Capabilities
  getCapabilities(): CapsuleCapabilities;
  setCapabilities(next: CapsuleCapabilities): void;

  // Presentation
  getPresentation(): Presentation;
  setPresentation(p: Presentation): void;

  // Actions
  actions: ActionRegistry;

  // Events
  events: EventBus;
}
```

### StageController

Manages stage state for a space (anti-sprawl enforcement):

```typescript
interface StageController {
  get(): StageState;
  enter(args: { capsuleId: CapsuleId; tabId?: TabId; preset?: StagePreset }): void;
  exit(): void;
  setPreset(preset: StagePreset): void;
}

interface StageState {
  active: boolean;
  spaceId: SpaceId;
  capsuleId?: CapsuleId;
  tabId?: TabId;
  preset: StagePreset;  // 0.5, 0.7, or 1.0
}
```

**Invariant**: Exactly one stage per space.

### RendererController

Manages renderer mode per tab:

```typescript
interface RendererController {
  get(tabId: TabId): RendererState;
  set(tabId: TabId, mode: RendererMode, reason?: RendererReason): void;
  suggest(tabId: TabId, mode: RendererMode): void;
}

interface RendererState {
  mode: 'stream' | 'gpu';
  reason?: 'user' | 'suggested' | 'policy';
}
```

## Guards

### Invariants

Runtime validation of capsule state:

```typescript
function validateStageState(state: StageState): InvariantViolation[];
function validatePresentation(...): InvariantViolation[];
function validateLifecycle(...): InvariantViolation[];
```

### Action Guard

Dead-button prevention:

```typescript
function createActionGuard(
  capsuleId: CapsuleId,
  actionRegistry: ActionRegistry,
  emitEvent: (event: A2Event) => void
): ActionGuard;
```

If A2UI attempts to render an unregistered action, the guard emits a `capsule.action.missing` event.

## A2UI/AG-UI Bridge

The SDK **never imports A2UI**. Instead, UI code uses adapters:

```typescript
// UI layer only
interface CapsuleUIAdapter<Schema, Patch> {
  render: (snapshot: CapsuleSnapshot) => Schema;
  patchFromEvent: (evt: A2Event) => Patch | null;
}
```

### CapsuleSnapshot (SDK-provided)

```typescript
interface CapsuleSnapshot {
  capsule: {
    id: CapsuleId;
    spaceId: SpaceId;
    type: string;
    lifecycle: CapsuleLifecycleState;
    capabilities: CapsuleCapabilities;
    presentation: Presentation;
    actions: CapsuleAction[];
  };
  stage?: StageState;  // Stage for this space
  // Capsule-specific data (tabs, messages, etc.) lives outside SDK
}
```

## Why This Design?

### Problems with Traditional Component SDKs

1. **Prescribe UI** → Kills custom mini-app identity
2. **Framework coupling** → Fights agent-patched UI
3. **Inflexible** → Can't adapt to different form factors
4. **Bottleneck** → All UI changes require SDK updates

### How This Design Solves It

| Problem | Solution |
|---------|----------|
| UI diversity | A2UI controls all rendering |
| Agent control | Stable event/command contracts |
| Capsule identity | SDK-agnostic presentation |
| Extensibility | New capsules don't need SDK changes |

## Usage Example

```typescript
// In a capsule implementation (headless)
import { createCapsuleController, BROWSER_ACTIONS, createActionBuilder } from '@allternit/capsule-sdk';

const capsule = createCapsuleController({
  spaceId: 'workspace-1',
  type: 'browser',
  capabilities: {
    staged: true,
    streaming: true,
    gpu: true,
    multiTab: true,
    agentControllable: true,
  },
});

// Register actions
capsule.actions.register(capsule.id, createActionBuilder()
  .id(BROWSER_ACTIONS.NAV_BACK)
  .label('Back')
  .enabled(true)
  .run(() => navigateBack())
  .build());

// Emit lifecycle change
capsule.setLifecycle({ phase: 'ready' });

// In A2UI (UI layer) - subscribes to events and renders
eventBus.on('capsule.lifecycle.changed', (evt) => {
  updateHeaderFromLifecycle(evt.payload.phase);
});

const actions = capsuleController.actions.list(capsuleController.id);
renderToolbar(actions);  // Only registered actions
```

## Files Reference

| File | Purpose |
|------|---------|
| `packages/capsule-sdk/src/core/ids.ts` | Identifier types and generators |
| `packages/capsule-sdk/src/core/lifecycle.ts` | Lifecycle phases and controller |
| `packages/capsule-sdk/src/core/capabilities.ts` | Capability types and controller |
| `packages/capsule-sdk/src/core/events.ts` | Event bus and event types |
| `packages/capsule-sdk/src/core/actions.ts` | Action registry and builder |
| `packages/capsule-sdk/src/core/presentation.ts` | Presentation and stage presets |
| `packages/capsule-sdk/src/controllers/CapsuleController.ts` | Per-capsule controller |
| `packages/capsule-sdk/src/controllers/StageController.ts` | Per-space stage management |
| `packages/capsule-sdk/src/controllers/RendererController.ts` | Per-tab renderer controller |
| `packages/capsule-sdk/src/guards/invariants.ts` | Runtime invariant validation |
| `packages/capsule-sdk/src/guards/actionGuard.ts` | Dead-button prevention |

## Next Steps

1. **Wire Browser Capsule to SDK** - Replace direct state with CapsuleController
2. **Build A2UI Adapters** - Create BrowserAdapter, StageAdapter, RendererAdapter
3. **Migrate One Capsule** - Prove SDK isn't "browser-shaped"
4. **Expose to Agents** - AG-UI agents use event bus for control
