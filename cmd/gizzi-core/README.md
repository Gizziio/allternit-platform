# GIZZI Core

Production-ready primitives for GIZZI Code - extracted and tested.

## Status

| Metric | Value |
|--------|-------|
| TypeScript Errors | **0** |
| Tests Passing | **7/7** |
| Build Status | **✅ Success** |
| Bundle Size | 1.90 MB |

## Modules

### Brand (`brand/`)
Central brand constants and user-facing copy.

```typescript
import { GIZZIBrand, GIZZICopy } from "@allternit/gizzi-core"

console.log(GIZZIBrand.product) // "GIZZI Code"
console.log(GIZZICopy.sidebar.onboardingTitle) // "Kernel ready"
```

### Bus (`bus/`)
Event bus for decoupled communication.

```typescript
import { Bus, WorkspaceInitialized } from "@allternit/gizzi-core"

Bus.subscribe(WorkspaceInitialized, (event) => {
  console.log("Workspace:", event.properties.path)
})

await Bus.publish(WorkspaceInitialized, { path: "./.gizzi", name: "local" })
```

### Workspace (`workspace/`)
`.gizzi/` directory management.

```typescript
import { Workspace } from "@allternit/gizzi-core"

await Workspace.init("./.gizzi", { 
  name: "Gizzi", 
  emoji: "⚡",
  vibe: "Sharp, resourceful, autonomous."
})
// Creates: IDENTITY.md, SOUL.md, USER.md, MEMORY.md, AGENTS.md
```

### Continuity (`continuity/`)
Session handoff and context transfer types.

```typescript
import type { SessionContext, DAGTask, HandoffBaton } from "@allternit/gizzi-core"
```

### Verification (`verification/`)
Semi-formal verification system.

```typescript
import { Verification } from "@allternit/gizzi-core"

const result = await Verification.empirical("./src")
```

### UI (`ui/`)
Ink-based UI components.

```tsx
import { ShimmeringBanner } from "@allternit/gizzi-core"

<ShimmeringBanner onComplete={() => console.log("Ready!")} />
```

## Scripts

```bash
# Type check
bun run typecheck

# Run tests
bun test

# Build
bun run build
```

## File Structure

```
gizzi-core/
├── src/
│   ├── brand/              # Brand constants
│   ├── bus/                # Event bus
│   ├── continuity/         # Session continuity
│   ├── ui/components/      # UI components
│   ├── verification/       # Verification system
│   ├── workspace/          # Workspace management
│   ├── index.ts            # Main export
│   └── README.md
├── test/
│   └── integration.test.ts # 7 tests, all passing
├── dist/                   # Built output
├── package.json
└── tsconfig.json
```

## Integration Notes

This package was extracted from the Claude Code + Gizzi integration. The original
Claude Code source had 5000+ type errors due to missing files from the leak. This
package contains the **production-ready Gizzi primitives** that are fully tested
and type-safe.

To integrate into a working CLI:
1. Import `@allternit/gizzi-core` as a workspace dependency
2. Use the Bus for event communication
3. Use Workspace for `.gizzi/` management
4. Use Verification for code verification
5. Use ShimmeringBanner for the boot animation
