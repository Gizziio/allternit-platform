/**
 * Layout Animation Components
 * 
 * Auto-animate layout changes with AnimatePresence.
 * Perfect for lists, grids, and dynamic content.
 */

'use client';

import React from 'react';
import { motion, AnimatePresence, LayoutGroup, TargetAndTransition } from 'framer-motion';
import { useReducedMotion } from './accessibility';
import { animationTiming } from './timing';

export interface AnimatedListProps {
  children: React.ReactNode;
  /** Custom CSS class */
  className?: string;
  /** Custom inline styles */
  style?: React.CSSProperties;
  /** Animation duration */
  duration?: number;
  /** Stagger delay between items */
  staggerDelay?: number;
  /** Whether to animate layout changes */
  layout?: boolean;
}

/**
 * AnimatedList - Wraps children in animated layout containers.
 * Automatically animates items entering, leaving, and reordering.
 * 
 * @example
 * <AnimatedList>
 *   {items.map(item => (
 *     <Card key={item.id}>{item.content}</Card>
 *   ))}
 * </AnimatedList>
 */
export function AnimatedList({
  children,
  className,
  style,
  duration = animationTiming.base,
  staggerDelay = animationTiming.stagger.fast,
  layout = true,
}: AnimatedListProps) {
  const prefersReducedMotion = useReducedMotion();
  const actualDuration = prefersReducedMotion 
    ? animationTiming.reduced.duration 
    : duration;
  const actualStagger = prefersReducedMotion 
    ? animationTiming.reduced.stagger 
    : staggerDelay;

  return (
    <LayoutGroup>
      <motion.div
        layout={layout}
        className={className}
        style={style}
      >
        <AnimatePresence mode="popLayout">
          {React.Children.map(children, (child, index) => {
            if (!React.isValidElement(child)) return child;

            return (
              <motion.div
                key={child.key || index}
                layout={layout}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{
                  duration: actualDuration,
                  delay: index * actualStagger,
                  ease: animationTiming.easing.standard,
                  layout: {
                    duration: actualDuration,
                    ease: animationTiming.easing.standard,
                  },
                }}
              >
                {child}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </motion.div>
    </LayoutGroup>
  );
}

export interface LayoutItemProps {
  children: React.ReactNode;
  /** Unique key for AnimatePresence */
  itemKey: string;
  /** Custom CSS class */
  className?: string;
  /** Custom inline styles */
  style?: React.CSSProperties;
  /** Animation duration */
  duration?: number;
  /** Whether to animate layout changes */
  layout?: boolean;
  /** Initial animation state */
  initial?: TargetAndTransition;
  /** Exit animation state */
  exit?: TargetAndTransition;
}

/**
 * LayoutItem - Individual animated item for use with AnimatePresence.
 * 
 * @example
 * <AnimatePresence>
 *   {items.map(item => (
 *     <LayoutItem key={item.id} itemKey={item.id}>
 *       <Card>{item.content}</Card>
 *     </LayoutItem>
 *   ))}
 * </AnimatePresence>
 */
export function LayoutItem({
  children,
  itemKey,
  className,
  style,
  duration = animationTiming.base,
  layout = true,
  initial,
  exit,
}: LayoutItemProps) {
  const prefersReducedMotion = useReducedMotion();
  const actualDuration = prefersReducedMotion 
    ? animationTiming.reduced.duration 
    : duration;

  const defaultInitial = { opacity: 0, scale: 0.8 };
  const defaultExit = { opacity: 0, scale: 0.8 };

  return (
    <motion.div
      key={itemKey}
      layout={layout}
      initial={prefersReducedMotion ? { opacity: 0 } : (initial || defaultInitial)}
      animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
      exit={prefersReducedMotion ? { opacity: 0 } : (exit || defaultExit)}
      transition={{
        duration: actualDuration,
        ease: animationTiming.easing.standard,
        layout: {
          duration: actualDuration,
          ease: animationTiming.easing.standard,
        },
      }}
      className={className}
      style={style}
    >
      {children}
    </motion.div>
  );
}

/**
 * ReorderGroup - Container for reorderable lists.
 * Note: This is a simplified version. For full drag-to-reorder,
 * import Reorder from 'framer-motion' directly.
 */
export function ReorderGroup<T extends { id: string }>({
  items,
  onReorder,
  renderItem,
  className,
  style,
}: {
  items: T[];
  onReorder: (items: T[]) => void;
  renderItem: (item: T, index: number) => React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const prefersReducedMotion = useReducedMotion();

  // Simplified reorder without drag - uses buttons
  const moveItem = (index: number, direction: number) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= items.length) return;
    
    const newItems = [...items];
    const [moved] = newItems.splice(index, 1);
    newItems.splice(newIndex, 0, moved);
    onReorder(newItems);
  };

  return (
    <motion.div
      layout
      className={className}
      style={style}
    >
      <AnimatePresence mode="popLayout">
        {items.map((item, index) => (
          <motion.div
            key={item.id}
            layout={!prefersReducedMotion}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{
              layout: {
                duration: prefersReducedMotion ? 0 : animationTiming.base,
              },
            }}
          >
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                <button
                  onClick={() => moveItem(index, -1)}
                  disabled={index === 0}
                  className="px-2 py-1 text-xs bg-white/10 rounded disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  onClick={() => moveItem(index, 1)}
                  disabled={index === items.length - 1}
                  className="px-2 py-1 text-xs bg-white/10 rounded disabled:opacity-30"
                >
                  ↓
                </button>
              </div>
              {renderItem(item, index)}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </motion.div>
  );
}

// Re-export LayoutGroup for convenience
export { LayoutGroup };
