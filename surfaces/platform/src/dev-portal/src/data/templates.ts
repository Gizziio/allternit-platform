import type { PluginTemplate } from '../types';

export const pluginTemplates: PluginTemplate[] = [
  {
    id: 'basic',
    name: 'Basic Plugin',
    description: 'The minimal setup for an A2R plugin. Perfect for learning the basics or building simple utilities.',
    version: '1.0.0',
    category: 'developer',
    tags: ['starter', 'minimal', 'javascript'],
    author: 'A2R Team',
    repositoryUrl: 'https://github.com/a2r-dev/template-basic',
    features: [
      'Minimal configuration',
      'Single entry point',
      'Console logging setup',
      'Plugin lifecycle hooks',
    ],
    files: [
      {
        path: 'plugin.json',
        content: JSON.stringify({
          id: 'my-basic-plugin',
          name: 'My Basic Plugin',
          version: '1.0.0',
          description: 'A simple A2R plugin',
          author: 'Your Name',
          license: 'MIT',
          entry: 'index.js',
          categories: ['utility'],
          permissions: ['ui:notification'],
        }, null, 2),
        isEntry: false,
      },
      {
        path: 'index.js',
        content: `import { a2r } from '@allternit/sdk';
import manifest from './plugin.json';

// Register the plugin
const plugin = await a2r.register(manifest);

// Log when plugin is ready
plugin.on('ready', () => {
  console.log('Plugin is ready!');
  a2r.ui.notify('Hello from my plugin!', 'success');
});

// Clean up when plugin is disabled
plugin.on('disable', () => {
  console.log('Plugin is being disabled');
});`,
        isEntry: true,
      },
    ],
    dependencies: {
      '@allternit/sdk': '^1.0.0',
    },
    usedCount: 1250,
    rating: 4.8,
    isOfficial: true,
  },
  {
    id: 'react',
    name: 'React + TypeScript',
    description: 'Full-featured template with React, TypeScript, and hot reload support. The recommended starting point for complex plugins.',
    version: '2.1.0',
    category: 'developer',
    tags: ['react', 'typescript', 'hot-reload', 'full-featured'],
    author: 'A2R Team',
    repositoryUrl: 'https://github.com/a2r-dev/template-react',
    demoUrl: 'https://demo.a2r.dev/templates/react',
    features: [
      'React 18 with hooks',
      'TypeScript configuration',
      'Hot module replacement',
      'ESLint + Prettier setup',
      'Component examples',
      'Custom UI panel',
    ],
    files: [
      {
        path: 'plugin.json',
        content: JSON.stringify({
          id: 'my-react-plugin',
          name: 'My React Plugin',
          version: '1.0.0',
          description: 'A React-based A2R plugin',
          author: 'Your Name',
          license: 'MIT',
          entry: 'dist/index.js',
          categories: ['productivity'],
          permissions: ['ui:panel', 'storage:read', 'storage:write'],
          settings: [
            {
              key: 'theme',
              type: 'select',
              label: 'Theme',
              default: 'system',
              options: [
                { label: 'System', value: 'system' },
                { label: 'Light', value: 'light' },
                { label: 'Dark', value: 'dark' },
              ],
            },
          ],
        }, null, 2),
        isEntry: false,
      },
      {
        path: 'src/index.tsx',
        content: `import React from 'react';
import { createRoot } from 'react-dom/client';
import { a2r } from '@allternit/sdk';
import manifest from '../plugin.json';
import { App } from './App';

async function main() {
  const plugin = await a2r.register(manifest);
  
  plugin.on('ready', () => {
    // Show the plugin panel
    a2r.ui.showPanel({
      id: 'main-panel',
      title: manifest.name,
      component: App,
    });
  });
}

main();`,
        isEntry: true,
      },
      {
        path: 'src/App.tsx',
        content: `import React from 'react';
import { usePluginSettings } from './hooks/usePluginSettings';

export const App: React.FC = () => {
  const { settings, updateSetting } = usePluginSettings();
  
  return (
    <div className="p-4">
      <h1 className="text-xl font-bold">Welcome to {manifest.name}</h1>
      <p className="text-gray-600">
        This is your React plugin running inside A2R.
      </p>
    </div>
  );
};`,
        isEntry: false,
      },
    ],
    dependencies: {
      '@allternit/sdk': '^1.0.0',
      'react': '^18.2.0',
      'react-dom': '^18.2.0',
    },
    usedCount: 3420,
    rating: 4.9,
    isOfficial: true,
  },
  {
    id: 'ai-tool',
    name: 'AI Tool',
    description: 'Build AI-powered tools with context awareness and model access. Includes examples of prompt engineering and response handling.',
    version: '1.2.0',
    category: 'ai',
    tags: ['ai', 'llm', 'context', 'prompts'],
    author: 'A2R Team',
    repositoryUrl: 'https://github.com/a2r-dev/template-ai-tool',
    demoUrl: 'https://demo.a2r.dev/templates/ai-tool',
    features: [
      'AI context access',
      'Prompt templates',
      'Streaming responses',
      'Model selection',
      'Token tracking',
    ],
    files: [
      {
        path: 'src/ai/complete.ts',
        content: `import { a2r } from '@allternit/sdk';

export async function generateWithContext(
  prompt: string,
  options: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  } = {}
) {
  // Get current context from the workspace
  const context = await a2r.ai.getContext();
  
  // Build the full prompt with context
  const fullPrompt = \`\${context}\n\nUser request: \${prompt}\`;
  
  // Call the AI completion API
  const response = await a2r.ai.complete(fullPrompt, {
    model: options.model || 'gpt-4',
    temperature: options.temperature ?? 0.7,
    maxTokens: options.maxTokens ?? 2000,
    stream: true,
    onToken: (token) => {
      // Handle streaming tokens
      process.stdout.write(token);
    },
  });
  
  return response;
}`,
        isEntry: false,
      },
    ],
    dependencies: {
      '@allternit/sdk': '^1.0.0',
    },
    usedCount: 980,
    rating: 4.7,
    isOfficial: true,
  },
  {
    id: 'sidebar',
    name: 'Sidebar Panel',
    description: 'Create a persistent sidebar panel with state management and custom styling.',
    version: '1.1.0',
    category: 'developer',
    tags: ['ui', 'sidebar', 'panel', 'persistent'],
    author: 'A2R Team',
    repositoryUrl: 'https://github.com/a2r-dev/template-sidebar',
    features: [
      'Persistent sidebar panel',
      'State management',
      'Custom styling',
      'Resize handling',
      'Collapsible sections',
    ],
    files: [],
    dependencies: {
      '@allternit/sdk': '^1.0.0',
    },
    usedCount: 756,
    rating: 4.6,
    isOfficial: true,
  },
  {
    id: 'command',
    name: 'Slash Commands',
    description: 'Add custom slash commands to the A2R command palette with argument parsing and autocompletion.',
    version: '1.0.0',
    category: 'productivity',
    tags: ['commands', 'slash', 'palette', 'shortcuts'],
    author: 'A2R Team',
    repositoryUrl: 'https://github.com/a2r-dev/template-command',
    features: [
      'Slash command registration',
      'Argument parsing',
      'Autocompletion',
      'Command history',
      'Keyboard shortcuts',
    ],
    files: [],
    dependencies: {
      '@allternit/sdk': '^1.0.0',
    },
    usedCount: 623,
    rating: 4.5,
    isOfficial: true,
  },
  {
    id: 'integration',
    name: 'External Integration',
    description: 'Connect with external APIs and services with proper authentication and error handling.',
    version: '1.0.0',
    category: 'integration',
    tags: ['api', 'integration', 'auth', 'fetch'],
    author: 'A2R Team',
    repositoryUrl: 'https://github.com/a2r-dev/template-integration',
    features: [
      'API client setup',
      'Authentication handling',
      'Rate limiting',
      'Error handling',
      'Caching layer',
    ],
    files: [],
    dependencies: {
      '@allternit/sdk': '^1.0.0',
    },
    usedCount: 445,
    rating: 4.4,
    isOfficial: true,
  },
];

export function getTemplateById(id: string): PluginTemplate | undefined {
  return pluginTemplates.find((t) => t.id === id);
}

export function getTemplatesByCategory(category: string): PluginTemplate[] {
  return pluginTemplates.filter((t) => t.category === category);
}

export function getOfficialTemplates(): PluginTemplate[] {
  return pluginTemplates.filter((t) => t.isOfficial);
}
