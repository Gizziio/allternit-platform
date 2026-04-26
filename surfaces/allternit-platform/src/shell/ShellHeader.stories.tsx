import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { userEvent, within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';
import { ShellHeader } from './ShellHeader';

/**
 * ShellHeader Component
 * 
 * Main application header with mode switching, navigation, and theme controls.
 * Provides consistent top-level navigation across all views.
 * 
 * @evidence UI_TEST, VISUAL_REGRESSION, A11Y_COMPLIANCE
 */
const meta: Meta<typeof ShellHeader> = {
  title: 'Shell/Header',
  component: ShellHeader,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    allternit: {
      componentId: 'shell-header',
      evidence: {
        types: ['INTERACTION_TEST', 'VISUAL_SNAPSHOT', 'A11Y_SCAN'],
        dagNode: 'ui-components/shell/header',
      },
    },
  },
  argTypes: {
    title: {
      control: 'text',
      description: 'Header title',
    },
    activeMode: {
      control: 'select',
      options: ['chat', 'cowork', 'code'],
      description: 'Current application mode',
    },
    theme: {
      control: 'select',
      options: ['light', 'dark'],
      description: 'Current theme',
    },
    isRailCollapsed: {
      control: 'boolean',
      description: 'Whether the sidebar rail is collapsed',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default ShellHeader in chat mode
 */
export const Default: Story = {
  args: {
    activeMode: 'chat',
    theme: 'dark',
    isRailCollapsed: false,
  },
};

/**
 * Interactive ShellHeader with mode switching
 */
export const Interactive: Story = {
  render: () => {
    const [mode, setMode] = useState<'chat' | 'cowork' | 'code' | 'design'>('chat');
    const [theme, setTheme] = useState<'light' | 'dark'>('dark');
    const [railCollapsed, setRailCollapsed] = useState(false);
    
    return (
      <ShellHeader
        activeMode={mode}
        onModeChange={setMode}
        theme={theme}
        onThemeToggle={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
        isRailCollapsed={railCollapsed}
        onRailToggle={() => setRailCollapsed(!railCollapsed)}
        onBack={() => console.log('Back')}
        onForward={() => console.log('Forward')}
        onOpenControlCenter={() => console.log('Open Control Center')}
      />
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const coworkButton = canvas.getByText('Cowork');
    
    // Click mode button
    await userEvent.click(coworkButton);
    expect(coworkButton.closest('button')).toHaveStyle({ background: expect.stringContaining('rgb') });
  },
};

/**
 * All mode variants
 */
export const AllModes: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <ShellHeader activeMode="chat" theme="dark" isRailCollapsed={false} onModeChange={() => {}} onThemeToggle={() => {}} onRailToggle={() => {}} />
      <ShellHeader activeMode="cowork" theme="dark" isRailCollapsed={false} onModeChange={() => {}} onThemeToggle={() => {}} onRailToggle={() => {}} />
      <ShellHeader activeMode="code" theme="dark" isRailCollapsed={false} onModeChange={() => {}} onThemeToggle={() => {}} onRailToggle={() => {}} />
    </div>
  ),
  parameters: {
    chromatic: {
      delay: 500,
    },
  },
};

/**
 * Theme variants
 */
export const ThemeVariants: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <ShellHeader activeMode="chat" theme="dark" isRailCollapsed={false} onModeChange={() => {}} onThemeToggle={() => {}} onRailToggle={() => {}} />
      <ShellHeader activeMode="chat" theme="light" isRailCollapsed={false} onModeChange={() => {}} onThemeToggle={() => {}} onRailToggle={() => {}} />
    </div>
  ),
};

/**
 * Rail collapsed state
 */
export const RailCollapsed: Story = {
  args: {
    activeMode: 'chat',
    theme: 'dark',
    isRailCollapsed: true,
  },
};

/**
 * Rail expanded state
 */
export const RailExpanded: Story = {
  args: {
    activeMode: 'chat',
    theme: 'dark',
    isRailCollapsed: false,
  },
};

/**
 * With environment selector
 */
export const WithEnvironment: Story = {
  render: () => {
    const [env, setEnv] = useState<'local' | 'byoc-vps' | 'cloud' | 'hybrid'>('cloud');
    return (
      <ShellHeader
        activeMode="chat"
        theme="dark"
        isRailCollapsed={false}
        currentEnvironment={env}
        onEnvironmentChange={setEnv}
        onModeChange={() => {}}
        onThemeToggle={() => {}}
        onRailToggle={() => {}}
      />
    );
  },
};

/**
 * Navigation buttons interaction
 */
export const Navigation: Story = {
  render: () => {
    const [canGoBack, setCanGoBack] = useState(true);
    const [canGoForward, setCanGoForward] = useState(false);
    
    return (
      <ShellHeader
        activeMode="chat"
        theme="dark"
        isRailCollapsed={false}
        onModeChange={() => {}}
        onThemeToggle={() => {}}
        onRailToggle={() => {}}
        onBack={canGoBack ? () => {
          setCanGoBack(false);
          setCanGoForward(true);
        } : undefined}
        onForward={canGoForward ? () => {
          setCanGoForward(false);
          setCanGoBack(true);
        } : undefined}
      />
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const backButton = canvas.getAllByRole('button').find(b => b.querySelector('svg'));
    
    if (backButton) {
      await userEvent.click(backButton);
    }
  },
};

/**
 * Full demo with all interactions
 */
export const FullDemo: Story = {
  render: () => {
    const [mode, setMode] = useState<'chat' | 'cowork' | 'code' | 'design'>('chat');
    const [theme, setTheme] = useState<'light' | 'dark'>('dark');
    const [railCollapsed, setRailCollapsed] = useState(false);
    const [env, setEnv] = useState<'local' | 'byoc-vps' | 'cloud' | 'hybrid'>('cloud');
    const [controlCenterOpen, setControlCenterOpen] = useState(false);
    
    return (
      <div>
        <ShellHeader
          activeMode={mode}
          onModeChange={setMode}
          theme={theme}
          onThemeToggle={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
          isRailCollapsed={railCollapsed}
          onRailToggle={() => setRailCollapsed(!railCollapsed)}
          currentEnvironment={env}
          onEnvironmentChange={setEnv}
          onOpenControlCenter={() => setControlCenterOpen(true)}
        />
        {controlCenterOpen && (
          <div style={{
            position: 'fixed',
            top: 80,
            right: 16,
            padding: 16,
            background: 'var(--bg-secondary)',
            borderRadius: 12,
            border: '1px solid var(--border-default)',
            zIndex: 100,
          }}>
            <p style={{ margin: '0 0 8px 0' }}>Control Center Mock</p>
            <button 
              onClick={() => setControlCenterOpen(false)}
              style={{
                padding: '4px 8px',
                borderRadius: 4,
                border: 'none',
                background: 'var(--accent-chat)',
                color: 'white',
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
        )}
        <div style={{ padding: 24 }}>
          <p>Mode: {mode}</p>
          <p>Theme: {theme}</p>
          <p>Rail: {railCollapsed ? 'collapsed' : 'expanded'}</p>
          <p>Environment: {env}</p>
        </div>
      </div>
    );
  },
};

/**
 * Keyboard navigation test
 */
export const KeyboardNavigation: Story = {
  args: {
    activeMode: 'chat',
    theme: 'dark',
    isRailCollapsed: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const buttons = canvas.getAllByRole('button');
    
    // Tab through buttons
    for (const button of buttons.slice(0, 3)) {
      await userEvent.tab();
      expect(button).toHaveFocus();
    }
  },
  parameters: {
    a11y: {
      disable: false,
    },
  },
};

/**
 * Responsive preview
 */
export const Responsive: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <p style={{ fontSize: '12px', opacity: 0.6, marginBottom: '8px' }}>Desktop</p>
        <div style={{ maxWidth: '100%' }}>
          <ShellHeader activeMode="chat" theme="dark" isRailCollapsed={false} onModeChange={() => {}} onThemeToggle={() => {}} onRailToggle={() => {}} />
        </div>
      </div>
    </div>
  ),
  parameters: {
    chromatic: {
      viewports: [1280, 768, 375],
    },
  },
};
