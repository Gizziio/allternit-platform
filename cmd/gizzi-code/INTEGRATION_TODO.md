# Integration Todo List - API URL MIGRATION COMPLETE

**Last Updated**: 2026-04-04  
**Status**: API URLs MIGRATED ✅

---

## ✅ COMPLETED: API URL Migration

### All API URLs Changed from Anthropic to Allternit

| Old URL | New URL | Status |
|---------|---------|--------|
| `api.anthropic.com` | `api.allternit.io` | ✅ |
| `console.anthropic.com` | `console.allternit.io` | ✅ |
| `platform.claude.com` | `console.allternit.io` | ✅ |
| `claude.com` | `allternit.io` | ✅ |
| `claude.ai` | `allternit.io` | ✅ |
| `mcp-proxy.anthropic.com` | `mcp-proxy.allternit.io` | ✅ |
| `www.anthropic.com` | `www.allternit.io` | ✅ |
| `status.anthropic.com` | `status.allternit.io` | ✅ |
| `docs.anthropic.com` | `docs.allternit.io` | ✅ |
| `support.anthropic.com` | `support.allternit.io` | ✅ |
| `anthropic.com/legal/*` | `allternit.io/legal/*` | ✅ |

### Files Updated (50+ files)
- `src/constants/oauth.ts` - OAuth endpoints
- `src/constants/product.ts` - Product URLs
- `src/constants/allternit-api.ts` - New Allternit API config
- `src/runtime/services/api/filesApi.ts`
- `src/runtime/services/api/metricsOptOut.ts`
- `src/runtime/services/mcp/officialRegistry.ts`
- `src/runtime/services/analytics/*.ts`
- `src/cli/ui/components/Feedback*.tsx`
- `src/shared/utils/*`
- Plus 30+ more files...

### New File Created
- `src/constants/allternit-api.ts` - Centralized Allternit API configuration

---

## REMAINING TASKS

### 1. Import Path Fixes
- [ ] Fix `src/*` path aliases
- [ ] Fix relative imports
- [ ] Ensure all imports resolve

### 2. Build & Test
- [ ] Add React/Ink dependencies
- [ ] Configure build
- [ ] Test compilation
- [ ] Test runtime

### 3. Wire Entrypoint
- [ ] Merge `main.ts` with `main-claude.tsx`
- [ ] Connect commands
- [ ] Set up React/Ink renderer

### 4. Resolve Command Conflicts
- [ ] Choose: `commit.ts` vs `commit-claude.ts`
- [ ] Choose: `doctor/` vs `doctor-claude/`
- [ ] Remove `-claude` suffixes

### 5. Clean Up
- [ ] Delete backup directories (`*-gizzi-backup/`)

---

## STRUCTURE SUMMARY

```
src/
├── cli/
│   ├── commands/              # 100 merged commands
│   ├── hooks/                 # 85 merged hooks  
│   └── ui/
│       ├── components/        # 409 React/Ink components
│       ├── ink-renderer/      # 100 Ink files
│       ├── tui-gizzi-backup/  # (to delete)
│       └── components-gizzi-backup/ # (to delete)
├── runtime/
│   ├── tools/builtins/        # 75 merged tools
│   ├── services/              # merged services
│   └── claude-core/           # core files
├── constants/
│   ├── allternit-api.ts       # NEW: Allternit API config
│   ├── oauth.ts               # UPDATED: Allternit OAuth
│   └── product.ts             # UPDATED: Allternit URLs
├── types/merged/              # unified types
└── ... (other merged dirs)
```

---

## SUMMARY

✅ **Code Integration**: All Claude files merged  
✅ **Rebranding**: "Claude Code" → "Gizzi"  
✅ **API URLs**: All Anthropic → Allternit  
🚧 **Import Fixes**: Pending  
🚧 **Build**: Pending  
🚧 **Testing**: Pending
