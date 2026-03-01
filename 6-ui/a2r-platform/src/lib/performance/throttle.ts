/**
 * Debouncing and Throttling Utilities
 * 
 * Performance utilities to limit the frequency of function calls.
 * Essential for scroll handlers, resize observers, and input handlers.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

// ============================================================================
// Debounce
// ============================================================================

export interface DebouncedFunction<T extends (...args: any[]) => any> {
  (...args: Parameters<T>): void;
  cancel: () => void;
  flush: () => ReturnType<T> | undefined;
  pending: () => boolean;
}

/**
 * Debounce a function - delays execution until after wait milliseconds
 * of no calls. Useful for search inputs, form validation, etc.
 * 
 * @param func Function to debounce
 * @param wait Wait time in milliseconds
 * @param immediate Execute on leading edge instead of trailing
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  immediate: boolean = false
): DebouncedFunction<T> {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let result: ReturnType<T> | undefined;
  let lastArgs: Parameters<T> | null = null;
  let lastThis: ThisParameterType<T> | null = null;
  let timestamp: number = 0;

  const later = () => {
    const last = Date.now() - timestamp;

    if (last < wait && last >= 0) {
      timeout = setTimeout(later, wait - last);
    } else {
      timeout = null;
      if (!immediate) {
        result = func.apply(lastThis!, lastArgs!);
        lastArgs = lastThis = null;
      }
    }
  };

  const debounced = function (
    this: ThisParameterType<T>,
    ...args: Parameters<T>
  ) {
    timestamp = Date.now();
    lastArgs = args;
    lastThis = this;

    const callNow = immediate && !timeout;

    if (!timeout) {
      timeout = setTimeout(later, wait);
    }

    if (callNow) {
      result = func.apply(this, args);
    }

    return result;
  };

  debounced.cancel = () => {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
    lastArgs = lastThis = null;
  };

  debounced.flush = () => {
    if (timeout) {
      result = func.apply(lastThis!, lastArgs!);
      lastArgs = lastThis = null;
      clearTimeout(timeout);
      timeout = null;
    }
    return result;
  };

  debounced.pending = () => timeout !== null;

  return debounced;
}

/**
 * React hook for debounced values
 * 
 * Usage:
 * const debouncedSearch = useDebouncedValue(searchQuery, 300);
 */
export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * React hook for debounced callbacks
 * 
 * Usage:
 * const debouncedSearch = useDebouncedCallback((query) => {
 *   performSearch(query);
 * }, 300);
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number,
  deps: React.DependencyList = []
): DebouncedFunction<T> {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  });

  const debouncedFn = useRef<DebouncedFunction<T> | null>(null);

  if (!debouncedFn.current) {
    debouncedFn.current = debounce((...args: Parameters<T>) => {
      callbackRef.current(...args);
    }, delay);
  }

  useEffect(() => {
    return () => {
      debouncedFn.current?.cancel();
    };
  }, deps);

  return debouncedFn.current;
}

// ============================================================================
// Throttle
// ============================================================================

export interface ThrottledFunction<T extends (...args: any[]) => any> {
  (...args: Parameters<T>): ReturnType<T> | undefined;
  cancel: () => void;
  flush: () => ReturnType<T> | undefined;
}

/**
 * Throttle a function - limits execution to once per wait milliseconds.
 * Useful for scroll handlers, resize observers, etc.
 * 
 * @param func Function to throttle
 * @param wait Wait time in milliseconds
 * @param options Throttle options
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  options: { leading?: boolean; trailing?: boolean } = {}
): ThrottledFunction<T> {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let previous = 0;
  let result: ReturnType<T> | undefined;
  let lastArgs: Parameters<T> | null = null;
  let lastThis: ThisParameterType<T> | null = null;

  const { leading = true, trailing = true } = options;

  const later = () => {
    previous = leading ? Date.now() : 0;
    timeout = null;
    result = func.apply(lastThis!, lastArgs!);
    lastArgs = lastThis = null;
  };

  const throttled = function (
    this: ThisParameterType<T>,
    ...args: Parameters<T>
  ) {
    const now = Date.now();

    if (!previous && !leading) {
      previous = now;
    }

    const remaining = wait - (now - previous);
    lastArgs = args;
    lastThis = this;

    if (remaining <= 0 || remaining > wait) {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      previous = now;
      result = func.apply(this, args);
      lastArgs = lastThis = null;
    } else if (!timeout && trailing) {
      timeout = setTimeout(later, remaining);
    }

    return result;
  };

  throttled.cancel = () => {
    if (timeout) {
      clearTimeout(timeout);
    }
    previous = 0;
    timeout = null;
    lastArgs = lastThis = null;
  };

  throttled.flush = () => {
    if (timeout) {
      result = func.apply(lastThis!, lastArgs!);
      lastArgs = lastThis = null;
      clearTimeout(timeout);
      timeout = null;
    }
    return result;
  };

  return throttled;
}

/**
 * React hook for throttled callbacks
 * 
 * Usage:
 * const throttledScroll = useThrottledCallback((e) => {
 *   saveScrollPosition(e.target.scrollTop);
 * }, 100);
 */
export function useThrottledCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number,
  deps: React.DependencyList = [],
  options: { leading?: boolean; trailing?: boolean } = {}
): ThrottledFunction<T> {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  });

  const throttledFn = useRef<ThrottledFunction<T> | null>(null);

  if (!throttledFn.current) {
    throttledFn.current = throttle((...args: Parameters<T>) => {
      callbackRef.current(...args);
    }, delay, options);
  }

  useEffect(() => {
    return () => {
      throttledFn.current?.cancel();
    };
  }, deps);

  return throttledFn.current;
}

/**
 * React hook for throttled values
 */
export function useThrottledValue<T>(value: T, delay: number): T {
  const [throttledValue, setThrottledValue] = useState(value);
  const lastUpdate = useRef(Date.now());

  useEffect(() => {
    const now = Date.now();
    const timeSinceLastUpdate = now - lastUpdate.current;

    if (timeSinceLastUpdate >= delay) {
      setThrottledValue(value);
      lastUpdate.current = now;
    } else {
      const timeout = setTimeout(() => {
        setThrottledValue(value);
        lastUpdate.current = Date.now();
      }, delay - timeSinceLastUpdate);

      return () => clearTimeout(timeout);
    }
  }, [value, delay]);

  return throttledValue;
}

// ============================================================================
// Request Animation Frame Throttling
// ============================================================================

/**
 * Throttle function to run at most once per animation frame
 */
export function rafThrottle<T extends (...args: any[]) => any>(
  callback: T
): (...args: Parameters<T>) => void {
  let requestId: number | null = null;
  let lastArgs: Parameters<T> | null = null;

  const later = () => {
    requestId = null;
    if (lastArgs) {
      callback(...lastArgs);
      lastArgs = null;
    }
  };

  return (...args: Parameters<T>) => {
    lastArgs = args;
    if (requestId === null) {
      requestId = requestAnimationFrame(later);
    }
  };
}

/**
 * React hook for RAF-throttled callbacks
 */
export function useRafCallback<T extends (...args: any[]) => any>(
  callback: T,
  deps: React.DependencyList = []
): (...args: Parameters<T>) => void {
  const callbackRef = useRef(callback);
  const requestIdRef = useRef<number | null>(null);
  const lastArgsRef = useRef<Parameters<T> | null>(null);

  useEffect(() => {
    callbackRef.current = callback;
  });

  useEffect(() => {
    return () => {
      if (requestIdRef.current !== null) {
        cancelAnimationFrame(requestIdRef.current);
      }
    };
  }, deps);

  return useCallback((...args: Parameters<T>) => {
    lastArgsRef.current = args;
    
    if (requestIdRef.current === null) {
      requestIdRef.current = requestAnimationFrame(() => {
        requestIdRef.current = null;
        if (lastArgsRef.current) {
          callbackRef.current(...lastArgsRef.current);
          lastArgsRef.current = null;
        }
      });
    }
  }, deps);
}

// ============================================================================
// Combined Utilities
// ============================================================================

/**
 * Debounce leading + trailing - Execute on both edges with minimum spacing
 */
export function debounceLeadingTrailing<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): DebouncedFunction<T> {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let lastCallTime = 0;

  const debounced = function (this: ThisParameterType<T>, ...args: Parameters<T>) {
    const now = Date.now();
    const isLeading = now - lastCallTime > wait;

    lastCallTime = now;

    if (isLeading) {
      // Execute immediately on leading edge
      func.apply(this, args);
    }

    // Clear existing timeout
    if (timeout) {
      clearTimeout(timeout);
    }

    // Set timeout for trailing edge
    timeout = setTimeout(() => {
      timeout = null;
      func.apply(this, args);
    }, wait);
  };

  debounced.cancel = () => {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
  };

  debounced.flush = () => {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
    return undefined;
  };

  debounced.pending = () => timeout !== null;

  return debounced;
}

// ============================================================================
// Scroll and Resize Optimized Hooks
// ============================================================================

/**
 * Hook for optimized scroll handling
 */
export function useScrollHandler(
  callback: (scrollY: number) => void,
  options: { throttle?: number; passive?: boolean } = {}
) {
  const { throttle: throttleMs = 16, passive = true } = options;

  const throttledCallback = useThrottledCallback(
    () => callback(window.scrollY),
    throttleMs,
    [callback, throttleMs]
  );

  useEffect(() => {
    window.addEventListener('scroll', throttledCallback, { passive });
    return () => window.removeEventListener('scroll', throttledCallback);
  }, [throttledCallback, passive]);
}

/**
 * Hook for optimized resize handling
 */
export function useResizeHandler(
  callback: (size: { width: number; height: number }) => void,
  options: { throttle?: number } = {}
) {
  const { throttle: throttleMs = 100 } = options;

  const throttledCallback = useThrottledCallback(
    () => callback({ width: window.innerWidth, height: window.innerHeight }),
    throttleMs,
    [callback, throttleMs]
  );

  useEffect(() => {
    window.addEventListener('resize', throttledCallback);
    return () => window.removeEventListener('resize', throttledCallback);
  }, [throttledCallback]);
}

// ============================================================================
// Export all utilities
// ============================================================================

export {
  // Aliases for convenience
  debounce as useDebounce,
  throttle as useThrottle,
};
