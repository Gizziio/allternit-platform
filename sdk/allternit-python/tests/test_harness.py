import asyncio
import json

import pytest

from allternit import Harness, HarnessError, Message, StreamRequest


def _sse_events(*events):
    text = "\n\n".join(f"data: {json.dumps(e)}" for e in events) + "\n\n"

    class MockResponse:
        def __init__(self):
            self.status_code = 200
            self.is_success = True
            self.is_error = False

        async def aiter_text(self):
            yield text

        @property
        def text(self):
            return ""

    return MockResponse()


def test_harness_requires_mode():
    with pytest.raises(HarnessError) as exc_info:
        Harness(mode="")
    assert exc_info.value.code == "CONFIG_INVALID"


def test_harness_rejects_unknown_mode():
    with pytest.raises(HarnessError) as exc_info:
        Harness(mode="subprocess")
    assert exc_info.value.code == "MODE_UNSUPPORTED"


def test_harness_byok_requires_provider_key():
    with pytest.raises(HarnessError) as exc_info:
        Harness(mode="byok", byok={})
    assert exc_info.value.code == "CONFIG_INVALID"

    with pytest.raises(HarnessError) as exc_info:
        Harness(mode="byok", byok={"anthropic": {}})
    assert exc_info.value.code == "CONFIG_INVALID"


def test_harness_cloud_requires_credentials():
    with pytest.raises(HarnessError) as exc_info:
        Harness(mode="cloud")
    assert exc_info.value.code == "CONFIG_INVALID"


def test_harness_local_requires_base_url():
    with pytest.raises(HarnessError) as exc_info:
        Harness(mode="local")
    assert exc_info.value.code == "CONFIG_INVALID"


def test_stream_yields_text_and_done():
    async def _run():
        harness = Harness(mode="byok", byok={"anthropic": {"api_key": "test-key"}})

        async def _mock_post(*args, **kwargs):
            return _sse_events(
                {"type": "message_start", "message": {"usage": {"input_tokens": 10}}},
                {"type": "content_block_delta", "delta": {"type": "text_delta", "text": "Hello"}},
                {"type": "content_block_delta", "delta": {"type": "text_delta", "text": " world"}},
                {"type": "message_delta", "usage": {"output_tokens": 5}},
                {"type": "message_stop"},
            )

        harness._client.post = _mock_post

        request = StreamRequest(
            provider="anthropic",
            model="claude-test",
            messages=[Message(role="user", content="Hi")],
        )
        chunks = []
        async for chunk in harness.stream(request):
            chunks.append(chunk)

        text_chunks = [c for c in chunks if c["type"] == "text"]
        done_chunks = [c for c in chunks if c["type"] == "done"]
        assert text_chunks == [{"type": "text", "text": "Hello"}, {"type": "text", "text": " world"}]
        assert len(done_chunks) == 1
        assert done_chunks[0]["usage"] == {
            "promptTokens": 10,
            "completionTokens": 5,
            "totalTokens": 15,
        }

    asyncio.run(_run())


def test_complete_returns_response_dict():
    async def _run():
        harness = Harness(mode="byok", byok={"anthropic": {"api_key": "test-key"}})

        async def _mock_post(*args, **kwargs):
            return _sse_events(
                {"type": "message_start", "message": {"usage": {"input_tokens": 3}}},
                {"type": "content_block_delta", "delta": {"type": "text_delta", "text": "Hi!"}},
                {"type": "message_delta", "usage": {"output_tokens": 2}, "delta": {"stop_reason": "end_turn"}},
                {"type": "message_stop"},
            )

        harness._client.post = _mock_post

        request = StreamRequest(
            provider="anthropic",
            model="claude-test",
            messages=[Message(role="user", content="Hi")],
        )
        response = await harness.complete(request)
        assert response["content"] == "Hi!"
        assert response["usage"] == {"promptTokens": 3, "completionTokens": 2, "totalTokens": 5}
        assert response["stop_reason"] == "end_turn"

    asyncio.run(_run())


def test_stream_requires_provider_and_model():
    async def _run():
        harness = Harness(mode="byok", byok={"anthropic": {"api_key": "test-key"}})
        with pytest.raises(HarnessError) as exc_info:
            async for _ in harness.stream(StreamRequest(provider="", model="x", messages=[])):
                pass
        assert exc_info.value.code == "CONFIG_INVALID"

    asyncio.run(_run())


def test_stream_missing_api_key():
    async def _run():
        harness = Harness(mode="byok", byok={"openai": {"api_key": "set-to-pass-init"}})
        harness.byok["openai"]["api_key"] = ""
        with pytest.raises(HarnessError) as exc_info:
            async for _ in harness.stream(
                StreamRequest(provider="openai", model="gpt-4", messages=[Message(role="user", content="Hi")])
            ):
                pass
        assert exc_info.value.code == "AUTHENTICATION_ERROR"

    asyncio.run(_run())
