import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { userEvent, within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';
import { ControlCenter, PairedEndpoint } from './ControlCenter';

/**
 * ControlCenter Component
 * 
 * Platform wiring overlay for managing browser pairing, policies,
 * compute runtimes, secrets, SSH connections, and dev tools.
 * 
 * @evidence UI_TEST, VISUAL_REGRESSION
 */
const meta: Meta<typeof ControlCenter> = {
  title: 'Shell/ControlCenter',
  component: ControlCenter,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    a2r: {
      componentId: 'shell-control-center',
      evidence: {
        types: ['INTERACTION_TEST', 'VISUAL_SNAPSHOT'],
        dagNode: 'ui-components/shell/control-center',
      },
    },
  },
  argTypes: {
    isOpen: {
      control: 'boolean',
      description: 'Whether the control center is open',
    },
    isDevMode: {
      control: 'boolean',
      description: 'Enable dev tools section',
    },
    agentationEnabled: {
      control: 'boolean',
      description: 'Agentation toggle state',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

const mockEndpoints: PairedEndpoint[] = [
  {
    id: 'endpoint_1',
    type: 'extension',
    name: 'Chrome Extension (A2R-1234)',
    pairedAt: new Date(Date.now() - 86400000).toISOString(),
    status: 'connected',
    tabId: 42,
  },
  {
    id: 'endpoint_2',
    type: 'runtime',
    name: 'Local Runtime',
    pairedAt: new Date(Date.now() - 172800000).toISOString(),
    status: 'disconnected',
  },
];

/**
 * Default closed state
 */
export const Closed: Story = {
  args: {
    isOpen: false,
  },
};

/**
 * Open Control Center
 */
export const Open: Story = {
  args: {
    isOpen: true,
  },
};

/**
 * Browser Pairing Section
 */
export const BrowserPairing: Story = {
  args: {
    isOpen: true,
    pairedEndpoints: mockEndpoints,
  },
};

/**
 * Empty Browser Pairing
 */
export const EmptyPairing: Story = {
  args: {
    isOpen: true,
    pairedEndpoints: [],
  },
};

/**
 * Policy Section
 */
export const PolicySection: Story = {
  args: {
    isOpen: true,
    allowedHosts: ['example.com', 'github.com', 'localhost'],
  },
};

/**
 * With Dev Tools
 */
export const WithDevTools: Story = {
  args: {
    isOpen: true,
    isDevMode: true,
    agentationEnabled: false,
  },
};

/**
 * Interactive Control Center
 */
export const Interactive: Story = {
  render: () => {
    const [isOpen, setIsOpen] = useState(true);
    const [endpoints, setEndpoints] = useState<PairedEndpoint[]>(mockEndpoints);
    const [hosts, setHosts] = useState<string[]>(['example.com']);
    const [agentation, setAgentation] = useState(false);
    
    return (
      <div>
        <button 
          onClick={() => setIsOpen(true)}
          style={{
            padding: '12px 24px',
            margin: '24px',
            borderRadius: '8px',
            border: '1px solid var(--border-default)',
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            cursor: 'pointer',
          }}
        >
          Open Control Center
        </button>
        <ControlCenter
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          pairedEndpoints={endpoints}
          onPairEndpoint={(ep) => setEndpoints([...endpoints, ep])}
          onUnpairEndpoint={(id) => setEndpoints(endpoints.filter(e => e.id !== id))}
          allowedHosts={hosts}
          onAddAllowedHost={(host) => setHosts([...hosts, host])}
          onRemoveAllowedHost={(host) => setHosts(hosts.filter(h => h !== host))}
          isDevMode={true}
          agentationEnabled={agentation}
          onToggleAgentation={setAgentation}
        />
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const openButton = canvas.getByText('Open Control Center');
    
    await userEvent.click(openButton);
    
    // Should show control center (check for title)
    expect(canvas.getByText('Control Center')).toBeInTheDocument();
  },
};

/**
 * Section navigation
 */
export const SectionNavigation: Story = {
  render: () => {
    const [activeSection, setActiveSection] = useState('browser-pairing');
    
    return (
      <div style={{ padding: '24px' }}>
        <h3 style={{ marginBottom: '16px' }}>Available Sections</h3>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '24px' }}>
          {['browser-pairing', 'policies', 'runtime', 'compute', 'secrets', 'ssh', 'dev-tools'].map(section => (
            <button
              key={section}
              onClick={() => setActiveSection(section)}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: '1px solid var(--border-default)',
                background: activeSection === section ? 'var(--accent-chat)' : 'var(--bg-secondary)',
                color: activeSection === section ? 'white' : 'inherit',
                cursor: 'pointer',
                textTransform: 'capitalize',
              }}
            >
              {section.replace('-', ' ')}
            </button>
          ))}
        </div>
        <p>Active: {activeSection}</p>
      </div>
    );
  },
};

/**
 * Full demo with all sections
 */
export const FullDemo: Story = {
  render: () => {
    const [isOpen, setIsOpen] = useState(true);
    
    return (
      <div>
        <ControlCenter
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          pairedEndpoints={mockEndpoints}
          allowedHosts={['example.com', 'github.com', 'api.example.com']}
          isDevMode={true}
          agentationEnabled={true}
        />
        {!isOpen && (
          <button 
            onClick={() => setIsOpen(true)}
            style={{
              padding: '12px 24px',
              margin: '24px',
              borderRadius: '8px',
              border: '1px solid var(--border-default)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
            }}
          >
            Reopen Control Center
          </button>
        )}
      </div>
    );
  },
};

/**
 * Responsive preview
 */
export const Responsive: Story = {
  args: {
    isOpen: true,
    pairedEndpoints: mockEndpoints,
    allowedHosts: ['example.com'],
    isDevMode: true,
  },
  parameters: {
    chromatic: {
      viewports: [1280, 768],
      delay: 500,
    },
  },
};

/**
 * Keyboard interaction
 */
export const KeyboardInteraction: Story = {
  args: {
    isOpen: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Press Escape to close
    await userEvent.keyboard('{Escape}');
  },
};
