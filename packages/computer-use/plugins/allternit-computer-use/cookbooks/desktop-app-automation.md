# Cookbook: Desktop App Automation

**Use case:** Automate native desktop applications — file management, system tools, productivity apps (Finder, Excel, Terminal, etc.)

---

## Overview

```
discover app → snapshot a11y tree → find elements → act → verify state change
```

---

## App Discovery

```python
apps = get_running_apps()
# → ["Finder", "Safari", "Terminal", "Calculator", "Slack"]

if target_app not in apps:
    # Launch it
    # macOS: subprocess.run(["open", "-a", app_name])
    # Windows: subprocess.run(["start", app_name], shell=True)
    wait_for_app(target_app, timeout=5)
```

---

## Accessibility Tree Navigation

```python
snapshot = get_app_snapshot(app_name)
# Returns: AppSnapshot with elements: [AppElement(role, title, value, frame)]

# Find by semantic description
element = snapshot.find("Save button")
element = snapshot.find("File menu")
element = snapshot.find("Search field")

# If not found in a11y → fall back to visual grounding
```

---

## Common App Patterns

### Finder (macOS)
```
# Navigate to folder
key("Cmd+Shift+G")           ← Go to Folder dialog
type("/Users/eoj/Downloads") ← type path
key("Enter")                 ← navigate

# Select file
find_element("filename.pdf", strategy="text")
click(element)

# Copy/paste
key("Cmd+C")
navigate_to_destination()
key("Cmd+V")
```

### Terminal / iTerm2
```
find_element("Terminal window", strategy="accessibility")
click(terminal_area)
type("ls -la ~/Desktop\n")
screenshot()  ← read output
```

### Calculator
```
snapshot = get_app_snapshot("Calculator")
# Find digit buttons by title
click_element(snapshot.find("8"))
click_element(snapshot.find("×"))
click_element(snapshot.find("4"))
click_element(snapshot.find("="))
result = snapshot.find("Result display").value
```

### Excel / Numbers (Spreadsheet)
```
# Navigate to cell
key("Ctrl+G")                ← Go To dialog
type("B5")
key("Enter")
type(value)
key("Tab")                   ← move to next cell
```

---

## Key Combo Reference

| Action | macOS | Windows |
|--------|-------|---------|
| Copy | `Cmd+C` | `Ctrl+C` |
| Paste | `Cmd+V` | `Ctrl+V` |
| Select all | `Cmd+A` | `Ctrl+A` |
| Save | `Cmd+S` | `Ctrl+S` |
| Undo | `Cmd+Z` | `Ctrl+Z` |
| New window | `Cmd+N` | `Ctrl+N` |
| Close window | `Cmd+W` | `Ctrl+W` |
| Screenshot | `Cmd+Shift+4` | `Win+Shift+S` |
| App switcher | `Cmd+Tab` | `Alt+Tab` |
| Spotlight | `Cmd+Space` | `Win` |

---

## Verification

After each desktop action:
1. Re-read accessibility snapshot for target app
2. Check expected state (element title/value changed, window appeared/closed)
3. If state unchanged after 2s: retry once
4. If still unchanged: take screenshot → use visual grounding to verify manually

---

## GIF Recording

Desktop automation GIF captures the full screen (not just browser viewport):
- Uses PyAutoGUI's `mss` for full desktop capture
- Captures at 2 FPS (same as browser)
- Scale: 50% to keep file size manageable
- Particularly useful for documenting workflows in native apps
