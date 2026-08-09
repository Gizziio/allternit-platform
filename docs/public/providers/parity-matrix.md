# Provider parity matrix

Allternit exposes a provider-neutral contract in the TypeScript SDK (`AllternitHarness`) and an OpenAI-compatible REST surface (`/v1`). The same normalized fields are translated to Anthropic, OpenAI, and Kimi wire shapes by the harness adapters and the API gateway.

```typescript
import { AllternitHarness } from '@allternit/sdk/ai-runtime/harness';
import { toAnthropicRequest, toOpenAIRequest, toKimiRequest } from '@allternit/sdk/ai-runtime/harness/provider-request';

const request = {
  provider: 'anthropic',
  model: 'claude-3-5-sonnet-20241022',
  messages: [{ role: 'user', content: 'Hello', cache: true }],
  reasoning: { enabled: true, budgetTokens: 1024 },
  responseFormat: { type: 'json_schema', schema: { type: 'object' } },
  stream: true,
} as const;

console.log(toAnthropicRequest(request));
console.log(toOpenAIRequest({ ...request, provider: 'openai', model: 'gpt-4o' }));
console.log(toKimiRequest({ ...request, provider: 'kimi', model: 'kimi-k2' }));
```

## Anthropic → Allternit

| Anthropic concept | Allternit API / SDK field | Notes |
|-------------------|---------------------------|-------|
| `cache_control` on messages / system / tools | `cache_control` or `cache` on `Message`, `Tool`, `FunctionDefinition` | `cache: true` is shorthand for `{ type: 'ephemeral' }`. API request body accepts `cache_control` and `cache` on messages and tool functions. |
| `thinking` | SDK: `reasoning.enabled` + `reasoning.budgetTokens`<br>API: `reasoning_effort` | Anthropic `thinking: { type: 'enabled', budget_tokens }` is emitted from `reasoning.budgetTokens`. API `reasoning_effort` (`none`…`xhigh`) is forwarded as a Gizzi variant. |
| `tool_choice` | SDK: `toolChoice`<br>API: `tool_choice` | `auto`/`none`/`required` and `{ name }` are supported. `{ name }` maps to Anthropic `{ type: 'tool', name }`. |
| `parallel_tool_calls` / `disable_parallel_tool_use` | SDK: `parallelToolCalls`<br>API: `parallel_tool_calls` | `parallelToolCalls: false` sets Anthropic `disable_parallel_tool_use: true`. |
| Citations (`citations_delta`) | SDK: `citations: true` on `StreamRequest`; chunk type `citation` | Anthropic citation deltas become `CitationChunk` objects with `citedText`, `title`, `url`, `documentIndex`, and character offsets. |
| Batch API | API: `POST /v1/batches`, `GET /v1/batches/:id`, `POST /v1/batches/:id/cancel`, `GET /v1/batches/:id/results` | Phase 1 stores batch metadata and lifecycle; execution/polling is Phase 2. |
| `computer_20250124` | SDK: `ComputerUseCapability` / `COMPUTER_USE_TOOL` | `metadata.anthropicType` is `computer_20250124`. Tool name is `computer`, actions include `screenshot`, `mouse_move`, `left_click`, `type`, etc. |
| `text_editor_20250124` | SDK: `TextEditorTool` (`str_replace_editor`) | `metadata.anthropicType` is `text_editor_20250124`. Supports `view`, `str_replace`, `create`, `insert`, `undo`, `undo_edit` with workspace containment. |

## OpenAI → Allternit

| OpenAI concept | Allternit API / SDK field | Notes |
|----------------|---------------------------|-------|
| `reasoning_effort` | API: `reasoning_effort`<br>SDK: `reasoning.effort` | Accepted values: `none`, `minimal`, `low`, `medium`, `high`, `xhigh`. |
| `response_format.json_schema` | API: `response_format.type === 'json_schema'`<br>SDK: `responseFormat.type === 'json_schema'` | API accepts either `json_schema.name/schema` or shorthand `schema`. SDK uses `schema`, `name`, `description`, `strict`. |
| Legacy `functions` / `function_call` | SDK: `functions` + `toolChoice` | `functions` array overrides `tools` in `toOpenAIRequest`. `toolChoice: { name }` becomes `function_call: { name }`; `required` becomes `auto`. |
| `tools` / `tool_choice` | API: `tools`, `tool_choice`<br>SDK: `tools`, `toolChoice` | API validates shape but does not forward; Gizzi owns tool execution. SDK forwards to provider adapters. |
| Batch API | API: `POST /v1/batches`, etc. | Same lifecycle endpoints as OpenAI batches. |
| `stop` | API: `stop` | Single string or array. |
| `max_tokens` | API: `max_tokens`<br>SDK: `maxTokens` | Must be >= 1 when provided. |
| `temperature` / `top_p` | API: `temperature`, `top_p`<br>SDK: `temperature`, `topP` | Same ranges. |

## Kimi → Allternit

| Kimi concept | Allternit API / SDK field | Notes |
|--------------|---------------------------|-------|
| Long context | `context_window` in `/v1/models`; model id such as `kimi/kimi-k2` | Use `/v1/models` or the Gizzi catalog to verify context-window limits. |
| Tool use | SDK: `tools` + `toolChoice` | Kimi uses an OpenAI-compatible tool schema; the harness routes via `toOpenAIRequest` then swaps `thinking` for reasoning. |
| Response format / JSON mode | SDK: `responseFormat.type === 'json_schema'` | Emitted as OpenAI `response_format` with `json_schema`. |
| Reasoning / `thinking` | SDK: `reasoning.enabled` / `reasoning.budgetTokens` | `toKimiRequest` removes `reasoning_effort` and emits Kimi-style `thinking: { type, budget_tokens }`. |

## Cross-provider normalized types

The harness normalizes provider-specific values into a single taxonomy:

| Concept | Normalized type | Location |
|---------|-----------------|----------|
| Stop reason | `HarnessStopReason` | `sdk/allternit-sdk/src/ai-runtime/harness/types.ts` |
| Reasoning config | `ThinkingConfig` | `sdk/allternit-sdk/src/ai-runtime/harness/types.ts` |
| Cache marker | `CacheControl` (`{ type: 'ephemeral', ttl?: '5m' \| '1h' }`) | `sdk/allternit-sdk/src/ai-runtime/harness/types.ts` |
| JSON Schema response | `JsonSchemaResponseFormat` | `sdk/allternit-sdk/src/ai-runtime/harness/types.ts` |
| Tool definition | `Tool` | `sdk/allternit-sdk/src/ai-runtime/harness/types.ts` |
| Stream chunk | `HarnessStreamChunk` | `sdk/allternit-sdk/src/ai-runtime/harness/types.ts` |

## Error-code parity

All gateway errors use the OpenAI error envelope and include an Allternit `code`:

| Situation | HTTP status | `type` | `code` |
|-----------|-------------|--------|--------|
| Bad request | 400 | `invalid_request_error` | `allternit.invalid_request` |
| Invalid API key | 401 | `invalid_request_error` | `allternit.authentication_failed` |
| Model not allowed | 403 | `permission_error` | `allternit.permission_denied` |
| Rate limited | 429 | `rate_limit_exceeded` | `allternit.rate_limited` |
| Budget exceeded | 429 | `budget_exceeded` | `allternit.budget_exceeded` |
| Idempotency conflict | 409 | `invalid_request_error` | `allternit.idempotency_conflict` |
| Upstream error | 502 | provider-specific | `allternit.upstream_error` |
| Internal error | 500 | `server_error` | `allternit.internal_error` |
