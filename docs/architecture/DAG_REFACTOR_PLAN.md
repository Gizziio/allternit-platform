# A2rchitech Refactor DAG & Gameplan

This document outlines a Directed Acyclic Graph (DAG) of tasks to safely refactor and modernize the allternit codebase.

## Core Philosophy: Safe Refactoring
1. **Incremental Changes:** No massive "big bang" rewrites. Every PR/merge should leave the main branch in a deployable state.
2. **Backward Compatibility:** When moving APIs or libraries, keep old paths functional until clients are updated, then deprecate.
3. **Automated Verification:** Rely heavily on existing tests. Add tests for critical paths before modifying them.
4. **Isolate Risk:** Refactor non-critical components first (e.g., UI styles) before tackling core orchestration logic (e.g., `kernel-service`).

## DAG Task List

### Phase 1: Clean Up & Centralization (Low Risk)
These tasks have minimal impact on runtime logic but drastically improve workspace hygiene.

- [x] **Task 1.1: Root Cleanup**
  - Subtask: Move all `.png` files in `surfaces/platform/` to `surfaces/platform/docs/assets/`.
  - Subtask: Move loose `.cjs` scripts into a dedicated `scripts/` directory or delete if obsolete.
  - Subtask: Consolidate markdown docs (e.g., `AI_ELEMENTS_*.md`) into a `docs/` folder.
  - *Risk:* Minimal. Only breaks markdown links if not updated carefully.

- [x] **Task 1.2: Infrastructure Consolidation**
  - Subtask: Audit `infra/`, `infrastructure/`, `services/infrastructure/`.
  - Subtask: Move active configs to the root `infrastructure/` directory.
  - Subtask: Delete abandoned infrastructure directories.
  - *Dependencies:* 1.1
  - *Risk:* Moderate. Requires verifying CI/CD pipelines and `docker-compose` paths.

### Phase 2: Package & Dependency Unification (Medium Risk)
Standardizing how packages interact to prevent version drift.

- [x] **Task 2.1: Establish Unified `packages/` Workspace**
  - Subtask: Move `platform/sdk`, `platform/types`, `platform/utils` into `packages/@allternit/sdk`, etc.
  - Subtask: Update `tsconfig.json` paths and package.json workspaces.
  - *Dependencies:* 1.2
  - *Risk:* High. Import paths across the entire project will break if not updated globally.

- [x] **Task 2.2: Unify Gateway Services**
  - Subtask: Convert `services/gateway/*` into a cohesive monorepo (e.g., pnpm workspace).
  - Subtask: Deduplicate `node_modules` and align dependencies.
  - *Dependencies:* 2.1
  - *Risk:* Medium. Might break internal service communication if ports or start scripts change.

### Phase 3: Monolith Decomposition (High Risk)
Breaking down massive files. This is where bugs are most likely introduced.

- [x] **Task 3.1: Decompose `PluginManager.tsx`**
  - Subtask: Extract sub-components (e.g., `SkillUploadModal`, `ConnectorConnectModal`).
  - Subtask: Move inline styles to CSS modules or styled-components.
  - *Dependencies:* 1.1
  - *Risk:* High visual regression risk. Need to manually verify all UI states.

- [ ] **Task 3.2: Decompose `kernel-service/src/main.rs`**
  - Subtask: Create `handlers/` module and move axum routes.
  - Subtask: Create `metrics/` module for monitoring logic.
  - Subtask: Refactor `AppState` to use Axum's `FromRef` for tighter scoping.
  - *Dependencies:* 2.1
  - *Risk:* Very High. This is the core orchestrator. Rust's compiler will catch most structural issues, but logical errors in state management could cause runtime panics.

### Phase 4: Addressing Security & Gaps (Medium-High Risk)
Fixing actual bugs and missing features.

- [ ] **Task 4.1: Eradicate `dangerouslySetInnerHTML`**
  - Subtask: Implement a secure `MarkdownRenderer` component using `DOMPurify`.
  - Subtask: Replace all 295 instances across the platform.
  - *Dependencies:* 3.1
  - *Risk:* Medium. Could break the rendering of complex, previously-unsafe HTML content.

- [ ] **Task 4.2: Implement Missing Core Gaps**
  - Subtask: Add proper JWT validation in `services/gateway/service/src/main.py`.
  - Subtask: Wire up actual computer-vision logic in `vision/src/computer-vision.ts` (replacing TODOs).
  - Subtask: Improve error handling in Rust services (replace `map_err(|_| InternalServerError)` with typed errors).
  - *Dependencies:* 3.2
  - *Risk:* Low for new features, High for Auth changes (could lock out users).