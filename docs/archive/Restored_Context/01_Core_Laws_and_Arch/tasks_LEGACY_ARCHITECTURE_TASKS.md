# Extracted Tasks - Legacy Specs & Architecture

**Date:** 2026-01-18
**Source:** allternit-specs(temporary) and Architecture folders
**Status:** Extracted and prioritized

## Tasks from Allternit-Specs (Legacy Gizzi)

### Phase 1: MVP - Foundation
#### IO & Bridge Layer
- [ ] Implement IO Boot with `IO_READY` emission
- [ ] Implement bridge accepting `io.ping` and `skill.invoke`
- [ ] Ensure `/var/gizzi` mounting and persistence
- [ ] Implement Gizzi Presence visual orb

### Phase 2: Operator (Vision/GUI)
- [ ] Implement `gui.observe` for screenshot capture
- [ ] Implement `model.ui_tars.propose` for action suggestions
- [ ] Implement `gui.execute` for GUI automation
- [ ] Add policy validation before GUI execution
- [ ] Implement Gizzi confirmation UI

### General Integration
- [ ] Implement WebVM-based Linux VM runtime
- [ ] Establish IO daemon as side-effect-authorized layer
- [ ] Implement IndexedDB filesystem for state persistence
- [ ] Create NDJSON-RPC bridge protocol

## Tasks from Architecture (Design Corpus)

### Backlog Management
- [ ] Review and prioritize Tool Registry backlog
- [ ] Map backlog items to current Allternit architecture
- [ ] Create task entries in issue tracker (Beads)

### Architecture Review
- [ ] Read entire Architecture corpus before implementation
- [ ] Verify current code implements Architecture specs
- [ ] Identify gaps between design and implementation
- [ ] Document which Architecture specs are obsolete

### UI Implementation
- [ ] Review Presentation Kernel implementation
- [ ] Verify Canvas Protocol implementation
- [ ] Check View Registry extensibility
- [ ] Review Miniapp Runtime architecture

### Contract & Protocol Verification
- [ ] Verify Kernel contracts match Architecture specs
- [ ] Check intent dispatch API compliance
- [ ] Review journal stream implementation
- [ ] Verify capsule spawn and event handling

### P0 Implementation (if applicable)
- [ ] Review P0-A Capsule Shell + Tab/Canvas metaphor
- [ ] Review P0-B Canvas protocol + View taxonomy
- [ ] Review P0-C FrameworkSpec + capsule spawning
- [ ] Review P0-D Kernel contracts: intent dispatch

## Priority Classification

### High Priority (Immediate Review)
1. **Review Architecture corpus** - Determine design-implementation gaps
2. **Map backlog to current system** - Identify obsolete vs. relevant tasks
3. **Verify UI protocols** - Canvas, ViewSpec, CapsuleProtocol

### Medium Priority (Next Sprint)
1. **Implement Vision/GUI features** - From Phase 2 Operator specs
2. **Tool Registry integration** - From Architecture BACKLOG
3. **Contract verification** - Kernel contracts vs Architecture specs

### Low Priority (Future Consideration)
1. **Legacy Gizzi implementation** - IO Boot, Gizzi Presence
2. **Multi-modal execution** - Full GUI automation pipeline
3. **WebVM integration** - If not already implemented in current system

## Dependencies

### Review Required
1. **Current Codebase** - Must understand what exists before mapping tasks
2. **Architecture Specs** - Must read corpus to understand design intent
3. **Gap Analysis** - Compare design vs. implementation

### Blocking Items
- Architecture corpus review blocks accurate task mapping
- Current system understanding required before adding tasks

## Context

These tasks represent a comprehensive backlog extracted from legacy Gizzi specifications and Architecture design corpus. The current Allternit system has evolved significantly from these origins, and many of these items may be:

1. **Already implemented** in current system
2. **Obsoleted** by new architecture
3. **Irrelevant** to current use cases

**Recommendation:** Review tasks with current codebase context before adding to active backlog. Filter out:
- Tasks describing features that already exist in allternit
- Tasks for Gizzi-specific functionality not present in allternit
- Tasks for UI/Architectural patterns already implemented differently

---

**Next Action:** Review current allternit codebase to determine which tasks are relevant, then merge filtered tasks into `archive/tasks/TASKS_INDEX.md`