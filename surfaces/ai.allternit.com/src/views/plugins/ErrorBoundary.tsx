/**
 * Error Boundary
 * 
 * Catches and displays errors in the PluginManager with a graceful UI.
 */

"use client";

import { ErrorBoundary } from '@/components/error-boundary';

export { ErrorBoundary };

// ============================================================================
// Error Toast Component
// ============================================================================

import { useState, useCallback } from 'react';

export interface ErrorToast {
  id: string;
  message: string;
  type: 'error' | 'warning' | 'info';
}

export function useErrorToast() {
  const [toasts, setToasts] = useState<ErrorToast[]>([]);

  const showError = useCallback((message: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, message, type: 'error' }]);
    
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const showWarning = useCallback((message: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, message, type: 'warning' }]);
    
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const showInfo = useCallback((message: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, message, type: 'info' }]);
    
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return {
    toasts,
    showError,
    showWarning,
    showInfo,
    dismissToast,
  };
}

interface ErrorToastContainerProps {
  toasts: ErrorToast[];
  onDismiss: (id: string) => void;
}

export function ErrorToastContainer({ toasts, onDismiss }: ErrorToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-6 right-6 z-[180] flex flex-col gap-2"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`
            p-3 px-4 rounded-lg border border-solid flex items-center gap-3 min-w-[280px] max-w-[400px] animate-[slideIn_0.2s_ease-out]
            ${toast.type === 'error' ? 'bg-[rgba(239,68,68,0.15)] border-[rgba(239,68,68,0.3)] text-[var(--status-error)]' : 
              toast.type === 'warning' ? 'bg-[rgba(251,191,36,0.15)] border-[rgba(251,191,36,0.3)] text-[#fcd34d]' : 
              'bg-[rgba(96,165,250,0.15)] border-[rgba(96,165,250,0.3)] text-[#93c5fd]'}
            text-[13px]
          `}
        >
          <span className="flex-1">{toast.message}</span>
          <button type="button"
            onClick={() => onDismiss(toast.id)}
            className="bg-transparent border-none text-inherit cursor-pointer p-1 text-[16px] opacity-70"
          >
            ×
          </button>
        </div>
      ))}
      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
