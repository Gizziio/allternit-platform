# UI Performance Optimization Report

## Performance Targets

| Metric | Target | Status |
|--------|--------|--------|
| First Contentful Paint (FCP) | < 1.5s | 🔄 Pending measurement |
| Time to Interactive (TTI) | < 3s | 🔄 Pending measurement |
| Initial Bundle Size | < 500KB | 🔄 Pending measurement |
| Lighthouse Score | > 90 | 🔄 Pending measurement |

## Implemented Optimizations

### 1. Bundle Analysis ✅

**Tool:** `rollup-plugin-visualizer`

```bash
# Run bundle analysis
ANALYZE=true pnpm build
```

Opens interactive treemap at `./dist/stats.html` showing:
- Gzipped and Brotli compressed sizes
- Chunk breakdown
- Dependency tree visualization

### 2. Code Splitting ✅

**Strategy:** Manual chunking in Vite config

```typescript
// vite.config.ts
manualChunks: {
  'vendor-react': ['react', 'react-dom'],
  'vendor-ui': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-tabs'],
  'vendor-state': ['zustand', '@reduxjs/toolkit', 'react-redux'],
  'vendor-utils': ['date-fns', 'clsx', 'tailwind-merge'],
  'vendor-icons': ['lucide-react', '@phosphor-icons/react'],
}
```

**Results:**
- Vendor libraries split into separate chunks
- Cache-friendly (vendors change less frequently)
- Parallel loading of independent chunks

### 3. Route-Based Code Splitting ✅

**Implementation:** `src/views/lazyRegistry.ts`

Views are now lazy-loaded by category:
- **Eager:** Home, Chat (critical path)
- **Lazy:** Terminal, CodeEditor, OpenClaw, DAG views, Cloud Deploy

```typescript
// Example: Terminal is loaded only when accessed
export const TerminalView = lazy(() => import('./TerminalView'));
```

**Preloading Strategy:**
```typescript
// Preload likely next views on idle
preloadView('code');     // When in chat
preloadView('terminal'); // When in code view
```

### 4. ViewSkeleton Component ✅

**Location:** `src/components/performance/ViewSkeleton.tsx`

Provides consistent loading states:
- `ViewSkeleton` - Generic view placeholder
- `CodeEditorSkeleton` - Code editor specific
- `TerminalSkeleton` - Terminal specific
- `DashboardSkeleton` - Dashboard views
- `ListSkeleton`, `CardSkeleton`, `TableSkeleton`

### 5. LazyComponent with IntersectionObserver ✅

**Location:** `src/components/performance/LazyComponent.tsx`

```typescript
// Renders children only when in viewport
<LazyComponent threshold={0.1} rootMargin="50px">
  <HeavyComponent />
</LazyComponent>
```

**Features:**
- Intersection Observer for viewport detection
- `requestIdleCallback` support
- Configurable delay and trigger modes
- Fallback skeleton while loading

### 6. Virtual Scrolling ✅

**Location:** `src/components/performance/VirtualList.tsx`

```typescript
// Only renders visible items + overscan
<VirtualList
  items={messages}
  renderItem={(msg) => <MessageItem message={msg} />}
  estimateSize={() => 100}
  overscan={5}
/>
```

**Use cases:**
- Chat message lists
- Long data tables
- Infinite scroll feeds

### 7. Memoization Strategy ✅

**Location:** `src/lib/performance/memoization.ts`

```typescript
// React.memo with custom comparison
const MessageList = memoWithComparison(MessageListComponent, ['messages']);

// Debug memoization
const value = useMemoDebug(() => expensiveCalc(), [dep], 'ComponentName');

// Stable callbacks
const handleClick = useStableCallback((id) => onSelect(id));
```

### 8. OptimizedImage Component ✅

**Location:** `src/components/performance/OptimizedImage.tsx`

```typescript
<OptimizedImage
  src="/path/to/image.jpg"
  alt="Description"
  lazy={true}
  width={800}
  height={600}
/>
```

**Features:**
- Lazy loading with Intersection Observer
- WebP/AVIF format detection and fallbacks
- Blur-up placeholder effect
- Responsive srcset support

### 9. Debouncing/Throttling Utilities ✅

**Location:** `src/lib/performance/throttle.ts`

```typescript
// Debounced search
const debouncedSearch = useDebouncedCallback((query) => {
  performSearch(query);
}, 300);

// Throttled scroll
const handleScroll = useThrottledCallback((e) => {
  savePosition(e.target.scrollTop);
}, 100);

// RAF-throttled animations
const handleMouseMove = useRafCallback((e) => {
  updatePosition(e.clientX, e.clientY);
});
```

### 10. Performance Monitoring ✅

**Location:** `src/lib/performance/index.ts`

```typescript
// Web Vitals reporting
reportWebVitals({ name: 'FCP', value: 1200, rating: 'good', entries: [] });

// Performance marks
mark('render-start');
// ... render
mark('render-end');
const duration = measure('render-time', 'render-start', 'render-end');

// Frame rate monitoring
const { fps, isStable } = useFrameRateMonitor();
```

## Vite Build Configuration

### Production Optimizations

```typescript
// vite.config.ts
build: {
  minify: 'terser',
  terserOptions: {
    compress: {
      drop_console: true,
      drop_debugger: true,
    },
  },
  rollupOptions: {
    output: {
      manualChunks: { /* chunks */ },
    },
  },
  target: 'es2020',
  chunkSizeWarningLimit: 500,
}
```

## Usage Examples

### Lazy Loading Views

```typescript
import { preloadView } from '@a2r/platform';

// In your component
useEffect(() => {
  // Preload terminal when user hovers over terminal button
  const timer = setTimeout(() => preloadView('terminal'), 100);
  return () => clearTimeout(timer);
}, []);
```

### Virtual Scrolling for Messages

```typescript
import { VirtualMessageList } from '@a2r/platform';

function ChatContainer({ messages }) {
  return (
    <VirtualMessageList
      messages={messages}
      className="h-full"
      autoScroll={true}
    />
  );
}
```

### Memoized Component

```typescript
import { memoWithComparison } from '@a2r/platform';

function MessageListComponent({ messages, onSelect }) {
  return (
    <div>
      {messages.map(msg => (
        <Message key={msg.id} message={msg} onClick={onSelect} />
      ))}
    </div>
  );
}

// Only re-renders when messages array reference changes
export const MessageList = memoWithComparison(
  MessageListComponent,
  ['messages']
);
```

## Measurement Commands

```bash
# Build with bundle analysis
ANALYZE=true pnpm build

# Build for production
pnpm build

# Preview production build
pnpm preview

# Type check
pnpm typecheck
```

## Future Optimizations

1. **Service Worker** - Cache static assets
2. **HTTP/2 Server Push** - Preload critical resources
3. **Critical CSS** - Inline above-fold styles
4. **Image CDN** - Automatic format/resize optimization
5. **Web Workers** - Offload heavy computations

## Performance Budget

```typescript
const budget = {
  fcp: 1500,           // First Contentful Paint
  lcp: 2500,           // Largest Contentful Paint
  tti: 3000,           // Time to Interactive
  bundleSize: 512000,  // 500KB initial bundle
};
```

Monitor with:
```typescript
const { pass, violations } = checkPerformanceBudget({
  fcp: performanceMetrics.fcp,
  bundleSize: bundleReport.initial,
}, budget);
```
