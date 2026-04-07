/**
 * Allternit GitHub Copilot Provider
 * 
 * GitHub Copilot API client for Allternit SDK
 * Uses GitHub's Copilot API or Copilot Chat API
 * Docs: https://docs.github.com/en/copilot
 * 
 * Note: GitHub Copilot API access requires special authorization
 * This implementation supports both the Copilot API and Copilot Chat integration
 */

import { HarnessError } from '../../harness/errors.js';
import type { HarnessErrorCode } from '../../harness/errors.js';

export interface AllternitCopilotOptions {
  token: string;
  baseURL?: string;
  githubApiURL?: string;
}

export interface CopilotMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CopilotChatOptions {
  messages: CopilotMessage[];
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stream?: boolean;
  model?: string;
}

export interface CopilotChatResponse {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: CopilotMessage;
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface CopilotStreamChunk {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: Partial<CopilotMessage>;
    finish_reason: string | null;
  }>;
}

export const COPILOT_MODELS = {
  GPT_4: 'gpt-4',
  GPT_4_TURBO: 'gpt-4-turbo',
  COPILOT_CHAT: 'copilot-chat',
} as const;

export class AllternitCopilot {
  private token: string;
  private baseURL: string;
  private githubApiURL: string;

  constructor(options: AllternitCopilotOptions) {
    this.token = options.token;
    this.baseURL = options.baseURL || 'https://api.github.com';
    this.githubApiURL = options.githubApiURL || 'https://api.github.com';
  }

  /**
   * Get Copilot token from GitHub
   * This exchanges a GitHub token for a Copilot-specific token
   */
  async getCopilotToken(): Promise<string> {
    const response = await fetch(`${this.githubApiURL}/copilot_internal/token`, {
      headers: {
        'Authorization': `token ${this.token}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new HarnessError(
        `Failed to get Copilot token: ${response.status}`,
        HarnessErrorCode.AUTH_ERROR,
        { statusCode: response.status }
      );
    }

    const data = await response.json() as { token: string };
    return data.token;
  }

  async chat(options: CopilotChatOptions): Promise<CopilotChatResponse> {
    // Try to get a Copilot-specific token, fallback to provided token
    let copilotToken: string;
    try {
      copilotToken = await this.getCopilotToken();
    } catch {
      copilotToken = this.token;
    }

    // Use GitHub's Copilot Chat API endpoint
    const response = await fetch(`${this.baseURL}/copilot/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${copilotToken}`,
        'Accept': 'application/json',
        'Github-Version': '2023-07-07',
      },
      body: JSON.stringify({
        model: options.model || COPILOT_MODELS.COPILOT_CHAT,
        messages: options.messages,
        temperature: options.temperature,
        max_tokens: options.maxTokens,
        top_p: options.topP,
        stream: false,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new HarnessError(
        error.message || `Copilot API error: ${response.status}`,
        HarnessErrorCode.PROVIDER_ERROR,
        { statusCode: response.status }
      );
    }

    const data = await response.json() as CopilotChatResponse;
    return data;
  }

  async *chatStream(options: CopilotChatOptions): AsyncGenerator<CopilotStreamChunk> {
    // Try to get a Copilot-specific token, fallback to provided token
    let copilotToken: string;
    try {
      copilotToken = await this.getCopilotToken();
    } catch {
      copilotToken = this.token;
    }

    const response = await fetch(`${this.baseURL}/copilot/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${copilotToken}`,
        'Accept': 'text/event-stream',
        'Github-Version': '2023-07-07',
      },
      body: JSON.stringify({
        model: options.model || COPILOT_MODELS.COPILOT_CHAT,
        messages: options.messages,
        temperature: options.temperature,
        max_tokens: options.maxTokens,
        top_p: options.topP,
        stream: true,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new HarnessError(
        error.message || `Copilot API error: ${response.status}`,
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
              const chunk = JSON.parse(line.slice(6)) as CopilotStreamChunk;
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
      { id: COPILOT_MODELS.COPILOT_CHAT, name: 'GitHub Copilot Chat' },
      { id: COPILOT_MODELS.GPT_4, name: 'GPT-4 (via Copilot)' },
      { id: COPILOT_MODELS.GPT_4_TURBO, name: 'GPT-4 Turbo (via Copilot)' },
    ];
  }

  /**
   * Check if Copilot is available for the authenticated user
   */
  async checkAccess(): Promise<{ hasAccess: boolean; seatType?: string }> {
    try {
      const response = await fetch(`${this.githubApiURL}/user/copilot`, {
        headers: {
          'Authorization': `token ${this.token}`,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        return { hasAccess: false };
      }

      const data = await response.json() as { seat_type?: string };
      return { hasAccess: true, seatType: data.seat_type };
    } catch {
      return { hasAccess: false };
    }
  }
}

export { AllternitCopilot as AllternitGitHubCopilot };
export default AllternitCopilot;
