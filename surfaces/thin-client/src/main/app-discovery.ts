/**
 * App Discovery - Production-grade implementation
 * 
 * Integrates with A2R Computer Use backend for robust app detection.
 * Falls back to local AppleScript detection if backend unavailable.
 * 
 * Architecture:
 *   Thin Client → HTTP GET /app-discovery/context → Computer Use Gateway
 *                → Returns: frontmost app, running apps, capabilities
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { createLogger } from './logger';

const logger = createLogger('app-discovery');
const execAsync = promisify(exec);

// Gateway URL (same as browser tool)
const GATEWAY_URL = process.env.A2R_COMPUTER_USE_URL || 'http://localhost:8080';

interface DiscoveredApp {
  id: string;
  name: string;
  bundleId?: string;
  processName?: string;
  windowTitle?: string;
  isFrontmost?: boolean;
  isConnected?: boolean;
  capabilities?: string[];
  category?: string;
}

interface AppContext {
  frontmost: DiscoveredApp | null;
  running: DiscoveredApp[];
  timestamp: string;
}

export class AppDiscovery {
  private apps: Map<string, DiscoveredApp> = new Map();
  private interval: NodeJS.Timeout | null = null;
  private callback: (apps: DiscoveredApp[]) => void;
  private lastFrontmostApp: string | null = null;
  private useBackend: boolean = true;

  constructor(callback: (apps: DiscoveredApp[]) => void) {
    this.callback = callback;
  }

  /**
   * Start discovering apps
   */
  start(): void {
    this.scan();
    this.interval = setInterval(() => this.scan(), 3000);
  }

  /**
   * Stop discovering apps
   */
  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  /**
   * Get current list of apps
   */
  getApps(): DiscoveredApp[] {
    return Array.from(this.apps.values());
  }

  /**
   * Main detection method - tries backend first, falls back to local
   */
  private async scan(): Promise<void> {
    try {
      let context: AppContext | null = null;

      // Try backend first
      if (this.useBackend) {
        try {
          context = await this.detectViaBackend();
        } catch (error) {
          logger.warn('Backend detection failed, falling back to local');
          this.useBackend = false;
        }
      }

      // Fallback to local detection
      if (!context) {
        context = await this.detectLocal();
      }

      if (context) {
        this.processContext(context);
      }
    } catch (error) {
      logger.error('App scan failed:', error);
    }
  }

  /**
   * Detect apps via A2R Computer Use backend
   */
  private async detectViaBackend(): Promise<AppContext | null> {
    const response = await fetch(`${GATEWAY_URL}/app-discovery/context`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Backend returned ${response.status}`);
    }

    const data: any = await response.json();
    
    return {
      frontmost: data.frontmost ? {
        id: data.frontmost.id,
        name: data.frontmost.name,
        bundleId: data.frontmost.bundle_id,
        windowTitle: data.frontmost.window_title,
        isFrontmost: true,
        capabilities: data.frontmost.capabilities,
        category: data.frontmost.category,
      } : null,
      running: data.running.map((app: any) => ({
        id: app.id,
        name: app.name,
        bundleId: app.bundle_id,
        windowTitle: app.window_title,
        isFrontmost: app.is_frontmost,
        capabilities: app.capabilities,
        category: app.category,
      })),
      timestamp: data.timestamp,
    };
  }

  /**
   * Local detection fallback using AppleScript
   */
  private async detectLocal(): Promise<AppContext | null> {
    const targetApps = [
      { name: 'Microsoft Excel', bundleId: 'com.microsoft.Excel', id: 'excel', category: 'office' },
      { name: 'Microsoft Word', bundleId: 'com.microsoft.Word', id: 'word', category: 'office' },
      { name: 'Microsoft PowerPoint', bundleId: 'com.microsoft.PowerPoint', id: 'powerpoint', category: 'office' },
      { name: 'Visual Studio Code', bundleId: 'com.microsoft.VSCode', id: 'vscode', category: 'ide' },
      { name: 'Code', bundleId: 'com.microsoft.VSCode', id: 'vscode', category: 'ide' },
      { name: 'Cursor', bundleId: 'com.todesktop.230313mzl4w4u92', id: 'cursor', category: 'ide' },
      { name: 'Xcode', bundleId: 'com.apple.dt.Xcode', id: 'xcode', category: 'ide' },
      { name: 'Terminal', bundleId: 'com.apple.Terminal', id: 'terminal', category: 'terminal' },
      { name: 'iTerm', bundleId: 'com.googlecode.iterm2', id: 'iterm', category: 'terminal' },
      { name: 'iTerm2', bundleId: 'com.googlecode.iterm2', id: 'iterm', category: 'terminal' },
      { name: 'Warp', bundleId: 'dev.warp.Warp-Stable', id: 'warp', category: 'terminal' },
      { name: 'Slack', bundleId: 'com.tinyspeck.slackmacgap', id: 'slack', category: 'communication' },
      { name: 'Discord', bundleId: 'com.hnc.Discord', id: 'discord', category: 'communication' },
      { name: 'Figma', bundleId: 'com.figma.Desktop', id: 'figma', category: 'design' },
      { name: 'Notion', bundleId: 'notion.id', id: 'notion', category: 'productivity' },
      { name: 'Obsidian', bundleId: 'md.obsidian', id: 'obsidian', category: 'productivity' },
      { name: 'Google Chrome', bundleId: 'com.google.Chrome', id: 'chrome', category: 'browser' },
      { name: 'Chrome', bundleId: 'com.google.Chrome', id: 'chrome', category: 'browser' },
      { name: 'Safari', bundleId: 'com.apple.Safari', id: 'safari', category: 'browser' },
      { name: 'Firefox', bundleId: 'org.mozilla.firefox', id: 'firefox', category: 'browser' },
      { name: 'Arc', bundleId: 'company.thebrowser.Browser', id: 'arc', category: 'browser' },
      { name: 'GitHub Desktop', bundleId: 'com.github.GitHubClient', id: 'github-desktop', category: 'ide' },
    ];

    const apps: DiscoveredApp[] = [];
    let frontmost: DiscoveredApp | null = null;

    try {
      // Use AppleScript to get frontmost app (like ChatGPT)
      const script = `
        tell application "System Events"
          set frontProcess to first application process whose frontmost is true
          set frontName to name of frontProcess
          set frontBundle to ""
          try
            set frontBundle to bundle identifier of frontProcess
          end try
          set frontWindow to ""
          try
            set frontWindow to name of first window of frontProcess
          end try
        end tell
        return frontName & "|" & frontBundle & "|" & frontWindow
      `;

      const { stdout } = await execAsync(`osascript -e '${script}'`);
      const [frontName, frontBundle, frontWindow] = stdout.trim().split('|');

      // Skip Electron itself
      if (frontName && frontName !== 'Electron' && frontName !== 'A2R Thin Client') {
        this.lastFrontmostApp = frontName;
        
        // Find matching app definition
        const matchedApp = targetApps.find(a => 
          a.name === frontName || 
          a.bundleId === frontBundle ||
          frontName.includes(a.name)
        );

        if (matchedApp) {
          frontmost = {
            id: matchedApp.id,
            name: matchedApp.name,
            bundleId: frontBundle,
            windowTitle: frontWindow,
            isFrontmost: true,
            category: matchedApp.category,
          };
          logger.info(`Frontmost app detected: ${matchedApp.name} (window: ${frontWindow || 'none'})`);
        }
      }

      // Scan for running apps via ps
      const { stdout: psOutput } = await execAsync('ps aux');
      const processList = psOutput.toLowerCase();

      for (const target of targetApps) {
        const patterns = [
          target.bundleId.toLowerCase(),
          target.name.toLowerCase(),
          `${target.name.toLowerCase()}.app`,
        ];
        
        const isRunning = patterns.some(pattern => 
          processList.includes(pattern)
        );
        
        if (isRunning) {
          apps.push({
            id: target.id,
            name: target.name,
            bundleId: target.bundleId,
            isFrontmost: target.name === (this.lastFrontmostApp || frontName),
            category: target.category,
          });
        }
      }
    } catch (error) {
      logger.error('Local detection error:', error);
    }

    return {
      frontmost,
      running: apps,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Process detected context and notify callback
   */
  private processContext(context: AppContext): void {
    // Update app list
    this.apps.clear();
    
    // Add frontmost app first
    if (context.frontmost) {
      this.apps.set(context.frontmost.id, context.frontmost);
    }
    
    // Add running apps
    for (const app of context.running) {
      if (!this.apps.has(app.id)) {
        this.apps.set(app.id, app);
      }
    }

    // Notify with frontmost + running apps
    const appsToNotify = Array.from(this.apps.values());
    this.callback(appsToNotify);
  }

  /**
   * Connect to specific app
   */
  async connectToApp(appId: string): Promise<boolean> {
    logger.info(`Connecting to app: ${appId}`);

    // Call backend to establish connection
    try {
      const response = await fetch(`${GATEWAY_URL}/app-discovery/connect/${appId}`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (response.ok) {
        const result = await response.json();
        logger.info(`Connected to ${appId}:`, result);
        return true;
      }
    } catch (error) {
      logger.warn(`Backend connect failed for ${appId}, using local fallback`);
    }

    // Local fallback - just mark as connected
    const app = this.apps.get(appId);
    if (app) {
      app.isConnected = true;
      this.apps.set(appId, app);
      return true;
    }

    return false;
  }
}
