/**
 * Error Boundary Component
 * 
 * Catches errors in visual verification components and displays
 * a fallback UI instead of crashing the entire application.
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class VisualVerificationErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[VisualVerificationErrorBoundary]', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div style={{
          padding: '24px',
          background: 'var(--surface-panel)',
          border: '1px solid #333',
          borderRadius: '12px',
          color: '#fff',
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px',
            marginBottom: '16px',
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'rgba(239, 68, 68, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
            }}>
              ⚠️
            </div>
            <div>
              <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 600 }}>
                Visual Verification Error
              </h3>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--ui-text-muted)' }}>
                Something went wrong displaying verification data
              </p>
            </div>
          </div>
          
          {this.state.error && (
            <div style={{
              padding: '12px 16px',
              background: 'var(--surface-panel)',
              borderRadius: '8px',
              marginBottom: '16px',
              fontFamily: 'monospace',
              fontSize: '12px',
              color: 'var(--status-error)',
            }}>
              {this.state.error.message}
            </div>
          )}

          <button
            onClick={this.handleReset}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              background: 'var(--status-info)',
              color: '#fff',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default VisualVerificationErrorBoundary;
