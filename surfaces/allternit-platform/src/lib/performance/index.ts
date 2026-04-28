/**
 * Performance Monitoring Utilities
 * 
 * Web Vitals monitoring, component render tracking, and performance marks.
 * Targets: FCP < 1.5s, TTI < 3s, Bundle < 500KB, Lighthouse > 90
 */

import { useRef, useEffect, useCallback, useState } from 'react';

// ============================================================================
// Web Vitals Monitoring
// ============================================================================

export interface WebVitalMetric {
  name: 'FCP' | 'LCP' | 'FID' | 'CLS' | 'TTFB' | 'TBT' | 'INP';
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta?: number;
  entries: PerformanceEntry[];
}

// Performance thresholds based on Core Web Vitals
export const PERFORMANCE_THRESHOLDS: Record<string, { good: number; poor: number }> = {
  FCP: { good: 1800, poor: 3000 },    // First Contentful Paint (ms)
  LCP: { good: 2500, poor: 4000 },    // Largest Contentful Paint (ms)
  FID: { good: 100, poor: 300 },      // First Input Delay (ms)
  CLS: { good: 0.1, poor: 0.25 },     // Cumulative Layout Shift
  TTFB: { good: 800, poor: 1800 },    // Time to First Byte (ms)
  TBT: { good: 200, poor: 600 },      // Total Blocking Time (ms)
  INP: { good: 200, poor: 500 },      // Interaction to Next Paint (ms)
};

/**
 * Report Web Vitals metrics
 */
export function reportWebVitals(metric: WebVitalMetric): void {
  // Log to console in development
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
    console.log(`[Web Vitals] ${metric.name}:`, {
      value: metric.value,
      rating: metric.rating,
      delta: metric.delta,
    });
  }

  // Send to analytics in production
  if (typeof window !== 'undefined' && 'gtag' in window) {
    (window as any).gtag('event', metric.name, {
      event_category: 'Web Vitals',
      value: Math.round(metric.value),
      custom_parameter_1: metric.rating,
    });
  }

  // Emit custom event for local tracking
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('web-vital', { detail: metric }));
  }
}

/**
 * Hook to track component render count (for debugging performance issues)
 */
export function useRenderCount(componentName: string): number {
  const renderCount = useRef(0);
  renderCount.current++;

  useEffect(() => {
    if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
      console.log(`[RenderCount] ${componentName}: ${renderCount.current} renders`);
    }
  });

  return renderCount.current;
}

/**
 * Hook to measure component mount time
 */
export function useMountTiming(componentName: string): void {
  const startTime = useRef<number>(0);

  useEffect(() => {
    startTime.current = performance.now();
    
    return () => {
      const duration = performance.now() - startTime.current;
      if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
        console.log(`[MountTime] ${componentName}: ${duration.toFixed(2)}ms`);
      }
    };
  }, [componentName]);
}

// ============================================================================
// Performance Marks and Measures
// ============================================================================

/**
 * Create a performance mark
 */
export function mark(name: string): void {
  if (typeof performance !== 'undefined' && performance.mark) {
    performance.mark(name);
  }
}

/**
 * Measure between two marks
 */
export function measure(name: string, startMark: string, endMark?: string): PerformanceMeasure | null {
  if (typeof performance === 'undefined' || !performance.measure) {
    return null;
  }

  try {
    performance.measure(name, startMark, endMark);
    const entries = performance.getEntriesByName(name, 'measure');
    return entries[entries.length - 1] as PerformanceMeasure;
  } catch (e) {
    console.warn(`[Performance] Failed to measure ${name}:`, e);
    return null;
  }
}

/**
 * Clear performance marks
 */
export function clearMarks(name?: string): void {
  if (typeof performance !== 'undefined' && performance.clearMarks) {
    if (name) {
      performance.clearMarks(name);
    } else {
      performance.clearMarks();
    }
  }
}

/**
 * Clear performance measures
 */
export function clearMeasures(name?: string): void {
  if (typeof performance !== 'undefined' && performance.clearMeasures) {
    if (name) {
      performance.clearMeasures(name);
    } else {
      performance.clearMeasures();
    }
  }
}

// ============================================================================
// Long Task Monitoring
// ============================================================================

interface LongTaskObserver {
  disconnect(): void;
}

/**
 * Observe long tasks that block the main thread
 */
export function observeLongTasks(callback: (entries: PerformanceEntry[]) => void): LongTaskObserver | null {
  if (typeof window === 'undefined' || !('PerformanceObserver' in window)) {
    return null;
  }

  try {
    const observer = new PerformanceObserver((list) => {
      callback(list.getEntries());
    });
    observer.observe({ entryTypes: ['longtask'] });
    return { disconnect: () => observer.disconnect() };
  } catch (e) {
    // Long task observation not supported
    return null;
  }
}

// ============================================================================
// Resource Loading
// ============================================================================

/**
 * Preload a critical resource
 */
export function preloadResource(href: string, as: 'script' | 'style' | 'font' | 'image' | 'fetch'): void {
  if (typeof document === 'undefined') return;

  const link = document.createElement('link');
  link.rel = 'preload';
  link.href = href;
  link.as = as;
  
  if (as === 'font') {
    link.crossOrigin = 'anonymous';
  }
  
  document.head.appendChild(link);
}

/**
 * Prefetch a resource for future navigation
 */
export function prefetchResource(href: string): void {
  if (typeof document === 'undefined') return;

  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.href = href;
  document.head.appendChild(link);
}

// ============================================================================
// Bundle Size Tracking
// ============================================================================

export interface BundleSizeReport {
  initial: number;
  lazy: number;
  total: number;
  timestamp: number;
}

/**
 * Track bundle sizes (to be called after build)
 */
export function trackBundleSize(): BundleSizeReport | null {
  if (typeof performance === 'undefined' || !performance.getEntriesByType) {
    return null;
  }

  const resources = performance.getEntriesByType('resource');
  let initial = 0;
  let lazy = 0;

  resources.forEach((resource) => {
    const size = (resource as PerformanceResourceTiming).transferSize || 0;
    
    // Consider scripts loaded in first 2 seconds as "initial"
    if (resource.startTime < 2000 && resource.name.endsWith('.js')) {
      initial += size;
    } else if (resource.name.endsWith('.js')) {
      lazy += size;
    }
  });

  const report: BundleSizeReport = {
    initial,
    lazy,
    total: initial + lazy,
    timestamp: Date.now(),
  };

  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
    console.log('[BundleSize]', {
      initial: `${(initial / 1024).toFixed(2)} KB`,
      lazy: `${(lazy / 1024).toFixed(2)} KB`,
      total: `${((initial + lazy) / 1024).toFixed(2)} KB`,
    });
  }

  return report;
}

// ============================================================================
// Performance Budget
// ============================================================================

export interface PerformanceBudget {
  fcp: number;
  lcp: number;
  tti: number;
  bundleSize: number;
}

export const DEFAULT_PERFORMANCE_BUDGET: PerformanceBudget = {
  fcp: 1500,      // First Contentful Paint < 1.5s
  lcp: 2500,      // Largest Contentful Paint < 2.5s
  tti: 3000,      // Time to Interactive < 3s
  bundleSize: 500 * 1024,  // Initial bundle < 500KB
};

/**
 * Check if metrics are within budget
 */
export function checkPerformanceBudget(
  metrics: Partial<Record<keyof PerformanceBudget, number>>,
  budget: PerformanceBudget = DEFAULT_PERFORMANCE_BUDGET
): { pass: boolean; violations: string[] } {
  const violations: string[] = [];

  for (const [key, value] of Object.entries(metrics)) {
    const budgetKey = key as keyof PerformanceBudget;
    const budgetValue = budget[budgetKey];
    
    if (value && value > budgetValue) {
      const unit = key === 'bundleSize' ? 'bytes' : 'ms';
      violations.push(`${key}: ${value}${unit} (budget: ${budgetValue}${unit})`);
    }
  }

  return { pass: violations.length === 0, violations };
}

// ============================================================================
// Frame Rate Monitoring
// ============================================================================

interface RefState<T> {
  current: T;
  set: (value: T) => void;
}

function useRefState<T>(initialValue: T): RefState<T> {
  const ref = useRef<T>(initialValue);
  const [, setTick] = useState(0);

  const set = useCallback((value: T) => {
    ref.current = value;
    setTick((t: number) => t + 1);
  }, []);

  return { current: ref.current, set };
}

/**
 * Hook to monitor frame rate
 */
export function useFrameRateMonitor(enabled: boolean = true): { fps: number; isStable: boolean } {
  const fps = useRefState(60);
  const frameCount = useRef(0);
  const lastTime = useRef(performance.now());

  useEffect(() => {
    if (!enabled) return;

    let rafId: number;

    const tick = () => {
      frameCount.current++;
      const now = performance.now();
      const elapsed = now - lastTime.current;

      if (elapsed >= 1000) {
        const currentFps = Math.round((frameCount.current * 1000) / elapsed);
        fps.set(currentFps);
        frameCount.current = 0;
        lastTime.current = now;
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(rafId);
  }, [enabled, fps]);

  return { fps: fps.current, isStable: fps.current >= 30 };
}

// Re-export memoization utilities
export { memo, memoIgnoring, memoWithComparison, memoWithDeepComparison, useBatchedCallback, useCallback, useCallbackDebug, useConditionalRef, useMemo, useMemoDebug, useMemoizedComputation, useMemoizedDerived, useMemoizedList, useRenderPerformance, useStableCallback, useUpdatingRef, useWhyDidYouUpdate } from './memoization';
export { // Aliases for convenience
  debounce, type DebouncedFunction, type ThrottledFunction, debounceLeadingTrailing, rafThrottle, throttle, useDebouncedCallback, useDebouncedValue, useRafCallback, useResizeHandler, useScrollHandler, useThrottledCallback, useThrottledValue } from './throttle';
