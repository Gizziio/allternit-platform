# T1-A5: Icon System

## Agent Role
Icon Designer - Visual System

## Task
Create a unified, type-safe icon system for the entire platform.

## Deliverables

### 1. Icon System Architecture

Create: `6-ui/a2r-platform/src/design/icons/`

```
src/design/icons/
├── index.ts              # Main export
├── Icon.tsx              # Base Icon component
├── types.ts              # Icon type definitions
├── lucide-mapping.ts     # Lucide icon mapping
├── custom/               # Custom SVG icons
│   ├── index.ts
│   ├── Logo.tsx
│   ├── BrandIcon.tsx
│   └── ...
└── categories/           # Organized by category
    ├── navigation.ts
    ├── actions.ts
    ├── status.ts
    ├── files.ts
    └── communication.ts
```

### 2. Base Icon Component

Create: `6-ui/a2r-platform/src/design/icons/Icon.tsx`

```typescript
import { LucideIcon } from 'lucide-react';

export interface IconProps {
  // Icon name from our system
  name: IconName;
  
  // Size variants
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;
  
  // Color variants
  color?: 'inherit' | 'current' | 'primary' | 'secondary' | 'muted' | 'success' | 'warning' | 'danger';
  
  // Visual variants
  variant?: 'default' | 'filled' | 'outlined' | 'duotone';
  
  // Animation
  spin?: boolean;
  pulse?: boolean;
  bounce?: boolean;
  
  // Accessibility
  ariaLabel?: string;
  ariaHidden?: boolean;
  
  // Styling
  className?: string;
}

export const iconSizes = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
};

export function Icon({ name, size = 'md', color = 'current', variant = 'default', ...props }: IconProps) {
  // Resolve icon from mapping
  const LucideIconComponent = iconMapping[name];
  
  if (!LucideIconComponent) {
    console.warn(`Icon "${name}" not found`);
    return null;
  }
  
  const pixelSize = typeof size === 'number' ? size : iconSizes[size];
  
  return (
    <LucideIconComponent
      size={pixelSize}
      className={cn(iconColorStyles[color], props.className)}
      aria-label={props.ariaLabel}
      aria-hidden={props.ariaHidden}
      data-spin={props.spin}
      data-pulse={props.pulse}
    />
  );
}
```

### 3. Icon Name Type

Create: `6-ui/a2r-platform/src/design/icons/types.ts`

```typescript
// Comprehensive icon name union type
export type IconName =
  // Navigation
  | 'home' | 'dashboard' | 'settings' | 'profile' | 'menu' | 'close' | 'back' | 'forward'
  | 'chevron-up' | 'chevron-down' | 'chevron-left' | 'chevron-right'
  | 'arrow-up' | 'arrow-down' | 'arrow-left' | 'arrow-right'
  
  // Actions
  | 'add' | 'remove' | 'edit' | 'delete' | 'save' | 'cancel' | 'submit'
  | 'search' | 'filter' | 'sort' | 'refresh' | 'download' | 'upload'
  | 'copy' | 'paste' | 'cut' | 'undo' | 'redo'
  
  // Status
  | 'success' | 'error' | 'warning' | 'info' | 'loading' | 'pending'
  | 'check' | 'check-circle' | 'x' | 'x-circle' | 'alert' | 'alert-triangle'
  
  // Files
  | 'file' | 'folder' | 'image' | 'video' | 'audio' | 'code' | 'document'
  | 'pdf' | 'zip' | 'download-file' | 'upload-file'
  
  // Communication
  | 'chat' | 'message' | 'email' | 'phone' | 'video-call' | 'share'
  | 'notification' | 'bell' | 'mention'
  
  // Agents/AI
  | 'agent' | 'bot' | 'ai' | 'sparkles' | 'magic' | 'wand' | 'brain'
  | 'workflow' | 'pipeline' | 'node' | 'connection'
  
  // Cloud/DevOps
  | 'cloud' | 'server' | 'database' | 'container' | 'kubernetes'
  | 'deploy' | 'build' | 'test' | 'monitor'
  
  // Custom A2rchitect icons
  | 'a2r-logo' | 'a2r-mark' | 'shell' | 'capsule' | 'bead';
```

### 4. Lucide Mapping

Create: `6-ui/a2r-platform/src/design/icons/lucide-mapping.ts`

```typescript
import * as Lucide from 'lucide-react';
import { IconName } from './types';

export const iconMapping: Record<IconName, Lucide.LucideIcon> = {
  // Navigation
  'home': Lucide.Home,
  'dashboard': Lucide.LayoutDashboard,
  'settings': Lucide.Settings,
  'profile': Lucide.User,
  'menu': Lucide.Menu,
  'close': Lucide.X,
  'back': Lucide.ArrowLeft,
  'forward': Lucide.ArrowRight,
  'chevron-up': Lucide.ChevronUp,
  'chevron-down': Lucide.ChevronDown,
  'chevron-left': Lucide.ChevronLeft,
  'chevron-right': Lucide.ChevronRight,
  'arrow-up': Lucide.ArrowUp,
  'arrow-down': Lucide.ArrowDown,
  'arrow-left': Lucide.ArrowLeft,
  'arrow-right': Lucide.ArrowRight,
  
  // Actions
  'add': Lucide.Plus,
  'remove': Lucide.Minus,
  'edit': Lucide.Pencil,
  'delete': Lucide.Trash2,
  'save': Lucide.Save,
  'cancel': Lucide.XCircle,
  'submit': Lucide.Check,
  'search': Lucide.Search,
  'filter': Lucide.Filter,
  'sort': Lucide.ArrowUpDown,
  'refresh': Lucide.RefreshCw,
  'download': Lucide.Download,
  'upload': Lucide.Upload,
  'copy': Lucide.Copy,
  'paste': Lucide.ClipboardPaste,
  'cut': Lucide.Scissors,
  'undo': Lucide.Undo,
  'redo': Lucide.Redo,
  
  // Status
  'success': Lucide.CheckCircle2,
  'error': Lucide.XCircle,
  'warning': Lucide.AlertTriangle,
  'info': Lucide.Info,
  'loading': Lucide.Loader2,
  'pending': Lucide.Clock,
  'check': Lucide.Check,
  'check-circle': Lucide.CheckCircle,
  'x': Lucide.X,
  'x-circle': Lucide.XCircle,
  'alert': Lucide.AlertCircle,
  'alert-triangle': Lucide.AlertTriangle,
  
  // Files
  'file': Lucide.File,
  'folder': Lucide.Folder,
  'image': Lucide.Image,
  'video': Lucide.Video,
  'audio': Lucide.Music,
  'code': Lucide.Code,
  'document': Lucide.FileText,
  'pdf': Lucide.FileText,
  'zip': Lucide.FileArchive,
  'download-file': Lucide.FileDown,
  'upload-file': Lucide.FileUp,
  
  // Communication
  'chat': Lucide.MessageSquare,
  'message': Lucide.MessageCircle,
  'email': Lucide.Mail,
  'phone': Lucide.Phone,
  'video-call': Lucide.Video,
  'share': Lucide.Share2,
  'notification': Lucide.Bell,
  'bell': Lucide.Bell,
  'mention': Lucide.AtSign,
  
  // Agents/AI
  'agent': Lucide.Bot,
  'bot': Lucide.Bot,
  'ai': Lucide.Sparkles,
  'sparkles': Lucide.Sparkles,
  'magic': Lucide.Wand2,
  'wand': Lucide.Wand2,
  'brain': Lucide.Brain,
  'workflow': Lucide.GitBranch,
  'pipeline': Lucide.GitCommit,
  'node': Lucide.CircleDot,
  'connection': Lucide.GitMerge,
  
  // Cloud/DevOps
  'cloud': Lucide.Cloud,
  'server': Lucide.Server,
  'database': Lucide.Database,
  'container': Lucide.Container,
  'kubernetes': Lucide.Ship,
  'deploy': Lucide.Rocket,
  'build': Lucide.Hammer,
  'test': Lucide.FlaskConical,
  'monitor': Lucide.Activity,
  
  // Custom (will be imported from custom/)
  'a2r-logo': CustomIcons.A2RLogo,
  'a2r-mark': CustomIcons.A2RMark,
  'shell': CustomIcons.Shell,
  'capsule': CustomIcons.Capsule,
  'bead': CustomIcons.Bead,
};
```

### 5. Custom Icons

Create custom SVG icons for brand elements:

Create: `6-ui/a2r-platform/src/design/icons/custom/Logo.tsx`

```typescript
// A2rchitect logo SVG
export function A2RLogo({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
    >
      {/* Logo paths */}
    </svg>
  );
}
```

### 6. Icon Button Component

Create: `6-ui/a2r-platform/src/design/icons/IconButton.tsx`

```typescript
interface IconButtonProps extends IconProps {
  onClick?: () => void;
  variant?: 'default' | 'ghost' | 'filled' | 'outline';
  shape?: 'square' | 'circle';
  disabled?: boolean;
  loading?: boolean;
}

export function IconButton({ onClick, variant = 'default', ...props }: IconButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={props.disabled || props.loading}
      className={iconButtonVariants({ variant, shape: props.shape })}
    >
      {props.loading ? <Icon name="loading" spin /> : <Icon {...props} />}
    </button>
  );
}
```

### 7. Icon with Badge

Create: `6-ui/a2r-platform/src/design/icons/IconWithBadge.tsx`

```typescript
interface IconWithBadgeProps extends IconProps {
  badge?: number | string;
  badgeVariant?: 'default' | 'success' | 'warning' | 'danger';
  maxBadge?: number;
}

// Shows icon with notification/count badge
```

### 8. Tree Shaking Support

Ensure proper exports for tree shaking:

```typescript
// index.ts - Re-export individual icons for tree shaking
export { Icon } from './Icon';
export { IconButton } from './IconButton';
export { IconWithBadge } from './IconWithBadge';
export type { IconProps, IconName } from './types';

// Individual icon exports for direct import
export { Home } from 'lucide-react';
export { Settings } from 'lucide-react';
// ... etc
```

### 9. Icon Search/Explorer

Create a development tool:

Create: `6-ui/a2r-platform/src/dev/icon-explorer.tsx`

Searchable icon browser with:
- Search by name
- Filter by category
- Copy icon name
- Preview at different sizes
- Dark/light mode toggle

### 10. Migration Guide

Document how to migrate from existing icon usage:

```typescript
// OLD (inconsistent):
import { Home } from 'lucide-react';
import Settings from '@ant-design/icons/SettingOutlined';
import { ReactComponent as Logo } from './logo.svg';

// NEW (unified):
import { Icon } from '@a2r/platform/icons';

<Icon name="home" size="md" />
<Icon name="settings" size="md" />
<Icon name="a2r-logo" size="lg" />
```

## Requirements

- All icons must be typed (no string fall-through)
- Must support all sizes from xs to xl
- Must respect currentColor for theming
- Must have proper accessibility (aria-label)
- Must tree-shake properly
- Custom icons must match Lucide style

## Dependencies

- `lucide-react` already installed
- Coordinate with T1-A1 for color tokens
- Check existing icon usage patterns

## Success Criteria
- [ ] 150+ icon names defined
- [ ] Complete Lucide mapping
- [ ] Custom brand icons created
- [ ] Icon component with all props
- [ ] IconButton component
- [ ] Icon explorer dev tool
- [ ] Migration guide
- [ ] No SYSTEM_LAW violations
