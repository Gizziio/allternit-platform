# CLI PTY OPENWORK UITARS DEMO CHECKLIST

**Date:** 2026-01-18
**Purpose:** Smoke check demonstration for all 5 deliverables

---

## DELIVERABLE 1: PTY Brain Wrappers

### Expected Behavior
- Tool adapter registry exists with configs for 9 CLI tools
- `a2 brain start --tool <name>` starts a PTY brain session
- `a2 which <tool>` checks if tool is installed
- Events stream via existing `TerminalManager` and `EventEnvelope`

### Demo Steps

1. **Check available tools:**
   ```bash
   cd ~/Desktop/a2rchitech-workspace/a2rchitech
   a2 which opencode
   a2 which claude-code
   a2 which amp
   a2 which aider
   ```

   **Expected Output:** Tool detection results with install status and hints

2. **Start a brain session (if tool is installed):**
   ```bash
   # Example: Start Amp session
   a2 brain start --tool amp --workspace ~/Desktop/test-project
   ```

   **Expected Output:** Terminal session starts, events stream to UI

### Acceptance Criteria
- [ ] `a2 which <tool>` shows detection results
- [ ] `a2 brain start` accepts tool name parameter
- [ ] `a2 brain list` shows active sessions
- [ ] `a2 brain stop --session-id <id>` stops session
- [ ] `a2 brain attach <session-id>` attaches to session

---

## DELIVERABLE 2: A2 CLI as Top Process

### Expected Behavior
- `a2` is top-level orchestrator command
- `a2 up` starts all services (daemon, shell, UI-TARS, etc.)
- `a2 brain` commands manage external CLI brains
- `a2 shell dev` starts Shell UI

### Demo Steps

1. **Show CLI help:**
   ```bash
   a2 --help
   ```

   **Expected Output:** Coherent product-level CLI with brain commands

2. **Start daemon:**
   ```bash
   a2 up
   ```

   **Expected Output:** All services start successfully (kernel, shell, UI-TARS, etc.)

3. **Check brain command:**
   ```bash
   a2 brain --help
   ```

   **Expected Output:** Shows brain start/stop/list/attach/which subcommands

### Acceptance Criteria
- [ ] `a2 --help` shows all commands including brain commands
- [ ] `a2 up` starts all services without errors
- [ ] `a2 brain --help` shows brain subcommands
- [ ] Daemon starts Shell UI on port 5173
- [ ] Daemon starts kernel on port 3004
- [ ] Daemon starts UI-TARS on port 3008

---

## DELIVERABLE 3: OpenWork Integration (Ops Center Tab)

### Expected Behavior
- "Ops Center" tab appears in LeftRail
- Clicking tab shows OpenWork UI in iframe (localhost:5173)
- OpenWork connects to A2rchitech brain/session API

### Demo Steps

1. **Start Shell UI:**
   ```bash
   a2 shell dev
   # Or: a2 up (starts shell as part of full stack)
   ```

2. **Navigate to Ops Center tab:**
   - Look for "Ops Center" button in left rail
   - Click to switch view mode to `openwork`
   - Should see OpenWork iframe with note about API integration

3. **Verify OpenWork is accessible:**
   ```bash
   curl http://localhost:5173
   ```

   **Expected Output:** OpenWork HTML page loads (iframe content)

### Acceptance Criteria
- [ ] "Ops Center" tab button appears in LeftRail
- [ ] Clicking tab switches view to `openwork`
- [ ] OpenWorkView component renders iframe pointing to localhost:5173
- [ ] Iframe shows "OpenWork Integration" note
- [ ] OpenWork is accessible via curl on port 5173

---

## DELIVERABLE 4: UI-TARS Computer Use Tool

### Expected Behavior
- GUI tools registered: `gui.screenshot`, `gui.click`, `gui.type`, `gui.scroll`
- Tools use macOS APIs: screencapture, cliclick, osascript
- Tool gateway routes requests to `gui_*` tools
- UI-TARS operator (port 3008) accepts `/v1/model/ui_tars/propose` requests

### Demo Steps

1. **Verify GUI tools are registered:**
   ```bash
   # Check if GUI tools exist in tool gateway database
   # This requires checking kernel services
   ```

2. **Test GUI tool directly (mock test):**
   - Take a screenshot
   - Execute a click
   - Type text
   - Scroll

### Acceptance Criteria
- [ ] Tool gateway has `gui.screenshot` registered
- [ ] Tool gateway has `gui.click` registered
- [ ] Tool gateway has `gui.type` registered
- [ ] Tool gateway has `gui.scroll` registered
- [ ] `gui.rs` file exists with macOS-specific implementations
- [ ] `gui_tools.rs` file registers GUI tools with gateway

---

## DELIVERABLE 5: Capsule Icons + Vendor Asset Pipeline

### Expected Behavior
- CapsuleIconRegistry uses SVG icons, not emojis
- Vendor icons exist for CLI tools: opencode, claude-code, amp, aider, etc.
- Icons follow brand colors per tool
- No emoji icons in capsule renderers

### Demo Steps

1. **Check for emoji icons:**
   - Inspect LeftRail buttons
   - Inspect capsule windows
   - Look for emoji characters (🌐, 🛠️, 📚, etc.)

2. **Verify vendor icons exist:**
   ```bash
   ls -la ~/Desktop/a2rchitech-workspace/a2rchitech/apps/shell/src/iconography/vendor/
   ```

   **Expected Output:** List of SVG files (opencode.svg, claude-code.svg, amp.svg, etc.)

3. **Check CapsuleIconRegistry:**
   - Open `apps/shell/src/iconography/CapsuleIconRegistry.tsx`
   - Verify vendor icon imports and registry entries

### Acceptance Criteria
- [ ] `iconography/vendor/` directory contains SVG files for tools
- [ ] `CapsuleIconRegistry.tsx` imports vendor icons
- [ ] No emoji icons in LeftRail buttons (all use `CapsuleIcon` component)
- [ ] CapsuleIconRegistry has entries for: opencode, claude-code, amp, aider, gemini-cli, cursor, verdant, qwen, goose, codex
- [ ] Each tool icon has correct brand color
- [ ] Icons are 24x24 SVG format with proper styling

---

## Smoke Check Success Criteria

Overall success requires:
- [ ] All 5 deliverables pass their acceptance criteria
- [ ] Code compiles without critical errors
- [ ] Services start without port conflicts
- [ ] UI is accessible and functional

---

## Log Capture

When running demos, capture:
1. Screenshot of terminal output
2. Screenshot of Shell UI (showing Ops Center tab)
3. Screenshot of capsule icons
4. Browser console logs (if GUI tool execution)

---

## Known Limitations

Based on current implementation:
1. **Brain API integration** - `a2 brain start` currently shows integration notes but doesn't actually call kernel API (marked with "Note: This is a minimal implementation")
2. **OpenWork API** - Currently only embeds as iframe without actual API integration
3. **GUI tools** - macOS-specific (screencapture, cliclick, osascript) - Windows/Linux would need different implementations

---

## Next Steps for Full Implementation

To go beyond demo to production:
1. Wire `a2 brain start` to actual kernel brain module API
2. Add OpenWork API integration (proxy requests to brain sessions)
3. Implement cross-platform GUI tools (Windows/Linux support)
4. Add error handling and recovery in all tools
5. Add session persistence and state management

---

**Demo Status:** Ready to verify all deliverables
