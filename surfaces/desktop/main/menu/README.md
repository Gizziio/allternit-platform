# Native Application Menus

Comprehensive native application menus for macOS, Windows, and Linux.

## Structure

```
menu/
├── index.ts              # Main TypeScript entry point
├── index.cjs             # CommonJS entry point (for main process)
├── app-menu.ts           # Application menu builder (7 menu sections)
├── context-menu.ts       # Context menu builder (right-click menus)
├── menu-shortcuts.ts     # Keyboard shortcut definitions
├── menu-roles.ts         # Role-based menu items
├── platform-menus.ts     # Platform-specific customizations
└── README.md             # This file
```

## Features

### 7 Menu Sections

1. **App Menu** (macOS only)
   - About A2rchitect
   - Preferences (Cmd+,)
   - Services
   - Hide/Show
   - Quit

2. **File Menu**
   - New Chat (Cmd+N)
   - New Window (Cmd+Shift+N)
   - Open Workflow (Cmd+O)
   - Save (Cmd+S)
   - Save As (Cmd+Shift+S)
   - Close Tab (Cmd+W)
   - Exit (Windows/Linux)

3. **Edit Menu**
   - Undo/Redo
   - Cut/Copy/Paste
   - Paste and Match Style
   - Select All
   - Find (Cmd+F)
   - Find Next/Previous

4. **View Menu**
   - Reload (Cmd+R)
   - Force Reload (Cmd+Shift+R)
   - Toggle DevTools
   - Zoom Controls (In/Out/Reset)
   - Toggle Full Screen
   - Appearance (Light/Dark/System)

5. **Agent Menu**
   - New Agent Session (Cmd+Shift+A)
   - Stop Agent (Escape)
   - Open Agent Panel (Cmd+Shift+P)
   - View Workflows (Cmd+Shift+W)
   - Clear Conversation

6. **Window Menu**
   - New Window
   - Minimize (Cmd+M)
   - Close (Cmd+W)
   - Bring All to Front
   - Dynamic Window List (Cmd+1-9)

7. **Help Menu**
   - Keyboard Shortcuts (Cmd+/)
   - Documentation
   - Report Issue
   - Check for Updates
   - About (Windows/Linux)

### Context Menus

- **Input**: Undo/Redo, Cut/Copy/Paste, Select All, Spelling suggestions
- **Selection**: Copy, Search Google/DuckDuckGo, Copy as Markdown
- **Link**: Open, Open in New Window, Copy Address, Save Link
- **Image**: Open in New Window/Browser, Copy Address, Save Image
- **Default**: Back/Forward/Reload, Inspect Element

### Platform Support

| Feature | macOS | Windows | Linux |
|---------|-------|---------|-------|
| App Menu | ✅ | ❌ | ❌ |
| Services Menu | ✅ | ❌ | ❌ |
| Native Roles | ✅ | ✅ | ✅ |
| Theme Toggle | ✅ | ✅ | ✅ |
| Window List | ✅ | ✅ | ✅ |

## Usage

### Main Process Integration

```javascript
// main/index.cjs
const { initializeMenus, registerContextMenu } = require('./menu/index.cjs');

app.whenReady().then(() => {
  // Initialize application menu
  initializeMenus();
  
  // Create window with context menu
  const window = createWindow();
  registerContextMenu(window);
});
```

### IPC Channels

Menus send events to the renderer via these channels:

- `file:new-chat` - Create new chat
- `file:save` / `file:save-as` - Save operations
- `file:close-tab` - Close current tab
- `edit:find` / `edit:find-next` / `edit:find-previous` - Find operations
- `view:theme-changed` - Theme changed
- `agent:new-session` - New agent session
- `agent:stop` - Stop current agent
- `agent:open-panel` - Open agent panel
- `agent:view-workflows` - View workflows
- `agent:clear-conversation` - Clear conversation
- `app:show-about` - Show about dialog
- `app:open-settings` - Open settings
- `app:check-updates` - Check for updates
- `help:shortcuts` - Show keyboard shortcuts

### Renderer Process

```typescript
// Listen for menu events
window.electron.on('file:new-chat', () => {
  // Handle new chat
});

window.electron.on('view:theme-changed', (theme) => {
  // Apply theme
});
```

## Adding Menu Items

### To add a menu item:

1. **Edit `app-menu.ts`**:
```typescript
function buildFileMenu(): MenuItemConstructorOptions {
  return {
    label: 'File',
    submenu: [
      // ... existing items
      {
        label: 'New Menu Item',
        accelerator: 'CmdOrCtrl+Shift+X',
        click: () => sendToFocusedWindow('file:new-item'),
      },
    ],
  };
}
```

2. **Update `menu-shortcuts.ts`** if it's a new shortcut:
```typescript
export const Shortcuts = {
  file: {
    // ... existing shortcuts
    newItem: 'CmdOrCtrl+Shift+X',
  },
};
```

3. **Add IPC handler in renderer**:
```typescript
window.electron.on('file:new-item', () => {
  // Handle the action
});
```

## Keyboard Shortcuts

All shortcuts use `CmdOrCtrl` for cross-platform compatibility:

| Action | Shortcut |
|--------|----------|
| New Chat | Cmd+N |
| New Window | Cmd+Shift+N |
| Open | Cmd+O |
| Save | Cmd+S |
| Find | Cmd+F |
| Zoom In | Cmd+Plus |
| Zoom Out | Cmd+Minus |
| Full Screen | Ctrl+Cmd+F (macOS), F11 (Win/Lin) |
| DevTools | Alt+Cmd+I (macOS), Ctrl+Shift+I (Win/Lin) |

## Platform-Specific Notes

### macOS
- First menu is App menu with app name
- Services submenu is native
- Hide/Show items use native roles
- Cmd+Q for quit

### Windows
- File menu has Exit item
- F11 for full screen
- Alt+F4 also quits
- Window controls in File menu

### Linux
- Similar to Windows layout
- Window menu available
- Ctrl+Q for quit
- Supports system theme

## Troubleshooting

### Menu not showing
- Check that `initializeMenus()` is called
- Verify menu system is loaded: `require('./menu/index.cjs')`

### Context menu not working
- Ensure `registerContextMenu(window)` is called after window creation
- Check that window is not destroyed before registering

### Shortcuts not working
- Verify accelerator format: https://www.electronjs.org/docs/latest/api/accelerator
- Check for conflicts with system shortcuts
- Use `CmdOrCtrl` for cross-platform compatibility

## License

Part of A2rchitect - Copyright (c) 2026
