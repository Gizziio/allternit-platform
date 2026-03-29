import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { ArtifactTemplateGallery } from './ArtifactTemplateGallery';

const meta: Meta<typeof ArtifactTemplateGallery> = {
  title: 'Chat/ArtifactTemplateGallery',
  component: ArtifactTemplateGallery,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'dark' },
  },
  args: {
    onOpenDirect: fn(),
    onSendPrompt: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

/** Full gallery with all 12 templates, category filter tabs, live iframe thumbnails for HTML entries */
export const Default: Story = {};

/** Narrowed to tools only */
export const ToolsOnly: Story = {
  render: (args) => (
    <div style={{ maxWidth: '720px' }}>
      <ArtifactTemplateGallery {...args} />
    </div>
  ),
};

/** Narrow viewport — verifies 2-column fallback */
export const NarrowViewport: Story = {
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
  },
};
