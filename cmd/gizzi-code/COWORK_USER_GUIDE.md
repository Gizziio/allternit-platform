# Gizzi Code Cowork Mode - User Guide

## Quick Start

### Starting Gizzi Code
```bash
cd /Users/macbook/Desktop/a2rchitech-workspace/a2rchitech/cmd/gizzi-code
bun run dev
```

---

## Mode Switching

### What are Modes?
Gizzi Code has two modes:
- **Code Mode** (Green) - Traditional terminal coding experience
- **Cowork Mode** (Purple) - Collaborative workspace with browser viewport

### How to Switch Modes
1. Look at the **top right corner** of the screen
2. Click on **[Code]** or **[Cowork]** buttons
3. Your selection is saved automatically

### Keyboard Shortcuts
- Not yet implemented (coming soon)
- Planned: `Ctrl+1` for Code, `Ctrl+2` for Cowork

---

## Cowork Mode Features

### Layout
```
┌─────────────────────────────────────────────────────────────┐
│  COWORK MODE                    [Mode] [Agent] [Status]     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌───────────────────┐  ┌──────────────────────────────┐   │
│  │  TERMINAL / CODE  │  │  VIEWPORT                    │   │
│  │                   │  │                              │   │
│  │  (left side)      │  │  (right side)                │   │
│  │                   │  │  - Browser previews          │   │
│  │                   │  │  - Images                    │   │
│  │                   │  │  - Markdown                  │   │
│  │                   │  │  - Code                      │   │
│  └───────────────────┘  └──────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Browser Integration

#### Opening Browser
- Press **`o`** key to open Chrome browser
- Browser opens beside terminal (side-by-side)
- Status appears in status bar: "Browser: open"

#### Taking Screenshots
- Press **`s`** key to capture screenshot
- Screenshot saved for display in viewport

#### Closing Browser
- Press **`c`** key to close browser
- Browser closes, viewport returns to empty state

#### Navigation
- Type URL in browser normally
- Browser is fully interactive
- TUI shows current URL in status bar

### Content Display

The viewport can display:

#### 1. Web Pages
- Open browser with `o`
- Navigate to any URL
- Viewport shows status and URL

#### 2. Images
- Browser-based display (best quality)
- Supports: PNG, JPEG, GIF, WebP
- Click to open in browser for full view

#### 3. Markdown
- Automatic rendering
- Headers, lists, code blocks
- Formatted text display

#### 4. Code
- Syntax highlighting
- Line numbers
- Multiple languages supported

#### 5. Diffs
- Color-coded changes
- Green: additions
- Red: deletions
- Blue: hunk headers

#### 6. Artifacts
- File previews
- Type-aware display
- Metadata shown

---

## Agent Toggle

### What is Agent Mode?
Agent mode enables AI assistance within your current mode.

### How to Toggle Agent
1. Look at **top right corner** (next to mode switcher)
2. Click **[AGENT ON]** or **[AGENT OFF]**
3. Your preference is saved automatically

### Agent in Code Mode
- Standard terminal with agent assistance
- Agent can help with coding tasks
- Toggle on/off as needed

### Agent in Cowork Mode
- Agent can use viewport for output
- Agent can open browser for research
- Full collaborative capabilities

---

## Keyboard Shortcuts

### Global Shortcuts
| Key | Action |
|-----|--------|
| `o` | Open browser (Cowork mode) |
| `s` | Take screenshot (Cowork mode) |
| `c` | Close browser (Cowork mode) |

### Planned Shortcuts
| Key | Action |
|-----|--------|
| `Ctrl+1` | Switch to Code mode |
| `Ctrl+2` | Switch to Cowork mode |
| `Ctrl+A` | Toggle agent |
| `F5` | Refresh viewport |
| `Esc` | Close viewport/browser |

---

## Settings & Persistence

### What Gets Saved
- Current mode (Code/Cowork)
- Agent preference (ON/OFF)
- All settings persist across sessions

### Where Settings Are Stored
- File: `~/.local/state/gizzi-code/kv.json`
- Automatically saved on change
- Automatically loaded on startup

---

## Troubleshooting

### Browser Won't Open
**Problem**: Press `o` but browser doesn't open

**Solutions**:
1. Make sure Chrome is installed
2. Check if Chrome is already running
3. Try manually opening Chrome
4. Restart gizzi-code

### Viewport Shows Error
**Problem**: Viewport displays error message

**Solutions**:
1. Read the error message
2. Follow the suggestion shown
3. Try the recovery action
4. Restart if needed

### Mode Switcher Not Visible
**Problem**: Can't see mode switcher in top right

**Solutions**:
1. Make sure terminal is wide enough (>100 chars)
2. Check if in startup/onboarding flow
3. Restart gizzi-code

### Agent Toggle Not Working
**Problem**: Agent toggle doesn't change state

**Solutions**:
1. Click again (may need double-click)
2. Check if agent is available
3. Restart gizzi-code

---

## Tips & Best Practices

### Efficient Workflow
1. **Start in Code mode** for regular coding
2. **Switch to Cowork** when you need browser/research
3. **Use agent** for complex tasks
4. **Toggle agent off** when not needed (saves resources)

### Browser Management
- Open browser only when needed
- Close when done (press `c`)
- Use native browser for complex interactions
- Use TUI for quick previews

### Content Display
- Use viewport for quick previews
- Open browser for full interaction
- Markdown renders best in viewport
- Images better in browser

---

## Advanced Usage

### Multiple Monitors
- Terminal on left monitor
- Browser on right monitor
- Best of both worlds

### Window Management (macOS)
- Use yabai or Rectangle for window positioning
- Auto-position terminal and browser side-by-side
- Keyboard shortcuts for window management

### Custom Workflows
- Create custom keyboard shortcuts
- Script browser opening with specific URLs
- Automate common tasks

---

## FAQ

**Q: Can I embed the browser inside the terminal?**
A: No, terminals are text-only. We use a hybrid approach with a separate browser window.

**Q: Does browser work in all terminals?**
A: Yes! Browser opens as a native window, works in any terminal.

**Q: Can I use Firefox instead of Chrome?**
A: Currently Chrome-only. Firefox support planned.

**Q: Are settings synced across machines?**
A: No, settings are local. Cloud sync planned.

**Q: Can I customize the colors?**
A: Not yet. Theme customization planned.

---

## Support

### Logs
- Location: `~/.local/share/gizzi-code/log/dev.log`
- Check for error details
- Include in bug reports

### Bug Reports
1. Describe the issue
2. Include steps to reproduce
3. Attach logs if relevant
4. Include terminal and OS info

### Feature Requests
- Suggest new features
- Vote on existing requests
- Contribute to development

---

## Updates

### What's New (Latest Version)
- ✅ Mode switching (Code/Cowork)
- ✅ Browser integration (hybrid)
- ✅ Viewport for content display
- ✅ Agent toggle
- ✅ Keyboard shortcuts (o/s/c)
- ✅ Settings persistence

### Coming Soon
- ⏳ More keyboard shortcuts
- ⏳ Terminal capability detection
- ⏳ Enhanced error handling
- ⏳ Theme customization
- ⏳ Multi-tab browser support

---

**Happy Coding with Gizzi Code! 🚀**
