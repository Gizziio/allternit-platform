/**
 * Simple toast hook for notifications
 * Basic implementation - can be replaced with a full toast system later
 */

import { useState, useCallback } from 'react';

export interface ToastOptions {
  title: string;
  description?: string;
  variant?: 'default' | 'destructive';
}

export function useToast() {
  const [toasts, setToasts] = useState<ToastOptions[]>([]);

  const toast = useCallback((options: ToastOptions) => {
    // Simple console.log for now - can integrate with UI toast component
    if (options.variant === 'destructive') {
      console.error(`[Toast] ${options.title}: ${options.description}`);
    } else {
      console.log(`[Toast] ${options.title}: ${options.description}`);
    }
    
    // Add to state for potential UI rendering
    setToasts(prev => [...prev, options]);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t !== options));
    }, 5000);
  }, []);

  const dismiss = useCallback((index: number) => {
    setToasts(prev => prev.filter((_, i) => i !== index));
  }, []);

  return {
    toast,
    dismiss,
    toasts
  };
}
