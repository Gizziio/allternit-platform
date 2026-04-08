/**
 * Website Plugin - Production Implementation
 * 
 * Website builder & deployment prep
 * Generates complete website code ready for deployment
 */

import { generateText } from 'ai';
import { getLanguageModel } from '@/lib/ai/providers';
import type { 
  ModePlugin, 
  PluginConfig, 
  PluginInput, 
  PluginOutput, 
  PluginCapability,
  PluginEvent,
  PluginEventHandler 
} from '../types';

export interface WebsiteConfig extends PluginConfig {
  defaultStack?: 'react' | 'nextjs' | 'vue' | 'html';
  includeTailwind?: boolean;
  includeAnimations?: boolean;
  deploymentTarget?: 'vercel' | 'netlify' | 'static';
}

export interface WebsiteProject {
  name: string;
  description: string;
  stack: string;
  files: Array<{
    path: string;
    content: string;
    type: 'tsx' | 'css' | 'json' | 'md' | 'html' | 'js';
  }>;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  scripts: Record<string, string>;
  previewInstructions: string;
}

class WebsitePlugin implements ModePlugin {
  readonly id = 'website';
  readonly name = 'Website';
  readonly version = '1.0.0';
  readonly capabilities: PluginCapability[] = [
    'website-generation',
    'landing-page',
    'responsive-design',
    'component-library',
    'deployment-prep',
    'seo-optimization',
  ];

  isInitialized = false;
  isExecuting = false;
  config: WebsiteConfig = {
    defaultStack: 'nextjs',
    includeTailwind: true,
    includeAnimations: true,
    deploymentTarget: 'vercel',
  };

  private eventHandlers: Map<string, Set<PluginEventHandler>> = new Map();
  private abortController: AbortController | null = null;

  on(event: string, handler: PluginEventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  off(event: string, handler: PluginEventHandler): void {
    this.eventHandlers.get(event)?.delete(handler);
  }

  private emit(event: PluginEvent): void {
    this.eventHandlers.get(event.type)?.forEach(handler => {
      try {
        handler(event);
      } catch (err) {
        console.error(`[WebsitePlugin] Event handler error:`, err);
      }
    });
  }

  async initialize(config?: WebsiteConfig): Promise<void> {
    if (config) {
      this.config = { ...this.config, ...config };
    }
    
    this.isInitialized = true;
    this.emit({ type: 'initialized', timestamp: Date.now() });
    console.log('[WebsitePlugin] Initialized');
  }

  async destroy(): Promise<void> {
    if (this.abortController) {
      this.abortController.abort();
    }
    this.isInitialized = false;
    this.eventHandlers.clear();
    this.emit({ type: 'destroyed', timestamp: Date.now() });
  }

  async execute(input: PluginInput): Promise<PluginOutput> {
    if (!this.isInitialized) {
      throw new Error('Plugin not initialized');
    }

    this.isExecuting = true;
    this.abortController = new AbortController();
    
    this.emit({ type: 'started', timestamp: Date.now() });

    try {
      const description = input.prompt;
      const stack = (input.options?.stack as string) || this.config.defaultStack || 'nextjs';
      const pages = (input.options?.pages as string[]) || ['home'];
      const style = (input.options?.style as string) || 'modern';

      // Generate website with AI
      this.emit({ 
        type: 'progress', 
        payload: { step: 'generating', message: `Creating ${stack} website...` },
        timestamp: Date.now() 
      });

      const project = await this.generateWebsite(description, stack, pages, style);

      // Create preview HTML for immediate viewing
      const previewHtml = this.createPreviewHTML(project);

      return {
        success: true,
        content: this.formatWebsiteOutput(project),
        artifacts: [
          // Main project files
          ...project.files.map(file => ({
            type: 'code' as const,
            url: `website://${file.path}`,
            name: file.path,
            metadata: { 
              fileType: file.type,
              content: file.content,
            },
          })),
          // Package.json
          {
            type: 'code' as const,
            url: 'website://package.json',
            name: 'package.json',
            metadata: {
              dependencies: project.dependencies,
              devDependencies: project.devDependencies,
              scripts: project.scripts,
            },
          },
          // Preview
          {
            type: 'code' as const,
            url: `website://preview/${Date.now()}`,
            name: 'preview.html',
            metadata: {
              format: 'preview',
              html: previewHtml,
            },
          },
        ],
      };

    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      
      const output: PluginOutput = {
        success: false,
        error: {
          message: error.message,
          code: 'WEBSITE_ERROR',
          recoverable: false,
        },
      };

      this.emit({ type: 'error', payload: error, timestamp: Date.now() });
      return output;

    } finally {
      this.isExecuting = false;
      this.abortController = null;
    }
  }

  async cancel(): Promise<void> {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  hasCapability(capability: PluginCapability): boolean {
    return this.capabilities.includes(capability);
  }

  async health(): Promise<{ healthy: boolean; message?: string }> {
    return { healthy: true };
  }

  private async generateWebsite(
    description: string,
    stack: string,
    pages: string[],
    style: string
  ): Promise<WebsiteProject> {
    const model = await getLanguageModel('anthropic/claude-3-5-sonnet');
    
    const stackInstructions: Record<string, string> = {
      nextjs: 'Generate a Next.js 14 App Router project with TypeScript and Tailwind CSS.',
      react: 'Generate a React 18 project with TypeScript and Tailwind CSS.',
      vue: 'Generate a Vue 3 project with TypeScript and Tailwind CSS.',
      html: 'Generate a vanilla HTML/CSS/JS website.',
    };

    const { text } = await generateText({
      model,
      prompt: `${stackInstructions[stack] || stackInstructions.nextjs}

Website Description: "${description}"

Pages to create: ${pages.join(', ')}
Design Style: ${style} (${style === 'modern' ? 'Clean, minimal, lots of whitespace, gradients' : style === 'corporate' ? 'Professional, structured, conservative' : 'Creative, bold, unique'})

Generate the main files needed:
1. Page component(s) with full implementation
2. Layout component
3. Key reusable components
4. CSS/styling
5. Configuration files

For each file, provide:
- File path
- Complete file content
- File type

Format as JSON:
{
  "name": "project-name",
  "description": "brief description",
  "stack": "${stack}",
  "files": [
    {
      "path": "app/page.tsx",
      "content": "...",
      "type": "tsx"
    }
  ],
  "dependencies": { "react": "^18.0.0", ... },
  "devDependencies": { "typescript": "^5.0.0", ... },
  "scripts": { "dev": "next dev", "build": "next build" },
  "previewInstructions": "Steps to run the project"
}`,
      temperature: 0.3,
    });

    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error('Failed to parse website JSON:', e);
    }

    // Fallback minimal project
    return this.createFallbackProject(stack, description);
  }

  private createFallbackProject(stack: string, description: string): WebsiteProject {
    const isNextJs = stack === 'nextjs';
    
    return {
      name: 'generated-website',
      description: description.substring(0, 100),
      stack,
      files: [
        {
          path: isNextJs ? 'app/page.tsx' : 'src/App.tsx',
          content: `export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-6xl mx-auto px-4 py-20">
        <h1 className="text-5xl font-bold text-gray-900 mb-6">
          ${description.split(' ').slice(0, 5).join(' ')}
        </h1>
        <p className="text-xl text-gray-600">
          ${description}
        </p>
      </div>
    </main>
  );
}`,
          type: 'tsx',
        },
        {
          path: 'package.json',
          content: JSON.stringify({
            name: 'generated-website',
            version: '1.0.0',
            dependencies: {
              react: '^18.2.0',
              'react-dom': '^18.2.0',
              next: isNextJs ? '^14.0.0' : undefined,
            },
            devDependencies: {
              typescript: '^5.0.0',
              tailwindcss: '^3.4.0',
            },
          }, null, 2),
          type: 'json',
        },
      ],
      dependencies: {
        react: '^18.2.0',
        'react-dom': '^18.2.0',
        ...(isNextJs ? { next: '^14.0.0' } : {}),
      },
      devDependencies: {
        typescript: '^5.0.0',
        tailwindcss: '^3.4.0',
      },
      scripts: isNextJs 
        ? { dev: 'next dev', build: 'next build', start: 'next start' }
        : { dev: 'vite', build: 'tsc && vite build', preview: 'vite preview' },
      previewInstructions: `1. Run: npm install\n2. Run: npm run dev\n3. Open: http://localhost:3000`,
    };
  }

  private createPreviewHTML(project: WebsiteProject): string {
    // Extract the main page content for preview
    const mainFile = project.files.find(f => f.path.includes('page.tsx') || f.path.includes('App.tsx'));
    
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${project.name} - Preview</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body>
  <div id="root">
    <!-- Preview placeholder - actual component needs React runtime -->
    <div class="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center p-8">
      <div class="max-w-2xl text-center">
        <h1 class="text-4xl font-bold text-gray-900 mb-4">${project.name}</h1>
        <p class="text-gray-600 mb-8">${project.description}</p>
        
        <div class="bg-white rounded-lg shadow-lg p-6 text-left">
          <h2 class="text-xl font-semibold mb-4">Generated Files</h2>
          <ul class="space-y-2">
            ${project.files.map(f => `
              <li class="flex items-center text-sm">
                <span class="text-blue-500 mr-2">📄</span>
                <code class="bg-gray-100 px-2 py-1 rounded">${f.path}</code>
                <span class="ml-2 text-gray-500">(${f.type})</span>
              </li>
            `).join('')}
          </ul>
          
          <div class="mt-6 pt-6 border-t">
            <h3 class="font-semibold mb-2">To Preview Locally:</h3>
            <pre class="bg-gray-900 text-green-400 p-4 rounded text-sm overflow-x-auto">${project.previewInstructions}</pre>
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
  }

  private formatWebsiteOutput(project: WebsiteProject): string {
    return [
      `# Website: ${project.name}`,
      '',
      project.description,
      '',
      `**Stack:** ${project.stack} | **Files:** ${project.files.length}`,
      '',
      '## Files Generated',
      ...project.files.map(f => `- \`${f.path}\` (${f.type})`),
      '',
      '## Dependencies',
      ...Object.entries(project.dependencies).map(([name, version]) => `- ${name}: ${version}`),
      '',
      '## Dev Dependencies',
      ...Object.entries(project.devDependencies).map(([name, version]) => `- ${name}: ${version}`),
      '',
      '## Scripts',
      ...Object.entries(project.scripts).map(([name, cmd]) => `- \`${name}\`: ${cmd}`),
      '',
      '## Getting Started',
      '```bash',
      project.previewInstructions,
      '```',
      '',
      '## Deployment',
      `This project is ready for deployment to ${this.config.deploymentTarget === 'vercel' ? '[Vercel](https://vercel.com)' : this.config.deploymentTarget === 'netlify' ? '[Netlify](https://netlify.com)' : 'any static host'}.`,
    ].join('\n');
  }
}

export function createWebsitePlugin(): ModePlugin {
  return new WebsitePlugin();
}

export default createWebsitePlugin();
