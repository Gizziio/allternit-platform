import { describe, it, expect } from 'bun:test';
import {
  mapStopReason,
  toOpenAIRequest,
  toAnthropicRequest,
  toKimiRequest,
  parseOpenAIUsage,
} from '../provider-request';

const baseRequest = {
  provider: 'openai',
  model: 'gpt-4',
  messages: [{ role: 'user' as const, content: 'Hello' }],
};

describe('mapStopReason', () => {
  it('maps Anthropic stop reasons to the taxonomy', () => {
    expect(mapStopReason('anthropic', 'end_turn')).toBe('end_turn');
    expect(mapStopReason('anthropic', 'max_tokens')).toBe('max_tokens');
    expect(mapStopReason('anthropic', 'stop_sequence')).toBe('stop_sequence');
    expect(mapStopReason('anthropic', 'tool_use')).toBe('tool_use');
    expect(mapStopReason('anthropic', 'tool_calls')).toBe('tool_use');
  });

  it('maps OpenAI finish reasons to the taxonomy', () => {
    expect(mapStopReason('openai', 'stop')).toBe('end_turn');
    expect(mapStopReason('openai', 'length')).toBe('max_tokens');
    expect(mapStopReason('openai', 'tool_calls')).toBe('tool_use');
    expect(mapStopReason('openai', 'function_call')).toBe('tool_use');
    expect(mapStopReason('openai', 'content_filter')).toBe('refusal');
  });

  it('returns undefined for unknown or empty reasons', () => {
    expect(mapStopReason('openai', undefined)).toBeUndefined();
    expect(mapStopReason('anthropic', undefined)).toBeUndefined();
    expect(mapStopReason('openai', 'unknown_reason')).toBeUndefined();
  });
});

describe('toOpenAIRequest', () => {
  it('emits modern tools/tool_choice by default', () => {
    const tool = {
      name: 'get_weather',
      description: 'Get weather',
      parameters: { type: 'object', properties: {} },
    };
    const body = toOpenAIRequest({ ...baseRequest, tools: [tool], toolChoice: { name: 'get_weather' } });
    expect(body.tools).toEqual([
      {
        type: 'function',
        function: {
          name: 'get_weather',
          description: 'Get weather',
          parameters: { type: 'object', properties: {} },
          strict: undefined,
        },
      },
    ]);
    expect(body.tool_choice).toEqual({ type: 'function', function: { name: 'get_weather' } });
    expect(body.functions).toBeUndefined();
    expect(body.function_call).toBeUndefined();
  });

  it('emits legacy functions/function_call when functions are provided', () => {
    const fn = {
      name: 'get_weather',
      description: 'Get weather',
      parameters: { type: 'object', properties: {} },
    };
    const body = toOpenAIRequest({ ...baseRequest, functions: [fn], toolChoice: { name: 'get_weather' } });
    expect(body.functions).toEqual([
      { name: 'get_weather', description: 'Get weather', parameters: { type: 'object', properties: {} } },
    ]);
    expect(body.function_call).toEqual({ name: 'get_weather' });
    expect(body.tools).toBeUndefined();
    expect(body.tool_choice).toBeUndefined();
  });

  it('converts toolChoice required to function_call auto', () => {
    const fn = { name: 'foo', description: 'bar', parameters: { type: 'object' } };
    const body = toOpenAIRequest({ ...baseRequest, functions: [fn], toolChoice: 'required' });
    expect(body.function_call).toBe('auto');
  });

  it('omits response_format when not requested', () => {
    const body = toOpenAIRequest(baseRequest);
    expect(body.response_format).toBeUndefined();
  });

  it('includes reasoning_effort when present', () => {
    const body = toOpenAIRequest({ ...baseRequest, reasoning: { effort: 'high' } });
    expect(body.reasoning_effort).toBe('high');
  });

  it('emits service_tier flex when a message has cache_control', () => {
    const body = toOpenAIRequest({
      ...baseRequest,
      messages: [{ role: 'user', content: 'Hello', cache_control: { type: 'ephemeral' } }],
    });
    expect(body.service_tier).toBe('flex');
    // OpenAI does not understand Anthropic cache hints; strip them from the wire.
    expect((body.messages as any[])[0].cache_control).toBeUndefined();
  });

  it('emits service_tier flex when a tool has cache_control', () => {
    const tool = {
      name: 'get_weather',
      description: 'Get weather',
      parameters: { type: 'object', properties: {} },
      cache_control: { type: 'ephemeral' },
    };
    const body = toOpenAIRequest({ ...baseRequest, tools: [tool] });
    expect(body.service_tier).toBe('flex');
  });

  it('does not emit service_tier when no cache hints are present', () => {
    const body = toOpenAIRequest(baseRequest);
    expect(body.service_tier).toBeUndefined();
  });
});

describe('parseOpenAIUsage', () => {
  it('surfaces cached prompt tokens when present', () => {
    const usage = parseOpenAIUsage({
      prompt_tokens: 100,
      completion_tokens: 20,
      total_tokens: 120,
      prompt_tokens_details: { cached_tokens: 40 },
    });
    expect(usage).toEqual({
      promptTokens: 100,
      completionTokens: 20,
      totalTokens: 120,
      cachedTokens: 40,
    });
  });

  it('omits cachedTokens when no cached prompt tokens are reported', () => {
    const usage = parseOpenAIUsage({
      prompt_tokens: 100,
      completion_tokens: 20,
      total_tokens: 120,
    });
    expect(usage).toEqual({
      promptTokens: 100,
      completionTokens: 20,
      totalTokens: 120,
    });
    expect('cachedTokens' in usage).toBe(false);
  });
});

describe('toAnthropicRequest', () => {
  it('maps tools to Anthropic input_schema', () => {
    const tool = {
      name: 'get_weather',
      description: 'Get weather',
      parameters: { type: 'object', properties: {} },
    };
    const body = toAnthropicRequest({ ...baseRequest, provider: 'anthropic', tools: [tool] });
    expect(body.tools).toEqual([
      {
        name: 'get_weather',
        description: 'Get weather',
        input_schema: { type: 'object', properties: {} },
      },
    ]);
  });

  it('maps toolChoice object to named tool', () => {
    const body = toAnthropicRequest({
      ...baseRequest,
      provider: 'anthropic',
      tools: [{ name: 'get_weather', description: 'x', parameters: { type: 'object' } }],
      toolChoice: { name: 'get_weather' },
    });
    expect(body.tool_choice).toEqual({ type: 'tool', name: 'get_weather' });
  });

  it('maps toolChoice required to any', () => {
    const body = toAnthropicRequest({
      ...baseRequest,
      provider: 'anthropic',
      toolChoice: 'required',
    });
    expect(body.tool_choice).toEqual({ type: 'any' });
  });

  it('maps search_result blocks to text with citation markers', () => {
    const body = toAnthropicRequest({
      ...baseRequest,
      provider: 'anthropic',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'What is Allternit?' },
            {
              type: 'search_result',
              title: 'Allternit Docs',
              url: 'https://docs.allternit.com',
              content: 'Allternit is an AI governance and workflow system.',
              score: 0.95,
            },
          ],
        },
      ],
    });
    const content = body.messages[0].content as Array<{ type: string; text: string }>;
    expect(content).toHaveLength(2);
    expect(content[0]).toEqual({ type: 'text', text: 'What is Allternit?' });
    expect(content[1].type).toBe('text');
    expect(content[1].text).toContain('[search_result title="Allternit Docs" url="https://docs.allternit.com" score=0.95]');
    expect(content[1].text).toContain('Allternit is an AI governance and workflow system.');
    expect(content[1].text).toContain('[/search_result]');
  });
});

describe('toKimiRequest', () => {
  it('uses thinking instead of reasoning_effort', () => {
    const body = toKimiRequest({
      ...baseRequest,
      provider: 'kimi',
      reasoning: { enabled: true, budgetTokens: 1024 },
    });
    expect(body.reasoning_effort).toBeUndefined();
    expect(body.thinking).toEqual({ type: 'enabled', budget_tokens: 1024 });
  });
});
