/**
 * VirtualList - Virtual Scrolling for Long Lists
 * 
 * Efficiently renders large lists by only mounting visible items.
 * Uses fixed height estimation with dynamic resizing support.
 * 
 * Usage:
 * <VirtualList
 *   items={messages}
 *   renderItem={(message) => <MessageItem message={message} />}
 *   estimateSize={() => 80}
 *   overscan={5}
 * />
 */

import React, { useRef, useEffect, useState, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react';

export interface VirtualListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  estimateSize: (index: number) => number;
  overscan?: number;
  className?: string;
  style?: React.CSSProperties;
  /** Called when scroll reaches the end */
  onEndReached?: () => void;
  /** Distance from end to trigger onEndReached (px) */
  endReachedThreshold?: number;
  /** Scroll to bottom on new items */
  autoScroll?: boolean;
  /** Key extractor for items */
  keyExtractor?: (item: T, index: number) => string;
  /** Header component */
  header?: React.ReactNode;
  /** Footer component */
  footer?: React.ReactNode;
  /** Enable sticky headers (for grouped lists) */
  stickyHeaders?: boolean;
}

interface VirtualItem {
  index: number;
  key: string;
  style: React.CSSProperties;
}

export interface VirtualListRef {
  scrollToIndex: (index: number, behavior?: ScrollBehavior) => void;
  scrollToTop: (behavior?: ScrollBehavior) => void;
  scrollToBottom: (behavior?: ScrollBehavior) => void;
  getScrollOffset: () => number;
}

/**
 * VirtualList - Renders only visible items for performance
 */
function VirtualListInner<T>(
  {
    items,
    renderItem,
    estimateSize,
    overscan = 5,
    className = '',
    style = {},
    onEndReached,
    endReachedThreshold = 200,
    autoScroll = false,
    keyExtractor,
    header,
    footer,
  }: VirtualListProps<T>,
  ref: React.Ref<VirtualListRef>
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const measuredHeights = useRef<Map<number, number>>(new Map());
  const itemElements = useRef<Map<number, HTMLDivElement>>(new Map());
  const lastScrollOffset = useRef(0);
  const endReachedCalled = useRef(false);

  // Calculate total height based on estimates and measurements
  const totalHeight = useMemo(() => {
    let height = 0;
    for (let i = 0; i < items.length; i++) {
      height += measuredHeights.current.get(i) || estimateSize(i);
    }
    return height;
  }, [items.length, estimateSize]);

  // Get item offset from top
  const getItemOffset = useCallback((index: number): number => {
    let offset = 0;
    for (let i = 0; i < index; i++) {
      offset += measuredHeights.current.get(i) || estimateSize(i);
    }
    return offset;
  }, [estimateSize]);

  // Find visible range
  const visibleRange = useMemo(() => {
    let start = 0;
    let offset = 0;
    
    // Binary search for start index
    let low = 0;
    let high = items.length - 1;
    
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const midOffset = getItemOffset(mid);
      const midHeight = measuredHeights.current.get(mid) || estimateSize(mid);
      
      if (midOffset + midHeight < scrollTop) {
        low = mid + 1;
      } else {
        high = mid - 1;
        start = mid;
      }
    }

    // Find end index
    let end = start;
    let currentOffset = getItemOffset(start);
    
    while (end < items.length && currentOffset < scrollTop + containerHeight) {
      currentOffset += measuredHeights.current.get(end) || estimateSize(end);
      end++;
    }

    // Apply overscan
    const startIndex = Math.max(0, start - overscan);
    const endIndex = Math.min(items.length, end + overscan);

    return { startIndex, endIndex };
  }, [items.length, scrollTop, containerHeight, estimateSize, getItemOffset, overscan]);

  // Measure actual item heights
  useEffect(() => {
    itemElements.current.forEach((element, index) => {
      const height = element.getBoundingClientRect().height;
      const currentHeight = measuredHeights.current.get(index);
      if (currentHeight !== height) {
        measuredHeights.current.set(index, height);
      }
    });
  });

  // Update container height
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateHeight = () => {
      setContainerHeight(container.clientHeight);
    };

    updateHeight();

    const resizeObserver = new ResizeObserver(updateHeight);
    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, []);

  // Handle scroll
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const newScrollTop = container.scrollTop;
      setScrollTop(newScrollTop);

      // Check for end reached
      if (onEndReached) {
        const scrollHeight = container.scrollHeight;
        const clientHeight = container.clientHeight;
        const scrollOffset = scrollHeight - newScrollTop - clientHeight;

        if (scrollOffset < endReachedThreshold && !endReachedCalled.current) {
          endReachedCalled.current = true;
          onEndReached();
        } else if (scrollOffset >= endReachedThreshold) {
          endReachedCalled.current = false;
        }
      }

      lastScrollOffset.current = newScrollTop;
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [onEndReached, endReachedThreshold]);

  // Auto scroll to bottom on new items
  useEffect(() => {
    if (!autoScroll || !containerRef.current) return;
    
    const container = containerRef.current;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    
    if (isNearBottom) {
      container.scrollTop = container.scrollHeight;
    }
  }, [items.length, autoScroll]);

  // Expose imperative methods
  useImperativeHandle(ref, () => ({
    scrollToIndex: (index: number, behavior: ScrollBehavior = 'smooth') => {
      const offset = getItemOffset(index);
      containerRef.current?.scrollTo({ top: offset, behavior });
    },
    scrollToTop: (behavior: ScrollBehavior = 'smooth') => {
      containerRef.current?.scrollTo({ top: 0, behavior });
    },
    scrollToBottom: (behavior: ScrollBehavior = 'smooth') => {
      const maxScroll = containerRef.current?.scrollHeight || 0;
      containerRef.current?.scrollTo({ top: maxScroll, behavior });
    },
    getScrollOffset: () => containerRef.current?.scrollTop || 0,
  }), [getItemOffset]);

  // Generate virtual items
  const virtualItems: VirtualItem[] = useMemo(() => {
    const { startIndex, endIndex } = visibleRange;
    return Array.from({ length: endIndex - startIndex }, (_, i) => {
      const index = startIndex + i;
      const offset = getItemOffset(index);
      const key = keyExtractor ? keyExtractor(items[index], index) : `item-${index}`;
      
      return {
        index,
        key,
        style: {
          position: 'absolute',
          top: offset,
          left: 0,
          right: 0,
          minHeight: estimateSize(index),
        },
      };
    });
  }, [visibleRange, items, keyExtractor, getItemOffset, estimateSize]);

  return (
    <div
      ref={containerRef}
      className={`overflow-auto ${className}`}
      style={{ ...style, position: 'relative' }}
    >
      {header}
      
      <div style={{ height: totalHeight, position: 'relative' }}>
        {virtualItems.map((virtualItem) => {
          const item = items[virtualItem.index];
          return (
            <div
              key={virtualItem.key}
              ref={(el) => {
                if (el) itemElements.current.set(virtualItem.index, el);
                else itemElements.current.delete(virtualItem.index);
              }}
              style={virtualItem.style}
              data-index={virtualItem.index}
            >
              {renderItem(item, virtualItem.index)}
            </div>
          );
        })}
      </div>
      
      {footer}
    </div>
  );
}

export const VirtualList = forwardRef(VirtualListInner) as <T>(
  props: VirtualListProps<T> & { ref?: React.Ref<VirtualListRef> }
) => React.ReactElement;

// ============================================================================
// Specialized Virtual Lists
// ============================================================================

export interface VirtualMessageListProps {
  messages: Array<{
    id: string;
    content: React.ReactNode;
    timestamp?: number;
    isUser?: boolean;
  }>;
  className?: string;
  onEndReached?: () => void;
  autoScroll?: boolean;
}

/**
 * VirtualMessageList - Optimized for chat messages
 */
export const VirtualMessageList = forwardRef<VirtualListRef, VirtualMessageListProps>(
  ({ messages, className = '', onEndReached, autoScroll = true }, ref) => {
    return (
      <VirtualList
        ref={ref}
        items={messages}
        renderItem={(message) => message.content}
        estimateSize={() => 100}
        keyExtractor={(msg) => msg.id}
        className={className}
        onEndReached={onEndReached}
        autoScroll={autoScroll}
        overscan={3}
      />
    );
  }
);

VirtualMessageList.displayName = 'VirtualMessageList';

// ============================================================================
// Hook for virtual list state
// ============================================================================

interface UseVirtualListOptions {
  itemCount: number;
  estimateSize: (index: number) => number;
  overscan?: number;
}

/**
 * Hook for managing virtual list state
 */
export function useVirtualList({ itemCount, estimateSize, overscan = 5 }: UseVirtualListOptions) {
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  const range = useMemo(() => {
    let totalOffset = 0;
    let start = 0;
    
    // Find start index
    for (let i = 0; i < itemCount; i++) {
      const size = estimateSize(i);
      if (totalOffset + size > scrollTop) {
        start = i;
        break;
      }
      totalOffset += size;
    }

    // Find end index
    let end = start;
    let visibleHeight = 0;
    for (let i = start; i < itemCount && visibleHeight < containerHeight; i++) {
      visibleHeight += estimateSize(i);
      end = i + 1;
    }

    return {
      startIndex: Math.max(0, start - overscan),
      endIndex: Math.min(itemCount, end + overscan),
    };
  }, [itemCount, scrollTop, containerHeight, estimateSize, overscan]);

  const totalHeight = useMemo(() => {
    let height = 0;
    for (let i = 0; i < itemCount; i++) {
      height += estimateSize(i);
    }
    return height;
  }, [itemCount, estimateSize]);

  return {
    range,
    totalHeight,
    setScrollTop,
    setContainerHeight,
  };
}
