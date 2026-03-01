import type { Preview } from '@storybook/react';
import React from 'react';
import '../src/app/globals.css';
import { withTheme, withGlass } from './decorators';

const preview: Preview = {
  parameters: {
    actions: { argTypesRegex: '^on[A-Z].*' },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
    a11y: {
      config: {
        rules: [
          {
            id: 'color-contrast',
            enabled: true,
          },
        ],
      },
    },
    // Chromatic visual regression testing
    chromatic: {
      viewports: [320, 768, 1280],
      delay: 300,
    },
    // A2R Evidence metadata
    a2r: {
      evidence: {
        emitToWih: true,
        requiredFor: ['UI_TESTS', 'VISUAL_REGRESSION', 'A11Y_COMPLIANCE'],
      },
    },
    // Backgrounds for stories
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: '#0f0f0f' },
        { name: 'light', value: '#ffffff' },
        { name: 'glass', value: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)' },
      ],
    },
  },
  globalTypes: {
    theme: {
      name: 'Theme',
      description: 'Global theme for components',
      defaultValue: 'dark',
      toolbar: {
        icon: 'circlehollow',
        items: [
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
        ],
        showName: true,
      },
    },
  },
  decorators: [
    withTheme,
    (Story) => (
      <div className="a2r-storybook-wrapper">
        <Story />
      </div>
    ),
  ],
};

export default preview;
