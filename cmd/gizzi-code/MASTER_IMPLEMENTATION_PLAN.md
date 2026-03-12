# Gizzi Code Cowork Mode - Master Implementation Plan

## Locked Architecture: **Hybrid Browser Approach**

- **Terminal**: TUI for commands, status, controls
- **Browser Window**: Separate native window for interactive content
- **Coordination**: IPC between TUI and browser
- **Works In**: Apple Terminal.app (and all other terminals)
- **Image Display**: Browser window (not ASCII)
- **Artifacts**: Display in browser or as files

---

## 📋 Master Task List

### **PHASE 1: Foundation & Mode System** (Week 1)

#### ✅ Task 1.1: Mode Switcher Component
- [x] Create ModeSwitcher component
- [x] Pill-style buttons (Code | Cowork)
- [x] Green accent for Code, Purple for Cowork
- [x] Mouse click support
- [x] Keyboard shortcut support (optional)
- [ ] **Status**: ✅ COMPLETE

#### ✅ Task 1.2: Onboarding Mode Selection
- [x] Add mode selection step to onboarding wizard
- [x] Explain both modes (Code vs Cowork)
- [x] Preview mode switcher in wizard
- [x] Two-step confirmation (select → confirm)
- [ ] **Status**: ✅ COMPLETE

#### ⏳ Task 1.3: Mode Persistence
- [ ] Create KV store integration
- [ ] Save mode selection: `gizzi-mode`
- [ ] Load mode on startup
- [ ] Default to "code" mode
- [ ] **Status**: NOT STARTED

#### ⏳ Task 1.4: Mode Context/State Management
- [ ] Create mode context provider
- [ ] Mode state (code | cowork)
- [ ] Mode switching logic
- [ ] Navigation on mode change
- [ ] **Status**: NOT STARTED

#### ⏳ Task 1.5: Add Mode Switcher to Main Screen
- [ ] Modify home.tsx header
- [ ] Position: Top right corner
- [ ] Integrate with mode context
- [ ] Test mode switching
- [ ] **Status**: NOT STARTED

---

### **PHASE 2: Cowork Layout & Viewport** (Week 2)

#### ⏳ Task 2.1: Cowork Route Rebuild
- [ ] Clear existing placeholder
- [ ] Create split-view layout
- [ ] Left pane: Terminal/Code (standard)
- [ ] Right pane: Viewport container
- [ ] Resizable panes (optional)
- [ ] **Status**: NOT STARTED

#### ⏳ Task 2.2: Viewport Container Component
- [ ] Create viewport wrapper
- [ ] Content type detection
- [ ] Loading states
- [ ] Error handling
- [ ] **Status**: NOT STARTED

#### ⏳ Task 2.3: Browser Integration (Using a2r-browser-dev)
- [ ] Integrate with existing a2r-browser-dev skill
- [ ] Launch Chrome with CDP (--remote-debugging-port=9222)
- [ ] Window positioning (beside terminal via yabai/macOS)
- [ ] Use agent-browser CLI for control
- [ ] **Status**: NOT STARTED

#### ⏳ Task 2.4: Browser Control via CDP
- [ ] Navigate commands (via agent-browser)
- [ ] Screenshot capture (for TUI preview)
- [ ] Element interaction (click, fill, etc.)
- [ ] Tab/window management
- [ ] **Status**: NOT STARTED

#### ⏳ Task 2.5: TUI-Browser Coordination
- [ ] Status sync (CDP events → TUI status)
- [ ] Keyboard shortcuts (open/close browser)
- [ ] URL bar in TUI
- [ ] Browser state display
- [ ] **Status**: NOT STARTED

---

### **PHASE 3: Content Rendering** (Week 3)

#### ⏳ Task 3.1: Markdown Renderer
- [ ] Use `marked` library (already in @opentui/core)
- [ ] Render to TUI styled text
- [ ] Support: headers, lists, code blocks, links
- [ ] Display in viewport or browser
- [ ] **Status**: NOT STARTED

#### ⏳ Task 3.2: Code Renderer
- [ ] Use tree-sitter (already in @opentui/core)
- [ ] Syntax highlighting
- [ ] Multiple languages
- [ ] Display in viewport
- [ ] **Status**: NOT STARTED

#### ⏳ Task 3.3: Diff Renderer
- [ ] Use `diff` library (already in @opentui/core)
- [ ] Unified diff format
- [ ] Color coding (green/red)
- [ ] Display in viewport or browser
- [ ] **Status**: NOT STARTED

#### ⏳ Task 3.4: Image Display
- [ ] Detect terminal capabilities
- [ ] kitty protocol (if supported)
- [ ] iTerm2 protocol (if supported)
- [ ] ASCII fallback (universal)
- [ ] Browser display (preferred)
- [ ] **Status**: NOT STARTED

#### ⏳ Task 3.5: Web Page Preview
- [ ] Use a2r-browser-dev for screenshots
- [ ] Display in viewport (static preview)
- [ ] Open browser for interactive mode
- [ ] Keyboard navigation via CDP
- [ ] **Status**: NOT STARTED

#### ⏳ Task 3.6: Artifact Display
- [ ] File type detection
- [ ] Text files → viewport
- [ ] Images → browser
- [ ] PDFs → browser
- [ ] HTML → browser
- [ ] **Status**: NOT STARTED

---

### **PHASE 4: Agent Toggle** (Week 4)

#### ⏳ Task 4.1: Agent Toggle Component
- [ ] Create ON/OFF toggle
- [ ] Position: Top right (next to mode switcher)
- [ ] Visual indicator (green/red dot)
- [ ] Click/toggle support
- [ ] **Status**: NOT STARTED

#### ⏳ Task 4.2: Agent State Management
- [ ] Agent enabled/disabled state
- [ ] Persist agent preference
- [ ] Agent context provider
- [ ] **Status**: NOT STARTED

#### ⏳ Task 4.3: Agent Integration in Code Mode
- [ ] Mount agent when toggled ON
- [ ] Unmount when OFF
- [ ] Agent UI in Code mode
- [ ] **Status**: NOT STARTED

#### ⏳ Task 4.4: Agent Integration in Cowork Mode
- [ ] Mount agent when toggled ON
- [ ] Agent uses viewport for output
- [ ] Agent can open browser
- [ ] **Status**: NOT STARTED

---

### **PHASE 5: Polish & Integration** (Week 5)

#### ⏳ Task 5.1: Terminal Capability Detection
- [ ] Query terminal capabilities
- [ ] Detect kitty graphics support
- [ ] Detect iTerm2 support
- [ ] Detect RGB/truecolor
- [ ] Store in context
- [ ] **Status**: NOT STARTED

#### ⏳ Task 5.2: Keyboard Shortcuts
- [ ] Mode switching (Cmd+1/2)
- [ ] Open browser (Cmd+O)
- [ ] Close browser (Cmd+W)
- [ ] Agent toggle (Cmd+A)
- [ ] Help/shortcuts view
- [ ] **Status**: NOT STARTED

#### ⏳ Task 5.3: Status Bar Integration
- [ ] Show current mode
- [ ] Show agent status
- [ ] Show browser status
- [ ] Show connection status
- [ ] **Status**: NOT STARTED

#### ⏳ Task 5.4: Error Handling
- [ ] Browser launch failures
- [ ] IPC communication errors
- [ ] Content rendering errors
- [ ] User-friendly error messages
- [ ] **Status**: NOT STARTED

#### ⏳ Task 5.5: Testing
- [ ] Test on Apple Terminal
- [ ] Test on iTerm2
- [ ] Test on kitty
- [ ] Test on Linux
- [ ] Test on Windows
- [ ] **Status**: NOT STARTED

#### ⏳ Task 5.6: Documentation
- [ ] README update
- [ ] Cowork mode guide
- [ ] Browser integration docs
- [ ] Troubleshooting guide
- [ ] **Status**: NOT STARTED

---

## 📊 Progress Summary

| Phase | Tasks | Complete | In Progress | Not Started |
|-------|-------|----------|-------------|-------------|
| **Phase 1: Foundation** | 5 | 2 | 0 | 3 |
| **Phase 2: Cowork Layout** | 5 | 0 | 0 | 5 |
| **Phase 3: Content** | 6 | 0 | 0 | 6 |
| **Phase 4: Agent** | 4 | 0 | 0 | 4 |
| **Phase 5: Polish** | 6 | 0 | 0 | 6 |
| **TOTAL** | **26** | **2** | **0** | **24** |

---

## 🚀 Immediate Next Steps

### Start with Phase 1 (Foundation):

1. **Task 1.3: Mode Persistence** (30 min)
   - KV store integration
   - Save/load mode

2. **Task 1.4: Mode Context** (45 min)
   - Create context provider
   - State management

3. **Task 1.5: Add to Main Screen** (30 min)
   - Integrate mode switcher
   - Test switching

### Then Phase 2 (Cowork Layout):

4. **Task 2.1: Cowork Route Rebuild** (1 hour)
   - Split-view layout
   - Basic structure

5. **Task 2.2: Viewport Container** (45 min)
   - Container component
   - State management

6. **Task 2.3: Browser Integration** (2 hours)
   - Install Puppeteer
   - Browser service
   - IPC setup

---

## 📁 Files to Create/Modify

### Created ✅:
- `src/cli/ui/tui/component/mode-switcher.tsx`
- `src/cli/ui/tui/component/onboarding-mode-selection.tsx`
- `src/cli/ui/tui/routes/cowork.tsx` (placeholder)

### To Create ⏳:
- `src/cli/ui/tui/context/mode.tsx`
- `src/cli/ui/tui/context/agent.tsx`
- `src/cli/ui/tui/component/agent-toggle.tsx`
- `src/cli/ui/tui/component/cowork/viewport.tsx`
- `src/cli/ui/tui/component/cowork/browser-service.ts`
- `src/cli/ui/tui/component/cowork/renderers/*.tsx`

### To Modify ⏳:
- `src/cli/ui/tui/routes/home.tsx`
- `src/cli/ui/tui/routes/session.tsx`
- `package.json` (no changes - use existing agent-browser)

---

## 🎯 Success Criteria

### Phase 1 Complete When:
- ✅ Mode switcher in top right corner
- ✅ Mode persists across sessions
- ✅ Can switch between Code/Cowork
- ✅ Onboarding asks for mode preference

### Phase 2 Complete When:
- ✅ Cowork has split-view layout
- ✅ Browser window opens beside terminal
- ✅ TUI can control browser
- ✅ Browser shows web content

### Phase 3 Complete When:
- ✅ Markdown renders in viewport
- ✅ Code has syntax highlighting
- ✅ Images display in browser
- ✅ Web pages preview in browser

### Phase 4 Complete When:
- ✅ Agent toggle in top right
- ✅ Agent works in Code mode
- ✅ Agent works in Cowork mode
- ✅ Agent can use viewport/browser

### Phase 5 Complete When:
- ✅ All tests pass
- ✅ Works on all platforms
- ✅ Documentation complete
- ✅ Error handling robust

---

## 💻 Ready to Start?

**Shall I begin implementing Phase 1 tasks now?**

1. Mode Persistence (Task 1.3)
2. Mode Context (Task 1.4)
3. Add Mode Switcher to Main Screen (Task 1.5)

**Or would you like to adjust the plan first?**
