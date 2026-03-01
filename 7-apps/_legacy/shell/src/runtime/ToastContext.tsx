import * as React from 'react';
import { Toast } from '../components/Toast';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'info' | 'warn' | 'error';
  duration: number;
  actionLabel?: string;
  onAction?: () => void;
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (
    message: string,
    type: 'success' | 'info' | 'warn' | 'error',
    duration?: number,
    options?: { actionLabel?: string; onAction?: () => void }
  ) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | undefined>(undefined);

export const useToasts = (): ToastContextValue => {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error('useToasts must be used within ToastProvider');
  }
  return context;
};

interface ToastProviderProps {
  children: React.ReactNode;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const [nextId, setNextId] = React.useState(0);

  const addToast = React.useCallback((
    message: string,
    type: 'success' | 'info' | 'warn' | 'error',
    duration = 5000,
    options?: { actionLabel?: string; onAction?: () => void }
  ) => {
    const id = `toast-${nextId}`;
    setNextId(prev => prev + 1);
    setToasts(prev => [...prev, { id, message, type, duration, ...options }]);
  }, [nextId]);

  const dismissToast = React.useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const value: ToastContextValue = {
    toasts,
    addToast,
    dismissToast,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-container">
        {toasts.map(toast => (
          <Toast key={toast.id} {...toast} onClose={dismissToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};
