/**
 * Allternit GLM Provider (Zhipu AI / ChatGLM)
 * 
 * Zhipu AI's ChatGLM API client for Allternit SDK
 * API: https://open.bigmodel.cn/api/paas/v4
 * Docs: https://open.bigmodel.cn/dev/howuse/model
 */

import { HarnessError } from '../../harness/errors.js';
import type { HarnessErrorCode } from '../../harness/errors.js';

export interface AllternitGLMOptions {
  apiKey: string;
  baseURL?: string;
}

export interface GLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
  tool_call_id?: string;
}

export interface GLMTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
}

export interface GLMChatOptions {
  model: string;
  messages: GLMMessage[];
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stream?: boolean;
  tools?: GLMTool[];
  toolChoice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
  doSample?: boolean;
}

export interface GLMChatResponse {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: GLMMessage;
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface GLMStreamChunk {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: Partial<GLMMessage>;
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export const GLM_MODELS = {
  GLM_4: 'glm-4',
  GLM_4V: 'glm-4v',
  GLM_3_TURBO: 'glm-3-turbo',
  GLM_4_0520: 'glm-4-0520',
  GLM_4_AIR: 'glm-4-air',
  GLM_4_AIRX: 'glm-4-airx',
  GLM_4_FLASH: 'glm-4-flash',
} as const;

export class AllternitGLM {
  private apiKey: string;
  private baseURL: string;

  constructor(options: AllternitGLMOptions) {
    this.apiKey = options.apiKey;
    this.baseURL = options.baseURL || 'https://open.bigmodel.cn/api/paas/v4';
  }

  async chat(options: GLMChatOptions): Promise<GLMChatResponse> {
    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: options.model,
        messages: options.messages,
        temperature: options.temperature,
        max_tokens: options.maxTokens,
        top_p: options.topP,
        stream: false,
        tools: options.tools,
        tool_choice: options.toolChoice,
        do_sample: options.doSample,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
      throw new HarnessError(
        error.error?.message || `GLM API error: ${response.status}`,
        HarnessErrorCode.PROVIDER_ERROR,
        { statusCode: response.status }
      );
    }

    const data = await response.json() as GLMChatResponse;
    return data;
  }

  async *chatStream(options: GLMChatOptions): AsyncGenerator<GLMStreamChunk> {
    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        'Accept': 'text/event-stream',
      },
      body: JSON.stringify({
        model: options.model,
        messages: options.messages,
        temperature: options.temperature,
        max_tokens: options.maxTokens,
        top_p: options.topP,
        stream: true,
        tools: options.tools,
        tool_choice: options.toolChoice,
        do_sample: options.doSample,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
      throw new HarnessError(
        error.error?.message || `GLM API error: ${response.status}`,
        HarnessErrorCode.PROVIDER_ERROR,
        { statusCode: response.status }
      );
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim() === '' || line.trim() === 'data: [DONE]') continue;
          
          if (line.startsWith('data: ')) {
            try {
              const chunk = JSON.parse(line.slice(6)) as GLMStreamChunk;
              yield chunk;
            } catch {
              // Skip malformed JSON
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async listModels(): Promise<Array<{ id: string; name: string }>> {
    return [
      { id: GLM_MODELS.GLM_4, name: 'GLM-4' },
      { id: GLM_MODELS.GLM_4V, name: 'GLM-4V (Vision)' },
      { id: GLM_MODELS.GLM_3_TURBO, name: 'GLM-3 Turbo' },
      { id: GLM_MODELS.GLM_4_0520, name: 'GLM-4 0520' },
      { id: GLM_MODELS.GLM_4_AIR, name: 'GLM-4 Air' },
      { id: GLM_MODELS.GLM_4_AIRX, name: 'GLM-4 AirX' },
      { id: GLM_MODELS.GLM_4_FLASH, name: 'GLM-4 Flash' },
    ];
  }
}

export { AllternitGLM as AllternitChatGLM };
export default AllternitGLM;
