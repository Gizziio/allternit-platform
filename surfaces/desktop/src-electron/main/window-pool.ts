import { BrowserWindow } from 'electron';
import { createWindowOptions } from './window-state';

interface PooledWindow {
  window: BrowserWindow;
  inUse: boolean;
}

export class WindowPool {
  private pool: PooledWindow[] = [];
  private maxPoolSize = 3;
  private preloadPath: string;
  private indexPath: string;

  constructor(preloadPath: string, indexPath: string) {
    this.preloadPath = preloadPath;
    this.indexPath = indexPath;
  }

  private createWindow(
    options: Partial<Electron.BrowserWindowConstructorOptions> = {}
  ): BrowserWindow {
    const baseOptions = createWindowOptions();

    const window = new BrowserWindow({
      ...baseOptions,
      ...options,
      show: false,
      webPreferences: {
        ...baseOptions.webPreferences,
        preload: this.preloadPath,
      },
    });

    return window;
  }

  acquire(
    options: Partial<Electron.BrowserWindowConstructorOptions> = {}
  ): BrowserWindow {
    const availableWindow = this.pool.find((item) => !item.inUse);

    if (availableWindow) {
      availableWindow.inUse = true;

      if (options.title) {
        availableWindow.window.setTitle(options.title);
      }

      return availableWindow.window;
    }

    const newWindow = this.createWindow(options);

    this.pool.push({
      window: newWindow,
      inUse: true,
    });

    this.trimPool();

    return newWindow;
  }

  release(window: BrowserWindow): void {
    const pooledItem = this.pool.find((item) => item.window === window);

    if (pooledItem) {
      pooledItem.inUse = false;

      if (!window.isDestroyed()) {
        window.hide();

        window.removeAllListeners('closed');
        window.once('closed', () => {
          this.removeFromPool(window);
        });
      }
    }
  }

  private removeFromPool(window: BrowserWindow): void {
    const index = this.pool.findIndex((item) => item.window === window);
    if (index !== -1) {
      this.pool.splice(index, 1);
    }
  }

  private trimPool(): void {
    const unusedWindows = this.pool.filter((item) => !item.inUse);

    while (this.pool.length > this.maxPoolSize && unusedWindows.length > 0) {
      const windowToRemove = unusedWindows.shift();
      if (windowToRemove && !windowToRemove.window.isDestroyed()) {
        this.removeFromPool(windowToRemove.window);
        windowToRemove.window.removeAllListeners('closed');
        windowToRemove.window.close();
      }
    }
  }

  getSize(): number {
    return this.pool.length;
  }

  getAvailableCount(): number {
    return this.pool.filter((item) => !item.inUse).length;
  }

  dispose(): void {
    for (const item of this.pool) {
      if (!item.window.isDestroyed()) {
        item.window.removeAllListeners('closed');
        item.window.close();
      }
    }
    this.pool = [];
  }
}
