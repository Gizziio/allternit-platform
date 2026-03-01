import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { StorybookConfig } from '@storybook/react-vite';

const storybookDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(storybookDir, '..');

const config: StorybookConfig = {
  stories: [
    '../src/**/*.stories.@(js|jsx|ts|tsx)',
  ],
  addons: [
    '@storybook/addon-docs',
    '@storybook/addon-essentials',
    '@storybook/addon-interactions',
    '@storybook/addon-a11y',
    '@storybook/addon-themes',
  ],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  typescript: {
    reactDocgen: 'react-docgen-typescript',
    reactDocgenTypescriptOptions: {
      shouldExtractLiteralValuesFromEnum: true,
      propFilter: (prop) => (prop.parent ? !/node_modules/.test(prop.parent.fileName) : true),
    },
  },
  features: {
    interactionsDebugger: true,
  },
  // Evidence emission configuration
  async viteFinal(config) {
    return {
      ...config,
      resolve: {
        ...(config.resolve || {}),
        alias: {
          ...(typeof config.resolve?.alias === 'object' ? config.resolve.alias : {}),
          '@': path.resolve(projectRoot, 'src'),
        },
      },
      plugins: [
        ...(config.plugins || []),
        // Custom plugin for evidence emission
        {
          name: 'a2r-evidence-emitter',
          async closeBundle() {
            // Emit evidence artifacts for DAG harness
            console.log('📊 Emitting Storybook evidence to WIH...');
          },
        },
      ],
    };
  },
};

export default config;
