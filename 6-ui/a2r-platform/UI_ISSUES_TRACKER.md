# A2R Platform UI Issues Tracker

**Last Updated:** 2026-02-24
**Status:** In Progress

---

## Issue Priority Legend

- 🔴 **P0 - Critical**: App crashes, data loss, security issues
- 🟠 **P1 - High**: Major feature broken, significant UX issues
- 🟡 **P2 - Medium**: Minor bugs, visual glitches, performance issues
- 🟢 **P3 - Low**: Nice to have, polish, enhancements

---

## Known Issues (Pre-Audit)

### From ERRORS_FIXED.md

#### TypeScript Errors (163 remaining)

1. **AI Elements Components Type Errors**
   - **Status:** ⚠️ Non-blocking
   - **Files:** 
     - `components/ai-elements/prompt-input.tsx` (8 errors)
     - `components/ai-elements/audio-player.tsx` (6 errors)
     - `components/ai-elements/voice-selector.tsx` (7 errors)
     - `components/ai-elements/message.tsx` (2 errors)
     - `components/ai-elements/code-block.tsx` (1 error)
     - `components/ai-elements/eval-agent.ts` (14 errors)
   - **Issue:** Button props mismatch, Slider/Toggle props, Icon issues
   - **Impact:** Type checking fails, but UI still renders
   - **Fix:** Install full AI SDK or add type ignores

2. **Missing UI Exports**
   - **Status:** ✅ Partially Fixed
   - **Files:** `components/ui/card.tsx`, `components/ui/input-group.tsx`
   - **Issue:** Missing component exports (CardAction, InputGroup variants)
   - **Impact:** Import errors in some files

---

### From SHELL_UI_FIXES.md

#### Rendering Issues (Fixed)

1. **Error Boundary Missing**
   - **Status:** ✅ Fixed
   - **File:** `src/components/error-boundary.tsx` (new)
   - **Issue:** UI crashes without graceful error display

2. **ChatView Error Handling**
   - **Status:** ✅ Fixed
   - **File:** `src/views/ChatView.tsx`
   - **Issue:** No error state display, null checks missing

3. **Markdown Styling**
   - **Status:** ✅ Fixed
   - **File:** `src/components/ui/markdown.tsx`
   - **Issue:** prose classes not working without typography plugin

---

## Issues to Investigate (Audit Required)

### Shell Layout

| ID | Issue | Priority | Status | Component |
|----|-------|----------|--------|-----------|
| SL-001 | [To be filled by audit] | 🔴 | ⏳ Pending | ShellFrame |
| SL-002 | [To be filled by audit] | 🟠 | ⏳ Pending | ShellRail |
| SL-003 | [To be filled by audit] | 🟡 | ⏳ Pending | ShellCanvas |

### Chat View

| ID | Issue | Priority | Status | Component |
|----|-------|----------|--------|-----------|
| CH-001 | [To be filled by audit] | 🔴 | ⏳ Pending | ChatView |
| CH-002 | [To be filled by audit] | 🟠 | ⏳ Pending | Conversation |
| CH-003 | [To be filled by audit] | 🟡 | ⏳ Pending | PromptInput |
| CH-004 | AI Elements type errors | 🟡 | ⏳ Open | Multiple |

### Workspace View

| ID | Issue | Priority | Status | Component |
|----|-------|----------|--------|-----------|
| WS-001 | [To be filled by audit] | 🔴 | ⏳ Pending | CoworkView |
| WS-002 | [To be filled by audit] | 🟠 | ⏳ Pending | CoworkRoot |

### Code View

| ID | Issue | Priority | Status | Component |
|----|-------|----------|--------|-----------|
| CD-001 | [To be filled by audit] | 🔴 | ⏳ Pending | CodeRoot |
| CD-002 | [To be filled by audit] | 🟠 | ⏳ Pending | ConsoleDrawer |

### Agent System View

| ID | Issue | Priority | Status | Component |
|----|-------|----------|--------|-----------|
| AS-001 | [To be filled by audit] | 🔴 | ⏳ Pending | AgentSystemView |
| AS-002 | [To be filled by audit] | 🟠 | ⏳ Pending | UnifiedStore |
| AS-003 | [To be filled by audit] | 🟡 | ⏳ Pending | TabBar |

### Console Drawer

| ID | Issue | Priority | Status | Component |
|----|-------|----------|--------|-----------|
| DR-001 | [To be filled by audit] | 🔴 | ⏳ Pending | DrawerRoot |
| DR-002 | [To be filled by audit] | 🟠 | ⏳ Pending | DrawerTabs |

### Performance

| ID | Issue | Priority | Status | Component |
|----|-------|----------|--------|-----------|
| PF-001 | [To be measured] | 🔴 | ⏳ Pending | All |
| PF-002 | [To be measured] | 🟠 | ⏳ Pending | All |

### Accessibility

| ID | Issue | Priority | Status | Component |
|----|-------|----------|--------|-----------|
| AX-001 | [To be audited] | 🟠 | ⏳ Pending | All |
| AX-002 | [To be audited] | 🟡 | ⏳ Pending | All |

---

## Issue Template

```markdown
### [ISSUE-ID] Issue Title

**Priority:** P0/P1/P2/P3
**Status:** Open/In Progress/Fixed/Wont Fix
**Component:** [Component name]
**File:** `path/to/file.tsx`

#### Description
[Clear description of the issue]

#### Steps to Reproduce
1. 
2. 
3. 

#### Expected Behavior
[What should happen]

#### Actual Behavior
[What actually happens]

#### Screenshots/Logs
[Attach if available]

#### Proposed Fix
[If known]

#### Related Issues
[Links to related issues]
```

---

## Action Items

### Immediate (This Session)

1. [ ] Run UI audit with Playwright
2. [ ] Document all rendering issues
3. [ ] Capture screenshots of issues
4. [ ] Categorize by priority
5. [ ] Create fix plan

### Short Term

1. [ ] Fix P0 critical issues
2. [ ] Fix P1 high priority issues
3. [ ] Address TypeScript errors
4. [ ] Improve error boundaries

### Medium Term

1. [ ] Fix P2 medium priority issues
2. [ ] Optimize performance
3. [ ] Improve accessibility
4. [ ] Add comprehensive tests

---

## Testing Checklist

### Manual Testing

- [ ] Shell layout renders correctly
- [ ] Navigation rail works
- [ ] Chat view functional
- [ ] Workspace view functional
- [ ] Code view functional
- [ ] Agent system view functional
- [ ] Console drawer works
- [ ] All tabs switch correctly
- [ ] No console errors
- [ ] Responsive on mobile/tablet

### Automated Testing

- [ ] Playwright tests pass
- [ ] No visual regressions
- [ ] Performance within targets
- [ ] Accessibility checks pass
- [ ] TypeScript compiles

---

**Notes:**
- Add new issues as they're discovered during audit
- Update status as issues are fixed
- Reference screenshots in `./test-results/screenshots/`
