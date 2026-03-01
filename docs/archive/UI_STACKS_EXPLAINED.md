# The Three UI Stacks - Clarified

## Overview

You have **THREE completely different UI implementations** with overlapping names. This is the source of confusion.

---

## Stack 1: React/Web Stack (Current Primary)

```
6-ui/a2r-platform/         React component library (@a2r/platform)
    ↓ (imports)
7-apps/shell-ui/           Web app (@a2rchitech/shell-ui)
    ↓ (wraps in Electron)
7-apps/shell-electron/     Desktop app (@a2rchitech/shell-electron)
```

**Technology**: React + Vite + Electron
**Purpose**: Browser-based shell with desktop wrapper
**Status**: Active/Primary

**Key Files**:
- `6-ui/a2r-platform/src/shell/ShellApp.tsx` - Main app component
- `7-apps/shell-ui/src/main.tsx` - Web entry point
- `7-apps/shell-electron/main/index.cjs` - Electron main process

---

## Stack 2: Rust/Native Stack (Experimental?)  

```
6-ui/shell-ui/             Rust native UI workspace
├── src/views/browserview/     Browser automation with Playwright
├── src/views/openclaw/        OpenClaw integration
├── src/views/runtime/         Runtime management
└── src/views/workflow/        Workflow designer
```

**Technology**: Rust + thirtyfour (Playwright) + native views
**Purpose**: Native browser-based UI with automation
**Status**: Unknown (appears incomplete/experimental)

**Key Files**:
- `6-ui/shell-ui/src/views/mod.rs` - View registry
- `6-ui/shell-ui/src/views/browserview/Cargo.toml` - Browser view crate

---

## Stack 3: Terminal/TUI Stack (New)

```
7-apps/tui/a2r-tui/        Terminal UI (@a2rchitect/tui)
```

**Technology**: TypeScript + Bun + @opentui/solid
**Purpose**: Terminal-based agent workspace
**Status**: Active development, just consolidated

**Key Files**:
- `7-apps/tui/a2r-tui/src/main.tsx` - TUI entry
- `7-apps/tui/a2r-tui/src/cli/a2r.ts` - CLI commands

---

## The Naming Disaster

| Name | Stack 1 | Stack 2 | Stack 3 |
|------|---------|---------|---------|
| "shell-ui" | ✅ `7-apps/shell-ui/` | ✅ `6-ui/shell-ui/` | ❌ |
| Package | `@a2rchitech/shell-ui` | `a2r-shellui-browserview` | `@a2rchitect/tui` |
| Tech | React/Web | Rust/Native | Terminal |

**Problem**: Two directories named `shell-ui` with completely different purposes!

---

## The Namespace Chaos

```
@a2r/              - 6-ui packages (platform, runtime)
@a2rchitech/       - 7-apps packages (shell-electron, shell-ui)
@a2rchitect/       - New TUI package (tui)
```

**Problem**: Three different namespaces for the same project!

---

## Recommended Consolidation

### Step 1: Clarify Stack 2 Status
Is `6-ui/shell-ui` (Rust) being actively developed? Options:
- **If yes**: Rename to `6-ui/shell-native/` or `6-ui/shell-rust/`
- **If no**: Move to `6-ui/_legacy/shell-rust/` or delete

### Step 2: Rename Stack 1 for Clarity
```
7-apps/shell-ui/        → 7-apps/shell-web/
7-apps/shell-electron/  → 7-apps/shell-desktop/
```

### Step 3: Unify Namespaces
Pick ONE namespace:
```
@a2rchitect/shell-core      (was @a2r/platform)
@a2rchitect/shell-web       (was @a2rchitech/shell-ui)
@a2rchitect/shell-desktop   (was @a2rchitech/shell-electron)
@a2rchitect/shell-terminal  (was @a2rchitect/tui)
```

### Step 4: Organize by Product
```
7-apps/
└── shell/                       # The "Shell" product
    ├── core/                    # Shared core (if any)
    ├── web/                     # Browser version
    ├── desktop/                 # Electron version
    └── terminal/                # TUI version
```

Or by platform:
```
7-apps/
├── web-shell/                   # Web version
├── desktop-shell/               # Electron version
└── terminal-shell/              # TUI version
```

---

## Which Stack Should Be Primary?

| Stack | Pros | Cons |
|-------|------|------|
| **React/Web** | Mature, team knows it, web-first | Electron bloat, not native feel |
| **Rust/Native** | Native performance, browser automation | Incomplete, team learning curve |
| **Terminal** | Lightweight, dev-friendly, agent-focused | Not for end-users |

**Recommendation**:
1. **Terminal (TUI)**: Keep for developers/power users
2. **React/Web**: Keep as primary end-user interface  
3. **Rust/Native**: Decide - either commit resources or deprecate

---

## Immediate Actions

1. **Verify Stack 2 status** - Is 6-ui/shell-ui actively developed?
2. **Pick primary namespace** - @a2rchitect/ recommended
3. **Rename conflicting directories** - No two "shell-ui"
4. **Document the architecture** - Which stack for what purpose
