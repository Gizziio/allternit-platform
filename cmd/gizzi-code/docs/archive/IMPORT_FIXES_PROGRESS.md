# Import Path Migration Progress

## Fixed (Production Quality)

### 1. Constants Files
- **src/constants/system.ts** - Fixed imports:
  - `../utils/debug.js` → `../shared/utils/debug.js`
  - `../utils/envUtils.js` → `../shared/utils/envUtils.js`
  - `../utils/model/providers.js` → `../shared/utils/model/providers.js`
  - `../utils/workloadContext.js` → `../shared/utils/workloadContext.js`
  - `../services/analytics/growthbook.js` → `../runtime/services/analytics/growthbook.js`

- **src/constants/keys.ts** - Fixed import:
  - `../utils/envUtils.js` → `../shared/utils/envUtils.js`

- **src/constants/figures.ts** - Fixed import:
  - `../utils/env.js` → `../shared/utils/env.js`

- **src/constants/oauth.ts** - Fixed import:
  - `../../utils/envUtils.js` → `../shared/utils/envUtils.js`

- **src/constants/spinnerVerbs.ts** - Fixed import:
  - `../utils/settings/settings.js` → `../shared/utils/settings/settings.js`

- **src/constants/product.ts** - Fixed import:
  - `../bridge/sessionIdCompat.js` → `../runtime/integrations/sessionIdCompat.js`

- **src/constants/tools.ts** - Fixed imports:
  - Changed all PascalCase tool paths to kebab-case
  - Removed imports for non-existent tools (skilltool, sendmessagetool, taskgettool, etc.)
  - Removed usages of non-existent tools in export statements

### 2. Bootstrap Files
- **src/bootstrap/state.ts** - Fixed imports:
  - `../tools/AgentTool/agentColorManager.js` → `../runtime/tools/builtins/agenttool/agentColorManager.js`
  - `../utils/crypto.js` → `../runtime/services/oauth/crypto.js`
  - `../utils/model/model.js` → `../runtime/types/model.js`
  - `../utils/model/modelStrings.js` → `../shared/utils/model/modelStrings.js`
  - `../utils/settings/constants.js` → `../runtime/tools/builtins/notebookedittool/constants.js`
  - `../utils/settings/settingsCache.js` → `../shared/utils/settings/settingsCache.js`
  - `../utils/settings/types.js` → `../shared/utils/settings/types.js`
  - `../utils/signal.js` → `../runtime/util/signal.js`

### 3. CLI UI Files
- **src/cli/ui/ink-renderer/stringWidth.ts** - Fixed import:
  - `../utils/intl.js` → `../../../shared/utils/intl.js`

### 4. Runtime Bridge Files
- **src/runtime/integrations/bridge*.ts** - Fixed relative imports:
  - `../utils/` → `../../shared/utils/`
  - `../constants/` → `../../constants/`
  - `../entrypoints/` → `../../entrypoints/`
  - `../types/` → `../../types/`
  - `../bootstrap/` → `../../bootstrap/`

### 5. Removed src/ Prefix Imports
Fixed `from 'src/...'` imports to proper relative paths across multiple files

### 6. Updated tsconfig
- **src/runtime/tsconfig.json** - Updated includes/excludes:
  - Added proper include paths
  - Excluded claude-core, integrations, entrypoints, memdir, outputStyles

## Remaining Issues

### Root Cause
The TypeScript build is still failing because:
1. Excluded files are still being processed (TypeScript follows imports from included files)
2. Many files import from paths that don't exist in Gizzi's structure
3. The Claude Code integration brought files that expect a different directory structure

### Error Count
- Total errors: ~3655
- TS2307 (Cannot find module): Majority of errors
- Other errors: Type mismatches, implicit any, etc.

### Key Problem Areas
1. **src/runtime/services/analytics/** - Imports to non-existent files
2. **src/runtime/integrations/** - Bridge files with broken imports (excluded but still imported)
3. **src/entrypoints/** - cli.tsx, init.ts with many broken imports
4. **src/memdir/** - Memory directory files with broken imports
5. **src/outputStyles/** - Output style files with broken imports

### Options to Complete

#### Option 1: Fix All Gizzi File Imports (Recommended)
Continue fixing imports file by file, only in Gizzi-specific files:
- Fix src/runtime/services/ imports
- Fix remaining src/shared/utils/ imports
- Fix src/runtime/tools/builtins/ imports

#### Option 2: Create Directory Aliases
Create missing directories with index.ts files that re-export from correct locations:
- src/utils/ → re-exports from runtime/util/, shared/utils/
- src/services/ → re-exports from runtime/services/
- src/tools/ → re-exports from runtime/tools/builtins/

This is production-quality code (proper module re-exports, not stubs).

#### Option 3: Revert Problematic Files
Revert constants/tools.ts and other modified Gizzi files to their pre-integration state.

## Current Build Status
```bash
# Runtime build errors
bun tsc -b src/runtime
# ~3655 errors (mostly TS2307)
```
