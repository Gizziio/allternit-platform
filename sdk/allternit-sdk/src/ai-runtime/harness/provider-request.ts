import type { ContentBlock, HarnessStopReason, Message, StreamRequest, Tool } from './types.js';
import { flattenPdfToText } from './pdf.js';

/** Map a provider-specific stop/finish reason to the normalized taxonomy. */
export function mapStopReason(
  provider: 'anthropic' | 'openai',
  raw: string | undefined
): HarnessStopReason | undefined {
  if (!raw) return undefined;
  const value = raw.toLowerCase().replace(/[-_]/g, '_');
  if (provider === 'anthropic') {
    if (value === 'end_turn') return 'end_turn';
    if (value === 'max_tokens') return 'max_tokens';
    if (value === 'stop_sequence') return 'stop_sequence';
    if (value === 'tool_use' || value === 'tool_calls') return 'tool_use';
  }
  if (provider === 'openai') {
    if (value === 'stop') return 'end_turn';
    if (value === 'length') return 'max_tokens';
    if (value === 'tool_calls' || value === 'function_call') return 'tool_use';
    if (value === 'content_filter') return 'refusal';
  }
  return undefined;
}

const openAiTool = (tool: Tool) => ({
  type: 'function',
  function: {
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
    ...(tool.strict === undefined ? {} : { strict: tool.strict }),
  },
});

const openAiToolChoice = (choice: StreamRequest['toolChoice']) =>
  typeof choice === 'object'
    ? { type: 'function', function: { name: choice.name } }
    : choice;

const openAiFunction = (fn: { name: string; description: string; parameters: Record<string, unknown> }) => ({
  name: fn.name,
  description: fn.description,
  parameters: fn.parameters,
});

const openAiFunctionCall = (choice: StreamRequest['toolChoice']) =>
  typeof choice === 'object'
    ? { name: choice.name }
    : choice === 'required'
      ? 'auto'
      : choice;

export function hasCacheControl(request: StreamRequest): boolean {
  return (
    request.messages.some((m) => !!m.cache_control || m.cache) ||
    request.tools?.some((t) => !!t.cache_control || t.cache) ||
    false
  );
}

function searchResultText(block: Extract<ContentBlock, { type: 'search_result' }>): string {
  const scoreSuffix = block.score !== undefined ? ` score=${block.score}` : '';
  return `[search_result title="${block.title}" url="${block.url}"${scoreSuffix}]\n${block.content}\n[/search_result]`;
}

function openAiContentBlock(block: ContentBlock): Record<string, unknown> {
  switch (block.type) {
    case 'text':
      return { type: 'text', text: block.text };
    case 'search_result':
      return { type: 'text', text: searchResultText(block) };
    case 'vision':
      if (block.source.type === 'url') {
        return { type: 'image_url', image_url: { url: block.source.url } };
      }
      return {
        type: 'image_url',
        image_url: {
          url: `data:${block.source.media_type};base64,${block.source.data}`,
        },
      };
    case 'vision_coordinates':
      return { type: 'text', text: `[vision_coordinates: ${block.x}, ${block.y}]` };
    case 'pdf':
      return { type: 'text', text: flattenPdfToText(block) };
    default:
      return { type: 'text', text: '' };
  }
}

function toOpenAiMessage(message: Message): Record<string, unknown> {
  const { cache, cache_control, ...rest } = message;
  const content = typeof message.content === 'string'
    ? message.content
    : message.content.map(openAiContentBlock);
  return { ...rest, content };
}

function anthropicContentBlock(block: ContentBlock, cacheable: Pick<Message, 'cache' | 'cache_control'>): Record<string, unknown> {
  switch (block.type) {
    case 'text':
      return { type: 'text', text: block.text, ...cacheMarker(cacheable) };
    case 'search_result':
      return { type: 'text', text: searchResultText(block), ...cacheMarker(cacheable) };
    case 'vision':
      if (block.source.type === 'url') {
        return { type: 'image', source: { type: 'url', url: block.source.url }, ...cacheMarker(cacheable) };
      }
      return {
        type: 'image',
        source: { type: 'base64', media_type: block.source.media_type, data: block.source.data },
        ...cacheMarker(cacheable),
      };
    case 'vision_coordinates':
      return { type: 'text', text: `[vision_coordinates: ${block.x}, ${block.y}]`, ...cacheMarker(cacheable) };
    case 'pdf':
      if (block.source === 'base64' && block.data) {
        return {
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: block.data },
          ...cacheMarker(cacheable),
        };
      }
      return { type: 'text', text: flattenPdfToText(block), ...cacheMarker(cacheable) };
    default:
      return { type: 'text', text: '', ...cacheMarker(cacheable) };
  }
}

function toAnthropicMessageContent(message: Message): unknown[] {
  return typeof message.content === 'string'
    ? [{ type: 'text', text: message.content, ...cacheMarker(message) }]
    : message.content.map(block => anthropicContentBlock(block, message));
}

function messageContentText(message: Message): string {
  if (typeof message.content === 'string') return message.content;
  return message.content
    .map(block => {
      if (block.type === 'text') return block.text;
      if (block.type === 'search_result') return searchResultText(block);
      if (block.type === 'vision') return '[image]';
      if (block.type === 'vision_coordinates') return `[vision_coordinates: ${block.x}, ${block.y}]`;
      if (block.type === 'pdf') return flattenPdfToText(block);
      return '';
    })
    .join('\n');
}

/** Convert the normalized harness contract to an OpenAI-compatible body. */
export function toOpenAIRequest(request: StreamRequest): Record<string, unknown> {
  const responseFormat = request.responseFormat && {
    type: 'json_schema',
    json_schema: {
      name: request.responseFormat.name ?? 'response',
      schema: request.responseFormat.schema,
      ...(request.responseFormat.description ? { description: request.responseFormat.description } : {}),
      strict: request.responseFormat.strict ?? true,
    },
  };

  // Prefer the legacy `functions` array when callers request it; otherwise
  // emit the current `tools` format.
  const useFunctions = Array.isArray(request.functions) && request.functions.length > 0;
  return compact({
    model: request.model,
    messages: request.messages.map(toOpenAiMessage),
    temperature: request.temperature,
    max_tokens: request.maxTokens,
    top_p: request.topP,
    ...(useFunctions
      ? {
          functions: request.functions?.map(openAiFunction),
          function_call: openAiFunctionCall(request.toolChoice),
        }
      : {
          tools: request.tools?.map(openAiTool),
          tool_choice: openAiToolChoice(request.toolChoice),
        }),
    parallel_tool_calls: request.parallelToolCalls,
    reasoning_effort: request.reasoning?.effort,
    response_format: responseFormat,
    service_tier: hasCacheControl(request) ? 'flex' : undefined,
    stream: request.stream,
  });
}

/** Extract normalized usage from an OpenAI chat.completion response. */
export function parseOpenAIUsage(usage: Record<string, unknown>): {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cachedTokens?: number;
} {
  const promptTokens = typeof usage.prompt_tokens === 'number' ? usage.prompt_tokens : 0;
  const completionTokens =
    typeof usage.completion_tokens === 'number' ? usage.completion_tokens : 0;
  const totalTokens =
    typeof usage.total_tokens === 'number' ? usage.total_tokens : promptTokens + completionTokens;

  const promptDetails = usage.prompt_tokens_details as Record<string, unknown> | undefined;
  const cachedTokens =
    typeof promptDetails?.cached_tokens === 'number' ? promptDetails.cached_tokens : undefined;

  return {
    promptTokens,
    completionTokens,
    totalTokens,
    ...(typeof cachedTokens === 'number' && cachedTokens > 0
      ? { cachedTokens }
      : {}),
  };
}

/** Convert the normalized harness contract to Anthropic Messages fields. */
export function toAnthropicRequest(request: StreamRequest): Record<string, unknown> {
  const systemMessages = request.messages.filter(message => message.role === 'system');
  const system = systemMessages.map((message, index) => ({
    type: 'text',
    text: messageContentText(message),
    ...cacheMarker(message, index === systemMessages.length - 1 ? request.systemCacheControl : undefined),
  }));
  const tools = request.tools?.map(tool => compact({
    name: tool.name,
    description: tool.description,
    input_schema: tool.parameters,
    strict: tool.strict,
    ...cacheMarker(tool),
  }));
  return compact({
    model: request.model,
    system: system.length ? system : undefined,
    messages: request.messages.filter(message => message.role !== 'system').map(message => ({
      role: message.role,
      content: toAnthropicMessageContent(message),
    })),
    max_tokens: request.maxTokens,
    temperature: request.temperature,
    top_p: request.topP,
    tools,
    tool_choice: request.toolChoice && (typeof request.toolChoice === 'object'
      ? { type: 'tool', name: request.toolChoice.name }
      : { type: request.toolChoice === 'required' ? 'any' : request.toolChoice }),
    disable_parallel_tool_use: request.parallelToolCalls === undefined ? undefined : !request.parallelToolCalls,
    thinking: request.reasoning && request.reasoning.enabled !== false ? {
      type: 'enabled',
      budget_tokens: request.reasoning.budgetTokens ?? 1024,
    } : undefined,
    output_format: request.responseFormat && {
      type: 'json_schema',
      schema: request.responseFormat.schema,
    },
    citations: request.citations,
    stream: request.stream,
  });
}

/** Kimi's OpenAI-compatible API uses `thinking` instead of reasoning_effort. */
export function toKimiRequest(request: StreamRequest): Record<string, unknown> {
  const body = toOpenAIRequest(request);
  delete body.reasoning_effort;
  return compact({
    ...body,
    thinking: request.reasoning && {
      type: request.reasoning.enabled === false ? 'disabled' : 'enabled',
      ...(request.reasoning.budgetTokens ? { budget_tokens: request.reasoning.budgetTokens } : {}),
    },
  });
}

function cacheMarker(value: Pick<Message | Tool, 'cache' | 'cache_control'>, fallback?: Message['cache_control']) {
  const cacheControl = value.cache_control ?? fallback ?? (value.cache ? { type: 'ephemeral' as const } : undefined);
  return cacheControl ? { cache_control: cacheControl } : {};
}

function compact<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;
}
