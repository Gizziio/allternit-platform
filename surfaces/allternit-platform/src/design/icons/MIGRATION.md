# Icon System Migration Guide

## Overview

This guide helps you migrate from existing icon usage patterns to the new unified icon system.

## Quick Reference

### Before (Inconsistent)

```tsx
// Mixed icon libraries
import { Home } from 'lucide-react';
import Settings from '@ant-design/icons/SettingOutlined';
import { ReactComponent as Logo } from './logo.svg';
import MenuIcon from '@mui/icons-material/Menu';

// Usage
<Home size={24} />
<Settings style={{ fontSize: 24 }} />
<Logo width={32} height={32} />
<MenuIcon sx={{ fontSize: 24 }} />
```

### After (Unified)

```tsx
// Single import source
import { Icon, HomeIcon, AllternitLogoIcon } from '@allternit/platform/icons';

// Usage
<Icon name="home" size="md" />
<HomeIcon size="md" />
<AllternitLogoIcon size={32} />
```

## Migration Steps

### Step 1: Find Icon Imports

Search for existing icon imports in your codebase:

```bash
# Find Lucide imports
grep -r "from 'lucide-react'" src/

# Find Ant Design icons
grep -r "from '@ant-design/icons'" src/

# Find Material UI icons
grep -r "from '@mui/icons-material'" src/

# Find SVG imports
grep -r "ReactComponent.*from.*\.svg" src/
```

### Step 2: Replace Icon Imports

Use the mapping table below to find the equivalent icon name.

### Step 3: Update Component Usage

| Old Pattern | New Pattern |
|-------------|-------------|
| `<Home size={24} />` | `<Icon name="home" size="lg" />` |
| `<Settings />` | `<Icon name="settings" size="md" />` |
| `<Logo width={32} />` | `<Icon name="allternit-logo" size={32} />` |

## Size Mapping

| Old (pixels) | New (semantic) | Actual Pixels |
|--------------|----------------|---------------|
| 12px or smaller | `xs` | 12px |
| 16px | `sm` | 16px |
| 20px | `md` | 20px |
| 24px | `lg` | 24px |
| 32px+ | `xl` | 32px |

## Common Icon Mappings

### Navigation Icons

| Old Name | New Name |
|----------|----------|
| Home | `home` |
| Dashboard | `dashboard` |
| Settings | `settings` |
| User | `profile` |
| Menu | `menu` |
| Close | `close` |
| ArrowLeft | `back` or `arrow-left` |
| ArrowRight | `forward` or `arrow-right` |

### Action Icons

| Old Name | New Name |
|----------|----------|
| Plus | `add` |
| Edit | `edit` |
| Delete/Trash | `delete` |
| Save | `save` |
| Search | `search` |
| Filter | `filter` |
| Download | `download` |
| Upload | `upload` |

### Status Icons

| Old Name | New Name |
|----------|----------|
| CheckCircle | `success` or `check-circle` |
| Error/XCircle | `error` or `x-circle` |
| Warning | `warning` |
| Info | `info` |
| Loading/Spinner | `loading` |

### Communication Icons

| Old Name | New Name |
|----------|----------|
| Message | `message` or `chat` |
| Mail | `email` |
| Notification | `notification` or `bell` |
| Bell | `bell` |

## Code Examples

### Button with Icon

**Before:**
```tsx
import { Plus } from 'lucide-react';

<button>
  <Plus size={16} />
  Add Item
</button>
```

**After:**
```tsx
import { Icon } from '@allternit/platform/icons';

<button>
  <Icon name="add" size="sm" />
  Add Item
</button>
```

### Icon Button

**Before:**
```tsx
import { Settings } from 'lucide-react';

<button onClick={openSettings}>
  <Settings size={20} />
</button>
```

**After:**
```tsx
import { IconButton } from '@allternit/platform/icons';

<IconButton 
  name="settings" 
  size="md" 
  onClick={openSettings}
/>
```

### Notification Badge

**Before:**
```tsx
import { Bell } from 'lucide-react';

<span className="relative">
  <Bell size={20} />
  {count > 0 && (
    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
      {count}
    </span>
  )}
</span>
```

**After:**
```tsx
import { NotificationBell } from '@allternit/platform/icons';

<NotificationBell count={count} size="md" />
```

### Loading State

**Before:**
```tsx
import { Loader2 } from 'lucide-react';

{isLoading && <Loader2 className="animate-spin" size={20} />}
```

**After:**
```tsx
import { LoadingIcon } from '@allternit/platform/icons';

{isLoading && <LoadingIcon size="md" />}
// or
{isLoading && <Icon name="loading" spin size="md" />}
```

## Migration Script

Use this helper to migrate your files:

```bash
#!/bin/bash
# migrate-icons.sh

# Replace common patterns
find src -name "*.tsx" -o -name "*.ts" | xargs sed -i '' \
  -e "s/import { Home } from 'lucide-react';/import { HomeIcon } from '@allternit\/platform\/icons';/g" \
  -e "s/import { Settings } from 'lucide-react';/import { SettingsIcon } from '@allternit\/platform\/icons';/g" \
  -e "s/import { User } from 'lucide-react';/import { UserIcon } from '@allternit\/platform\/icons';/g"
  # Add more patterns as needed
```

## Advanced Usage

### Custom Colors

```tsx
<Icon name="check" color="success" />
<Icon name="alert" color="warning" />
<Icon name="error" color="danger" />
```

### Animations

```tsx
<Icon name="loading" spin />
<Icon name="bell" pulse />
<Icon name="arrow-down" bounce />
```

### Accessibility

```tsx
<Icon name="delete" ariaLabel="Delete item" />
<Icon name="decoration" ariaHidden />
```

## Troubleshooting

### Icon Not Found

If you get a warning: `[Icon] Icon "xxx" not found`

1. Check the exact spelling of the icon name
2. Refer to the Icon Explorer at `/dev/icons`
3. Use the type system - TypeScript will autocomplete valid names

### Size Doesn't Match

The new system uses semantic sizes. If the icon looks wrong:

- Check the size mapping table above
- Use numeric values for precise control: `size={28}`

### Color Issues

Icons respect `currentColor` by default. If colors don't apply:

- Ensure CSS custom properties are defined
- Use explicit color prop: `color="primary"`
- Check parent element's color value

## Verification Checklist

After migration, verify:

- [ ] No remaining imports from `lucide-react` (except in icon system)
- [ ] No remaining imports from `@ant-design/icons`
- [ ] No remaining imports from `@mui/icons-material`
- [ ] All icons display correctly
- [ ] Icon sizes look consistent
- [ ] Icon colors match theme
- [ ] Animations work (spin, pulse)
- [ ] Accessibility labels are present where needed

## Support

For questions or missing icons:

1. Check the Icon Explorer: `/dev/icons`
2. Refer to the full icon list in `types.ts`
3. Request new icons via the team channel
