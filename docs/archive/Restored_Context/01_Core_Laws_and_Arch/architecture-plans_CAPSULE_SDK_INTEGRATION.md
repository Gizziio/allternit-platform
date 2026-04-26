# Capsule SDK Integration - Work Summary

## What Was Created

### 1. Capsule SDK v0.1 (`packages/capsule-sdk/`)

```
packages/capsule-sdk/
├── package.json                    # ESM package, TypeScript
├── tsconfig.json                   # Strict type checking
├── README.md                       # Quick start guide
└── src/
    ├── index.ts                    # Public API exports
    ├── core/
    │   ├── ids.ts                  # SpaceId, CapsuleId, TabId, ActionId, EventId
    │   ├── lifecycle.ts            # Phase types + lifecycle controller
    │   ├── capabilities.ts         # Capability types + controller
    │   ├── events.ts               # Event bus + canonical event format
    │   ├── actions.ts              # Action registry + builder
    │   └── presentation.ts         # Presentation, StagePreset types
    ├── controllers/
    │   ├── CapsuleController.ts    # Per-capsule lifecycle/capabilities
    │   ├── StageController.ts      # Per-space stage (anti-sprawl)
    │   ├── RendererController.ts   # Per-tab renderer mode
    │   └── index.ts                # Controller exports
    └── guards/
        ├── invariants.ts           # Runtime invariant validation
        ├── actionGuard.ts          # Dead-button prevention
        └── index.ts                # Guard exports
```

### 2. A2UI Adapters (`apps/ui/src/a2ui/adapters/`)

```
apps/ui/src/a2ui/adapters/
├── index.ts                        # Adapter exports
├── types.ts                        # Base types + schemas
├── BrowserAdapter.ts               # Browser header/status adapters
├── StageAdapter.ts                 # Stage chrome adapter
├── RendererAdapter.ts              # Boost/renderer control adapter
└── BrowserSDKIntegration.ts        # Integration reference (EXAMPLE)
```

## Key Design Decisions

### SDK Owns (Meta-State)
- Lifecycle phases (`init` → `connecting` → `ready` → `busy` → `error` → `suspended` → `disposed`)
- Capability declarations (`staged`, `streaming`, `gpu`, `multiTab`, `agentControllable`)
- Presentation mode (`capsule` vs `stage`)
- Action registry (dead-button prevention)
- Event bus (canonical event format)

### Browser Module Owns (Browser-Specific State)
- Tabs list and active tab
- URL history and navigation
- Screenshot/frame buffers
- Performance metrics (FPS, latency)
- Coordinate mapping
- Input handling
- Runtime IPC with browser service

## Integration Pattern

```typescript
// 1. Create SDK controllers
const capsule = createCapsuleController({
  spaceId,
  type: 'browser',
  capabilities: { staged: true, streaming: true, gpu: true, multiTab: true },
});

const stage = createStageController(spaceId);
const renderer = createRendererController(spaceId);

// 2. Register actions
capsule.actions.register(id, createActionBuilder()
  .id('nav.back')
  .label('Back')
  .enabled(true)
  .run(() => navigateBack())
  .build());

// 3. Emit lifecycle changes
capsule.setLifecycle({ phase: 'ready' });

// 4. Subscribe to SDK events
capsule.events.on('capsule.lifecycle.changed', (evt) => {
  const schema = browserAdapter.renderStatusBar(snapshot, browserState);
  a2uiRenderer.update(schema);
});

// 5. Build snapshot for A2UI
function getSnapshot() {
  return {
    capsule: { ...capsule, actions: capsule.actions.list(id) },
    stage: stage.get(),
    renderer: renderer.get(activeTabId),
  };
}
```

## Files Reference

| File | Purpose |
|------|---------|
| `packages/capsule-sdk/src/core/ids.ts` | Identifier types |
| `packages/capsule-sdk/src/core/lifecycle.ts` | Lifecycle phases + controller |
| `packages/capsule-sdk/src/core/capabilities.ts` | Capability types + controller |
| `packages/capsule-sdk/src/core/events.ts` | Event bus + types |
| `packages/capsule-sdk/src/core/actions.ts` | Action registry + builder |
| `packages/capsule-sdk/src/core/presentation.ts` | Presentation, StagePreset |
| `packages/capsule-sdk/src/controllers/CapsuleController.ts` | Per-capsule controller |
| `packages/capsule-sdk/src/controllers/StageController.ts` | Per-space stage controller |
| `packages/capsule-sdk/src/controllers/RendererController.ts` | Per-tab renderer controller |
| `packages/capsule-sdk/src/guards/invariants.ts` | Runtime validation |
| `packages/capsule-sdk/src/guards/actionGuard.ts` | Dead-button prevention |
| `apps/ui/src/a2ui/adapters/types.ts` | A2UI schema types |
| `apps/ui/src/a2ui/adapters/BrowserAdapter.ts` | Browser → A2UI schema |
| `apps/ui/src/a2ui/adapters/StageAdapter.ts` | Stage → A2UI schema |
| `apps/ui/src/a2ui/adapters/RendererAdapter.ts` | Renderer → A2UI schema |
| `apps/ui/src/a2ui/adapters/BrowserSDKIntegration.ts` | Integration reference |
| `docs/CAPSULE_SDK_ARCHITECTURE.md` | Architecture documentation |

## Next Steps

### Immediate (Wiring Browser Capsule)

1. **Add capsule-sdk dependency** to `apps/shell/package.json`:
   ```json
   "dependencies": {
     "@allternit/capsule-sdk": "workspace:*"
   }
   ```

2. **Wire BrowserView.ts** to use CapsuleController:
   - Initialize controllers in constructor
   - Register actions (nav, mode, renderer, stage, tabs)
   - Subscribe to SDK events
   - Call `setLifecycle()` on state changes

3. **Wire A2UI rendering**:
   - Import adapters
   - Subscribe to SDK events
   - Render schemas via A2UI

### Short-Term (Prove Generality)

4. **Migrate one non-browser capsule** (pick one):
   - Logs/console viewer
   - Tasks panel
   - Settings
   - File explorer

### Medium-Term (Agent Integration)

5. **Expose agent API**:
   - `GET /capsule/:id/snapshot` - Read state
   - `POST /capsule/:id/action/:actionId` - Execute action
   - `GET /capsule/:id/actions` - List actions

## Acceptance Criteria

- [ ] Browser capsule still works identically
- [ ] All existing buttons still work
- [ ] Phase transitions emit SDK events
- [ ] Actions are registered in SDK registry
- [ ] A2UI adapters render same UI from schemas
- [ ] No UI code in capsule-sdk
- [ ] No SDK imports in UI rendering code

## Why This Design Works

| Problem | Solution |
|---------|----------|
| SDK prescribing UI | Zero UI code in SDK, pure contracts |
| Agent control | Stable event bus + action registry |
| Capsule identity | Browser-specific state stays in browser |
| A2UI sovereignty | Adapters are pure mapping functions |
| Dead buttons | Action registry + guardrails |
| Anti-sprawl | StageController enforces one stage/space |
