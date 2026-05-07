/**
 * Memoization Utilities
 * 
 * Performance optimization through proper memoization strategies.
 * Includes React.memo, useMemo, and useCallback patterns.
 */

import { 
  memo, 
  useMemo, 
  useCallback, 
  useRef, 
  useEffect,
  useState,
  type DependencyList,
  type MemoExoticComponent,
  type ComponentType,
} from 'react';

// ============================================================================
// React.memo with Custom Comparison
// ============================================================================

/**
 * Creates a memoized component with shallow comparison for specific props
 * 
 * Usage:
 * const MessageList = memoWithComparison(MessageListComponent, ['messages', 'isLoading']);
 */
export function memoWithComparison<P extends object>(
  Component: ComponentType<P>,
  compareKeys: (keyof P)[]
): MemoExoticComponent<ComponentType<P>> {
  return memo(Component, (prevProps, nextProps) => {
    return compareKeys.every(key => prevProps[key] === nextProps[key]);
  });
}

/**
 * Creates a memoized component that ignores specific props in comparison
 * 
 * Usage:
 * const ChatView = memoIgnoring(ChatViewComponent, ['onScroll', 'callbacks']);
 */
export function memoIgnoring<P extends object>(
  Component: ComponentType<P>,
  ignoreKeys: (keyof P)[]
): MemoExoticComponent<ComponentType<P>> {
  const compareKeys = Object.keys({} as P).filter(
    key => !ignoreKeys.includes(key as keyof P)
  ) as (keyof P)[];
  
  return memo(Component, (prevProps, nextProps) => {
    return compareKeys.every(key => prevProps[key] === nextProps[key]);
  });
}

/**
 * Deep equality comparison for complex props
 */
export function memoWithDeepComparison<P extends object>(
  Component: ComponentType<P>,
  deepKeys: (keyof P)[]
): MemoExoticComponent<ComponentType<P>> {
  return memo(Component, (prevProps, nextProps) => {
    // Check shallow equality for all props
    const allKeys = Object.keys(prevProps) as (keyof P)[];
    
    return allKeys.every(key => {
      if (deepKeys.includes(key)) {
        return deepEqual(prevProps[key], nextProps[key]);
      }
      return prevProps[key] === nextProps[key];
    });
  });
}

/**
 * Simple deep equality check
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object' || a === null || b === null) return false;
  
  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;
  
  const aKeys = Object.keys(aObj);
  const bKeys = Object.keys(bObj);
  
  if (aKeys.length !== bKeys.length) return false;
  
  return aKeys.every(key => deepEqual(aObj[key], bObj[key]));
}

// ============================================================================
// useMemo Patterns
// ============================================================================

/**
 * useMemo with debug logging in development
 */
export function useMemoDebug<T>(
  factory: () => T,
  deps: DependencyList,
  name: string
): T {
  const ref = useRef<T>();
  const depsRef = useRef<DependencyList>(deps);
  
  const hasChanged = deps.some((dep, i) => dep !== depsRef.current[i]);
  
  if (process.env.NODE_ENV === 'development') {
    if (hasChanged) {
      console.log(`[useMemoDebug] ${name}: dependencies changed`);
    }
  }
  
  depsRef.current = deps;
  
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(factory, deps);
}

/**
 * Memoize expensive computations with result caching
 */
export function useMemoizedComputation<T, Args extends unknown[]>(
  compute: (...args: Args) => T,
  args: Args,
  maxCacheSize: number = 10
): T {
  const cacheRef = useRef<Map<string, { result: T; timestamp: number }>>(new Map());
  
  const key = JSON.stringify(args);
  const cached = cacheRef.current.get(key);
  
  if (cached) {
    // Move to end (LRU)
    cacheRef.current.delete(key);
    cacheRef.current.set(key, cached);
    return cached.result;
  }
  
  const result = compute(...args);
  
  // Evict oldest if at capacity
  if (cacheRef.current.size >= maxCacheSize) {
    const firstKey = cacheRef.current.keys().next().value;
    if (firstKey) {
      cacheRef.current.delete(firstKey);
    }
  }
  
  cacheRef.current.set(key, { result, timestamp: Date.now() });
  
  return result;
}

/**
 * Memoize a derived value that only recalculates when specific deps change
 * and the calculation result is different
 */
export function useMemoizedDerived<T>(
  factory: () => T,
  deps: DependencyList,
  isEqual: (a: T, b: T) => boolean = Object.is
): T {
  const [state, setState] = useState<T>(() => factory());
  const prevDepsRef = useRef<DependencyList>(deps);
  
  useEffect(() => {
    const hasChanged = deps.some((dep, i) => dep !== prevDepsRef.current[i]);
    
    if (hasChanged) {
      const newValue = factory();
      
      if (!isEqual(newValue, state)) {
        setState(newValue);
      }
      
      prevDepsRef.current = deps;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  
  return state;
}

// ============================================================================
// useCallback Patterns
// ============================================================================

/**
 * useCallback with debug logging in development
 */
export function useCallbackDebug<T extends (...args: any[]) => any>(
  callback: T,
  deps: DependencyList,
  name: string
): T {
  if (process.env.NODE_ENV === 'development') {
    const depsRef = useRef<DependencyList>(deps);
    const hasChanged = deps.some((dep, i) => dep !== depsRef.current[i]);
    
    if (hasChanged) {
      console.log(`[useCallbackDebug] ${name}: dependencies changed`);
    }
    
    depsRef.current = deps;
  }
  
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useCallback(callback, deps);
}

/**
 * Create a stable callback that doesn't change between renders
 * Useful for event handlers that don't need fresh closure values
 */
export function useStableCallback<T extends (...args: any[]) => any>(
  callback: T
): T {
  const ref = useRef(callback);
  
  useEffect(() => {
    ref.current = callback;
  });
  
  return useCallback(
    ((...args: Parameters<T>) => ref.current(...args)) as T,
    []
  );
}

/**
 * Create a memoized event handler with batched updates
 */
export function useBatchedCallback<T extends (...args: any[]) => void>(
  callback: T,
  deps: DependencyList,
  batchMs: number = 16
): T {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingArgsRef = useRef<Parameters<T> | null>(null);
  const callbackRef = useRef(callback);
  
  useEffect(() => {
    callbackRef.current = callback;
  });
  
  return useCallback(((...args: Parameters<T>) => {
    pendingArgsRef.current = args;
    
    if (timeoutRef.current) {
      return;
    }
    
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null;
      if (pendingArgsRef.current) {
        callbackRef.current(...pendingArgsRef.current);
        pendingArgsRef.current = null;
      }
    }, batchMs);
  }) as T, deps);
}

// ============================================================================
// useRef Patterns
// ============================================================================

/**
 * Create a ref that updates when deps change
 */
export function useUpdatingRef<T>(value: T): React.MutableRefObject<T> {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}

/**
 * Create a ref that only updates on specific dependency changes
 */
export function useConditionalRef<T>(
  value: T,
  shouldUpdate: (prev: T, next: T) => boolean
): React.MutableRefObject<T> {
  const ref = useRef(value);
  
  if (shouldUpdate(ref.current, value)) {
    ref.current = value;
  }
  
  return ref;
}

// ============================================================================
// Performance Monitoring Hooks
// ============================================================================

/**
 * Hook to track why a component re-rendered
 */
export function useWhyDidYouUpdate(name: string, props: Record<string, unknown>): void {
  const previousProps = useRef<Record<string, unknown>>();
  
  useEffect(() => {
    if (previousProps.current) {
      const allKeys = Object.keys({ ...previousProps.current, ...props });
      const changesObj: Record<string, { from: unknown; to: unknown }> = {};
      
      allKeys.forEach(key => {
        if (previousProps.current![key] !== props[key]) {
          changesObj[key] = {
            from: previousProps.current![key],
            to: props[key],
          };
        }
      });
      
      if (Object.keys(changesObj).length > 0) {
        console.log(`[why-did-you-update] ${name}`, changesObj);
      }
    }
    
    previousProps.current = props;
  });
}

/**
 * Hook to measure render performance
 */
export function useRenderPerformance(
  componentName: string,
  threshold: number = 16
): { renderTime: number; isSlow: boolean } {
  const [renderTime, setRenderTime] = useState(0);
  const startTime = useRef(performance.now());
  
  useEffect(() => {
    const endTime = performance.now();
    const duration = endTime - startTime.current;
    setRenderTime(duration);
    
    if (duration > threshold && process.env.NODE_ENV === 'development') {
      console.warn(`[Performance] ${componentName} took ${duration.toFixed(2)}ms to render`);
    }
    
    // Reset start time for next render
    startTime.current = performance.now();
  });
  
  return { renderTime, isSlow: renderTime > threshold };
}

// ============================================================================
// List Optimization
// ============================================================================

interface ListItem<T> {
  id: string;
  data: T;
}

/**
 * Hook to optimize list rendering with stable identities
 */
export function useMemoizedList<T>(
  items: T[],
  getId: (item: T, index: number) => string
): ListItem<T>[] {
  const cacheRef = useRef<Map<string, ListItem<T>>>(new Map());
  
  return useMemo(() => {
    const newCache = new Map<string, ListItem<T>>();
    
    const result = items.map((item, index) => {
      const id = getId(item, index);
      const cached = cacheRef.current.get(id);
      
      if (cached && cached.data === item) {
        newCache.set(id, cached);
        return cached;
      }
      
      const listItem: ListItem<T> = { id, data: item };
      newCache.set(id, listItem);
      return listItem;
    });
    
    cacheRef.current = newCache;
    return result;
  }, [items, getId]);
}

// ============================================================================
// Export all utilities
// ============================================================================

export {
  memo,
  useMemo,
  useCallback,
};
