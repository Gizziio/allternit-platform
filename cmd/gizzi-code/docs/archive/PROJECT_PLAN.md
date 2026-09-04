# Claude + Gizzi Integration Project Plan

## Project Overview
**Goal:** Successfully integrate Claude Code source with Gizzi runtime, resulting in a buildable, production-quality codebase.

**Current State:** 15,759 TypeScript errors across ~500+ files
**Target State:** 0 errors, successful build

## Phase Structure

### Phase 1: Infrastructure & Tooling (Week 1)
**Goal:** Establish solid foundation for all subsequent work

| Task | Owner | Duration | Deliverable |
|------|-------|----------|-------------|
| 1.1 Finalize tsconfig.json | Dev | 2h | Working path aliases, correct module resolution |
| 1.2 Set up dependency audit | Dev | 4h | Document all missing npm packages |
| 1.3 Create file inventory | Dev | 4h | Complete list of files to create/fix |
| 1.4 Set up testing harness | Dev | 4h | Basic build verification script |

**Milestone 1:** Build system works, can compile individual files
**Exit Criteria:** `bun tsc --noEmit` runs without configuration errors

---

### Phase 2: Core Runtime Layer (Week 1-2)
**Goal:** All files in `src/runtime/` compile successfully

**2.1 Utility Layer (Day 1-2)**
- Files: `util/log.ts`, `util/filesystem.ts`, `util/signal.ts`, `util/lazy.ts`
- Dependencies: None
- Impact: ~300 errors

**2.2 Context Layer (Day 3-4)**
- Files: `context/project/instance.ts`, `context/project/bootstrap.ts`
- Files: `context/global/global.ts`, `context/config/config.ts`
- Dependencies: Utility layer
- Impact: ~500 errors

**2.3 Bus System (Day 5)**
- Files: `bus/bus.ts`, `bus/bus-event.ts`, `bus/global.ts`
- Dependencies: Context layer
- Impact: ~150 errors

**2.4 Services Layer (Day 6-7)**
- Files: `services/analytics/index.ts`, `services/analytics/growthbook.ts`
- Files: `services/tokenEstimation.ts`, `services/policyLimits/index.ts`
- Dependencies: Bus system, Context layer
- Impact: ~400 errors

**Milestone 2:** Runtime layer compiles independently
**Exit Criteria:** `bun tsc src/runtime/**/*.ts --noEmit` passes

---

### Phase 3: Tool Infrastructure (Week 2)
**Goal:** Tool system and built-in tools compile

**3.1 Tool Framework (Day 1-2)**
- Files: `src/Tool.ts`, `runtime/tools/Tool.ts`
- Files: `runtime/tools/builtins/tool.ts`, `runtime/tools/builtins/skill.ts`
- Dependencies: Runtime layer
- Impact: ~600 errors

**3.2 Built-in Tools (Day 3-5)**
- Files: `FileReadTool/`, `FileWriteTool/`, `FileEditTool/`
- Files: `BashTool/`, `GlobTool/`, `GrepTool/`
- Files: `AgentTool/`, `TaskTool/`
- Dependencies: Tool framework
- Impact: ~1,200 errors

**Milestone 3:** Tool system compiles
**Exit Criteria:** All files in `src/runtime/tools/` compile

---

### Phase 4: CLI Foundation (Week 3)
**Goal:** CLI infrastructure compiles

**4.1 CLI Utilities (Day 1-2)**
- Files: `cli/utils/log.ts`, `cli/utils/debug.ts`, `cli/utils/errors.tsx`
- Files: `cli/utils/auth.ts`, `cli/utils/format.ts`
- Dependencies: Runtime layer
- Impact: ~400 errors

**4.2 Command Registry (Day 3)**
- Files: `src/commands.ts`, `cli/commands/cmd.ts`
- Dependencies: CLI utilities
- Impact: ~200 errors

**4.3 UI Components (Day 4-5)**
- Files: `src/ink.ts`, `cli/ui/tui/context/theme.ts`
- Files: `cli/ui/tui/ui/dialog.tsx`, `cli/ui/tui/context/sync.ts`
- Dependencies: Command registry
- Impact: ~800 errors

**Milestone 4:** CLI layer compiles independently
**Exit Criteria:** `bun tsc src/cli/**/*.ts --noEmit` passes

---

### Phase 5: Commands (Week 4)
**Goal:** All CLI commands compile

**5.1 Core Commands (Day 1-3)**
- Files: `commands/init.ts`, `commands/login/index.ts`, `commands/logout/index.ts`
- Files: `commands/memory/index.ts`, `commands/skills/index.ts`
- Dependencies: CLI foundation
- Impact: ~600 errors

**5.2 Feature Commands (Day 4-5)**
- Files: `commands/status/index.ts`, `commands/theme/index.ts`, `commands/vim/index.ts`
- Files: `commands/tasks/index.ts`, `commands/session/index.ts`
- Dependencies: Core commands
- Impact: ~500 errors

**Milestone 5:** All commands compile
**Exit Criteria:** All files in `src/cli/commands/` compile

---

### Phase 6: Shared & Types (Week 4-5)
**Goal:** All shared utilities and type definitions compile

**6.1 Shared Utils (Day 1-3)**
- Files: `shared/utils/*.ts` (50+ files)
- Dependencies: Runtime layer
- Impact: ~1,500 errors

**6.2 Type Definitions (Day 4-5)**
- Files: `types/*.ts`, `types/merged/*.ts`
- Dependencies: Shared utils
- Impact: ~800 errors

**Milestone 6:** Shared layer compiles
**Exit Criteria:** All files in `src/shared/` and `src/types/` compile

---

### Phase 7: Integration & Testing (Week 5)
**Goal:** Full build succeeds, integration tests pass

**7.1 Integration Fixes (Day 1-3)**
- Fix remaining cross-module issues
- Resolve circular dependencies
- Fix type mismatches
- Impact: ~2,000 errors

**7.2 Testing (Day 4-5)**
- Run full build: `bun run build`
- Run type check: `bun tsc --noEmit`
- Fix any remaining issues

**Milestone 7:** Project builds successfully
**Exit Criteria:** `bun tsc --noEmit` returns 0 errors

---

## Timeline Summary

| Phase | Week | Focus | Error Reduction |
|-------|------|-------|-----------------|
| 1 | 1 | Infrastructure | Setup |
| 2 | 1-2 | Core Runtime | ~1,500 errors |
| 3 | 2 | Tool System | ~1,800 errors |
| 4 | 3 | CLI Foundation | ~1,400 errors |
| 5 | 4 | Commands | ~1,100 errors |
| 6 | 4-5 | Shared & Types | ~2,300 errors |
| 7 | 5 | Integration | ~2,000 errors |
| **Total** | **5 weeks** | **Full Build** | **~10,100 errors** |

**Note:** Estimated remaining after Phase 7: ~5,000 complex errors requiring manual review

---

## Work Structure

### Daily Workflow
1. **Morning (1h):** Review previous day's work, check error count
2. **Development (6h):** Work on assigned files for current phase
3. **Evening (1h):** Test, document, commit changes

### File Creation Standards
Every file must have:
1. JSDoc header explaining purpose
2. Proper TypeScript types (no `any` unless necessary)
3. All exports that importers expect
4. Default export for compatibility
5. Error handling where appropriate

### Testing Checkpoints
- After every 5 files: Run type check
- After each day: Document error count reduction
- After each phase: Full build attempt

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Underestimated complexity | High | Buffer time in Phase 7, weekly reviews |
| Missing dependencies | Medium | Dependency audit in Phase 1 |
| Circular dependencies | Medium | Detect and break early |
| Type mismatches | High | Strict typing from start |
| Scope creep | High | Stick to phase deliverables |

---

## Success Metrics

| Metric | Current | Week 1 | Week 2 | Week 3 | Week 4 | Week 5 |
|--------|---------|--------|--------|--------|--------|--------|
| Errors | 15,759 | 14,000 | 11,000 | 8,000 | 5,000 | 0 |
| Files Created | 0 | 10 | 35 | 60 | 80 | 100+ |
| Phases Complete | 0 | 1-2 | 3 | 4 | 5-6 | 7 |

---

## Immediate Next Steps

### Today (Day 0)
- [ ] Review and approve this plan
- [ ] Set up tracking spreadsheet
- [ ] Create Phase 1 branch

### Tomorrow (Day 1) - Phase 1 Start
- [ ] Finalize tsconfig.json
- [ ] Run dependency audit
- [ ] Create file inventory

## Approval

This plan requires approval before proceeding. Please review and confirm:
1. Timeline is acceptable (5 weeks)
2. Phase structure makes sense
3. Daily workflow is realistic
4. Success metrics are appropriate

Once approved, we begin Phase 1.
