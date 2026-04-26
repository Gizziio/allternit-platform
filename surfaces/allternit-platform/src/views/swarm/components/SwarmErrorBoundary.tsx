/**
 * SwarmErrorBoundary - Error boundary for SwarmMonitor
 * 
 * Catches errors in the swarm monitor component tree and displays
 * a fallback UI instead of crashing the entire app.
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Warning as WarningTriangle } from '@phosphor-icons/react';
import { TEXT, MODE_COLORS, STATUS, BACKGROUND } from '@/design/allternit.tokens';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class SwarmErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('SwarmMonitor Error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  public render() {
    if (this.state.hasError) {
      const modeColors = MODE_COLORS.code;
      
      return (
        <div 
          className="h-full flex flex-col items-center justify-center p-8"
          style={{ background: BACKGROUND.primary }}
        >
          <div 
            className="max-w-md w-full p-6 rounded-2xl border text-center"
            style={{ 
              background: '#ef44440d',
              borderColor: '#ef444433',
            }}
          >
            {/* Error Icon */}
            <div 
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: 'rgba(239,68,68,0.18)' }}
            >
              <WarningTriangle size={28} color={STATUS.error} weight="duotone" />
            </div>

            {/* Title */}
            <h2 
              className="text-lg font-bold mb-2"
              style={{ color: TEXT.primary }}
            >
              Swarm Monitor Error
            </h2>

            {/* Message */}
            <p 
              className="text-sm mb-4"
              style={{ color: TEXT.secondary }}
            >
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>

            {/* Error Details (collapsible) */}
            {this.state.errorInfo && (
              <details className="mb-4 text-left">
                <summary 
                  className="text-xs cursor-pointer mb-2"
                  style={{ color: TEXT.tertiary }}
                >
                  Technical Details
                </summary>
                <pre 
                  className="p-3 rounded-lg text-xs overflow-auto max-h-40"
                  style={{ 
                    background: 'rgba(0,0,0,0.3)',
                    color: TEXT.secondary,
                  }}
                >
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}

            {/* Actions */}
            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleReset}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-80"
                style={{ 
                  background: 'rgba(255,255,255,0.05)',
                  color: TEXT.secondary,
                }}
              >
                Try Again
              </button>
              <button
                onClick={this.handleReload}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-80"
                style={{ 
                  background: `${modeColors.accent}20`,
                  color: modeColors.accent,
                }}
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
