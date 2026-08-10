# System prompts changelog

Allternit does not inject hidden system prompts. Every instruction sent to a model comes from explicit user, project, or organization configuration. However, provider-hosted models *do* ship with their own default system prompts and behavior versions. This page tracks those versions so you can reproduce, debug, and migrate across provider updates.

## What we track

For each provider/model family, Allternit records:

| Field | Meaning |
|-------|---------|
| `provider` | `anthropic`, `openai`, `kimi`, `google`, `local` |
| `model_family` | e.g. `claude-3-5-sonnet`, `gpt-4o`, `kimi-k2` |
| `system_prompt_version` | Provider's documented behavior version |
| `knowledge_cutoff` | Training knowledge cutoff date, if published |
| `reasoning_notes` | How reasoning/thinking behavior is controlled |
| `breaking_changes` | Behavior changes that affect prompt engineering |

## Current provider versions

### Anthropic

| Model family | System prompt version | Knowledge cutoff | Notes |
|--------------|-----------------------|------------------|-------|
| Claude 3.5 Sonnet | `2024-06-01` | 2024-04 | Default `claude-3-5-sonnet-20241022` snapshot |
| Claude 3.5 Haiku | `2024-10-01` | 2024-07 | Fast, low-latency family |
| Claude 4 Opus | `2025-02-01` | 2024-11 | Extended thinking available |

Use `anthropic_version` in the provider request to pin a behavior version:

```json
{
  "model": "anthropic/claude-3-5-sonnet-20241022",
  "anthropic_version": "2024-06-01"
}
```

### OpenAI

| Model family | System prompt version | Knowledge cutoff | Notes |
|--------------|-----------------------|------------------|-------|
| GPT-4o | `2024-08-06` | 2023-10 | Supports structured outputs |
| GPT-4o-mini | `2024-07-18` | 2023-10 | Cost-optimized |
| o3-mini | `2025-01-31` | 2023-10 | Reasoning model; use `reasoning_effort` |

OpenAI does not expose a system-prompt version header. Pin behavior by selecting a dated model snapshot.

### Kimi

| Model family | System prompt version | Knowledge cutoff | Notes |
|--------------|-----------------------|------------------|-------|
| Kimi K2.6 | `2025-04-01` | 2025-03 | `thinking` parameter controls reasoning |
| Kimi K3 | `2025-06-01` | 2025-05 | `reasoning_effort` mapped automatically |

## Changelog policy

1. **Provider announces a change** — We add a row within 5 business days.
2. **Breaking behavior** — Documented in `docs/public/release-notes.md` and cross-linked here.
3. **Deprecated versions** — Kept for 90 days with a migration note, then moved to `docs/public/guides/model-migration.md`.
4. **BYOC / local models** — Version is whatever you deploy; Allternit forwards your instructions unchanged.

## How to query versions at runtime

```bash
gizzi models get anthropic/claude-3-5-sonnet-20241022 --field system_prompt_version
```

Or via the API:

```bash
curl https://api.allternit.com/v1/models/anthropic/claude-3-5-sonnet-20241022 \
  -H "Authorization: Bearer $ALLTERNIT_API_KEY"
```

The response includes `system_prompt_version`, `knowledge_cutoff`, and any deprecation metadata.

## Related pages

- [Model migration guide](./guides/model-migration.md)
- [Release notes](./release-notes.md)
- [Glossary](./glossary.md)
