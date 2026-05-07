/**
 * allternit Super-Agent OS - Main Entry Component
 * 
 * The root wrapper that initializes and orchestrates all AllternitOS systems:
 * - Workspace service connection (Rails/Bus/Ledger)
 * - Kernel bridge (Electron IPC / WebSocket / Mock)
 * - Program launcher with URI scheme support
 * - Sidecar store for program state
 * - Global error boundary
 */

import * as React from 'react';
const { useEffect, useState, useCallback } = React;
type ReactNode = React.ReactNode;
import { useSidecarStore } from './stores/useSidecarStore';
import { programLauncher } from './utils/ProgramLauncher';
import { initWorkspaceService } from './services/WorkspaceService';
import { AllternitCanvas } from './components/AllternitCanvas';
import { AllternitConsoleToggle } from './components/AllternitConsole';
import type { AllternitProgram, LaunchProgramRequest } from './types/programs';

// ============================================================================
// Types
// ============================================================================

export interface AllternitOSConfig {
  /** Workspace service URL */
  workspaceUrl?: string;
  /** Workspace ID */
  workspaceId?: string;
  /** Kernel connection mode */
  kernelMode?: 'electron' | 'websocket' | 'mock';
  /** WebSocket endpoint for kernel (if not Electron) */
  kernelEndpoint?: string;
  /** Enable debug logging */
  debug?: boolean;
  /** Default program to launch on init */
  defaultProgram?: {
    type: string;
    title: string;
    state?: Record<string, unknown>;
  };
  /** Handler for custom program launches */
  onLaunchProgram?: (request: LaunchProgramRequest) => Promise<AllternitProgram>;
  /** Handler for program activation */
  onActivateProgram?: (program: AllternitProgram) => void;
  /** Handler for program close */
  onCloseProgram?: (programId: string) => void;
  /** Handler for errors */
  onError?: (error: Error) => void;
}

export interface AllternitOSProps {
  config: AllternitOSConfig;
  children?: ReactNode;
  /** Show the console toggle button */
  showConsoleToggle?: boolean;
  /** Show the AllternitCanvas program dock */
  showProgramDock?: boolean;
  /** Custom header content */
  header?: ReactNode;
  /** Custom footer content */
  footer?: ReactNode;
  /** CSS class for the container */
  className?: string;
}

// ============================================================================
// AllternitOS Provider Component
// ============================================================================

export const AllternitOSProvider: React.FC<{ config: AllternitOSConfig; children: ReactNode }> = ({
  config,
  children,
}) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const store = useSidecarStore();

  useEffect(() => {
    const init = async () => {
      try {
        // Initialize workspace service if URL provided
        if (config?.workspaceUrl && config?.workspaceId) {
          const workspaceService = initWorkspaceService({
            baseUrl: config.workspaceUrl,
            workspaceId: config.workspaceId,
          });
          workspaceService.connect();
        }

        // Set up program launcher handler
        programLauncher.setHandler(async (request) => {
          // Use custom handler if provided
          if (config?.onLaunchProgram) {
            return config.onLaunchProgram(request);
          }

          // Default: use sidecar store
          const programId = store.launchProgram(request as any);
          const program = Object.values(store.programs).find(p => p.id === programId);
          if (!program) {
            throw new Error(`Failed to launch program: ${programId}`);
          }
          return program;
        });

        // Launch default program if specified
        if (config?.defaultProgram) {
          await programLauncher.launch({
            type: config.defaultProgram.type as any,
            title: config.defaultProgram.title,
            initialState: config.defaultProgram.state,
            options: { focus: true },
          });
        }

        setIsInitialized(true);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        config?.onError?.(error);
      }
    };

    init();

    // Handle URI scheme launches
    const handleUriLaunch = (event: Event) => {
      const customEvent = event as CustomEvent<string>;
      if (customEvent.detail) {
        programLauncher.launchFromUri(customEvent.detail).catch(console.error);
      }
    };

    window.addEventListener('allternit-launch-uri', handleUriLaunch);

    return () => {
      window.removeEventListener('allternit-launch-uri', handleUriLaunch);
    };
  }, [config, store]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-red-50 dark:bg-red-900/20">
        <div className="text-center">
          <h2 className="text-xl font-bold text-red-600 mb-2">AllternitOS Initialization Failed</h2>
          <p className="text-red-500">{error.message}</p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Initializing AllternitOS...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

// ============================================================================
// AllternitOS Layout Component
// ============================================================================

export const AllternitOS: React.FC<AllternitOSProps> = ({
  config = {},
  children,
  showConsoleToggle = true,
  showProgramDock = true,
  header,
  footer,
  className = '',
}) => {
  const store = useSidecarStore();

  return (
    <AllternitOSProvider config={config}>
      <div className={`flex flex-col h-screen bg-white dark:bg-gray-900 ${className}`}>
        {/* Header */}
        {header && (
          <header className="flex-shrink-0 border-b border-gray-200 dark:border-gray-800">
            {header}
          </header>
        )}

        {/* Main Content Area */}
        <main className="flex-1 overflow-hidden relative">
          {/* Program Canvas Overlay */}
          {showProgramDock && (
            <div className="absolute inset-0 pointer-events-none">
              <div className="pointer-events-auto h-full">
                <AllternitCanvas />
              </div>
            </div>
          )}

          {/* Main Content */}
          <div className={`h-full ${showProgramDock ? 'p-4' : ''}`}>
            {children}
          </div>

          {/* Console Toggle */}
          {showConsoleToggle && (
            <div className="absolute bottom-4 right-4 pointer-events-auto">
              <AllternitConsoleToggle />
            </div>
          )}
        </main>

        {/* Footer */}
        {footer && (
          <footer className="flex-shrink-0 border-t border-gray-200 dark:border-gray-800">
            {footer}
          </footer>
        )}
      </div>
    </AllternitOSProvider>
  );
};

// ============================================================================
// AllternitOS Header Component
// ============================================================================

export const AllternitOSHeader: React.FC<{
  title?: string;
  logo?: ReactNode;
  actions?: ReactNode;
  className?: string;
}> = ({ title = 'allternit', logo, actions, className = '' }) => {
  const store = useSidecarStore();
  const activeCount = Object.values(store.programs).filter(p => p.status === 'active' || p.status === 'background').length;

  return (
    <div className={`flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 ${className}`}>
      <div className="flex items-center gap-3">
        {logo || (
          <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold">
            A2
          </div>
        )}
        <h1 className="text-lg font-semibold">{title}</h1>
      </div>

      <div className="flex items-center gap-4">
        {/* Active Programs Indicator */}
        {activeCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full text-sm">
            <span>⚡</span>
            <span>{activeCount} active</span>
          </div>
        )}

        {/* Connection Status */}
        <ConnectionStatusIndicator />

        {/* Custom Actions */}
        {actions}
      </div>
    </div>
  );
};

// ============================================================================
// Connection Status Indicator
// ============================================================================

const ConnectionStatusIndicator: React.FC = () => {
  const [status, setStatus] = useState<'connected' | 'disconnected' | 'connecting'>('connecting');

  useEffect(() => {
    // Check workspace service connection
    const checkConnection = () => {
      // This would check actual connection state
      setStatus('connected');
    };

    checkConnection();
    const interval = setInterval(checkConnection, 30000);
    return () => clearInterval(interval);
  }, []);

  const statusConfig = {
    connected: { color: 'bg-green-500', label: 'Connected' },
    disconnected: { color: 'bg-red-500', label: 'Offline' },
    connecting: { color: 'bg-yellow-500 animate-pulse', label: 'Connecting...' },
  };

  const config = statusConfig[status];

  return (
    <div className="flex items-center gap-2 text-sm text-gray-500">
      <span className={`w-2 h-2 rounded-full ${config.color}`} />
      <span className="hidden sm:inline">{config.label}</span>
    </div>
  );
};

// ============================================================================
// Quick Actions Bar
// ============================================================================

export const AllternitQuickActions: React.FC = () => {
  const actions = [
    { icon: '📄', label: 'Research', type: 'research-doc' },
    { icon: '📊', label: 'Data', type: 'data-grid' },
    { icon: '🎨', label: 'Slides', type: 'presentation' },
    { icon: '💻', label: 'Code', type: 'code-preview' },
    { icon: '📁', label: 'Files', type: 'asset-manager' },
    { icon: '🤖', label: 'Agents', type: 'orchestrator' },
  ];

  const handleLaunch = (type: string) => {
    programLauncher.launch({
      type: type as any,
      title: `New ${type}`,
      options: { focus: true },
    });
  };

  return (
    <div className="flex items-center gap-2">
      {actions.map(({ icon, label, type }) => (
        <button
          key={type}
          onClick={() => handleLaunch(type)}
          className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg text-sm transition-colors"
          title={label}
        >
          <span>{icon}</span>
          <span className="hidden md:inline">{label}</span>
        </button>
      ))}
    </div>
  );
};

// ============================================================================
// AllternitOS Status Bar
// ============================================================================

export const AllternitOSStatusBar: React.FC = () => {
  const store = useSidecarStore();
  const programsArray = Object.values(store.programs);
  const programCount = programsArray.length;
  const activeCount = programsArray.filter(p => p.status === 'active').length;

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-gray-800/50 text-xs text-gray-500">
      <div className="flex items-center gap-4">
        <span>AllternitOS v1.0.0</span>
        {programCount > 0 && (
          <span>
            {activeCount}/{programCount} programs active
          </span>
        )}
      </div>
      <div className="flex items-center gap-4">
        <span>Press ⌘K for commands</span>
      </div>
    </div>
  );
};

// ============================================================================
// Command Palette Integration
// ============================================================================

export const useAllternitCommandPalette = () => {
  const [isOpen, setIsOpen] = useState(false);
  const store = useSidecarStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const commands = [
    {
      id: 'launch-research',
      title: 'Launch Research Document',
      icon: '📄',
      action: () => programLauncher.launch({ type: 'research-doc', title: 'New Research' }),
    },
    {
      id: 'launch-data',
      title: 'Launch Data Grid',
      icon: '📊',
      action: () => programLauncher.launch({ type: 'data-grid', title: 'New Data Grid' }),
    },
    {
      id: 'launch-presentation',
      title: 'Launch Presentation',
      icon: '🎨',
      action: () => programLauncher.launch({ type: 'presentation', title: 'New Presentation' }),
    },
    {
      id: 'open-console',
      title: 'Open Allternit Console',
      icon: '🤖',
      action: () => {
        // This would open the console
        console.log('Open console');
      },
    },
    ...Object.values(store.programs).map(p => ({
      id: `program-${p.id}`,
      title: `Focus: ${p.title}`,
      icon: '📱',
      action: () => store.activateProgram(p.id),
    })),
  ];

  return {
    isOpen,
    setIsOpen,
    commands,
  };
};

// ============================================================================
// Export Main Components
// ============================================================================

export default AllternitOS;
