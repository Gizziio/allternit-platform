"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import {
  Warning,
  ArrowsClockwise,
  House,
  CaretRight,
} from '@phosphor-icons/react';
import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

interface ErrorBoundaryProps {
  /** Content to render */
  children: ReactNode;
  /** Custom fallback UI (overrides default) */
  fallback?: ReactNode;
  /** Callback when error is caught */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Callback when user clicks retry */
  onReset?: () => void;
  /** Component name for error tracking */
  componentName?: string;
  /** Whether to show detailed error info */
  showDetails?: boolean;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

// ============================================================================
// Error Boundary Component
// ============================================================================

/**
 * ErrorBoundary - Catch JavaScript errors anywhere in child component tree
 * 
 * Features:
 * - Graceful error fallback UI
 * - Error reporting callbacks
 * - Reset/retry functionality
 * - Detailed error info (optional)
 * 
 * @example
 * <ErrorBoundary componentName="ChatView" onError={logError}>
 *   <ChatView />
 * </ErrorBoundary>
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[ErrorBoundary${this.props.componentName ? `:${this.props.componentName}` : ''}] Error:`, error);
    console.error(`[ErrorBoundary${this.props.componentName ? `:${this.props.componentName}` : ''}] Component stack:`, errorInfo.componentStack);
    
    this.setState({ errorInfo });
    this.props.onError?.(error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
    this.props.onReset?.();
  };

  public render() {
    if (this.state.hasError) {
      // Custom fallback takes precedence
      if (this.props.fallback) {
        // Pass error props to the fallback element if it's a valid React element
        if (React.isValidElement(this.props.fallback)) {
          return React.cloneElement(this.props.fallback as React.ReactElement<any>, {
            error: this.state.error,
            errorInfo: this.state.errorInfo,
          });
        }
        return this.props.fallback;
      }

      return (
        <ErrorFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          componentName={this.props.componentName}
          showDetails={this.props.showDetails}
          onReset={this.handleReset}
        />
      );
    }

    return this.props.children;
  }
}

// ============================================================================
// Error Fallback UI
// ============================================================================

interface ErrorFallbackProps {
  error?: Error;
  errorInfo?: ErrorInfo;
  componentName?: string;
  showDetails?: boolean;
  onReset?: () => void;
}

/**
 * ErrorFallback - Beautiful error display with retry options
 */
function ErrorFallback({
  error,
  errorInfo,
  componentName,
  showDetails = process.env.NODE_ENV === 'development',
  onReset,
}: ErrorFallbackProps) {
  const [showStack, setShowStack] = React.useState(false);

  return (
    <div 
      className={cn(
        "flex flex-col items-center justify-center",
        "min-h-[200px] p-6 m-4",
        "rounded-2xl border",
        "bg-[var(--status-error-bg)] border-[var(--status-error)]/30",
        "animate-fade-in"
      )}
      role="alert"
      aria-live="assertive"
    >
      {/* Icon */}
      <div className="w-12 h-12 rounded-full bg-[var(--status-error)]/20 flex items-center justify-center mb-4">
        <Warning className="w-6 h-6 text-[var(--status-error)]" />
      </div>

      {/* Title */}
      <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
        Something went wrong
      </h2>

      {/* Description */}
      <p className="text-sm text-[var(--text-secondary)] text-center max-w-md mb-6">
        {componentName 
          ? `We encountered an error in the ${componentName} component.`
          : "We encountered an unexpected error."
        }{" "}
        {onReset 
          ? "You can try resetting the component to recover."
          : "Please refresh the page to continue."
        }
      </p>

      {/* Error Message */}
      {error?.message && (
        <div className="w-full max-w-md mb-4 p-3 rounded-lg bg-[var(--bg-secondary)]/50 border border-[var(--border-subtle)]">
          <p className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
            Error Message
          </p>
          <p className="text-sm text-[var(--text-primary)] font-mono break-words">
            {error.message}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        {onReset && (
          <button
            onClick={onReset}
            className={cn(
              "inline-flex items-center gap-2 px-4 py-2",
              "rounded-lg text-sm font-medium",
              "bg-[var(--status-error)] text-white",
              "hover:bg-[var(--status-error)]/90",
              "transition-all duration-200",
              "focus:outline-none focus:ring-2 focus:ring-[var(--status-error)]/50"
            )}
          >
            <ArrowsClockwise size={16} />
            Try Again
          </button>
        )}
        
        <button
          onClick={() => window.location.reload()}
          className={cn(
            "inline-flex items-center gap-2 px-4 py-2",
            "rounded-lg text-sm font-medium",
            "bg-[var(--bg-secondary)] text-[var(--text-primary)]",
            "border border-[var(--border-default)]",
            "hover:bg-[var(--bg-hover)]",
            "transition-all duration-200",
            "focus:outline-none focus:ring-2 focus:ring-[var(--accent-chat)]/50"
          )}
        >
          <House size={16} />
          Reload Page
        </button>
      </div>

      {/* Stack Trace (Development) */}
      {showDetails && errorInfo?.componentStack && (
        <div className="w-full max-w-md mt-6">
          <button
            onClick={() => setShowStack(!showStack)}
            className="flex items-center gap-1 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
          >
            <CaretRight className={cn("w-3 h-3 transition-transform", showStack && "rotate-90")} />
            {showStack ? "Hide" : "Show"} Component Stack
          </button>
          
          {showStack && (
            <pre 
              className={cn(
                "mt-2 p-3 rounded-lg",
                "bg-[var(--bg-secondary)] border border-[var(--border-subtle)]",
                "text-xs text-[var(--text-secondary)] font-mono",
                "overflow-auto max-h-[200px]"
              )}
            >
              {errorInfo.componentStack}
            </pre>
          )}
        </div>
      )}

      {/* Component Name Badge */}
      {componentName && (
        <div className="mt-4 px-2 py-1 rounded text-[10px] font-mono text-[var(--text-tertiary)] bg-[var(--bg-secondary)]">
          {componentName}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Specialized Error Boundaries
// ============================================================================

/**
 * ChatViewErrorBoundary - Specialized error boundary for ChatView
 */
export function ChatViewErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      componentName="ChatView"
      onError={(error, errorInfo) => {
        // Could send to error tracking service
        console.error("ChatView Error:", error, errorInfo);
      }}
      showDetails={process.env.NODE_ENV === 'development'}
    >
      {children}
    </ErrorBoundary>
  );
}

/**
 * ShellRailErrorBoundary - Specialized error boundary for ShellRail
 */
export function ShellRailErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      componentName="ShellRail"
      fallback={
        <div 
          className="w-[284px] h-full flex items-center justify-center p-4"
          style={{ 
            background: 'var(--glass-bg-thick)',
            borderRadius: 24,
            border: '1px solid var(--border-subtle)'
          }}
        >
          <div className="text-center">
            <Warning className="w-8 h-8 text-[var(--text-tertiary)] mx-auto mb-2" />
            <p className="text-sm text-[var(--text-secondary)]">Navigation unavailable</p>
          </div>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}

/**
 * AsyncErrorBoundary - Error boundary for async components
 */
export function AsyncErrorBoundary({ 
  children,
  onReset 
}: { 
  children: ReactNode;
  onReset?: () => void;
}) {
  return (
    <ErrorBoundary
      componentName="AsyncComponent"
      onReset={onReset}
      showDetails={true}
    >
      {children}
    </ErrorBoundary>
  );
}

// ============================================================================
// Error Handler Hook
// ============================================================================

/**
 * useErrorHandler - Hook for programmatic error triggering
 */
export function useErrorHandler() {
  const [error, setError] = React.useState<Error | null>(null);

  const handleError = React.useCallback((error: Error) => {
    setError(error);
  }, []);

  const resetError = React.useCallback(() => {
    setError(null);
  }, []);

  if (error) {
    throw error;
  }

  return { handleError, resetError };
}

// ============================================================================
// Error Reporter (for external services)
// ============================================================================

interface ErrorReport {
  error: Error;
  componentStack?: string;
  componentName?: string | null;
  timestamp: string;
  url: string;
  userAgent: string;
}

/**
 * Report error to external service
 */
export function reportError(error: Error, errorInfo?: ErrorInfo, componentName?: string | null) {
  const report: ErrorReport = {
    error,
    componentStack: errorInfo?.componentStack ?? undefined,
    componentName: componentName ?? undefined,
    timestamp: new Date().toISOString(),
    url: typeof window !== 'undefined' ? window.location.href : '',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
  };

  console.error('[Error Report]', report);

  // Send to error tracking service (e.g., Sentry)
  // if (typeof window !== 'undefined' && window.Sentry) {
  //   window.Sentry.captureException(error, { 
  //     extra: { componentStack: errorInfo?.componentStack, componentName } 
  //   });
  // }

  return report;
}

export default ErrorBoundary;
