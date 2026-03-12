/**
 * @fileoverview Wizard State Context
 * 
 * Provides global state management for the onboarding wizard.
 * Uses React Context API for prop drilling avoidance and state sharing
 * across all wizard steps.
 * 
 * @module components/onboarding/context
 * @example
 * ```tsx
 * import { useWizard } from './context';
 * 
 * function MyStep() {
 *   const { state, setState, goToStep } = useWizard();
 *   // Use wizard state...
 * }
 * ```
 */

import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

/**
 * Supported platform types
 */
export type PlatformType = 'macos' | 'linux' | 'windows';

/**
 * Supported CPU architectures
 */
export type Architecture = 'x86_64' | 'arm64';

/**
 * Setup mode options
 */
export type SetupMode = 'download' | 'build' | null;

/**
 * VM initialization status states
 */
export type VMStatus = 'idle' | 'checking' | 'downloading' | 'initializing' | 'running' | 'error' | 'complete';

/**
 * Individual file download status
 */
export interface DownloadFileStatus {
  /** Current status of the download */
  status: 'pending' | 'downloading' | 'complete' | 'error';
  /** Download progress as percentage (0-100) */
  progress: number;
  /** Bytes downloaded */
  downloaded?: number;
  /** Total bytes to download */
  total?: number;
  /** Error message if status is 'error' */
  error?: string;
}

/**
 * Platform information detected from the system
 */
export interface PlatformInfo {
  /** Platform type */
  type: PlatformType;
  /** CPU architecture */
  arch: Architecture;
  /** OS version string */
  version: string;
  /** Whether the platform supports building images locally */
  canBuildImages: boolean;
}

/**
 * Complete wizard state interface
 */
export interface WizardState {
  /** Detected platform information */
  platform: PlatformInfo | null;
  /** Selected setup mode */
  setupMode: SetupMode;
  /** Download progress for each VM image */
  downloads: {
    kernel: DownloadFileStatus;
    initrd: DownloadFileStatus;
    rootfs: DownloadFileStatus;
  };
  /** Current VM initialization status */
  vmStatus: VMStatus;
  /** VM initialization logs */
  vmLogs: string[];
  /** Current error if any */
  error: Error | null;
}

/**
 * Wizard context value interface
 */
export interface WizardContextValue {
  /** Current wizard state */
  state: WizardState;
  /** Update wizard state (partial updates supported) */
  setState: React.Dispatch<React.SetStateAction<WizardState>>;
  /** Current step index */
  currentStep: number;
  /** Navigate to a specific step */
  goToStep: (step: number) => void;
  /** Navigate to next step */
  goToNext: () => void;
  /** Navigate to previous step */
  goToBack: () => void;
  /** Whether going back is allowed */
  canGoBack: boolean;
  /** Whether going next is allowed */
  canGoNext: boolean;
  /** Update download status for a specific file */
  updateDownloadStatus: (file: keyof WizardState['downloads'], status: Partial<DownloadFileStatus>) => void;
  /** Add a VM log entry */
  addVMLog: (log: string) => void;
  /** Set VM status */
  setVMStatus: (status: VMStatus) => void;
  /** Set error state */
  setError: (error: Error | null) => void;
}

/**
 * Default initial state for the wizard
 */
export const initialWizardState: WizardState = {
  platform: null,
  setupMode: null,
  downloads: {
    kernel: { status: 'pending', progress: 0 },
    initrd: { status: 'pending', progress: 0 },
    rootfs: { status: 'pending', progress: 0 },
  },
  vmStatus: 'idle',
  vmLogs: [],
  error: null,
};

/**
 * React context for wizard state
 */
export const WizardContext = createContext<WizardContextValue | null>(null);

/**
 * Hook to access wizard context
 * @throws {Error} If used outside of WizardProvider
 * @returns {WizardContextValue} Wizard context value
 */
export function useWizard(): WizardContextValue {
  const context = useContext(WizardContext);
  if (!context) {
    throw new Error('useWizard must be used within a WizardProvider');
  }
  return context;
}

/**
 * Props for WizardProvider component
 */
export interface WizardProviderProps {
  /** Child components */
  children: ReactNode;
  /** Initial step index (default: 0) */
  initialStep?: number;
  /** Callback when wizard completes */
  onComplete?: () => void;
  /** Total number of steps */
  totalSteps: number;
}

/**
 * Provider component for wizard state
 * 
 * Wraps the wizard components and provides state management
 * 
 * @param props - Component props
 * @returns {JSX.Element} Provider component
 */
export function WizardProvider({ 
  children, 
  initialStep = 0, 
  onComplete,
  totalSteps 
}: WizardProviderProps): JSX.Element {
  const [state, setState] = useState<WizardState>(initialWizardState);
  const [currentStep, setCurrentStep] = useState(initialStep);

  const goToStep = useCallback((step: number) => {
    if (step >= 0 && step < totalSteps) {
      setCurrentStep(step);
    }
  }, [totalSteps]);

  const goToNext = useCallback(() => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(s => s + 1);
    } else {
      onComplete?.();
    }
  }, [currentStep, totalSteps, onComplete]);

  const goToBack = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(s => s - 1);
    }
  }, [currentStep]);

  const canGoBack = currentStep > 0;
  const canGoNext = currentStep < totalSteps - 1;

  const updateDownloadStatus = useCallback((
    file: keyof WizardState['downloads'], 
    status: Partial<DownloadFileStatus>
  ) => {
    setState(prev => ({
      ...prev,
      downloads: {
        ...prev.downloads,
        [file]: {
          ...prev.downloads[file],
          ...status,
        },
      },
    }));
  }, []);

  const addVMLog = useCallback((log: string) => {
    setState(prev => ({
      ...prev,
      vmLogs: [...prev.vmLogs, log],
    }));
  }, []);

  const setVMStatus = useCallback((status: VMStatus) => {
    setState(prev => ({
      ...prev,
      vmStatus: status,
    }));
  }, []);

  const setError = useCallback((error: Error | null) => {
    setState(prev => ({
      ...prev,
      error,
    }));
  }, []);

  const value: WizardContextValue = {
    state,
    setState,
    currentStep,
    goToStep,
    goToNext,
    goToBack,
    canGoBack,
    canGoNext,
    updateDownloadStatus,
    addVMLog,
    setVMStatus,
    setError,
  };

  return (
    <WizardContext.Provider value={value}>
      {children}
    </WizardContext.Provider>
  );
}
