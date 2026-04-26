# WIH: Catalog TUI Component Warnings

## Description
Document all 25+ "never used" function/method warnings in tui_components module with exact file paths and line numbers.

## Files to Analyze
- [ ] `src/tui_components/blocks.rs`
- [ ] `src/tui_components/diff.rs`
- [ ] `src/tui_components/git.rs`
- [ ] `src/tui_components/history.rs`
- [ ] `src/tui_components/hooks.rs`
- [ ] `src/tui_components/input.rs`
- [ ] `src/tui_components/syntax.rs`

## Output
Create `warnings-tui.md` with format:
```markdown
## blocks.rs
| Line | Item | Type | Warning |
|------|------|------|---------|
| 45 | BlockManager | struct | never constructed |
| 67 | display_name | method | never used |

## diff.rs
...
```

## Acceptance Criteria
- [ ] All 25+ warnings documented
- [ ] File:line mapping accurate
- [ ] Categorized by type (struct, method, function, variant, field)
- [ ] Recommendations for each (remove vs implement vs allow)
