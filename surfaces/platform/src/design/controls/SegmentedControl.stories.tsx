import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { userEvent, within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';
import { SegmentedControl } from './SegmentedControl';

/**
 * SegmentedControl Component
 * 
 * A toggle control for switching between multiple options.
 * Features smooth transitions and clear active state indication.
 * 
 * @evidence UI_TEST, VISUAL_REGRESSION, A11Y_COMPLIANCE
 */
const meta: Meta<typeof SegmentedControl> = {
  title: 'Design/Controls/SegmentedControl',
  component: SegmentedControl,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    a2r: {
      componentId: 'design-controls-segmented-control',
      evidence: {
        types: ['INTERACTION_TEST', 'VISUAL_SNAPSHOT', 'A11Y_SCAN'],
        dagNode: 'ui-components/design/controls/segmented-control',
      },
    },
  },
  argTypes: {
    options: {
      control: 'object',
      description: 'Array of options with value and label',
    },
    value: {
      control: 'text',
      description: 'Currently selected value',
    },
    onChange: {
      action: 'changed',
      description: 'Change handler',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

const defaultOptions = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
];

/**
 * Default SegmentedControl
 */
export const Default: Story = {
  args: {
    options: defaultOptions,
    value: 'day',
  },
};

/**
 * Interactive SegmentedControl with state
 */
export const Interactive: Story = {
  render: () => {
    const [value, setValue] = useState('day');
    return (
      <SegmentedControl
        options={defaultOptions}
        value={value}
        onChange={setValue}
      />
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const weekButton = canvas.getByRole('button', { name: /week/i });
    
    // Click week option
    await userEvent.click(weekButton);
    expect(weekButton).toHaveStyle({ background: 'rgba(255, 255, 255, 0.1)' });
  },
};

/**
 * Two option toggle (binary choice)
 */
export const Binary: Story = {
  render: () => {
    const [value, setValue] = useState('grid');
    const options = [
      { value: 'grid', label: 'Grid' },
      { value: 'list', label: 'List' },
    ];
    return (
      <SegmentedControl
        options={options}
        value={value}
        onChange={setValue}
      />
    );
  },
};

/**
 * Many options
 */
export const ManyOptions: Story = {
  render: () => {
    const [value, setValue] = useState('small');
    const options = [
      { value: 'xs', label: 'XS' },
      { value: 'small', label: 'S' },
      { value: 'medium', label: 'M' },
      { value: 'large', label: 'L' },
      { value: 'xl', label: 'XL' },
      { value: 'xxl', label: '2XL' },
    ];
    return (
      <SegmentedControl
        options={options}
        value={value}
        onChange={setValue}
      />
    );
  },
};

/**
 * View mode selector pattern
 */
export const ViewModeSelector: Story = {
  render: () => {
    const [value, setValue] = useState('chat');
    const options = [
      { value: 'chat', label: 'Chat' },
      { value: 'cowork', label: 'Cowork' },
      { value: 'code', label: 'Code' },
    ];
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
        <span style={{ fontSize: '12px', opacity: 0.6 }}>Current Mode</span>
        <SegmentedControl
          options={options}
          value={value}
          onChange={setValue}
        />
      </div>
    );
  },
};

/**
 * Time range selector
 */
export const TimeRangeSelector: Story = {
  render: () => {
    const [value, setValue] = useState('24h');
    const options = [
      { value: '1h', label: '1H' },
      { value: '24h', label: '24H' },
      { value: '7d', label: '7D' },
      { value: '30d', label: '30D' },
      { value: '90d', label: '90D' },
      { value: '1y', label: '1Y' },
    ];
    return (
      <SegmentedControl
        options={options}
        value={value}
        onChange={setValue}
      />
    );
  },
};

/**
 * Keyboard navigation test
 */
export const KeyboardNavigation: Story = {
  render: () => {
    const [value, setValue] = useState('day');
    return (
      <SegmentedControl
        options={defaultOptions}
        value={value}
        onChange={setValue}
      />
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const buttons = canvas.getAllByRole('button');
    
    // Tab to first button
    await userEvent.tab();
    expect(buttons[0]).toHaveFocus();
    
    // Tab to second button
    await userEvent.tab();
    expect(buttons[1]).toHaveFocus();
    
    // Press Enter to select
    await userEvent.keyboard('{Enter}');
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
  render: () => {
    const [value, setValue] = useState('week');
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <SegmentedControl
          options={defaultOptions}
          value={value}
          onChange={setValue}
        />
        <SegmentedControl
          options={[
            { value: 'grid', label: 'Grid' },
            { value: 'list', label: 'List' },
          ]}
          value="grid"
          onChange={() => {}}
        />
      </div>
    );
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
  render: () => {
    const [value, setValue] = useState('week');
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <SegmentedControl
          options={defaultOptions}
          value={value}
          onChange={setValue}
        />
        <SegmentedControl
          options={[
            { value: 'grid', label: 'Grid' },
            { value: 'list', label: 'List' },
          ]}
          value="grid"
          onChange={() => {}}
        />
      </div>
    );
  },
};
