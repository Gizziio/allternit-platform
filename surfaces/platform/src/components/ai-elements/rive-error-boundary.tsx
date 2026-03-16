/**
 * Rive Error Boundary Wrapper
 * 
 * Wraps Rive components to catch initialization errors.
 * The @rive-app/react-webgl2 library can throw errors when:
 * - WebGL context is not available
 * - Canvas reference is null
 * - Rive runtime fails to initialize
 * 
 * Usage:
 * ```tsx
 * <RiveErrorBoundary fallback={<div>Animation unavailable</div>}>
 *   <YourRiveComponent />
 * </RiveErrorBoundary>
 * ```
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class RiveErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[RiveErrorBoundary] Caught error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      return (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          background: 'rgba(0,0,0,0.02)',
          borderRadius: 8,
          border: '1px dashed rgba(0,0,0,0.1)'
        }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ margin: 0, color: 'rgba(0,0,0,0.5)', fontSize: 14 }}>
              Animation unavailable
            </p>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details style={{ marginTop: 8, fontSize: 12, color: 'rgba(0,0,0,0.3)' }}>
                <summary>Error details</summary>
                <pre style={{ marginTop: 4 }}>{this.state.error.message}</pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Hook-based error boundary for functional components
 * 
 * Usage:
 * ```tsx
 * function MyComponent() {
 *   const { hasError, error } = useRiveErrorBoundary();
 *   
 *   if (hasError) {
 *     return <div>Animation unavailable</div>;
 *   }
 *   
 *   return <RiveAnimation />;
 * }
 * ```
 */
export function useRiveErrorBoundary() {
  const [state, setState] = React.useState<{ hasError: boolean; error?: Error }>({
    hasError: false,
  });

  React.useEffect(() => {
    const errorHandler = (error: ErrorEvent) => {
      if (error.message?.includes('rive') || error.message?.includes('WebGL')) {
        setState({ hasError: true, error: error.error });
      }
    };

    window.addEventListener('error', errorHandler);
    return () => window.removeEventListener('error', errorHandler);
  }, []);

  return state;
}
