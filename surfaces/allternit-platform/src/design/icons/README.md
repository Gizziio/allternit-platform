# allternit Icon System

A unified, type-safe icon system for the entire allternit platform.

## Features

- **Type-safe**: 200+ icon names with full TypeScript support
- **Tree-shakeable**: Import only what you need
- **Accessible**: ARIA labels and screen reader support
- **Theme-aware**: Respects CSS custom properties
- **Animated**: Built-in spin, pulse, bounce animations
- **Custom icons**: Brand-specific icons (Logo, Shell, Capsule, Bead, etc.)

## Installation

The icon system is included in `@allternit/platform`. No additional dependencies needed.

```bash
# lucide-react is already a dependency
npm install lucide-react
```

## Quick Start

```tsx
import { Icon, IconButton, NotificationBell } from '@allternit/platform/icons';

// Basic usage
<Icon name="home" size="md" />

// With color and animation
<Icon name="loading" size="lg" color="primary" spin />

// Icon button
<IconButton name="settings" onClick={handleSettings} />

// Notification badge
<NotificationBell count={5} />
```

## Icon Categories

### Navigation (20 icons)
`home`, `dashboard`, `settings`, `profile`, `menu`, `close`, `back`, `forward`, `chevron-*`, `arrow-*`

### Actions (31 icons)
`add`, `remove`, `edit`, `delete`, `save`, `cancel`, `search`, `filter`, `refresh`, `download`, `upload`, `copy`, `paste`, `play`, `pause`, `stop`, etc.

### Status (24 icons)
`success`, `error`, `warning`, `info`, `loading`, `pending`, `check`, `check-circle`, `shield`, `lock`, etc.

### Files (21 icons)
`file`, `folder`, `image`, `video`, `audio`, `code`, `document`, `pdf`, `archive`, etc.

### Communication (19 icons)
`chat`, `message`, `email`, `phone`, `share`, `notification`, `bell`, etc.

### Agents/AI (22 icons)
`agent`, `bot`, `ai`, `sparkles`, `brain`, `workflow`, `robot`, `cpu`, `zap`, etc.

### Cloud/DevOps (23 icons)
`cloud`, `server`, `database`, `container`, `kubernetes`, `deploy`, `build`, `terminal`, `git-*`, etc.

### Media/Editor (22 icons)
`eye`, `camera`, `mic`, `volume`, `music`, `film`, `palette`, `pen`, `bold`, `italic`, etc.

### Users (20 icons)
`user`, `users`, `profile`, `group`, `team`, `building`, `globe`, etc.

### Brand (8 custom icons)
`allternit-logo`, `allternit-mark`, `shell`, `capsule`, `bead`, `substrate`, `kernel`, `archon`

## API Reference

### Icon Component

```tsx
interface IconProps {
  name: IconName;        // Required: icon identifier
  size?: IconSize;       // 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number
  color?: IconColor;     // 'inherit' | 'current' | 'primary' | 'success' | etc.
  variant?: IconVariant; // 'default' | 'filled' | 'outlined' | 'duotone'
  spin?: boolean;        // Spin animation
  pulse?: boolean;       // Pulse animation
  bounce?: boolean;      // Bounce animation
  ariaLabel?: string;    // Accessibility label
  ariaHidden?: boolean;  // Hide from screen readers
  className?: string;    // Additional CSS classes
  onClick?: () => void;  // Click handler
}
```

### IconButton Component

```tsx
interface IconButtonProps extends IconProps {
  buttonVariant?: 'default' | 'ghost' | 'filled' | 'outline' | 'subtle';
  shape?: 'square' | 'circle';
  disabled?: boolean;
  loading?: boolean;
  active?: boolean;
  tooltip?: string;
}
```

### IconWithBadge Component

```tsx
interface IconWithBadgeProps extends IconProps {
  badge?: number | string;
  badgeVariant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  maxBadge?: number;      // Max before showing "99+"
  badgePosition?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  badgeDot?: boolean;     // Show dot only
  hideZero?: boolean;     // Hide when zero
}
```

## Size Guide

| Size | Pixels | Use Case |
|------|--------|----------|
| xs | 12px | Inline text, compact lists |
| sm | 16px | Buttons, menus, small UI |
| md | 20px | Default, general purpose |
| lg | 24px | Headers, prominent actions |
| xl | 32px | Empty states, illustrations |

## Color Guide

| Color | CSS Variable | Use Case |
|-------|--------------|----------|
| current | currentColor | Inherits from parent |
| primary | `--color-primary` | Primary actions |
| success | `--color-success` | Success states |
| warning | `--color-warning` | Warnings |
| danger | `--color-danger` | Errors, destructive |
| muted | `--color-text-muted` | Secondary content |

## Tree-shaking Exports

For optimal bundle size, use named exports:

```tsx
// Good - tree-shakeable
import { HomeIcon, SettingsIcon } from '@allternit/platform/icons';

// Also good - only imports Icon component
import { Icon } from '@allternit/platform/icons';
```

## Development Tools

### Icon Explorer

Browse and search all available icons at `/dev/icons`.

```tsx
// app/dev/icons/page.tsx
import { IconExplorerPage } from '@allternit/platform/dev/icon-explorer';

export default function IconsPage() {
  return <IconExplorerPage />;
}
```

Features:
- Search by name
- Filter by category
- Preview at different sizes
- Copy usage code
- Dark/light mode toggle

## Custom Icons

Custom brand icons are located in `custom/` folder:

- `AllternitLogo` - Full logo with wordmark
- `AllternitMark` - Icon-only logo mark
- `ShellIcon` - Shell/workspace container
- `CapsuleIcon` - Self-contained functional unit
- `BeadIcon` - Atomic data unit
- `SubstrateIcon` - Foundation layer
- `KernelIcon` - Core OS/kernel
- `ArchonIcon` - Governing authority

## Migration

See [MIGRATION.md](./MIGRATION.md) for migrating from other icon libraries.

## Contributing

When adding new icons:

1. Add the name to `IconName` type in `types.ts`
2. Add to appropriate `ICON_CATEGORIES`
3. Map to Lucide icon in `lucide-mapping.ts`
4. Update this README
5. Test in Icon Explorer
