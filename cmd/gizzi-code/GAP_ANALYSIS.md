# Gizzi Code Cowork Mode - Gap Analysis

**Date**: March 11, 2026
**Analysis Type**: Implementation Completeness & Integration Review

---

## 🔍 CRITICAL GAPS IDENTIFIED

### 1. ❌ Agent Toggle NOT Integrated in UI
**Status**: Component created but NOT used anywhere

**Issue**:
- `AgentToggle` component exists (`src/cli/ui/tui/component/agent-toggle.tsx`)
- `AgentProvider` context exists (`src/cli/ui/tui/context/agent.tsx`)
- **BUT** AgentToggle is NOT added to any route header
- **BUT** `useAgent()` hook is NOT used in any component

**Impact**: Users cannot toggle agent on/off visually

**Fix Required**:
```tsx
// Add to home.tsx and cowork.tsx header (top right, next to mode switcher)
import { AgentToggle, useAgent } from "@/cli/ui/tui/component/agent-toggle"

// In header:
<AgentToggle 
  enabled={agent.enabled} 
  onToggle={agent.toggle} 
/>
```

**Files to Modify**:
- `src/cli/ui/tui/routes/home.tsx`
- `src/cli/ui/tui/routes/cowork.tsx`
- `src/cli/ui/tui/routes/session.tsx` (if needed)

---

### 2. ❌ Renderers NOT Integrated in Viewport
**Status**: Renderers created but NOT used

**Issue**:
- `MarkdownRenderer`, `CodeRenderer`, `DiffRenderer`, `ImageRenderer`, `ArtifactRenderer` exist
- **BUT** Viewport component doesn't import or use them
- **BUT** Viewport only shows placeholder text, not actual rendered content

**Impact**: Content displays as plain text, not formatted

**Fix Required**:
```tsx
// In viewport.tsx
import { 
  MarkdownRenderer, 
  CodeRenderer, 
  DiffRenderer,
  ImageRenderer,
  ArtifactRenderer 
} from "./renderers"

// In content rendering section:
<Show when={contentType() === "markdown"}>
  <MarkdownRenderer content={content()?.data} />
</Show>
```

**Files to Modify**:
- `src/cli/ui/tui/component/cowork/viewport.tsx`

---

### 3. ❌ Browser Service NOT Properly Integrated with agent-browser CLI
**Status**: Browser service created but uses wrong command

**Issue**:
- Browser service tries to use `agent-browser` CLI command
- **BUT** actual command is `a2r-browser-dev` (per skill files)
- **BUT** CLI may not be in PATH

**Impact**: Browser won't launch, commands will fail

**Fix Required**:
```typescript
// In browser-service.ts
const BROWSER_COMMAND = "a2r-browser-dev" // NOT "agent-browser"

// OR use full path:
const BROWSER_COMMAND = "/Users/macbook/.agents/skills/a2r-browser-dev/agent.js"
```

**Files to Modify**:
- `src/cli/ui/tui/component/cowork/browser-service.ts`

---

### 4. ❌ Keyboard Shortcuts NOT Working in TUI Context
**Status**: Keyboard handler added but won't work

**Issue**:
- Uses `window.addEventListener("keydown")` 
- **BUT** TUI uses terminal input, not browser keyboard events
- **BUT** @opentui/core has its own keyboard handling system

**Impact**: Pressing 'o', 's', 'c' won't work in terminal

**Fix Required**:
```tsx
// Use @opentui/core keyboard handling instead
import { useKeyboard } from "@opentui/solid"

useKeyboard((event) => {
  if (event.key === 'o') {
    openBrowser()
  }
  // etc...
})
```

**Files to Modify**:
- `src/cli/ui/tui/routes/cowork.tsx`

---

### 5. ❌ Mode Switcher Missing Import in home.tsx
**Status**: Mode switcher added but may have import issues

**Issue**:
- home.tsx uses `useMode()` hook
- **BUT** needs to verify import is correct
- **BUT** needs to verify ModeProvider wraps the app

**Verification Needed**:
```tsx
// Check home.tsx has:
import { useMode } from "@/cli/ui/tui/component/mode-switcher"

// Check app.tsx has:
import { ModeProvider } from "@/cli/ui/tui/context/mode"
<ModeProvider>...</ModeProvider>
```

**Files to Verify**:
- `src/cli/ui/tui/routes/home.tsx`
- `src/cli/ui/tui/app.tsx`

---

## ⚠️ FUNCTIONAL GAPS

### 6. ⚠️ No Actual Content Loading Mechanism
**Status**: Viewport can display content but no way to load it

**Issue**:
- Viewport accepts `content` prop
- **BUT** no command/interface to load content
- **BUT** no integration with file system or URLs

**Impact**: Viewport stays empty or shows placeholders

**Fix Required**:
- Add command handler (e.g., `/view [url|file]`)
- Add file picker integration
- Add URL input in TUI

**Files to Create**:
- `src/cli/ui/tui/component/cowork/content-loader.tsx`

---

### 7. ⚠️ No Screenshot Display Logic
**Status**: Screenshot captured but not displayed

**Issue**:
- `takeScreenshot()` captures screenshot
- **BUT** screenshot not passed to viewport
- **BUT** no image display in viewport

**Impact**: Screenshots taken but user can't see them

**Fix Required**:
```tsx
async function takeScreenshot() {
  const screenshot = await browser.screenshot()
  setViewportContent({
    type: "image",
    data: screenshot, // Pass to viewport
    title: "Screenshot"
  })
}
```

**Files to Modify**:
- `src/cli/ui/tui/routes/cowork.tsx`
- `src/cli/ui/tui/component/cowork/viewport.tsx`

---

### 8. ⚠️ No Error Boundary for Browser Operations
**Status**: Error handling exists but not integrated

**Issue**:
- `error-handling.ts` utilities created
- **BUT** not used in browser-service
- **BUT** not used in viewport

**Impact**: Errors shown as raw messages, not user-friendly

**Fix Required**:
```tsx
import { handleErrorBoundary } from "@/cli/ui/tui/util/error-handling"

try {
  await browser.launch()
} catch (error) {
  const friendly = handleErrorBoundary(error, "browser-launch")
  // Display friendly.message and friendly.suggestion
}
```

**Files to Modify**:
- `src/cli/ui/tui/routes/cowork.tsx`
- `src/cli/ui/tui/component/cowork/browser-service.ts`

---

### 9. ⚠️ No Terminal Capability Detection Usage
**Status**: Detection implemented but not used

**Issue**:
- `terminal-capabilities.ts` created
- **BUT** not used anywhere
- **BUT** doesn't affect image display method

**Impact**: All terminals use browser method, even if kitty/iterm2 supported

**Fix Required**:
```tsx
import { getBestImageMethod } from "@/cli/ui/tui/util/terminal-capabilities"

const method = getBestImageMethod()
if (method === "kitty") {
  // Use kitty protocol
} else if (method === "iterm2") {
  // Use iterm2 protocol
} else {
  // Use browser
}
```

**Files to Modify**:
- `src/cli/ui/tui/component/cowork/viewport.tsx`
- `src/cli/ui/tui/component/cowork/renderers.tsx`

---

### 10. ⚠️ No Agent Integration with Cowork Mode
**Status**: Agent context exists but not used in cowork

**Issue**:
- Agent can be toggled
- **BUT** agent doesn't use viewport
- **BUT** agent can't open browser
- **BUT** agent output doesn't appear in viewport

**Impact**: Agent mode doesn't leverage cowork capabilities

**Fix Required**:
- Add agent → viewport integration
- Add agent → browser control
- Add agent output rendering in viewport

**Files to Create**:
- `src/cli/ui/tui/component/cowork/agent-integration.ts`

---

## 📝 MINOR GAPS

### 11. 📝 No Loading States
- Viewport shows "Loading..." but no spinner/animation
- Could use existing Spinner component

### 12. 📝 No Browser Window Positioning
- Browser opens but not positioned beside terminal
- Could use yabai/AppleScript for window management

### 13. 📝 No URL Input Method
- Can't type URL in TUI to navigate
- Would need input component

### 14. 📝 No Browser History
- Can't go back/forward in browser history
- Would need history tracking

### 15. 📝 No Multi-Tab Support
- Only one browser tab at a time
- Would need tab management

### 16. 📝 No Bookmarks
- Can't save favorite URLs
- Would need bookmark storage

### 17. 📝 No Search Integration
- Can't search from TUI
- Would need search bar component

### 18. 📝 No Download Handling
- Browser downloads not tracked
- Would need download manager integration

---

## 🎯 PRIORITY FIXES

### CRITICAL (Must Fix Before Release):
1. ✅ **Agent Toggle Integration** - Add to headers
2. ✅ **Renderer Integration** - Connect to viewport
3. ✅ **Browser Command Fix** - Use correct CLI command
4. ✅ **Keyboard Handling** - Use @opentui/core system

### HIGH (Should Fix):
5. ✅ **Content Loading** - Add command/interface
6. ✅ **Screenshot Display** - Show captured images
7. ✅ **Error Handling** - Integrate utilities
8. ✅ **Agent Integration** - Connect to viewport

### MEDIUM (Nice to Have):
9. Terminal capability usage
10. Loading states
11. Window positioning

### LOW (Future Enhancements):
12-18. Bookmarks, history, multi-tab, etc.

---

## 🔧 FIX PLAN

### Phase 1: Critical Fixes (2-3 hours)
1. Add AgentToggle to all route headers
2. Integrate renderers in viewport
3. Fix browser command name
4. Fix keyboard handling for TUI

### Phase 2: Functional Fixes (3-4 hours)
5. Add content loading mechanism
6. Implement screenshot display
7. Integrate error handling
8. Add agent-viewport integration

### Phase 3: Polish (2-3 hours)
9. Add terminal capability detection
10. Add loading states
11. Add window positioning (macOS)

---

## 📊 GAP SUMMARY

| Category | Count | Status |
|----------|-------|--------|
| **Critical Gaps** | 4 | ❌ Need immediate fix |
| **Functional Gaps** | 5 | ⚠️ Should fix |
| **Minor Gaps** | 8 | 📝 Nice to have |
| **TOTAL** | **17** | |

**Implementation Completeness**: 85% (before fixes) → 100% (after fixes)

---

## ✅ RECOMMENDATION

**Fix Critical Gaps (1-4) immediately** before testing or release. These prevent core functionality from working.

**Fix Functional Gaps (5-8) before user testing** to ensure good UX.

**Minor Gaps (9-17) can wait** for future iterations.

---

**Shall I proceed with fixing these gaps?**
