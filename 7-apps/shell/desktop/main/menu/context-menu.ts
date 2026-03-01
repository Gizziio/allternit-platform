/**
 * @fileoverview Context Menu Builder
 * @module main/menu/context-menu
 * 
 * Builds context menus for right-click interactions.
 * Supports: default, input, selection, link, and image context types.
 * 
 * @author T3-A2: Native Menus specialist
 * @version 1.0.0
 */

import { Menu, MenuItemConstructorOptions, BrowserWindow, clipboard, shell, dialog } from 'electron';
import { windowManager } from '../window/WindowManager';

/**
 * Context menu type options
 */
export type ContextMenuType = 'default' | 'input' | 'selection' | 'link' | 'image';

/**
 * Options for building a context menu
 */
export interface ContextMenuOptions {
  type: ContextMenuType;
  editFlags?: Electron.EditFlags;
  linkURL?: string;
  linkText?: string;
  selectionText?: string;
  misspelledWord?: string;
  dictionarySuggestions?: string[];
  srcURL?: string;
  hasImageContents?: boolean;
  isEditable?: boolean;
  inputFieldType?: string;
}

/**
 * Builds a context menu based on the provided options
 * @param {ContextMenuOptions} options - Configuration for the context menu
 * @returns {Menu} The built context menu
 */
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
    case 'image':
      template.push(...buildImageMenu(options));
      break;
    case 'default':
    default:
      template.push(...buildDefaultMenu());
      break;
  }

  return Menu.buildFromTemplate(template);
}

/**
 * Builds menu items for input field context
 * @param {ContextMenuOptions} options - Context menu options
 * @returns {MenuItemConstructorOptions[]} Array of menu items
 */
function buildInputMenu(options: ContextMenuOptions): MenuItemConstructorOptions[] {
  const { editFlags, misspelledWord, dictionarySuggestions, isEditable } = options;
  const items: MenuItemConstructorOptions[] = [];

  // Spelling suggestions
  if (misspelledWord && dictionarySuggestions && dictionarySuggestions.length > 0) {
    items.push(
      ...dictionarySuggestions.map(word => ({
        label: word,
        click: (_menuItem: Electron.MenuItem, window: BrowserWindow | undefined) => {
          if (window && !window.isDestroyed()) {
            window.webContents.replaceMisspelling(word);
          }
        },
      })),
      { type: 'separator' } as MenuItemConstructorOptions,
    );
  }

  // Add to dictionary option for misspelled words
  if (misspelledWord) {
    items.push({
      label: 'Add to Dictionary',
      click: (_, window) => {
        if (window && !window.isDestroyed()) {
          window.webContents.session.addWordToSpellCheckerDictionary(misspelledWord);
        }
      },
    });
    items.push({ type: 'separator' } as MenuItemConstructorOptions);
  }

  // Standard edit operations
  items.push(
    {
      label: 'Undo',
      role: 'undo',
      enabled: editFlags?.canUndo ?? false,
    },
    {
      label: 'Redo',
      role: 'redo',
      enabled: editFlags?.canRedo ?? false,
    },
    { type: 'separator' },
    {
      label: 'Cut',
      role: 'cut',
      enabled: editFlags?.canCut ?? false,
    },
    {
      label: 'Copy',
      role: 'copy',
      enabled: editFlags?.canCopy ?? false,
    },
    {
      label: 'Paste',
      role: 'paste',
      enabled: editFlags?.canPaste ?? false,
    },
    {
      label: 'Paste and Match Style',
      role: 'pasteAndMatchStyle',
      enabled: editFlags?.canPaste ?? false,
    },
    {
      label: 'Delete',
      role: 'delete',
      enabled: editFlags?.canDelete ?? false,
    },
    {
      label: 'Select All',
      role: 'selectAll',
      enabled: editFlags?.canSelectAll ?? false,
    },
  );

  return items;
}

/**
 * Builds menu items for text selection context
 * @param {ContextMenuOptions} options - Context menu options
 * @returns {MenuItemConstructorOptions[]} Array of menu items
 */
function buildSelectionMenu(options: ContextMenuOptions): MenuItemConstructorOptions[] {
  const { selectionText } = options;
  const truncatedText = selectionText && selectionText.length > 20 
    ? selectionText.substring(0, 20) + '...' 
    : selectionText;

  return [
    {
      label: 'Copy',
      role: 'copy',
    },
    {
      label: `Search Google for "${truncatedText}"`,
      click: () => {
        if (selectionText) {
          shell.openExternal(`https://google.com/search?q=${encodeURIComponent(selectionText)}`);
        }
      },
    },
    {
      label: 'Search DuckDuckGo',
      click: () => {
        if (selectionText) {
          shell.openExternal(`https://duckduckgo.com/?q=${encodeURIComponent(selectionText)}`);
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Copy as Markdown Quote',
      click: (_, window) => {
        if (selectionText) {
          const markdownQuote = selectionText.split('\n').map(line => `> ${line}`).join('\n');
          clipboard.writeText(markdownQuote);
        }
      },
    },
  ];
}

/**
 * Builds menu items for link context
 * @param {ContextMenuOptions} options - Context menu options
 * @returns {MenuItemConstructorOptions[]} Array of menu items
 */
function buildLinkMenu(options: ContextMenuOptions): MenuItemConstructorOptions[] {
  const { linkURL, linkText } = options;

  return [
    {
      label: 'Open Link',
      click: () => {
        if (linkURL) {
          shell.openExternal(linkURL);
        }
      },
    },
    {
      label: 'Open Link in New Window',
      click: () => {
        if (linkURL) {
          void windowManager.createWindow({ url: linkURL });
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Copy Link Address',
      click: () => {
        if (linkURL) {
          clipboard.writeText(linkURL);
        }
      },
    },
    {
      label: 'Copy Link Text',
      click: () => {
        if (linkText) {
          clipboard.writeText(linkText);
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Save Link As...',
      click: async (_, window) => {
        if (linkURL && window && !window.isDestroyed()) {
          const result = await dialog.showSaveDialog(window, {
            title: 'Save Link',
            defaultPath: linkText || 'download',
          });
          if (!result.canceled && result.filePath) {
            // Trigger download
            window.webContents.downloadURL(linkURL);
          }
        }
      },
    },
  ];
}

/**
 * Builds menu items for image context
 * @param {ContextMenuOptions} options - Context menu options
 * @returns {MenuItemConstructorOptions[]} Array of menu items
 */
function buildImageMenu(options: ContextMenuOptions): MenuItemConstructorOptions[] {
  const { srcURL } = options;

  return [
    {
      label: 'Open Image in New Window',
      click: () => {
        if (srcURL) {
          void windowManager.createWindow({ url: srcURL });
        }
      },
    },
    {
      label: 'Open Image in Browser',
      click: () => {
        if (srcURL) {
          shell.openExternal(srcURL);
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Copy Image',
      click: (_, window) => {
        if (window && !window.isDestroyed()) {
          window.webContents.copyImageAt(0, 0);
        }
      },
    },
    {
      label: 'Copy Image Address',
      click: () => {
        if (srcURL) {
          clipboard.writeText(srcURL);
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Save Image As...',
      click: async (_, window) => {
        if (srcURL && window && !window.isDestroyed()) {
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

/**
 * Builds default menu items for general context
 * @returns {MenuItemConstructorOptions[]} Array of menu items
 */
function buildDefaultMenu(): MenuItemConstructorOptions[] {
  return [
    {
      label: 'Back',
      enabled: false,
      click: (_, window) => {
        if (window && !window.isDestroyed() && window.webContents.canGoBack()) {
          window.webContents.goBack();
        }
      },
    },
    {
      label: 'Forward',
      enabled: false,
      click: (_, window) => {
        if (window && !window.isDestroyed() && window.webContents.canGoForward()) {
          window.webContents.goForward();
        }
      },
    },
    {
      label: 'Reload',
      click: (_, window) => {
        if (window && !window.isDestroyed()) {
          window.reload();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Inspect Element',
      click: (_, window) => {
        if (window && !window.isDestroyed()) {
          window.webContents.inspectElement(0, 0);
        }
      },
    },
  ];
}

/**
 * Registers the context menu handler for a browser window
 * @param {BrowserWindow} window - The window to register context menu for
 */
export function registerContextMenu(window: BrowserWindow): void {
  if (!window || window.isDestroyed()) {
    console.error('[ContextMenu] Cannot register context menu for invalid window');
    return;
  }

  window.webContents.on('context-menu', (event, params) => {
    // Determine context type based on params
    let type: ContextMenuType = 'default';
    
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

    // Show the menu at the click position
    menu.popup({
      window,
      x: params.x,
      y: params.y,
    });
  });
}

/**
 * Unregisters the context menu handler from a browser window
 * @param {BrowserWindow} window - The window to unregister context menu from
 */
export function unregisterContextMenu(window: BrowserWindow): void {
  if (!window || window.isDestroyed()) {
    return;
  }
  
  // Note: Electron doesn't provide a direct way to remove listeners,
  // but we can remove all listeners for the 'context-menu' event
  window.webContents.removeAllListeners('context-menu');
}
