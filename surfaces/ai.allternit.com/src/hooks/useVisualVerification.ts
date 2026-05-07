/**
 * useVisualVerification Hook
 * 
 * React hook for managing visual verification state and operations.
 * Provides real-time updates, polling, and manual refresh capabilities.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

export type ArtifactType = 
  | 'ui_state' 
  | 'coverage_map' 
  | 'console_output' 
  | 'visual_diff' 
  | 'error_state';

export type VerificationStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface Artifact {
  id: string;
  type: ArtifactType;
  confidence: number;
  timestamp: string;
  data: {
    imageUrl?: string;
    textContent?: string;
    jsonData?: unknown;
  };
  metadata: Record<string, unknown>;
  analysis?: {
    issues?: string[];
    warnings?: string[];
    recommendations?: string[];
  };
}

export interface VerificationResult {
  wihId: string;
  status: VerificationStatus;
  overallConfidence: number;
  threshold: number;
  artifacts: Artifact[];
  startedAt: string;
  completedAt?: string;
  error?: string;
}

export interface TrendDataPoint {
  timestamp: string;
  confidence: number;
  wihId?: string;
}

export interface UseVisualVerificationOptions {
  wihId?: string;
  pollInterval?: number;
  autoStart?: boolean;
  onComplete?: (result: VerificationResult) => void;
  onError?: (error: Error) => void;
}

export interface UseVisualVerificationReturn {
  result: VerificationResult | null;
  isLoading: boolean;
  isPolling: boolean;
  error: Error | null;
  trendData: TrendDataPoint[];
  refresh: () => Promise<void>;
  startVerification: () => Promise<void>;
  requestBypass: (reason: string) => Promise<void>;
}

// Mock API service - replace with actual API calls
const verificationApi = {
  async getStatus(wihId: string): Promise<VerificationResult> {
    const response = await fetch(`/api/verification/${wihId}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch verification status: ${response.statusText}`);
    }
    return response.json();
  },

  async startVerification(wihId: string): Promise<VerificationResult> {
    const response = await fetch(`/api/verification/${wihId}/start`, {
      method: 'POST',
    });
    if (!response.ok) {
      throw new Error(`Failed to start verification: ${response.statusText}`);
    }
    return response.json();
  },

  async requestBypass(wihId: string, reason: string): Promise<void> {
    const response = await fetch(`/api/verification/${wihId}/bypass`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    if (!response.ok) {
      throw new Error(`Failed to request bypass: ${response.statusText}`);
    }
  },

  async getTrendData(wihId: string, days: number = 7): Promise<TrendDataPoint[]> {
    const response = await fetch(`/api/verification/${wihId}/trend?days=${days}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch trend data: ${response.statusText}`);
    }
    return response.json();
  },
};

export function useVisualVerification(
  options: UseVisualVerificationOptions = {}
): UseVisualVerificationReturn {
  const {
    wihId,
    pollInterval = 3000,
    autoStart = false,
    onComplete,
    onError,
  } = options;

  const [result, setResult] = useState<VerificationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [trendData, setTrendData] = useState<TrendDataPoint[]>([]);
  
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Fetch trend data
  const fetchTrendData = useCallback(async () => {
    if (!wihId) return;
    
    try {
      const data = await verificationApi.getTrendData(wihId);
      setTrendData(data);
    } catch (err) {
      console.error('Failed to fetch trend data:', err);
    }
  }, [wihId]);

  // Refresh verification status
  const refresh = useCallback(async () => {
    if (!wihId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await verificationApi.getStatus(wihId);
      setResult(data);
      
      if (data.status === 'completed' && onComplete) {
        onComplete(data);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      if (onError) {
        onError(error);
      }
    } finally {
      setIsLoading(false);
    }
  }, [wihId, onComplete, onError]);

  // Start verification
  const startVerification = useCallback(async () => {
    if (!wihId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await verificationApi.startVerification(wihId);
      setResult(data);
      setIsPolling(true);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      if (onError) {
        onError(error);
      }
    } finally {
      setIsLoading(false);
    }
  }, [wihId, onError]);

  // Request bypass
  const requestBypass = useCallback(async (reason: string) => {
    if (!wihId) return;
    
    try {
      await verificationApi.requestBypass(wihId, reason);
      await refresh();
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      if (onError) {
        onError(error);
      }
    }
  }, [wihId, refresh, onError]);

  // Polling effect
  useEffect(() => {
    if (!wihId || !isPolling) return;

    const poll = async () => {
      try {
        const data = await verificationApi.getStatus(wihId);
        setResult(data);
        
        if (data.status === 'completed' || data.status === 'failed') {
          setIsPolling(false);
          if (data.status === 'completed' && onComplete) {
            onComplete(data);
          }
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    };

    pollIntervalRef.current = setInterval(poll, pollInterval);
    
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [wihId, isPolling, pollInterval, onComplete]);

  // Initial load
  useEffect(() => {
    if (wihId) {
      refresh();
      fetchTrendData();
    }
  }, [wihId, refresh, fetchTrendData]);

  // Auto-start effect
  useEffect(() => {
    if (autoStart && wihId && !result) {
      startVerification();
    }
  }, [autoStart, wihId, result, startVerification]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    result,
    isLoading,
    isPolling,
    error,
    trendData,
    refresh,
    startVerification,
    requestBypass,
  };
}

export default useVisualVerification;
