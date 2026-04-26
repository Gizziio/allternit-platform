---
description: Automate a native desktop application using accessibility tree and screen control
argument-hint: "[task description]"
---

# /cu:desktop

Control a native desktop application using the accessibility tree (NSAccessibility on macOS, UIA on Windows) combined with PyAutoGUI for mouse and keyboard actions.

## What This Command Does

```
┌──────────────────────────────────────────────────────────────────┐
│                    DESKTOP AUTOMATION                            │
├──────────────────────────────────────────────────────────────────┤
│  READ     Accessibility tree snapshot (no screenshot needed)    │
│  FIND     Locate elements by role, title, or description        │
│  ACT      Click, type, scroll, key combo via PyAutoGUI          │
│  VERIFY   Re-read tree to confirm expected state change         │
├──────────────────────────────────────────────────────────────────┤
│  FALLS BACK to vision grounding if a11y tree is incomplete      │
└──────────────────────────────────────────────────────────────────┘
```

## Requirements

- **macOS**: Accessibility permissions must be granted in System Settings → Privacy & Security → Accessibility
- **Windows**: May require Administrator for some applications
- **Linux**: X11 required (Wayland support limited)

## Options

| Option | Default | Description |
|--------|---------|-------------|
| `--app` | (frontmost) | Target application name (e.g. `Finder`, `Safari`, `Excel`) |
| `--approval` | `on-risk` | Approval policy for destructive actions |
| `--no-gif` | off | Disable GIF recording |

## Examples

```
/cu:desktop Open Finder, navigate to Downloads, and list all PDFs
/cu:desktop --app Calculator Compute 1024 ÷ 32
/cu:desktop --app "Microsoft Excel" Select all cells in Sheet1 and copy to clipboard
/cu:desktop --app Safari --approval always Submit the form on the active tab
/cu:desktop Take a screenshot of the current screen and describe all open windows
```

## Behavior Notes

- Prefers accessibility tree over pixel coordinates (faster, more reliable)
- Falls back to vision grounding if element not found in a11y tree
- GIF recording captures screen at 2 FPS throughout the task
- All typing is done via `pyautogui.typewrite` with 10ms inter-key delay
- Key combos use `pyautogui.hotkey` (supports Cmd/Ctrl, Shift, Alt modifiers)
