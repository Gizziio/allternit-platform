/**
 * Agent Creation Wizard - Validation Utilities
 * 
 * Provides validation for:
 * - File size validation (max 1MB per file)
 * - Duplicate agent name detection
 * - Workspace path validation
 * - Plugin conflict detection
 * 
 * @module AgentCreationWizard.validations
 * @version 4.0.0
 */

import { createModuleLogger } from '../../lib/logger';

const logger = createModuleLogger('AgentWizard.Validations');

// ============================================================================
// File Size Validation
// ============================================================================

export const MAX_FILE_SIZE_BYTES = 1 * 1024 * 1024; // 1MB
export const MAX_FILE_SIZE_DISPLAY = '1 MB';
export const FILE_SIZE_WARNING_THRESHOLD = 0.8; // 80% of max

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
 * @param file - File object or object with size property
 * @returns Error message if file is too large, null otherwise
 */
export const validateFileSize = (file: File | { size: number }): string | null => {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `File size (${formatFileSize(file.size)}) exceeds maximum allowed size of ${MAX_FILE_SIZE_DISPLAY}`;
  }
  return null;
};

/**
 * Check if file size is approaching limit (warning threshold)
 */
export const isFileSizeWarning = (fileSize: number): boolean => {
  return fileSize > (MAX_FILE_SIZE_BYTES * FILE_SIZE_WARNING_THRESHOLD);
};

/**
 * Check if file size exceeds limit
 */
export const isFileSizeExceeded = (fileSize: number): boolean => {
  return fileSize > MAX_FILE_SIZE_BYTES;
};

// ============================================================================
// Agent Name Validation
// ============================================================================

const AGENT_NAMES_KEY = 'allternit-existing-agent-names';

/**
 * Get existing agent names from localStorage
 */
export const getExistingAgentNames = (): string[] => {
  try {
    const stored = localStorage.getItem(AGENT_NAMES_KEY);
    if (!stored) return [];
    return JSON.parse(stored) as string[];
  } catch (error) {
    logger.error({ error }, 'Failed to load existing agent names');
    return [];
  }
};

/**
 * Check if agent name is duplicate
 */
export const isAgentNameDuplicate = (name: string): boolean => {
  const existingNames = getExistingAgentNames();
  return existingNames.some(n => n.toLowerCase() === name.toLowerCase());
};

/**
 * Register agent name in localStorage
 */
export const registerAgentName = (name: string): void => {
  try {
    const existingNames = getExistingAgentNames();
    if (!existingNames.includes(name)) {
      localStorage.setItem(AGENT_NAMES_KEY, JSON.stringify([...existingNames, name]));
      logger.info({ name }, 'Agent name registered');
    }
  } catch (error) {
    logger.error({ error }, 'Failed to register agent name');
  }
};

/**
 * Remove agent name from localStorage
 */
export const removeAgentName = (name: string): void => {
  try {
    const existingNames = getExistingAgentNames();
    localStorage.setItem(
      AGENT_NAMES_KEY,
      JSON.stringify(existingNames.filter(n => n !== name))
    );
    logger.info({ name }, 'Agent name removed');
  } catch (error) {
    logger.error({ error }, 'Failed to remove agent name');
  }
};

/**
 * Validate agent name
 */
export interface AgentNameValidationResult {
  valid: boolean;
  error?: string;
  isDuplicate?: boolean;
}

export const validateAgentName = (name: string, checkDuplicate: boolean = true): AgentNameValidationResult => {
  if (!name || name.trim().length === 0) {
    return { valid: false, error: 'Agent name cannot be empty' };
  }

  if (name.trim().length < 2) {
    return { valid: false, error: 'Agent name must be at least 2 characters' };
  }

  if (name.trim().length > 100) {
    return { valid: false, error: 'Agent name must be less than 100 characters' };
  }

  // Check for invalid characters
  const invalidChars = /[<>:"/\\|?*]/;
  if (invalidChars.test(name)) {
    return { valid: false, error: 'Agent name contains invalid characters' };
  }

  // Check for duplicate
  if (checkDuplicate && isAgentNameDuplicate(name)) {
    return { valid: false, error: 'An agent with this name already exists', isDuplicate: true };
  }

  return { valid: true };
};

// ============================================================================
// Workspace Path Validation
// ============================================================================

const WORKSPACE_PATHS_KEY = 'allternit-workspace-paths';

/**
 * Get registered workspace paths
 */
export const getRegisteredWorkspacePaths = (): string[] => {
  try {
    const stored = localStorage.getItem(WORKSPACE_PATHS_KEY);
    if (!stored) return [];
    return JSON.parse(stored) as string[];
  } catch (error) {
    logger.error({ error }, 'Failed to load workspace paths');
    return [];
  }
};

/**
 * Validate workspace path
 */
export interface WorkspacePathValidationResult {
  valid: boolean;
  error?: string;
}

export const validateWorkspacePath = (path: string): WorkspacePathValidationResult => {
  if (!path || path.trim().length === 0) {
    return { valid: false, error: 'Workspace path cannot be empty' };
  }

  // Check for invalid characters
  const invalidChars = /[<>:"|?*]/;
  if (invalidChars.test(path)) {
    return { valid: false, error: 'Workspace path contains invalid characters' };
  }

  // Check path length
  if (path.length > 500) {
    return { valid: false, error: 'Workspace path is too long (max 500 characters)' };
  }

  // Check for path traversal attempts
  if (path.includes('..')) {
    return { valid: false, error: 'Invalid path: path traversal not allowed' };
  }

  // Check for absolute path on Windows
  if (/^[A-Z]:/i.test(path)) {
    return { valid: false, error: 'Absolute Windows paths are not allowed. Use relative paths.' };
  }

  return { valid: true };
};

/**
 * Register workspace path
 */
export const registerWorkspacePath = (path: string): void => {
  try {
    const existingPaths = getRegisteredWorkspacePaths();
    if (!existingPaths.includes(path)) {
      localStorage.setItem(WORKSPACE_PATHS_KEY, JSON.stringify([...existingPaths, path]));
      logger.info({ path }, 'Workspace path registered');
    }
  } catch (error) {
    logger.error({ error }, 'Failed to register workspace path');
  }
};

// ============================================================================
// Plugin Conflict Detection
// ============================================================================

const PLUGINS_KEY = 'allternit-installed-plugins';

/**
 * Known plugin conflicts
 */
export const PLUGIN_CONFLICTS: Record<string, string[]> = {
  'eslint': ['tslint', 'jshint'],
  'prettier': ['clang-format'],
  'jest': ['mocha', 'jasmine', 'vitest'],
  'webpack': ['vite', 'rollup', 'parcel'],
  'babel': ['swc', 'esbuild'],
  'typescript': ['babel-typescript'],
  'postcss': ['less', 'sass-loader'],
};

/**
 * Get installed plugins
 */
export const getInstalledPlugins = (): string[] => {
  try {
    const stored = localStorage.getItem(PLUGINS_KEY);
    if (!stored) return [];
    return JSON.parse(stored) as string[];
  } catch (error) {
    logger.error({ error }, 'Failed to load installed plugins');
    return [];
  }
};

/**
 * Detect plugin conflicts
 */
export interface PluginConflictResult {
  hasConflict: boolean;
  conflicts: string[];
  message?: string;
  severity: 'error' | 'warning' | 'info';
}

export const detectPluginConflicts = (selectedTools: string[]): PluginConflictResult => {
  const installedPlugins = getInstalledPlugins();
  const conflicts: string[] = [];
  let maxSeverity: 'error' | 'warning' | 'info' = 'info';

  selectedTools.forEach(tool => {
    const conflictingPlugins = PLUGIN_CONFLICTS[tool] || [];
    conflictingPlugins.forEach(conflict => {
      if (installedPlugins.includes(conflict)) {
        conflicts.push(`${tool} conflicts with ${conflict}`);
        // Jest/vitest and webpack/vite conflicts are warnings, not errors
        if ((tool === 'jest' && conflict === 'vitest') || 
            (tool === 'webpack' && conflict === 'vite')) {
          maxSeverity = maxSeverity === 'info' ? 'warning' : maxSeverity;
        } else {
          maxSeverity = 'error';
        }
      }
    });
  });

  return {
    hasConflict: conflicts.length > 0,
    conflicts,
    message: conflicts.length > 0 ? `Detected ${conflicts.length} plugin conflict(s)` : undefined,
    severity: maxSeverity,
  };
};

/**
 * Register installed plugin
 */
export const registerPlugin = (plugin: string): void => {
  try {
    const existingPlugins = getInstalledPlugins();
    if (!existingPlugins.includes(plugin)) {
      localStorage.setItem(PLUGINS_KEY, JSON.stringify([...existingPlugins, plugin]));
      logger.info({ plugin }, 'Plugin registered');
    }
  } catch (error) {
    logger.error({ error }, 'Failed to register plugin');
  }
};

/**
 * Get conflict-free tool suggestions
 */
export const getConflictFreeSuggestions = (selectedTools: string[]): string[] => {
  const conflictResult = detectPluginConflicts(selectedTools);
  if (!conflictResult.hasConflict) {
    return [];
  }

  const suggestions: string[] = [];
  
  conflictResult.conflicts.forEach(conflict => {
    const [tool, conflictingPlugin] = conflict.split(' conflicts with ');
    if (tool === 'jest' && conflictingPlugin === 'mocha') {
      suggestions.push('Consider using vitest for better performance');
    } else if (tool === 'webpack' && conflictingPlugin === 'vite') {
      suggestions.push('Consider migrating to Vite for faster builds');
    }
  });

  return suggestions;
};

// ============================================================================
// Browser Compatibility Detection
// ============================================================================

export interface BrowserCompatibility {
  speechRecognition: boolean;
  speechSynthesis: boolean;
  mediaRecorder: boolean;
  localStorage: boolean;
  fileAPI: boolean;
  unsupportedFeatures: string[];
  compatibilityScore: number;
}

/**
 * Detect browser compatibility for Web APIs
 */
export const detectBrowserCompatibility = (): BrowserCompatibility => {
  const isBrowser = typeof window !== 'undefined';

  if (!isBrowser) {
    return {
      speechRecognition: false,
      speechSynthesis: false,
      mediaRecorder: false,
      localStorage: false,
      fileAPI: false,
      unsupportedFeatures: ['All browser APIs (SSR)'],
      compatibilityScore: 0,
    };
  }

  const unsupported: string[] = [];
  let supportedCount = 0;
  const totalFeatures = 5;

  // Speech Recognition
  const speechRecognition = 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
  if (!speechRecognition) {
    unsupported.push('Speech Recognition');
  } else {
    supportedCount++;
  }

  // Speech Synthesis
  const speechSynthesis = 'speechSynthesis' in window;
  if (!speechSynthesis) {
    unsupported.push('Speech Synthesis');
  } else {
    supportedCount++;
  }

  // Media Recorder
  const mediaRecorder = 'MediaRecorder' in window && 'mediaDevices' in navigator;
  if (!mediaRecorder) {
    unsupported.push('Media Recording');
  } else {
    supportedCount++;
  }

  // Local Storage
  const localStorage = (() => {
    try {
      return typeof window.localStorage !== 'undefined';
    } catch {
      return false;
    }
  })();
  if (!localStorage) {
    unsupported.push('Local Storage');
  } else {
    supportedCount++;
  }

  // File API
  const fileAPI = 'File' in window && 'FileReader' in window;
  if (!fileAPI) {
    unsupported.push('File API');
  } else {
    supportedCount++;
  }

  return {
    speechRecognition,
    speechSynthesis,
    mediaRecorder,
    localStorage,
    fileAPI,
    unsupportedFeatures: unsupported,
    compatibilityScore: Math.round((supportedCount / totalFeatures) * 100),
  };
};

/**
 * Get compatibility status message
 */
export const getCompatibilityStatusMessage = (compatibility: BrowserCompatibility): string => {
  if (compatibility.compatibilityScore === 100) {
    return 'Full browser support';
  } else if (compatibility.compatibilityScore >= 80) {
    return 'Good browser support';
  } else if (compatibility.compatibilityScore >= 60) {
    return 'Limited browser support';
  } else {
    return 'Poor browser support - some features unavailable';
  }
};
