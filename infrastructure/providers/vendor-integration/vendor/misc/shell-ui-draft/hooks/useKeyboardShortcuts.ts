import { useEffect, useCallback } from 'react';

export type AppMode = 'chat' | 'cowork' | 'code' | 'workflows' | 'agent-mail' | 'skills' | 'admin';

interface KeyboardShortcutsOptions {
  onModeChange?: (mode: AppMode) => void;
  onToggleDrawer?: () => void;
  onCloseOverlay?: () => void;
  isDrawerOpen?: boolean;
  hasOpenOverlay?: boolean;
}

/**
 * Hook for managing keyboard shortcuts in the Allternit Shell
 *
 * Shortcuts:
 * - Cmd/Ctrl+1 → Chat mode
 * - Cmd/Ctrl+2 → Cowork mode
 * - Cmd/Ctrl+3 → Code mode
 * - Cmd/Ctrl+4 → Workflows mode
 * - Cmd/Ctrl+5 → Agent Mail mode
 * - Cmd/Ctrl+K → Toggle ToolDrawer
 * - Esc → Close any overlay
 */
export const useKeyboardShortcuts = ({
  onModeChange,
  onToggleDrawer,
  onCloseOverlay,
  isDrawerOpen = false,
  hasOpenOverlay = false,
}: KeyboardShortcutsOptions) => {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const { key, metaKey, ctrlKey } = event;
      const isModifierPressed = metaKey || ctrlKey;

      if (isModifierPressed) {
        switch (key) {
          case '1':
            event.preventDefault();
            onModeChange?.('chat');
            return;
          case '2':
            event.preventDefault();
            onModeChange?.('cowork');
            return;
          case '3':
            event.preventDefault();
            onModeChange?.('code');
            return;
          case '4':
            event.preventDefault();
            onModeChange?.('workflows');
            return;
          case '5':
            event.preventDefault();
            onModeChange?.('agent-mail');
            return;
          case '6':
            event.preventDefault();
            onModeChange?.('skills');
            return;
          case '7':
            event.preventDefault();
            onModeChange?.('admin');
            return;
          case 'k':
          case 'K':
            event.preventDefault();
            onToggleDrawer?.();
            return;
        }
      }

      if (key === 'Escape') {
        if (hasOpenOverlay || isDrawerOpen) {
          event.preventDefault();
          onCloseOverlay?.();
        }
      }
    },
    [onModeChange, onToggleDrawer, onCloseOverlay, isDrawerOpen, hasOpenOverlay]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);
};

/**
 * Hook for managing just the mode switching shortcuts
 */
export const useModeShortcuts = (onModeChange: (mode: AppMode) => void) => {
  useKeyboardShortcuts({ onModeChange });
};

/**
 * Hook for managing the drawer toggle shortcut
 */
export const useDrawerShortcut = (onToggle: () => void) => {
  useKeyboardShortcuts({ onToggleDrawer: onToggle });
};

/**
 * Hook for managing escape key to close overlays
 */
export const useEscapeKey = (onClose: () => void, isActive: boolean) => {
  useKeyboardShortcuts({
    onCloseOverlay: onClose,
    hasOpenOverlay: isActive,
  });
};

export default useKeyboardShortcuts;
