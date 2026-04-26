# Opencode to Allternit Rename Plan

## Overview
This document outlines the systematic renaming of "opencode" references to "allternit" / "allternit" throughout the codebase.

## Rename Mapping

### 1. Package/Module Names
| From | To |
|------|-----|
| `@opencode-ai/*` | `@allternit/*` |
| `opencode` (CLI binary) | `allternit` (already done in bin) |
| `opencode.db` | `allternit.db` |

### 2. Environment Variables
| From | To |
|------|-----|
| `OPENCODE=1` | `Allternit=1` |
| `OPENCODE_*` | `ALLTERNIT_*` |
| `OPENCODE_STORAGE_*` | `ALLTERNIT_STORAGE_*` |

### 3. Code References
| From | To |
|------|-----|
| `opencode` (log name) | `allternit` |
| `opencode.db` (file) | `allternit.db` |
| `opencode-*` (profile IDs) | `allternit-*` |
| `opencode` (VSCode command) | `allternit` |

### 4. Infrastructure/Config
| From | To |
|------|-----|
| `opencode.ai` domain | `allternit.dev` or keep for now |
| `OpenCode Black` (brand) | `allternit` |
| Console name | `allternit` |

## Files to Modify

### High Priority (Terminal App)
1. `cmd/shell/terminal/src/index.ts`
   - Line 13: `@opencode-ai/util/error` 
   - Line 78: `process.env.OPENCODE = "1"`
   - Line 80: `Log.Default.info("opencode", ...)`
   - Line 85: `"opencode.db"` → `"allternit.db"`

2. `cmd/shell/terminal/package.json`
   - Check for `@opencode-ai/*` dependencies

3. `cmd/shell/terminal/infra/*`
   - `OPENCODE_STORAGE_*` env vars
   - `opencode.ai` domains

4. `cmd/shell/terminal/sdks/vscode/src/extension.ts`
   - `opencode.*` commands → `allternit.*`
   - `TERMINAL_NAME = "opencode"`

### Medium Priority (Platform/UI)
5. `surfaces/allternit-platform/src/integration/api-client.ts`
   - `'opencode-acp'` profile mappings

6. `surfaces/allternit-platform/src/services/ProviderAuthService.ts`
   - Comments referencing OpenCode

### Low Priority (Docs/Config)
7. Infrastructure files
8. Documentation
9. Test files

## Patterns to Extract from Terminal

### UI Components (`src/ui/allternit/`)
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
Terminal: `src/brand/*.ts` + `src/ui/allternit/theme.ts`
- Pattern: Dynamic theming, brand colors
- Desktop mapping: `design/` system in allternit-platform

#### 7. Status/Runtime Management
Terminal: `src/ui/allternit/status-*.ts`, `src/ui/allternit/runtime-*.ts`
- Pattern: Status bar, runtime modes
- Desktop mapping: Shell status bar, connection indicators

## Implementation Steps

### Phase 1: Rename (Critical)
1. Update all `opencode` → `allternit` in terminal app
2. Fix package.json dependencies
3. Update environment variables
4. Test terminal app still works

### Phase 2: Extract Patterns
1. Document UI component patterns from `src/ui/allternit/`
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
