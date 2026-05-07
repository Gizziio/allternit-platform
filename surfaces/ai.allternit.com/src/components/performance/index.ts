/**
 * Performance Components and Utilities
 * 
 * Optimized UI components and hooks for better performance.
 * 
 * Targets:
 * - FCP < 1.5s (First Contentful Paint)
 * - TTI < 3s (Time to Interactive)
 * - Bundle size < 500KB (initial)
 * - Lighthouse score > 90
 */

// Lazy Loading Components
export {
  LazyComponent,
  lazyImport,
  LazyBoundary,
  PriorityLoad,
  ChunkPreloader,
} from './LazyComponent';
export type {
  LazyComponentProps,
  LazyImportOptions,
  LazyBoundaryProps,
  PriorityLoadProps,
  ChunkPreloaderProps,
} from './LazyComponent';

// Skeleton Loading States
export {
  ViewSkeleton,
  CardSkeleton,
  ListSkeleton,
  MessageSkeleton,
  CodeEditorSkeleton,
  TerminalSkeleton,
  FormSkeleton,
  TableSkeleton,
  ImageSkeleton,
  DashboardSkeleton,
} from './ViewSkeleton';
export type { ViewSkeletonProps } from './ViewSkeleton';

// Virtual Scrolling
export {
  VirtualList,
  VirtualMessageList,
  useVirtualList,
} from './VirtualList';
export type {
  VirtualListProps,
  VirtualListRef,
  VirtualMessageListProps,
} from './VirtualList';

// Optimized Image
export {
  OptimizedImage,
  ResponsiveImage,
  BackgroundImage,
  useImagePreloader,
} from './OptimizedImage';
export type {
  OptimizedImageProps,
  ResponsiveImageProps,
  BackgroundImageProps,
} from './OptimizedImage';

// Performance Monitoring (re-exported from lib)
export {
  // Web Vitals
  reportWebVitals,
  useRenderCount,
  useMountTiming,
  
  // Performance Marks
  mark,
  measure,
  clearMarks,
  clearMeasures,
  
  // Long Tasks
  observeLongTasks,
  
  // Resource Loading
  preloadResource,
  prefetchResource,
  
  // Bundle Size
  trackBundleSize,
  
  // Performance Budget
  checkPerformanceBudget,
  useFrameRateMonitor,
  
  // Constants
  PERFORMANCE_THRESHOLDS,
  DEFAULT_PERFORMANCE_BUDGET,
} from '../../lib/performance';

export type {
  WebVitalMetric,
  PerformanceBudget,
  BundleSizeReport,
} from '../../lib/performance';

// Debounce/Throttle (re-exported from lib)
export {
  debounce,
  throttle,
  rafThrottle,
  debounceLeadingTrailing,
  useDebouncedValue,
  useDebouncedCallback,
  useThrottledValue,
  useThrottledCallback,
  useRafCallback,
  useScrollHandler,
  useResizeHandler,
} from '../../lib/performance/throttle';

export type {
  DebouncedFunction,
  ThrottledFunction,
} from '../../lib/performance/throttle';
