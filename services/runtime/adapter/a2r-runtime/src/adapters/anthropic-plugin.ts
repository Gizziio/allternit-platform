import { ProviderPlugin, ProviderResponse, ProviderChunk } from './provider-plugin.js';
import { ModelDefinition } from './router-adapter.js';

export class AnthropicPlugin implements ProviderPlugin {
  id = 'anthropic';
  name = 'Anthropic';
  private apiKey?: string;

  async initialize(config: Record<string, any>): Promise<void> {
    this.apiKey = config.apiKey;
  }

  async listModels(): Promise<ModelDefinition[]> {
    return [
      {
        id: 'claude-3-5-sonnet',
        capabilities: { vision: true, tool_use: true, context_window: 200000 },
        costs: { input_1k: 0.003, output_1k: 0.015 }
      },
      {
        id: 'claude-3-opus',
        capabilities: { vision: true, tool_use: true, context_window: 200000 },
        costs: { input_1k: 0.015, output_1k: 0.075 }
      }
    ];
  }

  async generate(modelId: string, prompt: string, options?: any): Promise<ProviderResponse> {
    if (!this.apiKey) throw new Error('Anthropic API key not initialized');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: options?.max_tokens || 1024,
        ...options
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error('Anthropic API error: ' + error);
    }

    const data = await response.json();
    return {
      content: data.content[0].text,
      usage: {
        input_tokens: data.usage.input_tokens,
        output_tokens: data.usage.output_tokens
      },
      metadata: { id: data.id }
    };
  }

  async *stream(modelId: string, prompt: string, options?: any): AsyncIterable<ProviderChunk> {
    // Basic streaming implementation placeholder
    const result = await this.generate(modelId, prompt, options);
    yield { delta: result.content, stop_reason: 'end_turn' };
  }
}
