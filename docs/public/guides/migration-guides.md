# Migration guides

Allternit is designed as the alternative to locked-in AI vendors. These guides show how to move an existing integration from another platform to Allternit while preserving behavior.

## Provider migrations

- [Migrating from Anthropic](./migration-from-anthropic.md) — Messages API, thinking, tool use, computer use, and prompt caching.
- [Migrating from OpenAI](./migration-from-openai.md) — Chat Completions, batch API, function calling, and structured outputs.

## Coming soon

- Migrating from Kimi (Moonshot AI) — reasoning parameters, JSON mode, and tool calls.
- Migrating from Google Vertex AI / Gemini — system instructions, multi-turn context, and citation handling.

## Model-to-model migration

When a provider deprecates or renames a model:

1. Check the [provider parity matrix](../providers/parity-matrix.md) for the recommended Allternit alias or explicit `provider/model` replacement.
2. Use the routing policy aliases (`auto`, `allternit-balanced`, `allternit-code`, `allternit-reasoning`, `allternit-knowledge`, `allternit-instruct`) to let the gateway pick the best currently-connected model.
3. Review the [model registry](../providers/provider-registry.md) for context-window and max-output limits.

## SDK migrations

- TypeScript SDK: follow the [TypeScript quickstart](../sdk/typescript-quickstart.md).
- Python SDK: follow the [Python quickstart](../sdk/python-quickstart.md).

## CLI migrations

If you are moving from `anthropic` CLI or Codex to `gizzi-code`:

- `gizzi auth profile` replaces per-tool API-key configuration.
- `gizzi config profile` replaces sandbox and permission presets.
- `gizzi exec` runs a headless agent command analogous to `codex` or `claude code` non-interactive mode.

For details, see the [`gizzi` documentation](../gizzi/index.md).
