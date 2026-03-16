/**
 * Agent Creation Wizard - State Persistence Hook
 * 
 * Features:
 * - Auto-save on every change with debouncing
 * - Restore state on page refresh
 * - Clear state on completion
 * - Show "Draft saved" indicator
 * - Version tracking for schema migrations
 * - Error handling and recovery
 * 
 * @module AgentCreationWizard.persistence
 * @version 4.0.0
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { createModuleLogger } from '../../lib/logger';
import { detectBrowserCompatibility, type BrowserCompatibility } from './AgentCreationWizard.validations';
import { type CharacterLayerConfig } from '../../lib/agents/agent.types';

const logger = createModuleLogger('AgentWizard.Persistence');

// ============================================================================
// Constants and Types
// ============================================================================

export const WIZARD_STORAGE_KEY = 'agent-creation-wizard-state';
export const WIZARD_VERSION = '4.0.0';
export const STATE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface WizardPersistedConfig {
  name: string;
  description: string;
  agentType: string;
  model: string;
  provider: string;
  characterConfig: CharacterLayerConfig;
  selectedTools: string[];
  capabilities: string[];
  systemPrompt: string;
  temperature: number;
  maxIterations: number;
}

export interface WizardPersistedState {
  config: WizardPersistedConfig;
  currentStep: number;
  timestamp: number;
  version: string;
}

export interface SaveStatus {
  isSaving: boolean;
  lastSaved: Date | null;
  error: string | null;
  isRestored: boolean;
}

// ============================================================================
// State Persistence Hook
// ============================================================================

export interface UseWizardPersistenceReturn {
  loadState: () => { config: WizardPersistedConfig; currentStep: number } | null;
  saveState: (config: WizardPersistedConfig, step: number) => void;
  clearState: () => void;
  hasLocalStorage: boolean;
  saveStatus: SaveStatus;
  browserCompatibility: BrowserCompatibility;
}

/**
 * useWizardPersistence - Hook for persisting wizard state to localStorage
 */
export function useWizardPersistence(
  wizardConfig: WizardPersistedConfig,
  currentStep: number,
  isEnabled: boolean = true
): UseWizardPersistenceReturn {
  const browserCompatibility = useMemo(() => detectBrowserCompatibility(), []);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialMount = useRef(true);
  
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({
    isSaving: false,
    lastSaved: null,
    error: null,
    isRestored: false,
  });

  // Load state from localStorage
  const loadState = useCallback((): { config: WizardPersistedConfig; currentStep: number } | null => {
    if (!isEnabled || !browserCompatibility.localStorage) {
      logger.debug({}, 'Load state skipped - persistence disabled or localStorage unavailable');
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

      // Check if state is expired
      if (age > STATE_MAX_AGE) {
        logger.warn({ age, stateAge: new Date(parsed.timestamp).toISOString() }, 'Stored state expired, removing');
        localStorage.removeItem(WIZARD_STORAGE_KEY);
        return null;
      }

      // Version migration could go here
      if (parsed.version !== WIZARD_VERSION) {
        logger.info({ oldVersion: parsed.version, newVersion: WIZARD_VERSION }, 'Migrating state version');
        // Add migration logic here if needed
      }

      logger.info(
        { step: parsed.currentStep, name: parsed.config?.name, age: Math.round(age / 60000) + 'm' },
        'Loaded state from storage'
      );
      
      setSaveStatus(prev => ({ ...prev, isRestored: true }));
      
      return { config: parsed.config, currentStep: parsed.currentStep };
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : error }, 'Failed to load state');
      return null;
    }
  }, [isEnabled, browserCompatibility.localStorage]);

  // Save state to localStorage with debouncing
  const saveState = useCallback(
    (stateConfig: WizardPersistedConfig, step: number) => {
      if (!isEnabled || !browserCompatibility.localStorage) {
        return;
      }

      // Clear existing timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      setSaveStatus(prev => ({ ...prev, isSaving: true, error: null }));

      // Debounce save by 1000ms
      saveTimeoutRef.current = setTimeout(() => {
        try {
          const stateToSave: WizardPersistedState = {
            config: stateConfig,
            currentStep: step,
            timestamp: Date.now(),
            version: WIZARD_VERSION,
          };

          localStorage.setItem(WIZARD_STORAGE_KEY, JSON.stringify(stateToSave));
          
          setSaveStatus({
            isSaving: false,
            lastSaved: new Date(),
            error: null,
            isRestored: saveStatus.isRestored,
          });
          
          logger.info(
            { step, name: stateConfig.name, timestamp: new Date().toISOString() },
            'State saved to storage'
          );
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          logger.error({ error: errorMsg }, 'Failed to save state');
          setSaveStatus(prev => ({
            ...prev,
            isSaving: false,
            error: errorMsg,
          }));
        }
      }, 1000);
    },
    [isEnabled, browserCompatibility.localStorage, saveStatus.isRestored]
  );

  // Clear state from localStorage
  const clearState = useCallback(() => {
    if (!isEnabled || !browserCompatibility.localStorage) {
      return;
    }

    try {
      localStorage.removeItem(WIZARD_STORAGE_KEY);
      logger.info({}, 'Wizard state cleared on completion');
      setSaveStatus({
        isSaving: false,
        lastSaved: null,
        error: null,
        isRestored: false,
      });
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : error }, 'Failed to clear state');
    }
  }, [isEnabled, browserCompatibility.localStorage]);

  // Auto-save on config or step change (skip initial mount)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    if (isEnabled && browserCompatibility.localStorage) {
      saveState(wizardConfig, currentStep);
    }
  }, [wizardConfig, currentStep, isEnabled, browserCompatibility.localStorage, saveState]);

  // Cleanup on unmount
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
    hasLocalStorage: browserCompatibility.localStorage,
    saveStatus,
    browserCompatibility,
  };
}

// ============================================================================
// Draft Saved Indicator Component
// ============================================================================

import React from 'react';

interface DraftSavedIndicatorProps {
  saveStatus: SaveStatus;
  className?: string;
}

/**
 * DraftSavedIndicator - Shows save status to user
 * 
 * Displays:
 * - "Saving..." when save is in progress
 * - "Draft saved" with timestamp when save completes
 * - "Save failed" with error message on error
 * - Nothing when localStorage is unavailable
 */
export const DraftSavedIndicator: React.FC<DraftSavedIndicatorProps> = ({
  saveStatus,
  className = '',
}) => {
  if (!saveStatus.lastSaved && !saveStatus.isSaving && !saveStatus.error) {
    return null;
  }

  return (
    <div
      className={`flex items-center gap-2 text-xs ${className}`}
      role="status"
      aria-live="polite"
      aria-label={saveStatus.isSaving ? 'Saving draft' : saveStatus.error ? 'Save failed' : 'Draft saved'}
    >
      {saveStatus.isSaving && (
        <>
          <span className="animate-spin">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
              <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
            </svg>
          </span>
          <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>Saving...</span>
        </>
      )}
      
      {!saveStatus.isSaving && saveStatus.lastSaved && !saveStatus.error && (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span style={{ color: '#10B981' }}>
            Draft saved
            <span style={{ color: 'rgba(255, 255, 255, 0.4)', marginLeft: '4px' }}>
              {saveStatus.lastSaved.toLocaleTimeString()}
            </span>
          </span>
        </>
      )}
      
      {!saveStatus.isSaving && saveStatus.error && (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span style={{ color: '#EF4444' }} title={saveStatus.error}>
            Save failed
          </span>
        </>
      )}
    </div>
  );
};

// ============================================================================
// Browser Compatibility Warning Component
// ============================================================================

interface BrowserCompatibilityWarningProps {
  compatibility: BrowserCompatibility;
  onDismiss: () => void;
  dismissed?: boolean;
}

export const BrowserCompatibilityWarning: React.FC<BrowserCompatibilityWarningProps> = ({
  compatibility,
  onDismiss,
  dismissed = false,
}) => {
  if (dismissed || compatibility.unsupportedFeatures.length === 0) {
    return null;
  }

  const severityColor = compatibility.compatibilityScore >= 80 ? '#10B981' :
                        compatibility.compatibilityScore >= 60 ? '#F59E0B' : '#EF4444';

  return (
    <div
      className="p-4 rounded-xl border flex items-start gap-3"
      style={{
        background: 'rgba(251, 191, 36, 0.1)',
        borderColor: 'rgba(251, 191, 36, 0.3)',
      }}
      role="alert"
      aria-label="Browser compatibility warning"
    >
      <svg 
        width="20" 
        height="20" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="#F59E0B" 
        strokeWidth="2"
        className="flex-shrink-0 mt-0.5"
        aria-hidden="true"
      >
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
      <div className="flex-1">
        <h4 className="text-sm font-semibold mb-1" style={{ color: '#FFFFFF' }}>
          Limited Browser Support
        </h4>
        <p className="text-sm mb-2" style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
          Your browser doesn't support the following features:
        </p>
        <ul className="text-xs space-y-1 mb-3" style={{ color: 'rgba(255, 255, 255, 0.5)' }}>
          {compatibility.unsupportedFeatures.map((feature) => (
            <li key={feature} className="flex items-center gap-2">
              <span 
                className="w-1 h-1 rounded-full" 
                style={{ background: severityColor }}
                aria-hidden="true"
              />
              {feature} - Some features may be unavailable
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-3">
          <button
            onClick={onDismiss}
            className="text-xs font-medium hover:underline"
            style={{ color: 'rgba(255, 255, 255, 0.7)' }}
          >
            Dismiss
          </button>
          <span 
            className="text-xs px-2 py-0.5 rounded-full"
            style={{ 
              background: `${severityColor}20`,
              color: severityColor,
            }}
          >
            {compatibility.compatibilityScore}% compatible
          </span>
        </div>
      </div>
      <button
        onClick={onDismiss}
        className="flex-shrink-0 p-1 rounded hover:bg-white/10 transition-colors"
        aria-label="Dismiss warning"
        style={{ color: 'rgba(255, 255, 255, 0.5)' }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
};

// ============================================================================
// File Size Warning Component
// ============================================================================

import { 
  formatFileSize, 
  isFileSizeWarning, 
  isFileSizeExceeded,
  MAX_FILE_SIZE_BYTES 
} from './AgentCreationWizard.validations';

interface FileSizeWarningProps {
  fileSize: number;
  fileName?: string;
  onDismiss?: () => void;
  showDismiss?: boolean;
}

export const FileSizeWarning: React.FC<FileSizeWarningProps> = ({
  fileSize,
  fileName,
  onDismiss,
  showDismiss = false,
}) => {
  const warningThreshold = MAX_FILE_SIZE_BYTES * 0.8;

  if (fileSize <= warningThreshold) {
    return null;
  }

  const isOverLimit = isFileSizeExceeded(fileSize);
  const severityColor = isOverLimit ? '#EF4444' : '#F59E0B';

  return (
    <div
      className="p-4 rounded-xl border flex items-start gap-3"
      style={{
        background: isOverLimit ? 'rgba(239, 68, 68, 0.1)' : 'rgba(251, 191, 36, 0.1)',
        borderColor: `${severityColor}30`,
      }}
      role="alert"
      aria-label={isOverLimit ? 'File size error' : 'File size warning'}
    >
      <svg 
        width="20" 
        height="20" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke={severityColor} 
        strokeWidth="2"
        className="flex-shrink-0 mt-0.5"
        aria-hidden="true"
      >
        {isOverLimit ? (
          <>
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </>
        ) : (
          <>
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </>
        )}
      </svg>
      <div className="flex-1">
        <h4 
          className="text-sm font-semibold mb-1"
          style={{ color: isOverLimit ? '#EF4444' : '#FFFFFF' }}
        >
          {isOverLimit ? 'File Too Large' : 'Large File Warning'}
        </h4>
        <p className="text-sm" style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
          {fileName && <span className="font-medium">{fileName}: </span>}
          {isOverLimit
            ? `File size (${formatFileSize(fileSize)}) exceeds the 1 MB limit.`
            : `File size (${formatFileSize(fileSize)}) is approaching the 1 MB limit.`}
        </p>
        {isOverLimit && (
          <p className="text-xs mt-1" style={{ color: '#EF4444' }}>
            Please reduce the file size or remove this file to continue.
          </p>
        )}
      </div>
      {showDismiss && onDismiss && (
        <button
          onClick={onDismiss}
          className="flex-shrink-0 p-1 rounded hover:bg-white/10 transition-colors"
          aria-label="Dismiss warning"
          style={{ color: 'rgba(255, 255, 255, 0.5)' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </div>
  );
};

// ============================================================================
// Plugin Conflict Warning Component
// ============================================================================

import { detectPluginConflicts, type PluginConflictResult } from './AgentCreationWizard.validations';

interface PluginConflictWarningProps {
  selectedTools: string[];
  onDismiss?: () => void;
  showDismiss?: boolean;
}

export const PluginConflictWarning: React.FC<PluginConflictWarningProps> = ({
  selectedTools,
  onDismiss,
  showDismiss = false,
}) => {
  const conflictResult = useMemo(
    () => detectPluginConflicts(selectedTools),
    [selectedTools]
  );

  if (!conflictResult.hasConflict) {
    return null;
  }

  const severityColors = {
    error: { bg: 'rgba(239, 68, 68, 0.1)', border: 'rgba(239, 68, 68, 0.3)', text: '#EF4444' },
    warning: { bg: 'rgba(251, 191, 36, 0.1)', border: 'rgba(251, 191, 36, 0.3)', text: '#F59E0B' },
    info: { bg: 'rgba(59, 130, 246, 0.1)', border: 'rgba(59, 130, 246, 0.3)', text: '#3B82F6' },
  };

  const colors = severityColors[conflictResult.severity];

  return (
    <div
      className="p-4 rounded-xl border flex items-start gap-3"
      style={{
        background: colors.bg,
        borderColor: colors.border,
      }}
      role="alert"
      aria-label="Plugin conflict warning"
    >
      <svg 
        width="20" 
        height="20" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke={colors.text} 
        strokeWidth="2"
        className="flex-shrink-0 mt-0.5"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <div className="flex-1">
        <h4 className="text-sm font-semibold mb-1" style={{ color: '#FFFFFF' }}>
          {conflictResult.message}
        </h4>
        <ul className="text-sm space-y-1 mb-2" style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
          {conflictResult.conflicts.map((conflict, idx) => (
            <li key={idx} className="flex items-center gap-2">
              <span 
                className="w-1.5 h-1.5 rounded-full" 
                style={{ background: colors.text }}
                aria-hidden="true"
              />
              {conflict}
            </li>
          ))}
        </ul>
        {conflictResult.severity === 'error' && (
          <p className="text-xs" style={{ color: colors.text }}>
            Please resolve these conflicts before continuing.
          </p>
        )}
      </div>
      {showDismiss && onDismiss && (
        <button
          onClick={onDismiss}
          className="flex-shrink-0 p-1 rounded hover:bg-white/10 transition-colors"
          aria-label="Dismiss warning"
          style={{ color: 'rgba(255, 255, 255, 0.5)' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </div>
  );
};

// ============================================================================
// Duplicate Name Warning Component
// ============================================================================

interface DuplicateNameWarningProps {
  agentName: string;
  onDismiss?: () => void;
  showDismiss?: boolean;
}

export const DuplicateNameWarning: React.FC<DuplicateNameWarningProps> = ({
  agentName,
  onDismiss,
  showDismiss = false,
}) => {
  if (!agentName) return null;

  const isDuplicate = (() => {
    try {
      const stored = localStorage.getItem('a2r-existing-agent-names');
      if (!stored) return false;
      const names = JSON.parse(stored) as string[];
      return names.some(n => n.toLowerCase() === agentName.toLowerCase());
    } catch {
      return false;
    }
  })();

  if (!isDuplicate) return null;

  return (
    <div
      className="p-4 rounded-xl border flex items-start gap-3"
      style={{
        background: 'rgba(239, 68, 68, 0.1)',
        borderColor: 'rgba(239, 68, 68, 0.3)',
      }}
      role="alert"
      aria-label="Duplicate agent name warning"
    >
      <svg 
        width="20" 
        height="20" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="#EF4444" 
        strokeWidth="2"
        className="flex-shrink-0 mt-0.5"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <div className="flex-1">
        <h4 className="text-sm font-semibold mb-1" style={{ color: '#EF4444' }}>
          Duplicate Agent Name
        </h4>
        <p className="text-sm" style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
          An agent named "<span className="font-medium">{agentName}</span>" already exists.
          Please choose a different name to avoid conflicts.
        </p>
      </div>
      {showDismiss && onDismiss && (
        <button
          onClick={onDismiss}
          className="flex-shrink-0 p-1 rounded hover:bg-white/10 transition-colors"
          aria-label="Dismiss warning"
          style={{ color: 'rgba(255, 255, 255, 0.5)' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </div>
  );
};
