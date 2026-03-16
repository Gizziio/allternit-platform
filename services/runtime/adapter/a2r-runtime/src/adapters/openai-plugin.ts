import { ProviderPlugin, ProviderResponse, ProviderChunk } from './provider-plugin.js';
import { ModelDefinition } from './router-adapter.js';

export class OpenAIPlugin implements ProviderPlugin {
  id = 'openai';
  name = 'OpenAI';
  private apiKey?: string;

  async initialize(config: Record<string, any>): Promise<void> {
    this.apiKey = config.apiKey;
  }

  async listModels(): Promise<ModelDefinition[]> {
    return [
      {
        id: 'gpt-4o',
        capabilities: { vision: true, tool_use: true, context_window: 128000 },
        costs: { input_1k: 0.005, output_1k: 0.015 }
      },
      {
        id: 'gpt-4-turbo',
        capabilities: { vision: true, tool_use: true, context_window: 128000 },
        costs: { input_1k: 0.01, output_1k: 0.03 }
      }
    ];
  }

  async generate(modelId: string, prompt: string, options?: any): Promise<ProviderResponse> {
    if (!this.apiKey) throw new Error('OpenAI API key not initialized');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + this.apiKey
      },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: 'user', content: prompt }],
        ...options
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error('OpenAI API error: ' + error);
    }

    const data = await response.json();
    return {
      content: data.choices[0].message.content,
      usage: {
        input_tokens: data.usage.prompt_tokens,
        output_tokens: data.usage.completion_tokens
      },
      metadata: { id: data.id }
    };
  }

  async *stream(modelId: string, prompt: string, options?: any): AsyncIterable<ProviderChunk> {
    const result = await this.generate(modelId, prompt, options);
    yield { delta: result.content, stop_reason: 'stop' };
  }
}
