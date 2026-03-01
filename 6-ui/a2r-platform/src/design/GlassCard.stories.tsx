import type { Meta, StoryObj } from '@storybook/react';
import { userEvent, within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';
import { GlassCard } from './GlassCard';

/**
 * GlassCard Component
 * 
 * A card component with glass morphism effect, providing depth and visual hierarchy.
 * Built on top of GlassSurface with predefined styling for card use cases.
 * 
 * @evidence UI_TEST, VISUAL_REGRESSION, A11Y_COMPLIANCE
 */
const meta: Meta<typeof GlassCard> = {
  title: 'Design/GlassCard',
  component: GlassCard,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'glass',
    },
    a2r: {
      componentId: 'design-glass-card',
      evidence: {
        types: ['INTERACTION_TEST', 'VISUAL_SNAPSHOT', 'A11Y_SCAN'],
        dagNode: 'ui-components/design/glass-card',
      },
    },
  },
  argTypes: {
    children: {
      control: 'text',
      description: 'Card content',
    },
    className: {
      control: 'text',
      description: 'Additional CSS classes',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default GlassCard appearance
 */
export const Default: Story = {
  args: {
    children: 'Glass Card Content',
  },
};

/**
 * GlassCard with hover effect enabled
 */
export const Hoverable: Story = {
  args: {
    children: 'Hover over me',
    hover: 'lift',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const card = canvas.getByText('Hover over me').parentElement;

    // Simulate hover
    if (card) {
      await userEvent.hover(card);
      expect(card).toHaveClass('glass-card-hover');
    }
  },
};

/**
 * Multiple cards showing default styling
 */
export const Gallery: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4" style={{ maxWidth: '600px' }}>
      <GlassCard>Default Card</GlassCard>
      <GlassCard hover="lift">Hoverable</GlassCard>
      <GlassCard style={{ padding: '32px' }}>Custom Padding</GlassCard>
      <GlassCard style={{ borderRadius: '8px' }}>Custom Radius</GlassCard>
    </div>
  ),
};

/**
 * Card with rich content
 */
export const WithContent: Story = {
  render: () => (
    <GlassCard style={{ width: '300px' }}>
      <h3 style={{ margin: '0 0 12px 0', fontSize: '18px', fontWeight: 600 }}>
        Card Title
      </h3>
      <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
        This card contains rich content including a title and description text.
        The glass effect provides visual depth.
      </p>
    </GlassCard>
  ),
};

/**
 * Interactive card with click handler
 */
export const Interactive: Story = {
  render: () => {
    const [clicked, setClicked] = React.useState(false);
    return (
      <GlassCard
        hover="lift"
        style={{ cursor: 'pointer' }}
        onClick={() => setClicked(!clicked)}
      >
        <div style={{ textAlign: 'center' }}>
          <p style={{ margin: '0 0 8px 0' }}>Click me!</p>
          <span style={{
            color: clicked ? '#22c55e' : 'var(--text-secondary)',
            fontSize: '14px',
          }}>
            {clicked ? 'Clicked!' : 'Not clicked'}
          </span>
        </div>
      </GlassCard>
    );
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
  args: {
    children: 'Dark Mode Card',
    hover: 'lift',
  },
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
  args: {
    children: 'Light Mode Card',
    hover: 'lift',
  },
};
