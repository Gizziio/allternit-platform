import type { APINamespace } from '../types';

export const apiNamespaces: APINamespace[] = [
  {
    name: 'Core',
    description: 'Core plugin registration and lifecycle management',
    methods: [
      {
        name: 'allternit.register',
        description: 'Register a plugin with the Allternit platform. This must be called before using any other API methods.',
        signature: 'allternit.register(manifest: PluginManifest): Promise<PluginContext>',
        params: [
          {
            name: 'manifest',
            type: 'PluginManifest',
            description: 'The plugin manifest object containing metadata and configuration',
            required: true,
          },
        ],
        returns: {
          type: 'Promise<PluginContext>',
          description: 'A context object with methods for interacting with the platform',
        },
        examples: [
          {
            title: 'Basic Registration',
            language: 'typescript',
            code: `import { allternit } from '@allternit/sdk';
import manifest from './plugin.json';

const context = await allternit.register(manifest);

console.log('Plugin registered:', context.id);`,
          },
          {
            title: 'With Error Handling',
            language: 'typescript',
            code: `try {
  const context = await allternit.register(manifest);
  
  // Plugin is now ready
  context.on('ready', () => {
    console.log('Plugin ready');
  });
} catch (error) {
  console.error('Registration failed:', error.message);
}`,
          },
        ],
        since: '1.0.0',
      },
      {
        name: 'allternit.on',
        description: 'Subscribe to platform events and plugin lifecycle hooks.',
        signature: 'allternit.on(event: string, handler: Function): () => void',
        params: [
          {
            name: 'event',
            type: 'string',
            description: 'The event name to subscribe to',
            required: true,
          },
          {
            name: 'handler',
            type: 'Function',
            description: 'The callback function to invoke when the event occurs',
            required: true,
          },
        ],
        returns: {
          type: '() => void',
          description: 'An unsubscribe function',
        },
        examples: [
          {
            title: 'Lifecycle Events',
            language: 'typescript',
            code: `// Plugin is initialized
allternit.on('ready', () => {
  console.log('Plugin ready');
});

// Plugin is being disabled
allternit.on('disable', () => {
  console.log('Plugin disabled');
});

// Plugin settings changed
allternit.on('settings:changed', (changes) => {
  console.log('Settings updated:', changes);
});`,
          },
        ],
        since: '1.0.0',
      },
      {
        name: 'allternit.off',
        description: 'Unsubscribe from platform events.',
        signature: 'allternit.off(event: string, handler: Function): void',
        params: [
          {
            name: 'event',
            type: 'string',
            description: 'The event name',
            required: true,
          },
          {
            name: 'handler',
            type: 'Function',
            description: 'The handler function to remove',
            required: true,
          },
        ],
        returns: {
          type: 'void',
          description: 'Nothing',
        },
        examples: [],
        since: '1.0.0',
      },
    ],
    types: [
      {
        name: 'PluginContext',
        definition: `interface PluginContext {
  id: string;
  version: string;
  on: (event: string, handler: Function) => () => void;
  emit: (event: string, data?: unknown) => void;
}`,
        description: 'Context returned after successful plugin registration',
      },
    ],
  },
  {
    name: 'UI',
    description: 'User interface components and interactions',
    methods: [
      {
        name: 'allternit.ui.showPanel',
        description: 'Display a panel in the Allternit sidebar.',
        signature: 'allternit.ui.showPanel(options: PanelOptions): Promise<Panel>',
        params: [
          {
            name: 'options',
            type: 'PanelOptions',
            description: 'Configuration for the panel',
            required: true,
          },
        ],
        returns: {
          type: 'Promise<Panel>',
          description: 'Panel instance for controlling the panel',
        },
        examples: [
          {
            title: 'Show a Panel',
            language: 'typescript',
            code: `const panel = await allternit.ui.showPanel({
  id: 'my-plugin-panel',
  title: 'My Plugin',
  icon: 'sparkles',
  component: MyPanelComponent,
});`,
          },
        ],
        since: '1.0.0',
      },
      {
        name: 'allternit.ui.notify',
        description: 'Show a notification toast to the user.',
        signature: 'allternit.ui.notify(message: string, type?: NotificationType): void',
        params: [
          {
            name: 'message',
            type: 'string',
            description: 'The notification message',
            required: true,
          },
          {
            name: 'type',
            type: "'info' | 'success' | 'warning' | 'error'",
            description: 'The notification type',
            required: false,
            default: 'info',
          },
        ],
        returns: {
          type: 'void',
          description: 'Nothing',
        },
        examples: [
          {
            title: 'Different Notification Types',
            language: 'typescript',
            code: `allternit.ui.notify('Operation completed', 'success');
allternit.ui.notify('Something went wrong', 'error');
allternit.ui.notify('Please review your settings', 'warning');`,
          },
        ],
        since: '1.0.0',
      },
    ],
    types: [
      {
        name: 'PanelOptions',
        definition: `interface PanelOptions {
  id: string;
  title: string;
  icon?: string;
  component: React.ComponentType;
  width?: number;
}`,
        description: 'Options for creating a sidebar panel',
      },
    ],
  },
  {
    name: 'Storage',
    description: 'Data persistence and settings management',
    methods: [
      {
        name: 'allternit.storage.get',
        description: 'Retrieve a value from plugin storage.',
        signature: 'allternit.storage.get<T>(key: string): Promise<T | undefined>',
        params: [
          {
            name: 'key',
            type: 'string',
            description: 'The storage key',
            required: true,
          },
        ],
        returns: {
          type: 'Promise<T | undefined>',
          description: 'The stored value or undefined',
        },
        examples: [
          {
            title: 'Get Stored Value',
            language: 'typescript',
            code: `const settings = await allternit.storage.get('user-settings');
if (settings) {
  console.log('Loaded settings:', settings);
}`,
          },
        ],
        since: '1.0.0',
      },
      {
        name: 'allternit.storage.set',
        description: 'Store a value in plugin storage.',
        signature: 'allternit.storage.set<T>(key: string, value: T): Promise<void>',
        params: [
          {
            name: 'key',
            type: 'string',
            description: 'The storage key',
            required: true,
          },
          {
            name: 'value',
            type: 'T',
            description: 'The value to store',
            required: true,
          },
        ],
        returns: {
          type: 'Promise<void>',
          description: 'Nothing',
        },
        examples: [
          {
            title: 'Save Settings',
            language: 'typescript',
            code: `await allternit.storage.set('user-settings', {
  theme: 'dark',
  notifications: true,
});`,
          },
        ],
        since: '1.0.0',
      },
    ],
    types: [],
  },
];
