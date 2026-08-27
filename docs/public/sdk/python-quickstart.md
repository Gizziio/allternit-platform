# Python SDK quickstart

The `allternit` package provides a provider-agnostic harness for AI completions
in Python. The same `Harness` class works in BYOK, cloud, and local modes.

## Install

```bash
pip install allternit
```

## First chat completion

```python
import asyncio
import os
from allternit import Harness, Message, StreamRequest

async def main():
    harness = Harness(
        mode="byok",
        byok={"anthropic": {"api_key": os.environ["ANTHROPIC_API_KEY"]}},
    )
    request = StreamRequest(
        provider="anthropic",
        model="claude-3-5-sonnet-20241022",
        messages=[Message(role="user", content="What is the capital of France?")],
    )
    response = await harness.complete(request)
    print(response["content"])

asyncio.run(main())
```

`complete()` returns a response dict with `content`, optional `tool_calls`,
`usage`, and `stop_reason`.

## Tool use

```python
import asyncio
import os
from allternit import Harness, Message, StreamRequest, Tool

async def main():
    harness = Harness(
        mode="byok",
        byok={"anthropic": {"api_key": os.environ["ANTHROPIC_API_KEY"]}},
    )
    weather_tool = Tool(
        name="get_weather",
        description="Get the current weather for a city",
        parameters={
            "type": "object",
            "properties": {
                "city": {"type": "string", "description": "City name"},
            },
            "required": ["city"],
        },
    )
    request = StreamRequest(
        provider="anthropic",
        model="claude-3-5-sonnet-20241022",
        messages=[Message(role="user", content="What is the weather in Paris?")],
        tools=[weather_tool],
    )
    async for chunk in harness.stream(request):
        if chunk["type"] == "text":
            print(chunk["text"], end="")
        elif chunk["type"] == "tool_call":
            print(f"\nTool call: {chunk['name']}({chunk['arguments']})")
        elif chunk["type"] == "tool_call_complete":
            print(f"\nCompleted tool call: {chunk['name']}", chunk["arguments"])
        elif chunk["type"] == "done":
            print("\nUsage:", chunk.get("usage"))

asyncio.run(main())
```

## Streaming

```python
import asyncio
import os
from allternit import Harness, Message, StreamRequest

async def main():
    harness = Harness(
        mode="byok",
        byok={"anthropic": {"api_key": os.environ["ANTHROPIC_API_KEY"]}},
    )
    request = StreamRequest(
        provider="anthropic",
        model="claude-3-5-sonnet-20241022",
        messages=[Message(role="user", content="Write a haiku about Python.")],
    )
    async for chunk in harness.stream(request):
        if chunk["type"] == "text":
            print(chunk["text"], end="")
        elif chunk["type"] == "done":
            print("\n\nUsage:", chunk.get("usage"))

asyncio.run(main())
```

## Modes

| Mode     | Configuration                                    |
| -------- | ------------------------------------------------ |
| `byok`   | Use your own provider API keys.                  |
| `cloud`  | Connect to Allternit's managed cloud service.    |
| `local`  | Connect to a local model server such as Ollama.  |

BYOK mode currently supports streaming completions for `anthropic`, `openai`,
and `kimi`. Other providers expose the same interface and are wired through the
harness routing layer.

## Provider request mapping

The SDK exposes the same request transforms used by the TypeScript SDK:

```python
from allternit import StreamRequest, Message, to_anthropic_request, to_openai_request

request = StreamRequest(
    provider="anthropic",
    model="claude-3-5-sonnet-20241022",
    messages=[Message(role="user", content="Hello")],
)
print(to_anthropic_request(request))
print(to_openai_request(request))
```

Transforms handle prompt caching (`cache_control`), reasoning / thinking,
JSON-schema response formats, and tool definitions.

## Error handling

The SDK raises `HarnessError` for configuration, authentication, provider, and
network issues:

```python
from allternit import HarnessError

try:
    async for chunk in harness.stream(request):
        ...
except HarnessError as exc:
    print(exc.code, exc)
```
