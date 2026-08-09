import { describe, it, expect } from 'bun:test';
import { mapStopReason, toOpenAIRequest, toAnthropicRequest, toKimiRequest } from '../provider-request';

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

  it('maps vision content blocks to OpenAI image_url parts', () => {
    const body = toOpenAIRequest({
      ...baseRequest,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'What is this?' },
            { type: 'vision', source: { type: 'url', url: 'https://example.com/image.png' } },
            { type: 'vision', source: { type: 'base64', media_type: 'image/png', data: 'abc123' } },
            { type: 'vision_coordinates', x: 100, y: 200 },
          ],
        },
      ],
    });
    expect(body.messages).toEqual([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'What is this?' },
          { type: 'image_url', image_url: { url: 'https://example.com/image.png' } },
          { type: 'image_url', image_url: { url: 'data:image/png;base64,abc123' } },
          { type: 'text', text: '[vision_coordinates: 100, 200]' },
        ],
      },
    ]);
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

  it('maps vision content blocks to Anthropic image blocks', () => {
    const body = toAnthropicRequest({
      ...baseRequest,
      provider: 'anthropic',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'What is this?' },
            { type: 'vision', source: { type: 'url', url: 'https://example.com/image.png' } },
            { type: 'vision', source: { type: 'base64', media_type: 'image/png', data: 'abc123' } },
            { type: 'vision_coordinates', x: 100, y: 200 },
          ],
        },
      ],
    });
    expect(body.messages).toEqual([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'What is this?' },
          { type: 'image', source: { type: 'url', url: 'https://example.com/image.png' } },
          { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'abc123' } },
          { type: 'text', text: '[vision_coordinates: 100, 200]' },
        ],
      },
    ]);
  });

  it('flattens system vision blocks to text for Anthropic', () => {
    const body = toAnthropicRequest({
      ...baseRequest,
      provider: 'anthropic',
      messages: [
        {
          role: 'system',
          content: [
            { type: 'text', text: 'You are helpful.' },
            { type: 'vision', source: { type: 'url', url: 'https://example.com/image.png' } },
          ],
        },
      ],
    });
    expect(body.system).toEqual([{ type: 'text', text: 'You are helpful.\n[image]' }]);
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
