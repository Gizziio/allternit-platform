// 6-apps/stubs/entrypoints.stub.ts
import type { App, AppHost, AppInfo, AppManifest, AppStatus, AppEnvironment } from '../contracts/entrypoints';

export class StubAppHost implements AppHost {
  private apps: Map<string, App> = new Map();

  async launchApp(manifest: AppManifest, env: AppEnvironment): Promise<App> {
    console.log(`[STUB] Launching app: ${manifest.name} (${manifest.id})`);
    
    const stubApp: App = {
      start: async (environment: AppEnvironment) => {
        console.log(`[STUB] Starting app: ${manifest.id}`);
      },
      stop: async () => {
        console.log(`[STUB] Stopping app: ${manifest.id}`);
      },
      getStatus: (): AppStatus => {
        return {
          running: true,
          uptime: 1000,
          memoryUsage: 1024,
          cpuUsage: 0.5,
          error: null
        };
      },
      getConfig: (): AppManifest => {
        return manifest;
      }
    };
    
    this.apps.set(manifest.id, stubApp);
    return stubApp;
  }

  async listApps(): Promise<AppInfo[]> {
    console.log('[STUB] Listing all apps');
    return Array.from(this.apps.entries()).map(([id, app]) => ({
      id,
      name: id, // In a real implementation, this would come from the manifest
      version: '1.0.0',
      status: app.getStatus(),
      permissions: []
    }));
  }

  async getAppStatus(appId: string): Promise<AppStatus> {
    const app = this.apps.get(appId);
    return app ? app.getStatus() : {
      running: false,
      error: 'App not found'
    };
  }

  async terminateApp(appId: string): Promise<boolean> {
    console.log(`[STUB] Terminating app: ${appId}`);
    return this.apps.delete(appId);
  }
}

// 6-apps/stubs/shell.stub.ts
export class StubShellApp {
  async initialize(config: any): Promise<void> {
    console.log('[STUB] Initializing shell app with config:', config);
  }

  async start(): Promise<void> {
    console.log('[STUB] Starting shell app');
  }

  async stop(): Promise<void> {
    console.log('[STUB] Stopping shell app');
  }

  async getStatus(): Promise<any> {
    return {
      status: 'running',
      uptime: 0,
      connected: true,
      runtime: 'stub-runtime'
    };
  }
}

// 6-apps/stubs/electron.stub.ts
export class StubElectronHost {
  async initialize(config: any): Promise<void> {
    console.log('[STUB] Initializing electron host with config:', config);
  }

  async createMainWindow(): Promise<any> {
    console.log('[STUB] Creating main electron window');
    return {
      show: () => console.log('[STUB] Showing window'),
      hide: () => console.log('[STUB] Hiding window'),
      close: () => console.log('[STUB] Closing window')
    };
  }

  async startServer(): Promise<void> {
    console.log('[STUB] Starting electron server');
  }

  async stopServer(): Promise<void> {
    console.log('[STUB] Stopping electron server');
  }
}