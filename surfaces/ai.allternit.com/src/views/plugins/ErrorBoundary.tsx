/**
 * Error Boundary
 * 
 * Catches and displays errors in the PluginManager with a graceful UI.
 */

import React, { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  onClose?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

const THEME = {
  bg: 'var(--surface-canvas)',
  textPrimary: 'var(--ui-text-primary)',
  textSecondary: 'var(--ui-text-secondary)',
  textTertiary: 'var(--ui-text-muted)',
  accent: 'var(--accent-primary)',
  danger: 'var(--status-error)',
  border: 'rgba(212, 176, 140, 0.1)',
};

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ error, errorInfo });
    console.error('[PluginManager ErrorBoundary]', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          style={{
            position: 'fixed',
            top: 80,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: THEME.bg,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 40,
            zIndex: 100,
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 24,
            }}
          >
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke={THEME.danger}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>

          <h2
            style={{
              fontSize: 20,
              fontWeight: 600,
              color: THEME.textPrimary,
              margin: '0 0 8px 0',
            }}
          >
            Something went wrong
          </h2>

          <p
            style={{
              fontSize: 14,
              color: THEME.textSecondary,
              margin: '0 0 24px 0',
              textAlign: 'center',
              maxWidth: 400,
            }}
          >
            The PluginManager encountered an error. You can try refreshing or restart the application.
          </p>

          {this.state.error && (
            <div
              style={{
                backgroundColor: 'var(--surface-panel)',
                border: `1px solid ${THEME.border}`,
                borderRadius: 8,
                padding: 16,
                marginBottom: 24,
                maxWidth: 600,
                width: '100%',
                overflow: 'auto',
              }}
            >
              <code
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  color: THEME.danger,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {this.state.error.toString()}
              </code>
              {this.state.errorInfo && (
                <pre
                  style={{
                    marginTop: 12,
                    paddingTop: 12,
                    borderTop: `1px solid ${THEME.border}`,
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    color: THEME.textTertiary,
                    whiteSpace: 'pre-wrap',
                    maxHeight: 200,
                    overflow: 'auto',
                  }}
                >
                  {this.state.errorInfo.componentStack}
                </pre>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={this.handleRetry}
              style={{
                padding: '10px 20px',
                borderRadius: 8,
                border: `1px solid ${THEME.border}`,
                backgroundColor: 'transparent',
                color: THEME.textSecondary,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              Try Again
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '10px 20px',
                borderRadius: 8,
                border: 'none',
                backgroundColor: THEME.accent,
                color: 'var(--ui-text-inverse)',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

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
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 180,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          style={{
            padding: '12px 16px',
            borderRadius: 8,
            backgroundColor: toast.type === 'error' ? 'rgba(239, 68, 68, 0.15)' : 
                             toast.type === 'warning' ? 'rgba(251, 191, 36, 0.15)' : 
                             'rgba(96, 165, 250, 0.15)',
            border: `1px solid ${toast.type === 'error' ? 'rgba(239, 68, 68, 0.3)' : 
                                  toast.type === 'warning' ? 'rgba(251, 191, 36, 0.3)' : 
                                  'rgba(96, 165, 250, 0.3)'}`,
            color: toast.type === 'error' ? 'var(--status-error)' : 
                   toast.type === 'warning' ? '#fcd34d' : 
                   '#93c5fd',
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            minWidth: 280,
            maxWidth: 400,
            animation: 'slideIn 0.2s ease-out',
          }}
        >
          <span style={{ flex: 1 }}>{toast.message}</span>
          <button
            onClick={() => onDismiss(toast.id)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'inherit',
              cursor: 'pointer',
              padding: 4,
              fontSize: 16,
              opacity: 0.7,
            }}
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
