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

  it('flattens PDF base64 blocks to extracted text for OpenAI', () => {
    const pdfBase64 =
      'JVBERi0xLjQKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUl0gL0NvdW50IDEgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCA2MTIgNzkyXSAvQ29udGVudHMgNCAwIFIgPj4KZW5kb2JqCjQgMCBvYmoKPDwgL0xlbmd0aCA0NCA+PgpzdHJlYW0KQlQKL0YxIDEyIFRmCjEwMCA3MDAgVGQKKEhlbGxvIFBERikgVGoKRVQKZW5kc3RyZWFtCmVuZG9iagp4cmVmCjAgNQowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMDkgMDAwMDAgbiAKMDAwMDAwMDA1OCAwMDAwMCBuIAowMDAwMDAwMTE1IDAwMDAwIG4gCjAwMDAwMDAyMTQgMDAwMDAgbiAKdHJhaWxlcgo8PCAvU2l6ZSA1IC9Sb290IDEgMCBSID4+CnN0YXJ0eHJlZgozMDkKJSVFT0YK';
    const body = toOpenAIRequest({
      ...baseRequest,
      messages: [
        {
          role: 'user',
          content: [{ type: 'pdf', source: 'base64', data: pdfBase64, title: 'sample.pdf' }],
        },
      ],
    });
    const text = (body.messages as any[])[0].content[0].text as string;
    expect(text).toContain('[sample.pdf]');
    expect(text).toContain('Hello PDF');
  });

  it('flattens PDF URL blocks to text for OpenAI', () => {
    const body = toOpenAIRequest({
      ...baseRequest,
      messages: [
        {
          role: 'user',
          content: [{ type: 'pdf', source: 'url', url: 'https://example.com/doc.pdf' }],
        },
      ],
    });
    expect((body.messages as any[])[0].content).toEqual([
      { type: 'text', text: '[PDF document: https://example.com/doc.pdf]' },
    ]);
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

  it('passes tool-level cache_control through to Anthropic tools', () => {
    const tool = {
      name: 'get_weather',
      description: 'Get weather',
      parameters: { type: 'object', properties: {} },
      cache_control: { type: 'ephemeral' as const },
    };
    const body = toAnthropicRequest({ ...baseRequest, provider: 'anthropic', tools: [tool] });
    expect(body.tools).toEqual([
      {
        name: 'get_weather',
        description: 'Get weather',
        input_schema: { type: 'object', properties: {} },
        cache_control: { type: 'ephemeral' },
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

  it('maps PDF base64 blocks to Anthropic document blocks', () => {
    const pdfBase64 =
      'JVBERi0xLjQKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUl0gL0NvdW50IDEgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCA2MTIgNzkyXSAvQ29udGVudHMgNCAwIFIgPj4KZW5kb2JqCjQgMCBvYmoKPDwgL0xlbmd0aCA0NCA+PgpzdHJlYW0KQlQKL0YxIDEyIFRmCjEwMCA3MDAgVGQKKEhlbGxvIFBERikgVGoKRVQKZW5kc3RyZWFtCmVuZG9iagp4cmVmCjAgNQowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMDkgMDAwMDAgbiAKMDAwMDAwMDA1OCAwMDAwMCBuIAowMDAwMDAwMTE1IDAwMDAwIG4gCjAwMDAwMDAyMTQgMDAwMDAgbiAKdHJhaWxlcgo8PCAvU2l6ZSA1IC9Sb290IDEgMCBSID4+CnN0YXJ0eHJlZgozMDkKJSVFT0YK';
    const body = toAnthropicRequest({
      ...baseRequest,
      provider: 'anthropic',
      messages: [
        {
          role: 'user',
          content: [{ type: 'pdf', source: 'base64', data: pdfBase64, title: 'sample.pdf' }],
        },
      ],
    });
    expect((body.messages as any[])[0].content).toEqual([
      {
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 },
      },
    ]);
  });

  it('flattens PDF file_id blocks to text for Anthropic', () => {
    const body = toAnthropicRequest({
      ...baseRequest,
      provider: 'anthropic',
      messages: [
        {
          role: 'user',
          content: [{ type: 'pdf', source: 'file_id', fileId: 'file_123', title: 'uploaded.pdf' }],
        },
      ],
    });
    expect((body.messages as any[])[0].content).toEqual([
      { type: 'text', text: '[uploaded.pdf: file_id=file_123]' },
    ]);
  });

  it('maps tool_result content blocks to Anthropic tool_result blocks with cache_control', () => {
    const body = toAnthropicRequest({
      ...baseRequest,
      provider: 'anthropic',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'call_1',
              content: 'Large result payload',
              cache_control: { type: 'ephemeral' },
            },
          ],
        },
      ],
    });
    expect(body.messages[0].content).toEqual([
      {
        type: 'tool_result',
        tool_use_id: 'call_1',
        content: 'Large result payload',
        cache_control: { type: 'ephemeral' },
      },
    ]);
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
