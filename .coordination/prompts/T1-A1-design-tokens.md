# T1-A1: Design Token System

## Agent Role
Design System Architect - Token System

## Task
Create a comprehensive, production-ready design token system for the A2rchitect platform.

## Deliverables

### 1. Create Directory Structure
```
6-ui/a2r-platform/src/design/tokens/
├── index.ts           # Main export
├── colors.ts          # Semantic color tokens
├── typography.ts      # Typography tokens
├── spacing.ts         # Spacing scale
├── shadows.ts         # Elevation shadows
├── radii.ts           # Border radius
├── animation.ts       # Animation tokens
├── breakpoints.ts     # Responsive breakpoints
└── z-index.ts         # Z-index scale
```

### 2. Color Tokens (`colors.ts`)
Create semantic color tokens supporting:
- **Brand colors**: Primary, secondary, accent
- **Semantic colors**: Success, warning, danger, info
- **Neutral scale**: Gray 50-950 for all UI needs
- **Surface colors**: Background, elevated, overlay
- **Text colors**: Primary, secondary, muted, disabled
- **Border colors**: Default, hover, focus, active
- **Dark mode support**: All colors must have dark variants

Example structure:
```typescript
export const colors = {
  brand: {
    50: '#f0f9ff', 100: '#e0f2fe', ... 950: '#082f49',
    DEFAULT: '#0ea5e9',
    light: '#38bdf8',
    dark: '#0284c7',
  },
  semantic: {
    success: { light: '#22c55e', dark: '#4ade80' },
    warning: { light: '#f59e0b', dark: '#fbbf24' },
    danger: { light: '#ef4444', dark: '#f87171' },
    info: { light: '#3b82f6', dark: '#60a5fa' },
  },
  // ... complete semantic system
} as const;

export type Colors = typeof colors;
```

### 3. Typography (`typography.ts`)
```typescript
export const typography = {
  fontFamily: {
    sans: 'Inter, system-ui, sans-serif',
    mono: 'JetBrains Mono, Fira Code, monospace',
    display: 'Cal Sans, Inter, sans-serif',
  },
  fontSize: {
    xs: '0.75rem',    // 12px
    sm: '0.875rem',   // 14px
    base: '1rem',     // 16px
    lg: '1.125rem',   // 18px
    xl: '1.25rem',    // 20px
    '2xl': '1.5rem',  // 24px
    '3xl': '1.875rem',// 30px
    '4xl': '2.25rem', // 36px
    '5xl': '3rem',    // 48px
  },
  fontWeight: {
    thin: '100',
    light: '300',
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  lineHeight: {
    none: '1',
    tight: '1.25',
    snug: '1.375',
    normal: '1.5',
    relaxed: '1.625',
    loose: '2',
  },
  letterSpacing: {
    tighter: '-0.05em',
    tight: '-0.025em',
    normal: '0em',
    wide: '0.025em',
    wider: '0.05em',
  },
} as const;
```

### 4. Spacing (`spacing.ts`)
Create a consistent 4px base spacing scale:
```typescript
export const spacing = {
  0: '0',
  0.5: '0.125rem',  // 2px
  1: '0.25rem',     // 4px
  1.5: '0.375rem',  // 6px
  2: '0.5rem',      // 8px
  2.5: '0.625rem',  // 10px
  3: '0.75rem',     // 12px
  // ... up to 96 (384px)
} as const;
```

### 5. Shadows (`shadows.ts`)
Elevation system for glass morphism:
```typescript
export const shadows = {
  none: 'none',
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  DEFAULT: '0 1px 3px 0 rgb(0 0 0 / 0.1)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
  // Glass-specific shadows
  glass: {
    sm: '0 2px 8px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.1)',
    DEFAULT: '0 4px 24px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.15)',
    lg: '0 8px 32px rgba(0,0,0,0.16), inset 0 1px 0 rgba(255,255,255,0.2)',
    glow: '0 0 20px rgba(14,165,233,0.3), inset 0 1px 0 rgba(255,255,255,0.2)',
  },
} as const;
```

### 6. Animation (`animation.ts`)
```typescript
export const animation = {
  duration: {
    instant: '0ms',
    fast: '100ms',
    normal: '200ms',
    slow: '300ms',
    slower: '500ms',
  },
  easing: {
    linear: 'linear',
    ease: 'ease',
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
    easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
  // Common animation keyframes as CSS-in-JS
  keyframes: {
    fadeIn: { /* ... */ },
    slideUp: { /* ... */ },
    pulse: { /* ... */ },
  },
} as const;
```

### 7. Breakpoints (`breakpoints.ts`)
```typescript
export const breakpoints = {
  xs: '480px',
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const;

export const mediaQueries = {
  xs: `(min-width: ${breakpoints.xs})`,
  sm: `(min-width: ${breakpoints.sm})`,
  // ... etc
} as const;
```

### 8. Main Export (`index.ts`)
Export all tokens and create a combined theme object.

## Requirements
- All tokens must be typed with `as const` for type inference
- Support both light and dark modes
- Export individual tokens AND combined theme object
- Add JSDoc comments for all tokens
- Create type definitions for TypeScript

## Dependencies
- Check existing color usage in codebase
- Coordinate with T1-A3 (Glass System) for shadow/elevation tokens
- Coordinate with T1-A4 (Animation) for animation tokens

## Testing
Create a visual test page showing all tokens in use.

## Success Criteria
- [ ] All 8 token files created
- [ ] Type-safe exports
- [ ] Light/dark mode support
- [ ] Visual test page working
- [ ] No SYSTEM_LAW violations
