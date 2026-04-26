/**
 * SwarmProviderAdapter
 *
 * Uniform invoke(options) interface that hides provider/exec-mode differences.
 * Each adapter produces a single string response given system+user prompts.
 *
 * Supported execution modes:
 *   api   — Vercel AI SDK (Anthropic, Google, OpenAI-compat, Ollama, etc.)
 *   cli   — Subprocess (claude --print, codex) — only viable in local dev
 *   local — Ollama HTTP at localhost:11434
 *   oauth — Same as api but uses OAuth bearer token from caller
 */

import { generateText } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { spawn } from 'child_process';

// ─── Interface ────────────────────────────────────────────────────────────────

export interface SwarmAdapterConfig {
  providerId: string;
  modelId: string;
  execMode: 'api' | 'cli' | 'local' | 'oauth';
  /** For oauth mode — bearer token from the session */
  accessToken?: string;
}

export interface SwarmInvokeOptions {
  systemPrompt: string;
  userPrompt: string;
  /** Max tokens to generate */
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface SwarmProviderAdapter {
  invoke(options: SwarmInvokeOptions): Promise<string>;
}

// ─── API-mode adapters ────────────────────────────────────────────────────────

function apiKey(env: string): string {
  return process.env[env] ?? '';
}

function makeClaudeAdapter(modelId: string): SwarmProviderAdapter {
  const sdk = createAnthropic({ apiKey: apiKey('ANTHROPIC_API_KEY') });
  return {
    async invoke({ systemPrompt, userPrompt, maxTokens = 2048, signal }) {
      const { text } = await generateText({
        model: sdk(modelId),
        system: systemPrompt,
        prompt: userPrompt,
        maxOutputTokens: maxTokens,
        abortSignal: signal,
      });
      return text;
    },
  };
}

function makeGeminiAdapter(modelId: string): SwarmProviderAdapter {
  const sdk = createGoogleGenerativeAI({ apiKey: apiKey('GOOGLE_GENERATIVE_AI_API_KEY') });
  return {
    async invoke({ systemPrompt, userPrompt, maxTokens = 2048, signal }) {
      const { text } = await generateText({
        model: sdk(modelId),
        system: systemPrompt,
        prompt: userPrompt,
        maxOutputTokens: maxTokens,
        abortSignal: signal,
      });
      return text;
    },
  };
}

function makeOpenAICompatAdapter(modelId: string, baseURL?: string, envKey = 'OPENAI_API_KEY'): SwarmProviderAdapter {
  const sdk = createOpenAI({
    apiKey: apiKey(envKey),
    ...(baseURL ? { baseURL } : {}),
  });
  return {
    async invoke({ systemPrompt, userPrompt, maxTokens = 2048, signal }) {
      const { text } = await generateText({
        model: sdk(modelId),
        system: systemPrompt,
        prompt: userPrompt,
        maxOutputTokens: maxTokens,
        abortSignal: signal,
      });
      return text;
    },
  };
}

function makeOllamaAdapter(modelId: string): SwarmProviderAdapter {
  // Ollama exposes an OpenAI-compatible API at localhost:11434/v1
  const ollamaUrl = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434/v1';
  const sdk = createOpenAI({ baseURL: ollamaUrl, apiKey: 'ollama' });
  return {
    async invoke({ systemPrompt, userPrompt, maxTokens = 2048, signal }) {
      const { text } = await generateText({
        model: sdk(modelId),
        system: systemPrompt,
        prompt: userPrompt,
        maxOutputTokens: maxTokens,
        abortSignal: signal,
      });
      return text;
    },
  };
}

// ─── CLI-mode adapters ────────────────────────────────────────────────────────

function makeCliAdapter(command: string, args: (prompt: string, model: string) => string[]): (modelId: string) => SwarmProviderAdapter {
  return (modelId: string) => ({
    async invoke({ systemPrompt, userPrompt, signal }) {
      const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${userPrompt}` : userPrompt;
      return new Promise<string>((resolve, reject) => {
        const proc = spawn(command, args(fullPrompt, modelId), { stdio: ['ignore', 'pipe', 'pipe'] });
        const chunks: string[] = [];
        proc.stdout.on('data', (d: Buffer) => chunks.push(d.toString()));
        proc.stderr.on('data', (d: Buffer) => { /* ignore stderr */ });
        proc.on('close', (code) => {
          if (code === 0) resolve(chunks.join(''));
          else reject(new Error(`${command} exited with code ${code}`));
        });
        proc.on('error', reject);
        signal?.addEventListener('abort', () => proc.kill());
      });
    },
  });
}

const makeClaudeCLIAdapter = makeCliAdapter('claude', (prompt, model) => [
  '--print', prompt, '--model', model,
]);

const makeCodexCLIAdapter = makeCliAdapter('codex', (prompt) => [
  '--quiet', '--approval-mode', 'full-auto', prompt,
]);

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createSwarmAdapter(config: SwarmAdapterConfig): SwarmProviderAdapter {
  const { providerId, modelId, execMode } = config;

  if (execMode === 'local') {
    return makeOllamaAdapter(modelId);
  }

  if (execMode === 'cli') {
    if (providerId === 'claude') return makeClaudeCLIAdapter(modelId);
    if (providerId === 'codex') return makeCodexCLIAdapter(modelId);
    // Fall through to API for providers without CLI support
  }

  // api + oauth modes — route by provider
  switch (providerId) {
    case 'claude':
      return makeClaudeAdapter(modelId);

    case 'gemini':
      return makeGeminiAdapter(modelId);

    case 'codex':
    case 'openai':
      return makeOpenAICompatAdapter(modelId);

    case 'kimi':
      // Moonshot AI — OpenAI-compatible endpoint
      return makeOpenAICompatAdapter(modelId, 'https://api.moonshot.cn/v1', 'MOONSHOT_API_KEY');

    case 'qwen':
      // Alibaba DashScope — OpenAI-compatible endpoint
      return makeOpenAICompatAdapter(modelId, 'https://dashscope.aliyuncs.com/compatible-mode/v1', 'DASHSCOPE_API_KEY');

    case 'minimax':
      // MiniMax — OpenAI-compatible endpoint
      return makeOpenAICompatAdapter(modelId, 'https://api.minimax.chat/v1', 'MINIMAX_API_KEY');

    case 'glm':
      // ZhipuAI — OpenAI-compatible endpoint
      return makeOpenAICompatAdapter(modelId, 'https://open.bigmodel.cn/api/paas/v4', 'ZHIPU_API_KEY');

    case 'local':
      return makeOllamaAdapter(modelId);

    default:
      // Unknown provider — try Ollama local as fallback
      return makeOllamaAdapter(modelId);
  }
}
