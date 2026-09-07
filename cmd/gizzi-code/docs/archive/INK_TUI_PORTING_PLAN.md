# Ink TUI Porting Plan - Comprehensive

## Source Analysis

### Codebases Available
1. **gizzi-code** (`src/cli/ui/tui/`) - OpenTUI implementation with 45 dialogs, 207 commands
2. **free-code** (`src/components/`, `src/ink/`) - Ink-based React implementation with 148 components
3. **claw-code** - Python port with reference data

### Gap Analysis (from deep analysis)

## Phase 1: Core Infrastructure (Week 1)

### 1.1 Dialog System
- [ ] Port `DialogProvider` from OpenTUI to Ink context
- [ ] Create modal overlay system with z-index management
- [ ] Port `DialogSelect` (fuzzy search, category grouping)
- [ ] Port `DialogConfirm`, `DialogAlert`
- [ ] Add dialog stacking/navigation

**Sources:**
- gizzi: `src/cli/ui/tui/ui/dialog.tsx`
- gizzi: `src/cli/ui/tui/ui/dialog-select.tsx`
- free-code: `src/components/` (dialog patterns)

### 1.2 Theme System
- [ ] Port full theme context (not just hardcoded colors)
- [ ] Add dark/light mode switching
- [ ] Port color tokens from OpenTUI
- [ ] Add syntax highlighting theme integration

**Sources:**
- gizzi: `src/cli/ui/tui/context/theme.tsx`

### 1.3 Keyboard/Input System
- [ ] Port full keybind context (not just useInput)
- [ ] Add keybind registration system
- [ ] Add chord/key sequence support
- [ ] Port vim mode support

**Sources:**
- gizzi: `src/cli/ui/tui/context/keybind.tsx`
- free-code: `src/vim/` (vim motions, operators)

## Phase 2: Command System (Week 1-2)

### 2.1 Slash Commands (In Progress)
- [x] Basic command palette UI
- [x] Command registration system
- [ ] Port all 207 commands from OpenTUI
- [ ] Add fuzzy search with fuzzysort
- [ ] Add command categories
- [ ] Add suggested commands
- [ ] Add command keybinds

**Sources:**
- gizzi: `src/cli/ui/tui/component/dialog-command.tsx`
- gizzi: `src/cli/ui/tui/app.tsx` (command registrations)
- free-code: `src/commands.ts`

### 2.2 Command Implementations
Port command handlers for:
- [ ] Session: /new, /resume, /sessions, /rename, /fork, /export, /share
- [ ] Model: /models, /model, /fast, /think, /ultrathink, /effort
- [ ] Agent: /agents, /agent-mode, /mode, /plan, /build
- [ ] Tools: /tools, /mcps, /mcp, /permissions, /yolo, /safe
- [ ] System: /help, /status, /config, /theme, /doctor, /exit
- [ ] Memory: /memory, /compact, /forget, /context
- [ ] Code: /diff, /commit, /pr, /branch, /review
- [ ] Search: /search, /grep, /files

**Sources:**
- gizzi: `src/cli/ui/tui/routes/session/index.tsx` (session commands)
- gizzi: `src/cli/ui/tui/app.tsx` (global commands)

## Phase 3: Model/Provider System (Week 2)

### 3.1 Model Picker Dialog
- [ ] Port `DialogModel` component
- [ ] Add provider connection UI
- [ ] Add model list with capabilities
- [ ] Add recent models
- [ ] Add favorite models
- [ ] Add model cycling (Ctrl+M)

**Sources:**
- gizzi: `src/cli/ui/tui/component/dialog-model.tsx`
- gizzi: `src/cli/ui/tui/context/local.tsx` (model state)

### 3.2 Provider Management
- [ ] Port provider setup dialogs
- [ ] Add API key management
- [ ] Add provider status indicators

**Sources:**
- gizzi: `src/cli/ui/tui/component/dialog-provider.tsx`
- gizzi: `src/cli/ui/tui/component/dialog-provider-setup.tsx`

## Phase 4: Session Management (Week 2-3)

### 4.1 Session List
- [ ] Port `DialogSessionList`
- [ ] Add session search/filter
- [ ] Add session preview
- [ ] Add session forking

**Sources:**
- gizzi: `src/cli/ui/tui/component/dialog-session-list.tsx`

### 4.2 Session Timeline
- [ ] Port timeline view
- [ ] Add branch/fork visualization
- [ ] Add message navigation

**Sources:**
- gizzi: `src/cli/ui/tui/routes/session/dialog-timeline.tsx`

### 4.3 Session Operations
- [ ] Add session rename
- [ ] Add session export
- [ ] Add session sharing
- [ ] Add session deletion

## Phase 5: Tool Visualization (Week 3)

### 5.1 Tool Execution Display
- [ ] Port tool use message components
- [ ] Add real-time status (pending → running → completed)
- [ ] Add tool input/output expansion
- [ ] Add diff visualization for edits
- [ ] Add file read previews

**Sources:**
- gizzi: `src/cli/ui/tui/components/` (tool messages)
- free-code: `src/components/diff/` (diff visualization)
- free-code: `src/components/FileEditToolDiff.tsx`

### 5.2 Tool-Specific UIs
- [ ] Bash tool output with syntax highlighting
- [ ] Glob tool results with file counts
- [ ] Grep tool results with context
- [ ] Read tool file previews
- [ ] Edit tool diff views

**Sources:**
- gizzi: `src/cli/ui/tui/routes/session/index.tsx` (tool rendering)
- free-code: `src/tools/` (tool implementations)

## Phase 6: Message System (Week 3-4)

### 6.1 Message Features
- [ ] Add message collapsing/expanding
- [ ] Add code block actions (copy, apply)
- [ ] Add message bookmarking (m key)
- [ ] Add message search (/ key)
- [ ] Add message jumping (: key)
- [ ] Add pinned messages (P key)

**Sources:**
- gizzi: `src/cli/ui/tui/routes/session/index.tsx`
- free-code: `src/hooks/` (message hooks)

### 6.2 Message Components
- [ ] Port `AssistantMessage` with full features
- [ ] Add thinking blocks (expandable)
- [ ] Add reasoning display
- [ ] Add metadata display (cost, tokens, model)

**Sources:**
- gizzi: `src/cli/ui/tui/components/gizzi/GIZZIMessageList.tsx`
- free-code: `src/components/` (message components)

## Phase 7: Sidebar & Navigation (Week 4)

### 7.1 File Sidebar
- [ ] Port `Sidebar` component
- [ ] Add file tree navigation
- [ ] Add recent files
- [ ] Add file search
- [ ] Add git status integration

**Sources:**
- gizzi: `src/cli/ui/tui/routes/session/sidebar.tsx`

### 7.2 Session Header
- [ ] Port `SessionHeader` with full info
- [ ] Add parent/child session navigation
- [ ] Add cost/token display
- [ ] Add model info

**Sources:**
- gizzi: `src/cli/ui/tui/routes/session/session-header.tsx`
- gizzi: `src/cli/ui/tui/routes/session/header.tsx`

## Phase 8: Advanced Dialogs (Week 4-5)

### 8.1 Utility Dialogs
- [ ] Port `DialogSearch` (message search)
- [ ] Port `DialogJump` (message navigation)
- [ ] Port `DialogFileSearch`
- [ ] Port `DialogBookmarks`
- [ ] Port `DialogPinned`
- [ ] Port `DialogExport`
- [ ] Port `DialogUsage` (cost tracking)

**Sources:**
- gizzi: `src/cli/ui/tui/component/dialog-*.tsx`

### 8.2 Configuration Dialogs
- [ ] Port `DialogSettings`
- [ ] Port `DialogThemeList`
- [ ] Port `DialogMcp`
- [ ] Port `DialogAgent`
- [ ] Port `DialogAgentManager`
- [ ] Port `DialogSkill`

## Phase 9: Status & Context (Week 5)

### 9.1 Footer Status Bar
- [ ] Port full `Footer` component
- [ ] Add mode indicator (yolo/safe)
- [ ] Add agent name
- [ ] Add context usage bar
- [ ] Add LSP/runtime status
- [ ] Add MCP adapter count
- [ ] Add permission pending count
- [ ] Add cost tracking

**Sources:**
- gizzi: `src/cli/ui/tui/routes/session/footer.tsx`

### 9.2 Context Display
- [ ] Add context usage visualization
- [ ] Add token count display
- [ ] Add auto-compact threshold indicator

## Phase 10: Polish & Integration (Week 6)

### 10.1 Animations
- [ ] Add Gizzi mascot animations
- [ ] Add loading spinners
- [ ] Add transition effects
- [ ] Add progress indicators

**Sources:**
- gizzi: `src/cli/ui/components/gizzi/`
- free-code: `src/components/grove/` (animations)

### 10.2 Copy/Export
- [ ] Add clipboard integration
- [ ] Add transcript export
- [ ] Add session sharing

### 10.3 Testing
- [ ] Add component tests
- [ ] Add integration tests
- [ ] Add TUI e2e tests

## Implementation Priority

### P0 (Must Have)
1. Full command palette (207 commands)
2. Model picker dialog
3. Tool execution visualization
4. Session management
5. Full status bar

### P1 (Should Have)
1. File sidebar
2. Message search/jump
3. Bookmarks/pinned
4. Export dialogs
5. Theme switching

### P2 (Nice to Have)
1. Vim mode
2. Advanced animations
3. Plugin marketplace
4. Skill management
5. Voice input

## Effort Estimation

- **Total Components to Port:** ~100
- **Total Dialogs to Port:** 45
- **Total Commands to Port:** 207
- **Estimated Time:** 6 weeks (full-time)
- **Lines of Code:** ~15,000

## Key Architectural Decisions

1. **Use Ink (not OpenTUI)** - React-based, matches free-code
2. **Port gradually** - Keep existing TUI working during transition
3. **Reuse free-code patterns** - Where applicable for Ink components
4. **Feature parity first** - Match OpenTUI, then enhance
5. **Test continuously** - Build verification as we go
