/**
 * Allternit Operator Service Status Hook
 * Monitors the health and availability of Allternit Operator services
 */

import { useState, useEffect, useCallback } from 'react';
import { createModuleLogger } from '@/lib/logger';

const log = createModuleLogger('services/allternit-operator-status');

const ALLTERNIT_OPERATOR_URL = process.env.ALLTERNIT_OPERATOR_URL || 'http://127.0.0.1:3000';

export type AllternitServiceStatus = 'online' | 'offline' | 'checking' | 'error';

export interface AllternitServiceCapabilities {
  browserUse: boolean;
  playwright: boolean;
  computerUse: boolean;
  desktop: boolean;
  vision: boolean;
  parallel: boolean;
}

export interface AllternitOperatorStatus {
  status: AllternitServiceStatus;
  url: string;
  version?: string;
  capabilities: AllternitServiceCapabilities;
  lastChecked: Date | null;
  error?: string;
}

const initialStatus: AllternitOperatorStatus = {
  status: 'checking',
  url: ALLTERNIT_OPERATOR_URL,
  capabilities: {
    browserUse: false,
    playwright: false,
    computerUse: false,
    desktop: false,
    vision: false,
    parallel: false,
  },
  lastChecked: null,
};

/**
 * Check Allternit Operator health and capabilities
 */
async function checkAllternitOperatorHealth(): Promise<Partial<AllternitOperatorStatus>> {
  try {
    // Check main health endpoint
    const healthRes = await fetch(`${ALLTERNIT_OPERATOR_URL}/health`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });

    if (!healthRes.ok) {
      return {
        status: 'error',
        error: `Health check failed: ${healthRes.status}`,
        lastChecked: new Date(),
      };
    }

    const health = await healthRes.json();

    // Check browser service availability
    let browserCapabilities = {
      browserUse: false,
      playwright: false,
      computerUse: false,
    };

    try {
      const browserHealthRes = await fetch(`${ALLTERNIT_OPERATOR_URL}/v1/browser/health`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });

      if (browserHealthRes.ok) {
        const browserHealth = await browserHealthRes.json();
        browserCapabilities = {
          browserUse: browserHealth.available || false,
          playwright: browserHealth.playwright_available || false,
          computerUse: browserHealth.browser_use_available || false,
        };
      }
    } catch (e) {
      log.warn('Browser health check failed');
    }

    return {
      status: 'online',
      version: health.version || 'unknown',
      capabilities: {
        ...browserCapabilities,
        desktop: true, // Desktop is built-in
        vision: true,  // Vision is built-in
        parallel: true, // Parallel execution is built-in
      },
      lastChecked: new Date(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    log.error({ error: message }, 'Allternit Operator health check failed');
    return {
      status: 'offline',
      error: message,
      lastChecked: new Date(),
    };
  }
}

/**
 * Hook to monitor Allternit Operator service status
 */
export function useAllternitOperatorStatus(pollInterval = 30000) {
  const [status, setStatus] = useState<AllternitOperatorStatus>(initialStatus);

  const checkStatus = useCallback(async () => {
    setStatus(prev => ({ ...prev, status: 'checking' }));
    const health = await checkAllternitOperatorHealth();
    setStatus(prev => ({ ...prev, ...health }));
  }, []);

  useEffect(() => {
    // Initial check
    checkStatus();

    // Set up polling
    const interval = setInterval(checkStatus, pollInterval);

    return () => clearInterval(interval);
  }, [checkStatus, pollInterval]);

  return {
    ...status,
    refresh: checkStatus,
    isAvailable: status.status === 'online',
    hasBrowser: status.capabilities.browserUse || status.capabilities.playwright,
    hasDesktop: status.capabilities.desktop,
    hasVision: status.capabilities.vision,
    hasParallel: status.capabilities.parallel,
  };
}

export default useAllternitOperatorStatus;
