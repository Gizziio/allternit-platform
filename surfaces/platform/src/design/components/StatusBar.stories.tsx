import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { userEvent, within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';
import { StatusBar, StatusBarProps } from './StatusBar';

/**
 * StatusBar Component
 * 
 * Real-time session status display with runtime state visualization.
 * Ported from terminal app for consistent status indication.
 * 
 * @evidence UI_TEST, VISUAL_REGRESSION
 */
const meta: Meta<typeof StatusBar> = {
  title: 'Design/Components/StatusBar',
  component: StatusBar,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    a2r: {
      componentId: 'design-components-status-bar',
      evidence: {
        types: ['VISUAL_SNAPSHOT', 'A11Y_SCAN'],
        dagNode: 'ui-components/design/components/status-bar',
      },
    },
  },
  argTypes: {
    state: {
      control: 'select',
      options: ['idle', 'connecting', 'hydrating', 'planning', 'web', 'executing', 'responding', 'compacting'],
      description: 'Current runtime state',
    },
    isConnecting: {
      control: 'boolean',
      description: 'Whether connection is being established',
    },
    pendingTools: {
      control: 'object',
      description: 'Array of pending tool names',
    },
    compact: {
      control: 'boolean',
      description: 'Compact mode for smaller displays',
    },
    onInterrupt: {
      action: 'interrupted',
      description: 'Interrupt handler',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default idle state
 */
export const Default: Story = {
  args: {
    state: 'idle',
  },
};

/**
 * All runtime states
 */
export const AllStates: Story = {
  render: () => {
    const states: StatusBarProps['state'][] = [
      'idle',
      'connecting',
      'hydrating',
      'planning',
      'web',
      'executing',
      'responding',
      'compacting',
    ];
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {states.map((state) => (
          <StatusBar key={state} state={state} />
        ))}
      </div>
    );
  },
};

/**
 * With pending tools
 */
export const WithTools: Story = {
  args: {
    state: 'executing',
    pendingTools: ['browser_navigate', 'element_click', 'form_submit'],
  },
};

/**
 * Compact mode
 */
export const Compact: Story = {
  args: {
    state: 'executing',
    compact: true,
    pendingTools: ['browser_navigate', 'element_click'],
  },
};

/**
 * With interrupt functionality
 */
export const WithInterrupt: Story = {
  render: () => {
    const [state, setState] = useState<StatusBarProps['state']>('executing');
    const [interruptPending, setInterruptPending] = useState(false);
    
    const handleInterrupt = () => {
      if (!interruptPending) {
        setInterruptPending(true);
        setTimeout(() => {
          setInterruptPending(false);
          setState('idle');
        }, 1000);
      }
    };
    
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <StatusBar 
          state={state} 
          onInterrupt={handleInterrupt}
          interruptPending={interruptPending}
          pendingTools={['long_running_tool']}
        />
        <button 
          onClick={() => setState('executing')}
          style={{
            padding: '8px 16px',
            marginLeft: '16px',
            borderRadius: '8px',
            border: '1px solid var(--border-default)',
            background: 'var(--bg-secondary)',
            cursor: 'pointer',
          }}
        >
          Reset to Executing
        </button>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const interruptButton = canvas.getByRole('button', { name: /esc/i });
    
    expect(interruptButton).toBeInTheDocument();
    
    await userEvent.click(interruptButton);
    expect(interruptButton).toHaveTextContent(/press again/i);
  },
};

/**
 * Connecting state with spinner
 */
export const Connecting: Story = {
  args: {
    state: 'idle',
    isConnecting: true,
  },
};

/**
 * With retry information
 */
export const WithRetry: Story = {
  args: {
    state: 'connecting',
    retryAttempt: 2,
    retryDelay: 5000,
  },
};

/**
 * With elapsed time
 */
export const WithElapsedTime: Story = {
  args: {
    state: 'executing',
    startedAt: Date.now() - 45000, // 45 seconds ago
    pendingTools: ['browser_navigate'],
  },
};

/**
 * Overflow tools (more than 3)
 */
export const OverflowTools: Story = {
  args: {
    state: 'executing',
    pendingTools: [
      'browser_navigate',
      'element_click',
      'form_submit',
      'extract_data',
      'take_screenshot',
    ],
  },
};

/**
 * Full status demonstration
 */
export const FullDemo: Story = {
  render: () => {
    const [currentState, setCurrentState] = useState<StatusBarProps['state']>('idle');
    const states: StatusBarProps['state'][] = [
      'idle',
      'connecting',
      'hydrating',
      'planning',
      'web',
      'executing',
      'responding',
      'compacting',
    ];
    
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <StatusBar 
          state={currentState}
          pendingTools={currentState === 'executing' ? ['tool_a', 'tool_b'] : []}
          startedAt={currentState !== 'idle' ? Date.now() - 30000 : undefined}
          onInterrupt={currentState !== 'idle' ? () => setCurrentState('idle') : undefined}
        />
        <div style={{ padding: '0 16px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {states.map((state) => (
            <button
              key={state}
              onClick={() => setCurrentState(state)}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border-default)',
                background: currentState === state ? 'var(--accent-chat)' : 'var(--bg-secondary)',
                color: currentState === state ? 'white' : 'inherit',
                cursor: 'pointer',
                fontSize: '12px',
                textTransform: 'capitalize',
              }}
            >
              {state}
            </button>
          ))}
        </div>
      </div>
    );
  },
};

/**
 * Responsive behavior
 */
export const Responsive: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <p style={{ padding: '0 16px', fontSize: '12px', opacity: 0.6, marginBottom: '8px' }}>Full Width</p>
        <StatusBar 
          state="executing" 
          pendingTools={['browser_navigate', 'element_click']}
          startedAt={Date.now() - 60000}
        />
      </div>
      <div>
        <p style={{ padding: '0 16px', fontSize: '12px', opacity: 0.6, marginBottom: '8px' }}>Compact</p>
        <StatusBar 
          state="executing" 
          compact
          pendingTools={['browser_navigate', 'element_click']}
          startedAt={Date.now() - 60000}
        />
      </div>
    </div>
  ),
};

/**
 * Dark mode
 */
export const DarkMode: Story = {
  parameters: {
    backgrounds: {
      default: 'dark',
    },
  },
  args: {
    state: 'executing',
    pendingTools: ['browser_navigate', 'element_click'],
    startedAt: Date.now() - 30000,
  },
};
