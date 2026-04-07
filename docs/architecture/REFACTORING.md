# A2rchitech Refactor & Modernization

## ⚠️ Active Refactor in Progress
This project is currently undergoing a system-wide refactor to address architectural fragmentation, technical debt, and monolithic components.

### Quick Links
- **Refactor Plan (DAG):** [DAG_REFACTOR_PLAN.md](./DAG_REFACTOR_PLAN.md)
- **Technical Debt Inventory:** [TECHNICAL_DEBT_MANIFEST.log](./TECHNICAL_DEBT_MANIFEST.log)

## Current Status
- **Current Phase:** Phase 3 (Monolith Decomposition)
- **Last Updated:** Thursday, March 26, 2026
- **Status:** Initializing Task 3.1: Decompose `PluginManager.tsx`.

## Architecture & Decisions
1. **Package Management:** Moving to `pnpm` + `Turborepo` for unified dependency management.
2. **Library Strategy:** Establishing `@allternit/*` TypeScript path aliases in a root `packages/` workspace.
3. **Core Targets:** Decomposing `kernel-service/src/main.rs` and `PluginManager.tsx` into modular sub-services and components.
4. **Security:** Systematic removal of `dangerouslySetInnerHTML` in favor of sanitized rendering.

## Handoff Instructions for Coding Agents
1. **Identify the current task** by checking the `[ ]` items in `DAG_REFACTOR_PLAN.md`.
2. **Consult the `TECHNICAL_DEBT_MANIFEST.log`** before modifying any existing logic to ensure stubs/TODOs are preserved.
3. **Follow the DAG dependencies**—do not skip to Phase 3 or 4 before Phase 1 and 2 are verified.
4. **Maintain Workspace Hygiene:** Keep the root directory clean; move assets to `docs/assets` and consolidated documentation to `docs/`.
