# Gizzi Code Cowork Mode - Implementation Summary

## ✅ Architecture Locked

### Hybrid Browser Approach
- **TUI**: Terminal for commands, status, controls
- **Browser**: Chrome via a2r-browser-dev skill (CDP)
- **Coordination**: agent-browser CLI for automation
- **NO Puppeteer**: Use existing robust browser automation

### Why This Approach?

| Requirement | Solution | Tool |
|-------------|----------|------|
| **Browser Preview** | Chrome with CDP | a2r-browser-dev |
| **Interactivity** | Full browser control | agent-browser CLI |
| **Screenshots** | CDP screenshot API | agent-browser screenshot |
| **Navigation** | CDP commands | agent-browser navigate |
| **Cross-Platform** | Works everywhere | Chrome + CDP |
| **No Bloat** | No Puppeteer | Existing skill |

---

## 📋 Complete Task List (26 Tasks)

### ✅ PHASE 1: Foundation (2/5 Complete)

- [x] **1.1** Mode Switcher Component ✅
- [x] **1.2** Onboarding Mode Selection ✅
- [ ] **1.3** Mode Persistence (KV store)
- [ ] **1.4** Mode Context (State management)
- [ ] **1.5** Add Mode Switcher to Main Screen

### ⏳ PHASE 2: Cowork Layout & Browser (0/5)

- [ ] **2.1** Cowork Route Rebuild (Split-view)
- [ ] **2.2** Viewport Container
- [ ] **2.3** Browser Integration (a2r-browser-dev)
- [ ] **2.4** Browser Control via CDP
- [ ] **2.5** TUI-Browser Coordination

### ⏳ PHASE 3: Content Rendering (0/6)

- [ ] **3.1** Markdown Renderer (marked)
- [ ] **3.2** Code Renderer (tree-sitter)
- [ ] **3.3** Diff Renderer (diff library)
- [ ] **3.4** Image Display (browser preferred)
- [ ] **3.5** Web Page Preview (CDP screenshots)
- [ ] **3.6** Artifact Display

### ⏳ PHASE 4: Agent Toggle (0/4)

- [ ] **4.1** Agent Toggle Component
- [ ] **4.2** Agent State Management
- [ ] **4.3** Agent Integration in Code Mode
- [ ] **4.4** Agent Integration in Cowork Mode

### ⏳ PHASE 5: Polish (0/6)

- [ ] **5.1** Terminal Capability Detection
- [ ] **5.2** Keyboard Shortcuts
- [ ] **5.3** Status Bar Integration
- [ ] **5.4** Error Handling
- [ ] **5.5** Testing (all platforms)
- [ ] **5.6** Documentation

---

## 🚀 Browser Integration Details

### Using a2r-browser-dev Skill

**What It Provides:**
- Chrome launcher with CDP (--remote-debugging-port=9222)
- agent-browser CLI for automation
- Screenshot capture
- Element interaction
- Navigation control
- Tab management

**How We Use It:**

```typescript
// 1. Launch Chrome with CDP
import { spawn } from "child_process"

function launchBrowser() {
  const chrome = spawn("open", [
    "-a", "Google Chrome",
    "--args", "--remote-debugging-port=9222"
  ])
}

// 2. Control via agent-browser CLI
import { execSync } from "child_process"

function navigate(url: string) {
  execSync(`agent-browser navigate ${url}`)
}

function takeScreenshot(): Buffer {
  return execSync("agent-browser screenshot --stdout")
}

function clickElement(selector: string) {
  execSync(`agent-browser click "${selector}"`)
}
```

**Benefits:**
- ✅ Already installed and working
- ✅ Robust (used in production)
- ✅ Full CDP support
- ✅ No additional dependencies
- ✅ Maintained skill

---

## 📁 File Plan

### Created ✅:
- `src/cli/ui/tui/component/mode-switcher.tsx`
- `src/cli/ui/tui/component/onboarding-mode-selection.tsx`

### To Create ⏳:
- `src/cli/ui/tui/context/mode.tsx` - Mode state
- `src/cli/ui/tui/context/agent.tsx` - Agent state
- `src/cli/ui/tui/component/agent-toggle.tsx`
- `src/cli/ui/tui/component/cowork/viewport.tsx`
- `src/cli/ui/tui/component/cowork/browser-service.ts` - CDP integration
- `src/cli/ui/tui/component/cowork/renderers/*.tsx`

### To Modify ⏳:
- `src/cli/ui/tui/routes/home.tsx` - Add mode switcher
- `src/cli/ui/tui/routes/cowork.tsx` - Rebuild with split-view
- `src/cli/ui/tui/routes/session.tsx` - (Code mode, minor updates)

---

## 🎯 Immediate Next Steps

### Start Phase 1 (Today):

1. **Task 1.3: Mode Persistence** (30 min)
   ```typescript
   // Use existing KV store in gizzi-code
   const kv = useKV()
   kv.set("gizzi-mode", "code")
   const mode = kv.get("gizzi-mode", "code")
   ```

2. **Task 1.4: Mode Context** (45 min)
   ```typescript
   // Create context provider
   export const ModeProvider = /* ... */
   export const useMode = () => /* ... */
   ```

3. **Task 1.5: Add to Main Screen** (30 min)
   ```tsx
   // home.tsx header
   <ModeSwitcher
     activeMode={mode()}
     onModeChange={(m) => setMode(m)}
   />
   ```

### Then Phase 2 (Tomorrow):

4. **Task 2.1: Cowork Route** (1 hour)
   - Split-view layout
   - Left: Terminal
   - Right: Viewport container

5. **Task 2.3: Browser Integration** (2 hours)
   - Integrate a2r-browser-dev
   - Launch Chrome with CDP
   - Test agent-browser commands

---

## ✅ Advantages of Using a2r-browser-dev

| Feature | Puppeteer | a2r-browser-dev |
|---------|-----------|-----------------|
| **Installation** | 200MB+ | Already installed |
| **Dependencies** | Chromium download | Uses Chrome |
| **Maintenance** | Your responsibility | Maintained skill |
| **CDP Support** | Full | Full |
| **Screenshots** | Yes | Yes |
| **Navigation** | Yes | Yes |
| **Interaction** | Yes | Yes |
| **Tab Management** | Manual | Built-in |
| **CLI Tools** | No | Yes (agent-browser) |
| **Electron Support** | No | Yes (electron skill) |

---

## 🎉 Ready to Build!

**All planning complete. Architecture locked. Tools identified.**

**Shall I begin implementing Phase 1 now?**

1. Mode Persistence (KV store)
2. Mode Context (State management)
3. Add Mode Switcher to Main Screen

**Or do you want to review/adjust the plan first?**
