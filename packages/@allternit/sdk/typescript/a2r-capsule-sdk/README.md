# @allternit/capsule-sdk

Headless Capsule SDK for A2rchitech - lifecycle, contracts, and guardrails.

## Installation

```bash
pnpm add @allternit/capsule-sdk
```

## Quick Start

```typescript
import {
  createCapsuleController,
  createStageController,
  createRendererController,
  BROWSER_ACTIONS,
  createActionBuilder,
} from '@allternit/capsule-sdk';

// Create a capsule
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

// Update lifecycle
capsule.setLifecycle({ phase: 'ready' });

// Get current state
const state = capsule.getLifecycle();
console.log(state.phase); // 'ready'
```

## Key Concepts

### Lifecycle
All capsules follow universal lifecycle phases: `init` → `connecting` → `ready` → `busy` → `disposed`

### Capabilities
Declare what your capsule supports: `staged`, `streaming`, `gpu`, `multiTab`, `agentControllable`

### Events
All state changes emit events via the EventBus. A2UI/AG-UI subscribes to these and decides how to render.

### Actions
Register actions in the ActionRegistry. A2UI must only render registered actions - dead buttons are prevented.

## Architecture

See [CAPSULE_SDK_ARCHITECTURE.md](../../docs/CAPSULE_SDK_ARCHITECTURE.md) for detailed architecture documentation.

## License

MIT
