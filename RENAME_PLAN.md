# Opencode to A2R Rename Plan

## Overview
This document outlines the systematic renaming of "opencode" references to "a2r" / "a2rchitect" throughout the codebase.

## Rename Mapping

### 1. Package/Module Names
| From | To |
|------|-----|
| `@opencode-ai/*` | `@a2rchitect/*` |
| `opencode` (CLI binary) | `a2r` (already done in bin) |
| `opencode.db` | `a2r.db` |

### 2. Environment Variables
| From | To |
|------|-----|
| `OPENCODE=1` | `A2R=1` |
| `OPENCODE_*` | `A2R_*` |
| `OPENCODE_STORAGE_*` | `A2R_STORAGE_*` |

### 3. Code References
| From | To |
|------|-----|
| `opencode` (log name) | `a2r` |
| `opencode.db` (file) | `a2r.db` |
| `opencode-*` (profile IDs) | `a2r-*` |
| `opencode` (VSCode command) | `a2r` |

### 4. Infrastructure/Config
| From | To |
|------|-----|
| `opencode.ai` domain | `a2r.dev` or keep for now |
| `OpenCode Black` (brand) | `A2rchitect` |
| Console name | `a2r` |

## Files to Modify

### High Priority (Terminal App)
1. `7-apps/shell/terminal/src/index.ts`
   - Line 13: `@opencode-ai/util/error` 
   - Line 78: `process.env.OPENCODE = "1"`
   - Line 80: `Log.Default.info("opencode", ...)`
   - Line 85: `"opencode.db"` → `"a2r.db"`

2. `7-apps/shell/terminal/package.json`
   - Check for `@opencode-ai/*` dependencies

3. `7-apps/shell/terminal/infra/*`
   - `OPENCODE_STORAGE_*` env vars
   - `opencode.ai` domains

4. `7-apps/shell/terminal/sdks/vscode/src/extension.ts`
   - `opencode.*` commands → `a2r.*`
   - `TERMINAL_NAME = "opencode"`

### Medium Priority (Platform/UI)
5. `6-ui/a2r-platform/src/integration/api-client.ts`
   - `'opencode-acp'` profile mappings

6. `6-ui/a2r-platform/src/services/ProviderAuthService.ts`
   - Comments referencing OpenCode

### Low Priority (Docs/Config)
7. Infrastructure files
8. Documentation
9. Test files

## Patterns to Extract from Terminal

### UI Components (`src/ui/a2r/`)
These React/Terminal UI components can be mapped:

| Terminal Component | Desktop Equivalent | Notes |
|-------------------|-------------------|-------|
| `banner.tsx` | Shell header/branding | Brand display |
| `frame.tsx` | Window frame | Container component |
| `header.tsx` | App header | Navigation header |
| `inline-block.tsx` | Message blocks | Chat message display |
| `inline-coerce.ts` | Text processing | Content formatting |
| `message-list.tsx` | Message list | Chat history |
| `provider.tsx` | Context providers | React context |
| `runtime-lane.ts` | Status lanes | Runtime status |
| `runtime-mode.ts` | Mode indicator | Current mode display |
| `spinner.tsx` | Loading spinner | Loading states |
| `status-bar.tsx` | Status bar | Bottom status |
| `status-runtime.ts` | Runtime status | Status management |
| `theme.ts` | Theme config | Styling/theming |
| `useBrand.ts` | Brand hook | Brand utilities |

### Core Patterns

#### 1. CLI Command Structure
Terminal: `src/cli/cmd/*.ts`
- Pattern: Command classes with `yargs` integration
- Desktop mapping: IPC handlers in `main/sidecar-integration.cjs`

#### 2. Session Management
Terminal: `src/session/*.ts`
- Pattern: Session lifecycle, messages, prompts
- Desktop mapping: `useWorkspace()` hook + HTTP client

#### 3. Tool System
Terminal: `src/tool/*.ts`
- Pattern: Tool registration and execution
- Desktop mapping: Skills registry in workspace API

#### 4. Agent Workspace Bridge
Terminal: `src/agent-workspace/*.ts`
- Pattern: Kernel sync, artifacts, context
- Desktop mapping: `agent-workspace/` module (already integrated)

#### 5. UI Animation System
Terminal: `src/ui/animation/*.ts`
- Pattern: Animation driver and registry
- Desktop mapping: React animation libraries or CSS transitions

#### 6. Brand/Theming
Terminal: `src/brand/*.ts` + `src/ui/a2r/theme.ts`
- Pattern: Dynamic theming, brand colors
- Desktop mapping: `design/` system in a2r-platform

#### 7. Status/Runtime Management
Terminal: `src/ui/a2r/status-*.ts`, `src/ui/a2r/runtime-*.ts`
- Pattern: Status bar, runtime modes
- Desktop mapping: Shell status bar, connection indicators

## Implementation Steps

### Phase 1: Rename (Critical)
1. Update all `opencode` → `a2r` in terminal app
2. Fix package.json dependencies
3. Update environment variables
4. Test terminal app still works

### Phase 2: Extract Patterns
1. Document UI component patterns from `src/ui/a2r/`
2. Map terminal commands to Electron IPC
3. Extract session management patterns
4. Port animation/theme system

### Phase 3: Integration
1. Port UI components to desktop
2. Implement matching IPC handlers
3. Unify theme/styling
4. Test full integration

## Verification Checklist

- [ ] Terminal app builds after rename
- [ ] No "opencode" references in critical paths
- [ ] Desktop app connects properly
- [ ] UI components render correctly
- [ ] Session management works
- [ ] Tool/skill system functional
