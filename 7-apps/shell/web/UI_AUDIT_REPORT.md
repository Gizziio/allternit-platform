# A2rchitect Shell UI - Comprehensive Audit Report

**Date:** February 24, 2026  
**Audit Tool:** Automated Playwright Browser Testing  
**Views Tested:** 6 core views (Home, Chat, Elements Lab, Browser, Agent Studio, Native Agent)  
**Total Issues Found:** 46

---

## Executive Summary

The automated UI audit revealed **46 issues** across the tested views:

| Severity | Count | Percentage |
|----------|-------|------------|
| 🔴 Critical | 5 | 11% |
| 🟠 High | 1 | 2% |
| 🟡 Medium | 33 | 72% |
| 🟢 Low | 7 | 15% |

### Key Findings

1. **Navigation System Broken** - 26 rail items not found (missing navigation links)
2. **Error Boundaries Triggered** - Elements Lab showing error dialogs
3. **API Connection Failures** - Backend services not running (ERR_CONNECTION_REFUSED)
4. **Overlapping Elements** - Layout/Z-index issues across all views
5. **Accessibility Issues** - Small text (< 12px) on buttons

---

## Critical Issues (Must Fix Before Release)

### 1. 🔴 Error Boundary Triggered in Elements Lab
**Severity:** Critical  
**View:** Elements Lab  
**Impact:** Users see error dialogs, broken UX

**Issue:**
```
Error boundary triggered: "Confirm this action?This will execute the toolCancelConfirm"
```

**Root Cause:**  
The `Transcription` component in `ElementsLab.tsx` is rendering a confirmation dialog without proper isolation. The error boundary is catching this as an unexpected render state.

**Files Involved:**
- `/6-ui/a2r-platform/src/views/ElementsLab.tsx` (line 256)
- `/6-ui/a2r-platform/src/components/ai-elements/transcription.tsx`

**Fix Required:**
```tsx
// In transcription.tsx - TranscriptionSegment needs unique key
{segments
  .filter((segment) => segment.text.trim())
  .map((segment, index) => (
    <TranscriptionSegment 
      key={segment.startSecond || index}  // ADD UNIQUE KEY
      segment={segment} 
      index={index} 
    />
  ))}
```

**React Warning Found:**
```
Warning: Each child in a list should have a unique "key" prop.
Check the render method of `Transcription`.
```

---

### 2. 🔴 Page Errors - Failed to Fetch (4 occurrences)
**Severity:** Critical  
**View:** Global (affects all views)  
**Impact:** API calls failing, data not loading

**Issue:**
```
Page Error: Failed to fetch
Console Error: Failed to load resource: net::ERR_CONNECTION_REFUSED
```

**Root Cause:**  
Backend services (Gateway on port 8013, API on port 3000) are not running. The UI is trying to connect to:
- `http://127.0.0.1:8013` (Gateway)
- `http://127.0.0.1:3000` (API)
- EventSource connections for SessionBridge

**Files Involved:**
- `/6-ui/a2r-platform/src/integration/session-bridge.ts`
- `/7-apps/shell/web/.env.development`

**Fix Required:**
1. Start backend services before running UI
2. Add graceful error handling for offline mode
3. Show user-friendly "connecting" states instead of console errors

---

### 3. 🔴 Rive App Runtime Error
**Severity:** Critical  
**View:** Chat, Elements Lab  
**Impact:** Rive animations broken, console spam

**Issue:**
```
TypeError: Cannot read properties of null (reading 'T')
    at z (@rive-app/react-webgl2.js:295:38)
    at l.makeRenderer (@rive-app/react-webgl2.js:303:29)
```

**Root Cause:**  
Rive WebGL context initialization failing, likely due to missing canvas reference or WebGL not available.

**Files Involved:**
- `/6-ui/a2r-platform/src/components/ai-elements/` (Rive-based components)

**Fix Required:**
1. Add null checks before accessing Rive renderer
2. Fallback to non-WebGL mode
3. Lazy load Rive components only when needed

---

### 4. 🔴 Broken Images
**Severity:** Critical  
**View:** Elements Lab  
**Impact:** Visual brokenness, poor UX

**Issue:**
```
Broken images: http://127.0.0.1:5177/#
```

**Root Cause:**  
Image sources pointing to `#` or invalid URLs.

**Fix Required:**
- Replace placeholder `#` with valid image URLs or use SVG icons
- Add error handling for image load failures

---

### 5. 🔴 Navigation Execution Context Destroyed
**Severity:** High  
**View:** Native Agent  
**Impact:** Navigation broken, view not accessible

**Issue:**
```
page.$: Execution context was destroyed, most likely because of a navigation
```

**Root Cause:**  
The Native Agent view causes a full page navigation/reload, destroying the Playwright context. This indicates improper routing.

**Files Involved:**
- `/6-ui/a2r-platform/src/views/NativeAgentView.tsx`

**Fix Required:**
- Ensure view uses client-side routing (React Router) not full page reloads
- Check for `window.location` assignments that should be navigation calls

---

## Medium Issues (Should Fix)

### 6. 🟡 Navigation Items Not Found (26 items)
**Severity:** Medium  
**Impact:** Users cannot access these views from the rail

**Missing Rail Items:**
| View ID | View Name | Expected Location |
|---------|-----------|-------------------|
| `rails` | Agent System | Chat mode rail |
| `registry` | Agent Registry | Chat mode rail |
| `memory` | Memory | Chat mode rail |
| `ivkge` | IVKGE | AI & Vision section |
| `multimodal` | Multimodal | AI & Vision section |
| `tambo` | Tambo UI Gen | AI & Vision section |
| `swarm` | Swarm Monitor | DAG Infrastructure |
| `policy` | Policy Manager | DAG Infrastructure |
| `task-executor` | Task Executor | DAG Infrastructure |
| `ontology` | Ontology Viewer | DAG Infrastructure |
| `directive` | Directive Compiler | DAG Infrastructure |
| `evaluation` | Evaluation | DAG Infrastructure |
| `gc-agents` | GC Agents | DAG Infrastructure |
| `receipts` | Receipts | Security & Governance |
| `policy-gating` | Policy Gating | Security & Governance |
| `security` | Security | Security & Governance |
| `purpose` | Purpose Binding | Security & Governance |
| `browserview` | Browser View | Execution |
| `dag-wih` | DAG WIH | Execution |
| `checkpointing` | Checkpointing | Execution |
| `observability` | Observability | Observability |
| `studio` | Studio | Services |
| `marketplace` | Marketplace | Services |
| `openclaw` | OpenClaw Control | Services |
| `dag` | DAG Integration | Services |

**Root Cause:**  
The `RAIL_CONFIG` in `/6-ui/a2r-platform/src/shell/rail/rail.config.ts` defines these items, but the audit script couldn't find them by text matching. This could be because:
1. Items are in collapsed sections
2. Items require mode switching to appear
3. Items are conditionally rendered

**Fix Required:**
- Verify all rail items are visible and clickable
- Add data attributes for automated testing: `data-rail-item="rails"`
- Document which mode each item appears in

---

### 7. 🟡 Overlapping Elements (Detected in all views)
**Severity:** Medium  
**Impact:** Visual glitches, click-through issues

**Issue:**
```
Overlapping elements detected: HTML/BODY/DIV overlaps
```

**Root Cause:**  
Z-index conflicts or absolute positioning without proper stacking context.

**Files Involved:**
- `/6-ui/a2r-platform/src/design/GlassSurface.tsx`
- `/6-ui/a2r-platform/src/shell/ShellFrame.tsx`
- `/6-ui/a2r-platform/src/shell/ShellCanvas.tsx`

**Fix Required:**
1. Audit all `position: absolute` and `position: fixed` elements
2. Establish clear z-index hierarchy
3. Use `z-index` CSS variable system

---

### 8. 🟡 Unstyled Content (FOUC - Flash of Unstyled Content)
**Severity:** Medium  
**View:** Elements Lab  
**Impact:** Poor perceived performance

**Issue:**
```
6 elements with display:none (possible FOUC)
```

**Root Cause:**  
Content hidden with `display:none` during initial render, then shown after JavaScript loads.

**Fix Required:**
- Use React Suspense boundaries with proper loading states
- Avoid `display:none` for initial hidden states
- Use CSS animations for progressive disclosure

---

### 9. 🟡 Browser WebView Attribute Warning
**Severity:** Medium  
**View:** Browser  
**Impact:** Console warnings, potential security issue

**Issue:**
```
Warning: Received `true` for a non-boolean attribute `allowpopups`.
If you want to write it to the DOM, pass a string instead: allowpopups="true"
```

**Files Involved:**
- `/6-ui/a2r-platform/src/capsules/browser/BrowserCapsule.tsx` (line 383)

**Fix Required:**
```tsx
// Change from:
<webview allowpopups={true} />

// To:
<webview allowpopups="true" />
```

---

## Low Issues (Nice to Fix)

### 10. 🟢 Accessibility - Small Text
**Severity:** Low  
**Impact:** WCAG violation, poor readability

**Issue:**
```
Small text (< 12px) found in: BUTTON
```

**Files Involved:**
- Multiple button components across the app

**Fix Required:**
- Ensure all button text is at least 12px (14px recommended)
- Update design system tokens

---

### 11. 🟢 Text Overflow
**Severity:** Low  
**View:** Elements Lab  
**Impact:** Truncated text, poor UX

**Issue:**
```
Text overflow detected in: DIV
```

**Fix Required:**
- Add `text-overflow: ellipsis` with proper width constraints
- Use responsive typography

---

## Component-Specific Analysis

### Home View ✅
**Status:** Mostly working  
**Issues:** 2 (overlapping elements, small text)

**What Works:**
- Quick launch cards render correctly
- Recent sessions list displays
- Glass morphism design applied

**What Needs Work:**
- Z-index cleanup
- Font size audit

---

### Chat View ✅
**Status:** Working with warnings  
**Issues:** 3 (Rive error, overlapping, small text)

**What Works:**
- Chat interface renders
- Message list structure in place

**What Needs Work:**
- Fix Rive runtime initialization
- Add error boundary for Rive components

---

### Elements Lab ⚠️
**Status:** Broken  
**Issues:** 6 (error boundary, broken images, FOUC, overlaps, overflow, accessibility)

**What Works:**
- Component catalog structure
- Category sections render

**What Needs Work:**
- Add unique keys to mapped components
- Isolate error-prone components
- Fix image placeholders
- Add proper loading states

---

### Browser View ⚠️
**Status:** Working with warnings  
**Issues:** 3 (WebView attribute, overlaps, accessibility)

**What Works:**
- Browser capsule structure
- Tab management UI

**What Needs Work:**
- Fix WebView attribute types
- Add proper sandbox attributes

---

### Agent Studio ✅
**Status:** Working  
**Issues:** 2 (overlaps, accessibility)

**What Works:**
- Agent configuration UI
- Character settings panels

**What Needs Work:**
- Minor CSS cleanup

---

### Native Agent ❌
**Status:** Broken  
**Issues:** 1 (navigation crash)

**What Needs Work:**
- Fix routing to prevent full page reloads
- Add proper error handling

---

## Architecture Issues Discovered

### 1. Mode-Based Navigation Confusion
The rail configuration has **three modes** (chat, cowork, code), but it's unclear:
- Which views appear in which mode
- How users switch between modes
- Whether all views are accessible

**Recommendation:**
- Add mode indicator to header
- Document which views belong to which mode
- Consider unified navigation with filtering

### 2. Missing View Type Policy
The `nav.policy.ts` file defines policies for view types, but many views in `RAIL_CONFIG` don't have corresponding policies.

**Files to Check:**
- `/6-ui/a2r-platform/src/nav/nav.policy.ts`
- `/6-ui/a2r-platform/src/nav/nav.types.ts` (ViewType definition)

### 3. Lazy Loading Without Skeleton States
Many views use `React.lazy()` but skeleton loaders may not match content dimensions, causing layout shifts.

**Recommendation:**
- Add view-specific skeleton loaders
- Use `React.Suspense` with custom fallbacks
- Preload views on hover

### 4. No Offline Mode
All API calls fail when backend is unavailable. No graceful degradation.

**Recommendation:**
- Add offline detection
- Cache recent data
- Show "connecting" states
- Queue actions for retry

---

## Recommended Fix Priority

### P0 - Blockers (Fix Immediately)
1. Fix Transcription component key prop
2. Add backend service startup instructions
3. Fix Rive null reference errors
4. Fix Native Agent navigation crash

### P1 - High Priority (Fix This Week)
5. Add proper error handling for API failures
6. Fix WebView attribute types
7. Verify all 26 missing rail items are accessible
8. Add data attributes for automated testing

### P2 - Medium Priority (Fix This Sprint)
9. Resolve overlapping elements (z-index audit)
10. Fix FOUC issues with proper Suspense
11. Add offline mode indicators
12. Implement proper loading skeletons

### P3 - Low Priority (Fix When Time)
13. Accessibility audit (font sizes, contrast)
14. Text overflow fixes
15. Performance optimization (bundle splitting)

---

## Testing Recommendations

### Automated Testing Setup
1. **Playwright E2E Tests**
   - Test all rail navigation items
   - Verify view renders without errors
   - Check for console errors

2. **Visual Regression Tests**
   - Percy or Chromatic for screenshot comparison
   - Catch layout shifts and overlaps

3. **Accessibility Tests**
   - axe-core integration
   - WCAG 2.1 AA compliance

### Manual Testing Checklist
- [ ] All rail items clickable and navigate correctly
- [ ] No console errors in production build
- [ ] Views load within 2 seconds
- [ ] No overlapping elements at common breakpoints
- [ ] All interactive elements have focus states
- [ ] Keyboard navigation works throughout

---

## Next Steps

1. **Start Backend Services**
   ```bash
   # Gateway (port 8013)
   cd 7-apps/api && pnpm dev
   
   # Or use the sidecar from desktop app
   cd 7-apps/shell/desktop && pnpm dev
   ```

2. **Fix Critical Issues**
   - Address P0 items first
   - Test fixes with automated script

3. **Re-run Audit**
   ```bash
   cd 7-apps/shell/web
   node ui-audit-script.mjs
   ```

4. **Verify Fixes**
   - Zero critical errors
   - Zero high severity errors
   - < 10 medium severity errors

---

## Appendix: File Locations

### Core UI Files
```
6-ui/a2r-platform/
├── src/
│   ├── shell/
│   │   ├── ShellApp.tsx          # Root component
│   │   ├── ShellFrame.tsx        # Layout container
│   │   ├── ShellRail.tsx         # Navigation rail
│   │   ├── ShellCanvas.tsx       # Main content area
│   │   └── rail/
│   │       ├── rail.config.ts    # Chat mode config
│   │       ├── cowork.config.ts  # Cowork mode config
│   │       └── code.config.ts    # Code mode config
│   ├── views/
│   │   ├── HomeView.tsx
│   │   ├── ChatView.tsx
│   │   ├── ElementsLab.tsx       # ⚠️ Has issues
│   │   ├── NativeAgentView.tsx   # ❌ Broken
│   │   └── ... (40+ more views)
│   └── components/
│       └── ai-elements/
│           └── transcription.tsx  # ⚠️ Missing keys
```

### Web App Files
```
7-apps/shell/web/
├── src/
│   └── main.tsx              # Entry point
├── ui-audit-script.mjs       # Audit tool
└── ui-audit-output/          # Screenshots & reports
```

---

**Report Generated:** February 24, 2026 at 21:12 UTC  
**Audit Tool Version:** 1.0.0  
**Playwright Version:** Latest  
**Browser:** Chromium (Headless)
