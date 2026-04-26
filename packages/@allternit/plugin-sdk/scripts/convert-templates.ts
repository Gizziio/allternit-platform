#!/usr/bin/env tsx
/**
 * Convert Allternit Templates to Full Plugins
 * 
 * Transforms the 76 TemplatePreviewCards into complete plugin packages.
 */

import * as fs from 'fs/promises';
import * as path from 'path';

// Template definitions (from TemplatePreviewCards.tsx)
const MODE_TEMPLATES: Record<string, Array<{
  id: string;
  name: string;
  description: string;
  prompt: string;
  previewImage: string;
}>> = {
  // This would import from your actual TemplatePreviewCards
  // For now, showing the structure
  'market-research': [{
    id: 'market-research',
    name: 'Market Research',
    description: 'Deep industry analysis',
    prompt: 'Research the {{industry}} market...',
    previewImage: '/images/templates/analyze/research-market.jpg',
  }],
};

interface ConversionOptions {
  outputDir: string;
  templateFile: string;
}

/**
 * Convert a single template to a full plugin
 */
function convertTemplate(mode: string, template: any): any {
  return {
    manifest: {
      id: template.id,
      name: template.name,
      version: '1.0.0',
      runtime: 'allternit-plugin-v1',
      description: template.description,
      category: mapModeToCategory(mode),
      requires: {
        llm: {
          capabilities: ['reasoning', 'tool_use'],
          context_window: '128k',
        },
        tools: getRequiredTools(mode),
        ui: {
          renderers: ['markdown', 'chart'],
          inputs: ['text'],
        },
      },
      provides: {
        functions: [{
          name: 'execute',
          description: template.description,
          parameters: extractParameters(template.prompt),
          returns: {
            type: 'object',
            properties: {
              content: { type: 'string', format: 'markdown' },
              artifacts: { type: 'array', items: { type: 'object' } },
            },
          },
        }],
      },
      adapters: {
        mcp: './adapters/mcp.js',
        http: './adapters/http.js',
        allternit: './adapters/native.js',
      },
    },
    src: generatePluginCode(template),
    assets: {
      preview: template.previewImage,
    },
  };
}

function mapModeToCategory(mode: string): string {
  const mapping: Record<string, string> = {
    image: 'create',
    video: 'create',
    slides: 'create',
    website: 'create',
    research: 'analyze',
    data: 'analyze',
    code: 'build',
    swarms: 'automate',
    flow: 'automate',
  };
  return mapping[mode] || 'custom';
}

function getRequiredTools(mode: string): string[] {
  const tools: Record<string, string[]> = {
    research: ['web_search', 'data_analysis'],
    data: ['data_query', 'code_execute'],
    code: ['code_execute', 'file_read', 'file_write'],
    image: ['image_generate'],
    video: ['video_generate'],
    website: ['code_execute', 'browser_navigate'],
    swarms: ['code_execute', 'api_call'],
    flow: ['api_call', 'webhook'],
  };
  return tools[mode] || ['web_search'];
}

function extractParameters(prompt: string): any {
  // Extract {{variable}} placeholders from prompt
  const matches = prompt.match(/\{\{(\w+)\}\}/g) || [];
  const properties: Record<string, any> = {};
  
  matches.forEach(match => {
    const name = match.slice(2, -2);
    properties[name] = {
      type: 'string',
      description: `The ${name.replace(/_/g, ' ')}`,
    };
  });
  
  return {
    type: 'object',
    properties,
    required: Object.keys(properties),
  };
}

function generatePluginCode(template: any): string {
  return `
import { BasePlugin, ExecutionContext, ExecutionResult } from '@allternit/plugin-sdk';

export default class ${toPascalCase(template.id)}Plugin extends BasePlugin {
  manifest = {
    id: '${template.id}',
    name: '${template.name}',
    version: '1.0.0',
    runtime: 'allternit-plugin-v1',
    description: '${template.description}',
    category: '${mapModeToCategory(template.id)}',
    requires: {
      llm: { capabilities: ['reasoning', 'tool_use'] },
      tools: ${JSON.stringify(getRequiredTools(template.id))},
    },
    provides: {
      functions: [{
        name: 'execute',
        description: '${template.description}',
        parameters: ${JSON.stringify(extractParameters(template.prompt))},
        returns: { type: 'object', properties: {} },
      }],
    },
    adapters: {
      mcp: './adapters/mcp.js',
      http: './adapters/http.js',
      allternit: './adapters/native.js',
    },
  };

  async execute(
    functionName: string,
    params: Record<string, any>,
    context: ExecutionContext
  ): Promise<ExecutionResult> {
    if (functionName !== 'execute') {
      return { success: false, error: { code: 'UNKNOWN_FUNCTION', message: 'Unknown function', retryable: false } };
    }

    try {
      // Use host LLM with template prompt
      const prompt = this.fillTemplate(params);
      
      this.host.ui.progress(10, 'Starting...');
      
      const result = await this.host.llm.complete(prompt, {
        temperature: 0.7,
      });
      
      this.host.ui.progress(100, 'Complete');
      
      return {
        success: true,
        content: result,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'EXECUTION_ERROR',
          message: error instanceof Error ? error.message : String(error),
          retryable: true,
        },
      };
    }
  }

  private fillTemplate(params: Record<string, any>): string {
    let prompt = \`${template.prompt.replace(/`/g, '\\`')}\`;
    
    Object.entries(params).forEach(([key, value]) => {
      prompt = prompt.replace(new RegExp('{{' + key + '}}', 'g'), String(value));
    });
    
    return prompt;
  }
}

function toPascalCase(str: string): string {
  return str.split(/[-_]/).map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('');
}
`;
}

/**
 * Main conversion function
 */
export async function convertTemplates(options: ConversionOptions): Promise<void> {
  console.error('Converting templates to plugins...');
  console.error(`Output directory: ${options.outputDir}`);
  
  // Ensure output directory exists
  await fs.mkdir(options.outputDir, { recursive: true });
  
  // In real implementation, this would import from TemplatePreviewCards.tsx
  // and iterate through all 76 templates
  
  const templates = [
    { mode: 'research', template: MODE_TEMPLATES['market-research'][0] },
    // ... all 76 templates
  ];
  
  for (const { mode, template } of templates) {
    const plugin = convertTemplate(mode, template);
    const pluginDir = path.join(options.outputDir, template.id);
    
    // Create directory structure
    await fs.mkdir(pluginDir, { recursive: true });
    await fs.mkdir(path.join(pluginDir, 'src'), { recursive: true });
    await fs.mkdir(path.join(pluginDir, 'adapters'), { recursive: true });
    
    // Write manifest
    await fs.writeFile(
      path.join(pluginDir, 'manifest.json'),
      JSON.stringify(plugin.manifest, null, 2)
    );
    
    // Write source
    await fs.writeFile(
      path.join(pluginDir, 'src', 'index.ts'),
      plugin.src
    );
    
    console.error(`Created plugin: ${template.id}`);
  }
  
  console.error('Conversion complete!');
}

// CLI entry point
if (require.main === module) {
  const options: ConversionOptions = {
    outputDir: process.argv[2] || './plugins',
    templateFile: process.argv[3] || '../src/components/chat/TemplatePreviewCards.tsx',
  };
  
  convertTemplates(options).catch(console.error);
}
