import type { Meta, StoryObj } from '@storybook/react';
import { userEvent, within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';
import { Button } from './button';

/**
 * A2R UI Component: Button
 * 
 * Evidence for: UI_TEST, A11Y_COMPLIANCE
 */
const meta: Meta<typeof Button> = {
  title: 'A2R/UI/Button',
  component: Button,
  parameters: {
    // A2R Evidence metadata
    a2r: {
      componentId: 'ui-button',
      evidence: {
        types: ['INTERACTION_TEST', 'VISUAL_SNAPSHOT', 'A11Y_SCAN'],
        dagNode: 'ui-components/button',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'ghost', 'destructive'],
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

/**
 * Primary button - main call-to-action
 */
export const Primary: Story = {
  args: {
    variant: 'primary',
    size: 'md',
    children: 'Click me',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button', { name: /click me/i });
    
    // Interaction test
    await userEvent.click(button);
    
    // Verify button is still rendered after click
    expect(button).toBeInTheDocument();
  },
};

/**
 * Secondary button - alternative action
 */
export const Secondary: Story = {
  args: {
    variant: 'secondary',
    size: 'md',
    children: 'Secondary Action',
  },
};

/**
 * Button sizes
 */
export const Sizes: Story = {
  render: () => (
    <div className="flex gap-2 items-center">
      <Button size="sm">Small</Button>
      <Button size="md">Medium</Button>
      <Button size="lg">Large</Button>
    </div>
  ),
  parameters: {
    a2r: {
      evidence: {
        types: ['VISUAL_REGRESSION'],
      },
    },
  },
};

/**
 * Button with loading state
 */
export const Loading: Story = {
  args: {
    variant: 'primary',
    loading: true,
    children: 'Loading...',
  },
};

/**
 * Accessibility test - keyboard navigation
 */
export const KeyboardNavigation: Story = {
  args: {
    children: 'Press Enter',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button');
    
    // Tab to button
    await userEvent.tab();
    expect(button).toHaveFocus();
    
    // Press Enter
    await userEvent.keyboard('{Enter}');
  },
  parameters: {
    a11y: {
      disable: false,
    },
  },
};
