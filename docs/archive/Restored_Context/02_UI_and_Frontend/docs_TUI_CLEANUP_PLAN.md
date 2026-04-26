# TUI Cleanup - Remove Duplicate Implementations

## Status: ✅ COMPLETED (2026-02-21)

Duplicate TUI implementations have been removed. The workspace now has a clean TUI architecture.

---

## Main TUI (KEEP)

**Location:** `cmd/cli/src/commands/tui.rs`

This is the PRIMARY TUI that should be kept:
- Integrated with the main CLI (`allternit` binary)
- Has brain profile support (opencode-acp, kimi-acp, gemini-acp, qwen-acp)
- Uses ACP protocol for brain sessions
- Has model selection, session management, etc.

## TUI Implementations REMOVED

### 1. ✅ agent-shell (cmd/agent-shell/) - REMOVED

**Status:** REMOVED on 2026-02-21

**Reason:** This was a separate Rust port of agent-shell that duplicated the CLI TUI functionality. It was not used as a dependency anywhere in the codebase.

### 2. ✅ allternit-tui (cmd/allternit-tui/) - REMOVED

**Status:** REMOVED on 2026-02-21

**Reason:** Standalone TUI app that duplicated the main CLI TUI functionality. Only referenced in the workspace Cargo.toml, not used as a dependency.

### 3. agent-shell-clone (cmd/agent-shell-clone/)

**Status:** Already removed (Emacs Lisp)

**Note:** This was the original agent-shell Emacs integration (Emacs Lisp, not Rust TUI).

### 4. openclaw-host native_tui (domains/kernel/infrastructure/allternit-openclaw-host/src/native_tui.rs)

**Status:** USED BY OPENCLAW-HOST - Keep for now

**Location:** `domains/kernel/infrastructure/allternit-openclaw-host/src/native_tui.rs`

This is used by the openclaw-host service. It's a different TUI for the OpenClaw host, not the main CLI.

**Recommendation:** Keep for now as it's used by openclaw-host. Consider consolidating later.

### 5. marketplace TUI (services/rust/marketplace/src/tui.rs)

**Status:** USED BY MARKETPLACE - Keep

**Location:** `services/rust/marketplace/src/tui.rs`

This is the marketplace browser TUI, which is a different use case.

**Recommendation:** Keep - it's a specialized TUI for marketplace browsing.

---

## Cleanup Commands

### Remove agent-shell (safe to remove)

```bash
cd /Users/macbook/Desktop/allternit-workspace/allternit
rm -rf cmd/agent-shell
```

### Remove agent-shell-clone (if Emacs integration not needed)

```bash
cd /Users/macbook/Desktop/allternit-workspace/allternit
rm -rf cmd/agent-shell-clone
```

### Check allternit-tui usage before removing

```bash
# Check if allternit-tui is referenced anywhere
grep -r "allternit-tui" --include="*.toml" --include="*.rs" .
```

---

## Summary - COMPLETED ✅

| TUI | Location | Status |
|-----|----------|--------|
| **CLI TUI (MAIN)** | `cmd/cli/src/commands/tui.rs` | ✅ KEEP - Primary TUI |
| agent-shell | `cmd/agent-shell/` | ✅ REMOVED |
| allternit-tui | `cmd/allternit-tui/` | ✅ REMOVED |
| agent-shell-clone | `cmd/agent-shell-clone/` | ✅ Already removed |
| openclaw-host native_tui | `domains/kernel/.../native_tui.rs` | ✅ Keep (used by openclaw-host) |
| marketplace TUI | `services/.../marketplace/src/tui.rs` | ✅ Keep (specialized) |
| canvas-monitor | `surfaces/canvas-monitor/` | ✅ Keep (specialized) |

---

## Current TUI Architecture

After cleanup, the TUI implementations are:

1. **Main CLI TUI** - `cmd/cli/src/commands/tui.rs`
   - Primary user interface
   - Integrated with main CLI binary (`allternit tui`)
   - Full-featured with brain profile support

2. **Marketplace TUI** - `services/rust/marketplace/src/tui.rs`
   - Specialized TUI for marketplace browsing
   - Accessed via `allternit marketplace` command

3. **OpenClaw Host TUI** - `domains/kernel/infrastructure/allternit-openclaw-host/src/native_tui.rs`
   - Used by openclaw-host service
   - Separate service-specific TUI

4. **Canvas Monitor** - `surfaces/canvas-monitor/src/main.rs`
   - Canvas protocol monitoring
   - Specialized visualization tool

---

## Build Verification

All TUIs build successfully after cleanup:

```bash
# Main CLI TUI
cargo build --package allternit-cli

# Canvas Monitor
cargo build --package canvas-monitor

# Full workspace
cargo build
```

All builds complete successfully with only warnings (no errors).
