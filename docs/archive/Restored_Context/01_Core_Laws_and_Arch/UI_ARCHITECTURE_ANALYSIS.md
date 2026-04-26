# UI Architecture Analysis - The Confusion

## Current Structure (Messy)

```
surfaces/                           # "UI Layer" 
├── allternit-platform/               # @allternit/platform - Core UI library (React components)
│   ├── ShellApp, ShellFrame    # Main shell components
│   ├── views/                  # View system
│   └── nav/, drawers/          # Navigation, drawers
│
└── shell-ui/                   # @??? - Rust-based views (mod.rs)
    └── src/views/              # browserview, openclaw, runtime, workflow

cmd/                         # "Applications"
├── shell-ui/                   # @allternit/shell-ui - Web app (React)
│   ├── imports @allternit/platform   # Mounts the platform
│   └── main.tsx                # Entry point
│
├── shell-electron/             # @allternit/shell-electron - Desktop wrapper
│   ├── imports shell-ui        # Loads shell-ui in Electron
│   └── main/index.cjs          # Electron main process
│
├── _legacy/shell/              # Old React shell (deprecated)
│
└── tui/allternit-tui/                # @allternit/tui - Terminal UI (NEW)
```

## The Problems

### 1. **Two "shell-ui" Directories** 
- `surfaces/shell-ui/` - Rust-based views (views/mod.rs) 
- `cmd/shell-ui/` - React web app that mounts @allternit/platform

**Confusion**: Same name, completely different things!

### 2. **Inconsistent Naming**
- `@allternit/platform` (surfaces)
- `@allternit/shell-ui` (cmd)
- `@allternit/tui` (cmd) 
- `@allternit/shell-electron` (cmd)

**Confusion**: Is it "allternit", "allternit", or "allternit"?

### 3. **Unclear Layer Boundaries**
- `surfaces/` vs `cmd/` - What's the difference?
- shell-electron wraps shell-ui, but they're siblings
- allternit-platform is a library, but in "ui" folder

### 4. **TUI is Isolated**
- TUI at `cmd/tui/` is standalone
- But web UI is split across `surfaces/` and `cmd/`

## What Each Actually Does

| Package | Type | Depends On | Purpose |
|---------|------|-----------|---------|
| `surfaces/allternit-platform` | Library | Nothing (core) | React component library (ShellApp, etc.) |
| `surfaces/shell-ui` | Rust Module | Unknown | Rust-based view system (incomplete?) |
| `cmd/shell-ui` | Web App | @allternit/platform | Browser entry point that mounts platform |
| `cmd/shell-electron` | Desktop App | shell-ui | Electron wrapper around web app |
| `cmd/tui/allternit-tui` | Terminal App | Nothing (standalone) | Terminal UI with agent workspace |

## The Real Architecture (What Should Be)

```
ui/                             # All UI-related code
├── core/                       # Core UI library (was allternit-platform)
│   ├── react/                  # React components (ShellApp, etc.)
│   ├── views/                  # View system registry
│   └── stores/                 # State management
│
├── web/                        # Web applications  
│   ├── shell/                  # Browser shell (was cmd/shell-ui)
│   └── agent-runner/           # Agent runner page
│
├── desktop/                    # Desktop applications
│   └── electron/               # Electron wrapper (was shell-electron)
│
└── terminal/                   # Terminal applications  
    └── tui/                    # TUI (was cmd/tui/allternit-tui)

# OR - Alternative by "product"
apps/
├── shell/                      # Unified shell product
│   ├── core/                   # Shared shell library
│   ├── web/                    # Browser version
│   ├── desktop/                # Electron version
│   └── terminal/               # TUI version
│
└── agent-runner/               # Agent runner product
    └── ...
```

## Recommended Consolidation

### Option A: By Platform (Web/Desktop/Terminal)
```
cmd/
├── shell/                      # The "Shell" product
│   ├── core/                   # @allternit/shell-core (was allternit-platform)
│   ├── web/                    # @allternit/shell-web (was shell-ui)
│   ├── desktop/                # @allternit/shell-desktop (was shell-electron)
│   └── terminal/               # @allternit/shell-terminal (was tui/allternit-tui)
│
└── agent-runner/               # Separate product
```

### Option B: By Function (Current but Cleaned)
```
surfaces/                           # UI Components (libraries only)
└── platform/                   # @allternit/platform (was allternit-platform)

cmd/                         # Applications (runnable)
├── shell-web/                  # @allternit/shell-web
├── shell-desktop/              # @allternit/shell-desktop
└── shell-terminal/             # @allternit/shell-terminal
```

### Option C: Flat Apps Structure
```
apps/                           # All applications
├── shell-core/                 # Shared library
├── shell-web/
├── shell-desktop/
└── shell-terminal/

packages/                       # Shared packages
├── ui/                         # UI components
├── runtime/                    # Runtime adapters
└── ...
```

## Immediate Actions Needed

1. **Resolve naming inconsistency**: Pick one namespace (@allternit)
2. **Clarify surfaces/shell-ui**: Is it being used? What is it for?
3. **Consolidate shell structure**: Move shell-electron to be child of shell, or rename
4. **Document the relationship**: shell-desktop wraps shell-web which mounts platform

## Questions to Answer

1. Is `surfaces/shell-ui` (Rust views) being used or is it experimental?
2. Should TUI be part of "shell" family or separate product?
3. Do we need both web and desktop, or can desktop be the primary?
4. What's the migration path for `surfaces/allternit-platform`?
