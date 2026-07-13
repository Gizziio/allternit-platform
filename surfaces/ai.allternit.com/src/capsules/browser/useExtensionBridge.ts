/**
 * Extension Bridge Hook
 * 
 * Bridges Chrome Extension native host messages to the computer agent store.
 * This provides direct communication without going through API routes.
 * 
 * Usage: Call this hook once in the BrowserCapsule or app root.
 */

import { useEffect, useRef, useState } from 'react';
import { useBrowserAgentStore } from './browserAgent.store';
import { isElectronShell } from '@/lib/platform';
import type { PageAgentBridgeConfig } from '@/lib/page-agent/config';

import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('UseExtensionBridge');

type DesktopExtensionBridge = {
  sendMessage: (msg: { type: string; payload?: unknown }) => Promise<boolean>;
  getStatus: () => Promise<{ connected: boolean }>;
  onMessage: (handler: (data: { connectionId: string; message: { type: string; payload?: unknown } }) => void) => () => void;
  onStatusChange: (handler: (data: { connected: boolean; connectionId?: string }) => void) => () => void;
};

function getDesktopExtensionBridge(): DesktopExtensionBridge | null {
  const globalWindow = window as unknown as {
    allternit?: {
      extension?: {
        send: (msg: { type: string; payload?: unknown }) => Promise<boolean>;
        getStatus: () => Promise<{ connected: boolean }>;
        onMessage: (handler: (data: { connectionId: string; message: { type: string; payload?: unknown } }) => void) => () => void;
        onStatusChange: (handler: (data: { connected: boolean }) => void) => () => void;
      };
    };
  };

  const bridge = globalWindow.allternit?.extension;
  if (!bridge) return null;

  return {
    sendMessage: bridge.send,
    getStatus: bridge.getStatus,
    onMessage: bridge.onMessage,
    onStatusChange: (handler) =>
      bridge.onStatusChange((status) =>
        handler({ connected: status.connected, connectionId: 'desktop-extension' })),
  };
}

export function useExtensionBridge() {
  const isSetup = useRef(false);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    try {
      // Only run in Electron
      if (!isElectronShell()) return;
      if (isSetup.current) return;
      
      const extension = getDesktopExtensionBridge();
      
      if (!extension) {
        logger.warn('Desktop extension bridge not available');
        return;
      }

      isSetup.current = true;
      logger.debug('Setting up extension message handlers');

      // Listen for extension messages
      const removeMessageListener = extension.onMessage(({ connectionId, message }) => {
        console.debug('[ExtensionBridge] Received message:', message.type, 'from', connectionId);

        try {
          switch (message.type) {
            case 'platform_task_request': {
              const payload = message.payload as { requestId?: string; task?: string; config?: PageAgentBridgeConfig };
              if (!payload.requestId || !payload.task) break;
              const requestId = payload.requestId;
              const sendState = () => {
                const state = useBrowserAgentStore.getState();
                void extension.sendMessage({
                  type: 'platform_task_state',
                  payload: {
                    requestId,
                    task: payload.task,
                    status: state.pageAgentStatus,
                    activity: state.pageAgentActivity,
                    history: state.pageAgentHistory,
                  },
                });
              };
              const unsubscribe = useBrowserAgentStore.subscribe(
                (state) => [state.pageAgentStatus, state.pageAgentActivity, state.pageAgentHistory] as const,
                sendState,
              );
              const monitor = useBrowserAgentStore.subscribe(
                (state) => state.pageAgentStatus,
                (status) => {
                  if (status === 'completed' || status === 'error') {
                    sendState();
                    unsubscribe();
                    monitor();
                  }
                },
              );
              useBrowserAgentStore.getState().runPageAgentGoal(payload.task, payload.config);
              sendState();
              break;
            }
            case 'platform_task_stop':
              useBrowserAgentStore.getState().stopPageAgent();
              break;
            case 'status':
              // Extension sends status updates
              if (message.payload && typeof message.payload === 'object' && 'status' in message.payload) {
                useBrowserAgentStore.setState({ 
                  pageAgentStatus: message.payload.status as 'idle' | 'running' | 'completed' | 'error' 
                });
              }
              break;

            case 'activity':
              // Extension sends activity updates
              useBrowserAgentStore.setState({ 
                pageAgentActivity: message.payload as any 
              });
              break;

            case 'history':
              // Extension sends history updates
              if (message.payload && typeof message.payload === 'object' && 'events' in message.payload) {
                useBrowserAgentStore.setState({ 
                  pageAgentHistory: (message.payload as any).events as any[] 
                });
              }
              break;

            case 'done':
              // Extension task completed
              if (message.payload && typeof message.payload === 'object' && 'success' in message.payload) {
                useBrowserAgentStore.setState({ 
                  pageAgentStatus: message.payload.success ? 'completed' : 'error',
                  pageAgentActivity: null 
                });
              }
              break;

            case 'error':
              // Extension error
              useBrowserAgentStore.setState({ 
                pageAgentStatus: 'error',
                pageAgentActivity: { type: 'error', message: (message.payload as { message?: string })?.message || 'Extension error' }
              });
              break;

            default:
              console.debug('[ExtensionBridge] Unknown message type:', message.type);
          }
        } catch (err) {
          logger.error({ err: err }, 'Error handling message');
        }
      });

      // Listen for extension connection status
      const removeStatusListener = extension.onStatusChange(({ connected, connectionId }) => {
        console.debug('[ExtensionBridge] Extension', connected ? 'connected' : 'disconnected', connectionId);
        setIsConnected(connected);
      });

      // Check initial status
      extension.getStatus().then((status: { connected: boolean }) => {
        setIsConnected(status.connected);
      }).catch((err: Error) => {
        logger.warn({ err: err }, 'Failed to get status');
      });

      return () => {
        try {
          removeMessageListener();
          removeStatusListener();
        } catch (err) {
          logger.error({ err: err }, 'Error cleaning up listeners');
        }
      };
    } catch (err) {
      logger.error({ err: err }, 'Fatal error in setup');
    }
  }, []);

  return { isConnected };
}

/**
 * Check if extension is connected
 */
export async function isExtensionConnected(): Promise<boolean> {
  if (!isElectronShell()) return false;
  
  const extension = getDesktopExtensionBridge();
  if (!extension) return false;
  
  const status = await extension.getStatus();
  return status.connected;
}
