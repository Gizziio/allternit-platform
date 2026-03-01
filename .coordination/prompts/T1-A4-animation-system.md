# T1-A4: Animation System

## Agent Role
Motion Designer - Animation Specialist

## Task
Create a comprehensive animation system using Framer Motion for all UI interactions.

## Deliverables

### 1. Setup Framer Motion

Install and configure:
```bash
cd 6-ui/a2r-platform
pnpm add framer-motion
```

Create: `6-ui/a2r-platform/src/design/animation/index.ts`

### 2. Core Animation Components

Create animation wrapper components:

```typescript
// Fade.tsx - Fade in/out
interface FadeProps {
  children: React.ReactNode;
  in?: boolean;
  duration?: number;
  delay?: number;
  direction?: 'up' | 'down' | 'left' | 'right' | 'none';
  distance?: number;
}

// Slide.tsx - Slide transitions
interface SlideProps {
  children: React.ReactNode;
  direction: 'up' | 'down' | 'left' | 'right';
  in?: boolean;
  distance?: number;
}

// Scale.tsx - Scale animations
interface ScaleProps {
  children: React.ReactNode;
  in?: boolean;
  initial?: number;
  final?: number;
}

// Stagger.tsx - Staggered children
interface StaggerProps {
  children: React.ReactNode[];
  staggerDelay?: number;
  direction?: 'up' | 'down' | 'left' | 'right';
}
```

### 3. Page Transitions

Create: `6-ui/a2r-platform/src/design/animation/PageTransition.tsx`

```typescript
// For route transitions
export function PageTransition({ children, mode = 'fade' }: PageTransitionProps) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2 }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
```

### 4. Micro-Interactions

Create interaction components:

```typescript
// Button animations
export const buttonTap = {
  scale: 0.97,
  transition: { duration: 0.1 },
};

// Hover lift effect
export const hoverLift = {
  y: -2,
  boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
  transition: { duration: 0.2 },
};

// Focus ring animation
export const focusRing = {
  boxShadow: '0 0 0 3px rgba(14,165,233,0.3)',
};

// Loading pulse
export const pulseAnimation = {
  scale: [1, 1.02, 1],
  opacity: [1, 0.8, 1],
  transition: { duration: 1.5, repeat: Infinity },
};
```

### 5. Skeleton Loading

Create: `6-ui/a2r-platform/src/design/animation/Skeleton.tsx`

```typescript
interface SkeletonProps {
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
  width?: string | number;
  height?: string | number;
  animate?: boolean;
}

// Shimmer effect using Framer Motion
```

### 6. Layout Animations

Create: `6-ui/a2r-platform/src/design/animation/LayoutAnimations.tsx`

```typescript
// Auto-animate layout changes
export function AnimatedList({ children }: { children: React.ReactNode }) {
  return (
    <motion.div layout>
      <AnimatePresence>
        {React.Children.map(children, (child, i) => (
          <motion.div
            key={i}
            layout
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
          >
            {child}
          </motion.div>
        ))}
      </AnimatePresence>
    </motion.div>
  );
}
```

### 7. Gesture Support

Create gesture handlers:

```typescript
// Swipe gestures for mobile
export function useSwipe(options: SwipeOptions) {
  return useDragControls();
}

// Pan gestures
export function usePan() {
  // Pan gesture logic
}

// Pull-to-refresh
export function PullToRefresh({ onRefresh }: { onRefresh: () => Promise<void> }) {
  // Pull-to-refresh component
}
```

### 8. Animation Presets

Create: `6-ui/a2r-platform/src/design/animation/presets.ts`

```typescript
export const presets = {
  // Modal/dialog
  modal: {
    overlay: { opacity: [0, 1] },
    content: { scale: [0.95, 1], opacity: [0, 1] },
  },
  
  // Toast notifications
  toast: {
    enter: { x: [100, 0], opacity: [0, 1] },
    exit: { x: [0, 100], opacity: [1, 0] },
  },
  
  // Dropdown menus
  dropdown: {
    enter: { scale: [0.95, 1], opacity: [0, 1], y: [-10, 0] },
    exit: { scale: [1, 0.95], opacity: [1, 0], y: [0, -10] },
  },
  
  // Tooltips
  tooltip: {
    enter: { opacity: [0, 1], y: [5, 0] },
    exit: { opacity: [1, 0], y: [0, 5] },
  },
  
  // Drawer/sidebar
  drawer: {
    enter: { x: [-100, 0] },
    exit: { x: [0, -100] },
  },
};
```

### 9. Reduced Motion Support

Create accessibility wrapper:

```typescript
export function useReducedMotion(): boolean {
  return useReducedMotionFramer();
}

// Wrapper that respects prefers-reduced-motion
export function AccessibleMotion({ children, fallback, ...props }) {
  const shouldReduceMotion = useReducedMotion();
  
  if (shouldReduceMotion) {
    return <>{fallback || children}</>;
  }
  
  return <motion.div {...props}>{children}</motion.div>;
}
```

### 10. Integration with T1-A3

Coordinate with Glass System:

```typescript
// Animated glass card
export function AnimatedGlassCard({ children, ...props }) {
  return (
    <motion.div
      whileHover={{ y: -2, scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      transition={{ type: 'spring', stiffness: 400 }}
    >
      <GlassCard {...props}>
        {children}
      </GlassCard>
    </motion.div>
  );
}
```

### 11. Animation Showcase

Create: `6-ui/a2r-platform/src/dev/animation-showcase.tsx`

Demo all animations:
- Page transitions
- Micro-interactions
- Skeleton states
- Gesture demos
- Reduced motion toggle

## Requirements

- Must respect `prefers-reduced-motion`
- Must use GPU-accelerated properties (transform, opacity)
- Must have consistent timing (coordinate with T1-A1 animation tokens)
- Must be TypeScript typed
- Must work with server components where possible

## Dependencies

- Coordinate with T1-A1 for timing tokens
- Coordinate with T1-A3 for glass animations
- Check existing animation usage

## Success Criteria
- [ ] Framer Motion installed and configured
- [ ] 5 core animation components created
- [ ] Page transitions working
- [ ] Micro-interactions documented
- [ ] Skeleton component complete
- [ ] Accessibility support (reduced motion)
- [ ] Animation showcase page
- [ ] No SYSTEM_LAW violations
