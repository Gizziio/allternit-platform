# Skill: desktop-control

**Triggers:** "open app", "close window", "desktop", "Finder", "Calculator", "native", file system actions, any non-browser app reference

## Purpose

Control native desktop applications using the accessibility tree first, pixel-coordinate PyAutoGUI as fallback. Handles macOS, Windows, and Linux.

## Adapter Selection

```
if platform == "darwin"  → AccessibilityAdapter (NSAccessibility) + PyAutoGUIAdapter
if platform == "windows" → AccessibilityAdapter (UIA) + PyAutoGUIAdapter
if platform == "linux"   → AT-SPI (limited) + PyAutoGUIAdapter
```

## Action Protocol

### Step 1: App Discovery
```python
apps = await a11y.get_running_apps()
# → ["Finder", "Safari", "Calculator", ...]
```

If target app not running:
- macOS: `open -a "AppName"`
- Windows: `start AppName`
- Wait up to 3 seconds for app to appear in running list

### Step 2: Snapshot
```python
snapshot = await a11y.get_app_snapshot(app_name)
# Returns: AppSnapshot with elements list (role, title, value, frame)
```

### Step 3: Element Find
```python
element = snapshot.find(description)
# Matches: title, value, description, role (case-insensitive substring)
```

If not found in a11y snapshot → fall back to visual-grounding skill.

### Step 4: Action Execution

| Intent | Method |
|--------|--------|
| Click element | `pag.click(element.center())` |
| Type text | `pag.typewrite(text, interval=0.01)` |
| Key combo | `pag.hotkey(*keys)` → e.g. `("cmd","c")` |
| Scroll | `pag.scroll(amount, x, y)` |
| Move to | `pag.move_to(x, y, duration=0.3)` |
| Screenshot | `pag.take_screenshot()` |

### Step 5: Verify
Re-read a11y snapshot after action. Check expected state change (e.g., window title changed, element value updated).

## Platform Notes

### macOS
- Menu bar: use `AppElement(role="AXMenuBar")` → `AXMenu` → `AXMenuItem`
- File dialog: watch for `NSSavePanel`/`NSOpenPanel` by role `AXSheet`
- Permissions: `tccutil reset Accessibility` if stale grants cause failures

### Windows
- Use `child.CurrentName` for element title lookup
- UIA control types: Button=50000, Edit=50004, Text=50020, etc.
- Admin elevation required for some system apps

## Safety

- Max mouse velocity: 2.0 sec/movement (prevents accidental misclicks)
- FAILSAFE on: moving mouse to screen corner aborts (PyAutoGUI default)
- Never type into password fields without confirming with user
- GIF recording captures all desktop actions for audit trail
