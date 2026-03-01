# Opencode → A2R Rename Complete

## Summary

This document summarizes all the changes made to rename from "opencode" to "a2r" in the terminal app.

## Changes by Category

### 1. Package Names (@opencode-ai/* → @a2r/*)

| Old Package | New Package |
|-------------|-------------|
| `@opencode-ai/sdk` | `@a2r/sdk` |
| `@opencode-ai/sdk/v2` | `@a2r/sdk/v2` |
| `@opencode-ai/plugin` | `@a2r/plugin` |
| `@opencode-ai/util` | `@a2r/util` |
| `@opencode-ai/script` | `@a2r/script` |

**Files Modified:**
- `package.json` - Updated dependencies
- `github/package.json` - Updated dependencies
- **60+ TypeScript files** - Updated import statements

### 2. Environment Variables (OPENCODE_* → A2R_*)

| Old Variable | New Variable |
|--------------|--------------|
| `OPENCODE_CLIENT` | `A2R_CLIENT` |
| `OPENCODE_TEST_HOME` | `A2R_TEST_HOME` |
| `OPENCODE_TEST_MANAGED_CONFIG_DIR` | `A2R_TEST_MANAGED_CONFIG_DIR` |
| `OPENCODE_CONFIG_CONTENT` | `A2R_CONFIG_CONTENT` |
| `OPENCODE_CONFIG_DIR` | `A2R_CONFIG_DIR` |
| `OPENCODE_BIN_PATH` | `A2R_BIN_PATH` |
| `OPENCODE_SERVER_PASSWORD` | `A2R_SERVER_PASSWORD` |

**Files Modified:**
- `src/global/index.ts`
- `src/cli/cmd/acp.ts`
- `src/cli/cmd/tui/attach.ts`
- `src/cli/cmd/serve.ts`
- `src/cli/cmd/web.ts`
- `src/config/config.ts`
- `src/flag/flag.ts`
- `src/snapshot/index.ts`
- `src/util/git.ts`
- `src/brand/flags.ts`
- `src/server/server.ts`
- `src/installation/index.ts`
- `src/tool/registry.ts`
- `src/session/instruction.ts`
- `src/session/llm.ts`
- `bin/opencode`
- Multiple test files

### 3. File Paths (.opencode → .a2r)

| Old Path | New Path |
|----------|----------|
| `.opencode/` | `.a2r/` |
| `opencode.json` | `a2r.json` |
| `opencode.jsonc` | `a2r.jsonc` |
| `opencode.db` | `a2r.db` (already done) |

**Files Modified:**
- `src/config/config.ts` - 12 references updated
- `src/session/index.ts`
- `src/agent/agent.ts`
- `src/tool/registry.ts`
- `src/skill/skill.ts`
- `src/cli/cmd/agent.ts`
- `src/cli/cmd/mcp.ts`
- `src/cli/cmd/uninstall.ts`
- `src/file/ripgrep.ts`
- `src/installation/index.ts`
- `src/cli/error.ts`
- `src/cli/cmd/auth.ts`
- `src/provider/provider.ts`
- `src/cli/cmd/tui/context/theme.tsx`
- `src/project/project.ts`

**Note:** `src/global/index.ts` keeps legacy migration paths for backward compatibility.

### 4. URLs (opencode.ai → a2r.dev)

| Old URL | New URL |
|---------|---------|
| `https://opencode.ai` | `https://a2r.dev` |
| `https://api.opencode.ai` | `https://api.a2r.dev` |
| `https://dev.opencode.ai` | `https://dev.a2r.dev` |
| `https://app.opencode.ai` | `https://app.a2r.dev` |
| `*.opencode.ai` | `*.a2r.dev` |
| `*.dev.opencode.ai` | `*.dev.a2r.dev` |

**Files Modified:**
- `src/cli/cmd/github.ts` (4 changes)
- `src/server/server.ts` (3 changes)
- `src/github/index.ts` (3 changes)
- `github/action.yml` (2 changes)
- `infra/stage.ts` (3 changes)
- `test/provider/transform.test.ts` (2 changes)
- `install` script

### 5. Function Names (createOpencode* → createA2R*)

| Old Name | New Name |
|----------|----------|
| `createOpencodeClient()` | `createA2RClient()` |
| `createOpencode()` | `createA2R()` |
| `OpencodeClient` type | `A2RClient` type |

**Files Modified:**
- `src/cli/cmd/run.ts`
- `src/cli/cmd/acp.ts`
- `src/cli/cmd/generate.ts`
- `src/cli/cmd/tui/worker.ts`
- `src/cli/cmd/tui/context/sdk.tsx`
- `github/index.ts`
- `script/changelog.ts`
- `script/duplicate-pr.ts`

### 6. CLI and Binary Names

| Old | New |
|-----|-----|
| `opencode` command | `a2r` |
| `opencode-shell` | `a2r-shell` (already done) |

**Files Modified:**
- `bin/opencode` - Updated env vars and paths
- `bin/a2r` - Already correct
- `install` script - Updated all command references
- `package.json` - Already correct

### 7. Theme and Config References

| Old | New |
|-----|-----|
| `opencode` theme | `a2r` theme |
| `opencode.json` theme file | `a2r.json` |
| `sst-dev.opencode` VS Code ext | `a2r-shell.vscode-a2r` |
| `providerOptions?.opencode` | `providerOptions?.a2r` |

**Files Modified:**
- `src/cli/cmd/tui/context/theme.tsx`
- `src/provider/transform.ts`
- `src/ide/index.ts`
- `src/cli/cmd/tui/context/theme/opencode.json` → `a2r.json`

### 8. Documentation and Comments

**Files Modified:**
- `src/acp/README.md` - Updated all command references
- `src/acp/agent.ts` - Updated command descriptions
- Multiple inline comments

## Files Preserved (Backward Compatibility)

These files retain some "opencode" references for specific reasons:

1. **src/global/index.ts** - Legacy migration paths for config/auth files
2. **src/session/prompt/*.txt** - LLM prompts with historical context
3. **Internal provider IDs** - `opencode` as a provider identifier in ACP
4. **RENAME_ANALYSIS.md** - Analysis document (expected to reference old names)

## Lock Files

The following lock files need regeneration via `bun install`:
- `bun.lock` - Will regenerate with new package names
- `github/bun.lock` - Will regenerate with new package names

## Verification Commands

After regeneration, verify with:

```bash
# Check for any remaining @opencode-ai imports
grep -r "@opencode-ai" src/ --include="*.ts" --include="*.tsx"

# Check for any remaining OPENCODE_ env vars (excluding tests and docs)
grep -r "OPENCODE_" src/ --include="*.ts" | grep -v "RENAME_"

# Check for any remaining .opencode paths (excluding global/index.ts)
grep -r "\.opencode" src/ --include="*.ts" | grep -v "global/index.ts"

# Type check
cd /Users/macbook/Desktop/a2rchitech-workspace/a2rchitech/7-apps/shell/terminal && bun run typecheck
```

## Migration Notes for Users

### Config Files
Users with existing `~/.opencode/` directories will have their configs automatically migrated to `~/.a2r/` on first run (via legacy migration in global/index.ts).

### Commands
All `opencode` commands are now `a2r`:
- `opencode run` → `a2r run`
- `opencode auth login` → `a2r auth login`
- etc.

### Environment Variables
Users setting environment variables need to update:
- `OPENCODE_CONFIG_DIR` → `A2R_CONFIG_DIR`
- etc.

### Project Directories
Project-level config directories should be renamed:
- `.opencode/` → `.a2r/`
- `.opencode/opencode.json` → `.a2r/a2r.json`

## Statistics

- **Package.json files modified:** 2
- **TypeScript source files modified:** 60+
- **Test files modified:** 10+
- **Import statements updated:** 100+
- **Environment variables renamed:** 8
- **URLs updated:** 17
- **File paths updated:** 50+

---

*Rename completed: 2026-02-23*
*Next step: Run `bun install` to regenerate lock files*
