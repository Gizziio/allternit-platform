/**
 * WIH: T2-A2
 * Agent: T2-A2 (Navigation System)
 * Scope: 6-ui/allternit-platform/src/shell/navigation/useShortcuts.ts
 * Acceptance: Keyboard shortcuts hook using react-hotkeys-hook, cross-platform support
 * Risk Tier: 2
 * Dependencies: react-hotkeys-hook, existing vendor/hotkeys.tsx
 */

import { useHotkeys as useReactHotkeys, Options as UseHotkeysOptions } from 'react-hotkeys-hook';
import { useCallback, useMemo } from 'react';

// Cross-platform modifier key detection
export const IS_MAC = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform || '');
export const IS_WINDOWS = typeof navigator !== 'undefined' && /win/i.test(navigator.platform || '');
export const IS_LINUX = typeof navigator !== 'undefined' && /linux/i.test(navigator.platform || '');

// Cross-platform key mapping
export function normalizeKey(key: string): string {
  const normalized = key.toLowerCase().trim();
  
  switch (normalized) {
    case 'mod':
      return IS_MAC ? 'meta' : 'ctrl';
    case 'cmd':
    case 'command':
      return 'meta';
    case 'opt':
    case 'option':
      return 'alt';
    case 'return':
      return 'enter';
    case 'esc':
      return 'escape';
    case 'up':
      return 'arrowup';
    case 'down':
      return 'arrowdown';
    case 'left':
      return 'arrowleft';
    case 'right':
      return 'arrowright';
    default:
      return normalized;
  }
}

// Convert shortcut array to hotkey string
export function shortcutToHotkey(shortcut: string[]): string {
  return shortcut.map(normalizeKey).join('+');
}

// Convert hotkey string to display format
export function formatShortcutForDisplay(shortcut: string[]): string {
  return shortcut.map((key) => {
    const normalized = key.toLowerCase();
    
    // Platform-specific display
    if (normalized === 'mod') {
      return IS_MAC ? '⌘' : 'Ctrl';
    }
    if (normalized === 'meta' || normalized === 'cmd' || normalized === 'command') {
      return IS_MAC ? '⌘' : '⊞';
    }
    if (normalized === 'shift') {
      return IS_MAC ? '⇧' : 'Shift';
    }
    if (normalized === 'alt' || normalized === 'opt' || normalized === 'option') {
      return IS_MAC ? '⌥' : 'Alt';
    }
    if (normalized === 'ctrl' || normalized === 'control') {
      return IS_MAC ? '⌃' : 'Ctrl';
    }
    
    // Capitalize single letters
    if (normalized.length === 1 && /[a-z]/.test(normalized)) {
      return normalized.toUpperCase();
    }
    
    return key;
  }).join(' ');
}

// Shortcut configuration interface
export interface ShortcutConfig {
  id: string;
  key: string;
  callback: () => void;
  description: string;
  category?: string;
  options?: {
    preventDefault?: boolean;
    enabled?: boolean;
    scopes?: string[];
  };
}

// Hook for multiple shortcuts
export function useShortcuts(configs: ShortcutConfig[]) {
  configs.forEach(({ key, callback, options }) => {
    useReactHotkeys(
      key,
      callback,
      {
        preventDefault: options?.preventDefault ?? true,
        enabled: options?.enabled ?? true,
        scopes: options?.scopes,
      }
    );
  });
}

// Hook for single shortcut
export function useShortcut(
  key: string | string[],
  callback: () => void,
  options?: {
    preventDefault?: boolean;
    enabled?: boolean;
    scopes?: string[];
  }
) {
  const hotkeyString = useMemo(() => {
    if (Array.isArray(key)) {
      // key is string[], where each element is a shortcut key (e.g., 'mod+k')
      return key.map((k) => shortcutToHotkey(k.split(' '))).join(',');
    }
    return shortcutToHotkey(key.split(' '));
  }, [key]);

  useReactHotkeys(
    hotkeyString,
    callback,
    {
      preventDefault: options?.preventDefault ?? true,
      enabled: options?.enabled ?? true,
      scopes: options?.scopes,
    }
  );
}

// Hook for sequential shortcuts (like 'g h' for go home)
export function useSequentialShortcut(
  keys: string[],
  callback: () => void,
  options?: {
    timeout?: number;
    enabled?: boolean;
  }
) {
  const normalizedKeys = useMemo(() => keys.map(normalizeKey), [keys]);
  const timeout = options?.timeout ?? 1000;

  // Use a ref-like approach with closure
  let currentIndex = 0;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const handleKeyPress = useCallback(
    (event: KeyboardEvent) => {
      if (options?.enabled === false) return;

      const pressedKey = normalizeKey(event.key);
      const expectedKey = normalizedKeys[currentIndex];

      if (pressedKey === expectedKey) {
        // Clear previous timeout
        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        currentIndex++;

        // If all keys matched
        if (currentIndex >= normalizedKeys.length) {
          currentIndex = 0;
          callback();
        } else {
          // Set timeout to reset sequence
          timeoutId = setTimeout(() => {
            currentIndex = 0;
          }, timeout);
        }
      } else {
        // Reset on wrong key
        currentIndex = 0;
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      }
    },
    [normalizedKeys, callback, timeout, options?.enabled]
  );

  // Register the handler
  useReactHotkeys(
    normalizedKeys.join(','),
    handleKeyPress,
    {
      preventDefault: true,
      enabled: options?.enabled ?? true,
    }
  );
}

// Create a shortcut scope manager
export interface ShortcutScope {
  name: string;
  shortcuts: ShortcutConfig[];
  enabled: boolean;
}

export function createShortcutScope(name: string, shortcuts: ShortcutConfig[]): ShortcutScope {
  return {
    name,
    shortcuts,
    enabled: true,
  };
}

// Hook to use shortcuts within a scope
export function useScopedShortcuts(scope: ShortcutScope, parentEnabled: boolean = true) {
  const enabled = scope.enabled && parentEnabled;

  useShortcuts(
    scope.shortcuts.map((config) => ({
      ...config,
      options: {
        ...config.options,
        enabled: (config.options?.enabled ?? true) && enabled,
      },
    }))
  );
}

// Utility to check if shortcut matches
export function matchesShortcut(event: KeyboardEvent, shortcut: string[]): boolean {
  const normalizedShortcut = shortcut.map(normalizeKey);
  const pressedKey = normalizeKey(event.key);
  const expectedKey = normalizedShortcut[normalizedShortcut.length - 1];

  if (pressedKey !== expectedKey) return false;

  // Check modifiers
  const hasMeta = normalizedShortcut.includes('meta');
  const hasCtrl = normalizedShortcut.includes('ctrl');
  const hasAlt = normalizedShortcut.includes('alt');
  const hasShift = normalizedShortcut.includes('shift');

  if (hasMeta !== event.metaKey) return false;
  if (hasCtrl !== event.ctrlKey) return false;
  if (hasAlt !== event.altKey) return false;
  if (hasShift !== event.shiftKey) return false;

  return true;
}

// Disable shortcuts when input is focused
export function shouldIgnoreShortcut(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement;
  
  // Ignore if inside input, textarea, or contenteditable
  if (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.isContentEditable
  ) {
    // Allow certain shortcuts even in inputs (like Escape)
    if (event.key === 'Escape') {
      return false;
    }
    return true;
  }

  return false;
}

// Safe shortcut hook that ignores inputs
export function useGlobalShortcut(
  key: string | string[],
  callback: () => void,
  options?: {
    preventDefault?: boolean;
    enabled?: boolean;
    allowInInputs?: boolean;
  }
) {
  const wrappedCallback = useCallback(
    (event: KeyboardEvent) => {
      if (!options?.allowInInputs && shouldIgnoreShortcut(event)) {
        return;
      }
      callback();
    },
    [callback, options?.allowInInputs]
  );

  useShortcut(key, wrappedCallback as () => void, {
    ...options,
    preventDefault: options?.preventDefault ?? true,
  });
}

// Re-export from react-hotkeys-hook for convenience
export type { UseHotkeysOptions };
export { useReactHotkeys };

// Default export
export default useShortcuts;
