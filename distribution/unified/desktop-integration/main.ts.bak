/**
 * A2R Desktop Main Process - With Seamless Backend
 * 
 * On first launch:
 * 1. Check if backend is installed
 * 2. If not, download and install (with progress UI)
 * 3. Start backend services
 * 4. Load the web UI from localhost
 * 
 * Result: User installs Desktop, backend "just works"
 */

import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import { getBackendManager } from './backend-manager';

let mainWindow: BrowserWindow | null = null;
let splashWindow: BrowserWindow | null = null;

/**
 * Create splash window showing download/install progress
 */
function createSplashWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 500,
    height: 400,
    frame: false,
    transparent: true,
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  // Load splash HTML inline
  const splashHtml = `
<!DOCTYPE html>
<html>
<head>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 40px;
    }
    .logo {
      font-size: 48px;
      font-weight: bold;
      margin-bottom: 10px;
      text-shadow: 0 2px 4px rgba(0,0,0,0.2);
    }
    .tagline {
      font-size: 14px;
      opacity: 0.9;
      margin-bottom: 40px;
    }
    .status {
      font-size: 16px;
      margin-bottom: 20px;
      text-align: center;
    }
    .progress-container {
      width: 100%;
      height: 6px;
      background: rgba(255,255,255,0.2);
      border-radius: 3px;
      overflow: hidden;
      margin-bottom: 10px;
    }
    .progress-bar {
      height: 100%;
      background: white;
      border-radius: 3px;
      transition: width 0.3s ease;
      width: 0%;
    }
    .progress-text {
      font-size: 12px;
      opacity: 0.8;
    }
    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid rgba(255,255,255,0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-bottom: 20px;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .hidden { display: none; }
  </style>
</head>
<body>
  <div class="logo">A2R</div>
  <div class="tagline">AI Runtime Platform</div>
  
  <div id="loading-section">
    <div class="spinner"></div>
    <div class="status" id="status">Initializing...</div>
    <div class="progress-container">
      <div class="progress-bar" id="progress-bar"></div>
    </div>
    <div class="progress-text" id="progress-text">0%</div>
  </div>
  
  <script>
    const { ipcRenderer } = require('electron');
    
    ipcRenderer.on('status', (event, message) => {
      document.getElementById('status').textContent = message;
    });
    
    ipcRenderer.on('progress', (event, percent) => {
      document.getElementById('progress-bar').style.width = percent + '%';
      document.getElementById('progress-text').textContent = percent + '%';
    });
    
    ipcRenderer.on('complete', () => {
      document.getElementById('loading-section').innerHTML = 
        '<div style="font-size: 24px; margin-bottom: 10px;">✓</div><div>Ready!</div>';
    });
    
    ipcRenderer.on('error', (event, message) => {
      document.getElementById('status').textContent = 'Error: ' + message;
      document.getElementById('status').style.color = '#ff6b6b';
    });
  </script>
</body>
</html>
  `;

  window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(splashHtml)}`);
  return window;
}

/**
 * Create main application window
 */
function createMainWindow(backendUrl: string): BrowserWindow {
  const window = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Load from local backend
  window.loadURL(`${backendUrl}/shell`);

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    window.webContents.openDevTools();
  }

  return window;
}

/**
 * Initialize application with seamless backend
 */
async function initializeApp(): Promise<void> {
  const backendManager = getBackendManager();
  
  // Check if backend is already ready
  const status = await backendManager.getStatus();
  
  if (status.running) {
    // Backend already running, just open main window
    console.log('[Main] Backend already running');
    mainWindow = createMainWindow(status.apiUrl!);
    return;
  }

  // Show splash screen while setting up backend
  splashWindow = createSplashWindow();

  try {
    // Update splash status
    const updateStatus = (message: string) => {
      splashWindow?.webContents.send('status', message);
    };

    const updateProgress = (percent: number) => {
      splashWindow?.webContents.send('progress', percent);
    };

    if (!status.installed) {
      updateStatus('Downloading A2R Backend...');
      
      // Monitor download progress
      const progressInterval = setInterval(() => {
        const progress = backendManager.getDownloadProgress();
        updateProgress(progress);
      }, 100);

      // Install backend
      await backendManager.ensureBackend();
      
      clearInterval(progressInterval);
      updateProgress(100);
    } else {
      updateStatus('Starting A2R Backend...');
      await backendManager.ensureBackend();
    }

    // Backend ready
    updateStatus('Almost ready...');
    splashWindow?.webContents.send('complete');

    // Small delay to show completion
    await new Promise(r => setTimeout(r, 500));

    // Get backend URL and create main window
    const newStatus = await backendManager.getStatus();
    
    // Close splash, open main window
    splashWindow?.close();
    splashWindow = null;
    
    mainWindow = createMainWindow(newStatus.apiUrl!);

  } catch (error) {
    console.error('[Main] Backend setup failed:', error);
    splashWindow?.webContents.send('error', (error as Error).message);
    
    // Show error dialog
    dialog.showErrorBox(
      'A2R Backend Error',
      `Failed to initialize A2R Backend:\n${(error as Error).message}\n\nPlease check your internet connection and try again.`
    );
    
    app.quit();
  }
}

// App event handlers
app.whenReady().then(initializeApp);

app.on('window-all-closed', () => {
  // Stop backend on macOS when all windows closed
  if (process.platform === 'darwin') {
    getBackendManager().stopBackend();
  }
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    initializeApp();
  }
});

app.on('before-quit', async () => {
  // Clean shutdown of backend
  await getBackendManager().stopBackend();
});

// IPC handlers for renderer
ipcMain.handle('backend:getStatus', async () => {
  return getBackendManager().getStatus();
});

ipcMain.handle('backend:restart', async () => {
  await getBackendManager().stopBackend();
  return getBackendManager().ensureBackend();
});
