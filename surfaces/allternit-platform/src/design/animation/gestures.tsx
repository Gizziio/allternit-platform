/**
 * Gesture Support
 * 
 * Swipe, pan, and pull-to-refresh gesture handlers.
 * All use Framer Motion's drag system for smooth performance.
 */

'use client';

import React, { useRef, useState, useCallback } from 'react';
import { 
  motion, 
  useDragControls, 
  PanInfo, 
  useMotionValue, 
  useTransform,
  animate,
} from 'framer-motion';
import { useReducedMotion } from './accessibility';
import { animationTiming } from './timing';

export type SwipeDirection = 'left' | 'right' | 'up' | 'down';

export interface SwipeOptions {
  /** Directions to detect */
  direction?: SwipeDirection | SwipeDirection[];
  /** Minimum distance to trigger swipe (px) */
  threshold?: number;
  /** Velocity threshold (px/ms) */
  velocity?: number;
  /** Callback when swipe is detected */
  onSwipe?: (direction: SwipeDirection) => void;
  /** Callback during swipe gesture */
  onSwipeProgress?: (offset: number, direction: SwipeDirection) => void;
  /** Elasticity of the drag (0-1) */
  elasticity?: number;
}

/**
 * Hook for swipe gesture detection.
 * Returns drag controls and gesture state.
 * 
 * @example
 * const { ref, controls, direction } = useSwipe({
 *   onSwipe: (dir) => console.log('Swiped:', dir),
 *   threshold: 50
 * });
 * 
 * <motion.div ref={ref} drag="x" dragControls={controls} />
 */
export function useSwipe(options: SwipeOptions = {}) {
  const {
    direction = ['left', 'right'],
    threshold = 50,
    velocity = 0.5,
    onSwipe,
    onSwipeProgress,
    elasticity = 0.2,
  } = options;

  const [swipeDirection, setSwipeDirection] = useState<SwipeDirection | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const controls = useDragControls();
  const ref = useRef<HTMLDivElement>(null);

  const directions = Array.isArray(direction) ? direction : [direction];

  const handleDragStart = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleDragEnd = useCallback((
    event: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo
  ) => {
    setIsDragging(false);
    
    const { offset, velocity: dragVelocity } = info;
    let detectedDirection: SwipeDirection | null = null;

    // Check horizontal swipes
    if (directions.includes('left') && (offset.x < -threshold || dragVelocity.x < -velocity)) {
      detectedDirection = 'left';
    } else if (directions.includes('right') && (offset.x > threshold || dragVelocity.x > velocity)) {
      detectedDirection = 'right';
    }

    // Check vertical swipes
    if (directions.includes('up') && (offset.y < -threshold || dragVelocity.y < -velocity)) {
      detectedDirection = 'up';
    } else if (directions.includes('down') && (offset.y > threshold || dragVelocity.y > velocity)) {
      detectedDirection = 'down';
    }

    if (detectedDirection) {
      setSwipeDirection(detectedDirection);
      onSwipe?.(detectedDirection);
    }
  }, [directions, threshold, velocity, onSwipe]);

  const handleDrag = useCallback((
    event: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo
  ) => {
    const { offset } = info;
    let currentDirection: SwipeDirection = 'right';
    
    if (Math.abs(offset.x) > Math.abs(offset.y)) {
      currentDirection = offset.x > 0 ? 'right' : 'left';
    } else {
      currentDirection = offset.y > 0 ? 'down' : 'up';
    }
    
    onSwipeProgress?.(Math.max(Math.abs(offset.x), Math.abs(offset.y)), currentDirection);
  }, [onSwipeProgress]);

  return {
    ref,
    controls,
    swipeDirection,
    isDragging,
    handlers: {
      onDragStart: handleDragStart,
      onDragEnd: handleDragEnd,
      onDrag: handleDrag,
    },
  };
}

export interface PanOptions {
  /** Axis to pan on */
  axis?: 'x' | 'y' | 'both';
  /** Constraints for panning */
  constraints?: { left?: number; right?: number; top?: number; bottom?: number };
  /** Callback during pan */
  onPan?: (info: PanInfo) => void;
  /** Callback when pan ends */
  onPanEnd?: (info: PanInfo) => void;
  /** Whether to snap back when released */
  snapBack?: boolean;
}

/**
 * Hook for pan gestures with constraints.
 * 
 * @example
 * const { ref, x, y } = usePan({
 *   axis: 'x',
 *   constraints: { left: -100, right: 100 }
 * });
 * 
 * <motion.div ref={ref} style={{ x, y }} />
 */
export function usePan(options: PanOptions = {}) {
  const {
    axis = 'both',
    constraints,
    onPan,
    onPanEnd,
    snapBack = true,
  } = options;

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const ref = useRef<HTMLDivElement>(null);

  const handlePan = useCallback((
    event: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo
  ) => {
    onPan?.(info);
  }, [onPan]);

  const handlePanEnd = useCallback((
    event: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo
  ) => {
    onPanEnd?.(info);

    if (snapBack) {
      animate(x, 0, { type: 'spring', stiffness: 300, damping: 30 });
      animate(y, 0, { type: 'spring', stiffness: 300, damping: 30 });
    }
  }, [onPanEnd, snapBack, x, y]);

  const dragProps = {
    drag: axis === 'both' ? true : axis,
    dragConstraints: constraints,
    onPan: handlePan,
    onPanEnd: handlePanEnd,
    style: { x, y },
  };

  return {
    ref,
    x,
    y,
    dragProps,
  };
}

export interface PullToRefreshProps {
  /** Callback when refresh is triggered */
  onRefresh: () => Promise<void>;
  /** Minimum pull distance to trigger refresh (px) */
  threshold?: number;
  /** Maximum pull distance (px) */
  maxPull?: number;
  /** Children to render */
  children: React.ReactNode;
  /** Custom CSS class */
  className?: string;
  /** Custom refresh indicator */
  indicator?: React.ReactNode;
  /** Whether refresh is currently in progress */
  refreshing?: boolean;
}

/**
 * PullToRefresh component for mobile-style refresh gesture.
 * 
 * @example
 * <PullToRefresh onRefresh={async () => await fetchData()}>
 *   <ScrollableContent />
 * </PullToRefresh>
 */
export function PullToRefresh({
  onRefresh,
  threshold = 80,
  maxPull = 120,
  children,
  className,
  indicator,
  refreshing: externalRefreshing,
}: PullToRefreshProps) {
  const prefersReducedMotion = useReducedMotion();
  const [internalRefreshing, setInternalRefreshing] = useState(false);
  const [pullProgress, setPullProgress] = useState(0);
  
  const isRefreshing = externalRefreshing ?? internalRefreshing;
  const y = useMotionValue(0);
  const rotate = useTransform(y, [0, threshold], [0, 360]);
  const opacity = useTransform(y, [0, threshold * 0.5], [0, 1]);

  const handleDragEnd = useCallback(async (
    event: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo
  ) => {
    const pullDistance = info.offset.y;
    
    if (pullDistance > threshold && !isRefreshing) {
      setInternalRefreshing(true);
      
      try {
        await onRefresh();
      } finally {
        setInternalRefreshing(false);
        setPullProgress(0);
        animate(y, 0, { 
          type: 'spring', 
          stiffness: 400, 
          damping: 30 
        });
      }
    } else {
      animate(y, 0, { 
        type: 'spring', 
        stiffness: 400, 
        damping: 30 
      });
    }
  }, [threshold, isRefreshing, onRefresh, y]);

  const handleDrag = useCallback((
    event: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo
  ) => {
    const pullDistance = Math.min(info.offset.y, maxPull);
    const progress = Math.min(pullDistance / threshold, 1);
    setPullProgress(progress);
  }, [threshold, maxPull]);

  // Disable pull-to-refresh for reduced motion preference
  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div className={className} style={{ overflow: 'hidden' }}>
      {/* Pull indicator */}
      <motion.div
        style={{
          height: y,
          opacity,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {indicator || (
          <motion.div
            style={{
              rotate,
              width: 24,
              height: 24,
              border: '2px solid currentColor',
              borderTopColor: 'transparent',
              borderRadius: '50%',
            }}
            animate={isRefreshing ? { rotate: 360 } : {}}
            transition={isRefreshing ? { 
              repeat: Infinity, 
              duration: 0.8, 
              ease: 'linear' 
            } : {}}
          />
        )}
      </motion.div>

      {/* Content */}
      <motion.div
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.2}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        style={{ y }}
      >
        {children}
      </motion.div>
    </div>
  );
}

/**
 * DraggableList - Reorderable list with drag gestures.
 */
export function DraggableList<T>({
  items,
  onReorder,
  renderItem,
  className,
}: {
  items: T[];
  onReorder: (items: T[]) => void;
  renderItem: (item: T, index: number, dragControls: ReturnType<typeof useDragControls>) => React.ReactNode;
  className?: string;
}) {
  const prefersReducedMotion = useReducedMotion();
  
  return (
    <div className={className}>
      {items.map((item, index) => {
        const controls = useDragControls();
        return (
          <React.Fragment key={index}>
            {renderItem(item, index, controls)}
          </React.Fragment>
        );
      })}
    </div>
  );
}

/**
 * SwipeableItem - Item that can be swiped left/right to reveal actions.
 */
export function SwipeableItem({
  children,
  leftAction,
  rightAction,
  onSwipeLeft,
  onSwipeRight,
  threshold = 100,
  className,
}: {
  children: React.ReactNode;
  leftAction?: React.ReactNode;
  rightAction?: React.ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number;
  className?: string;
}) {
  const prefersReducedMotion = useReducedMotion();
  const x = useMotionValue(0);
  const background = useTransform(
    x,
    [-threshold, 0, threshold],
    ['#ef4444', 'transparent', '#22c55e']
  );

  const handleDragEnd = useCallback((
    event: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo
  ) => {
    if (info.offset.x < -threshold && onSwipeLeft) {
      onSwipeLeft();
    } else if (info.offset.x > threshold && onSwipeRight) {
      onSwipeRight();
    }
    animate(x, 0, { type: 'spring', stiffness: 500, damping: 50 });
  }, [threshold, onSwipeLeft, onSwipeRight, x]);

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div 
      className={className}
      style={{ background, position: 'relative' }}
    >
      {/* Background actions */}
      <div 
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0 16px',
          pointerEvents: 'none',
        }}
      >
        {leftAction}
        {rightAction}
      </div>

      {/* Draggable content */}
      <motion.div
        drag="x"
        dragConstraints={{ left: rightAction ? -threshold : 0, right: leftAction ? threshold : 0 }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        style={{ x, background: 'inherit' }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}
