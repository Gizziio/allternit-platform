# T3-A4: Auto Updater

## Agent Role
Deployment Specialist

## Task
Implement electron-updater with automatic update checks, downloads, and installation.

## Deliverables

### 1. Updater Module

Create: `7-apps/shell/desktop/main/updater/`

```
main/updater/
├── index.ts
├── Updater.ts            # Main updater class
├── update-window.ts      # Update dialog window
├── update-check.ts       # Manual update check
└── ipc-handlers.ts       # IPC communication
```

### 2. Updater Class

Create: `7-apps/shell/desktop/main/updater/Updater.ts`

```typescript
import { autoUpdater, UpdateCheckResult, UpdateInfo } from 'electron-updater';
import { dialog, BrowserWindow, ipcMain } from 'electron';
import { windowManager } from '../window/WindowManager';
import logger from 'electron-log';

interface UpdaterConfig {
  autoCheck: boolean;
  autoDownload: boolean;
  allowPrerelease: boolean;
  checkInterval: number; // hours
}

export class Updater {
  private config: UpdaterConfig;
  private updateAvailable = false;
  private updateInfo: UpdateInfo | null = null;
  private checking = false;
  
  constructor(config: Partial<UpdaterConfig> = {}) {
    this.config = {
      autoCheck: true,
      autoDownload: false, // Ask user first
      allowPrerelease: false,
      checkInterval: 24,
      ...config,
    };
    
    this.setupAutoUpdater();
  }
  
  private setupAutoUpdater(): void {
    // Configure logger
    autoUpdater.logger = logger;
    
    // Configure options
    autoUpdater.autoDownload = this.config.autoDownload;
    autoUpdater.allowPrerelease = this.config.allowPrerelease;
    autoUpdater.autoInstallOnAppQuit = true;
    
    // Event handlers
    autoUpdater.on('checking-for-update', () => {
      this.checking = true;
      this.notifyRenderer('updater:checking');
    });
    
    autoUpdater.on('update-available', (info) => {
      this.checking = false;
      this.updateAvailable = true;
      this.updateInfo = info;
      this.notifyRenderer('updater:available', info);
      
      if (!this.config.autoDownload) {
        this.showUpdateDialog(info);
      }
    });
    
    autoUpdater.on('update-not-available', () => {
      this.checking = false;
      this.notifyRenderer('updater:not-available');
    });
    
    autoUpdater.on('download-progress', (progress) => {
      this.notifyRenderer('updater:progress', progress);
    });
    
    autoUpdater.on('update-downloaded', (info) => {
      this.notifyRenderer('updater:downloaded', info);
      this.showInstallDialog(info);
    });
    
    autoUpdater.on('error', (error) => {
      this.checking = false;
      logger.error('Update error:', error);
      this.notifyRenderer('updater:error', error.message);
    });
  }
  
  async checkForUpdates(silent = false): Promise<UpdateCheckResult | null> {
    if (this.checking) return null;
    
    try {
      const result = await autoUpdater.checkForUpdates();
      return result;
    } catch (error) {
      logger.error('Failed to check for updates:', error);
      if (!silent) {
        dialog.showErrorBox('Update Error', 'Failed to check for updates. Please try again later.');
      }
      return null;
    }
  }
  
  async downloadUpdate(): Promise<void> {
    if (!this.updateAvailable) return;
    
    try {
      await autoUpdater.downloadUpdate();
    } catch (error) {
      logger.error('Failed to download update:', error);
      dialog.showErrorBox('Download Error', 'Failed to download update. Please try again later.');
    }
  }
  
  installUpdate(): void {
    autoUpdater.quitAndInstall(false, true);
  }
  
  private showUpdateDialog(info: UpdateInfo): void {
    const window = windowManager.getFocusedWindow();
    
    const result = dialog.showMessageBoxSync(window || undefined, {
      type: 'info',
      title: 'Update Available',
      message: `A2rchitect ${info.version} is available`,
      detail: `Current version: ${autoUpdater.currentVersion}\n\n${info.releaseNotes || 'A new version is available with improvements and bug fixes.'}`,
      buttons: ['Download & Install', 'Later', 'Skip This Version'],
      defaultId: 0,
      cancelId: 1,
    });
    
    switch (result) {
      case 0:
        this.downloadUpdate();
        break;
      case 2:
        // Skip this version - store in settings
        store.set('skipped-version', info.version);
        break;
    }
  }
  
  private showInstallDialog(info: UpdateInfo): void {
    const window = windowManager.getFocusedWindow();
    
    const result = dialog.showMessageBoxSync(window || undefined, {
      type: 'info',
      title: 'Update Ready',
      message: `A2rchitect ${info.version} has been downloaded`,
      detail: 'The update will be installed when you restart the application.',
      buttons: ['Restart Now', 'Later'],
      defaultId: 0,
    });
    
    if (result === 0) {
      this.installUpdate();
    }
  }
  
  private notifyRenderer(channel: string, data?: unknown): void {
    windowManager.getAllWindows().forEach(window => {
      window.webContents.send(channel, data);
    });
  }
  
  startPeriodicChecks(): void {
    if (!this.config.autoCheck) return;
    
    // Check on startup
    setTimeout(() => this.checkForUpdates(true), 5000);
    
    // Check periodically
    setInterval(() => {
      this.checkForUpdates(true);
    }, this.config.checkInterval * 60 * 60 * 1000);
  }
  
  getCurrentVersion(): string {
    return autoUpdater.currentVersion;
  }
  
  isUpdateAvailable(): boolean {
    return this.updateAvailable;
  }
}

export const updater = new Updater();
```

### 3. Update Progress Window

Create: `7-apps/shell/desktop/main/updater/update-window.ts`

```typescript
import { BrowserWindow } from 'electron';
import path from 'path';

let updateWindow: BrowserWindow | null = null;

export function showUpdateProgressWindow(): BrowserWindow {
  if (updateWindow) {
    updateWindow.focus();
    return updateWindow;
  }
  
  updateWindow = new BrowserWindow({
    width: 400,
    height: 200,
    resizable: false,
    minimizable: false,
    maximizable: false,
    show: false,
    title: 'Downloading Update',
    webPreferences: {
      preload: path.join(__dirname, '../../preload/updater.js'),
      contextIsolation: true,
    },
  });
  
  updateWindow.loadURL(`${getDefaultUrl()}/update-progress`);
  
  updateWindow.once('ready-to-show', () => {
    updateWindow?.show();
  });
  
  updateWindow.on('closed', () => {
    updateWindow = null;
  });
  
  return updateWindow;
}

export function updateProgress(percent: number): void {
  updateWindow?.webContents.send('updater:progress', percent);
}

export function closeUpdateWindow(): void {
  updateWindow?.close();
  updateWindow = null;
}
```

### 4. IPC Handlers

Create: `7-apps/shell/desktop/main/updater/ipc-handlers.ts`

```typescript
import { ipcMain } from 'electron';
import { updater } from './Updater';

export function registerUpdaterIPC(): void {
  // Check for updates
  ipcMain.handle('updater:check', async () => {
    const result = await updater.checkForUpdates();
    return {
      available: result?.updateInfo ? true : false,
      version: result?.updateInfo?.version,
      releaseNotes: result?.updateInfo?.releaseNotes,
    };
  });
  
  // Download update
  ipcMain.handle('updater:download', async () => {
    await updater.downloadUpdate();
  });
  
  // Install update
  ipcMain.handle('updater:install', () => {
    updater.installUpdate();
  });
  
  // Get current version
  ipcMain.handle('updater:version', () => {
    return updater.getCurrentVersion();
  });
  
  // Get update status
  ipcMain.handle('updater:status', () => {
    return {
      checking: updater.checking,
      available: updater.isUpdateAvailable(),
    };
  });
}
```

### 5. Publish Configuration

Update `package.json` for electron-builder:

```json
{
  "build": {
    "appId": "io.a2rchitect.desktop",
    "productName": "A2rchitect",
    "directories": {
      "output": "dist"
    },
    "publish": {
      "provider": "github",
      "owner": "a2rchitect",
      "repo": "shell",
      "releaseType": "release"
    },
    "mac": {
      "target": ["dmg", "zip"],
      "category": "public.app-category.developer-tools"
    },
    "win": {
      "target": ["nsis", "portable"]
    },
    "linux": {
      "target": ["AppImage", "deb", "rpm"],
      "category": "Development"
    }
  }
}
```

### 6. Update Settings UI

Add settings for auto-updater:

```typescript
// Settings interface additions
interface UpdateSettings {
  autoCheck: boolean;
  autoDownload: boolean;
  allowPrerelease: boolean;
  checkInterval: number;
}
```

## Requirements

- Auto-check on startup
- Manual check via menu
- Download progress notification
- Install on quit or restart
- Skip version option
- Error handling

## Success Criteria
- [ ] Updater class with electron-updater
- [ ] Update check on startup
- [ ] Update dialog with release notes
- [ ] Download progress window
- [ ] Install dialog
- [ ] IPC handlers for renderer
- [ ] electron-builder publish config
- [ ] Update settings UI
- [ ] No SYSTEM_LAW violations
