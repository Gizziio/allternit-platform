# T1-A3: Glass Morphism System

## Agent Role
Visual Designer - Glass System Specialist

## Task
Polish and extend the glass morphism design system for production use.

## Deliverables

### 1. Audit Existing Glass Components

Review current components in:
- `6-ui/a2r-platform/src/design/GlassCard.tsx`
- `6-ui/a2r-platform/src/design/GlassSurface.tsx`
- `6-ui/a2r-platform/src/design/shadows.ts`

### 2. Enhanced GlassCard Component

Polish `GlassCard.tsx`:

```typescript
interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  
  // Elevation levels with glass-specific styling
  elevation?: 'flat' | 'raised' | 'floating' | 'overlay';
  
  // Visual variants
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  
  // Interactive states
  hover?: boolean | 'lift' | 'glow' | 'scale';
  active?: boolean;
  disabled?: boolean;
  
  // Border styling
  border?: boolean | 'subtle' | 'glow' | 'accent';
  
  // Backdrop blur intensity
  blur?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  
  // Background opacity
  opacity?: 'none' | 'low' | 'medium' | 'high';
  
  // Size constraints
  padding?: 'none' | 'sm' | 'md' | 'lg';
  rounded?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'full';
  
  // Animation
  animate?: boolean;
  transition?: 'fast' | 'normal' | 'slow';
}
```

Features to add:
- [ ] Proper backdrop-filter fallbacks
- [ ] GPU-accelerated transforms
- [ ] Focus ring styling
- [ ] Hover state animations
- [ ] Active/pressed states
- [ ] Disabled states with reduced opacity

### 3. Create GlassSurface Variants

Extend `GlassSurface.tsx`:

```typescript
// Create specialized surface components:
- GlassPanel      // Side panels, drawers
- GlassDialog     // Modal/dialog backgrounds
- GlassTooltip    // Tooltip backgrounds
- GlassPopover    // Popover/menu backgrounds
- GlassInput      // Input field backgrounds
- GlassButton     // Button with glass effect
```

### 4. Glass Effects Utilities

Create: `6-ui/a2r-platform/src/design/glass-utils.ts`

```typescript
// CSS-in-JS utilities for glass effects
export const glassEffects = {
  // Base glass effect
  base: `
    background: rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
  `,
  
  // Elevation levels
  elevation: {
    flat: 'box-shadow: none;',
    raised: 'box-shadow: 0 4px 24px rgba(0,0,0,0.12);',
    floating: 'box-shadow: 0 8px 32px rgba(0,0,0,0.16);',
    overlay: 'box-shadow: 0 24px 48px rgba(0,0,0,0.24);',
  },
  
  // Border treatments
  border: {
    subtle: 'border: 1px solid rgba(255,255,255,0.1);',
    glow: 'border: 1px solid rgba(255,255,255,0.2); box-shadow: inset 0 1px 0 rgba(255,255,255,0.1);',
    accent: 'border: 1px solid rgba(14,165,233,0.3);',
  },
  
  // Dark mode overrides
  dark: {
    base: 'background: rgba(0,0,0,0.3);',
    // ...
  },
};

// Tailwind plugin for glass utilities
export const glassPlugin = {
  // Custom Tailwind classes
  // .glass, .glass-raised, .glass-floating, etc.
};
```

### 5. useGlass Hook

Create: `6-ui/a2r-platform/src/design/hooks/useGlass.ts`

```typescript
export function useGlass(options: GlassOptions) {
  // Hook for dynamic glass effects
  // Returns className and styles based on props
}

// Usage:
const { className, style } = useGlass({
  elevation: 'floating',
  blur: 'lg',
  hover: 'lift',
});
```

### 6. Glass Theme Integration

Integrate with T1-A1's design tokens:

```typescript
// Connect shadows from tokens
import { shadows } from '../tokens/shadows';

// Use in glass components
const glassShadows = {
  flat: shadows.none,
  raised: shadows.glass.DEFAULT,
  floating: shadows.glass.lg,
  overlay: shadows.xl,
};
```

### 7. Fallback Support

Create fallbacks for browsers without backdrop-filter:

```typescript
// Progressive enhancement
export const glassFallback = {
  // Solid backgrounds for older browsers
  base: 'background: rgba(255,255,255,0.95);',
  dark: 'background: rgba(30,30,30,0.95);',
};

// Feature detection hook
export function useBackdropFilterSupport(): boolean {
  // Detect support
}
```

### 8. Visual Test Page

Create: `6-ui/a2r-platform/src/dev/glass-showcase.tsx`

Show all glass variants:
- All elevation levels
- All variants (default, primary, success, etc.)
- All hover effects
- Light and dark modes
- Interactive playground

## Requirements

- Must work in both light and dark modes
- Must have fallbacks for unsupported browsers
- Must be GPU-accelerated (transform, opacity only)
- Must pass accessibility contrast checks
- Must integrate with T1-A1 design tokens

## Dependencies

- Coordinate with T1-A1 for token integration
- Coordinate with T1-A4 for animation integration
- Check existing usage in codebase

## Success Criteria
- [ ] GlassCard fully polished with all props
- [ ] 6 new surface variants created
- [ ] Glass utilities created
- [ ] useGlass hook working
- [ ] Visual test page complete
- [ ] No SYSTEM_LAW violations
