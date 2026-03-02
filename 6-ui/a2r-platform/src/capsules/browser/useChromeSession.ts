/**
 * useChromeSession - Hook for managing Chrome streaming sessions
 */

import { useCallback, useState } from 'react';

export interface ChromeSessionOptions {
  resolution?: string;
  extensionMode?: 'power' | 'managed';
  initialUrl?: string;
}

export interface ChromeSession {
  sessionId: string;
  status: 'provisioning' | 'connecting' | 'ready' | 'error' | 'terminated';
  signalingUrl?: string;
  iceServers?: RTCIceServer[];
  resolution: string;
}

export function useChromeSession() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Create a new Chrome session
   */
  const createSession = useCallback(async (opts?: ChromeSessionOptions): Promise<ChromeSession> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/v1/chrome-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resolution: opts?.resolution || '1920x1080',
          extension_mode: opts?.extensionMode || 'managed',
          initial_url: opts?.initialUrl,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to create session: ${response.status}`);
      }

      const data = await response.json();
      
      return {
        sessionId: data.session_id,
        status: 'provisioning',
        signalingUrl: data.signaling_url,
        iceServers: data.ice_servers,
        resolution: opts?.resolution || '1920x1080',
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Poll session until ready
   */
  const pollUntilReady = useCallback(async (sessionId: string, maxWait = 30000): Promise<ChromeSession> => {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWait) {
      const response = await fetch(`/api/v1/chrome-sessions/${sessionId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to get session status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.status === 'ready') {
        return {
          sessionId: data.session_id,
          status: 'ready',
          signalingUrl: data.signaling_url,
          iceServers: data.ice_servers,
          resolution: data.resolution,
        };
      }
      
      if (data.status === 'error' || data.status === 'terminated') {
        throw new Error(`Session ended: ${data.status}`);
      }

      // Wait 2 seconds before polling again
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    throw new Error('Session provisioning timeout');
  }, []);

  /**
   * Destroy a Chrome session
   */
  const destroySession = useCallback(async (sessionId: string): Promise<void> => {
    const response = await fetch(`/api/v1/chrome-sessions/${sessionId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`Failed to destroy session: ${response.status}`);
    }
  }, []);

  /**
   * Navigate Chrome to a URL
   */
  const navigateTo = useCallback(async (sessionId: string, url: string): Promise<void> => {
    const response = await fetch(`/api/v1/chrome-sessions/${sessionId}/navigate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to navigate: ${response.status}`);
    }
  }, []);

  /**
   * Resize Chrome session
   */
  const resize = useCallback(async (sessionId: string, width: number, height: number): Promise<void> => {
    const response = await fetch(`/api/v1/chrome-sessions/${sessionId}/resize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ width, height }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to resize: ${response.status}`);
    }
  }, []);

  return {
    createSession,
    pollUntilReady,
    destroySession,
    navigateTo,
    resize,
    loading,
    error,
  };
}

export default useChromeSession;
