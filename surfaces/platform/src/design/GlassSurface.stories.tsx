import type { Meta, StoryObj } from '@storybook/react';
import { GlassSurface, GlassIntensity } from './GlassSurface';
import { tokens } from './tokens';

/**
 * GlassSurface Component
 * 
 * Core glass morphism primitive providing backdrop blur and transparency effects.
 * Used as the foundation for cards, modals, panels, and overlays.
 * 
 * @evidence UI_TEST, VISUAL_REGRESSION
 */
const meta: Meta<typeof GlassSurface> = {
  title: 'Design/GlassSurface',
  component: GlassSurface,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'glass',
    },
    a2r: {
      componentId: 'design-glass-surface',
      evidence: {
        types: ['VISUAL_SNAPSHOT', 'A11Y_SCAN'],
        dagNode: 'ui-components/design/glass-surface',
      },
    },
  },
  argTypes: {
    intensity: {
      control: 'select',
      options: ['thin', 'base', 'elevated', 'thick'] as GlassIntensity[],
      description: 'Glass effect intensity level',
    },
    children: {
      control: 'text',
      description: 'Surface content',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default glass surface with base intensity
 */
export const Default: Story = {
  args: {
    children: 'Glass Surface',
    intensity: 'base',
  },
};

/**
 * All intensity levels side by side
 */
export const Intensities: Story = {
  render: () => (
    <div className="flex flex-col gap-4" style={{ width: '400px' }}>
      <GlassSurface intensity="thin" style={{ padding: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Thin (16px blur)</span>
          <span style={{ fontSize: '12px', opacity: 0.6 }}>Tooltips, dropdowns</span>
        </div>
      </GlassSurface>
      <GlassSurface intensity="base" style={{ padding: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Base (24px blur)</span>
          <span style={{ fontSize: '12px', opacity: 0.6 }}>Default cards</span>
        </div>
      </GlassSurface>
      <GlassSurface intensity="elevated" style={{ padding: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Elevated (32px blur)</span>
          <span style={{ fontSize: '12px', opacity: 0.6 }}>Modals, dialogs</span>
        </div>
      </GlassSurface>
      <GlassSurface intensity="thick" style={{ padding: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Thick (40px blur)</span>
          <span style={{ fontSize: '12px', opacity: 0.6 }}>Full overlays</span>
        </div>
      </GlassSurface>
    </div>
  ),
};

/**
 * Glass surface with custom styling
 */
export const CustomStyling: Story = {
  render: () => (
    <div className="flex gap-4">
      <GlassSurface 
        intensity="elevated" 
        style={{ 
          padding: '24px',
          borderRadius: '24px',
          width: '200px',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: '24px', marginBottom: '8px' }}>✨</div>
        <div style={{ fontWeight: 600 }}>Custom Radius</div>
      </GlassSurface>
      <GlassSurface 
        intensity="elevated" 
        style={{ 
          padding: '24px',
          borderRadius: '4px',
          width: '200px',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: '24px', marginBottom: '8px' }}>📐</div>
        <div style={{ fontWeight: 600 }}>Sharp Corners</div>
      </GlassSurface>
    </div>
  ),
};

/**
 * Nested glass surfaces
 */
export const Nested: Story = {
  render: () => (
    <GlassSurface intensity="thick" style={{ padding: '32px', borderRadius: '24px' }}>
      <h3 style={{ margin: '0 0 16px 0' }}>Outer Surface</h3>
      <div className="flex gap-4">
        <GlassSurface intensity="base" style={{ padding: '16px', flex: 1 }}>
          <div style={{ fontSize: '12px', opacity: 0.7 }}>Inner 1</div>
        </GlassSurface>
        <GlassSurface intensity="base" style={{ padding: '16px', flex: 1 }}>
          <div style={{ fontSize: '12px', opacity: 0.7 }}>Inner 2</div>
        </GlassSurface>
      </div>
    </GlassSurface>
  ),
};

/**
 * Dark background comparison
 */
export const DarkBackground: Story = {
  parameters: {
    backgrounds: {
      default: 'dark',
    },
  },
  render: () => (
    <div className="flex gap-4">
      {(['thin', 'base', 'elevated', 'thick'] as GlassIntensity[]).map((intensity) => (
        <GlassSurface 
          key={intensity}
          intensity={intensity} 
          style={{ 
            padding: '24px',
            width: '100px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '12px', textTransform: 'capitalize' }}>{intensity}</div>
        </GlassSurface>
      ))}
    </div>
  ),
};

/**
 * Performance stress test with many surfaces
 */
export const StressTest: Story = {
  render: () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', width: '400px' }}>
      {Array.from({ length: 16 }).map((_, i) => (
        <GlassSurface 
          key={i}
          intensity="base" 
          style={{ 
            padding: '16px',
            textAlign: 'center',
          }}
        >
          {i + 1}
        </GlassSurface>
      ))}
    </div>
  ),
  parameters: {
    chromatic: {
      delay: 500,
    },
  },
};
