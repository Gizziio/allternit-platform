# TUI Consolidation Migration

## Summary

Consolidated the fragmented TUI/CLI structure into a clean separation:

### New Structure

```
7-apps/
├── cli/                    # Rust CLI (infrastructure commands only)
│   └── src/commands/
│       ├── daemon.rs       # Platform lifecycle (up/down)
│       ├── status.rs       # Health checks
│       ├── auth.rs         # Authentication
│       └── ...             # Infrastructure commands
│       ~~└── tui.rs~~      # REMOVED - Use 7-apps/tui instead
│
└── tui/
    └── a2r-shell/          # TypeScript/Bun TUI (MOVED from agent-shell)
        ├── packages/
        │   └── a2r-shell/  # SolidJS Terminal UI
        └── bin/opencode    # Entry point (will rename to a2r-tui)
```

### Entry Points

| Command | Implementation | Location |
|---------|---------------|----------|
| `a2r tui` | TypeScript/Bun TUI | `7-apps/tui/a2r-shell/` |
| `a2r up/down/status` | Rust CLI | `7-apps/cli/` |
| `a2r logs` | Rust CLI | `7-apps/cli/` |

### What Changed

1. **Moved**: `7-apps/agent-shell/a2r-shell` → `7-apps/tui/a2r-shell`
2. **Updated**: `bin/a2r` wrapper to launch TypeScript TUI for `tui` command
3. **Disabled**: Rust TUI in `7-apps/cli/src/commands/tui.rs` (to be removed)
4. **Temporarily disabled**: Rust CLI from Cargo workspace build

### Verification

Run these commands to verify the migration:

```bash
# Launch TypeScript TUI (should work)
./bin/a2r tui

# Or directly
cd 7-apps/tui/a2r-shell && bun run dev

# Infrastructure commands (requires Rust CLI build)
cargo build --package a2rchitech-cli
./bin/a2r status
```

### Testing

All 188 tests pass in the TUI:

```bash
cd 7-apps/tui/a2r-shell
bun test
```

### Remaining Work

1. [ ] Remove Rust TUI code from `7-apps/cli/src/commands/tui.rs`
2. [ ] Re-enable Rust CLI in Cargo.toml after cleanup
3. [ ] Rename `bin/opencode` → `bin/a2r-tui`
4. [ ] Update package.json names from "a2r-shell" → "a2r-tui"
5. [ ] Complete OpenCode → A2R rebranding in code
