# Gizzi Code ↔ Claude Code Integration Documentation

This directory contains the complete analysis and planning documentation for integrating Claude Code's architecture into the Gizzi Code codebase.

## Quick Start

| Document | Purpose | Read This If... |
|----------|---------|-----------------|
| **[`INTEGRATION_DAG_TASK_LIST.md`](./INTEGRATION_DAG_TASK_LIST.md)** | **Primary project tracker** - Complete task breakdown with dependencies | You need to know what to work on |
| **[`TASK_CHECKLIST.md`](./TASK_CHECKLIST.md)** | Simple checkbox tracking for daily use | You want a quick daily checklist |
| **[`FINAL_INTEGRATION_SCOPE.md`](./FINAL_INTEGRATION_SCOPE.md)** | Final scope decisions - what to port | You need to understand the scope |

## Architecture Decisions

| Document | Description |
|----------|-------------|
| [`CORRECTED_INTEGRATION_ARCHITECTURE.md`](./CORRECTED_INTEGRATION_ARCHITECTURE.md) | Corrected decision: Claude Code as base, port Gizzi features |
| [`GIZZI_TO_CLAUDE_PORTING_GUIDE.md`](./GIZZI_TO_CLAUDE_PORTING_GUIDE.md) | Porting guide with code examples |
| [`ADDITIONAL_GIZZI_GAPS_ANALYSIS.md`](./ADDITIONAL_GIZZI_GAPS_ANALYSIS.md) | Additional gap analysis beyond initial assessment |

## Original Analysis Documents

| Document | Description |
|----------|-------------|
| [`CLAUDE_CODE_ALLTERNIT_INTEGRATION_ANALYSIS.md`](./CLAUDE_CODE_ALLTERNIT_INTEGRATION_ANALYSIS.md) | Initial Claude Code architecture analysis |
| [`EXHAUSTIVE_INTEGRATION_ANALYSIS.md`](./EXHAUSTIVE_INTEGRATION_ANALYSIS.md) | Exhaustive primitive comparison |
| [`INTEGRATION_IMPLEMENTATION_GUIDE.md`](./INTEGRATION_IMPLEMENTATION_GUIDE.md) | Original implementation guide |
| [`INTEGRATION_SUMMARY.md`](./INTEGRATION_SUMMARY.md) | Summary of integration approach |
| [`INTEGRATION_SYNTHESIS.md`](./INTEGRATION_SYNTHESIS.md) | Synthesis of integration findings |

## Project Timeline

```
Phase 1: Foundation (Weeks 1-4)
├── Branding & Identity
├── Bus Event System
├── Workspace System
└── Continuity Types

Phase 2: Configuration (Weeks 5-7)
├── Layered Configuration
├── Auto-Instructions
└── PermissionNext

Phase 3: Advanced Features (Weeks 8-11)
├── Verification System
├── Skills System
├── Worktree Management
└── Session Tree

Phase 4: Polish & Testing (Weeks 12-14)
├── LSP/Shell Integration
├── Testing
└── Documentation

Phase 5: Cowork Mode (Post-Stability)
└── Multi-agent collaboration
```

## Key Directories in Project

```
/Users/macbook/Desktop/allternit-workspace/allternit/cmd/gizzi-code/
├── src/
│   ├── bus/           # Event system (to port/adapt)
│   ├── cli/           # CLI commands & UI
│   ├── config/        # Configuration system
│   ├── continuity/    # Session continuity
│   ├── permission/    # PermissionNext
│   ├── runtime/       # Agent runtime
│   ├── session/       # Session management
│   ├── tool/          # Tool implementations
│   └── ...
├── docs/integration/  # ← You are here
└── ...
```

## Next Steps

1. Review [`INTEGRATION_DAG_TASK_LIST.md`](./INTEGRATION_DAG_TASK_LIST.md) for the complete task breakdown
2. Start with **Phase 1** tasks (no dependencies)
3. Use [`TASK_CHECKLIST.md`](./TASK_CHECKLIST.md) for daily tracking

## Integration Summary

- **Base**: Claude Code architecture (React + Ink TUI, 40+ tools)
- **Port From**: Gizzi primitives (Bus, Workspace, Verification, Continuity)
- **Single TUI**: Claude's Ink (no dual interface)
- **Timeline**: 14 weeks (Phases 1-4), Phase 5 deferred
- **Output**: GIZZI Code CLI (`gizzi-code`)
