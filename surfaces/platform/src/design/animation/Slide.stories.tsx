import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { Slide, slidePresets } from './Slide';

/**
 * Slide Animation Component
 * 
 * GPU-accelerated slide transitions. Optimized for transform-only animation.
 * Perfect for drawers, panels, toasts, and dropdown content.
 * Automatically respects prefers-reduced-motion.
 * 
 * @evidence UI_TEST, VISUAL_REGRESSION
 */
const meta: Meta<typeof Slide> = {
  title: 'Design/Animation/Slide',
  component: Slide,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    allternit: {
      componentId: 'design-animation-slide',
      evidence: {
        types: ['INTERACTION_TEST', 'VISUAL_SNAPSHOT'],
        dagNode: 'ui-components/design/animation/slide',
      },
    },
  },
  argTypes: {
    direction: {
      control: 'select',
      options: ['up', 'down', 'left', 'right'],
      description: 'Direction of slide animation',
    },
    in: {
      control: 'boolean',
      description: 'Whether the element is visible',
    },
    distance: {
      control: 'number',
      description: 'Distance to slide in pixels',
    },
    duration: {
      control: 'number',
      description: 'Animation duration in seconds',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default slide animation (from bottom)
 */
export const Default: Story = {
  args: {
    in: true,
    direction: 'up',
    children: 'Sliding Content',
  },
};

/**
 * Interactive slide toggle
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
          {visible ? 'Slide Out' : 'Slide In'}
        </button>
        <div style={{ overflow: 'hidden', height: '150px', display: 'flex', alignItems: 'center' }}>
          <Slide in={visible} direction="up" distance={100}>
            <div style={{
              padding: '32px',
              background: 'var(--accent-code)',
              borderRadius: '12px',
              color: 'white',
              fontWeight: 600,
            }}>
              Slide Me!
            </div>
          </Slide>
        </div>
      </div>
    );
  },
};

/**
 * All slide directions
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
          Replay All
        </button>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px' }}>
          {directions.map((dir, index) => (
            <div key={dir} style={{ 
              padding: '20px', 
              overflow: 'hidden',
              minHeight: '100px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Slide key={`${dir}-${key}`} in={true} direction={dir} delay={index * 0.15}>
                <div style={{
                  padding: '20px',
                  background: 'var(--bg-secondary)',
                  borderRadius: '8px',
                  border: '1px solid var(--border-default)',
                  textAlign: 'center',
                  fontWeight: 600,
                  textTransform: 'capitalize',
                  minWidth: '100px',
                }}>
                  {dir}
                </div>
              </Slide>
            </div>
          ))}
        </div>
      </div>
    );
  },
};

/**
 * Slide presets demonstration
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '300px' }}>
          <div style={{ overflow: 'hidden' }}>
            <Slide key={`drawer-${key}`} in={true} {...slidePresets.drawerLeft}>
              <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                Drawer Left (300px)
              </div>
            </Slide>
          </div>
          <div style={{ overflow: 'hidden' }}>
            <Slide key={`toast-${key}`} in={true} {...slidePresets.toast}>
              <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                Toast (right, 100px)
              </div>
            </Slide>
          </div>
          <div style={{ overflow: 'hidden' }}>
            <Slide key={`dropdown-${key}`} in={true} {...slidePresets.dropdown}>
              <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                Dropdown (down, 10px)
              </div>
            </Slide>
          </div>
          <div style={{ overflow: 'hidden' }}>
            <Slide key={`quick-${key}`} in={true} direction="up" {...slidePresets.quick}>
              <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                Quick (fast, 50px)
              </div>
            </Slide>
          </div>
        </div>
      </div>
    );
  },
};

/**
 * Different slide distances
 */
export const Distances: Story = {
  render: () => {
    const [key, setKey] = useState(0);
    const distances = [50, 100, 200, 300];
    
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '300px' }}>
          {distances.map((dist, index) => (
            <div key={dist} style={{ overflow: 'hidden' }}>
              <Slide key={`${key}-${index}`} in={true} direction="left" distance={dist} delay={index * 0.1}>
                <div style={{ padding: '16px', background: 'var(--accent-cowork)', borderRadius: '8px', color: 'white' }}>
                  {dist}px distance
                </div>
              </Slide>
            </div>
          ))}
        </div>
      </div>
    );
  },
};

/**
 * Panel/drawer simulation
 */
export const PanelSimulation: Story = {
  render: () => {
    const [open, setOpen] = useState(false);
    
    return (
      <div style={{ position: 'relative', width: '400px', height: '300px', overflow: 'hidden', border: '1px solid var(--border-default)', borderRadius: '12px' }}>
        {/* Main content */}
        <div style={{ padding: '20px' }}>
          <button 
            onClick={() => setOpen(true)}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1px solid var(--border-default)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
            }}
          >
            Open Panel
          </button>
        </div>
        
        {/* Sliding panel */}
        <Slide in={open} direction="right" distance={300}>
          <div style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: '250px',
            height: '100%',
            background: 'var(--bg-secondary)',
            borderLeft: '1px solid var(--border-default)',
            padding: '20px',
            boxShadow: '-4px 0 20px rgba(0,0,0,0.2)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0 }}>Panel</h3>
              <button 
                onClick={() => setOpen(false)}
                style={{
                  padding: '4px 8px',
                  borderRadius: '4px',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>
            <p>Sliding panel content goes here.</p>
          </div>
        </Slide>
      </div>
    );
  },
};
