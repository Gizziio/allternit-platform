/**
 * Keyboard Shortcuts Hook
 * 
 * Provides keyboard navigation for the PluginManager:
 * - Cmd/Ctrl+W: Close
 * - Cmd/Ctrl+F: Focus search
 * - Arrow keys: Navigate file tree
 * - Enter: Toggle enabled state
 * - Escape: Close overlays/menus
 */

import { useCallback, useRef } from 'react';

export interface KeyboardShortcutsOptions {
  isOpen: boolean;
  onClose: () => void;
  onFocusSearch: () => void;
  onNavigateUp: () => void;
  onNavigateDown: () => void;
  onNavigateLeft: () => void;
  onNavigateRight: () => void;
  onEnter: () => void;
  onEscape: () => void;
  onCreateNew: () => void;
  onSave: () => void;
}

export function useKeyboardShortcuts(options: KeyboardShortcutsOptions) {
  const { isOpen } = options;

  const handlersRef = useRef(options);
  handlersRef.current = options;

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const { isOpen, onClose, onFocusSearch, onNavigateUp, onNavigateDown, onNavigateLeft, onNavigateRight, onEnter, onEscape, onCreateNew, onSave } = handlersRef.current;
      
      if (!isOpen) return;

      const isMod = e.metaKey || e.ctrlKey;

      // Cmd/Ctrl+W - Close
      if (isMod && e.key === 'w') {
        e.preventDefault();
        onClose();
        return;
      }

      // Cmd/Ctrl+F - Focus search
      if (isMod && e.key === 'f') {
        e.preventDefault();
        onFocusSearch();
        return;
      }

      // Cmd/Ctrl+N - Create new
      if (isMod && e.key === 'n') {
        e.preventDefault();
        onCreateNew();
        return;
      }

      // Cmd/Ctrl+S - Save
      if (isMod && e.key === 's') {
        e.preventDefault();
        onSave();
        return;
      }

      // Escape - Close overlays/menus
      if (e.key === 'Escape') {
        onEscape();
        return;
      }

      // Arrow keys - Navigation (only if not in an input)
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      
      if (!isInput) {
        switch (e.key) {
          case 'ArrowUp':
            e.preventDefault();
            onNavigateUp();
            break;
          case 'ArrowDown':
            e.preventDefault();
            onNavigateDown();
            break;
          case 'ArrowLeft':
            e.preventDefault();
            onNavigateLeft();
            break;
          case 'ArrowRight':
            e.preventDefault();
            onNavigateRight();
            break;
          case 'Enter':
            e.preventDefault();
            onEnter();
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [isOpen]);
}

// ============================================================================
// Search Debounce Hook
// ============================================================================

export function useDebouncedValue<T>(value: T, delay: number = 200): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

import { useState, useEffect } from 'react';

// ============================================================================
// Focus Management Hook
// ============================================================================

export function useFocusManager() {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const focusSearch = useCallback(() => {
    searchInputRef.current?.focus();
  }, []);

  return {
    searchInputRef,
    listRef,
    focusSearch,
  };
}
