/**
 * Keyboard Shortcuts Hook for Agent Creation Wizard
 *
 * Provides keyboard shortcut functionality for the wizard.
 *
 * @module hooks/use-wizard-shortcuts
 * @version 1.0.0
 */

import { useEffect, useCallback, useRef } from 'react';

/**
 * Keyboard shortcut configuration
 */
export interface ShortcutConfig {
  /** Shortcut key combination (e.g., 'ctrl+s', 'cmd+enter') */
  keys: string;
  /** Action to perform */
  action: () => void;
  /** Description for help display */
  description: string;
  /** Prevent default browser behavior */
  preventDefault?: boolean;
  /** Only trigger when focused on input elements */
  allowInInput?: boolean;
  /** Disable shortcut */
  disabled?: boolean;
}

/**
 * Available keyboard shortcuts
 */
export const WIZARD_SHORTCUTS: Record<string, ShortcutConfig> = {
  saveDraft: {
    keys: 'ctrl+s,cmd+s',
    action: () => {},
    description: 'Save Draft',
    preventDefault: true,
    allowInInput: true,
  },
  nextStep: {
    keys: 'ctrl+enter,cmd+enter',
    action: () => {},
    description: 'Next Step',
    preventDefault: true,
  },
  previousStep: {
    keys: 'ctrl+shift+enter,cmd+shift+enter',
    action: () => {},
    description: 'Previous Step',
    preventDefault: true,
  },
  closeModal: {
    keys: 'escape',
    action: () => {},
    description: 'Close Modal/Panel',
    preventDefault: false,
  },
  toggleHelp: {
    keys: 'f1,ctrl+h,cmd+h',
    action: () => {},
    description: 'Toggle Help Panel',
    preventDefault: true,
  },
  search: {
    keys: 'ctrl+f,cmd+f',
    action: () => {},
    description: 'Search',
    preventDefault: true,
    allowInInput: true,
  },
  undo: {
    keys: 'ctrl+z,cmd+z',
    action: () => {},
    description: 'Undo',
    preventDefault: true,
    allowInInput: true,
  },
  redo: {
    keys: 'ctrl+shift+z,cmd+shift+z,ctrl+y,cmd+y',
    action: () => {},
    description: 'Redo',
    preventDefault: true,
    allowInInput: true,
  },
  exportConfig: {
    keys: 'ctrl+e,cmd+e',
    action: () => {},
    description: 'Export Configuration',
    preventDefault: true,
  },
  importConfig: {
    keys: 'ctrl+i,cmd+i',
    action: () => {},
    description: 'Import Configuration',
    preventDefault: true,
  },
};

/**
 * Parse keyboard shortcut string into normalized format
 */
function parseShortcut(shortcut: string): { key: string; ctrl: boolean; shift: boolean; alt: boolean; cmd: boolean } {
  const parts = shortcut.toLowerCase().split('+');
  return {
    key: parts[parts.length - 1],
    ctrl: parts.includes('ctrl'),
    shift: parts.includes('shift'),
    alt: parts.includes('alt'),
    cmd: parts.includes('cmd') || parts.includes('meta'),
  };
}

/**
 * Check if event matches shortcut configuration
 */
function matchesShortcut(event: KeyboardEvent, shortcut: string): boolean {
  const parsed = parseShortcut(shortcut);

  // Check modifier keys
  const isCtrlOrCmd = event.ctrlKey || event.metaKey;

  if (parsed.ctrl && !isCtrlOrCmd) return false;
  if (parsed.cmd && !event.metaKey) return false;
  if (parsed.shift && !event.shiftKey) return false;
  if (parsed.alt && !event.altKey) return false;

  // Check main key
  const eventKey = event.key.toLowerCase();
  const parsedKey = parsed.key;

  // Handle special keys
  if (parsedKey === 'escape' && event.key === 'Escape') return true;
  if (parsedKey === 'enter' && (event.key === 'Enter' || event.key === 'Return')) return true;
  if (parsedKey === 'f1' && event.key === 'F1') return true;

  // Handle regular keys
  if (parsedKey.length === 1 && eventKey === parsedKey) return true;

  return false;
}

/**
 * Hook options
 */
export interface UseShortcutsOptions {
  /** Enable/disable all shortcuts */
  enabled?: boolean;
  /** Global event handlers */
  onSaveDraft?: () => void;
  onNextStep?: () => void;
  onPreviousStep?: () => void;
  onCloseModal?: () => void;
  onToggleHelp?: () => void;
  onSearch?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onExportConfig?: () => void;
  onImportConfig?: () => void;
  /** Custom shortcuts */
  customShortcuts?: ShortcutConfig[];
  /** Disable specific shortcuts */
  disabledShortcuts?: string[];
}

/**
 * Keyboard shortcuts hook return type
 */
export interface UseShortcutsReturn {
  /** Register a custom shortcut */
  registerShortcut: (config: ShortcutConfig) => void;
  /** Unregister a shortcut */
  unregisterShortcut: (keys: string) => void;
  /** Check if a specific shortcut is enabled */
  isShortcutEnabled: (shortcutName: string) => boolean;
  /** Enable/disable a specific shortcut */
  setShortcutEnabled: (shortcutName: string, enabled: boolean) => void;
  /** Get all available shortcuts for display */
  getAvailableShortcuts: () => Array<{ name: string; keys: string; description: string; enabled: boolean }>;
}

/**
 * Use Keyboard Shortcuts Hook
 *
 * Provides keyboard shortcut functionality for the wizard.
 *
 * @example
 * ```tsx
 * function WizardComponent() {
 *   const shortcuts = useWizardShortcuts({
 *     onSaveDraft: handleSaveDraft,
 *     onNextStep: handleNextStep,
 *     onCloseModal: handleCloseModal,
 *   });
 *
 *   return (
 *     <div>
 *       <KeyboardShortcutsPanel shortcuts={shortcuts.getAvailableShortcuts()} />
 *     </div>
 *   );
 * }
 * ```
 */
export function useWizardShortcuts(options: UseShortcutsOptions = {}): UseShortcutsReturn {
  const {
    enabled = true,
    onSaveDraft,
    onNextStep,
    onPreviousStep,
    onCloseModal,
    onToggleHelp,
    onSearch,
    onUndo,
    onRedo,
    onExportConfig,
    onImportConfig,
    customShortcuts = [],
    disabledShortcuts = [],
  } = options;

  const customShortcutsRef = useRef<Map<string, ShortcutConfig>>(new Map());
  const enabledShortcutsRef = useRef<Set<string>>(new Set(disabledShortcuts.map((s) => s.toLowerCase())));

  // Update custom shortcuts
  const registerShortcut = useCallback((config: ShortcutConfig) => {
    customShortcutsRef.current.set(config.keys, config);
  }, []);

  const unregisterShortcut = useCallback((keys: string) => {
    customShortcutsRef.current.delete(keys);
  }, []);

  const isShortcutEnabled = useCallback((shortcutName: string): boolean => {
    return !enabledShortcutsRef.current.has(shortcutName.toLowerCase());
  }, []);

  const setShortcutEnabled = useCallback((shortcutName: string, enabled: boolean) => {
    const name = shortcutName.toLowerCase();
    if (enabled) {
      enabledShortcutsRef.current.delete(name);
    } else {
      enabledShortcutsRef.current.add(name);
    }
  }, []);

  const getAvailableShortcuts = useCallback(() => {
    const shortcuts: Array<{ name: string; keys: string; description: string; enabled: boolean }> = [];

    // Add built-in shortcuts
    Object.entries(WIZARD_SHORTCUTS).forEach(([name, config]) => {
      shortcuts.push({
        name,
        keys: config.keys,
        description: config.description,
        enabled: !enabledShortcutsRef.current.has(name.toLowerCase()),
      });
    });

    // Add custom shortcuts
    customShortcutsRef.current.forEach((config, keys) => {
      shortcuts.push({
        name: `custom_${keys}`,
        keys,
        description: config.description,
        enabled: true,
      });
    });

    return shortcuts;
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent): void => {
      // Check if we're in an input element
      const target = event.target as HTMLElement;
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable;

      // Check all built-in shortcuts
      const checkShortcut = (name: string, config: ShortcutConfig, handler?: () => void): boolean => {
        if (!handler) return false;
        if (disabledShortcuts.includes(name.toLowerCase())) return false;

        // Check if shortcut allows input
        if (isInput && !config.allowInInput) return false;

        // Check if keys match
        const keys = config.keys.split(',');
        for (const key of keys) {
          if (matchesShortcut(event, key)) {
            if (config.preventDefault) {
              event.preventDefault();
            }
            handler();
            return true;
          }
        }
        return false;
      };

      // Check built-in shortcuts
      if (checkShortcut('saveDraft', WIZARD_SHORTCUTS.saveDraft, onSaveDraft)) return;
      if (checkShortcut('nextStep', WIZARD_SHORTCUTS.nextStep, onNextStep)) return;
      if (checkShortcut('previousStep', WIZARD_SHORTCUTS.previousStep, onPreviousStep)) return;
      if (checkShortcut('closeModal', WIZARD_SHORTCUTS.closeModal, onCloseModal)) return;
      if (checkShortcut('toggleHelp', WIZARD_SHORTCUTS.toggleHelp, onToggleHelp)) return;
      if (checkShortcut('search', WIZARD_SHORTCUTS.search, onSearch)) return;
      if (checkShortcut('undo', WIZARD_SHORTCUTS.undo, onUndo)) return;
      if (checkShortcut('redo', WIZARD_SHORTCUTS.redo, onRedo)) return;
      if (checkShortcut('exportConfig', WIZARD_SHORTCUTS.exportConfig, onExportConfig)) return;
      if (checkShortcut('importConfig', WIZARD_SHORTCUTS.importConfig, onImportConfig)) return;

      // Check custom shortcuts
      customShortcutsRef.current.forEach((config) => {
        if (disabledShortcuts.some((ds) => config.keys.toLowerCase().includes(ds))) return;
        if (isInput && !config.allowInInput) return;

        const keys = config.keys.split(',');
        for (const key of keys) {
          if (matchesShortcut(event, key)) {
            if (config.preventDefault) {
              event.preventDefault();
            }
            config.action();
            return;
          }
        }
      });
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    enabled,
    onSaveDraft,
    onNextStep,
    onPreviousStep,
    onCloseModal,
    onToggleHelp,
    onSearch,
    onUndo,
    onRedo,
    onExportConfig,
    onImportConfig,
    disabledShortcuts,
  ]);

  return {
    registerShortcut,
    unregisterShortcut,
    isShortcutEnabled,
    setShortcutEnabled,
    getAvailableShortcuts,
  };
}

/**
 * Format shortcut for display
 */
export function formatShortcutForDisplay(keys: string): string {
  const isMac = typeof navigator !== 'undefined' && navigator.platform.includes('Mac');

  return keys
    .split(',')
    .map((key) => {
      return key
        .toLowerCase()
        .replace('ctrl', isMac ? '⌃' : 'Ctrl')
        .replace('cmd', isMac ? '⌘' : 'Cmd')
        .replace('meta', isMac ? '⌘' : 'Win')
        .replace('shift', isMac ? '⇧' : 'Shift')
        .replace('alt', isMac ? '⌥' : 'Alt')
        .replace('enter', '↵')
        .replace('escape', 'Esc')
        .replace(' ', '+');
    })
    .join(' or ');
}

/**
 * Get platform-specific shortcut label
 */
export function getPlatformShortcutLabel(shortcutName: string): string {
  const config = WIZARD_SHORTCUTS[shortcutName];
  if (!config) return '';
  return formatShortcutForDisplay(config.keys);
}
