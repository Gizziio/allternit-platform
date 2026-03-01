# T3-A2: Native Menus

## Agent Role
Menu Designer - Native Integration

## Task
Create comprehensive native application menus for macOS, Windows, and Linux.

## Deliverables

### 1. Menu Architecture

Create: `7-apps/shell/desktop/main/menu/`

```
main/menu/
├── index.ts
├── app-menu.ts           # Application menu builder
├── context-menu.ts       # Context menu builder
├── menu-shortcuts.ts     # Shortcut definitions
├── menu-roles.ts         # Role-based menu items
└── platform-menus.ts     # Platform-specific menus
```

### 2. Application Menu Builder

Create: `7-apps/shell/desktop/main/menu/app-menu.ts`

```typescript
import { Menu, MenuItemConstructorOptions, app, dialog, shell } from 'electron';
import { windowManager } from '../window/WindowManager';

export function buildApplicationMenu(): Menu {
  const template: MenuItemConstructorOptions[] = [
    buildAppMenu(),
    buildFileMenu(),
    buildEditMenu(),
    buildViewMenu(),
    buildAgentMenu(),
    buildWindowMenu(),
    buildHelpMenu(),
  ];
  
  return Menu.buildFromTemplate(template);
}

// macOS App Menu
function buildAppMenu(): MenuItemConstructorOptions {
  return {
    label: app.getName(),
    submenu: [
      {
        label: 'About A2rchitect',
        click: () => showAboutWindow(),
      },
      { type: 'separator' },
      {
        label: 'Preferences...',
        accelerator: 'CmdOrCtrl+,',
        click: () => openSettings(),
      },
      { type: 'separator' },
      {
        label: 'Services',
        role: 'services',
        submenu: [],
      },
      { type: 'separator' },
      {
        label: 'Hide A2rchitect',
        accelerator: 'Command+H',
        role: 'hide',
      },
      {
        label: 'Hide Others',
        accelerator: 'Command+Shift+H',
        role: 'hideOthers',
      },
      {
        label: 'Show All',
        role: 'unhide',
      },
      { type: 'separator' },
      {
        label: 'Quit',
        accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
        click: () => app.quit(),
      },
    ],
  };
}

// File Menu
function buildFileMenu(): MenuItemConstructorOptions {
  return {
    label: 'File',
    submenu: [
      {
        label: 'New Chat',
        accelerator: 'CmdOrCtrl+N',
        click: () => sendToFocusedWindow('file:new-chat'),
      },
      {
        label: 'New Window',
        accelerator: 'CmdOrCtrl+Shift+N',
        click: () => windowManager.createWindow(),
      },
      { type: 'separator' },
      {
        label: 'Open Workflow...',
        accelerator: 'CmdOrCtrl+O',
        click: () => openWorkflow(),
      },
      {
        label: 'Save',
        accelerator: 'CmdOrCtrl+S',
        click: () => sendToFocusedWindow('file:save'),
      },
      {
        label: 'Save As...',
        accelerator: 'CmdOrCtrl+Shift+S',
        click: () => sendToFocusedWindow('file:save-as'),
      },
      { type: 'separator' },
      {
        label: 'Close Tab',
        accelerator: 'CmdOrCtrl+W',
        click: () => sendToFocusedWindow('file:close-tab'),
      },
    ],
  };
}

// Edit Menu
function buildEditMenu(): MenuItemConstructorOptions {
  return {
    label: 'Edit',
    submenu: [
      { label: 'Undo', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
      { label: 'Redo', accelerator: 'Shift+CmdOrCtrl+Z', role: 'redo' },
      { type: 'separator' },
      { label: 'Cut', accelerator: 'CmdOrCtrl+X', role: 'cut' },
      { label: 'Copy', accelerator: 'CmdOrCtrl+C', role: 'copy' },
      { label: 'Paste', accelerator: 'CmdOrCtrl+V', role: 'paste' },
      {
        label: 'Paste and Match Style',
        accelerator: 'CmdOrCtrl+Shift+V',
        role: 'pasteAndMatchStyle',
      },
      { label: 'Delete', role: 'delete' },
      { label: 'Select All', accelerator: 'CmdOrCtrl+A', role: 'selectAll' },
      { type: 'separator' },
      {
        label: 'Find',
        accelerator: 'CmdOrCtrl+F',
        click: () => sendToFocusedWindow('edit:find'),
      },
    ],
  };
}

// View Menu
function buildViewMenu(): MenuItemConstructorOptions {
  return {
    label: 'View',
    submenu: [
      {
        label: 'Reload',
        accelerator: 'CmdOrCtrl+R',
        click: (_, window) => window?.reload(),
      },
      {
        label: 'Force Reload',
        accelerator: 'CmdOrCtrl+Shift+R',
        click: (_, window) => window?.webContents.reloadIgnoringCache(),
      },
      {
        label: 'Toggle Developer Tools',
        accelerator: process.platform === 'darwin' ? 'Alt+Cmd+I' : 'Ctrl+Shift+I',
        click: (_, window) => window?.webContents.toggleDevTools(),
      },
      { type: 'separator' },
      {
        label: 'Actual Size',
        accelerator: 'CmdOrCtrl+0',
        click: (_, window) => window?.webContents.setZoomLevel(0),
      },
      {
        label: 'Zoom In',
        accelerator: 'CmdOrCtrl+Plus',
        click: (_, window) => {
          const level = window?.webContents.getZoomLevel() || 0;
          window?.webContents.setZoomLevel(level + 0.5);
        },
      },
      {
        label: 'Zoom Out',
        accelerator: 'CmdOrCtrl+-',
        click: (_, window) => {
          const level = window?.webContents.getZoomLevel() || 0;
          window?.webContents.setZoomLevel(level - 0.5);
        },
      },
      { type: 'separator' },
      {
        label: 'Toggle Full Screen',
        accelerator: process.platform === 'darwin' ? 'Ctrl+Cmd+F' : 'F11',
        click: (_, window) => window?.setFullScreen(!window.isFullScreen()),
      },
      { type: 'separator' },
      {
        label: 'Appearance',
        submenu: [
          {
            label: 'Light',
            type: 'radio',
            checked: getTheme() === 'light',
            click: () => setTheme('light'),
          },
          {
            label: 'Dark',
            type: 'radio',
            checked: getTheme() === 'dark',
            click: () => setTheme('dark'),
          },
          {
            label: 'System',
            type: 'radio',
            checked: getTheme() === 'system',
            click: () => setTheme('system'),
          },
        ],
      },
    ],
  };
}

// Agent Menu
function buildAgentMenu(): MenuItemConstructorOptions {
  return {
    label: 'Agent',
    submenu: [
      {
        label: 'New Agent Session',
        accelerator: 'CmdOrCtrl+Shift+A',
        click: () => sendToFocusedWindow('agent:new-session'),
      },
      {
        label: 'Stop Agent',
        accelerator: 'Escape',
        click: () => sendToFocusedWindow('agent:stop'),
      },
      { type: 'separator' },
      {
        label: 'Open Agent Panel',
        accelerator: 'CmdOrCtrl+Shift+P',
        click: () => sendToFocusedWindow('agent:open-panel'),
      },
      {
        label: 'View Workflows',
        accelerator: 'CmdOrCtrl+Shift+W',
        click: () => sendToFocusedWindow('agent:view-workflows'),
      },
    ],
  };
}

// Window Menu
function buildWindowMenu(): MenuItemConstructorOptions {
  return {
    label: 'Window',
    submenu: [
      {
        label: 'New Window',
        accelerator: 'CmdOrCtrl+Shift+N',
        click: () => windowManager.createWindow(),
      },
      { type: 'separator' },
      {
        label: 'Minimize',
        accelerator: 'CmdOrCtrl+M',
        role: 'minimize',
      },
      {
        label: 'Close',
        accelerator: 'CmdOrCtrl+W',
        role: 'close',
      },
      { type: 'separator' },
      {
        label: 'Bring All to Front',
        role: 'front',
      },
      ...buildWindowList(),
    ],
  };
}

// Help Menu
function buildHelpMenu(): MenuItemConstructorOptions {
  return {
    label: 'Help',
    submenu: [
      {
        label: 'Keyboard Shortcuts',
        accelerator: 'CmdOrCtrl+/',
        click: () => sendToFocusedWindow('help:shortcuts'),
      },
      {
        label: 'Documentation',
        click: () => shell.openExternal('https://docs.a2rchitect.io'),
      },
      { type: 'separator' },
      {
        label: 'Report Issue',
        click: () => shell.openExternal('https://github.com/a2rchitect/issues'),
      },
      {
        label: 'Check for Updates',
        click: () => checkForUpdates(),
      },
    ],
  };
}

// Dynamic window list
function buildWindowList(): MenuItemConstructorOptions[] {
  const windows = windowManager.getAllWindows();
  if (windows.length === 0) return [];
  
  return [
    { type: 'separator' },
    ...windows.map((window, index) => ({
      label: `Window ${index + 1}`,
      accelerator: index < 9 ? `CmdOrCtrl+${index + 1}` : undefined,
      click: () => window.focus(),
    })),
  ];
}

// Helper functions
function sendToFocusedWindow(channel: string, ...args: any[]) {
  const window = windowManager.getFocusedWindow();
  window?.webContents.send(channel, ...args);
}
```

### 3. Context Menus

Create: `7-apps/shell/desktop/main/menu/context-menu.ts`

```typescript
interface ContextMenuOptions {
  type: 'default' | 'input' | 'selection' | 'link' | 'image';
  editFlags?: Electron.EditFlags;
  linkURL?: string;
  selectionText?: string;
  misspelledWord?: string;
  dictionarySuggestions?: string[];
}

export function buildContextMenu(options: ContextMenuOptions): Menu {
  const template: MenuItemConstructorOptions[] = [];
  
  switch (options.type) {
    case 'input':
      template.push(...buildInputMenu(options));
      break;
    case 'selection':
      template.push(...buildSelectionMenu(options));
      break;
    case 'link':
      template.push(...buildLinkMenu(options));
      break;
    default:
      template.push(...buildDefaultMenu());
  }
  
  return Menu.buildFromTemplate(template);
}

function buildInputMenu(options: ContextMenuOptions): MenuItemConstructorOptions[] {
  const { editFlags, misspelledWord, dictionarySuggestions } = options;
  
  const items: MenuItemConstructorOptions[] = [];
  
  // Spelling suggestions
  if (misspelledWord && dictionarySuggestions?.length) {
    items.push(
      ...dictionarySuggestions.map(word => ({
        label: word,
        click: (_, window) => window?.webContents.replaceMisspelling(word),
      })),
      { type: 'separator' },
    );
  }
  
  // Standard edit operations
  items.push(
    {
      label: 'Undo',
      role: 'undo',
      enabled: editFlags?.canUndo,
    },
    {
      label: 'Redo',
      role: 'redo',
      enabled: editFlags?.canRedo,
    },
    { type: 'separator' },
    {
      label: 'Cut',
      role: 'cut',
      enabled: editFlags?.canCut,
    },
    {
      label: 'Copy',
      role: 'copy',
      enabled: editFlags?.canCopy,
    },
    {
      label: 'Paste',
      role: 'paste',
      enabled: editFlags?.canPaste,
    },
    {
      label: 'Select All',
      role: 'selectAll',
      enabled: editFlags?.canSelectAll,
    },
  );
  
  return items;
}

function buildSelectionMenu(options: ContextMenuOptions): MenuItemConstructorOptions[] {
  const { selectionText } = options;
  
  return [
    {
      label: 'Copy',
      role: 'copy',
    },
    {
      label: 'Search Google for "{selection}"',
      click: () => shell.openExternal(`https://google.com/search?q=${encodeURIComponent(selectionText || '')}`),
    },
  ];
}

function buildLinkMenu(options: ContextMenuOptions): MenuItemConstructorOptions[] {
  const { linkURL } = options;
  
  return [
    {
      label: 'Open Link',
      click: () => shell.openExternal(linkURL || ''),
    },
    {
      label: 'Copy Link Address',
      click: () => clipboard.writeText(linkURL || ''),
    },
  ];
}

function buildDefaultMenu(): MenuItemConstructorOptions[] {
  return [
    {
      label: 'Back',
      enabled: false,
      click: (_, window) => window?.webContents.goBack(),
    },
    {
      label: 'Forward',
      enabled: false,
      click: (_, window) => window?.webContents.goForward(),
    },
    {
      label: 'Reload',
      click: (_, window) => window?.reload(),
    },
  ];
}

// Register context menu handler
export function registerContextMenu(window: BrowserWindow): void {
  window.webContents.on('context-menu', (event, params) => {
    const menu = buildContextMenu({
      type: params.inputFieldType ? 'input' : params.linkURL ? 'link' : params.selectionText ? 'selection' : 'default',
      editFlags: params.editFlags,
      linkURL: params.linkURL,
      selectionText: params.selectionText,
      misspelledWord: params.misspelledWord,
      dictionarySuggestions: params.dictionarySuggestions,
    });
    
    menu.popup({ window });
  });
}
```

### 4. Menu Registration

Update main process:

```typescript
// main/index.ts
import { buildApplicationMenu } from './menu/app-menu';
import { registerContextMenu } from './menu/context-menu';

app.whenReady().then(() => {
  // Set application menu
  const menu = buildApplicationMenu();
  Menu.setApplicationMenu(menu);
  
  // Create first window with context menu
  const window = await windowManager.createWindow();
  registerContextMenu(window);
});
```

## Requirements

- Native menus for macOS/Windows/Linux
- Role-based items for native behavior
- Dynamic window list in Window menu
- Context menus for text, links, images
- IPC communication to renderer

## Success Criteria
- [ ] 7 menu sections (App, File, Edit, View, Agent, Window, Help)
- [ ] 30+ menu items
- [ ] Context menus for all types
- [ ] Dynamic window list
- [ ] Theme toggle in View menu
- [ ] IPC to renderer working
- [ ] No SYSTEM_LAW violations
