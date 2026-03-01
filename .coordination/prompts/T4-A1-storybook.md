# T4-A1: Storybook Stories

## Agent Role
Documentation Specialist

## Task
Create comprehensive Storybook stories for all UI components.

## Deliverables

### 1. Storybook Configuration

Verify and update existing Storybook setup:

```
6-ui/a2r-platform/.storybook/
├── main.ts
├── preview.tsx
├── preview-head.html
└── manager-head.html
```

Ensure Storybook is configured:
```typescript
// .storybook/main.ts
import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],
  addons: [
    '@storybook/addon-essentials',
    '@storybook/addon-interactions',
    '@storybook/addon-a11y',
    '@storybook/addon-themes',
  ],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  typescript: {
    reactDocgen: 'react-docgen-typescript',
  },
};

export default config;
```

### 2. Story Categories

Create stories for all component categories:

#### Design Components (20 stories)
```typescript
// src/design/GlassCard.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { GlassCard } from './GlassCard';

const meta: Meta<typeof GlassCard> = {
  title: 'Design/GlassCard',
  component: GlassCard,
  tags: ['autodocs'],
  argTypes: {
    elevation: {
      control: 'select',
      options: ['flat', 'raised', 'floating', 'overlay'],
    },
    variant: {
      control: 'select',
      options: ['default', 'primary', 'success', 'warning', 'danger'],
    },
    hover: {
      control: 'select',
      options: [false, true, 'lift', 'glow', 'scale'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: 'Glass Card Content',
  },
};

export const Elevations: Story = {
  render: () => (
    <div className="flex gap-4">
      <GlassCard elevation="flat">Flat</GlassCard>
      <GlassCard elevation="raised">Raised</GlassCard>
      <GlassCard elevation="floating">Floating</GlassCard>
      <GlassCard elevation="overlay">Overlay</GlassCard>
    </div>
  ),
};

export const Variants: Story = {
  render: () => (
    <div className="flex gap-4">
      <GlassCard variant="default">Default</GlassCard>
      <GlassCard variant="primary">Primary</GlassCard>
      <GlassCard variant="success">Success</GlassCard>
      <GlassCard variant="warning">Warning</GlassCard>
      <GlassCard variant="danger">Danger</GlassCard>
    </div>
  ),
};

export const WithHover: Story = {
  render: () => (
    <div className="flex gap-4">
      <GlassCard hover="lift">Lift</GlassCard>
      <GlassCard hover="glow">Glow</GlassCard>
      <GlassCard hover="scale">Scale</GlassCard>
    </div>
  ),
};

// Dark mode story
export const DarkMode: Story = {
  parameters: {
    themes: {
      themeOverride: 'dark',
    },
  },
  args: {
    children: 'Dark Mode Card',
    elevation: 'floating',
  },
};
```

Create similar stories for:
- GlassSurface
- GlassPanel
- All animation components
- All icon components

#### Shell Components (15 stories)
```typescript
// src/shell/layout/ShellLayout.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { ShellLayout } from './ShellLayout';

const meta: Meta<typeof ShellLayout> = {
  title: 'Shell/Layout',
  component: ShellLayout,
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;

export const Default: Story = {
  args: {
    children: <div className="p-8">Main Content Area</div>,
  },
};

export const WithSidebar: Story = {
  args: {
    sidebar: { enabled: true },
    children: <div className="p-8">Content with Sidebar</div>,
  },
};

export const IDE: Story = {
  args: {
    sidebar: { enabled: true },
    panels: {
      left: { enabled: true },
      right: { enabled: true },
      bottom: { enabled: true },
    },
    children: <div className="p-8">IDE Layout</div>,
  },
};
```

#### Navigation Components (10 stories)
- CommandPalette
- Breadcrumbs
- Sidebar
- ViewTabs

#### Chat Components (8 stories)
- MessageList
- MessageItem
- CodeBlock
- ChatInput

#### View Components (5 stories)
- ViewRouter
- ViewTabs
- PanelContainer

### 3. Story Decorators

Create decorators for common setups:

```typescript
// .storybook/decorators.tsx
import { ThemeProvider } from '../src/providers/ThemeProvider';
import { GlassProvider } from '../src/design/GlassProvider';

export const withTheme = (Story, context) => {
  const theme = context.globals.theme || 'light';
  
  return (
    <ThemeProvider forcedTheme={theme}>
      <Story />
    </ThemeProvider>
  );
};

export const withGlass = (Story) => (
  <GlassProvider>
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-8">
      <Story />
    </div>
  </GlassProvider>
);

// Apply decorators globally
// .storybook/preview.tsx
export const decorators = [withTheme, withGlass];
```

### 4. Documentation Pages

Create MDX documentation:

```markdown
<!-- src/design/DesignSystem.stories.mdx -->
import { Meta, ColorPalette, ColorItem } from '@storybook/blocks';

<Meta title="Design System/Overview" />

# A2rchitect Design System

## Colors

<ColorPalette>
  <ColorItem
    title="Brand"
    subtitle="Primary brand colors"
    colors={{
      50: '#f0f9ff',
      100: '#e0f2fe',
      // ...
      900: '#0c4a6e',
    }}
  />
  <ColorItem
    title="Semantic"
    subtitle="Status colors"
    colors={{
      Success: '#22c55e',
      Warning: '#f59e0b',
      Danger: '#ef4444',
      Info: '#3b82f6',
    }}
  />
</ColorPalette>

## Typography

Show typography scale...

## Spacing

Show spacing scale...
```

### 5. Story Coverage Goals

Target coverage:
- [ ] 100% of design components
- [ ] 80% of shell components
- [ ] 60% of view components
- [ ] All variants documented
- [ ] All states documented (default, hover, active, disabled)
- [ ] Dark mode variants
- [ ] Interactive stories with controls

### 6. Story Testing

Add interaction tests:

```typescript
// Example interaction test
export const InteractiveButton: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Find button and click
    const button = canvas.getByRole('button');
    await userEvent.click(button);
    
    // Verify result
    await expect(canvas.getByText('Clicked!')).toBeInTheDocument();
  },
};
```

### 7. Chromatic Integration

Configure for visual regression testing:

```typescript
// .storybook/preview.tsx
export const parameters = {
  chromatic: {
    viewports: [320, 768, 1280],
    delay: 300, // Wait for animations
  },
};
```

## Requirements

- Stories for all major components
- All component variants documented
- Interactive controls working
- Dark mode support
- Accessibility addon
- Interaction tests

## Success Criteria
- [ ] 50+ stories created
- [ ] All design components covered
- [ ] Shell components documented
- [ ] Dark mode variants
- [ ] Interactive controls
- [ ] Interaction tests for key components
- [ ] MDX documentation pages
- [ ] No SYSTEM_LAW violations
