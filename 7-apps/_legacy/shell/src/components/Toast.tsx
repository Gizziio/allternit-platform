import * as React from 'react';

interface ToastProps {
  id: string;
  message: string;
  type: 'success' | 'info' | 'warn' | 'error';
  duration: number;
  actionLabel?: string;
  onAction?: () => void;
  onClose?: () => void;
}

export const Toast: React.FC<ToastProps> = ({
  id,
  message,
  type,
  duration,
  actionLabel,
  onAction,
  onClose,
}) => {
  const [isVisible, setIsVisible] = React.useState(true);
  const [timeRemaining, setTimeRemaining] = React.useState(duration);

  const dismissToast = React.useCallback(() => {
    setIsVisible(false);
    setTimeout(() => onClose?.(), 300);
  }, [onClose]);

  React.useEffect(() => {
    if (timeRemaining > 0) {
      const timer = setTimeout(() => {
        dismissToast();
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [dismissToast, timeRemaining]);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setTimeRemaining(prev => Math.max(0, prev - 100));
    }, 100);

    return () => clearInterval(interval);
  }, []);

  const getTypeColor = (t: string): string => {
    switch (t) {
      case 'success': return '#10b981';
      case 'info': return '#3b82f6';
      case 'warn': return '#f59e0b';
      case 'error': return '#dc2626';
      default: return '#6b7280';
    }
  };

  const getTypeIcon = (t: string): string => {
    switch (t) {
      case 'success': return '✓';
      case 'info': return 'ℹ️';
      case 'warn': return '⚠️';
      case 'error': return '✕';
      default: return '•';
    }
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className={`toast toast-${type}`} style={{ '--toast-duration': `${duration}ms` }}>
      <div className="toast-icon" style={{ '--toast-color': getTypeColor(type) }}>
        {getTypeIcon(type)}
      </div>
      <div className="toast-content">
        {message}
      </div>
      {actionLabel && onAction && (
        <button
          className="toast-action"
          onClick={() => {
            onAction();
            dismissToast();
          }}
          type="button"
        >
          {actionLabel}
        </button>
      )}
      {onClose && (
        <button className="toast-close" onClick={dismissToast} aria-label="Close" type="button">
          ×
        </button>
      )}
    </div>
  );
};
