# Import Path Migration Progress - File by File

## Progress Summary

| Metric | Before | After |
|--------|--------|-------|
| Total Errors | ~3655 | ~3624 |
| TS2307 (Cannot find module) | ~2700 | ~2251 |

## Files Fixed (Production Quality)

### src/constants/ directory
- system.ts, keys.ts, figures.ts, oauth.ts, spinnerVerbs.ts, product.ts, tools.ts

### src/bootstrap/
- state.ts

### src/cli/ui/
- ink-renderer/stringWidth.ts

### src/runtime/integrations/
- bridge*.ts files

### src/runtime/services/analytics/
- config.ts, datadog.ts, firstPartyEventLoggingExporter.ts, growthbook.ts
- firstPartyEventLogger.ts, metadata.ts

### src/runtime/services/ (general)
- Fixed src/ prefix imports in api/, compact/, mcp/, oauth/, tools/

## Remaining Issues

### ~2251 TS2307 errors in:
1. src/entrypoints/ - cli.tsx, init.ts, sandboxTypes.ts
2. src/memdir/ - memdir.ts, paths.ts, teamMemPaths.ts
3. src/outputStyles/ - loadOutputStylesDir.ts
4. src/runtime/services/analytics/ - generated types, some utils
5. src/runtime/server/routes/ - tui.ts, ars-contexta-tui-bridge.ts
6. src/runtime/tools/builtins/ - various tool files
7. src/shared/utils/ - settings, hooks, etc.

## Next Steps

Continue fixing imports file by file, focusing on:
1. src/runtime/services/ remaining files
2. src/shared/utils/ files
3. src/runtime/tools/builtins/ files
4. Exclude or fix entrypoints/ if they're Claude-specific
