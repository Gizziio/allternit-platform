# T4-A5: Documentation

## Agent Role
Technical Writer

## Task
Create comprehensive documentation for the UI system.

## Deliverables

### 1. Component Guide

Create: `6-ui/a2r-platform/docs/COMPONENT_GUIDE.md`

```markdown
# Component Guide

## Quick Start

```tsx
import { Button, GlassCard, Icon } from '@a2r/platform';

function MyComponent() {
  return (
    <GlassCard>
      <Icon name="home" />
      <Button>Click me</Button>
    </GlassCard>
  );
}
```

## Design Components

### GlassCard

A card with glass morphism effect.

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| elevation | 'flat' \| 'raised' \| 'floating' \| 'overlay' | 'raised' | Shadow level |
| variant | 'default' \| 'primary' \| 'success' \| 'warning' \| 'danger' | 'default' | Color variant |
| hover | boolean \| 'lift' \| 'glow' \| 'scale' | false | Hover effect |

**Examples:**

```tsx
// Basic usage
<GlassCard>Content</GlassCard>

// With elevation
<GlassCard elevation="floating">Floating card</GlassCard>

// With hover
<GlassCard hover="lift">Hover me</GlassCard>
```

### Icon

Unified icon component.

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| name | IconName | required | Icon identifier |
| size | 'xs' \| 'sm' \| 'md' \| 'lg' \| 'xl' \| number | 'md' | Icon size |
| color | string | 'current' | Icon color |

**Examples:**

```tsx
<Icon name="home" />
<Icon name="settings" size="lg" color="primary" />
```

## Shell Components

### ShellLayout

Main application layout wrapper.

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| sidebar | object | Sidebar configuration |
| topbar | object | Top bar configuration |
| bottombar | object | Bottom bar configuration |
| panels | object | Panel configuration |

## Hooks

### useLayout

Manage layout state.

```tsx
const { sidebarOpen, toggleSidebar } = useLayout();
```

### useViewManager

Manage views/tabs.

```tsx
const { openView, closeView, activeView } = useViewManager();
```
```

### 2. Theme Guide

Create: `6-ui/a2r-platform/docs/THEME_GUIDE.md`

```markdown
# Theme Guide

## Design Tokens

### Colors

```tsx
import { colors } from '@a2r/platform/tokens';

// Usage
colors.brand.DEFAULT  // Primary brand color
colors.semantic.success.light  // Success color
```

### Typography

```tsx
import { typography } from '@a2r/platform/tokens';

// Font sizes
typography.fontSize.lg  // 1.125rem
typography.fontWeight.semibold  // 600
```

## Customizing Themes

### CSS Variables

Override CSS variables in your global CSS:

```css
:root {
  --color-brand: #your-color;
  --color-background: #your-bg;
}
```

### Tailwind Config

Extend Tailwind with design tokens:

```js
// tailwind.config.ts
import { tokens } from '@a2r/platform/tokens';

export default {
  theme: {
    extend: {
      colors: tokens.colors,
      fontSize: tokens.typography.fontSize,
    },
  },
};
```

## Dark Mode

Dark mode is automatically applied based on system preference or class:

```tsx
// Force dark mode
<html class="dark">

// Or use theme provider
<ThemeProvider forcedTheme="dark">
```
```

### 3. Architecture Documentation

Create: `6-ui/a2r-platform/docs/ARCHITECTURE.md`

```markdown
# UI Architecture

## Overview

```
┌─────────────────────────────────────────────────────────┐
│                     Applications                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Desktop    │  │     Web      │  │   Terminal   │  │
│  │  (Electron)  │  │   (Browser)  │  │    (TUI)     │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
├─────────────────────────────────────────────────────────┤
│                      Platform UI                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │                 Shell System                      │  │
│  │  Layout • Navigation • Views • Panels            │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │                 Design System                     │  │
│  │  Components • Tokens • Icons • Animations        │  │
│  └──────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────┤
│                   Integration Layer                      │
│  State Management • API Client • WebSocket              │
└─────────────────────────────────────────────────────────┘
```

## Directory Structure

```
src/
├── design/          # Design system components
├── shell/           # Shell layout and navigation
├── views/           # View components
├── components/      # Shared components
├── hooks/           # React hooks
├── lib/             # Utilities
└── types/           # TypeScript types
```

## Component Categories

### Design Components
Pure presentational components with no business logic.

Examples: GlassCard, Button, Icon, Spinner

### Shell Components
Application shell and layout components.

Examples: ShellLayout, Sidebar, TopBar, ViewRouter

### View Components
Page-level components for specific views.

Examples: ChatView, AgentsView, SettingsView

## State Management

### Global State
- Theme (dark/light)
- User preferences
- Authentication

### View State
- Current view
- View history
- Panel states

### Local State
- Component-specific state
- Form state
- UI state (modals, drawers)

## Best Practices

1. **Composition over configuration**
   - Use composition for complex layouts
   - Avoid props drilling

2. **Controlled vs Uncontrolled**
   - Provide both options where appropriate
   - Document which components are controlled

3. **Accessibility First**
   - All components must be keyboard navigable
   - ARIA attributes for screen readers
   - Color contrast compliance

4. **Performance**
   - Memoize expensive computations
   - Virtualize long lists
   - Lazy load heavy components
```

### 4. Migration Guide

Create: `6-ui/a2r-platform/docs/MIGRATION.md`

```markdown
# Migration Guide

## From Old Shell to New Platform

### Component Mapping

| Old Component | New Component | Notes |
|--------------|---------------|-------|
| `ShellFrame` | `ShellLayout` | New props API |
| `GlassSurface` | `GlassCard` | More variants |
| `IconButton` | `IconButton` | Same API |

### Breaking Changes

#### v1.0 to v2.0

**GlassCard elevation prop renamed:**
```tsx
// Old
<GlassSurface level={2} />

// New
<GlassCard elevation="raised" />
```

**Icon imports changed:**
```tsx
// Old
import { Home } from 'lucide-react';

// New
import { Icon } from '@a2r/platform';
<Icon name="home" />
```

### Codemods

Run automated migrations:

```bash
npx @a2r/codemod migrate v2.0
```

## Deprecations

The following will be removed in v3.0:

- `LegacyButton` → Use `Button`
- `OldSidebar` → Use `Sidebar`
```

### 5. Contributing Guide

Create: `6-ui/a2r-platform/docs/CONTRIBUTING.md`

```markdown
# Contributing to UI Components

## Getting Started

```bash
cd 6-ui/a2r-platform
pnpm install
pnpm storybook
```

## Adding a New Component

1. Create component file: `src/design/NewComponent.tsx`
2. Create stories: `src/design/NewComponent.stories.tsx`
3. Create tests: `src/design/NewComponent.test.tsx`
4. Export from index: `src/design/index.ts`
5. Add documentation

## Component Checklist

- [ ] TypeScript types
- [ ] JSDoc comments
- [ ] Storybook stories
- [ ] Unit tests
- [ ] Accessibility audit
- [ ] Performance check

## Code Style

- Use functional components
- Props interface named `ComponentNameProps`
- Export named, not default
- Use `cn()` for className merging
```

### 6. API Reference

Generate from TypeScript:

```bash
# Install TypeDoc
pnpm add -D typedoc

# Generate docs
npx typedoc --out docs/api src/index.ts
```

### 7. Changelog

Create: `6-ui/a2r-platform/CHANGELOG.md`

```markdown
# Changelog

## [2.0.0] - 2026-02-24

### Added
- New GlassCard component with 4 elevation levels
- Animation system with Framer Motion
- Icon system with 150+ icons
- Virtual scrolling for message lists

### Changed
- Redesigned shell layout
- Improved keyboard navigation
- Better dark mode support

### Deprecated
- Old GlassSurface (use GlassCard)
- Legacy Button (use Button)

### Fixed
- Memory leak in ViewRouter
- Focus trap in modals
```

## Success Criteria
- [ ] Component Guide
- [ ] Theme Guide
- [ ] Architecture doc
- [ ] Migration guide
- [ ] Contributing guide
- [ ] API reference
- [ ] Changelog
- [ ] All docs in `/docs` folder
- [ ] No SYSTEM_LAW violations
