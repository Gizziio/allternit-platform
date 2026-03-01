# Kernel Filepath Fix Summary

## What Was Wrong
Kernel implementation code was being added to:
- `4-services/orchestration/kernel-service/src/brain/` (should be thin wiring only)
- `7-apps/cli/src/commands/tui.rs` (should be UI-only)

## What Should Be Where

### 1-kernel/ (Kernel Libraries - IMPLEMENTATION BELONGS HERE)
```
1-kernel/infrastructure/a2r-providers/src/
├── adapters/           - Provider adapters (Claude, OpenAI, etc.)
├── router/             - Provider routing
└── runtime/            - [MOVED] Runtime provider system
    ├── auth.rs         - Auth status checking (from brain/providers/)
    ├── models.rs       - Model discovery (from brain/providers/)
    └── mod.rs

1-kernel/infrastructure/a2r-acp-driver/src/
├── lib.rs              - ACP driver library
├── driver.rs           - [TO REFACTOR] from brain/drivers/acp.rs
├── protocol.rs         - ACP protocol types
└── session.rs          - Session management
```

### 4-services/orchestration/kernel-service/ (Thin Service - WIRING ONLY)
```
src/
├── main.rs             - Entry point, route registration
├── brain/
│   ├── mod.rs          - Re-exports from 1-kernel
│   ├── gateway.rs      - [SHOULD BE THIN] HTTP handlers only
│   ├── manager.rs      - [SHOULD BE THIN] Calls into 1-kernel
│   └── types.rs        - Shared types
└── ...
```

### 7-apps/cli/ (TUI Client - UI ONLY)
```
src/
├── commands/
│   └── tui.rs          - UI calls to kernel HTTP endpoints
└── client.rs           - HTTP client for kernel API
```

## Files Moved

| From (Wrong Location) | To (Correct Location) | Status |
|----------------------|----------------------|--------|
| 4-services/.../brain/providers/auth.rs | 1-kernel/.../a2r-providers/src/runtime/auth.rs | ✅ Copied |
| 4-services/.../brain/providers/models.rs | 1-kernel/.../a2r-providers/src/runtime/models.rs | ✅ Copied |
| 4-services/.../brain/providers/mod.rs | 1-kernel/.../a2r-providers/src/runtime/mod.rs | ✅ Copied |
| 4-services/.../brain/drivers/acp.rs | 1-kernel/.../a2r-acp-driver/src/ | 🔄 Needs refactoring |

## Next Steps

1. **Refactor a2r-acp-driver** - Extract ACP logic from brain/drivers/acp.rs into standalone library
2. **Update a2r-providers** - Add runtime module exports to lib.rs
3. **Update kernel-service** - Replace implementations with calls to 1-kernel libs
4. **Verify builds** - Ensure all crates compile with new structure
5. **Remove duplicates** - Delete implementation code from 4-services after migration complete

## Dependencies

After migration:
```
4-services/kernel-service
├── a2rchitech-providers (from 1-kernel/infrastructure/a2r-providers)
└── a2r-acp-driver (from 1-kernel/infrastructure/a2r-acp-driver)
```

## Notes

- The TUI in 7-apps/cli/ should NOT contain kernel logic
- The kernel-service should be a thin HTTP layer
- All business logic lives in 1-kernel/ libraries
