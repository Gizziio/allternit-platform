# Component Work Priorities

**Generated:** 2026-02-24T16:33:59.000Z  
**Based on:** COMPONENT_INVENTORY.json + COMPONENT_GAPS.md

---

## Priority Matrix

```
Impact
  │
H │  ┌─────────────────────────────────────┐
I │  │  P0 - CRITICAL                      │
G │  │  • Fix auth TODOs                   │
H │  │  • Delete duplicates                │
  │  │  • Add missing tests (core UI)      │
  │  └─────────────────────────────────────┘
  │           ┌─────────────────────────────┐
  │           │  P1 - HIGH                  │
  │           │  • Missing components       │
  │           │  • Type safety fixes        │
  │           │  • A11y improvements        │
  │           └─────────────────────────────┘
  │                      ┌──────────────────┐
  │                      │  P2 - MEDIUM     │
  │                      │  • Polish needed │
  │                      │  • Documentation │
M │                      └──────────────────┘
E │
D │         ┌───────────────────────────┐
I │         │  P3 - LOW                 │
U │         │  • Nice-to-have           │
M │         │  • Experimental           │
  │         └───────────────────────────┘
  │
  └──────────────────────────────────────────────
       LOW              MEDIUM              HIGH
                         Effort
```

---

## P0: CRITICAL (Do This Week)

### P0.1 Fix Security TODOs 🔒

| Task | File | Line | Effort | Owner |
|------|------|------|--------|-------|
| Get session from auth context | ShellApp.tsx | 415 | 4h | Auth Team |
| Get user ID from auth | sessions/route.ts | 41 | 2h | Auth Team |
| Add auth check to capsule launch | launch/route.ts | - | 4h | Auth Team |

**Rationale:** These are security blockers for production deployment.

### P0.2 Remove Duplicate Components 🗑️

| Action | Files | Effort | Risk |
|--------|-------|--------|------|
| Delete prompt-kit/code-block.tsx | 1 file | 30 min | Low (unused) |
| Delete prompt-kit/markdown.tsx | 1 file | 30 min | Low (unused) |
| Delete prompt-kit/message.tsx | 1 file | 30 min | Low (unused) |
| Delete prompt-kit/prompt-input.tsx | 1 file | 30 min | Low (1 import) |
| Delete BrowserCapsule.tsx | 1 file | 30 min | Low (deprecated) |
| Delete shell/LegacyWidgets.tsx | 1 file | 15 min | Low (marked legacy) |

**Migration Checklist:**
- [ ] Verify no active imports
- [ ] Update import statements if needed
- [ ] Run full test suite
- [ ] Update migration guide

### P0.3 Fix Type Safety Issues 🛡️

| File | Issue | Fix | Effort |
|------|-------|-----|--------|
| IconButton.tsx | `any` type | Define IconButtonProps | 1h |
| SegmentedControl.tsx | `any` type | Define SegmentedControlProps | 1h |

### P0.4 Add Core Component Tests 🧪

| Component | Test Type | Effort | Priority |
|-----------|-----------|--------|----------|
| Button | Unit + Snapshot | 2h | Highest |
| Input | Unit + Snapshot | 2h | Highest |
| Dialog | Unit + Integration | 3h | Highest |
| Card | Unit + Snapshot | 1h | High |
| Message | Unit + Integration | 3h | High |
| PromptInput | Unit + Integration | 3h | High |

---

## P1: HIGH (Do This Month)

### P1.1 Add Missing Base Components ➕

| Component | Priority | Effort | Dependencies |
|-----------|----------|--------|--------------|
| FileUpload | HIGH | 8h | react-dropzone |
| AutoComplete | HIGH | 6h | cmdk |
| DataGrid | HIGH | 16h | @tanstack/react-table |
| DatePicker | MEDIUM | 8h | react-day-picker |
| MultiSelect | MEDIUM | 6h | - |
| VirtualList | MEDIUM | 8h | react-window |
| Stepper/Wizard | MEDIUM | 6h | - |

### P1.2 Add AI-Specific Components 🤖

| Component | Priority | Effort | Dependencies |
|-----------|----------|--------|--------------|
| TokenCounter | HIGH | 4h | js-tiktoken |
| CostEstimator | HIGH | 6h | - |
| MessageActions | HIGH | 4h | - |
| PromptTemplate | MEDIUM | 8h | - |
| StreamingIndicator | MEDIUM | 4h | - |
| ConversationBranch | MEDIUM | 8h | - |

### P1.3 Consolidate Browser Capsule 🧭

**Problem:** 4 versions of BrowserCapsule exist

**Solution:**
1. Audit all BrowserCapsule usages
2. Migrate all to BrowserCapsuleEnhanced
3. Delete other versions
4. Rename BrowserCapsuleEnhanced → BrowserCapsule

| Step | Effort | Risk |
|------|--------|------|
| Usage audit | 2h | Low |
| Migration | 8h | Medium |
| Testing | 4h | Medium |
| Cleanup | 2h | Low |

### P1.4 Improve Accessibility ♿

| Component | Issue | Fix | Effort |
|-----------|-------|-----|--------|
| IconButton | Missing aria-label | Add aria-label prop | 1h |
| GlassCard | Contrast ratios | Adjust tokens | 4h |
| StatusBar | No live region | Add aria-live | 1h |
| All inputs | Focus indicators | Standardize styles | 4h |

### P1.5 Address Production TODOs 🔧

| File | TODO | Solution | Effort |
|------|------|----------|--------|
| lib/blob.ts | S3 upload | Implement S3 client | 8h |
| lib/blob.ts | Blob deletion | Add delete endpoint | 4h |
| workspace/MemoryEditor | Persist to backend | Add API integration | 6h |

---

## P2: MEDIUM (Do This Quarter)

### P2.1 Test Coverage Expansion 🧪

**Current:** 5% coverage  
**Target:** 50% coverage

| Category | Current | Target | Effort |
|----------|---------|--------|--------|
| UI Components | 0% | 80% | 40h |
| AI Elements | 0% | 60% | 60h |
| Design System | 0% | 70% | 20h |
| Views | 3% | 40% | 80h |
| Hooks | 20% | 70% | 20h |
| Utils | 30% | 70% | 30h |

### P2.2 Standardize APIs 📐

| Standard | Current State | Target | Effort |
|----------|---------------|--------|--------|
| Naming conventions | Mixed | Standardized | 16h |
| Export patterns | Mixed | Named exports | 8h |
| Prop naming | Inconsistent | Standardized | 12h |
| File naming | Mixed | PascalCase for components | 4h |

**Standards to Adopt:**
```typescript
// Component naming
export interface ButtonProps { }
export function Button(props: ButtonProps) { }

// Hook naming  
export function useFeature() { }

// Event handlers
onClick, onChange, onSubmit (not onTap, handleClick)

// Boolean props
isActive, isDisabled, isLoading (not active, disabled, loading)
```

### P2.3 Performance Optimization ⚡

| Component | Issue | Solution | Effort |
|-----------|-------|----------|--------|
| Message list | No virtualization | react-window | 8h |
| FileTree | No lazy loading | Virtual scrolling | 6h |
| Chat history | No pagination | Infinite scroll | 8h |
| CodeBlock | Re-renders | Memoization | 4h |

### P2.4 Documentation 📚

| Document | Priority | Effort |
|----------|----------|--------|
| Component API docs | High | 40h |
| Design tokens guide | High | 16h |
| Theming documentation | Medium | 12h |
| Hook usage examples | Medium | 16h |
| Migration guides | Low | 8h |

### P2.5 Capsule Service Hardening 🏗️

| Service | Current | Target | Effort |
|---------|---------|--------|--------|
| receiptService.ts | In-memory | Persistent storage | 16h |
| auditTrailService.ts | In-memory | Persistent storage | 16h |
| policyService.ts | In-memory | Persistent storage | 12h |
| observabilityService.ts | Console | Backend integration | 24h |

---

## P3: LOW (Backlog)

### P3.1 Experimental Components 🧪

| Component | Use Case | Effort | Status |
|-----------|----------|--------|--------|
| RichTextEditor | Advanced editing | 24h | Research |
| TreeView | Hierarchical data | 16h | Design |
| MasonryGrid | Gallery layout | 8h | Low need |
| ColorPicker | Theme customization | 8h | Low need |

### P3.2 Developer Experience 👨‍💻

| Improvement | Effort | Impact |
|-------------|--------|--------|
| Storybook for all components | 40h | High |
| Visual regression testing | 24h | High |
| Component usage analytics | 16h | Medium |
| Automated migration scripts | 24h | Medium |

### P3.3 Advanced Features 🚀

| Feature | Effort | Dependencies |
|---------|--------|--------------|
| Real-time collaboration | 80h | WebRTC/Yjs |
| Offline mode | 60h | Service workers |
| Mobile-responsive shell | 40h | Design system |
| Keyboard shortcuts system | 24h | - |

---

## Sprint Planning

### Sprint 1 (Week 1): Cleanup
```
- [P0] Delete duplicate components
- [P0] Fix type safety issues
- [P0] Fix ShellApp.tsx auth TODO
- [P0] Add Button + Input tests
```

### Sprint 2 (Week 2): Security & Core
```
- [P0] Fix all auth-related TODOs
- [P0] Add Message + PromptInput tests
- [P1] Implement FileUpload component
- [P1] Add IconButton accessibility
```

### Sprint 3 (Week 3): Components
```
- [P1] Implement AutoComplete component
- [P1] Implement TokenCounter component
- [P1] Add CostEstimator component
- [P2] Expand test coverage to 20%
```

### Sprint 4 (Week 4): Consolidation
```
- [P1] Consolidate BrowserCapsule variants
- [P1] Implement DataGrid component
- [P1] Add MessageActions component
- [P2] Standardize API naming
```

---

## Resource Allocation

### Recommended Team Structure

```
Component Platform Team (4-6 engineers)
├── Design System Lead (1)
│   └── Design tokens, theming, GlassCard/GlassSurface
├── UI Components Lead (1-2)
│   └── Base UI, accessibility, testing
├── AI/Chat Components (1-2)
│   └── ai-elements, messaging, streaming
├── Platform/DevEx (1)
│   └── Testing, documentation, CI/CD
└── Integration (1)
    └── Capsules, shell, views
```

### Effort Summary by Priority

| Priority | Total Effort | Timeline |
|----------|--------------|----------|
| P0 - Critical | 40 hours | Week 1 |
| P1 - High | 160 hours | Month 1 |
| P2 - Medium | 400 hours | Quarter |
| P3 - Low | 300 hours | Backlog |

---

## Success Metrics

### Short Term (Month 1)
- [ ] 0 security TODOs remaining
- [ ] 0 duplicate components
- [ ] 100% TypeScript strict mode compliance
- [ ] 20% test coverage

### Medium Term (Quarter)
- [ ] 50% test coverage
- [ ] 100% of P1 components implemented
- [ ] All components have basic a11y
- [ ] API naming standardized

### Long Term (Year)
- [ ] 80% test coverage
- [ ] Complete design system documentation
- [ ] WCAG 2.1 AA compliance
- [ ] <100ms component render time (p95)

---

## Dependencies & Blockers

### External Dependencies

| Dependency | Required For | ETA |
|------------|--------------|-----|
| Auth system completion | P0 auth TODOs | Blocked |
| 8-cloud API | Capsule services | Q2 |
| Persistent storage backend | Capsule services | Q1 |
| S3 bucket setup | Blob storage | Q1 |

### Internal Dependencies

| Task | Depends On | Impact |
|------|------------|--------|
| Delete prompt-kit | Verify ai-elements parity | P0 cleanup |
| BrowserCapsule consolidation | Usage audit | P1 consolidation |
| Test expansion | Test infrastructure | P2 testing |

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Breaking changes from cleanup | Medium | High | Feature flags, gradual rollout |
| Auth delays | High | Critical | Implement temporary auth |
| Resource constraints | Medium | High | Prioritize P0, defer P2/P3 |
| Scope creep | High | Medium | Strict sprint boundaries |

---

## Appendix: Quick Reference

### Component Status Legend

| Status | Color | Description |
|--------|-------|-------------|
| complete | 🟢 | Production-ready |
| polish-needed | 🟡 | Works but needs improvements |
| partial | 🟠 | Some features stubbed |
| deprecated | 🔴 | Should be removed |
| duplicate | ⚪ | Redundant implementation |

### Priority Quick Links

- **P0 Items:** Security, duplicates, critical tests
- **P1 Items:** Missing components, type safety, a11y
- **P2 Items:** Testing, docs, performance, standardization
- **P3 Items:** Experimental, nice-to-have, backlog

---

**Document Owner:** Component Platform Team  
**Review Schedule:** Weekly  
**Last Updated:** 2026-02-24
