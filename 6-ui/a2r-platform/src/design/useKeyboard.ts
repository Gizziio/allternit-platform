/**
 * useKeyboard Hook
 * 
 * Keyboard shortcut handling for the A2R platform.
 */

import { useEffect, useCallback } from 'react';

export type KeyHandler = (event: KeyboardEvent) => void;

export interface UseKeyboardOptions {
  key: string;
  meta?: boolean;
  ctrl?: boolean;
  shift?: boolean;
  preventDefault?: boolean;
}

export function useKeyboard(
  options: UseKeyboardOptions,
  handler: KeyHandler
): void {
  const { key, meta, ctrl, shift, preventDefault = true } = options;
  
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (
      event.key === key &&
      (!meta || event.metaKey) &&
      (!ctrl || event.ctrlKey) &&
      (!shift || event.shiftKey)
    ) {
      if (preventDefault) event.preventDefault();
      handler(event);
    }
  }, [key, meta, ctrl, shift, preventDefault, handler]);
  
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

export default useKeyboard;
