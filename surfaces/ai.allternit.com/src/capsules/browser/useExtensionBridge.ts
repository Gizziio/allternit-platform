/**
 * Extension Bridge Hook
 * 
 * Bridges Chrome Extension native host messages to the browser agent store.
 * This provides direct communication without going through API routes.
 * 
 * Usage: Call this hook once in the BrowserCapsule or app root.
 */

import { useEffect, useRef, useState } from 'react';
import { useBrowserAgentStore } from './browserAgent.store';
import { isElectronShell } from '@/lib/platform';

export function useExtensionBridge() {
  const isSetup = useRef(false);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    try {
      // Only run in Electron
      if (!isElectronShell()) return;
      if (isSetup.current) return;
      
      const extension = (window as unknown as { allternitExtension?: {
        sendMessage: (msg: { type: string; payload?: unknown }) => Promise<boolean>;
        getStatus: () => Promise<{ connected: boolean }>;
        onMessage: (handler: (data: { connectionId: string; message: { type: string; payload?: unknown } }) => void) => () => void;
        onStatusChange: (handler: (data: { connected: boolean; connectionId: string }) => void) => () => void;
      } }).allternitExtension;
      
      if (!extension) {
        console.warn('[ExtensionBridge] allternitExtension API not available');
        return;
      }

      isSetup.current = true;
      console.log('[ExtensionBridge] Setting up extension message handlers');

      // Listen for extension messages
      const removeMessageListener = extension.onMessage(({ connectionId, message }) => {
        console.log('[ExtensionBridge] Received message:', message.type, 'from', connectionId);

        try {
          switch (message.type) {
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
              console.log('[ExtensionBridge] Unknown message type:', message.type);
          }
        } catch (err) {
          console.error('[ExtensionBridge] Error handling message:', err);
        }
      });

      // Listen for extension connection status
      const removeStatusListener = extension.onStatusChange(({ connected, connectionId }) => {
        console.log('[ExtensionBridge] Extension', connected ? 'connected' : 'disconnected', connectionId);
        setIsConnected(connected);
      });

      // Check initial status
      extension.getStatus().then((status: { connected: boolean }) => {
        setIsConnected(status.connected);
      }).catch((err: Error) => {
        console.warn('[ExtensionBridge] Failed to get status:', err);
      });

      return () => {
        try {
          removeMessageListener();
          removeStatusListener();
        } catch (err) {
          console.error('[ExtensionBridge] Error cleaning up listeners:', err);
        }
      };
    } catch (err) {
      console.error('[ExtensionBridge] Fatal error in setup:', err);
    }
  }, []);

  return { isConnected };
}

/**
 * Check if extension is connected
 */
export async function isExtensionConnected(): Promise<boolean> {
  if (!isElectronShell()) return false;
  
  const extension = (window as unknown as { allternitExtension?: { getStatus: () => Promise<{ connected: boolean }> } }).allternitExtension;
  if (!extension) return false;
  
  const status = await extension.getStatus();
  return status.connected;
}
