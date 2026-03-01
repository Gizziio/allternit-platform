# T4-A3: Performance Optimization

## Agent Role
Performance Engineer

## Task
Optimize UI performance: bundle size, rendering, and load times.

## Deliverables

### 1. Bundle Analysis

```bash
# Install bundle analyzer
pnpm add -D @vitejs/plugin-visualizer

# Add to vite.config.ts
import { visualizer } from 'rollup-plugin-visualizer';

export default {
  plugins: [
    // ... other plugins
    visualizer({
      open: true,
      gzipSize: true,
      brotliSize: true,
    }),
  ],
};
```

Run and analyze bundle size.

### 2. Code Splitting

Implement route-based code splitting:

```typescript
// Lazy load views
const ChatView = lazy(() => import('./views/chat/ChatView'));
const AgentsView = lazy(() => import('./views/agents/AgentsView'));
const WorkflowsView = lazy(() => import('./views/workflows/WorkflowsView'));
const SettingsView = lazy(() => import('./views/settings/SettingsView'));

// Loading fallback
function ViewSkeleton() {
  return (
    <div className="h-full flex flex-col p-4 space-y-4">
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

// Usage with Suspense
<Suspense fallback={<ViewSkeleton />}>
  <ChatView />
</Suspense>
```

### 3. Component Lazy Loading

Lazy load heavy components:

```typescript
// Lazy load Monaco editor or heavy components
const CodeEditor = lazy(() => import('./components/CodeEditor'));
const MermaidDiagram = lazy(() => import('./components/MermaidDiagram'));
const Terminal = lazy(() => import('./components/Terminal'));

// Intersection observer for below-fold content
function LazyComponent({ children, threshold = 0.1 }) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold }
    );
    
    if (ref.current) {
      observer.observe(ref.current);
    }
    
    return () => observer.disconnect();
  }, [threshold]);
  
  return (
    <div ref={ref}>
      {isVisible ? children : <Skeleton className="h-64" />}
    </div>
  );
}
```

### 4. Virtual Scrolling

Implement virtual scrolling for long lists:

```typescript
// Virtual list for chat messages
import { useVirtualizer } from '@tanstack/react-virtual';

interface VirtualMessageListProps {
  messages: Message[];
}

export function VirtualMessageList({ messages }: VirtualMessageListProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  
  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100, // Average message height
    overscan: 5, // Render extra items
  });
  
  const virtualItems = virtualizer.getVirtualItems();
  
  return (
    <div ref={parentRef} className="h-full overflow-auto">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualItems.map((virtualItem) => (
          <div
            key={virtualItem.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualItem.size}px`,
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            <MessageItem message={messages[virtualItem.index]} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 5. Memoization Strategy

Apply proper memoization:

```typescript
// Memoize expensive computations
const sortedMessages = useMemo(() => {
  return [...messages].sort((a, b) => a.timestamp - b.timestamp);
}, [messages]);

// Memoize callbacks
const handleSend = useCallback((message: string) => {
  sendMessage(message);
}, [sendMessage]);

// Memoize components
const MessageList = memo(function MessageList({ messages }) {
  return (
    <div>
      {messages.map(message => (
        <MessageItem key={message.id} message={message} />
      ))}
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison
  return prevProps.messages.length === nextProps.messages.length;
});
```

### 6. Image Optimization

```typescript
// Optimized image component
interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  lazy?: boolean;
}

export function OptimizedImage({ src, alt, width, height, lazy = true }: OptimizedImageProps) {
  const [loaded, setLoaded] = useState(false);
  
  return (
    <div className="relative">
      {!loaded && <Skeleton className="absolute inset-0" />}
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        loading={lazy ? 'lazy' : 'eager'}
        onLoad={() => setLoaded(true)}
        className={cn('transition-opacity', loaded ? 'opacity-100' : 'opacity-0')}
      />
    </div>
  );
}
```

### 7. Debouncing & Throttling

```typescript
// Debounced search
const [searchQuery, setSearchQuery] = useState('');
const debouncedSearch = useDebouncedCallback((query: string) => {
  performSearch(query);
}, 300);

// Throttled scroll handler
const handleScroll = useThrottledCallback((e) => {
  saveScrollPosition(e.target.scrollTop);
}, 100);
```

### 8. Performance Monitoring

Create: `6-ui/a2r-platform/src/lib/performance.ts`

```typescript
// Web Vitals monitoring
export function reportWebVitals(metric: Metric) {
  // Send to analytics
  console.log(metric);
}

// Component render monitoring
export function useRenderCount(componentName: string) {
  const renderCount = useRef(0);
  renderCount.current++;
  
  useEffect(() => {
    console.log(`${componentName} rendered ${renderCount.current} times`);
  });
  
  return renderCount.current;
}

// Performance marks
export function mark(name: string) {
  performance.mark(name);
}

export function measure(name: string, startMark: string, endMark: string) {
  performance.measure(name, startMark, endMark);
  const entries = performance.getEntriesByName(name);
  return entries[entries.length - 1];
}
```

### 9. Tree Shaking

Ensure proper tree shaking:

```typescript
// Good - allows tree shaking
export { Button } from './Button';
export { Input } from './Input';

// Avoid - prevents tree shaking
import * as Components from './components';
export { Components };
```

### 10. Build Optimization

Update Vite config:

```typescript
// vite.config.ts
export default {
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks
          'vendor-react': ['react', 'react-dom'],
          'vendor-ui': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu'],
          'vendor-utils': ['lodash-es', 'date-fns'],
          // Feature chunks
          'feature-chat': ['./src/views/chat/index.ts'],
          'feature-agents': ['./src/views/agents/index.ts'],
        },
      },
    },
    // Minification
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
    // Chunk size warning
    chunkSizeWarningLimit: 500,
  },
};
```

## Performance Targets

- First Contentful Paint: < 1.5s
- Time to Interactive: < 3s
- Bundle size: < 500KB (initial)
- Lighthouse score: > 90

## Success Criteria
- [ ] Bundle analysis complete
- [ ] Route-based code splitting
- [ ] Lazy loading for heavy components
- [ ] Virtual scrolling for lists
- [ ] Proper memoization
- [ ] Image optimization
- [ ] Debouncing/throttling
- [ ] Performance monitoring
- [ ] Build optimization
- [ ] No SYSTEM_LAW violations
