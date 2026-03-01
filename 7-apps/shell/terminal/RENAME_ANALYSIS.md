# Opencode → A2R Rename Analysis

## Summary
This document provides a comprehensive analysis of all changes needed to rename from "opencode" to "a2r" in the terminal app.

## Categories of Changes

### 1. Package Names (@opencode-ai/* → @a2r/*)

| Old Package | New Package | Usage Count | Files |
|-------------|-------------|-------------|-------|
| `@opencode-ai/sdk` | `@a2r/sdk` | ~30 imports | session/, cli/, tool/, provider/, acp/, etc. |
| `@opencode-ai/sdk/v2` | `@a2r/sdk/v2` | ~15 imports | session/, cli/, acp/, share/, ui/ |
| `@opencode-ai/plugin` | `@a2r/plugin` | ~5 imports | cli/cmd/, tool/ |
| `@opencode-ai/util` | `@a2r/util` | ~15 imports | storage/, session/, config/, cli/, bun/, etc. |
| `@opencode-ai/script` | `@a2r/script` | ~5 imports | script/ directory |
| `@opencode-ai/app` | `@a2r/app` | workspace ref | bun.lock |

**Files to update:**
- `package.json` (dependencies and devDependencies)
- `github/package.json` (dependencies)
- All TypeScript files with import statements
- `bun.lock` (will be regenerated)

### 2. Environment Variables (OPENCODE_* → A2R_*)

| Old Variable | New Variable | Usage Location |
|--------------|--------------|----------------|
| `OPENCODE=1` | Already using `A2R=1` ✅ | src/index.ts |
| `OPENCODE_CLIENT` | `A2R_CLIENT` | src/cli/cmd/acp.ts:23 |
| `OPENCODE_TEST_HOME` | `A2R_TEST_HOME` | global/index.ts, test files |
| `OPENCODE_TEST_MANAGED_CONFIG_DIR` | `A2R_TEST_MANAGED_CONFIG_DIR` | config/config.ts, test/ |
| `OPENCODE_CONFIG_CONTENT` | `A2R_CONFIG_CONTENT` | config/config.ts:188 |
| `OPENCODE_CONFIG_DIR` | `A2R_CONFIG_DIR` | Flag usage, test/ |
| `OPENCODE_BIN_PATH` | `A2R_BIN_PATH` | bin/opencode:20 |
| `OPENCODE_SERVER_PASSWORD` | `A2R_SERVER_PASSWORD` | cli/cmd/tui/attach.ts:61 |

**Files to update:**
- `src/index.ts` (partially done)
- `src/global/index.ts`
- `src/cli/cmd/acp.ts`
- `src/cli/cmd/tui/attach.ts`
- `src/config/config.ts`
- `src/flag/flag.ts` (check for OPENCODE_CONFIG_DIR)
- All test files
- `bin/opencode` script

### 3. File Paths and Directories (.opencode → .a2r)

| Old Path | New Path | Usage Location |
|----------|----------|----------------|
| `.opencode/` | `.a2r/` | config/, session/, agent/, tool/, skill/, etc. |
| `opencode.db` | Already `a2r.db` ✅ | storage/db.ts |
| `opencode.json` | `a2r.json` | config/, mcp/, uninstall/ |
| `opencode.jsonc` | `a2r.jsonc` | config/, global/ |
| `~/.opencode/` | `~/.a2r/` | install, action.yml, uninstall |
| `.opencode/plans/` | `.a2r/plans/` | session/, agent/ |
| `.opencode/agents/` | `.a2r/agents/` | config/, cli/cmd/ |
| `.opencode/commands/` | `.a2r/commands/` | config/ |
| `.opencode/skills/` | `.a2r/skills/` | skill/, test/ |
| `.opencode/plugins/` | `.a2r/plugins/` | config/, test/ |

**Files to update:**
- `src/config/config.ts` (lines 78, 134, 138, 144, 147, 154, 163, 277, 328, 333, 336, 377, 416)
- `src/session/index.ts:330`
- `src/agent/agent.ts:106`
- `src/tool/registry.ts`
- `src/skill/skill.ts:122`
- `src/cli/cmd/agent.ts:103`
- `src/cli/cmd/mcp.ts:373, 377`
- `src/cli/cmd/uninstall.ts:221, 272, 297, 303, 304`
- `src/storage/db.ts` (already updated ✅)
- `src/global/index.ts` (legacy migration paths - keep as "opencode" for migration)
- `src/file/ripgrep.ts:296`
- `install` script
- `github/action.yml`
- Test files

### 4. URLs (opencode.ai → a2r.dev)

| Old URL | New URL | Usage Location |
|---------|---------|----------------|
| `https://opencode.ai` | `https://a2r.dev` | github/, cli/, server/ |
| `https://api.opencode.ai` | `https://api.a2r.dev` | github/, cli/ |
| `https://dev.opencode.ai` | `https://dev.a2r.dev` | infra/, github/ |
| `https://app.opencode.ai` | `https://app.a2r.dev` | server/ |
| `*.opencode.ai` | `*.a2r.dev` | server/ |
| `*.dev.opencode.ai` | `*.dev.a2r.dev` | infra/ |

**Files to update:**
- `src/cli/cmd/github.ts:363, 476`
- `src/server/server.ts:123, 551, 555`
- `src/github/index.ts:365, 376, 385`
- `github/action.yml:38, 55, 65`
- `infra/stage.ts:3, 4`
- Test files

### 5. Function Names (createOpencode* → createA2R*)

| Old Name | New Name | Usage Location |
|----------|----------|----------------|
| `createOpencodeClient()` | `createA2RClient()` | github/, cli/, session/, acp/, tui/ |
| `createOpencode()` | `createA2R()` | script/, cli/ |
| `createA2RClient` (from sdk) | Same, check import | multiple files |

**Files to update:**
- `src/cli/cmd/run.ts:10`
- `src/cli/cmd/acp.ts:7`
- `src/cli/cmd/generate.ts:17`
- `src/cli/cmd/tui/worker.ts:10`
- `src/github/index.ts:9`
- `script/changelog.ts:4`
- `script/duplicate-pr.ts:5`

### 6. CLI Name and Binaries

| Old | New | Status |
|-----|-----|--------|
| `bin/opencode` | `bin/a2r` (exists ✅) | Done |
| `opencode` command | `a2r` | package.json done ✅ |

### 7. Theme and UI References

| Old | New | Usage |
|-----|-----|-------|
| `opencode` theme | `a2r` theme | cli/cmd/tui/context/theme.tsx:354 |
| `opencode.json` theme | `a2r.json` theme | theme files |

### 8. Provider Options / Config Keys

| Old Key | New Key | Usage |
|---------|---------|-------|
| `providerOptions?.opencode` | `providerOptions?.a2r` | provider/transform.ts, test/ |

### 9. Test Environment Variables

Test files that need OPENCODE_TEST_HOME → A2R_TEST_HOME:
- `test/agent/agent.test.ts` (lines 549, 550, 563)
- `test/tool/skill.test.ts` (lines 39, 40, 52, 77, 78, 109)
- `test/skill/skill.test.ts` (lines 76, 77, 90, 191, 192, 207, 256, 257, 286)
- `test/config/config.test.ts` (lines 13, 606, 607, 617, 618, 631, 632, 646, 647)

### 10. IDE References

| Old | New | Usage |
|-----|-----|-------|
| `sst-dev.opencode` | `sst-dev.a2r` or `a2r` | ide/index.ts:55 |

## Migration Strategy

### Phase 1: Package Dependencies
1. Update package.json files
2. Update all import statements
3. Regenerate bun.lock

### Phase 2: Environment Variables
1. Update process.env.OPENCODE_* → process.env.A2R_*
2. Update flag definitions
3. Update test files

### Phase 3: File Paths
1. Update .opencode → .a2r in all paths
2. Update opencode.json → a2r.json
3. Keep legacy migration code for backward compatibility

### Phase 4: URLs
1. Update opencode.ai → a2r.dev
2. Update API endpoints

### Phase 5: Function Names
1. Update createOpencodeClient → createA2RClient
2. Update imports and usages

### Phase 6: Testing
1. Run typecheck
2. Run tests
3. Verify builds

## Backward Compatibility

The following should maintain backward compatibility:
- Legacy config migration in `global/index.ts` (keep reading from .opencode)
- Database migration from opencode.db → a2r.db (already done)
- Environment variable fallback (optional)

## Files Exempt from Renaming

These files should NOT be renamed:
- Legacy migration paths in `global/index.ts`
- Comments explaining historical context
- External references (other projects mentioning opencode)
- Git history / commit messages
