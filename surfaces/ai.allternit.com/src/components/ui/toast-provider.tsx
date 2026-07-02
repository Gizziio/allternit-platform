/**
 * Global Toast Provider
 * Consolidates toast notifications across the application
 * Replaces the dual toast systems (use-toast.ts and ErrorBoundary.tsx)
 */

import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { X, CheckCircle, Warning, Info, WarningCircle } from '@phosphor-icons/react';

type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface Toast {
  id: string;
  title: string;
  description?: string;
  type: ToastType;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
  clearAll: () => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newToast: Toast = { ...toast, id };
    
    setToasts((prev) => [...prev, newToast]);
    
    // Auto-remove after duration (default 5s)
    const duration = toast.duration ?? 5000;
    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
    
    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setToasts([]);
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, clearAll }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}

// Toast Container Component
function ToastContainer({ 
  toasts, 
  onRemove 
}: { 
  toasts: Toast[]; 
  onRemove: (id: string) => void;
}) {
  useEffect(() => {
    // Inject keyframe animation safely on mount
    const id = 'toast-animations';
    if (document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.textContent = `
      @keyframes toast-slide-in {
        from { opacity: 0; transform: translateX(100%); }
        to { opacity: 1; transform: translateX(0); }
      }
    `;
    document.head.appendChild(style);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[190] flex flex-col gap-2 max-w-[400px]">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
}

// Individual Toast Item
function ToastItem({ 
  toast, 
  onRemove 
}: { 
  toast: Toast; 
  onRemove: (id: string) => void;
}) {
  const colors: Record<ToastType, { border: string; icon: string }> = {
    info: { border: 'border-blue-500/30', icon: 'text-blue-500' },
    success: { border: 'border-green-500/30', icon: 'text-green-500' },
    warning: { border: 'border-amber-500/30', icon: 'text-amber-500' },
    error: { border: 'border-red-500/30', icon: 'text-red-500' },
  };

  const { border, icon } = colors[toast.type];

  const icons: Record<ToastType, React.ReactNode> = {
    info: <Info size={20} className={icon} />,
    success: <CheckCircle size={20} className={icon} />,
    warning: <Warning size={20} className={icon} />,
    error: <WarningCircle size={20} className={icon} />,
  };

  return (
    <div className={cn(
      "bg-[var(--surface-panel)] border border-solid rounded-lg p-[12px_16px] shadow-[0_4px_12px_var(--surface-panel)] animate-[toast-slide-in_0.3s_ease-out] flex items-start gap-3",
      border
    )} style={{ borderLeftWidth: 4, borderLeftColor: `var(--status-${toast.type})` }}>
      <div className="shrink-0 mt-0.5">
        {icons[toast.type]}
      </div>
      <div className="flex-1 min-w-0">
        <div className={cn("text-[14px] font-medium text-white", toast.description ? "mb-1" : "mb-0")}>
          {toast.title}
        </div>
        {toast.description && (
          <div className="text-[13px] text-white/60 leading-relaxed">
            {toast.description}
          </div>
        )}
        {toast.action && (
          <button type="button"
            onClick={() => {
              toast.action?.onClick();
              onRemove(toast.id);
            }}
            className={cn(
              "mt-2 px-3 py-1 rounded border border-solid text-[12px] font-medium cursor-pointer transition-all",
              icon,
              border,
              "bg-white/5 hover:bg-white/10"
            )}
          >
            {toast.action.label}
          </button>
        )}
      </div>
      <button type="button"
        onClick={() => onRemove(toast.id)}
        className="shrink-0 bg-transparent border-none text-white/40 cursor-pointer p-1 text-[16px] leading-none hover:text-white transition-colors"
      >
        <X size={16} />
      </button>
    </div>
  );
}
