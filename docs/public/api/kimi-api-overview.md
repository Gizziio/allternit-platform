# Kimi API overview

Allternit's platform provides an OpenAI-compatible API that also supports Kimi-style parameters such as `thinking`, `reasoning_effort`, `response_format`, and tool calling. If you are migrating from the Kimi API, you can use your existing request shapes with minimal changes.

## Base URL

```
https://api.allternit.com/v1
```

## Authentication

Pass your Allternit API key in the `Authorization` header:

```bash
curl https://api.allternit.com/v1/chat/completions \
  -H "Authorization: Bearer $ALLTERNIT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "kimi/kimi-k2.6", "messages": [{"role": "user", "content": "Hello"}]}'
```

## Supported endpoints

- `POST /v1/chat/completions`
- `POST /v1/completions`
- `POST /v1/embeddings`
- `POST /v1/files`
- `GET /v1/files/:id`
- `DELETE /v1/files/:id`
- `POST /v1/batches`
- `GET /v1/batches/:id`
- `POST /v1/batches/:id/cancel`
- `POST /v1/tokens`

## Error codes

| Status | Meaning |
|---|---|
| 400 | Invalid request |
| 401 | Authentication error |
| 403 | Permission error |
| 404 | Resource not found |
| 429 | Rate limit or quota exceeded |
| 499/500/503/504 | Connection or server error |

## SDK installation

Install the Allternit SDK:

```bash
npm install @allternit/sdk
# or
bun add @allternit/sdk
```

Or use any OpenAI-compatible SDK and point it at `https://api.allternit.com/v1`.

## Prepare an API key

Create a virtual key in the Allternit admin console or with the `allternit admin` CLI. Every request must send that key as a Bearer token:

```bash
curl https://api.allternit.com/v1/models \
  -H "Authorization: Bearer $ALLTERNIT_API_KEY"
```

Keys can be scoped to specific models, workspaces, and rate limits.

## Install an OpenAI-compatible SDK

Because the Allternit API is OpenAI-compatible at `/v1`, you can use the official OpenAI SDK and only change the base URL:

```bash
pip install openai
```

```python
from openai import OpenAI
client = OpenAI(base_url="https://api.allternit.com/v1", api_key=os.environ["ALLTERNIT_API_KEY"])
```

Or use the Allternit SDKs:

```bash
npm install @allternit/sdk
pip install allternit
```

## Parse SSE responses without an SDK

When `stream: true`, the gateway returns `text/event-stream` frames. Each non-empty `data:` line is a JSON chunk; the stream ends with `data: [DONE]`:

```python
import json, requests
resp = requests.post("https://api.allternit.com/v1/chat/completions", headers={...}, json={"stream": True}, stream=True)
for line in resp.iter_lines():
    if line.startswith(b"data: "):
        payload = line[6:].decode()
        if payload == "[DONE]": break
        chunk = json.loads(payload)
        print(chunk["choices"][0]["delta"].get("content", ""), end="")
```

## Handle 429 errors

A `429 Too Many Requests` response means you hit a rate or spend limit. The response includes a standard OpenAI error envelope with code `allternit.rate_limited`. Back off exponentially and retry, or request a limit increase via `GET /v1/rate-limits`.

## Recommended parameters and notes

For best results with Kimi models through Allternit:

- Use `temperature: 0.1–0.3` for deterministic outputs and `0.7–1.0` for creative tasks.
- Leave `max_tokens` unset to use the model registry default, or set it explicitly to avoid truncation.
- Use `response_format` for JSON/structured output instead of parsing free text.
- Enable `reasoning_effort` for reasoning models (`kimi-k2.6`, `kimi-k2.7-code`).
- Use `tool_choice: "auto"` when you want the model to decide whether to call tools.

## Verify the OpenAI SDK version

After installing the OpenAI SDK, confirm it is available:

```bash
python -c "import openai; print(openai.__version__)"
```

The printed version (for example `1.10.0`) confirms the SDK is installed and will be used by your Python code.

## Related pages

- [Kimi tool calling](./kimi-tool-calling.md)
- [Kimi reasoning and thinking](./kimi-reasoning.md)
- [Kimi JSON Mode](./kimi-json-mode.md)
