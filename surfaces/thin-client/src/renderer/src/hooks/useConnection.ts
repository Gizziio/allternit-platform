/**
 * useConnection Hook
 * 
 * Manages connection status with backend health checking
 * Automatically retries connection and provides user-friendly error states
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// ============================================================================
// Types
// ============================================================================

export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error' | 'unavailable';

export interface ConnectionStatus {
  state: ConnectionState;
  backend: 'cloud' | 'desktop';
  url: string;
  error?: string;
  lastChecked?: Date;
  retryCount: number;
}

export interface BackendHealth {
  healthy: boolean;
  version?: string;
  latency: number;
  message?: string;
}

// ============================================================================
// Configuration
// ============================================================================

const HEALTH_CHECK_INTERVAL = 30000; // 30 seconds
const RETRY_DELAYS = [1000, 2000, 5000, 10000, 30000]; // Exponential backoff
const MAX_RETRIES = 5;

// Backend endpoints to check
const BACKEND_ENDPOINTS = {
  desktop: 'http://127.0.0.1:4096',
  cloud: 'https://api.a2r.io',
};

// ============================================================================
// Hook
// ============================================================================

export function useConnection() {
  const [status, setStatus] = useState<ConnectionState>('disconnected');
  const [backend, setBackend] = useState<'cloud' | 'desktop'>('desktop');
  const [error, setError] = useState<string | undefined>();
  const [url, setUrl] = useState<string>(BACKEND_ENDPOINTS.desktop);
  const [health, setHealth] = useState<BackendHealth | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const healthCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      if (healthCheckIntervalRef.current) {
        clearInterval(healthCheckIntervalRef.current);
      }
    };
  }, []);

  // Perform health check
  const checkHealth = useCallback(async (targetBackend?: 'cloud' | 'desktop'): Promise<BackendHealth> => {
    const target = targetBackend || backend;
    const endpoint = BACKEND_ENDPOINTS[target];
    
    const startTime = performance.now();
    
    try {
      // Try the health endpoint first
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${endpoint}/health`, {
        method: 'GET',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      const latency = Math.round(performance.now() - startTime);
      
      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        return {
          healthy: true,
          version: data.version,
          latency,
        };
      }
      
      return {
        healthy: false,
        latency,
        message: `HTTP ${response.status}`,
      };
    } catch (err) {
      const latency = Math.round(performance.now() - startTime);
      
      // If health endpoint fails, try a simple GET to root
      try {
        const fallbackController = new AbortController();
        const fallbackTimeoutId = setTimeout(() => fallbackController.abort(), 3000);
        
        const fallbackResponse = await fetch(endpoint, {
          method: 'HEAD',
          signal: fallbackController.signal,
        });
        
        clearTimeout(fallbackTimeoutId);
        
        if (fallbackResponse.ok || fallbackResponse.status === 404) {
          // 404 is OK - means server is running but endpoint doesn't exist
          return {
            healthy: true,
            latency: Math.round(performance.now() - startTime),
          };
        }
      } catch {
        // Fallback also failed
      }
      
      return {
        healthy: false,
        latency,
        message: err instanceof Error ? err.message : 'Connection failed',
      };
    }
  }, [backend]);

  // Update connection status based on health check
  const updateConnectionStatus = useCallback((healthResult: BackendHealth, targetBackend: 'cloud' | 'desktop') => {
    setHealth(healthResult);
    setUrl(BACKEND_ENDPOINTS[targetBackend]);
    
    if (healthResult.healthy) {
      setStatus('connected');
      setError(undefined);
      setRetryCount(0);
      setIsRetrying(false);
    } else {
      setStatus(targetBackend === 'desktop' ? 'unavailable' : 'error');
      setError(healthResult.message);
    }
  }, []);

  // Retry connection with exponential backoff
  const retryConnection = useCallback(async () => {
    if (isRetrying || retryCount >= MAX_RETRIES) return;
    
    setIsRetrying(true);
    setStatus('connecting');
    
    const healthResult = await checkHealth();
    
    if (healthResult.healthy) {
      updateConnectionStatus(healthResult, backend);
    } else {
      setRetryCount(prev => prev + 1);
      
      // Schedule next retry
      const delay = RETRY_DELAYS[Math.min(retryCount, RETRY_DELAYS.length - 1)];
      retryTimeoutRef.current = setTimeout(() => {
        setIsRetrying(false);
        retryConnection();
      }, delay);
    }
  }, [backend, checkHealth, isRetrying, retryCount, updateConnectionStatus]);

  // Switch backend and check connection
  const switchBackend = useCallback(async (newBackend: 'cloud' | 'desktop') => {
    setBackend(newBackend);
    setStatus('connecting');
    setRetryCount(0);
    
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
    }
    
    const healthResult = await checkHealth(newBackend);
    updateConnectionStatus(healthResult, newBackend);
  }, [checkHealth, updateConnectionStatus]);

  // Manual reconnect
  const reconnect = useCallback(async () => {
    setRetryCount(0);
    setIsRetrying(false);
    
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
    }
    
    await retryConnection();
  }, [retryConnection]);

  // Initial connection and health check setup
  useEffect(() => {
    // Get initial status from main process
    window.thinClient.getConnectionStatus().then((initialStatus: ConnectionStatus) => {
      setStatus(initialStatus.state);
      setBackend(initialStatus.backend);
      setError(initialStatus.error);
      setUrl(initialStatus.url);
      
      // If initially disconnected, try to connect
      if (initialStatus.state === 'disconnected') {
        retryConnection();
      }
    });

    // Listen for status changes from main process
    const unsubscribeStatus = window.thinClient.onConnectionStatus((newStatus: ConnectionStatus) => {
      setStatus(newStatus.state);
      setBackend(newStatus.backend);
      setError(newStatus.error);
      setUrl(newStatus.url);
    });

    // Listen for backend changes
    const unsubscribeBackend = window.thinClient.onBackendChanged((newBackend: 'cloud' | 'desktop') => {
      setBackend(newBackend);
    });

    // Setup periodic health checks
    healthCheckIntervalRef.current = setInterval(async () => {
      if (status === 'connected') {
        const healthResult = await checkHealth();
        if (!healthResult.healthy) {
          updateConnectionStatus(healthResult, backend);
        }
        setHealth(healthResult);
      }
    }, HEALTH_CHECK_INTERVAL);

    return () => {
      unsubscribeStatus();
      unsubscribeBackend();
      if (healthCheckIntervalRef.current) {
        clearInterval(healthCheckIntervalRef.current);
      }
    };
  }, [backend, checkHealth, retryConnection, status, updateConnectionStatus]);

  // Get user-friendly status message
  const getStatusMessage = useCallback((): string => {
    switch (status) {
      case 'connecting':
        return isRetrying 
          ? `Reconnecting... (attempt ${retryCount + 1}/${MAX_RETRIES})`
          : 'Connecting to Gizzi...';
      case 'connected':
        return health?.version 
          ? `Connected (${health.version})`
          : 'Connected';
      case 'unavailable':
        return 'Gizzi Terminal Server not running';
      case 'error':
        return error || 'Connection error';
      case 'disconnected':
      default:
        return 'Disconnected';
    }
  }, [status, isRetrying, retryCount, health, error]);

  // Get status color
  const getStatusColor = useCallback((): string => {
    switch (status) {
      case 'connected':
        return '#22c55e';
      case 'connecting':
        return '#f59e0b';
      case 'unavailable':
        return '#ef4444';
      case 'error':
        return '#ef4444';
      case 'disconnected':
      default:
        return '#6b7280';
    }
  }, [status]);

  return {
    status,
    backend,
    error,
    url,
    health,
    retryCount,
    isRetrying,
    reconnect,
    switchBackend,
    checkHealth,
    getStatusMessage,
    getStatusColor,
    isConnected: status === 'connected',
    isConnecting: status === 'connecting',
    isUnavailable: status === 'unavailable',
    canRetry: retryCount < MAX_RETRIES && !isRetrying,
  };
}

// Export types for use in components
export type { ConnectionStatus, BackendHealth };
