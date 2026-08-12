:# OSS mode and local providers

`gizzi-code` can run against local, self-hosted, or open-source inference servers instead of cloud APIs. This is useful for air-gapped environments, privacy-sensitive workflows, or when you want to use models you host yourself.

## Supported local servers

Any OpenAI-compatible local server should work, including:

- [Ollama](https://ollama.com/) with `--base-url http://localhost:11434/v1`
- [vLLM](https://docs.vllm.ai/)
- [mlx_lm.server](https://github.com/ml-explore/mlx-examples)
- [llama.cpp server](https://github.com/ggerganov/llama.cpp/blob/master/examples/server/README.md)
- Any custom endpoint that implements `/v1/chat/completions` and `/v1/models`

## Configure a local provider

Add a profile that points at your local server:

```bash
gizzi auth login --api-key --provider openai-compatible --profile local
```

When prompted, enter any value for the API key (many local servers ignore it). Then edit `~/.config/gizzi-code/config.toml`:

```toml
[auth]
active_profile = "local"

[auth.profiles.local]
provider = "openai-compatible"
api_key = "not-used"
base_url = "http://localhost:11434/v1"
```

Or use an environment variable for the key:

```toml
[auth.profiles.local]
provider = "openai-compatible"
api_key_env = "LOCAL_API_KEY"
base_url = "http://localhost:11434/v1"
```

## Select a local model

Local servers often expose model ids that differ from the short names you configure. `gizzi-code` calls `/v1/models` on the local server and, when possible, resolves the first advertised model id automatically. If the server does not implement `/v1/models`, the configured model id is sent as-is.

Set the model in config or on the CLI:

```bash
gizzi --model openai-compatible/llama3.2 --base-url http://localhost:11434/v1 "hello"
```

## Disable cloud providers

To run entirely offline, disable the built-in cloud providers in your user config:

```toml
disabled_providers = ["anthropic", "openai", "google", "kimi"]
```

Then ensure `enabled_providers` is unset or lists only your local provider:

```toml
enabled_providers = ["openai-compatible"]
```

## Limitations

- Local providers may not support all features (vision, reasoning, tool use, PDF input). Feature availability depends on the server and model.
- Some local servers require a non-empty API key even though it is not validated.
- Streaming, token usage, and finish-reason behavior vary by server implementation.

## Privacy and self-hosting

Running locally keeps prompts and outputs on your machine. No data is sent to Allternit model providers unless you explicitly configure a cloud profile or enable telemetry.

## Related pages

- [Sign in with an API key](./auth-api-key.md)
- [Credential storage](./credential-store.md)
- [Advanced configuration](./advanced-configuration.md)
