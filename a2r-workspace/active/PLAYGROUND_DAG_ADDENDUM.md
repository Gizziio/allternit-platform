# A2R PLAYGROUND SYSTEM - DAG ADDENDUM

**Date:** 2026-02-20  
**Status:** NEW CAPABILITY - Not in original DAG  
**Alignment:** Living Files Theory ✅  
**Priority:** HIGH (foundational capability)

---

## Executive Summary

**Playground System** is a **visual control plane for agents** that provides:
- Structured human-agent interaction
- Living Artifact layer
- Deterministic intent capture
- High-bandwidth input surface

This is **NOT a pivot** - it extends existing A2R architecture:
- ✅ HUMAN vs AGENT renderer separation
- ✅ Rails execution gating
- ✅ Receipt-based observability
- ✅ Living Files system
- ✅ A2A review loops
- ✅ Deterministic patch application

---

## New DAG Tasks (P3.6 - Playground System)

### P3.6: Playground Core Engine
**Priority:** P3 - HIGH  
**Effort:** 2 weeks  
**Dependencies:** P2.4 (Receipt System) ✅, P2.7 (Event Bus) ✅

**Subtasks:**
- [ ] 3.6.1: Playground storage schema
- [ ] 3.6.2: Relay service (local HTTP bridge)
- [ ] 3.6.3: `playground.watch({id})` tool
- [ ] 3.6.4: `playground.open({id})` tool
- [ ] 3.6.5: Typed `PromptOutput` / `PatchOutput` contracts
- [ ] 3.6.6: Event emission (PLAYGROUND_OPENED, CONTROL_CHANGED, etc.)

**Acceptance Criteria:**
- Playgrounds can be created/opened
- Agent tools can watch playground state
- All interactions produce receipts
- Events published to event bus

---

### P3.7: Foundational Playground Templates
**Priority:** P3 - HIGH  
**Effort:** 2 weeks  
**Dependencies:** P3.6

**Subtasks:**
- [ ] 3.7.1: Diff Review Playground
  - Render git diff
  - Inline comment system
  - Accept/reject hunks
  - A2A review integration
- [ ] 3.7.2: Codebase Architecture Map Playground
  - Dependency graph visualization
  - Module boundaries
  - Click-to-expand nodes
  - Comment threads per node

**Acceptance Criteria:**
- Diff review produces approved patch sets
- Architecture map generates refactor roadmap
- All outputs produce receipts

**Output Contracts:**
```typescript
// Diff Review Output
interface DiffReviewOutput {
  approved_patches: Patch[];
  review_receipts: Receipt[];
  a2a_integration: boolean;
}

// Architecture Map Output
interface ArchitectureMapOutput {
  refactor_roadmap: Task[];
  codebase_updates: FilePatch[];
  issue_generation_plan: IssuePlan[];
}
```

---

### P3.8: UX Playground Templates
**Priority:** P3 - MEDIUM  
**Effort:** 3 weeks  
**Dependencies:** P3.6

**Subtasks:**
- [ ] 3.8.1: Site Structure Audit Playground
  - Graph view of sitemap
  - Orphan detection
  - Depth heatmap
  - Structured nav change proposals
- [ ] 3.8.2: Component Variation Playground
  - Prop toggles
  - Side-by-side variant previews
  - Inline comments
  - Token adjustments
- [ ] 3.8.3: Copy Review Playground
  - Baseline vs variants
  - Approve/reject per line
  - Constraint validation
- [ ] 3.8.4: Rive Playground
  - Parameter controls
  - Live preview of `.riv`
  - Skill-based generation
  - Deterministic export

**Acceptance Criteria:**
- Each template produces structured outputs
- All interactions logged as receipts
- Templates are composable

**Output Contracts:**
```typescript
// Site Structure Output
interface SiteAuditOutput {
  redirect_map: Redirect[];
  navigation_patch: NavPatch;
  ia_update_prompt: string;
}

// Component Variation Output
interface ComponentVariationOutput {
  variant_decisions: Decision[];
  diff_instructions: Diff[];
}

// Copy Review Output
interface CopyReviewOutput {
  accepted_patch: Patch;
  revision_log: Revision[];
}

// Rive Output
interface RiveOutput {
  generated_riv: Uint8Array;
  generation_params: Params;
  prompt_receipt: Receipt;
  patch_receipt: Receipt;
}
```

---

## Runtime Architecture

### Browser (HUMAN Capsule)
```
POST → `/a2r/playground/<id>/event`    // Control changes, comments
POST → `/a2r/playground/<id>/submit`   // Final output submission
```

### Local Relay (Shell Embedded)
- Stores playground state
- Emits observability events
- Exposes watch interface to agents

### Agent Runner Tools
```typescript
// Watch playground for changes
const playground = await tools.playground.watch({ id: 'pg_123' });

// Open playground for human interaction
await tools.playground.open({
  id: 'pg_123',
  template: 'diff-review',
  title: 'Review PR #456',
});
```

---

## Security Model

| Aspect | Implementation |
|--------|---------------|
| **Sandboxing** | Sandboxed iframe / isolated BrowserView |
| **CSP** | Strict Content Security Policy |
| **Filesystem** | No direct write access |
| **Policy** | All writes routed through Rails / policy engine |
| **Audit** | Receipts logged for all interactions |

---

## Event Types (Observability)

All playground interactions emit events:

```typescript
type PlaygroundEvent =
  | { type: 'PLAYGROUND_OPENED'; playground_id: string; template: string }
  | { type: 'CONTROL_CHANGED'; playground_id: string; control: string; value: any }
  | { type: 'COMMENT_ADDED'; playground_id: string; comment: Comment }
  | { type: 'APPROVAL_GIVEN'; playground_id: string; approval: Approval }
  | { type: 'SUBMIT_OUTPUT'; playground_id: string; output: Output }
  | { type: 'AGENT_APPLIED_PATCH'; playground_id: string; patch: Patch };
```

**All events produce receipts for:**
- Traceability
- Governance enforcement
- Deterministic replay
- Policy validation

---

## Integration with Existing Architecture

### Living Files Alignment ✅
- Playgrounds ARE Living Files
- Interactive, stateful, observable
- Validated by CI
- Referenced by agents

### HUMAN/AGENT Separation ✅
- HUMAN capsule: Interactive playground UI
- AGENT capsule: Watch tools + patch application

### Rails Gating ✅
- All playground submissions gated by policy
- Receipts emitted for audit trail

### A2A Review Loop ✅
- Diff Review Playground integrates with A2A review
- Approval/rejection flows through review protocol

---

## Updated DAG Task Count

### Original Remaining: 17 tasks
### New Tasks Added: 3 tasks (P3.6, P3.7, P3.8)
### New Total Remaining: **20 tasks**

| Phase | Original | New | Total |
|-------|----------|-----|-------|
| P3 | 5 | 3 | 8 |
| P4 | 6 | 0 | 6 |
| **TOTAL** | **17** | **3** | **20** |

**Revised P3 Duration:** 12 weeks + 7 weeks = **19 weeks**

---

## Implementation Priority

### Recommended Order:
1. **P3.6: Playground Core Engine** (2 weeks) - Foundation
2. **P3.7: Foundational Templates** (2 weeks) - Diff Review + Architecture Map
3. **P3.1-3.5: Other P3 Tasks** (12 weeks) - Agent Studio, Output Studio, etc.
4. **P3.8: UX Templates** (3 weeks) - Site Audit, Component, Copy, Rive

**Total P3:** 19 weeks

---

## Strategic Value

### Playgrounds Establish A2R As:

| Instead Of | Playgrounds Provide |
|------------|---------------------|
| Text-bound | ✅ Visual |
| Prompt-dependent | ✅ Structured |
| Opaque | ✅ Legible |
| Unstructured | ✅ Deterministic |
| Non-auditable | ✅ Auditable |

### High-Leverage Use Cases:

1. **Diff Review** - Replace PR review with structured playground
2. **Architecture Map** - Visual refactoring planning
3. **Component Variation** - Design system development
4. **Copy Review** - Content workflow automation
5. **Rive Generation** - Skill-based animation creation

---

## Next Steps

### Immediate:
1. **Approve Playground DAG addendum**
2. **Start P3.6: Playground Core Engine**
3. **Integrate with existing Receipt System**

### After P3.6:
1. **Build Diff Review Playground** (highest priority)
2. **Build Architecture Map Playground**
3. **Integrate with A2A review loop**

---

## Summary

**Playground System is:**
- ✅ Aligned with Living Files theory
- ✅ Extension of existing architecture (not pivot)
- ✅ High-leverage capability
- ✅ 3 new DAG tasks (P3.6, P3.7, P3.8)
- ✅ 7 weeks additional work

**Ready to proceed with P3.6 implementation.**

---

**End of Addendum**
