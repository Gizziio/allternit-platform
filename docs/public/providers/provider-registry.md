# Provider registry

Allternit exposes provider metadata in two places: the TypeScript SDK's `PROVIDER_REGISTRY` (`sdk/allternit-sdk/src/ai-runtime/providers/registry.ts`) and the API's OpenAI-compatible `/v1/models` endpoint, which is enriched with per-model limits from the Gizzi provider catalog.

## SDK provider registry

`PROVIDER_REGISTRY` is a `Map<string, ProviderEntry>` keyed by provider id. Each entry carries the following metadata:

| Field | Meaning |
|-------|---------|
| `name` | Provider key (`anthropic`, `openai`, `google`, ...) |
| `displayName` | Human-readable label |
| `description` | Short capability summary |
| `features` | Supported capability flags |
| `defaultModel` | Recommended default model id |
| `models` | Known model ids for the provider |
| `requiresApiKey` | Whether a provider key is required in BYOK mode |
| `supportsStreaming` | Streaming support flag |
| `supportsTools` | Tool/function-calling support flag |
| `supportsVision` | Vision/multimodal input support flag |

### Registry entries

| Provider | Default model | Features | API key required |
|----------|---------------|----------|------------------|
| `anthropic` | `claude-3-5-sonnet-20241022` | streaming, tools, vision, json-mode, system-prompt, multi-modal | yes |
| `openai` | `gpt-4o` | streaming, tools, vision, json-mode, function-calling, system-prompt, fine-tuning | yes |
| `google` | `gemini-1.5-pro` | streaming, tools, vision, json-mode, function-calling, system-prompt, multi-modal | yes |
| `ollama` | `llama3.2` | streaming, tools, system-prompt | no |
| `mistral` | `mistral-large-latest` | streaming, tools, json-mode, function-calling, system-prompt | yes |
| `cohere` | `command-r-plus` | streaming, tools, json-mode, system-prompt | yes |
| `groq` | `llama-3.3-70b-versatile` | streaming, tools, json-mode, function-calling, system-prompt | yes |
| `together` | `meta-llama/Llama-3.3-70B-Instruct-Turbo` | streaming, tools, json-mode, function-calling, system-prompt | yes |
| `azure` | `gpt-4o` | streaming, tools, vision, json-mode, function-calling, system-prompt | yes |
| `bedrock` | `claude-3-5-sonnet` | streaming, tools, vision, json-mode, function-calling, system-prompt | yes |

### Feature flags

| Flag | Meaning |
|------|---------|
| `streaming` | Server-sent event streams are supported. |
| `tools` | Native tool/function calling is supported. |
| `vision` | Image/multimodal input is supported. |
| `json-mode` | Structured JSON/JSON Schema output is supported. |
| `function-calling` | Legacy OpenAI function-calling shape is supported. |
| `system-prompt` | A distinct system prompt role is supported. |
| `multi-modal` | Multiple content modalities in one message are supported. |
| `fine-tuning` | Provider exposes fine-tuned models. |

### SDK helpers

```typescript
import { getProvider, findProvidersByFeature, listProviders } from '@allternit/sdk/ai-runtime/providers/registry';

const openai = getProvider('openai');
console.log(openai?.defaultModel); // gpt-4o

const visionProviders = findProvidersByFeature('vision', 'tools');
console.log(visionProviders.map(p => p.name));

console.log(listProviders());
```

## API per-model metadata

`GET /v1/models` returns an OpenAI-shaped model list. Catalog models include `context_window` and `max_output_tokens` when the connected Gizzi provider advertises them:

```json
{
  "object": "list",
  "data": [
    {
      "id": "auto",
      "object": "model",
      "created": 0,
      "owned_by": "allternit"
    },
    {
      "id": "anthropic/claude-3-5-sonnet-20241022",
      "object": "model",
      "created": 1720000000,
      "owned_by": "anthropic",
      "context_window": 200000,
      "max_output_tokens": 8192
    }
  ]
}
```

Policy aliases (`auto`, `allternit-balanced`, `allternit-code`, `allternit-reasoning`, `allternit-knowledge`, `allternit-instruct`) are owned by `allternit` and resolve at request time via the B5 routing policy. Model-list entries are filtered by the caller's key allowlist.

## Stop-reason taxonomy

The harness normalizes provider-specific finish reasons to the `HarnessStopReason` union:

| `HarnessStopReason` | Anthropic source | OpenAI source |
|---------------------|------------------|---------------|
| `end_turn` | `end_turn` | `stop` |
| `max_tokens` | `max_tokens` | `length` |
| `stop_sequence` | `stop_sequence` | — |
| `tool_use` | `tool_use`, `tool_calls` | `tool_calls`, `function_call` |
| `pause_turn` | — | — |
| `refusal` | — | `content_filter` |

The API gateway maps Gizzi finish values to OpenAI `finish_reason` strings in `map_finish_reason`:

| Gizzi finish | OpenAI `finish_reason` |
|--------------|------------------------|
| `stop` (or unknown) | `stop` |
| `length` / `max_tokens` | `length` |
| `tool-calls` / `tool_calls` | `tool_calls` |
| `content-filter` / `content_filter` | `content_filter` |

## SDK harness model registry

The TypeScript harness keeps a focused model registry at `sdk/allternit-sdk/src/ai-runtime/harness/model-registry.ts` that maps provider/model pairs to known limits. It is used as a fallback for `StreamRequest.maxTokens` when the caller does not supply one.

```typescript
import { getModelMetadata } from '@allternit/sdk/harness';

const meta = getModelMetadata('anthropic', 'claude-3-5-sonnet-20241022');
console.log(meta?.contextWindow);      // 200000
console.log(meta?.maxOutputTokens);    // 8192
```

| Provider | Model | Context window | Max output tokens |
|----------|-------|----------------|-------------------|
| `anthropic` | `claude-3-5-sonnet-20241022` | 200,000 | 8,192 |
| `anthropic` | `claude-3-opus-20240229` | 200,000 | 4,096 |
| `openai` | `gpt-4o` | 128,000 | 16,384 |
| `openai` | `gpt-4` | 8,192 | 8,192 |
| `google` | `gemini-1.5-pro` | 2,097,152 | 8,192 |

## Model selection flow

1. The caller passes a `model` string to `POST /v1/chat/completions` or `AllternitHarness.stream()`.
2. In the API gateway, a policy alias is resolved by the B5 router to a concrete `provider/model` plus a fallback chain.
3. Explicit `provider/model` or bare model ids are looked up in the Gizzi catalog; the gateway derives a failover chain from the balanced scorecard.
4. The resolved model is checked against the virtual key's `allowed_models` allowlist before any upstream request is made.
5. In `AllternitHarness.stream()`, if `maxTokens` is omitted the harness fills it from the SDK harness model registry's `maxOutputTokens`.
