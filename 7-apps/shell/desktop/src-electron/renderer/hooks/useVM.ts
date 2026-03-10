/**
 * useVM Hook
 * 
 * React hook for managing VM state and operations in the desktop app.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { VMInfo, VMExecuteOptions, VMExecuteResult, VMSetupOptions } from '../../shared/types';

export type VMState = 'stopped' | 'starting' | 'running' | 'stopping' | 'error' | 'paused';

export interface UseVMReturn {
  status: VMInfo | null;
  isRunning: boolean;
  isStarting: boolean;
  isStopping: boolean;
  error: string | null;
  imagesExist: boolean | null;
  isCheckingImages: boolean;
  isDownloading: boolean;
  startVM: () => Promise<void>;
  stopVM: () => Promise<void>;
  restartVM: () => Promise<void>;
  executeCommand: (options: VMExecuteOptions) => Promise<VMExecuteResult>;
  checkImages: () => Promise<boolean>;
  downloadImages: (options?: VMSetupOptions) => Promise<void>;
  setupVM: (options?: VMSetupOptions) => Promise<void>;
}

export function useVM(): UseVMReturn {
  const [status, setStatus] = useState<VMInfo | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imagesExist, setImagesExist] = useState<boolean | null>(null);
  const [isCheckingImages, setIsCheckingImages] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Subscribe to VM status changes
  useEffect(() => {
    const setupStatusListener = async () => {
      try {
        // Get initial status
        const initialStatus = await window.electronAPI.vm.getStatus();
        setStatus(initialStatus);

        // Subscribe to status changes
        const unsubscribe = window.electronAPI.vm.onStatusChanged((newStatus: VMState) => {
          setStatus(prev => prev ? { ...prev, state: newStatus } : null);
        });

        unsubscribeRef.current = unsubscribe;
      } catch (err) {
        console.error('Failed to setup VM status listener:', err);
      }
    };

    setupStatusListener();

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, []);

  const startVM = useCallback(async () => {
    setIsStarting(true);
    setError(null);

    try {
      await window.electronAPI.vm.start();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      throw err;
    } finally {
      setIsStarting(false);
    }
  }, []);

  const stopVM = useCallback(async () => {
    setIsStopping(true);
    setError(null);

    try {
      await window.electronAPI.vm.stop();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      throw err;
    } finally {
      setIsStopping(false);
    }
  }, []);

  const restartVM = useCallback(async () => {
    setError(null);

    try {
      await window.electronAPI.vm.restart();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      throw err;
    }
  }, []);

  const executeCommand = useCallback(async (options: VMExecuteOptions): Promise<VMExecuteResult> => {
    try {
      const result = await window.electronAPI.vm.execute(options);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      throw err;
    }
  }, []);

  const checkImages = useCallback(async (): Promise<boolean> => {
    setIsCheckingImages(true);

    try {
      const exists = await window.electronAPI.vm.checkImages();
      setImagesExist(exists);
      return exists;
    } catch (err) {
      console.error('Failed to check images:', err);
      setImagesExist(false);
      return false;
    } finally {
      setIsCheckingImages(false);
    }
  }, []);

  const downloadImages = useCallback(async (options?: VMSetupOptions): Promise<void> => {
    setIsDownloading(true);
    setError(null);

    try {
      await window.electronAPI.vm.downloadImages(options);
      await checkImages();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      throw err;
    } finally {
      setIsDownloading(false);
    }
  }, [checkImages]);

  const setupVM = useCallback(async (options?: VMSetupOptions): Promise<void> => {
    setError(null);

    try {
      await window.electronAPI.vm.setup(options);
      await checkImages();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      throw err;
    }
  }, [checkImages]);

  const isRunning = status?.state === 'running';

  return {
    status,
    isRunning,
    isStarting,
    isStopping,
    error,
    imagesExist,
    isCheckingImages,
    isDownloading,
    startVM,
    stopVM,
    restartVM,
    executeCommand,
    checkImages,
    downloadImages,
    setupVM,
  };
}

export default useVM;
