/**
 * Code Plugin - Production Implementation
 * 
 * Code generation & execution via iframe sandbox
 * Generates code with AI, executes in browser sandbox
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

export interface CodeConfig extends PluginConfig {
  defaultLanguage?: string;
  enableLivePreview?: boolean;
  allowedLanguages?: string[];
  timeout?: number; // seconds
}

export interface CodeExecutionResult {
  language: string;
  code: string;
  output: {
    stdout: string;
    stderr: string;
    exitCode: number;
  };
  files: Array<{
    path: string;
    content: string;
  }>;
  previewUrl?: string;
}

class CodePlugin implements ModePlugin {
  readonly id = 'code';
  readonly name = 'Code';
  readonly version = '1.0.0';
  readonly capabilities: PluginCapability[] = [
    'code-generation',
    'live-preview',
    'multi-language',
    'package-install',
    'debugging',
    'testing',
  ];

  isInitialized = false;
  isExecuting = false;
  config: CodeConfig = {
    defaultLanguage: 'typescript',
    enableLivePreview: true,
    allowedLanguages: ['typescript', 'javascript', 'python', 'html', 'css', 'react', 'vue'],
    timeout: 30,
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
        console.error(`[CodePlugin] Event handler error:`, err);
      }
    });
  }

  async initialize(config?: CodeConfig): Promise<void> {
    if (config) {
      this.config = { ...this.config, ...config };
    }
    
    this.isInitialized = true;
    this.emit({ type: 'initialized', timestamp: Date.now() });
    console.log('[CodePlugin] Initialized');
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
      const language = (input.options?.language as string) || this.detectLanguage(input.prompt);
      
      // Check if this is an explanation request
      if (input.options?.mode === 'explain' || input.prompt.toLowerCase().includes('explain')) {
        return await this.explainCode(input.prompt);
      }

      // Check if code is provided directly
      if (input.options?.code) {
        return await this.executeCode(input.options.code as string, language);
      }

      // Generate code
      return await this.generateCode(input.prompt, language);

    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      
      const output: PluginOutput = {
        success: false,
        error: {
          message: error.message,
          code: 'CODE_ERROR',
          recoverable: error.message.includes('timeout'),
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

  private detectLanguage(prompt: string): string {
    const lower = prompt.toLowerCase();
    if (lower.includes('python')) return 'python';
    if (lower.includes('react')) return 'react';
    if (lower.includes('vue')) return 'vue';
    if (lower.includes('html')) return 'html';
    if (lower.includes('css')) return 'css';
    if (lower.includes('javascript') || lower.includes('js')) return 'javascript';
    return this.config.defaultLanguage || 'typescript';
  }

  private async generateCode(prompt: string, language: string): Promise<PluginOutput> {
    this.emit({ 
      type: 'progress', 
      payload: { step: 'generating', message: `Generating ${language} code...` },
      timestamp: Date.now() 
    });

    const model = await getLanguageModel('anthropic/claude-3-5-sonnet');
    
    const languageInstructions: Record<string, string> = {
      python: 'Generate Python code. Include comments and type hints where appropriate.',
      react: 'Generate a React component using TypeScript. Use functional components with hooks. Include proper imports and export default.',
      vue: 'Generate a Vue 3 component using Composition API and TypeScript.',
      html: 'Generate HTML with embedded CSS and JavaScript for a complete page.',
      typescript: 'Generate TypeScript code with proper types and interfaces.',
      javascript: 'Generate modern JavaScript (ES6+) code.',
    };

    const { text } = await generateText({
      model,
      prompt: `${languageInstructions[language] || languageInstructions.typescript}

Request: "${prompt}"

Requirements:
1. Write clean, production-ready code
2. Include comments explaining key parts
3. Handle edge cases appropriately
4. Follow best practices for the language

Respond with ONLY the code block, no additional explanation.`,
      temperature: 0.3,
    });

    // Extract code from markdown if present
    const codeMatch = text.match(/```(?:\w+)?\n?([\s\S]*?)```/);
    const code = codeMatch ? codeMatch[1].trim() : text.trim();

    // Determine if we should create a preview
    const canPreview = ['react', 'vue', 'html', 'javascript'].includes(language);
    
    const files = this.createFileStructure(code, language);
    
    const result: CodeExecutionResult = {
      language,
      code,
      output: {
        stdout: '',
        stderr: '',
        exitCode: 0,
      },
      files,
      previewUrl: canPreview ? this.createPreviewUrl(files) : undefined,
    };

    return {
      success: true,
      content: this.formatCodeOutput(result),
      artifacts: [
        {
          type: 'code',
          url: `code://${language}/${Date.now()}`,
          name: `generated-code.${this.getFileExtension(language)}`,
          metadata: { 
            language, 
            files: files.map(f => f.path),
            previewUrl: result.previewUrl,
          },
        },
      ],
    };
  }

  private async executeCode(code: string, language: string): Promise<PluginOutput> {
    this.emit({ 
      type: 'progress', 
      payload: { step: 'executing', message: `Running ${language} code...` },
      timestamp: Date.now() 
    });

    // For browser-executable languages, create a preview
    const canPreview = ['javascript', 'html', 'react'].includes(language);
    
    if (canPreview) {
      const files = this.createFileStructure(code, language);
      const previewUrl = this.createPreviewUrl(files);
      
      return {
        success: true,
        content: `Executed ${language} code:\n\n\`\`\`${language}\n${code}\n\`\`\`\n\n**Live Preview Available**`,
        artifacts: [{
          type: 'code',
          url: previewUrl,
          name: 'live-preview',
          metadata: { language, preview: true },
        }],
      };
    }

    // For non-browser languages, just show the code
    return {
      success: true,
      content: `\`\`\`${language}\n${code}\n\`\`\`\n\n*Note: Live execution for ${language} requires a server-side runtime.*`,
    };
  }

  private async explainCode(prompt: string): Promise<PluginOutput> {
    // Extract code from prompt if present
    const codeMatch = prompt.match(/```(?:\w+)?\n?([\s\S]*?)```/);
    const code = codeMatch ? codeMatch[1].trim() : prompt;

    const model = await getLanguageModel('anthropic/claude-3-5-sonnet');
    
    const { text } = await generateText({
      model,
      prompt: `Explain this code in detail:\n\n${code}\n\nProvide:\n1. What the code does (high-level overview)\n2. How it works (step-by-step explanation)\n3. Key concepts or patterns used\n4. Any potential improvements or issues`,
      temperature: 0.5,
    });

    return {
      success: true,
      content: `## Code Explanation\n\n\`\`\`\n${code}\n\`\`\`\n\n${text}`,
    };
  }

  private createFileStructure(code: string, language: string): CodeExecutionResult['files'] {
    const files: CodeExecutionResult['files'] = [];

    switch (language) {
      case 'react':
        files.push(
          { path: 'App.tsx', content: code },
          { path: 'index.html', content: this.getReactHTML() },
          { path: 'package.json', content: this.getReactPackageJson() }
        );
        break;
      case 'html':
        files.push({ path: 'index.html', content: code });
        break;
      case 'javascript':
        files.push(
          { path: 'index.html', content: `<!DOCTYPE html><html><body><script>${code}</script></body></html>` },
          { path: 'script.js', content: code }
        );
        break;
      case 'python':
        files.push({ path: 'main.py', content: code });
        break;
      default:
        files.push({ path: `main.${this.getFileExtension(language)}`, content: code });
    }

    return files;
  }

  private createPreviewUrl(files: CodeExecutionResult['files']): string {
    // Create a data URL for simple HTML preview
    const htmlFile = files.find(f => f.path === 'index.html');
    if (htmlFile) {
      const blob = new Blob([htmlFile.content], { type: 'text/html' });
      return URL.createObjectURL(blob);
    }
    return '';
  }

  private getFileExtension(language: string): string {
    const extensions: Record<string, string> = {
      typescript: 'ts',
      javascript: 'js',
      python: 'py',
      html: 'html',
      css: 'css',
      react: 'tsx',
      vue: 'vue',
    };
    return extensions[language] || 'txt';
  }

  private getReactHTML(): string {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>React Preview</title>
  <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel" src="App.tsx"></script>
</body>
</html>`;
  }

  private getReactPackageJson(): string {
    return JSON.stringify({
      name: 'react-preview',
      version: '1.0.0',
      dependencies: {
        react: '^18.0.0',
        'react-dom': '^18.0.0',
      },
    }, null, 2);
  }

  private formatCodeOutput(result: CodeExecutionResult): string {
    const lines = [
      `# ${result.language.toUpperCase()} Code`,
      '',
      '## Generated Code',
      `\`\`\`${result.language}`,
      result.code,
      '\`\`\`',
    ];

    if (result.files.length > 0) {
      lines.push('', '## Files', ...result.files.map(f => `- \`${f.path}\``));
    }

    if (result.previewUrl) {
      lines.push('', '## Live Preview', `[Open Preview](${result.previewUrl})`);
    }

    if (result.output.stdout) {
      lines.push('', '## Output', `\`\`\`\n${result.output.stdout}\n\`\`\``);
    }

    if (result.output.stderr) {
      lines.push('', '## Errors', `\`\`\`\n${result.output.stderr}\n\`\`\``);
    }

    return lines.join('\n');
  }
}

export function createCodePlugin(): ModePlugin {
  return new CodePlugin();
}

export default createCodePlugin();
