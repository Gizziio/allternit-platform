# WIH: Clean up blocks.rs warnings

## Description
Fix all compiler warnings in `src/tui_components/blocks.rs`

## Current Warnings
- `BlockManager` - never constructed
- `Cell` - never constructed
- `BlockType` - never used
- `BlockAction` - never used
- `BlockAction, BlockManager, BlockType, Cell` imports - unused
- `display_name` method - never used
- `icon` method - never used
- `mismatched lifetime syntax` on `display_lines`

## Tasks
- [ ] Decide: Remove unused types OR implement features
- [ ] If removing: Delete BlockManager, Cell, BlockType, BlockAction
- [ ] If keeping: Add `#[allow(dead_code)]` with justification comment
- [ ] Fix imports (remove unused)
- [ ] Fix lifetime syntax: `Vec<Line>` → `Vec<Line<'_>>`
- [ ] Verify: `cargo check` shows 0 warnings for blocks.rs

## Decision Matrix
| Item | Remove | Keep | Notes |
|------|--------|------|-------|
| BlockManager | ☐ | ☐ | Part of block editor feature |
| Cell | ☐ | ☐ | Grid cell for BlockManager |
| BlockType | ☐ | ☐ | Enum for block types |
| BlockAction | ☐ | ☐ | Actions for block editor |
| display_name | ☐ | ☐ | Could be used in UI |
| icon | ☐ | ☐ | Could be used in UI |

## Acceptance Criteria
- [ ] blocks.rs compiles with 0 warnings
- [ ] No functionality broken
- [ ] If features removed, documented in CHANGELOG
