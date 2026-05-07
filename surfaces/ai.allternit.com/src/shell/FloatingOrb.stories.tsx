import type { Meta, StoryObj } from '@storybook/react';
import { userEvent, within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';
import { FloatingOrb } from './FloatingOrb';

/**
 * FloatingOrb Component
 * 
 * An animated floating orb button for quick AI access.
 * Features pulse animation, hover effects, and gradient styling.
 * 
 * @evidence UI_TEST, VISUAL_REGRESSION
 */
const meta: Meta<typeof FloatingOrb> = {
  title: 'Shell/FloatingOrb',
  component: FloatingOrb,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    allternit: {
      componentId: 'shell-floating-orb',
      evidence: {
        types: ['INTERACTION_TEST', 'VISUAL_SNAPSHOT'],
        dagNode: 'ui-components/shell/floating-orb',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default FloatingOrb
 */
export const Default: Story = {
  parameters: {
    chromatic: {
      delay: 500,
    },
  },
};

/**
 * Interactive with hover
 */
export const Interactive: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const orb = canvas.getByRole('button') || document.querySelector('[style*="border-radius: 50%"]');
    
    if (orb) {
      await userEvent.hover(orb as Element);
      expect(orb).toBeInTheDocument();
    }
  },
  parameters: {
    chromatic: {
      delay: 500,
    },
  },
};

/**
 * With context
 */
export const WithContext: Story = {
  render: () => (
    <div style={{ 
      height: '400px', 
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
      position: 'relative',
    }}>
      <div style={{ padding: '24px', color: 'white' }}>
        <h3>FloatingOrb Positioning</h3>
        <p style={{ opacity: 0.7 }}>
          The FloatingOrb is positioned fixed at the bottom center of the viewport.
          It pulses gently and scales on hover.
        </p>
      </div>
      <FloatingOrb />
    </div>
  ),
  parameters: {
    chromatic: {
      delay: 1000,
    },
  },
};

/**
 * Animation states
 */
export const AnimationStates: Story = {
  render: () => (
    <div style={{ 
      padding: '48px', 
      background: 'var(--bg-primary)',
      display: 'flex',
      gap: '48px',
      alignItems: 'center',
    }}>
      <div style={{ textAlign: 'center' }}>
        <p style={{ marginBottom: '16px', fontSize: '12px', opacity: 0.6 }}>Default State</p>
        <div style={{
          width: 80,
          height: 80,
          borderRadius: '50%',
          background: 'rgba(20, 20, 30, 0.4)',
          backdropFilter: 'blur(12px) saturate(150%)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{
            width: 60,
            height: 60,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #a78bfa 0%, #60a5fa 50%, #34d399 100%)',
            opacity: 0.8,
            filter: 'blur(4px)',
          }} />
        </div>
      </div>
      
      <div style={{ textAlign: 'center' }}>
        <p style={{ marginBottom: '16px', fontSize: '12px', opacity: 0.6 }}>Hover State</p>
        <div style={{
          width: 80,
          height: 80,
          borderRadius: '50%',
          background: 'rgba(20, 20, 30, 0.4)',
          backdropFilter: 'blur(12px) saturate(150%)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 12px 40px rgba(0, 0, 0, 0.4), 0 0 20px rgba(96, 165, 250, 0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: 'scale(1.05)',
        }}>
          <div style={{
            width: 60,
            height: 60,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #a78bfa 0%, #60a5fa 50%, #34d399 100%)',
            opacity: 0.8,
            filter: 'blur(4px)',
          }} />
        </div>
      </div>
      
      <div style={{ textAlign: 'center' }}>
        <p style={{ marginBottom: '16px', fontSize: '12px', opacity: 0.6 }}>Inner Elements</p>
        <div style={{
          width: 80,
          height: 80,
          borderRadius: '50%',
          background: 'rgba(20, 20, 30, 0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'white' }} />
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'white' }} />
          </div>
        </div>
      </div>
    </div>
  ),
};

/**
 * Positioning demo
 */
export const Positioning: Story = {
  render: () => (
    <div style={{ 
      height: '500px', 
      background: 'linear-gradient(180deg, #0f0f1a 0%, #1a1a2e 100%)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{ padding: '24px', color: 'white' }}>
        <h3>Fixed Positioning</h3>
        <p style={{ opacity: 0.7, maxWidth: '400px' }}>
          The FloatingOrb uses fixed positioning:
        </p>
        <ul style={{ opacity: 0.7, lineHeight: 1.8 }}>
          <li>bottom: 40px</li>
          <li>left: 50%</li>
          <li>margin-left: -40px (centered)</li>
          <li>z-index: 1000</li>
        </ul>
      </div>
      
      {/* Visual guide */}
      <div style={{
        position: 'absolute',
        bottom: 40,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 80,
        height: 80,
        border: '2px dashed rgba(255,255,255,0.2)',
        borderRadius: '50%',
      }} />
      
      <FloatingOrb />
    </div>
  ),
  parameters: {
    chromatic: {
      delay: 1000,
    },
  },
};
