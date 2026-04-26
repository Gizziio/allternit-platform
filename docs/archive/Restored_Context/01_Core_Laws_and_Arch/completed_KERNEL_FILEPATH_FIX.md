# Kernel Filepath Fix Summary

## What Was Wrong
Kernel implementation code was being added to:
- `services/orchestration/kernel-service/src/brain/` (should be thin wiring only)
- `cmd/cli/src/commands/tui.rs` (should be UI-only)

## What Should Be Where

### domains/kernel/ (Kernel Libraries - IMPLEMENTATION BELONGS HERE)
```
domains/kernel/infrastructure/allternit-providers/src/
├── adapters/           - Provider adapters (Claude, OpenAI, etc.)
├── router/             - Provider routing
└── runtime/            - [MOVED] Runtime provider system
    ├── auth.rs         - Auth status checking (from brain/providers/)
    ├── models.rs       - Model discovery (from brain/providers/)
    └── mod.rs

domains/kernel/infrastructure/allternit-acp-driver/src/
├── lib.rs              - ACP driver library
├── driver.rs           - [TO REFACTOR] from brain/drivers/acp.rs
├── protocol.rs         - ACP protocol types
└── session.rs          - Session management
```

### services/orchestration/kernel-service/ (Thin Service - WIRING ONLY)
```
src/
├── main.rs             - Entry point, route registration
├── brain/
│   ├── mod.rs          - Re-exports from domains/kernel
│   ├── gateway.rs      - [SHOULD BE THIN] HTTP handlers only
│   ├── manager.rs      - [SHOULD BE THIN] Calls into domains/kernel
│   └── types.rs        - Shared types
└── ...
```

### cmd/cli/ (TUI Client - UI ONLY)
```
src/
├── commands/
│   └── tui.rs          - UI calls to kernel HTTP endpoints
└── client.rs           - HTTP client for kernel API
```

## Files Moved

| From (Wrong Location) | To (Correct Location) | Status |
|----------------------|----------------------|--------|
| services/.../brain/providers/auth.rs | domains/kernel/.../allternit-providers/src/runtime/auth.rs | ✅ Copied |
| services/.../brain/providers/models.rs | domains/kernel/.../allternit-providers/src/runtime/models.rs | ✅ Copied |
| services/.../brain/providers/mod.rs | domains/kernel/.../allternit-providers/src/runtime/mod.rs | ✅ Copied |
| services/.../brain/drivers/acp.rs | domains/kernel/.../allternit-acp-driver/src/ | 🔄 Needs refactoring |

## Next Steps

1. **Refactor allternit-acp-driver** - Extract ACP logic from brain/drivers/acp.rs into standalone library
2. **Update allternit-providers** - Add runtime module exports to lib.rs
3. **Update kernel-service** - Replace implementations with calls to domains/kernel libs
4. **Verify builds** - Ensure all crates compile with new structure
5. **Remove duplicates** - Delete implementation code from services after migration complete

## Dependencies

After migration:
```
services/kernel-service
├── allternit-providers (from domains/kernel/infrastructure/allternit-providers)
└── allternit-acp-driver (from domains/kernel/infrastructure/allternit-acp-driver)
```

## Notes

- The TUI in cmd/cli/ should NOT contain kernel logic
- The kernel-service should be a thin HTTP layer
- All business logic lives in domains/kernel/ libraries
