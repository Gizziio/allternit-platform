import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { userEvent, within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';
import { IconButton } from './IconButton';
import { 
  Gear, 
  Plus, 
  Trash, 
  Pencil, 
  Copy, 
  Check,
  X,
  Bell,
  MagnifyingGlass,
  Heart,
} from '@phosphor-icons/react';

/**
 * IconButton Component
 * 
 * A compact button designed specifically for icon actions.
 * Features active state styling and consistent sizing.
 * 
 * @evidence UI_TEST, VISUAL_REGRESSION, A11Y_COMPLIANCE
 */
const meta: Meta<typeof IconButton> = {
  title: 'Design/Controls/IconButton',
  component: IconButton,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    allternit: {
      componentId: 'design-controls-icon-button',
      evidence: {
        types: ['INTERACTION_TEST', 'VISUAL_SNAPSHOT', 'A11Y_SCAN'],
        dagNode: 'ui-components/design/controls/icon-button',
      },
    },
  },
  argTypes: {
    icon: {
      control: false,
      description: 'Phosphor icon component',
    },
    onClick: {
      action: 'clicked',
      description: 'Click handler',
    },
    active: {
      control: 'boolean',
      description: 'Active state styling',
    },
    title: {
      control: 'text',
      description: 'Tooltip text',
    },
    size: {
      control: 'number',
      description: 'Icon size in pixels',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default IconButton with settings gear
 */
export const Default: Story = {
  args: {
    icon: Gear,
    title: 'Settings',
  },
};

/**
 * IconButton with click interaction
 */
export const Clickable: Story = {
  args: {
    icon: Plus,
    title: 'Add item',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button');
    
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('title', 'Add item');
    
    await userEvent.click(button);
  },
};

/**
 * Active state demonstration
 */
export const ActiveState: Story = {
  render: () => {
    const [active, setActive] = useState(false);
    return (
      <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
        <IconButton 
          icon={Heart} 
          active={active}
          onClick={() => setActive(!active)}
          title={active ? 'Unlike' : 'Like'}
        />
        <span style={{ fontSize: '14px', opacity: 0.7 }}>
          {active ? 'Active (liked)' : 'Inactive'}
        </span>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button');
    
    // Initially inactive
    expect(button).toHaveAttribute('title', 'Like');
    
    // Click to activate
    await userEvent.click(button);
    expect(button).toHaveAttribute('title', 'Unlike');
  },
};

/**
 * Various icon examples
 */
export const IconGallery: Story = {
  render: () => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
      <IconButton icon={Gear} title="Settings" />
      <IconButton icon={Plus} title="Add" />
      <IconButton icon={Trash} title="Delete" />
      <IconButton icon={Pencil} title="Edit" />
      <IconButton icon={Copy} title="Copy" />
      <IconButton icon={Check} title="Confirm" />
      <IconButton icon={X} title="Close" />
      <IconButton icon={Bell} title="Notifications" />
      <IconButton icon={MagnifyingGlass} title="Search" />
      <IconButton icon={Heart} title="Favorite" />
    </div>
  ),
};

/**
 * Active vs inactive comparison
 */
export const ActiveComparison: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <span style={{ width: '80px', fontSize: '12px' }}>Inactive:</span>
        <IconButton icon={Gear} title="Settings" />
        <IconButton icon={Bell} title="Notifications" />
        <IconButton icon={Heart} title="Like" />
      </div>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <span style={{ width: '80px', fontSize: '12px' }}>Active:</span>
        <IconButton icon={Gear} active title="Settings" />
        <IconButton icon={Bell} active title="Notifications" />
        <IconButton icon={Heart} active title="Like" />
      </div>
    </div>
  ),
};

/**
 * Different icon sizes
 */
export const Sizes: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
        <IconButton icon={Gear} size={16} title="Small" />
        <span style={{ fontSize: '10px', opacity: 0.6 }}>16px</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
        <IconButton icon={Gear} size={20} title="Medium" />
        <span style={{ fontSize: '10px', opacity: 0.6 }}>20px</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
        <IconButton icon={Gear} size={24} title="Large" />
        <span style={{ fontSize: '10px', opacity: 0.6 }}>24px</span>
      </div>
    </div>
  ),
};

/**
 * Toolbar pattern example
 */
export const Toolbar: Story = {
  render: () => (
    <div style={{ 
      display: 'flex', 
      gap: '4px', 
      padding: '8px', 
      background: 'var(--bg-secondary)', 
      borderRadius: '12px',
      border: '1px solid var(--border-default)',
    }}>
      <IconButton icon={Plus} title="Add" />
      <IconButton icon={Pencil} title="Edit" />
      <IconButton icon={Copy} title="Duplicate" />
      <div style={{ width: '1px', background: 'var(--border-default)', margin: '4px 4px' }} />
      <IconButton icon={Trash} title="Delete" />
    </div>
  ),
};

/**
 * Accessibility - keyboard navigation
 */
export const KeyboardNavigation: Story = {
  args: {
    icon: Check,
    title: 'Confirm action',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button');
    
    // Tab to focus
    await userEvent.tab();
    expect(button).toHaveFocus();
    
    // Press Enter
    await userEvent.keyboard('{Enter}');
    
    // Verify still in document
    expect(button).toBeInTheDocument();
  },
  parameters: {
    a11y: {
      disable: false,
    },
  },
};

/**
 * Dark mode variant
 */
export const DarkMode: Story = {
  parameters: {
    backgrounds: {
      default: 'dark',
    },
  },
  render: () => (
    <div style={{ display: 'flex', gap: '12px' }}>
      <IconButton icon={Gear} title="Settings" />
      <IconButton icon={Gear} active title="Settings Active" />
      <IconButton icon={Plus} title="Add" />
      <IconButton icon={Trash} title="Delete" />
    </div>
  ),
};

/**
 * Light mode variant
 */
export const LightMode: Story = {
  parameters: {
    backgrounds: {
      default: 'light',
    },
  },
  render: () => (
    <div style={{ display: 'flex', gap: '12px' }}>
      <IconButton icon={Gear} title="Settings" />
      <IconButton icon={Gear} active title="Settings Active" />
      <IconButton icon={Plus} title="Add" />
      <IconButton icon={Trash} title="Delete" />
    </div>
  ),
};
