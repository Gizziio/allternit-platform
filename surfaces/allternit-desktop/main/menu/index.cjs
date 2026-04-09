/**
 * @fileoverview Menu System - CommonJS Entry Point
 * @module main/menu/index.cjs
 * 
 * CommonJS wrapper for the menu system to support the existing
 * CommonJS-based main process. This file provides menu functionality
 * without requiring TypeScript compilation.
 * 
 * @author T3-A2: Native Menus specialist
 * @version 1.0.0
 */

const { Menu, app, dialog, shell, clipboard, BrowserWindow } = require('electron');
const { join } = require('path');

// ============================================================================
// Window Manager (Simple version for CJS)
// ============================================================================

class WindowManager {
  constructor() {
    this.windows = new Map();
    this.windowIdCounter = 0;
  }

  createWindow(url) {
    const { screen } = require('electron');
    const windowId = ++this.windowIdCounter;

    const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
    const width = 1280;
    const height = 850;
    const offset = (this.windows.size * 30) % 200;
    const x = Math.round((screenWidth - width) / 2) + offset;
    const y = Math.round((screenHeight - height) / 2) + offset;

    const window = new BrowserWindow({
      width,
      height,
      x,
      y,
      title: 'A2rchitect',
      show: false,
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 24, y: 28 },
      webPreferences: {
        contextIsolation: true,
        preload: join(__dirname, '../../preload/index.js'),
        webviewTag: true,
        allowRunningInsecureContent: true,
      },
    });

    this.windows.set(windowId, window);

    // Set up window events
    window.on('focus', () => {
      updateWindowMenu();
    });

    window.on('closed', () => {
      this.windows.delete(windowId);
      updateWindowMenu();
    });

    // Register context menu
    registerContextMenu(window);

    // Load URL
    const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5177';
    const targetUrl = url || devUrl;

    if (targetUrl.startsWith('http')) {
      window.loadURL(targetUrl).catch(err => {
        console.error('[WindowManager] Failed to load URL:', err);
      });
    } else {
      window.loadFile(targetUrl).catch(err => {
        console.error('[WindowManager] Failed to load file:', err);
      });
    }

    window.once('ready-to-show', () => {
      window.show();
      window.focus();
    });

    return window;
  }

  getAllWindows() {
    return Array.from(this.windows.values()).filter(w => !w.isDestroyed());
  }

  getFocusedWindow() {
    return BrowserWindow.getFocusedWindow();
  }

  bringAllToFront() {
    this.getAllWindows().forEach(window => {
      if (!window.isDestroyed()) {
        if (window.isMinimized()) {
          window.restore();
        }
        window.show();
      }
    });
  }
}

const windowManager = new WindowManager();

// ============================================================================
// Theme Management
// ============================================================================

let currentTheme = 'system';

function getTheme() {
  return currentTheme;
}

function setTheme(theme) {
  currentTheme = theme;
  windowManager.getAllWindows().forEach(window => {
    if (!window.isDestroyed()) {
      window.webContents.send('view:theme-changed', theme);
    }
  });
  updateWindowMenu();
}

// ============================================================================
// Helper Functions
// ============================================================================

function sendToFocusedWindow(channel, ...args) {
  const window = windowManager.getFocusedWindow();
  if (window && !window.isDestroyed()) {
    window.webContents.send(channel, ...args);
  }
}

function showAboutWindow() {
  sendToFocusedWindow('app:show-about');
}

function openSettings() {
  sendToFocusedWindow('app:open-settings');
}

function openWorkflow() {
  const focusedWindow = windowManager.getFocusedWindow();
  if (!focusedWindow) return;

  dialog.showOpenDialog(focusedWindow, {
    title: 'Open Workflow',
    filters: [
      { name: 'Workflow Files', extensions: ['json', 'yaml', 'yml', 'allternit'] },
      { name: 'All Files', extensions: ['*'] }
    ],
    properties: ['openFile']
  }).then(result => {
    if (!result.canceled && result.filePaths.length > 0) {
      focusedWindow.webContents.send('file:open-workflow', result.filePaths[0]);
    }
  }).catch(err => {
    console.error('[Menu] Failed to open workflow:', err);
  });
}

function checkForUpdates() {
  sendToFocusedWindow('app:check-updates');
  shell.openExternal('https://github.com/a2rchitect/releases');
}

// ============================================================================
// Menu Builders
// ============================================================================

function buildAppMenu() {
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

function buildFileMenu() {
  const submenu = [
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
  ];

  if (process.platform !== 'darwin') {
    submenu.push(
      { type: 'separator' },
      {
        label: 'Exit',
        accelerator: 'Ctrl+Q',
        click: () => app.quit(),
      }
    );
  }

  return { label: 'File', submenu };
}

function buildEditMenu() {
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
      {
        label: 'Find Next',
        accelerator: 'CmdOrCtrl+G',
        click: () => sendToFocusedWindow('edit:find-next'),
      },
      {
        label: 'Find Previous',
        accelerator: 'Shift+CmdOrCtrl+G',
        click: () => sendToFocusedWindow('edit:find-previous'),
      },
    ],
  };
}

function buildViewMenu() {
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

function buildAgentMenu() {
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
      { type: 'separator' },
      {
        label: 'Clear Conversation',
        click: () => sendToFocusedWindow('agent:clear-conversation'),
      },
    ],
  };
}

function buildWindowMenu() {
  const submenu = [
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
      click: () => windowManager.bringAllToFront(),
    },
  ];

  // Add dynamic window list
  const windows = windowManager.getAllWindows();
  if (windows.length > 0) {
    submenu.push({ type: 'separator' });
    windows.forEach((window, index) => {
      submenu.push({
        label: window.getTitle() || `Window ${index + 1}`,
        accelerator: index < 9 ? `CmdOrCtrl+${index + 1}` : undefined,
        click: () => {
          if (!window.isDestroyed()) {
            window.focus();
          }
        },
      });
    });
  }

  return { label: 'Window', submenu };
}

function buildHelpMenu() {
  const submenu = [
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
  ];

  if (process.platform !== 'darwin') {
    submenu.push(
      { type: 'separator' },
      {
        label: 'About A2rchitect',
        click: () => showAboutWindow(),
      }
    );
  }

  return { label: 'Help', submenu };
}

function buildApplicationMenu() {
  const template = [
    ...(process.platform === 'darwin' ? [buildAppMenu()] : []),
    buildFileMenu(),
    buildEditMenu(),
    buildViewMenu(),
    buildAgentMenu(),
    buildWindowMenu(),
    buildHelpMenu(),
  ];

  return Menu.buildFromTemplate(template);
}

function updateWindowMenu() {
  const menu = buildApplicationMenu();
  Menu.setApplicationMenu(menu);
}

// ============================================================================
// Context Menu
// ============================================================================

function buildContextMenu(options) {
  const template = [];

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
    case 'image':
      template.push(...buildImageMenu(options));
      break;
    default:
      template.push(...buildDefaultMenu());
  }

  return Menu.buildFromTemplate(template);
}

function buildInputMenu(options) {
  const { editFlags, misspelledWord, dictionarySuggestions } = options;
  const items = [];

  if (misspelledWord && dictionarySuggestions && dictionarySuggestions.length > 0) {
    items.push(
      ...dictionarySuggestions.map(word => ({
        label: word,
        click: (_, window) => window?.webContents.replaceMisspelling(word),
      })),
      { type: 'separator' },
    );
  }

  if (misspelledWord) {
    items.push({
      label: 'Add to Dictionary',
      click: (_, window) => {
        window?.webContents.session.addWordToSpellCheckerDictionary(misspelledWord);
      },
    });
    items.push({ type: 'separator' });
  }

  items.push(
    { label: 'Undo', role: 'undo', enabled: editFlags?.canUndo },
    { label: 'Redo', role: 'redo', enabled: editFlags?.canRedo },
    { type: 'separator' },
    { label: 'Cut', role: 'cut', enabled: editFlags?.canCut },
    { label: 'Copy', role: 'copy', enabled: editFlags?.canCopy },
    { label: 'Paste', role: 'paste', enabled: editFlags?.canPaste },
    { label: 'Select All', role: 'selectAll', enabled: editFlags?.canSelectAll },
  );

  return items;
}

function buildSelectionMenu(options) {
  const { selectionText } = options;
  const truncatedText = selectionText && selectionText.length > 20
    ? selectionText.substring(0, 20) + '...'
    : selectionText;

  return [
    { label: 'Copy', role: 'copy' },
    {
      label: `Search Google for "${truncatedText}"`,
      click: () => {
        if (selectionText) {
          shell.openExternal(`https://google.com/search?q=${encodeURIComponent(selectionText)}`);
        }
      },
    },
  ];
}

function buildLinkMenu(options) {
  const { linkURL, linkText } = options;

  return [
    {
      label: 'Open Link',
      click: () => linkURL && shell.openExternal(linkURL),
    },
    {
      label: 'Open Link in New Window',
      click: () => linkURL && windowManager.createWindow(linkURL),
    },
    { type: 'separator' },
    {
      label: 'Copy Link Address',
      click: () => linkURL && clipboard.writeText(linkURL),
    },
    {
      label: 'Copy Link Text',
      click: () => linkText && clipboard.writeText(linkText),
    },
  ];
}

function buildImageMenu(options) {
  const { srcURL } = options;

  return [
    {
      label: 'Open Image in New Window',
      click: () => srcURL && windowManager.createWindow(srcURL),
    },
    {
      label: 'Open Image in Browser',
      click: () => srcURL && shell.openExternal(srcURL),
    },
    { type: 'separator' },
    {
      label: 'Copy Image Address',
      click: () => srcURL && clipboard.writeText(srcURL),
    },
    {
      label: 'Save Image As...',
      click: async (_, window) => {
        if (srcURL && window) {
          const url = new URL(srcURL);
          const filename = url.pathname.split('/').pop() || 'image';
          
          const result = await dialog.showSaveDialog(window, {
            title: 'Save Image',
            defaultPath: filename,
            filters: [
              { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'] },
              { name: 'All Files', extensions: ['*'] }
            ]
          });
          
          if (!result.canceled && result.filePath) {
            window.webContents.downloadURL(srcURL);
          }
        }
      },
    },
  ];
}

function buildDefaultMenu() {
  return [
    {
      label: 'Back',
      enabled: false,
      click: (_, window) => {
        if (window && window.webContents.canGoBack()) {
          window.webContents.goBack();
        }
      },
    },
    {
      label: 'Forward',
      enabled: false,
      click: (_, window) => {
        if (window && window.webContents.canGoForward()) {
          window.webContents.goForward();
        }
      },
    },
    {
      label: 'Reload',
      click: (_, window) => window?.reload(),
    },
    { type: 'separator' },
    {
      label: 'Inspect Element',
      click: (_, window) => window?.webContents.inspectElement(0, 0),
    },
  ];
}

function registerContextMenu(window) {
  if (!window || window.isDestroyed()) {
    console.error('[ContextMenu] Cannot register for invalid window');
    return;
  }

  window.webContents.on('context-menu', (event, params) => {
    let type = 'default';
    
    if (params.isEditable || params.inputFieldType) {
      type = 'input';
    } else if (params.selectionText && params.selectionText.length > 0) {
      type = 'selection';
    } else if (params.linkURL) {
      type = 'link';
    } else if (params.hasImageContents || params.srcURL) {
      type = 'image';
    }

    const menu = buildContextMenu({
      type,
      editFlags: params.editFlags,
      linkURL: params.linkURL,
      linkText: params.linkText,
      selectionText: params.selectionText,
      misspelledWord: params.misspelledWord,
      dictionarySuggestions: params.dictionarySuggestions,
      srcURL: params.srcURL,
      hasImageContents: params.hasImageContents,
      isEditable: params.isEditable,
      inputFieldType: params.inputFieldType,
    });

    menu.popup({ window, x: params.x, y: params.y });
  });
}

function unregisterContextMenu(window) {
  if (!window || window.isDestroyed()) return;
  window.webContents.removeAllListeners('context-menu');
}

// ============================================================================
// Module Exports
// ============================================================================

module.exports = {
  // Main menu
  buildApplicationMenu,
  updateWindowMenu,

  // Context menu
  buildContextMenu,
  registerContextMenu,
  unregisterContextMenu,

  // Window manager
  windowManager,

  // Utilities
  initializeMenus: () => {
    const menu = buildApplicationMenu();
    Menu.setApplicationMenu(menu);
    return menu;
  },
  refreshMenu: updateWindowMenu,
};
