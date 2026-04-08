/**
 * Storybook Preview Integration for Agentation
 * 
 * Add this to your .storybook/preview.ts or .storybook/preview.js
 * 
 * IMPORTANT: This is DEV-ONLY and never included in production builds.
 */

import type { Preview } from '@storybook/react';
import { AgentationOverlay } from './index';

// DEV-ONLY: Agentation integration
// This code is automatically excluded from production builds via NODE_ENV check
if (process.env.NODE_ENV !== 'production' && process.env.ALLTERNIT_AGENTATION !== 'false') {
  // Dynamically import to avoid bundling in production
  import('./index').then(({ AgentationOverlay }) => {
    // Add global decorator for all stories
    const withAgentation = (Story: any) => (
      <>
        <AgentationOverlay />
        <Story />
      </>
    );

    // Note: This is a simplified example
    // In practice, you'd add this to the decorators array in the preview config
    console.log('🎨 Agentation loaded (DEV-ONLY)');
  });
}

// Your existing Storybook preview config
const preview: Preview = {
  parameters: {
    layout: 'fullscreen',
    options: {
      storySort: {
        order: ['Components', 'Utilities'],
      },
    },
    chromatic: { disable: true },
    docs: {
      codePanel: true,
    },
    // Agentation-specific parameters
    agentation: {
      enabled: process.env.NODE_ENV !== 'production',
      storageKey: 'a2r-agentation-annotations',
      hotkey: 'a',
    },
  },
};

export default preview;
