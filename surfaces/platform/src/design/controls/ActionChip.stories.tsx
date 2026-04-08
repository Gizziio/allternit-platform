import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { userEvent, within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';
import { ActionChip } from './ActionChip';

/**
 * ActionChip Component
 * 
 * A compact, clickable chip component for actions and selections.
 * Features subtle glass morphism styling with hover states.
 * 
 * @evidence UI_TEST, VISUAL_REGRESSION, A11Y_COMPLIANCE
 */
const meta: Meta<typeof ActionChip> = {
  title: 'Design/Controls/ActionChip',
  component: ActionChip,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    allternit: {
      componentId: 'design-controls-action-chip',
      evidence: {
        types: ['INTERACTION_TEST', 'VISUAL_SNAPSHOT', 'A11Y_SCAN'],
        dagNode: 'ui-components/design/controls/action-chip',
      },
    },
  },
  argTypes: {
    label: {
      control: 'text',
      description: 'Chip label text',
    },
    onClick: {
      action: 'clicked',
      description: 'Click handler',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default ActionChip appearance
 */
export const Default: Story = {
  args: {
    label: 'Action',
  },
};

/**
 * ActionChip with click interaction
 */
export const Clickable: Story = {
  args: {
    label: 'Click Me',
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const chip = canvas.getByRole('button');
    
    // Verify button is rendered
    expect(chip).toBeInTheDocument();
    expect(chip).toHaveTextContent('Click Me');
    
    // Click the chip
    await userEvent.click(chip);
  },
};

/**
 * Various label examples
 */
export const Labels: Story = {
  render: () => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', maxWidth: '400px' }}>
      <ActionChip label="Filter" />
      <ActionChip label="Sort" />
      <ActionChip label="+ Add" />
      <ActionChip label="Active" />
      <ActionChip label="Pending Review" />
      <ActionChip label="2024" />
    </div>
  ),
};

/**
 * Interactive chip with state
 */
export const WithState: Story = {
  render: () => {
    const [active, setActive] = useState(false);
    return (
      <ActionChip 
        label={active ? '✓ Selected' : 'Select'}
        onClick={() => setActive(!active)}
      />
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const chip = canvas.getByRole('button');
    
    // Initial state
    expect(chip).toHaveTextContent('Select');
    
    // Click to activate
    await userEvent.click(chip);
    expect(chip).toHaveTextContent('✓ Selected');
  },
};

/**
 * Multiple selectable chips
 */
export const MultiSelect: Story = {
  render: () => {
    const [selected, setSelected] = useState<string[]>(['option1']);
    const options = [
      { id: 'option1', label: 'Option 1' },
      { id: 'option2', label: 'Option 2' },
      { id: 'option3', label: 'Option 3' },
      { id: 'option4', label: 'Option 4' },
    ];
    
    const toggle = (id: string) => {
      setSelected(prev => 
        prev.includes(id) 
          ? prev.filter(i => i !== id)
          : [...prev, id]
      );
    };
    
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        {options.map(option => (
          <ActionChip 
            key={option.id}
            label={selected.includes(option.id) ? `✓ ${option.label}` : option.label}
            onClick={() => toggle(option.id)}
          />
        ))}
      </div>
    );
  },
};

/**
 * Long labels with truncation
 */
export const LongLabels: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <ActionChip label="Short" />
      <ActionChip label="Medium length label" />
      <ActionChip label="Very long label that might need truncation" />
    </div>
  ),
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
    <div style={{ display: 'flex', gap: '8px' }}>
      <ActionChip label="Filter" />
      <ActionChip label="Sort" />
      <ActionChip label="Active" />
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
    <div style={{ display: 'flex', gap: '8px' }}>
      <ActionChip label="Filter" />
      <ActionChip label="Sort" />
      <ActionChip label="Active" />
    </div>
  ),
};
