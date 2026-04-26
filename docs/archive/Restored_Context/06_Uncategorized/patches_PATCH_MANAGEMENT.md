# PATCH MANAGEMENT SYSTEM

## Overview
This document explains the organization and purpose of patch files in the Allternit repository.

## Patch Categories

### 1. Phase Patches (.allternit/patches/phases/)
These patches document major development phases and architectural changes:

- `phase2_runtime.patch` - Records changes made during Phase 2 (Runtime Implementation)
  - Runtime boundary contracts and interfaces
  - Governance hooks and audit trails
  - Tool execution wrappers with safety checks

- `phase3_capsules.patch` - Records changes made during Phase 3 (Capsule Implementation)
  - Capsule runtime and orchestration
  - Capsule compiler and deployment mechanisms
  - Capsule isolation and security boundaries

- `PHASE1.patch` - Records changes made during Phase 1 (Agent Handoff Implementation)
  - SDK tool execution capabilities
  - Tool gateway with safety tiers
  - Provider management for AI models

### 2. Task Patches (.allternit/patches/tasks/)
These patches document specific task implementations:

- `T1000-ui-shell.patch` - UI shell implementation changes
- `T1001-graph-visualizer.patch` - Graph visualization component changes
- `T1002-graph-visualizer.patch` - Additional graph visualization changes
- `T1001-runs-dashboard.patch` - Runs dashboard implementation changes
- `T1005-memory-promotion-ui.patch` - Memory promotion UI changes

## Patch Management Principles

### Centralized Storage
- All development patches are stored in `.allternit/patches/`
- This prevents clutter in the main codebase
- Patches are organized by category (phases, tasks, etc.)

### Purpose
- Historical record of architectural changes
- Reproducibility of development phases
- Migration guidance for future changes
- Audit trail for code evolution
- Rollback capability if needed

### Lifecycle
- Patches are created during development phases
- Patches are applied to the codebase during implementation
- Patches are archived in `.allternit/patches/` for historical reference
- Patches should not be modified after archiving

## Important Notes

### Dependency Patches
Other patch files in the codebase (e.g., in `.references/`, `node_modules/`) are dependency patches used by package managers (like yarn) and are not part of the development phase patch system. These remain in their respective locations.

### Patch Application
These patches are historical records and typically don't need to be applied again unless recreating a specific development phase. The current codebase already incorporates these changes.

## Best Practices
- All major architectural changes should generate a patch file
- Patches should be descriptive and focused on a single change set
- Patches should be stored immediately in the appropriate `.allternit/patches/` subdirectory
- Regular cleanup of obsolete patches should be performed