# WIH: Integrate Command Registry into TUI

## Description
Integrate the command registry system into TUI to resolve "never used" warnings and provide enhanced command palette functionality.

## Resolves Warnings
- `CommandRegistry::REGISTRY` - never used
- `search_commands()` - never used
- `get_command()` - never used
- `fuzzy_match()` - never used
- `rank_results()` - never used
- `filter_candidates()` - never used
- `discover_commands()` - never used
- `discover_*_commands()` - never used
- `register_external_command()` - never used
- `render_sidebar()` - never used

## Implementation Plan

### Step 1: Replace Slash Command Handling
**Current:** Hardcoded match on `/command` strings
**New:** Use registry lookup
```rust
// Current
"/help" => { ... }
"/status" => { ... }

// New
let cmd = registry.get(input);
match cmd.handler { ... }
```

### Step 2: Add Fuzzy Search to Command Palette
- When user types `/` + text, show fuzzy matches
- Use `registry.search(query)` for results
- Display with scores and descriptions
- Support Tab completion

### Step 3: Add Command Categorization
- Group commands by category (System, Session, Workspace, etc.)
- Show category icons in palette
- Allow filtering by category

### Step 4: Add Sidebar with Command Shortcuts
- Use `render_sidebar()` to show common commands
- Collapsible sidebar with category sections
- Quick access to workspace, dag, queue commands

### Step 5: Update Help System
- Use registry for `/help` command output
- Generate command documentation dynamically
- Show available commands with descriptions

## Tasks
- [ ] Add `CommandRegistry` field to `TuiApp`
- [ ] Replace `open_commands_overlay()` with registry-based version
- [ ] Implement fuzzy search UI
- [ ] Add sidebar widget
- [ ] Update help command
- [ ] Add command documentation display
- [ ] Test all commands work through registry

## API Changes
```rust
// TuiApp changes
pub struct TuiApp<'a> {
    // Add
    command_registry: &'static CommandRegistry,
    command_palette: CommandPaletteState,
    sidebar_visible: bool,
}

// New methods
fn execute_command(&mut self, path: &str, args: &[String]);
fn show_command_palette(&mut self);
fn toggle_sidebar(&mut self);
```

## Acceptance Criteria
- [ ] All 10 "never used" warnings resolved
- [ ] `/` command shows fuzzy-searchable palette
- [ ] Commands categorized by type
- [ ] Sidebar shows command shortcuts
- [ ] `/help` uses registry data
- [ ] No regression in existing commands
- [ ] All new code has tests

## Dependencies
- Requires: catalog-registry-warnings (understanding)
- Blocks: add-command-docs
