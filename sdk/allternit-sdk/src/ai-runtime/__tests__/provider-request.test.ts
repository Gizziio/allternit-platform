import { describe, expect, it } from 'vitest';
import { toAnthropicRequest, toKimiRequest, toOpenAIRequest } from '../harness/provider-request.js';
import type { StreamRequest } from '../harness/types.js';

const request: StreamRequest = {
  provider: 'openai',
  model: 'model',
  messages: [{ role: 'system', content: 'cached', cache: true }, { role: 'user', content: 'go' }],
  tools: [{
    name: 'lookup', description: 'Lookup', strict: true, cache: true,
    parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
  }],
  toolChoice: { name: 'lookup' },
  parallelToolCalls: false,
  reasoning: { enabled: true, effort: 'high', budgetTokens: 2048 },
  responseFormat: { type: 'json_schema', name: 'answer', schema: { type: 'object' }, strict: true },
};

describe('normalized provider requests', () => {
  it('maps OpenAI reasoning, schema and tool controls', () => {
    const body = toOpenAIRequest(request) as any;
    expect(body.reasoning_effort).toBe('high');
    expect(body.response_format.json_schema.name).toBe('answer');
    expect(body.tools[0].function.strict).toBe(true);
    expect(body.tool_choice.function.name).toBe('lookup');
    expect(body.parallel_tool_calls).toBe(false);
  });

  it('maps Anthropic thinking and cache boundaries', () => {
    const body = toAnthropicRequest({ ...request, citations: true }) as any;
    expect(body.thinking.budget_tokens).toBe(2048);
    expect(body.system[0].cache_control.type).toBe('ephemeral');
    expect(body.tools[0].cache_control.type).toBe('ephemeral');
    expect(body.disable_parallel_tool_use).toBe(true);
    expect(body.citations).toBe(true);
  });

  it('maps Kimi thinking without leaking reasoning_effort', () => {
    const body = toKimiRequest(request) as any;
    expect(body.thinking.type).toBe('enabled');
    expect(body.reasoning_effort).toBeUndefined();
  });
});
