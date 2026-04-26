# TUI Wireframes & Keybindings — "Operator Cockpit"

## 1. Layout (3-Pane Triad)
- **LEFT (Projects/Capsules)**:
  - Scrollable list of active capsules.
  - Type filters (Research, Build, etc.).
  - Progress indicators.
- **CENTER (Capsule Preview)**:
  - Renders the current A2UI payload.
  - Cards -> Grouped blocks.
  - Tables -> Tabular widgets.
  - Actions -> Interactive list.
- **RIGHT (Live Ledger)**:
  - Live scroll of Journal events.
  - Evidence drawer (toggled).
  - Trace visualization.
- **BOTTOM (Command Bar)**:
  - Input for intents and system commands.

## 2. Keybindings
- `Tab`: Cycle active pane focus.
- `Enter`: Open capsule details (center pane).
- `g`: Global "Go" menu (Jump to Capsules, Evidence, Tools).
- `Ctrl+J`: Toggle Journal visibility.
- `Ctrl+E`: Toggle Evidence drawer.
- `Ctrl+C`: Exit.
- `/`: Focus command bar.

## 3. Ergonomics
- Fuzzy search enabled in list views.
- Color-coded log levels (Info, Tool, Error, Policy).
- Automatic reflow on terminal resize.
