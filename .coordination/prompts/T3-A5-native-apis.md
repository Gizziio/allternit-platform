# T3-A5: Native APIs

## Agent Role
Native Integration Specialist

## Task
Implement native OS integrations: file drag-drop, notifications, clipboard, and deep links.

## Deliverables

### 1. File Drag & Drop

Create: `7-apps/shell/desktop/main/native/file-drop.ts`

```typescript
import { ipcMain, BrowserWindow } from 'electron';

interface DroppedFile {
  path: string;
  name: string;
  size: number;
  type: string;
}

export function registerFileDropHandlers(): void {
  // Enable drag-drop on all windows
  ipcMain.handle('file-drop:enable', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) return;
    
    window.webContents.on('dom-ready', () => {
      window.webContents.executeJavaScript(`
        document.addEventListener('dragover', (e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
        });
        
        document.addEventListener('drop', async (e) => {
          e.preventDefault();
          const files = Array.from(e.dataTransfer.files);
          const fileData = files.map(f => ({
            path: f.path,
            name: f.name,
            size: f.size,
            type: f.type,
          }));
          window.electronAPI.fileDrop.handleDrop(fileData);
        });
      `);
    });
  });
  
  // Get file info
  ipcMain.handle('file:get-info', async (_, filePath: string) => {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    const stats = await fs.stat(filePath);
    return {
      path: filePath,
      name: path.basename(filePath),
      size: stats.size,
      modified: stats.mtime,
      isDirectory: stats.isDirectory(),
    };
  });
  
  // Read file content
  ipcMain.handle('file:read', async (_, filePath: string, encoding = 'utf-8') => {
    const fs = await import('fs/promises');
    return fs.readFile(filePath, encoding as BufferEncoding);
  });
  
  // Write file content
  ipcMain.handle('file:write', async (_, filePath: string, content: string) => {
    const fs = await import('fs/promises');
    await fs.writeFile(filePath, content, 'utf-8');
  });
  
  // Show save dialog
  ipcMain.handle('file:show-save-dialog', async (event, options) => {
    const { dialog } = await import('electron');
    const window = BrowserWindow.fromWebContents(event.sender);
    
    const result = await dialog.showSaveDialog(window || undefined, {
      defaultPath: options.defaultPath,
      filters: options.filters,
    });
    
    return result;
  });
  
  // Show open dialog
  ipcMain.handle('file:show-open-dialog', async (event, options) => {
    const { dialog } = await import('electron');
    const window = BrowserWindow.fromWebContents(event.sender);
    
    const result = await dialog.showOpenDialog(window || undefined, {
      properties: ['openFile', ...(options.multiSelect ? ['multiSelections'] : [])],
      filters: options.filters,
    });
    
    return result;
  });
}
```

### 2. Native Notifications

Create: `7-apps/shell/desktop/main/native/notifications.ts`

```typescript
import { Notification, ipcMain } from 'electron';
import { windowManager } from '../window/WindowManager';

interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  silent?: boolean;
  actions?: NotificationAction[];
  replyPlaceholder?: string;
}

export function registerNotificationHandlers(): void {
  // Request permission (macOS)
  ipcMain.handle('notification:request-permission', () => {
    return Notification.isSupported();
  });
  
  // Show notification
  ipcMain.handle('notification:show', (_, options: NotificationOptions) => {
    return showNotification(options);
  });
  
  // Show notification with actions
  ipcMain.handle('notification:show-with-actions', (_, options: NotificationOptions) => {
    return showNotificationWithActions(options);
  });
}

export function showNotification(options: NotificationOptions): string {
  const notification = new Notification({
    title: options.title,
    body: options.body,
    icon: options.icon,
    silent: options.silent ?? false,
  });
  
  const id = Math.random().toString(36).substring(7);
  
  notification.on('click', () => {
    windowManager.getAllWindows()[0]?.focus();
    sendToRenderer('notification:click', { id });
  });
  
  notification.on('close', () => {
    sendToRenderer('notification:close', { id });
  });
  
  notification.show();
  
  return id;
}

export function showNotificationWithActions(options: NotificationOptions): string {
  const notification = new Notification({
    title: options.title,
    body: options.body,
    icon: options.icon,
    silent: options.silent ?? false,
    actions: options.actions || [],
    hasReply: !!options.replyPlaceholder,
    replyPlaceholder: options.replyPlaceholder,
  });
  
  const id = Math.random().toString(36).substring(7);
  
  notification.on('click', () => {
    sendToRenderer('notification:click', { id });
  });
  
  notification.on('action', (_, index) => {
    sendToRenderer('notification:action', { id, actionIndex: index });
  });
  
  notification.on('reply', (_, reply) => {
    sendToRenderer('notification:reply', { id, reply });
  });
  
  notification.show();
  
  return id;
}
```

### 3. Clipboard

Create: `7-apps/shell/desktop/main/native/clipboard.ts`

```typescript
import { clipboard, ipcMain, nativeImage } from 'electron';

export function registerClipboardHandlers(): void {
  // Read text
  ipcMain.handle('clipboard:read-text', () => {
    return clipboard.readText();
  });
  
  // Write text
  ipcMain.handle('clipboard:write-text', (_, text: string) => {
    clipboard.writeText(text);
  });
  
  // Read HTML
  ipcMain.handle('clipboard:read-html', () => {
    return clipboard.readHTML();
  });
  
  // Write HTML
  ipcMain.handle('clipboard:write-html', (_, html: string, text?: string) => {
    clipboard.write({
      html,
      text: text || html.replace(/<[^>]*>/g, ''),
    });
  });
  
  // Read image
  ipcMain.handle('clipboard:read-image', () => {
    const image = clipboard.readImage();
    if (image.isEmpty()) return null;
    return image.toDataURL();
  });
  
  // Write image
  ipcMain.handle('clipboard:write-image', (_, dataUrl: string) => {
    const image = nativeImage.createFromDataURL(dataUrl);
    clipboard.writeImage(image);
  });
  
  // Read RTF (rich text)
  ipcMain.handle('clipboard:read-rtf', () => {
    return clipboard.readRTF();
  });
  
  // Clear clipboard
  ipcMain.handle('clipboard:clear', () => {
    clipboard.clear();
  });
  
  // Check formats available
  ipcMain.handle('clipboard:available-formats', () => {
    return clipboard.availableFormats();
  });
}
```

### 4. Deep Links

Create: `7-apps/shell/desktop/main/native/deep-links.ts`

```typescript
import { app, ipcMain } from 'electron';
import { windowManager } from '../window/WindowManager';

const PROTOCOL = 'a2rchitect';

interface DeepLinkData {
  action: string;
  params: Record<string, string>;
}

export function registerDeepLinkHandlers(): void {
  // Set as default protocol client
  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [path.resolve(process.argv[1])]);
    }
  } else {
    app.setAsDefaultProtocolClient(PROTOCOL);
  }
  
  // Handle deep links on macOS/Linux
  app.on('open-url', (event, url) => {
    event.preventDefault();
    handleDeepLink(url);
  });
  
  // Handle deep links on Windows
  const gotTheLock = app.requestSingleInstanceLock();
  
  if (!gotTheLock) {
    app.quit();
  } else {
    app.on('second-instance', (event, commandLine) => {
      // Someone tried to run a second instance
      const mainWindow = windowManager.getAllWindows()[0];
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
      }
      
      // Handle deep link from second instance
      const url = commandLine.find(arg => arg.startsWith(`${PROTOCOL}://`));
      if (url) {
        handleDeepLink(url);
      }
    });
  }
  
  // Check for deep link on startup
  const deepLink = process.argv.find(arg => arg.startsWith(`${PROTOCOL}://`));
  if (deepLink) {
    handleDeepLink(deepLink);
  }
}

function handleDeepLink(url: string): void {
  const data = parseDeepLink(url);
  
  // Focus window
  const window = windowManager.getAllWindows()[0];
  if (window) {
    if (window.isMinimized()) window.restore();
    window.focus();
  }
  
  // Send to renderer
  sendToRenderer('deep-link', data);
}

function parseDeepLink(url: string): DeepLinkData {
  const urlObj = new URL(url);
  
  return {
    action: urlObj.hostname,
    params: Object.fromEntries(urlObj.searchParams),
  };
}

// Supported deep links:
// a2rchitect://chat?id=123
// a2rchitect://workflow?id=abc
// a2rchitect://agent/new
// a2rchitect://settings/theme
```

### 5. OS Integration

Create: `7-apps/shell/desktop/main/native/os-integration.ts`

```typescript
import { app, ipcMain, shell, dialog } from 'electron';
import { windowManager } from '../window/WindowManager';

export function registerOSIntegrationHandlers(): void {
  // Open external URL
  ipcMain.handle('shell:open-external', (_, url: string) => {
    return shell.openExternal(url);
  });
  
  // Show item in folder
  ipcMain.handle('shell:show-item', (_, path: string) => {
    return shell.showItemInFolder(path);
  });
  
  // Open path
  ipcMain.handle('shell:open-path', (_, path: string) => {
    return shell.openPath(path);
  });
  
  // Beep
  ipcMain.handle('shell:beep', () => {
    shell.beep();
  });
  
  // Get app version
  ipcMain.handle('app:version', () => {
    return {
      version: app.getVersion(),
      name: app.getName(),
      locale: app.getLocale(),
    };
  });
  
  // Get app paths
  ipcMain.handle('app:paths', () => {
    return {
      home: app.getPath('home'),
      appData: app.getPath('appData'),
      userData: app.getPath('userData'),
      temp: app.getPath('temp'),
      downloads: app.getPath('downloads'),
      documents: app.getPath('documents'),
    };
  });
  
  // Show message box
  ipcMain.handle('dialog:show-message', async (event, options) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    return dialog.showMessageBox(window || undefined, options);
  });
  
  // Show error box
  ipcMain.handle('dialog:show-error', (_, title: string, content: string) => {
    dialog.showErrorBox(title, content);
  });
}
```

### 6. Preload API

Update preload script to expose APIs:

```typescript
// preload/index.ts
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // File operations
  file: {
    getInfo: (path: string) => ipcRenderer.invoke('file:get-info', path),
    read: (path: string, encoding?: string) => ipcRenderer.invoke('file:read', path, encoding),
    write: (path: string, content: string) => ipcRenderer.invoke('file:write', path, content),
    showSaveDialog: (options: any) => ipcRenderer.invoke('file:show-save-dialog', options),
    showOpenDialog: (options: any) => ipcRenderer.invoke('file:show-open-dialog', options),
    onDrop: (callback: (files: any[]) => void) => {
      ipcRenderer.on('file-drop', (_, files) => callback(files));
    },
  },
  
  // Notifications
  notification: {
    requestPermission: () => ipcRenderer.invoke('notification:request-permission'),
    show: (options: any) => ipcRenderer.invoke('notification:show', options),
    onClick: (callback: (data: any) => void) => {
      ipcRenderer.on('notification:click', (_, data) => callback(data));
    },
  },
  
  // Clipboard
  clipboard: {
    readText: () => ipcRenderer.invoke('clipboard:read-text'),
    writeText: (text: string) => ipcRenderer.invoke('clipboard:write-text', text),
    readImage: () => ipcRenderer.invoke('clipboard:read-image'),
    writeImage: (dataUrl: string) => ipcRenderer.invoke('clipboard:write-image', dataUrl),
  },
  
  // Deep links
  deepLink: {
    onDeepLink: (callback: (data: any) => void) => {
      ipcRenderer.on('deep-link', (_, data) => callback(data));
    },
  },
  
  // OS
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke('shell:open-external', url),
    showItem: (path: string) => ipcRenderer.invoke('shell:show-item', path),
  },
  
  // App info
  app: {
    getVersion: () => ipcRenderer.invoke('app:version'),
    getPaths: () => ipcRenderer.invoke('app:paths'),
  },
});
```

## Requirements

- File drag & drop across entire window
- File read/write dialogs
- Native notifications with actions
- Clipboard with images
- Deep link protocol registration
- OS shell integration

## Success Criteria
- [ ] File drop handlers
- [ ] File dialog APIs
- [ ] Native notifications
- [ ] Clipboard (text + images)
- [ ] Deep link protocol
- [ ] OS integration APIs
- [ ] Complete preload API
- [ ] TypeScript types
- [ ] No SYSTEM_LAW violations
