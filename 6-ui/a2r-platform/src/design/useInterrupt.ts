/**
 * useInterrupt Hook
 * 
 * Provides interrupt/cancel functionality for streaming operations.
 * Tracks pending interrupt state for double-press patterns.
 */

import { useState, useCallback } from 'react';

export interface UseInterruptReturn {
  pending: boolean;
  trigger: () => void;
  reset: () => void;
}

export function useInterrupt(): UseInterruptReturn {
  const [pending, setPending] = useState(false);
  
  const trigger = useCallback(() => {
    setPending(true);
    // Auto-reset after 2 seconds (double-press window)
    setTimeout(() => setPending(false), 2000);
  }, []);
  
  const reset = useCallback(() => {
    setPending(false);
  }, []);
  
  return { pending, trigger, reset };
}

export default useInterrupt;
