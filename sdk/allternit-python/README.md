# allternit

Python SDK parity layer for the Allternit AI harness.

## Quick start

```python
import asyncio
from allternit import Harness, Message, StreamRequest

async def main():
    harness = Harness(
        mode="byok",
        byok={"anthropic": {"api_key": "sk-ant-..."}},
    )
    request = StreamRequest(
        provider="anthropic",
        model="claude-sonnet-4-20250514",
        messages=[Message(role="user", content="Hello!")],
    )
    async for chunk in harness.stream(request):
        print(chunk)

asyncio.run(main())
```
