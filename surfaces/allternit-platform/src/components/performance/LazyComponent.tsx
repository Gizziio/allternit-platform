/**
 * LazyComponent - Intersection Observer-based Lazy Loading
 * 
 * Renders children only when they enter the viewport.
 * Shows a skeleton placeholder until the content becomes visible.
 * 
 * Usage:
 * <LazyComponent threshold={0.1} rootMargin="100px">
 *   <HeavyComponent />
 * </LazyComponent>
 */

import React, { useState, useEffect, useRef, Suspense, lazy, ComponentType } from 'react';
import { ViewSkeleton } from './ViewSkeleton';

export interface LazyComponentProps {
  children: React.ReactNode;
  threshold?: number;
  rootMargin?: string;
  fallback?: React.ReactNode;
  /** Delay in ms before starting to observe (useful for initial page load) */
  delay?: number;
  /** Trigger for below-fold content */
  trigger?: 'intersection' | 'immediate' | 'idle';
}

/**
 * LazyComponent - Delays rendering children until they enter viewport
 */
export function LazyComponent({
  children,
  threshold = 0.1,
  rootMargin = '50px',
  fallback,
  delay = 0,
  trigger = 'intersection',
}: LazyComponentProps) {
  const [isVisible, setIsVisible] = useState(trigger === 'immediate');
  const [isIdle, setIsIdle] = useState(trigger !== 'idle');
  const ref = useRef<HTMLDivElement>(null);

  // Handle requestIdleCallback for 'idle' trigger
  useEffect(() => {
    if (trigger !== 'idle') return;

    const handleIdle = () => setIsIdle(true);

    if ('requestIdleCallback' in window) {
      const id = requestIdleCallback(handleIdle, { timeout: 2000 });
      return () => cancelIdleCallback(id);
    } else {
      // Fallback for browsers without requestIdleCallback
      const timeout = setTimeout(handleIdle, 200);
      return () => clearTimeout(timeout);
    }
  }, [trigger]);

  // Set up intersection observer
  useEffect(() => {
    if (trigger !== 'intersection') return;
    if (!ref.current) return;

    const element = ref.current;

    // Delay observation if specified
    const observeTimer = setTimeout(() => {
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.disconnect();
          }
        },
        { threshold, rootMargin }
      );

      observer.observe(element);

      // Cleanup function
      return () => {
        observer.disconnect();
      };
    }, delay);

    return () => {
      clearTimeout(observeTimer);
    };
  }, [threshold, rootMargin, delay, trigger]);

  const shouldRender = isVisible && isIdle;
  const defaultFallback = fallback || <ViewSkeleton />;

  return (
    <div ref={ref} style={{ minHeight: '1px' }}>
      {shouldRender ? children : defaultFallback}
    </div>
  );
}

// ============================================================================
// Lazy Import Helper
// ============================================================================

export interface LazyImportOptions {
  /** Display name for debugging */
  displayName?: string;
  /** Fallback component while loading */
  fallback?: React.ReactNode;
  /** Maximum time to wait for chunk load (ms) */
  timeout?: number;
  /** Retry count on load failure */
  retries?: number;
}

/**
 * Creates a lazily loaded component with error handling and retries
 * 
 * Usage:
 * const HeavyComponent = lazyImport(() => import('./HeavyComponent'), {
 *   displayName: 'HeavyComponent',
 *   fallback: <LoadingSpinner />
 * });
 */
export function lazyImport<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  options: LazyImportOptions = {}
): React.LazyExoticComponent<T> {
  const { displayName, timeout = 10000, retries = 2 } = options;

  const loadWithRetry = async (): Promise<{ default: T }> => {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        // Create a timeout promise
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error(`Chunk load timeout after ${timeout}ms`)), timeout);
        });

        // Race between import and timeout
        return await Promise.race([
          factory(),
          timeoutPromise,
        ]);
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < retries) {
          // Exponential backoff
          const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Failed to load component after retries');
  };

  const LazyComponent = lazy(loadWithRetry);

  const LazyComponentWithName = LazyComponent as React.LazyExoticComponent<T> & { displayName?: string };
  
  if (displayName) {
    LazyComponentWithName.displayName = `Lazy(${displayName})`;
  }

  return LazyComponentWithName;
}

// ============================================================================
// Suspense Wrapper
// ============================================================================

export interface LazyBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onError?: (error: Error) => void;
}

interface LazyBoundaryState {
  hasError: boolean;
  error?: Error;
}

/**
 * Error boundary for lazy loaded components
 */
class LazyErrorBoundary extends React.Component<
  LazyBoundaryProps,
  LazyBoundaryState
> {
  constructor(props: LazyBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): LazyBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    this.props.onError?.(error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 text-sm text-red-500 bg-red-50 rounded border border-red-200">
          Failed to load component.{' '}
          <button
            onClick={() => this.setState({ hasError: false })}
            className="underline hover:text-red-700"
          >
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Suspense wrapper with error boundary for lazy components
 */
export function LazyBoundary({
  children,
  fallback,
  onError,
}: LazyBoundaryProps) {
  return (
    <LazyErrorBoundary onError={onError}>
      <Suspense fallback={fallback || <ViewSkeleton />}>{children}</Suspense>
    </LazyErrorBoundary>
  );
}

// ============================================================================
// Priority Loading
// ============================================================================

export interface PriorityLoadProps {
  children: React.ReactNode;
  priority?: 'high' | 'low' | 'idle';
}

/**
 * Loads children based on priority using requestIdleCallback
 */
export function PriorityLoad({ children, priority = 'low' }: PriorityLoadProps) {
  const [shouldRender, setShouldRender] = useState(priority === 'high');

  useEffect(() => {
    if (priority === 'high') return;

    if (priority === 'idle' && 'requestIdleCallback' in window) {
      const id = requestIdleCallback(() => setShouldRender(true), { timeout: 2000 });
      return () => cancelIdleCallback(id);
    }

    // Low priority - use setTimeout to defer
    const timeout = setTimeout(() => setShouldRender(true), 100);
    return () => clearTimeout(timeout);
  }, [priority]);

  if (!shouldRender) {
    return <ViewSkeleton />;
  }

  return <>{children}</>;
}

// ============================================================================
// Chunk Preloader
// ============================================================================

export interface ChunkPreloaderProps {
  /** Factory functions for chunks to preload */
  chunks: Array<() => Promise<unknown>>;
  /** When to start preloading */
  when?: 'immediate' | 'idle' | 'interaction';
  children: React.ReactNode;
}

/**
 * Preloads chunks in anticipation of navigation
 */
export function ChunkPreloader({
  chunks,
  when = 'idle',
  children,
}: ChunkPreloaderProps) {
  const hasPreloaded = useRef(false);

  useEffect(() => {
    if (hasPreloaded.current) return;

    const preload = () => {
      hasPreloaded.current = true;
      // Preload all chunks in parallel
      Promise.all(chunks.map(chunk => chunk().catch(() => null)));
    };

    if (when === 'immediate') {
      preload();
    } else if (when === 'idle' && 'requestIdleCallback' in window) {
      const id = requestIdleCallback(preload, { timeout: 3000 });
      return () => cancelIdleCallback(id);
    } else if (when === 'interaction') {
      const handler = () => {
        preload();
        document.removeEventListener('mousemove', handler);
        document.removeEventListener('scroll', handler);
      };
      document.addEventListener('mousemove', handler, { once: true });
      document.addEventListener('scroll', handler, { once: true });
      return () => {
        document.removeEventListener('mousemove', handler);
        document.removeEventListener('scroll', handler);
      };
    }
  }, [chunks, when]);

  return <>{children}</>;
}
