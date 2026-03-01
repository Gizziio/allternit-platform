# T3-A3: System Tray

## Agent Role
System Integration Specialist

## Task
Implement system tray icon with menu, notifications, and quick actions.

## Deliverables

### 1. Tray Manager Module

Create: `7-apps/shell/desktop/main/tray/`

```
main/tray/
├── index.ts
├── TrayManager.ts        # Main tray manager
├── tray-menu.ts          # Tray context menu
├── tray-icons.ts         # Icon generation/selection
└── tray-notifications.ts # Notification handling
```

### 2. Tray Manager Class

Create: `7-apps/shell/desktop/main/tray/TrayManager.ts`

```typescript
import { Tray, Menu, nativeImage, app, BrowserWindow } from 'electron';
import { windowManager } from '../window/WindowManager';
import path from 'path';

interface TrayConfig {
  showOnStart?: boolean;
  minimizeToTray?: boolean;
  closeToTray?: boolean;
  showNotifications?: boolean;
}

export class TrayManager {
  private tray: Tray | null = null;
  private config: TrayConfig;
  private unreadCount = 0;
  
  constructor(config: TrayConfig = {}) {
    this.config = {
      showOnStart: true,
      minimizeToTray: true,
      closeToTray: true,
      showNotifications: true,
      ...config,
    };
  }
  
  initialize(): void {
    if (this.tray) return;
    
    const icon = this.loadIcon();
    this.tray = new Tray(icon);
    
    this.tray.setToolTip('A2rchitect');
    this.tray.setContextMenu(this.buildContextMenu());
    
    // Click handlers
    this.tray.on('click', () => this.handleTrayClick());
    this.tray.on('double-click', () => this.showWindow());
    this.tray.on('right-click', () => this.tray?.popUpContextMenu());
    
    // Balloon click (Windows)
    this.tray.on('balloon-click', () => this.showWindow());
  }
  
  private loadIcon(): nativeImage {
    // Load appropriate icon based on platform
    const iconPath = process.platform === 'darwin'
      ? path.join(__dirname, '../../resources/tray-iconTemplate.png')
      : process.platform === 'win32'
        ? path.join(__dirname, '../../resources/tray-icon.ico')
        : path.join(__dirname, '../../resources/tray-icon.png');
    
    const image = nativeImage.createFromPath(iconPath);
    
    // macOS needs template image for dark mode
    if (process.platform === 'darwin') {
      image.setTemplateImage(true);
    }
    
    return image.resize({ width: 16, height: 16 });
  }
  
  private buildContextMenu(): Menu {
    return Menu.buildFromTemplate([
      {
        label: 'Open A2rchitect',
        click: () => this.showWindow(),
      },
      { type: 'separator' },
      {
        label: 'New Chat',
        click: () => {
          this.showWindow();
          sendToFocusedWindow('tray:new-chat');
        },
      },
      {
        label: 'Quick Action',
        submenu: [
          {
            label: 'Focus Mode',
            click: () => {
              this.showWindow();
              sendToFocusedWindow('tray:focus-mode');
            },
          },
          {
            label: 'Agent Panel',
            click: () => {
              this.showWindow();
              sendToFocusedWindow('tray:agent-panel');
            },
          },
        ],
      },
      { type: 'separator' },
      {
        label: 'Recent Conversations',
        submenu: this.buildRecentConversationsMenu(),
      },
      { type: 'separator' },
      {
        label: 'Settings',
        click: () => {
          this.showWindow();
          sendToFocusedWindow('tray:settings');
        },
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => app.quit(),
      },
    ]);
  }
  
  private buildRecentConversationsMenu(): MenuItemConstructorOptions[] {
    // Fetch from store or main state
    const recent = getRecentConversations();
    
    if (recent.length === 0) {
      return [{ label: 'No recent conversations', enabled: false }];
    }
    
    return recent.map(conv => ({
      label: conv.title,
      click: () => {
        this.showWindow();
        sendToFocusedWindow('tray:open-conversation', conv.id);
      },
    }));
  }
  
  private handleTrayClick(): void {
    if (process.platform === 'darwin') {
      // macOS: show context menu on right-click only
      return;
    }
    
    // Windows/Linux: toggle window
    const window = windowManager.getFocusedWindow();
    if (window?.isVisible() && window.isFocused()) {
      if (this.config.minimizeToTray) {
        window.hide();
      } else {
        window.minimize();
      }
    } else {
      this.showWindow();
    }
  }
  
  showWindow(): void {
    const window = windowManager.getFocusedWindow() || windowManager.getAllWindows()[0];
    
    if (window) {
      if (window.isMinimized()) {
        window.restore();
      }
      window.show();
      window.focus();
    } else {
      windowManager.createWindow();
    }
  }
  
  updateUnreadCount(count: number): void {
    this.unreadCount = count;
    
    // Update tooltip
    this.tray?.setToolTip(count > 0 ? `A2rchitect (${count} unread)` : 'A2rchitect');
    
    // Update icon with badge (macOS/Linux)
    if (process.platform !== 'win32') {
      this.updateIconWithBadge(count);
    }
    
    // Show native notification
    if (count > 0 && this.config.showNotifications) {
      this.showNotification(count);
    }
  }
  
  private updateIconWithBadge(count: number): void {
    // Create badge overlay on icon
    // This requires canvas/image manipulation
    const baseIcon = this.loadIcon();
    
    if (count === 0) {
      this.tray?.setImage(baseIcon);
      return;
    }
    
    // Create badge image
    const badgeIcon = createBadgeIcon(baseIcon, count);
    this.tray?.setImage(badgeIcon);
  }
  
  private showNotification(count: number): void {
    const notification = new Notification({
      title: 'A2rchitect',
      body: count === 1 ? 'You have a new message' : `You have ${count} new messages`,
      icon: path.join(__dirname, '../../resources/icon.png'),
      silent: false,
    });
    
    notification.on('click', () => {
      this.showWindow();
    });
    
    notification.show();
  }
  
  destroy(): void {
    this.tray?.destroy();
    this.tray = null;
  }
}

export const trayManager = new TrayManager();
```

### 3. Tray Icon Generation

Create: `7-apps/shell/desktop/main/tray/tray-icons.ts`

```typescript
import { nativeImage, NativeImage } from 'electron';

export function createBadgeIcon(baseIcon: NativeImage, count: number): NativeImage {
  const size = baseIcon.getSize();
  const canvas = document.createElement('canvas'); // Use Node canvas in Electron
  canvas.width = size.width;
  canvas.height = size.height;
  
  const ctx = canvas.getContext('2d')!;
  
  // Draw base icon
  const baseBitmap = baseIcon.toBitmap();
  // ... draw base
  
  // Draw badge circle
  const badgeSize = size.width * 0.4;
  const badgeX = size.width - badgeSize;
  const badgeY = 0;
  
  ctx.fillStyle = '#ef4444'; // Red badge
  ctx.beginPath();
  ctx.arc(badgeX + badgeSize/2, badgeY + badgeSize/2, badgeSize/2, 0, Math.PI * 2);
  ctx.fill();
  
  // Draw count
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${badgeSize * 0.6}px system-ui`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(count > 9 ? '9+' : String(count), badgeX + badgeSize/2, badgeY + badgeSize/2);
  
  return nativeImage.createFromDataURL(canvas.toDataURL());
}

// Alternative: Use nativeImage.createFromNamedImage on macOS
export function getTrayIconForPlatform(platform: NodeJS.Platform): string {
  switch (platform) {
    case 'darwin':
      return 'tray-iconTemplate.png';
    case 'win32':
      return 'tray-icon.ico';
    case 'linux':
    default:
      return 'tray-icon.png';
  }
}
```

### 4. Window-Tray Integration

Update window creation to integrate with tray:

```typescript
// In WindowManager.ts
function setupWindowEvents(window: BrowserWindow, id: string): void {
  // ... existing setup
  
  // Handle minimize
  window.on('minimize', (event) => {
    if (trayManager.config.minimizeToTray) {
      event.preventDefault();
      window.hide();
    }
  });
  
  // Handle close
  window.on('close', (event) => {
    if (!app.isQuiting && trayManager.config.closeToTray) {
      event.preventDefault();
      window.hide();
    }
  });
}
```

### 5. Settings Integration

Add tray settings to preferences:

```typescript
// IPC handlers for tray settings
ipcMain.handle('tray:get-settings', () => trayManager.config);

ipcMain.handle('tray:set-settings', (_, settings) => {
  trayManager.config = { ...trayManager.config, ...settings };
  store.set('tray-settings', trayManager.config);
});
```

### 6. Tray Icon Assets

Ensure tray icons exist:

```
resources/
├── tray-icon.png        # 16x16 or 32x32
├── tray-icon.ico        # Windows multi-resolution
├── tray-iconTemplate.png # macOS template
└── tray-icon@2x.png     # macOS retina
```

## Requirements

- System tray icon for all platforms
- Context menu with quick actions
- Unread message badge
- Minimize to tray option
- Close to tray option
- Native notifications

## Success Criteria
- [ ] TrayManager class
- [ ] Context menu with 8+ items
- [ ] Unread badge support
- [ ] Minimize/close to tray
- [ ] Native notifications
- [ ] Recent conversations menu
- [ ] Platform-specific icons
- [ ] No SYSTEM_LAW violations
