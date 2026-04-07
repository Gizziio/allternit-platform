# Hand-off: TypeScript Scale & Refactor (Phase 1)

**Status:** Phase 2 Complete | **Active Scope:** @allternit | **Target:** OOM Mitigation
**Last Updated:** 2026-03-31

## 1. Executive Summary
The platform was suffering from TypeScript Out-of-Memory (OOM) errors caused by a 7,000-line `AgentView.tsx` file and a deeply nested `adapters-ts` directory that forced the compiler to load the entire type graph of the monorepo simultaneously. We have successfully decomposed these monoliths and established a "Constitutional Law" to prevent re-occurrence.

## 2. Structural Changes
### A. AgentView Decomposition
- **File:** `surfaces/platform/src/views/AgentView.tsx` (Now ~200 lines)
- **New Components:**
  - `src/views/agent-view/AgentView.constants.ts` (Static config)
  - `src/views/agent-view/components/CreateAgentForm.tsx` (Wizard logic)
  - `src/views/agent-view/components/AgentDetailView.tsx` (Overlay logic)
  - `src/views/agent-view/components/AgentCard.tsx` (List item)

### B. Adapter Package Extraction
- **Original:** `surfaces/platform/adapters-ts/` (Deleted)
- **New Packages:** Moved to `packages/@allternit/`
  - `@allternit/ix`
  - `@allternit/visual-state`
  - `@allternit/avatar-adapters`
  - `@allternit/workflow-engine`
  - `@allternit/viz`
  - `@allternit/browser-tools`
  - `@allternit/form-surfaces`

## 3. Configuration & Branding
- **Authority:** `SYSTEM_LAW.md` is now the Tier-0 mandate.
- **Namespace:** All internal packages must use the `@allternit/` scope.
- **Next.js Config:** `next.config.ts` aliases have been updated to point to `../../packages/@allternit/`.

## 4. Completed Tasks (Phase 2)

### 4.1 Project References Implementation
All `@allternit/*` packages now have `composite: true` in their `tsconfig.json`:

| Package | Status |
|---------|--------|
| `@allternit/visual-state` | ✅ |
| `@allternit/avatar-adapters` | ✅ |
| `@allternit/ix` | ✅ |
| `@allternit/viz` | ✅ |
| `@allternit/workflow-engine` | ✅ |
| `@allternit/browser-tools` | ✅ |
| `@allternit/form-surfaces` | ✅ |
| `@allternit/replies-contract` | ✅ |
| `@allternit/replies-reducer` | ✅ |
| `@allternit/provider-adapters` | ✅ |
| `@allternit/executor-core` | ✅ |
| `@allternit/executor-superconductor` | ✅ |
| `@allternit/parallel-run` | ✅ |

### 4.2 Platform tsconfig.json Updated
The platform `tsconfig.json` now includes a `references` array pointing to all `@allternit/*` packages, enabling incremental builds.

### 4.3 Barrel File Survey Complete
- **Document:** `surfaces/platform/docs/BARREL_FILE_SURVEY.md`
- **Total Barrels Found:** 93 `index.ts` files in `src/`
- **Priority Targets:** `components/ui/index.ts`, `views/index.ts`, `lib/agents/index.ts`

### 4.4 Package Restorations & Fixes

#### form-surfaces - Production Quality Restored
The `@allternit/form-surfaces` package has been restored with full production implementation:
- **Schema System:** Complete `FormSchema`, `FormField` types with validation
- **Field Types:** 12+ field types (text, textarea, number, select, multiselect, radio, checkbox, date, file, array, object, custom)
- **Renderers:** `FormRenderer` and `FieldRenderer` components with guided/advanced modes
- **Template Engine:** Artifact emission with template rendering
- **Vision Emitter:** Project specification document generation
- **Answer Store:** Versioned form answer storage

#### executor-superconductor - Type Alignment Fixed
- **Issue:** `CanvasEventType` was not compatible with `ExecutionUpdate['eventType']`
- **Fix:** Added `ExecutionUpdateEventType` to `@allternit/executor-core` that includes both original event types and Canvas event types
- **Mapping:** Added `mapCanvasEventTypeToExecutionUpdate()` function for proper type conversion
- **Status:** Builds successfully without `as any` workarounds

#### executor-core - Extended Event Types
- Added `ExecutionUpdateEventType` union type
- Includes both backend events (`started`, `progress`, `completed`) and Canvas events (`run.parallel.launch`, `render.preview.url`, etc.)

## 5. Remaining Tasks (Critical)

### 5.1 Barrel File Elimination (HIGH PRIORITY)
Systematic removal of `index.ts` re-exports in the platform `src/` directory:

```bash
# Find all barrel import sites
grep -r "from '@/components/ui'" --include="*.ts" --include="*.tsx" src/
grep -r "from '@/views'" --include="*.ts" --include="*.tsx" src/
```

**Target:** Replace with direct imports (e.g., `import { x } from '@/components/ui/button'`)

### 5.2 Re-enable Typecheck
`surfaces/platform/next.config.ts` has `ignoreBuildErrors: true`. Remove this once:
1. Barrel file elimination is complete
2. Full typecheck passes without OOM

### 5.3 Full Build Validation
Run complete project references build:
```bash
pnpm tsc -b surfaces/platform/tsconfig.json
```

## 6. Verification Commands

### Build Individual Packages
```bash
# Build replies packages (verified working)
pnpm tsc -b packages/@allternit/replies-contract/tsconfig.json packages/@allternit/replies-reducer/tsconfig.json

# Build executor packages (verified working)
pnpm tsc -b packages/@allternit/executor-core/tsconfig.json packages/@allternit/executor-superconductor/tsconfig.json

# Build form-surfaces (verified working)
pnpm tsc -b packages/@allternit/form-surfaces/tsconfig.json
```

### Full Type Check (May OOM)
```bash
cd surfaces/platform && NODE_OPTIONS="--max-old-space-size=16384" npx tsc --noEmit
```

## 7. Architecture Notes

### Project References Build Order
TypeScript builds packages in dependency order:
1. `replies-contract` (no deps)
2. `replies-reducer` → `replies-contract`
3. `provider-adapters` → `replies-contract`
4. `executor-core` (no deps)
5. `executor-superconductor` → `executor-core`
6. `parallel-run` (no deps)
7. `form-surfaces` (no deps)
8. ... then platform (depends on all above)

### Memory Optimization
- Project references allow incremental builds
- Each package compiles independently
- `.tsbuildinfo` files track changes for fast rebuilds

### Package Dependencies Graph
```
@allternit/executor-core          (standalone)
@allternit/executor-superconductor → executor-core
@allternit/parallel-run           (standalone)
@allternit/replies-contract       (standalone)
@allternit/replies-reducer        → replies-contract
@allternit/provider-adapters      → replies-contract
@allternit/form-surfaces          (standalone)
```
