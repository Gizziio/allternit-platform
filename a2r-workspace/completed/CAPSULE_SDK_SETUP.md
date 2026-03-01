# Capsule SDK - Workspace Setup Guide

## Step 1: Install TypeScript at Root

```bash
cd /Users/macbook/Desktop/a2rchitech-workspace/a2rchitech
pnpm add -D typescript
```

## Step 2: Create Workspace Configuration

Create `pnpm-workspace.yaml` at repo root:

```yaml
packages:
  - 'packages/*'
  - 'apps/*'
```

## Step 3: Add Workspace Dependency (in apps/shell/package.json)

```json
{
  "dependencies": {
    "@a2rchitech/capsule-sdk": "workspace:*"
  }
}
```

Then run:

```bash
cd apps/shell
pnpm install
```

## Step 4: Typecheck Commands

```bash
# Typecheck SDK package
cd /Users/macbook/Desktop/a2rchitech-workspace/a2rchitech
npx tsc --noEmit -p packages/capsule-sdk/tsconfig.json

# Or with pnpm exec
npx tsc --noEmit -p packages/capsule-sdk/tsconfig.json
```

## Step 5: Correct Import Pattern

```typescript
// CORRECT (uses workspace dep)
import { createCapsuleController } from '@a2rchitech/capsule-sdk';
```

## Step 2: Add Workspace Dependency (in apps/shell/package.json)

```json
{
  "dependencies": {
    "@a2rchitech/capsule-sdk": "workspace:*"
  }
}
```

## Step 3: Typecheck Commands

```bash
# Typecheck SDK package
pnpm --filter capsule-sdk typecheck

# Or from root with workspace exec
pnpm -w exec tsc --noEmit -p packages/capsule-sdk/tsconfig.json
```

## Step 4: Correct Import Pattern

```typescript
// WRONG (bypasses package boundary)
import { createCapsuleController } from '../../../../packages/capsule-sdk/src/index.js';

// CORRECT (uses workspace dep)
import { createCapsuleController } from '@a2rchitech/capsule-sdk';
```

## Step 5: EventBus API Pattern

```typescript
// CORRECT: on() returns unsubscribe function
const unsub = events.on('capsule.lifecycle.changed', (evt) => {
  // handle event
});

// Later: cleanup by calling unsubscribe
unsub();

// DO NOT use off() - it's for manual handler removal but less clean
```

## Step 6: Adapter Usage Pattern

```typescript
// Adapters consume full A2Event
events.on('capsule.lifecycle.changed', (evt: A2Event) => {
  const patch = browserAdapter.patchFromEvent(evt);
  if (patch) {
    applyPatch(patch);
  }
});
```

## Step 7: File Locations

| Purpose | Location |
|---------|----------|
| SDK core | `packages/capsule-sdk/src/core/` |
| SDK controllers | `packages/capsule-sdk/src/controllers/` |
| SDK guards | `packages/capsule-sdk/src/guards/` |
| A2UI adapters | `apps/ui/src/a2ui/adapters/` |
| Capsule wiring | `apps/ui/src/capsules/{name}/` |

## Step 8: Snapshot Shape

```typescript
interface CapsuleSnapshot {
  capsule: {
    id, spaceId, type, lifecycle, capabilities, presentation, actions
  };
  stage?: { active, preset, capsuleId?, tabId? };
  renderer?: { mode, reason? };
  extensions?: Record<string, unknown>; // capsule-specific data
}
```

## Quick Test Commands

```bash
# After installing TypeScript at root:
pnpm --filter capsule-sdk typecheck

# Should output no errors
```

## Common Issues

### "Cannot find module '@a2rchitech/capsule-sdk'"

→ Add `"@a2rchitech/capsule-sdk": "workspace:*"` to consuming package's dependencies

### "tsc not found"

→ Install TypeScript at root: `pnpm add -D typescript`

### Circular imports

→ Keep adapters pure (no business logic)
→ Keep wiring in capsule folder, not in adapters/
