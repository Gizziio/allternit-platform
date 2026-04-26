# DAG Tasks Index

**Project:** allternit - Gap Implementation  
**Total Work:** 17 weeks (HIGH: 10 weeks, MEDIUM: 7 weeks)  
**Last Updated:** 2026-02-23

---

## 📚 Documentation Structure

```
docs/_active/
├── DAG_TASKS_INDEX.md                    (this file - master index)
├── STRUCTURED_DAG_TASKS.md               (complete task breakdown)
├── COMPREHENSIVE_BRAINSTORM_GAP_ANALYSIS.md (gap analysis source)
│
├── HIGH PRIORITY (10 weeks):
├── P3.9_MCP_APPS_TASKS.md               (3 weeks)
├── P3.10_CHROME_EXTENSION_TASKS.md      (4 weeks)
├── P3.12_BROWSER_TOOLS_TASKS.md         (3 weeks)
│
└── MEDIUM PRIORITY (7 weeks):
    ├── P3.11_AVATAR_ENGINE_TASKS.md     (2 weeks)
    ├── P3.13_JSON_RENDER_TASKS.md       (3 weeks)
    └── P3.14_FORM_SURFACES_TASKS.md     (2 weeks)
```

---

## 🎯 Quick Reference

### Already Implemented (0 weeks)

| Task | Location | Status |
|------|----------|--------|
| **P4.7: Evolution Layer** | `domains/kernel/infrastructure/evolution-layer/` | ✅ DONE |
| **P4.8: Context Control** | `domains/kernel/control-plane/context-control/` | ✅ DONE |

### HIGH Priority (Start Here)

| Task | Effort | File | Dependencies |
|------|--------|------|--------------|
| **P3.9: MCP Apps** | 3w | [P3.9_MCP_APPS_TASKS.md](./P3.9_MCP_APPS_TASKS.md) | None |
| **P3.10: Chrome Extension** | 4w | [P3.10_CHROME_EXTENSION_TASKS.md](./P3.10_CHROME_EXTENSION_TASKS.md) | P3.12 (partial) |
| **P3.12: Browser Tools** | 3w | [P3.12_BROWSER_TOOLS_TASKS.md](./P3.12_BROWSER_TOOLS_TASKS.md) | None |

**Phase 1 Total: 10 weeks**

### MEDIUM Priority (Next)

| Task | Effort | File | Dependencies |
|------|--------|------|--------------|
| **P3.11: Avatar Engine** | 2w | [P3.11_AVATAR_ENGINE_TASKS.md](./P3.11_AVATAR_ENGINE_TASKS.md) | None |
| **P3.14: Form Surfaces** | 2w | [P3.14_FORM_SURFACES_TASKS.md](./P3.14_FORM_SURFACES_TASKS.md) | None |
| **P3.13: JSON Render** | 3w | [P3.13_JSON_RENDER_TASKS.md](./P3.13_JSON_RENDER_TASKS.md) | None |

**Phase 2 Total: 7 weeks**

---

## 🗓️ Implementation Roadmap

### Recommended Sprint Schedule

| Sprint | Weeks | Tasks | Goal |
|--------|-------|-------|------|
| 1 | 1-2 | P3.9.1-3, P3.12.1-3 | Foundation: Protocols & Tools |
| 2 | 3-4 | P3.9.4-6, P3.12.4-6 | UI Integration & Safety |
| 3 | 5-6 | P3.10.1-3, P3.9.7-9 | Extension Foundation |
| 4 | 7-8 | P3.10.4-6, P3.12.7-9 | Tools & Browser Integration |
| 5 | 9-10 | P3.10.7-12 | Safety, Receipts & Polish |
| 6 | 11-12 | P3.11.1-6, P3.14.1-3 | Avatar & Forms Core |
| 7 | 13-14 | P3.14.4-7, P3.13.1-3 | Forms & UGI Core |
| 8 | 15-17 | P3.13.4-9 | UGI Runtime & Testing |

---

## 🔗 Cross-Task Dependencies

```
P3.9 MCP Apps
    └── P3.9.5 (UI Pipeline)
        └── Can use P3.12 event stream

P3.10 Chrome Extension
    ├── Requires: P3.12 (browser_control tools)
    └── Can host: P3.9 (interactive capsules)

P3.12 Browser Tools
    ├── Feeds into: P3.10 (extension)
    └── Can emit: P3.9 (capsules for complex UIs)

P3.14 Form Surfaces
    └── Can use: P3.9 (capsules for custom field types)

P3.13 JSON Render
    └── Can use: P3.9 (capsule runtime for IX)
```

---

## ✅ Getting Started Checklist

### Pre-Flight (Before Sprint 1)
- [ ] Review all HIGH priority task files
- [ ] Set up development environment
- [ ] Create feature branches
- [ ] Set up tracking board (GitHub Projects/Linear)

### Sprint 1 (Foundation)
- [ ] **P3.9.1**: Define MCP Apps Protocol
- [ ] **P3.9.2**: Runtime Bridge API
- [ ] **P3.9.3**: Capsule Registry
- [ ] **P3.12.1**: Browser Control Tool Family
- [ ] **P3.12.2**: Playwright Integration
- [ ] **P3.12.3**: Unified Event Stream

### Daily Standup Questions
1. What subtask did you complete yesterday?
2. What subtask are you working on today?
3. Any blockers or dependencies?

---

## 📊 Progress Tracking

Use this template to track progress:

```markdown
## Week X: [Date Range]

### Completed
- [ ] P3.9.X: [Subtask name]
- [ ] P3.12.X: [Subtask name]

### In Progress
- [ ] P3.9.X: [Subtask name] (50%)

### Blocked
- [ ] P3.9.X: [Subtask name] - [Reason]

### Notes
- [Any observations, learnings, or issues]
```

---

## 🎯 Success Criteria

### Phase 1 Complete When:
- [ ] MCP Apps: Interactive capsules render sandboxed UI
- [ ] Browser Tools: All browser_control tools functional
- [ ] Chrome Extension: BROWSER.* tools work via extension
- [ ] All HIGH priority tasks tested and documented

### Phase 2 Complete When:
- [ ] Avatar Engine: Agent avatars show mood/state
- [ ] Form Surfaces: Project spec intake form works
- [ ] JSON Render: Allternit-IX renders declarative UI
- [ ] All MEDIUM priority tasks tested and documented

---

## 🆘 Support Resources

- **Gap Analysis**: [COMPREHENSIVE_BRAINSTORM_GAP_ANALYSIS.md](./COMPREHENSIVE_BRAINSTORM_GAP_ANALYSIS.md)
- **Brainstorm Files**: `~/Desktop/allternit brainstorm session files/`
- **Existing Implementation**:
  - Evolution Layer: `domains/kernel/infrastructure/evolution-layer/`
  - Context Control: `domains/kernel/control-plane/context-control/`
  - CDP Bridge: `packages/allternit-browser/src/cdp-bridge.ts`

---

**Ready to start! Pick a HIGH priority task and begin with Week 1 subtasks.**
