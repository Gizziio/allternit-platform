import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { userEvent, within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';
import { Fade, fadePresets } from './Fade';

/**
 * Fade Animation Component
 * 
 * GPU-accelerated fade in/out animation with optional directional movement.
 * Uses transform and opacity only for optimal performance.
 * Automatically respects prefers-reduced-motion.
 * 
 * @evidence UI_TEST, VISUAL_REGRESSION, A11Y_COMPLIANCE
 */
const meta: Meta<typeof Fade> = {
  title: 'Design/Animation/Fade',
  component: Fade,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    allternit: {
      componentId: 'design-animation-fade',
      evidence: {
        types: ['INTERACTION_TEST', 'VISUAL_SNAPSHOT', 'A11Y_SCAN'],
        dagNode: 'ui-components/design/animation/fade',
      },
    },
  },
  argTypes: {
    in: {
      control: 'boolean',
      description: 'Whether the element is visible',
    },
    duration: {
      control: 'number',
      description: 'Animation duration in seconds',
    },
    delay: {
      control: 'number',
      description: 'Delay before animation starts',
    },
    direction: {
      control: 'select',
      options: ['up', 'down', 'left', 'right', 'none'],
      description: 'Direction of movement during fade',
    },
    distance: {
      control: 'number',
      description: 'Distance to move in pixels',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default fade animation
 */
export const Default: Story = {
  args: {
    in: true,
    children: 'Fading Content',
  },
};

/**
 * Interactive fade toggle
 */
export const Interactive: Story = {
  render: () => {
    const [visible, setVisible] = useState(true);
    return (
      <div style={{ textAlign: 'center' }}>
        <button 
          onClick={() => setVisible(!visible)}
          style={{
            padding: '8px 16px',
            marginBottom: '24px',
            borderRadius: '8px',
            border: '1px solid var(--border-default)',
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            cursor: 'pointer',
          }}
        >
          {visible ? 'Hide' : 'Show'}
        </button>
        <Fade in={visible}>
          <div style={{
            padding: '32px',
            background: 'var(--accent-chat)',
            borderRadius: '12px',
            color: 'white',
            fontWeight: 600,
          }}>
            Toggle Me!
          </div>
        </Fade>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button');
    const content = canvas.getByText('Toggle Me!');
    
    // Initially visible
    expect(content).toBeVisible();
    
    // Click to hide
    await userEvent.click(button);
    expect(button).toHaveTextContent('Show');
  },
};

/**
 * All fade directions
 */
export const Directions: Story = {
  render: () => {
    const [key, setKey] = useState(0);
    const directions: Array<'up' | 'down' | 'left' | 'right'> = ['up', 'down', 'left', 'right'];
    
    return (
      <div style={{ textAlign: 'center' }}>
        <button 
          onClick={() => setKey(k => k + 1)}
          style={{
            padding: '8px 16px',
            marginBottom: '32px',
            borderRadius: '8px',
            border: '1px solid var(--border-default)',
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            cursor: 'pointer',
          }}
        >
          Replay Animations
        </button>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
          {directions.map((dir) => (
            <Fade key={`${dir}-${key}`} in={true} direction={dir} delay={0.1 * directions.indexOf(dir)}>
              <div style={{
                padding: '24px',
                background: 'var(--bg-secondary)',
                borderRadius: '8px',
                border: '1px solid var(--border-default)',
                textAlign: 'center',
              }}>
                <div style={{ fontWeight: 600, textTransform: 'capitalize' }}>{dir}</div>
              </div>
            </Fade>
          ))}
        </div>
      </div>
    );
  },
};

/**
 * Fade with different durations
 */
export const Durations: Story = {
  render: () => {
    const [key, setKey] = useState(0);
    const durations = [
      { label: 'Fast (0.14s)', duration: 0.14 },
      { label: 'Base (0.2s)', duration: 0.2 },
      { label: 'Slow (0.3s)', duration: 0.3 },
      { label: 'Very Slow (0.5s)', duration: 0.5 },
    ];
    
    return (
      <div style={{ textAlign: 'center' }}>
        <button 
          onClick={() => setKey(k => k + 1)}
          style={{
            padding: '8px 16px',
            marginBottom: '32px',
            borderRadius: '8px',
            border: '1px solid var(--border-default)',
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            cursor: 'pointer',
          }}
        >
          Replay
        </button>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '300px' }}>
          {durations.map((item, index) => (
            <Fade key={`${key}-${index}`} in={true} duration={item.duration} delay={index * 0.1}>
              <div style={{
                padding: '16px',
                background: 'var(--bg-secondary)',
                borderRadius: '8px',
                border: '1px solid var(--border-default)',
              }}>
                {item.label}
              </div>
            </Fade>
          ))}
        </div>
      </div>
    );
  },
};

/**
 * Fade presets demonstration
 */
export const Presets: Story = {
  render: () => {
    const [key, setKey] = useState(0);
    
    return (
      <div style={{ textAlign: 'center' }}>
        <button 
          onClick={() => setKey(k => k + 1)}
          style={{
            padding: '8px 16px',
            marginBottom: '32px',
            borderRadius: '8px',
            border: '1px solid var(--border-default)',
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            cursor: 'pointer',
          }}
        >
          Replay Presets
        </button>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
          <Fade key={`quick-${key}`} in={true} {...fadePresets.quick}>
            <div style={{ padding: '20px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
              Quick
            </div>
          </Fade>
          <Fade key={`standard-${key}`} in={true} {...fadePresets.standard}>
            <div style={{ padding: '20px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
              Standard
            </div>
          </Fade>
          <Fade key={`up-${key}`} in={true} {...fadePresets.up}>
            <div style={{ padding: '20px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
              Fade Up
            </div>
          </Fade>
          <Fade key={`slow-${key}`} in={true} {...fadePresets.slow}>
            <div style={{ padding: '20px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
              Slow
            </div>
          </Fade>
        </div>
      </div>
    );
  },
};

/**
 * Staggered children animation
 */
export const Staggered: Story = {
  render: () => {
    const [key, setKey] = useState(0);
    const items = ['Item 1', 'Item 2', 'Item 3', 'Item 4', 'Item 5'];
    
    return (
      <div style={{ textAlign: 'center' }}>
        <button 
          onClick={() => setKey(k => k + 1)}
          style={{
            padding: '8px 16px',
            marginBottom: '24px',
            borderRadius: '8px',
            border: '1px solid var(--border-default)',
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            cursor: 'pointer',
          }}
        >
          Replay Stagger
        </button>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '250px' }}>
          {items.map((item, index) => (
            <Fade key={`${key}-${index}`} in={true} delay={index * 0.1} direction="up">
              <div style={{
                padding: '12px 16px',
                background: 'var(--accent-chat)',
                borderRadius: '8px',
                color: 'white',
              }}>
                {item}
              </div>
            </Fade>
          ))}
        </div>
      </div>
    );
  },
};

/**
 * Accessibility - reduced motion support
 */
export const ReducedMotion: Story = {
  render: () => (
    <div style={{ textAlign: 'center' }}>
      <p style={{ marginBottom: '16px', opacity: 0.7 }}>
        Respects prefers-reduced-motion automatically
      </p>
      <Fade in={true} duration={2}>
        <div style={{
          padding: '32px',
          background: 'var(--bg-secondary)',
          borderRadius: '12px',
          border: '2px dashed var(--border-default)',
        }}>
          Try enabling &quot;Reduce motion&quot; in your system preferences
        </div>
      </Fade>
    </div>
  ),
};
