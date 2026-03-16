/**
 * Agent Creation Wizard - Utility Components
 * 
 * Critical fixes for production readiness:
 * - Modal components (replace browser prompts)
 * - Error boundaries
 * - Browser compatibility checks
 * - File size validation
 * - State persistence
 */

import React, { useState, useCallback, useEffect, useRef, ReactNode, useMemo } from 'react';
import { X, AlertTriangle, RefreshCw, AlertOctagon, FileCode } from 'lucide-react';
import { createModuleLogger } from '@/lib/logger';
import { TEXT } from '@/design/a2r.tokens';

// ============================================================================
// Logger
// ============================================================================
const logger = createModuleLogger('WizardUtils');

// ============================================================================
// CRITICAL FIX #1: Modal Components
// ============================================================================

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * Modal - Accessible modal dialog component
 * Replaces browser prompt() and confirm() dialogs
 */
export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, footer }) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      modalRef.current?.focus();
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Content */}
      <div
        ref={modalRef}
        tabIndex={-1}
        className="relative z-10 w-full max-w-md mx-4 rounded-xl border shadow-2xl focus:outline-none"
        style={{
          background: '#1e1e1e',
          borderColor: '#333333',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: '#333333' }}>
          <h2 id="modal-title" className="text-lg font-semibold" style={{ color: TEXT.primary }}>
            {title}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-white/10 transition-colors"
            aria-label="Close modal"
            style={{ color: TEXT.tertiary }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-2 p-4 border-t" style={{ borderColor: '#333333' }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

interface TextInputModalProps {
  isOpen: boolean;
  title: string;
  label: string;
  placeholder?: string;
  defaultValue?: string;
  onSubmit: (value: string) => void;
  onClose: () => void;
  validate?: (value: string) => string | null;
}

/**
 * TextInputModal - Modal for text input (replaces prompt())
 */
export const TextInputModal: React.FC<TextInputModalProps> = ({
  isOpen,
  title,
  label,
  placeholder,
  defaultValue = '',
  onSubmit,
  onClose,
  validate,
}) => {
  const [value, setValue] = useState(defaultValue);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setValue(defaultValue);
      setError(null);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, defaultValue]);

  const handleSubmit = () => {
    if (validate) {
      const validationError = validate(value);
      if (validationError) {
        setError(validationError);
        return;
      }
    }

    onSubmit(value);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      footer={
        <>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              color: TEXT.secondary,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={{
              background: '#3b82f6',
              color: 'white',
            }}
          >
            OK
          </button>
        </>
      }
    >
      <div className="space-y-2">
        <label className="text-sm font-medium" style={{ color: TEXT.secondary }} htmlFor="modal-input">
          {label}
        </label>
        <input
          ref={inputRef}
          id="modal-input"
          type="text"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          style={{
            background: 'rgba(0, 0, 0, 0.3)',
            borderColor: error ? '#ef4444' : '#333333',
            color: TEXT.primary,
          }}
        />
        {error && (
          <p className="text-xs" style={{ color: '#ef4444' }}>
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
};

// ============================================================================
// CRITICAL FIX #3: Error Boundary
// ============================================================================

interface ErrorBoundaryProps {
  children: ReactNode;
  componentName: string;
  onRetry?: () => void;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: string;
}

/**
 * ErrorBoundary - Wraps wizard steps with error handling
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error(
      { error: error.message, component: this.props.componentName, stack: errorInfo.componentStack },
      `Error in ${this.props.componentName}`
    );
    this.setState({ errorInfo: errorInfo.componentStack ?? undefined });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
    this.props.onRetry?.();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          className="flex flex-col items-center justify-center p-6 rounded-xl border"
          style={{
            background: 'rgba(239, 68, 68, 0.1)',
            borderColor: 'rgba(239, 68, 68, 0.3)',
          }}
          role="alert"
          aria-live="assertive"
        >
          <AlertOctagon size={48} className="mb-4" style={{ color: '#ef4444' }} />
          <h3 className="text-lg font-semibold mb-2" style={{ color: TEXT.primary }}>
            Something went wrong
          </h3>
          <p className="text-sm mb-4 text-center" style={{ color: TEXT.secondary }}>
            We encountered an error in the {this.props.componentName} component.
          </p>
          {this.state.error?.message && (
            <div
              className="w-full max-w-md mb-4 p-3 rounded-lg text-xs font-mono"
              style={{
                background: 'rgba(0, 0, 0, 0.3)',
                color: TEXT.tertiary,
              }}
            >
              {this.state.error.message}
            </div>
          )}
          <button
            onClick={this.handleRetry}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={{
              background: '#3b82f6',
              color: 'white',
            }}
          >
            <RefreshCw size={16} />
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// ============================================================================
// CRITICAL FIX #6: Browser Compatibility
// ============================================================================

export interface BrowserCompatibility {
  speechRecognition: boolean;
  speechSynthesis: boolean;
  mediaRecorder: boolean;
  localStorage: boolean;
  unsupportedFeatures: string[];
}

/**
 * Detect browser compatibility for Web APIs
 */
export const detectBrowserCompatibility = (): BrowserCompatibility => {
  if (typeof window === 'undefined') {
    return {
      speechRecognition: false,
      speechSynthesis: false,
      mediaRecorder: false,
      localStorage: false,
      unsupportedFeatures: ['All browser APIs (SSR)'],
    };
  }

  const unsupported: string[] = [];

  const speechRecognition = 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
  if (!speechRecognition) {
    unsupported.push('Speech Recognition');
  }

  const speechSynthesis = 'speechSynthesis' in window;
  if (!speechSynthesis) {
    unsupported.push('Speech Synthesis');
  }

  const mediaRecorder = 'MediaRecorder' in window && 'mediaDevices' in navigator;
  if (!mediaRecorder) {
    unsupported.push('Media Recording');
  }

  const localStorage = (() => {
    try {
      return typeof window.localStorage !== 'undefined';
    } catch {
      return false;
    }
  })();
  if (!localStorage) {
    unsupported.push('Local Storage');
  }

  return {
    speechRecognition,
    speechSynthesis,
    mediaRecorder,
    localStorage,
    unsupportedFeatures: unsupported,
  };
};

interface BrowserCompatibilityWarningProps {
  compatibility: BrowserCompatibility;
  onDismiss: () => void;
}

/**
 * BrowserCompatibilityWarning - Shows warning for unsupported features
 */
export const BrowserCompatibilityWarning: React.FC<BrowserCompatibilityWarningProps> = ({
  compatibility,
  onDismiss,
}) => {
  if (compatibility.unsupportedFeatures.length === 0) {
    return null;
  }

  return (
    <div
      className="mb-4 p-4 rounded-xl border flex items-start gap-3"
      style={{
        background: 'rgba(251, 191, 36, 0.1)',
        borderColor: 'rgba(251, 191, 36, 0.3)',
      }}
      role="alert"
    >
      <AlertTriangle size={20} className="flex-shrink-0 mt-0.5" style={{ color: '#fbbf24' }} />
      <div className="flex-1">
        <h4 className="text-sm font-semibold mb-1" style={{ color: TEXT.primary }}>
          Limited Browser Support
        </h4>
        <p className="text-sm mb-2" style={{ color: TEXT.secondary }}>
          Your browser doesn't support the following features:
        </p>
        <ul className="text-xs space-y-1 mb-3" style={{ color: TEXT.tertiary }}>
          {compatibility.unsupportedFeatures.map((feature) => (
            <li key={feature} className="flex items-center gap-2">
              <span className="w-1 h-1 rounded-full" style={{ background: '#fbbf24' }} />
              {feature} - Some features may be unavailable
            </li>
          ))}
        </ul>
        <button
          onClick={onDismiss}
          className="text-xs font-medium hover:underline"
          style={{ color: TEXT.secondary }}
        >
          Dismiss
        </button>
      </div>
      <button
        onClick={onDismiss}
        className="flex-shrink-0 p-1 rounded hover:bg-white/10 transition-colors"
        aria-label="Dismiss warning"
        style={{ color: TEXT.tertiary }}
      >
        <X size={16} />
      </button>
    </div>
  );
};

// ============================================================================
// CRITICAL FIX #5: File Size Validation
// ============================================================================

export const MAX_FILE_SIZE_BYTES = 1 * 1024 * 1024; // 1MB
export const MAX_FILE_SIZE_DISPLAY = '1 MB';

/**
 * Format file size for display
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Validate file size
 */
export const validateFileSize = (file: File | { size: number }): string | null => {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `File size (${formatFileSize(file.size)}) exceeds maximum allowed size of ${MAX_FILE_SIZE_DISPLAY}`;
  }
  return null;
};

interface FileSizeWarningProps {
  fileSize: number;
  onDismiss: () => void;
}

/**
 * FileSizeWarning - Shows warning for large files
 */
export const FileSizeWarning: React.FC<FileSizeWarningProps> = ({ fileSize, onDismiss }) => {
  const warningThreshold = MAX_FILE_SIZE_BYTES * 0.8; // Warn at 80% of max

  if (fileSize <= warningThreshold) {
    return null;
  }

  const isOverLimit = fileSize > MAX_FILE_SIZE_BYTES;

  return (
    <div
      className="mb-4 p-4 rounded-xl border flex items-start gap-3"
      style={{
        background: isOverLimit
          ? 'rgba(239, 68, 68, 0.1)'
          : 'rgba(251, 191, 36, 0.1)',
        borderColor: isOverLimit
          ? 'rgba(239, 68, 68, 0.3)'
          : 'rgba(251, 191, 36, 0.3)',
      }}
      role="alert"
    >
      <AlertTriangle
        size={20}
        className="flex-shrink-0 mt-0.5"
        style={{ color: isOverLimit ? '#ef4444' : '#fbbf24' }}
      />
      <div className="flex-1">
        <h4
          className="text-sm font-semibold mb-1"
          style={{ color: isOverLimit ? '#ef4444' : TEXT.primary }}
        >
          {isOverLimit ? 'File Too Large' : 'Large File Warning'}
        </h4>
        <p className="text-sm" style={{ color: TEXT.secondary }}>
          {isOverLimit
            ? `File size (${formatFileSize(fileSize)}) exceeds the ${MAX_FILE_SIZE_DISPLAY} limit. Please upload a smaller file.`
            : `File size (${formatFileSize(fileSize)}) is approaching the ${MAX_FILE_SIZE_DISPLAY} limit.`}
        </p>
      </div>
      {!isOverLimit && (
        <button
          onClick={onDismiss}
          className="flex-shrink-0 p-1 rounded hover:bg-white/10 transition-colors"
          aria-label="Dismiss warning"
          style={{ color: TEXT.tertiary }}
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
};

// ============================================================================
// CRITICAL FIX #4: State Persistence Hook
// ============================================================================

const WIZARD_STORAGE_KEY = 'agent-creation-wizard-state';

export interface WizardPersistedState {
  currentStep: number;
  name: string;
  description: string;
  agentType: string;
  model: string;
  provider: string;
  characterConfig: any;
  selectedTools: string[];
  capabilities: string[];
  selectedPlugins: any[];
  systemPrompt: string;
  temperature: number;
  maxIterations: number;
  timestamp: number;
}

/**
 * useWizardPersistence - Hook for persisting wizard state to localStorage
 */
export const useWizardPersistence = (
  state: Partial<WizardPersistedState>,
  isEnabled: boolean
) => {
  const compatibility = useMemo(() => detectBrowserCompatibility(), []);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const loadState = useCallback((): Partial<WizardPersistedState> | null => {
    if (!isEnabled || !compatibility.localStorage) {
      logger.debug({ isEnabled, hasLocalStorage: compatibility.localStorage }, 'Skipping state load');
      return null;
    }

    try {
      const stored = localStorage.getItem(WIZARD_STORAGE_KEY);
      if (!stored) {
        logger.debug({}, 'No stored state found');
        return null;
      }

      const parsed = JSON.parse(stored) as WizardPersistedState;
      const age = Date.now() - parsed.timestamp;
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours

      if (age > maxAge) {
        logger.info({ age }, 'Stored state expired, clearing');
        localStorage.removeItem(WIZARD_STORAGE_KEY);
        return null;
      }

      logger.info({ step: parsed.currentStep, age }, 'Loaded state from storage');
      return parsed;
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : error }, 'Failed to load state');
      return null;
    }
  }, [isEnabled, compatibility.localStorage]);

  const saveState = useCallback(
    (stateToSave: Partial<WizardPersistedState>) => {
      if (!isEnabled || !compatibility.localStorage) {
        return;
      }

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(() => {
        try {
          const stateWithTimestamp: WizardPersistedState = {
            ...stateToSave,
            timestamp: Date.now(),
          } as WizardPersistedState;

          localStorage.setItem(WIZARD_STORAGE_KEY, JSON.stringify(stateWithTimestamp));
          logger.debug({ step: stateToSave.currentStep }, 'State saved to storage');
        } catch (error) {
          logger.error(
            { error: error instanceof Error ? error.message : error },
            'Failed to save state'
          );
        }
      }, 500);
    },
    [isEnabled, compatibility.localStorage]
  );

  const clearState = useCallback(() => {
    if (!isEnabled || !compatibility.localStorage) {
      return;
    }

    try {
      localStorage.removeItem(WIZARD_STORAGE_KEY);
      logger.info({}, 'Wizard state cleared');
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : error }, 'Failed to clear state');
    }
  }, [isEnabled, compatibility.localStorage]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return {
    loadState,
    saveState,
    clearState,
    hasLocalStorage: compatibility.localStorage,
  };
};

export { logger };
