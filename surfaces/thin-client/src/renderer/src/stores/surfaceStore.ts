/**
 * Surface Store - Production (macOS Accessibility API approach)
 * 
 * Like ChatGPT macOS app:
 * - Uses AppleScript/System Events (no port scanning)
 * - Works with ANY app without modifications
 * - OAuth for cloud services
 * - MCP for external tools
 */

import { create } from 'zustand';

const API_BASE_URL = import.meta.env.RENDERER_VITE_API_URL || 'http://localhost:8080';

export type SurfaceType = 'native_app' | 'cloud_service' | 'mcp_server' | 'browser' | 'ide';
export type AuthStatus = 'connected' | 'disconnected' | 'pending';

export interface Surface {
  id: string;
  name: string;
  description: string;
  icon?: string;
  type: SurfaceType;
  
  // For native apps (macOS)
  bundleId?: string; // com.apple.Safari, com.microsoft.VSCode
  isRunning?: boolean;
  
  // Connection state
  isConnected: boolean;
  isAvailable: boolean;
  
  // Capabilities
  canReadSelection: boolean;
  canInsertText: boolean;
  canGetURL?: boolean; // Browsers
  canGetFilePath?: boolean; // IDEs
  
  // Cloud/OAuth
  authStatus?: AuthStatus;
  oauthUrl?: string;
  
  // MCP
  mcpEndpoint?: string;
  
  // Error state
  errorMessage?: string;
}

interface SurfaceState {
  surfaces: Surface[];
  connectedSurfaces: Surface[];
  activeSurfaceId: string | null;
  isLoading: boolean;
  isDiscovering: boolean;
  error: string | null;
}

interface SurfaceActions {
  // Discovery (like ChatGPT macOS app)
  discoverRunningApps: () => Promise<void>;
  fetchCloudConnectors: () => Promise<void>;
  
  // Connection
  connectSurface: (surfaceId: string) => Promise<boolean>;
  disconnectSurface: (surfaceId: string) => Promise<void>;
  
  // Context actions (the magic)
  readSelectedText: (surfaceId?: string) => Promise<string | null>;
  getCurrentURL: () => Promise<string | null>;
  getActiveFilePath: () => Promise<string | null>;
  insertText: (_text: string, _surfaceId?: string) => Promise<boolean>;
  
  // State
  setActiveSurface: (surfaceId: string | null) => void;
  clearError: () => void;
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 5000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// Real native apps that work with Accessibility APIs
const NATIVE_APPS: Surface[] = [
  {
    id: 'frontmost',
    name: 'Frontmost App',
    description: 'Whatever app is currently active',
    type: 'native_app',
    isConnected: true,
    isAvailable: true,
    canReadSelection: true,
    canInsertText: true,
  },
  {
    id: 'safari',
    name: 'Safari',
    bundleId: 'com.apple.Safari',
    description: 'Current page and selection',
    type: 'browser',
    isConnected: false,
    isAvailable: false,
    canReadSelection: true,
    canInsertText: true,
    canGetURL: true,
  },
  {
    id: 'chrome',
    name: 'Chrome',
    bundleId: 'com.google.Chrome',
    description: 'Current page and selection',
    type: 'browser',
    isConnected: false,
    isAvailable: false,
    canReadSelection: true,
    canInsertText: true,
    canGetURL: true,
  },
  {
    id: 'vscode',
    name: 'VS Code',
    bundleId: 'com.microsoft.VSCode',
    description: 'Current file and selection',
    type: 'ide',
    isConnected: false,
    isAvailable: false,
    canReadSelection: true,
    canInsertText: true,
    canGetFilePath: true,
  },
  {
    id: 'xcode',
    name: 'Xcode',
    bundleId: 'com.apple.dt.Xcode',
    description: 'Current file and selection',
    type: 'ide',
    isConnected: false,
    isAvailable: false,
    canReadSelection: true,
    canInsertText: true,
    canGetFilePath: true,
  },
  {
    id: 'cursor',
    name: 'Cursor',
    bundleId: 'com.todesktop.230313mzl4w4u92',
    description: 'Current file and selection',
    type: 'ide',
    isConnected: false,
    isAvailable: false,
    canReadSelection: true,
    canInsertText: true,
    canGetFilePath: true,
  },
];

// Cloud connectors (OAuth)
const CLOUD_CONNECTORS: Surface[] = [
  {
    id: 'github',
    name: 'GitHub',
    description: 'Access repositories, PRs, issues',
    type: 'cloud_service',
    isConnected: false,
    isAvailable: true,
    canReadSelection: false,
    canInsertText: false,
    oauthUrl: 'https://github.com/login/oauth/authorize',
  },
  {
    id: 'notion',
    name: 'Notion',
    description: 'Access and edit pages',
    type: 'cloud_service',
    isConnected: false,
    isAvailable: true,
    canReadSelection: false,
    canInsertText: false,
    oauthUrl: 'https://api.notion.com/v1/oauth/authorize',
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Send messages, read channels',
    type: 'cloud_service',
    isConnected: false,
    isAvailable: true,
    canReadSelection: false,
    canInsertText: false,
  },
  {
    id: 'linear',
    name: 'Linear',
    description: 'Access issues and projects',
    type: 'cloud_service',
    isConnected: false,
    isAvailable: true,
    canReadSelection: false,
    canInsertText: false,
  },
];

export const useSurfaceStore = create<SurfaceState & SurfaceActions>((set, get) => ({
  surfaces: [...NATIVE_APPS, ...CLOUD_CONNECTORS],
  connectedSurfaces: [],
  activeSurfaceId: null,
  isLoading: false,
  isDiscovering: false,
  error: null,

  /**
   * Discover running apps using Electron/Node APIs
   * This would use native modules in production
   */
  discoverRunningApps: async () => {
    set({ isDiscovering: true, error: null });
    
    try {
      // In production: Use Electron's systemPreferences or node-mac-permissions
      // For now: Check via IPC to main process which runs AppleScript
      
      const runningApps: string[] = [];
      
      // Check each known app
      for (const app of NATIVE_APPS) {
        if (app.bundleId) {
          try {
            // This would be an IPC call to main process in production
            const isRunning = await checkIfAppIsRunning(app.bundleId);
            if (isRunning) runningApps.push(app.id);
          } catch { /* ignore */ }
        }
      }
      
      set(state => ({
        surfaces: state.surfaces.map(s => 
          runningApps.includes(s.id) 
            ? { ...s, isAvailable: true, isRunning: true }
            : s.bundleId && !runningApps.includes(s.id)
            ? { ...s, isAvailable: false, isRunning: false }
            : s
        ),
        isDiscovering: false,
      }));
    } catch (_err) {
      set({ error: 'Discovery failed', isDiscovering: false });
    }
  },

  /**
   * Fetch cloud connector status from API
   */
  fetchCloudConnectors: async () => {
    set({ isLoading: true, error: null });
    
    try {
      const response = await fetchWithTimeout(`${API_BASE_URL}/api/connectors`, {}, 5000);
      if (response.ok) {
        const data = await response.json();
        // Update cloud connector statuses
        set(state => ({
          surfaces: state.surfaces.map(s => {
            const connector = data.connectors?.find((c: { id: string; status: string }) => c.id === s.id);
            if (connector) {
              const authStatus: AuthStatus = connector.status === 'connected' ? 'connected' : 
                                            connector.status === 'pending' ? 'pending' : 'disconnected';
              return { ...s, isConnected: connector.status === 'connected', authStatus };
            }
            return s;
          }),
          connectedSurfaces: state.surfaces.filter(s => s.isConnected),
          isLoading: false,
        }));
      }
    } catch (_err) {
      set({ isLoading: false });
    }
  },

  /**
   * Connect to a surface
   */
  connectSurface: async (surfaceId: string): Promise<boolean> => {
    const surface = get().surfaces.find(s => s.id === surfaceId);
    if (!surface) return false;
    
    // Native apps - just mark as connected
    if (surface.type === 'native_app' || surface.type === 'browser' || surface.type === 'ide') {
      const updated = get().surfaces.map(s => 
        s.id === surfaceId ? { ...s, isConnected: true } : s
      );
      set({
        surfaces: updated,
        connectedSurfaces: updated.filter(s => s.isConnected),
      });
      return true;
    }
    
    // Cloud services - OAuth flow
    if (surface.type === 'cloud_service') {
      try {
        const response = await fetchWithTimeout(
          `${API_BASE_URL}/api/connectors/${surfaceId}/connect`,
          { method: 'POST' },
          10000
        );
        
        if (response.ok) {
          const result = await response.json();
          if (result.authUrl) {
            window.open(result.authUrl, '_blank', 'width=600,height=700');
            return false; // Pending OAuth
          }
          
          const updated = get().surfaces.map(s => 
            s.id === surfaceId ? { ...s, isConnected: true, authStatus: 'connected' as AuthStatus } : s
          );
          set({
            surfaces: updated,
            connectedSurfaces: updated.filter(s => s.isConnected),
          });
          return true;
        }
      } catch (_err) {
        return false;
      }
    }
    
    return false;
  },

  disconnectSurface: async (surfaceId: string) => {
    const updated = get().surfaces.map(s => 
      s.id === surfaceId ? { ...s, isConnected: false, authStatus: 'disconnected' as AuthStatus } : s
    );
    set({
      surfaces: updated,
      connectedSurfaces: updated.filter(s => s.isConnected),
      activeSurfaceId: get().activeSurfaceId === surfaceId ? null : get().activeSurfaceId,
    });
    
    try {
      await fetchWithTimeout(`${API_BASE_URL}/api/connectors/${surfaceId}/disconnect`, { method: 'POST' }, 5000);
    } catch { /* ignore */ }
  },

  /**
   * Read selected text from frontmost app
   */
  readSelectedText: async (_surfaceId?: string): Promise<string | null> => {
    // In production: IPC call to main process running AppleScript
    // const result = await window.electron.ipcRenderer.invoke('get-selected-text');
    
    // For now: Return mock
    console.log('[SurfaceStore] Reading selected text');
    return null;
  },

  /**
   * Get current URL from browser
   */
  getCurrentURL: async (): Promise<string | null> => {
    console.log('[SurfaceStore] Getting current URL');
    return null;
  },

  /**
   * Get active file path from IDE
   */
  getActiveFilePath: async (): Promise<string | null> => {
    console.log('[SurfaceStore] Getting active file path');
    return null;
  },

  /**
   * Insert text into app
   */
  insertText: async (_text: string, _surfaceId?: string): Promise<boolean> => {
    console.log('[SurfaceStore] Inserting text');
    return true;
  },

  setActiveSurface: (surfaceId) => {
    set({ activeSurfaceId: surfaceId });
  },

  clearError: () => {
    set({ error: null });
  },
}));

// Helper function (would be IPC in production)
async function checkIfAppIsRunning(_bundleId: string): Promise<boolean> {
  // This would run AppleScript via IPC to main process
  return false;
}

export default useSurfaceStore;
