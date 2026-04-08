import { BrowserWindow, app, dialog, ipcMain } from 'electron';
import { debounce } from './utils/debounce';
import { saveWindowState } from './window-state';
import { IPC_CHANNELS } from '../shared/ipc-channels';

interface UnsavedChangesState {
  hasUnsavedChanges: boolean;
  message: string;
}

const unsavedChangesMap = new Map<number, UnsavedChangesState>();

export function setupWindowEvents(
  window: BrowserWindow,
  onQuitStateChange?: (isQuitting: boolean) => void
): void {
  const windowId = window.id;

  window.on('blur', () => {
    window.webContents.send(IPC_CHANNELS.WINDOW.BLUR);
  });

  window.on('focus', () => {
    window.webContents.send(IPC_CHANNELS.WINDOW.FOCUS);
  });

  window.on('show', () => {
    window.webContents.send(IPC_CHANNELS.WINDOW.SHOW);
  });

  window.on('hide', () => {
    window.webContents.send(IPC_CHANNELS.WINDOW.HIDE);
  });

  const debouncedResize = debounce(() => {
    saveWindowState(window);
    window.webContents.send(IPC_CHANNELS.WINDOW.RESIZE, window.getBounds());
  }, 500);

  window.on('resize', debouncedResize);

  const debouncedMove = debounce(() => {
    saveWindowState(window);
    window.webContents.send(IPC_CHANNELS.WINDOW.MOVE, window.getBounds());
  }, 500);

  window.on('move', debouncedMove);

  window.on('maximize', () => {
    window.webContents.send(IPC_CHANNELS.WINDOW.MAXIMIZE, true);
  });

  window.on('unmaximize', () => {
    window.webContents.send(IPC_CHANNELS.WINDOW.MAXIMIZE, false);
  });

  window.on('enter-full-screen', () => {
    window.webContents.send(IPC_CHANNELS.WINDOW.FULLSCREEN, true);
  });

  window.on('leave-full-screen', () => {
    window.webContents.send(IPC_CHANNELS.WINDOW.FULLSCREEN, false);
  });

  window.on('close', async (event) => {
    const state = unsavedChangesMap.get(windowId);

    if (state?.hasUnsavedChanges) {
      event.preventDefault();

      const result = await dialog.showMessageBox(window, {
        type: 'question',
        buttons: ['Save', 'Don\'t Save', 'Cancel'],
        defaultId: 0,
        cancelId: 2,
        title: 'Unsaved Changes',
        message: state.message || 'You have unsaved changes.',
        detail: 'Do you want to save your changes before closing?',
      });

      if (result.response === 0) {
        window.webContents.send(IPC_CHANNELS.WINDOW.SAVE_REQUEST);

        window.once('saved-response', (saved: boolean) => {
          if (saved) {
            unsavedChangesMap.set(windowId, { hasUnsavedChanges: false, message: '' });
            window.close();
          }
        });
      } else if (result.response === 1) {
        unsavedChangesMap.set(windowId, { hasUnsavedChanges: false, message: '' });
        window.close();
      }
    }
  });

  window.on('closed', () => {
    unsavedChangesMap.delete(windowId);
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW.SET_UNSAVED_CHANGES, (_, hasChanges: boolean, message?: string) => {
    unsavedChangesMap.set(windowId, {
      hasUnsavedChanges: hasChanges,
      message: message || 'You have unsaved changes.',
    });
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW.CONFIRM_CLOSE, async (_, options: { title?: string; message?: string; detail?: string } = {}) => {
    const result = await dialog.showMessageBox(window, {
      type: 'question',
      buttons: ['Yes', 'No', 'Cancel'],
      defaultId: 1,
      cancelId: 2,
      title: options.title || 'Confirm',
      message: options.message || 'Are you sure?',
      detail: options.detail || '',
    });

    return result.response;
  });
}

export function setupBeforeQuitHandler(
  hasUnsavedChangesCallback: () => boolean,
  saveCallback?: () => Promise<boolean>
): void {
  let isQuitting = false;

  app.on('before-quit', async (event) => {
    if (isQuitting) {
      return;
    }

    if (hasUnsavedChangesCallback()) {
      event.preventDefault();

      const focusedWindow = BrowserWindow.getFocusedWindow();

      const result = await dialog.showMessageBox(focusedWindow || undefined, {
        type: 'question',
        buttons: ['Save', 'Don\'t Save', 'Cancel'],
        defaultId: 0,
        cancelId: 2,
        title: 'Quit Application',
        message: 'You have unsaved changes.',
        detail: 'Do you want to save your changes before quitting?',
      });

      if (result.response === 0) {
        if (saveCallback) {
          const saved = await saveCallback();
          if (saved) {
            isQuitting = true;
            onQuitStateChange?.(true);
            app.quit();
          }
        }
      } else if (result.response === 1) {
        isQuitting = true;
        onQuitStateChange?.(true);
        app.quit();
      }
    } else {
      isQuitting = true;
      onQuitStateChange?.(true);
    }
  });

  app.on('will-quit', () => {
    isQuitting = true;
    onQuitStateChange?.(true);
  });
}

export function setUnsavedChanges(
  window: BrowserWindow,
  hasChanges: boolean,
  message?: string
): void {
  unsavedChangesMap.set(window.id, {
    hasUnsavedChanges: hasChanges,
    message: message || 'You have unsaved changes.',
  });
}

export function hasUnsavedChanges(window: BrowserWindow): boolean {
  return unsavedChangesMap.get(window.id)?.hasUnsavedChanges ?? false;
}
