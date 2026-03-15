/**
 * useComputerUse Hook
 * 
 * Integrates with A2R Computer Use Gateway for browser/desktop automation
 * Provides screenshot capture, browser control, and desktop automation
 */

import { useState, useCallback, useRef, useEffect } from 'react';

// ============================================================================
// Types
// ============================================================================

export type AutomationTarget = 'browser' | 'desktop' | 'vscode' | 'cursor' | 'chrome';

export interface ScreenshotResult {
  success: boolean;
  data?: string; // base64 encoded image
  path?: string;
  error?: string;
}

export interface BrowserState {
  url: string;
  title: string;
  canGoBack: boolean;
  canGoForward: boolean;
  isLoading: boolean;
}

export interface AutomationAction {
  type: 'click' | 'type' | 'scroll' | 'key' | 'navigate' | 'screenshot';
  target?: string;
  value?: string;
  coordinates?: { x: number; y: number };
}

export interface AutomationResult {
  success: boolean;
  message?: string;
  screenshot?: string;
  error?: string;
}

// ============================================================================
// Configuration
// ============================================================================

const GATEWAY_URL = 'http://127.0.0.1:8080';
const WS_URL = 'ws://127.0.0.1:8080/ws';

// ============================================================================
// Hook
// ============================================================================

export function useComputerUse() {
  const [isAvailable, setIsAvailable] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [lastScreenshot, setLastScreenshot] = useState<string | null>(null);
  const [browserState, setBrowserState] = useState<BrowserState | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check gateway availability
  const checkAvailability = useCallback(async (): Promise<boolean> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      
      const response = await fetch(`${GATEWAY_URL}/health`, {
        method: 'GET',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      const available = response.ok;
      setIsAvailable(available);
      return available;
    } catch {
      setIsAvailable(false);
      return false;
    }
  }, []);

  // Connect to WebSocket for real-time updates
  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    
    try {
      wsRef.current = new WebSocket(WS_URL);
      
      wsRef.current.onopen = () => {
        setIsConnected(true);
        setError(null);
      };
      
      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          switch (data.type) {
            case 'browser_state':
              setBrowserState(data.state);
              break;
            case 'screenshot':
              setLastScreenshot(data.data);
              break;
            case 'automation_complete':
              if (data.screenshot) {
                setLastScreenshot(data.screenshot);
              }
              break;
            case 'error':
              setError(data.message);
              break;
          }
        } catch (e) {
          console.error('[ComputerUse] Failed to parse WebSocket message:', e);
        }
      };
      
      wsRef.current.onclose = () => {
        setIsConnected(false);
        // Try to reconnect after 5 seconds
        reconnectTimeoutRef.current = setTimeout(connectWebSocket, 5000);
      };
      
      wsRef.current.onerror = (err) => {
        console.error('[ComputerUse] WebSocket error:', err);
        setError('WebSocket connection error');
      };
    } catch (err) {
      console.error('[ComputerUse] Failed to connect WebSocket:', err);
      setError('Failed to connect to Computer Use Gateway');
    }
  }, []);

  // Disconnect WebSocket
  const disconnectWebSocket = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  // Initial availability check and WebSocket setup
  useEffect(() => {
    checkAvailability();
    
    // Check availability periodically
    const interval = setInterval(checkAvailability, 30000);
    
    return () => {
      clearInterval(interval);
      disconnectWebSocket();
    };
  }, [checkAvailability, disconnectWebSocket]);

  // Connect WebSocket when available
  useEffect(() => {
    if (isAvailable) {
      connectWebSocket();
    } else {
      disconnectWebSocket();
    }
    
    return () => disconnectWebSocket();
  }, [isAvailable, connectWebSocket, disconnectWebSocket]);

  // Capture screenshot
  const captureScreenshot = useCallback(async (
    target: AutomationTarget = 'desktop',
    fullPage: boolean = false
  ): Promise<ScreenshotResult> => {
    setIsCapturing(true);
    setError(null);
    
    try {
      const response = await fetch(`${GATEWAY_URL}/screenshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target, fullPage }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (result.success && result.data) {
        setLastScreenshot(result.data);
        return { success: true, data: result.data, path: result.path };
      } else {
        throw new Error(result.error || 'Screenshot failed');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Screenshot failed';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsCapturing(false);
    }
  }, []);

  // Execute automation action
  const executeAction = useCallback(async (
    action: AutomationAction,
    target: AutomationTarget = 'browser'
  ): Promise<AutomationResult> => {
    setIsExecuting(true);
    setError(null);
    
    try {
      const response = await fetch(`${GATEWAY_URL}/automate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, target }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (result.screenshot) {
        setLastScreenshot(result.screenshot);
      }
      
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Automation failed';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsExecuting(false);
    }
  }, []);

  // Navigate to URL in browser
  const navigateTo = useCallback(async (url: string): Promise<AutomationResult> => {
    return executeAction({ type: 'navigate', value: url }, 'browser');
  }, [executeAction]);

  // Click at coordinates
  const clickAt = useCallback(async (
    x: number,
    y: number,
    target: AutomationTarget = 'browser'
  ): Promise<AutomationResult> => {
    return executeAction({ type: 'click', coordinates: { x, y } }, target);
  }, [executeAction]);

  // Type text
  const typeText = useCallback(async (
    text: string,
    selector?: string,
    target: AutomationTarget = 'browser'
  ): Promise<AutomationResult> => {
    return executeAction({ type: 'type', value: text, target: selector }, target);
  }, [executeAction]);

  // Scroll page
  const scroll = useCallback(async (
    direction: 'up' | 'down' | 'left' | 'right',
    amount: number = 300,
    target: AutomationTarget = 'browser'
  ): Promise<AutomationResult> => {
    return executeAction({ type: 'scroll', value: `${direction}:${amount}` }, target);
  }, [executeAction]);

  // Press key
  const pressKey = useCallback(async (
    key: string,
    target: AutomationTarget = 'browser'
  ): Promise<AutomationResult> => {
    return executeAction({ type: 'key', value: key }, target);
  }, [executeAction]);

  // Get current browser state
  const getBrowserState = useCallback(async (): Promise<BrowserState | null> => {
    try {
      const response = await fetch(`${GATEWAY_URL}/browser/state`, {
        method: 'GET',
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const state = await response.json();
      setBrowserState(state);
      return state;
    } catch (err) {
      console.error('[ComputerUse] Failed to get browser state:', err);
      return null;
    }
  }, []);

  // Launch browser/app
  const launchTarget = useCallback(async (target: AutomationTarget): Promise<boolean> => {
    try {
      const response = await fetch(`${GATEWAY_URL}/launch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target }),
      });
      
      return response.ok;
    } catch (err) {
      console.error('[ComputerUse] Failed to launch target:', err);
      return false;
    }
  }, []);

  return {
    // State
    isAvailable,
    isConnected,
    isCapturing,
    isExecuting,
    lastScreenshot,
    browserState,
    error,
    
    // Actions
    captureScreenshot,
    executeAction,
    navigateTo,
    clickAt,
    typeText,
    scroll,
    pressKey,
    getBrowserState,
    launchTarget,
    checkAvailability,
    connectWebSocket,
    disconnectWebSocket,
  };
}

// ============================================================================
// Helper Hook for Screenshots in Chat
// ============================================================================

export function useScreenshotAttachment() {
  const [attachments, setAttachments] = useState<string[]>([]);
  
  const { captureScreenshot, isCapturing } = useComputerUse();

  const addScreenshot = useCallback(async (
    target: AutomationTarget = 'desktop'
  ): Promise<boolean> => {
    const result = await captureScreenshot(target);
    
    if (result.success && result.data) {
      setAttachments(prev => [...prev, result.data!]);
      return true;
    }
    
    return false;
  }, [captureScreenshot]);

  const removeAttachment = useCallback((index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  }, []);

  const clearAttachments = useCallback(() => {
    setAttachments([]);
  }, []);

  return {
    attachments,
    isCapturing,
    addScreenshot,
    removeAttachment,
    clearAttachments,
  };
}
