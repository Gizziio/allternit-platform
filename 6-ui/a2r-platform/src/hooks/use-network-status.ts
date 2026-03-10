/**
 * Network Status Hook
 * Provides real-time online/offline detection with connection quality
 */

import { useState, useEffect, useCallback, useRef } from 'react';

export type ConnectionQuality = 'excellent' | 'good' | 'poor' | 'offline';

export interface NetworkStatus {
  isOnline: boolean;
  connectionQuality: ConnectionQuality;
  downlink: number | null; // Estimated effective bandwidth in Mbps
  rtt: number | null; // Round-trip time in ms
  type: string | null; // Connection type (wifi, 4g, etc.)
  saveData: boolean; // Whether data saver is enabled
}

interface NetworkInformation extends EventTarget {
  effectiveType: string;
  downlink: number;
  rtt: number;
  saveData: boolean;
  type: string;
}

export function useNetworkStatus(): NetworkStatus {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [connectionQuality, setConnectionQuality] = useState<ConnectionQuality>('good');
  const [downlink, setDownlink] = useState<number | null>(null);
  const [rtt, setRtt] = useState<number | null>(null);
  const [type, setType] = useState<string | null>(null);
  const [saveData, setSaveData] = useState<boolean>(false);
  const connectionRef = useRef<NetworkInformation | null>(null);

  const determineQuality = useCallback((downlink: number | null, rtt: number | null): ConnectionQuality => {
    if (!navigator.onLine) return 'offline';
    if (downlink === null || rtt === null) return 'good';
    
    if (downlink >= 5 && rtt < 100) return 'excellent';
    if (downlink >= 1.5 && rtt < 300) return 'good';
    return 'poor';
  }, []);

  const updateConnectionInfo = useCallback(() => {
    const connection = connectionRef.current;
    if (connection) {
      setDownlink(connection.downlink || null);
      setRtt(connection.rtt || null);
      setType(connection.type || null);
      setSaveData(connection.saveData || false);
      setConnectionQuality(determineQuality(connection.downlink, connection.rtt));
    } else {
      setConnectionQuality(navigator.onLine ? 'good' : 'offline');
    }
  }, [determineQuality]);

  useEffect(() => {
    // Set initial state
    setIsOnline(navigator.onLine);
    
    // Get connection info if available
    const connection = (navigator as any).connection || 
                      (navigator as any).mozConnection || 
                      (navigator as any).webkitConnection;
    
    if (connection) {
      connectionRef.current = connection;
      updateConnectionInfo();
      
      connection.addEventListener('change', updateConnectionInfo);
    }

    // Online/offline event handlers
    const handleOnline = () => {
      setIsOnline(true);
      updateConnectionInfo();
      console.log('[Network] Connection restored');
    };

    const handleOffline = () => {
      setIsOnline(false);
      setConnectionQuality('offline');
      console.log('[Network] Connection lost');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (connection) {
        connection.removeEventListener('change', updateConnectionInfo);
      }
    };
  }, [updateConnectionInfo]);

  return {
    isOnline,
    connectionQuality,
    downlink,
    rtt,
    type,
    saveData,
  };
}

// Hook for showing online/offline indicator
export function useOnlineIndicator() {
  const { isOnline, connectionQuality } = useNetworkStatus();
  const [showIndicator, setShowIndicator] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Show indicator when going offline
    if (!isOnline) {
      setShowIndicator(true);
    } else {
      // When coming back online, show indicator briefly then hide
      setShowIndicator(true);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        setShowIndicator(false);
      }, 3000);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isOnline]);

  return { isOnline, connectionQuality, showIndicator };
}
