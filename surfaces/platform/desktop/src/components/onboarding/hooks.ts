/**
 * @fileoverview Custom Hooks for Onboarding Wizard
 * 
 * Provides reusable hooks for platform detection, downloads, VM initialization,
 * and other wizard-specific functionality.
 * 
 * @module components/onboarding/hooks
 * @example
 * ```tsx
 * import { usePlatformDetection, useDownloadManager } from './hooks';
 * 
 * function MyStep() {
 *   const { platform, isChecking } = usePlatformDetection();
 *   const { startDownload, progress } = useDownloadManager();
 * }
 * ```
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useWizard } from './context';
import type { PlatformInfo, PlatformType, Architecture, VMStatus } from './context';

/**
 * Options for usePlatformDetection hook
 */
export interface UsePlatformDetectionOptions {
  /** Whether to auto-start detection on mount */
  autoStart?: boolean;
}

/**
 * Result of usePlatformDetection hook
 */
export interface UsePlatformDetectionResult {
  /** Detected platform information */
  platform: PlatformInfo | null;
  /** Whether detection is in progress */
  isChecking: boolean;
  /** Error if detection failed */
  error: Error | null;
  /** Manually trigger platform detection */
  detect: () => Promise<void>;
}

/**
 * Detects the current platform (OS and architecture)
 * 
 * This hook automatically detects the user's platform and provides
 * information about OS type, architecture, and capabilities.
 * 
 * @param options - Hook options
 * @returns {UsePlatformDetectionResult} Platform detection state and controls
 */
export function usePlatformDetection(
  options: UsePlatformDetectionOptions = {}
): UsePlatformDetectionResult {
  const { autoStart = true } = options;
  const { state, setState } = useWizard();
  const [isChecking, setIsChecking] = useState(autoStart);
  const [error, setError] = useState<Error | null>(null);

  const detect = useCallback(async () => {
    setIsChecking(true);
    setError(null);

    try {
      // Check if electron API is available
      if (typeof window !== 'undefined' && (window as any).electron) {
        const platform = await (window as any).electron.invoke('platform:get');
        setState(prev => ({
          ...prev,
          platform: {
            type: platform.type as PlatformType,
            arch: platform.arch as Architecture,
            version: platform.version,
            canBuildImages: platform.type === 'linux',
          },
        }));
      } else {
        // Fallback: detect from user agent for development
        const userAgent = navigator.userAgent.toLowerCase();
        let type: PlatformType = 'linux';
        let arch: Architecture = 'x86_64';

        if (userAgent.includes('mac') || userAgent.includes('darwin')) {
          type = 'macos';
        } else if (userAgent.includes('win')) {
          type = 'windows';
        }

        // Detect architecture
        if (userAgent.includes('arm64') || userAgent.includes('aarch64')) {
          arch = 'arm64';
        }

        setState(prev => ({
          ...prev,
          platform: {
            type,
            arch,
            version: navigator.platform,
            canBuildImages: type === 'linux',
          },
        }));
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to detect platform'));
    } finally {
      setIsChecking(false);
    }
  }, [setState]);

  useEffect(() => {
    if (autoStart) {
      detect();
    }
  }, [autoStart, detect]);

  return {
    platform: state.platform,
    isChecking,
    error,
    detect,
  };
}

/**
 * Options for useDownloadManager hook
 */
export interface UseDownloadManagerOptions {
  /** Version of images to download */
  version?: string;
  /** Callback when all downloads complete */
  onComplete?: () => void;
  /** Callback when a download error occurs */
  onError?: (error: Error) => void;
}

/**
 * Result of useDownloadManager hook
 */
export interface UseDownloadManagerResult {
  /** Whether download is in progress */
  isDownloading: boolean;
  /** Overall download progress (0-100) */
  totalProgress: number;
  /** Start the download process */
  startDownload: () => void;
  /** Cancel all downloads */
  cancelDownload: () => void;
  /** Retry failed downloads */
  retry: () => void;
}

/**
 * Manages VM image downloads with progress tracking
 * 
 * Handles downloading kernel, initrd, and rootfs images with real-time
 * progress updates and error handling.
 * 
 * @param options - Hook options
 * @returns {UseDownloadManagerResult} Download state and controls
 */
export function useDownloadManager(
  options: UseDownloadManagerOptions = {}
): UseDownloadManagerResult {
  const { version = '1.1.0', onComplete, onError } = options;
  const { state, updateDownloadStatus, setError } = useWizard();
  const [isDownloading, setIsDownloading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const calculateTotalProgress = useCallback(() => {
    const { kernel, initrd, rootfs } = state.downloads;
    const total = kernel.progress + initrd.progress + rootfs.progress;
    return Math.round(total / 3);
  }, [state.downloads]);

  const startDownload = useCallback(() => {
    if (isDownloading) return;
    
    setIsDownloading(true);
    setError(null);

    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController();

    // Check if electron API is available
    if (typeof window !== 'undefined' && (window as any).electron) {
      const electron = (window as any).electron;

      // Start download
      electron.invoke('images:download', {
        version,
        architecture: state.platform?.arch || 'x86_64',
      }).catch((err: Error) => {
        setError(err);
        onError?.(err);
        setIsDownloading(false);
      });

      // Listen for progress
      const unsubscribe = electron.on('images:progress', (_event: any, data: any) => {
        if (data.file && typeof data.progress === 'number') {
          updateDownloadStatus(data.file as keyof typeof state.downloads, {
            status: data.status || 'downloading',
            progress: data.progress,
            downloaded: data.downloaded,
            total: data.total,
          });
        }

        // Check if all complete
        const allComplete = Object.values(state.downloads).every(
          d => d.status === 'complete'
        );
        if (allComplete) {
          setIsDownloading(false);
          onComplete?.();
        }
      });

      // Cleanup listener on cancel
      abortControllerRef.current.signal.addEventListener('abort', () => {
        unsubscribe?.();
      });
    } else {
      // Mock download for development
      simulateDownloads(updateDownloadStatus, () => {
        setIsDownloading(false);
        onComplete?.();
      });
    }
  }, [isDownloading, version, state.platform, updateDownloadStatus, setError, onComplete, onError, state.downloads]);

  const cancelDownload = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsDownloading(false);
  }, []);

  const retry = useCallback(() => {
    // Reset all download statuses
    ['kernel', 'initrd', 'rootfs'].forEach((file) => {
      updateDownloadStatus(file as keyof typeof state.downloads, {
        status: 'pending',
        progress: 0,
      });
    });
    startDownload();
  }, [updateDownloadStatus, startDownload, state.downloads]);

  return {
    isDownloading,
    totalProgress: calculateTotalProgress(),
    startDownload,
    cancelDownload,
    retry,
  };
}

/**
 * Simulates downloads for development/testing
 */
function simulateDownloads(
  updateStatus: (file: 'kernel' | 'initrd' | 'rootfs', status: any) => void,
  onComplete: () => void
): void {
  const files: Array<{ name: 'kernel' | 'initrd' | 'rootfs'; duration: number }> = [
    { name: 'kernel', duration: 2000 },
    { name: 'initrd', duration: 3000 },
    { name: 'rootfs', duration: 5000 },
  ];

  let completedCount = 0;

  files.forEach(({ name, duration }) => {
    updateStatus(name, { status: 'downloading', progress: 0 });

    const interval = setInterval(() => {
      const currentProgress = Math.random() * 10;
      updateStatus(name, { 
        status: 'downloading', 
        progress: Math.min(100, currentProgress + Math.random() * 15)
      });
    }, duration / 10);

    setTimeout(() => {
      clearInterval(interval);
      updateStatus(name, { status: 'complete', progress: 100 });
      completedCount++;
      if (completedCount === files.length) {
        onComplete();
      }
    }, duration);
  });
}

/**
 * Options for useVMInitializer hook
 */
export interface UseVMInitializerOptions {
  /** Callback when VM initialization completes */
  onComplete?: () => void;
  /** Callback when VM initialization errors */
  onError?: (error: Error) => void;
}

/**
 * Result of useVMInitializer hook
 */
export interface UseVMInitializerResult {
  /** Current VM status */
  status: VMStatus;
  /** VM initialization logs */
  logs: string[];
  /** Whether initialization is in progress */
  isInitializing: boolean;
  /** Start VM initialization */
  initialize: () => void;
  /** Retry failed initialization */
  retry: () => void;
}

/**
 * Manages VM initialization with log streaming
 * 
 * Handles starting the VM and streaming initialization logs
 * with status updates.
 * 
 * @param options - Hook options
 * @returns {UseVMInitializerResult} VM initialization state and controls
 */
export function useVMInitializer(
  options: UseVMInitializerOptions = {}
): UseVMInitializerResult {
  const { onComplete, onError } = options;
  const { state, addVMLog, setVMStatus, setError } = useWizard();
  const [isInitializing, setIsInitializing] = useState(false);

  const initialize = useCallback(() => {
    if (isInitializing) return;

    setIsInitializing(true);
    setVMStatus('starting');
    setError(null);

    if (typeof window !== 'undefined' && (window as any).electron) {
      const electron = (window as any).electron;

      electron.invoke('vm:start').catch((err: Error) => {
        setVMStatus('error');
        setError(err);
        onError?.(err);
        setIsInitializing(false);
      });

      // Listen for VM status changes
      const unsubscribeStatus = electron.on('vm:status', (_event: any, data: { status: VMStatus }) => {
        setVMStatus(data.status);
        if (data.status === 'running') {
          setIsInitializing(false);
          onComplete?.();
        } else if (data.status === 'error') {
          setIsInitializing(false);
        }
      });

      // Listen for VM logs
      const unsubscribeLogs = electron.on('vm:log', (_event: any, data: { message: string }) => {
        addVMLog(data.message);
      });

      // Cleanup
      return () => {
        unsubscribeStatus?.();
        unsubscribeLogs?.();
      };
    } else {
      // Mock initialization for development
      simulateVMInitialization(setVMStatus, addVMLog, () => {
        setIsInitializing(false);
        onComplete?.();
      });
    }
  }, [isInitializing, setVMStatus, addVMLog, setError, onComplete, onError]);

  const retry = useCallback(() => {
    setVMStatus('idle');
    initialize();
  }, [setVMStatus, initialize]);

  return {
    status: state.vmStatus,
    logs: state.vmLogs,
    isInitializing,
    initialize,
    retry,
  };
}

/**
 * Simulates VM initialization for development/testing
 */
function simulateVMInitialization(
  setStatus: (status: VMStatus) => void,
  addLog: (log: string) => void,
  onComplete: () => void
): void {
  const logs = [
    'Initializing VM...',
    'Loading kernel image...',
    'Mounting root filesystem...',
    'Starting init process...',
    'Configuring network...',
    'VM ready',
  ];

  setStatus('initializing');

  logs.forEach((log, index) => {
    setTimeout(() => {
      addLog(log);
      if (index === logs.length - 1) {
        setStatus('running');
        onComplete();
      }
    }, index * 800);
  });
}

/**
 * Props for useKeyboardNavigation hook
 */
export interface UseKeyboardNavigationOptions {
  /** Whether to enable keyboard navigation */
  enabled?: boolean;
  /** Handler for Enter key */
  onEnter?: () => void;
  /** Handler for Escape key */
  onEscape?: () => void;
  /** Handler for ArrowLeft key */
  onBack?: () => void;
  /** Handler for ArrowRight key */
  onNext?: () => void;
}

/**
 * Provides keyboard navigation for the wizard
 * 
 * Enables keyboard shortcuts for navigating through wizard steps:
 * - Enter: Confirm/Continue
 * - Escape: Cancel/Back
 * - ArrowLeft: Go back
 * - ArrowRight: Go next
 * 
 * @param options - Hook options
 * @example
 * ```tsx
 * useKeyboardNavigation({
 *   enabled: true,
 *   onEnter: () => goToNext(),
 *   onEscape: () => goToBack(),
 * });
 * ```
 */
export function useKeyboardNavigation(
  options: UseKeyboardNavigationOptions = {}
): void {
  const { enabled = true, onEnter, onEscape, onBack, onNext } = options;

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case 'Enter':
          if (!event.shiftKey && !event.ctrlKey && !event.metaKey) {
            onEnter?.();
          }
          break;
        case 'Escape':
          onEscape?.();
          break;
        case 'ArrowLeft':
          if (onBack) {
            event.preventDefault();
            onBack();
          }
          break;
        case 'ArrowRight':
          if (onNext) {
            event.preventDefault();
            onNext();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, onEnter, onEscape, onBack, onNext]);
}
