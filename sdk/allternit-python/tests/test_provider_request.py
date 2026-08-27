import pytest

from allternit import (
    CacheControl,
    JsonSchemaResponseFormat,
    Message,
    ReasoningConfig,
    StreamRequest,
    Tool,
    map_stop_reason,
    parse_openai_usage,
    to_anthropic_request,
    to_kimi_request,
    to_openai_request,
)

PDF_BASE64 = (
    "JVBERi0xLjQKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoK"
    "PDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUl0gL0NvdW50IDEgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUg"
    "L1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCA2MTIgNzkyXSAvQ29udGVudHMgNCAwIFIgPj4KZW5k"
    "b2JqCjQgMCBvYmoKPDwgL0xlbmd0aCA0NCA+PgpzdHJlYW0KQlQKL0YxIDEyIFRmCjEwMCA3MDAgVGQKKEhlbGxv"
    "IFBERikgVGoKRVQKZW5kc3RyZWFtCmVuZG9iagoKeHJlZgowIDUKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAw"
    "MDA5IDAwMDAwIG4gCjAwMDAwMDAwNTggMDAwMDAgbiAKMDAwMDAwMDExNSAwMDAwMCBuIAowMDAwMDAwMjE0IDAw"
    "MDAwIG4gCnRyYWlsZXIKPDwgL1NpemUgNSAvUm9vdCAxIDAgUiA+CnN0YXJ0eHJlZgozMDkKJSVFT0YK"
)


BASE_REQUEST = StreamRequest(
    provider="openai",
    model="gpt-4",
    messages=[Message(role="user", content="Hello")],
)


def test_map_stop_reason_anthropic():
    assert map_stop_reason("anthropic", "end_turn") == "end_turn"
    assert map_stop_reason("anthropic", "max_tokens") == "max_tokens"
    assert map_stop_reason("anthropic", "stop_sequence") == "stop_sequence"
    assert map_stop_reason("anthropic", "tool_use") == "tool_use"
    assert map_stop_reason("anthropic", "tool_calls") == "tool_use"


def test_map_stop_reason_openai():
    assert map_stop_reason("openai", "stop") == "end_turn"
    assert map_stop_reason("openai", "length") == "max_tokens"
    assert map_stop_reason("openai", "tool_calls") == "tool_use"
    assert map_stop_reason("openai", "function_call") == "tool_use"
    assert map_stop_reason("openai", "content_filter") == "refusal"


def test_map_stop_reason_unknown():
    assert map_stop_reason("openai", None) is None
    assert map_stop_reason("anthropic", None) is None
    assert map_stop_reason("openai", "unknown_reason") is None


def test_to_openai_request_tools_and_tool_choice():
    tool = Tool(name="get_weather", description="Get weather", parameters={"type": "object", "properties": {}})
    body = to_openai_request(
        StreamRequest(
            **{**BASE_REQUEST.__dict__, "tools": [tool], "tool_choice": {"name": "get_weather"}}
        )
    )
    assert body["tools"] == [
        {
            "type": "function",
            "function": {
                "name": "get_weather",
                "description": "Get weather",
                "parameters": {"type": "object", "properties": {}},
            },
        }
    ]
    assert body["tool_choice"] == {"type": "function", "function": {"name": "get_weather"}}
    assert "functions" not in body
    assert "function_call" not in body


def test_to_openai_request_legacy_functions():
    fn = {"name": "get_weather", "description": "Get weather", "parameters": {"type": "object", "properties": {}}}
    body = to_openai_request(
        StreamRequest(**{**BASE_REQUEST.__dict__, "functions": [fn], "tool_choice": {"name": "get_weather"}})
    )
    assert body["functions"] == [fn]
    assert body["function_call"] == {"name": "get_weather"}
    assert "tools" not in body
    assert "tool_choice" not in body


def test_to_openai_request_function_call_required():
    fn = {"name": "foo", "description": "bar", "parameters": {"type": "object"}}
    body = to_openai_request(StreamRequest(**{**BASE_REQUEST.__dict__, "functions": [fn], "tool_choice": "required"}))
    assert body["function_call"] == "auto"


def test_to_openai_request_omits_response_format():
    body = to_openai_request(BASE_REQUEST)
    assert "response_format" not in body


def test_to_openai_request_reasoning_effort():
    body = to_openai_request(
        StreamRequest(**{**BASE_REQUEST.__dict__, "reasoning": ReasoningConfig(effort="high")})
    )
    assert body["reasoning_effort"] == "high"


def test_to_openai_request_service_tier_flex_for_message_cache():
    body = to_openai_request(
        StreamRequest(
            **{
                **BASE_REQUEST.__dict__,
                "messages": [Message(role="user", content="Hello", cache_control=CacheControl())],
            }
        )
    )
    assert body["service_tier"] == "flex"
    assert "cache_control" not in body["messages"][0]


def test_to_openai_request_service_tier_flex_for_tool_cache():
    tool = Tool(
        name="get_weather",
        description="Get weather",
        parameters={"type": "object", "properties": {}},
        cache_control=CacheControl(),
    )
    body = to_openai_request(StreamRequest(**{**BASE_REQUEST.__dict__, "tools": [tool]}))
    assert body["service_tier"] == "flex"


def test_to_openai_request_no_service_tier_without_cache():
    body = to_openai_request(BASE_REQUEST)
    assert "service_tier" not in body


def test_to_openai_request_vision_blocks():
    body = to_openai_request(
        StreamRequest(
            **{
                **BASE_REQUEST.__dict__,
                "messages": [
                    Message(
                        role="user",
                        content=[
                            {"type": "text", "text": "What is this?"},
                            {"type": "vision", "source": {"type": "url", "url": "https://example.com/image.png"}},
                            {
                                "type": "vision",
                                "source": {"type": "base64", "media_type": "image/png", "data": "abc123"},
                            },
                            {"type": "vision_coordinates", "x": 100, "y": 200},
                        ],
                    )
                ],
            }
        )
    )
    assert body["messages"] == [
        {
            "role": "user",
            "content": [
                {"type": "text", "text": "What is this?"},
                {"type": "image_url", "image_url": {"url": "https://example.com/image.png"}},
                {"type": "image_url", "image_url": {"url": "data:image/png;base64,abc123"}},
                {"type": "text", "text": "[vision_coordinates: 100, 200]"},
            ],
        }
    ]


def test_to_openai_request_pdf_base64():
    body = to_openai_request(
        StreamRequest(
            **{
                **BASE_REQUEST.__dict__,
                "messages": [
                    Message(
                        role="user",
                        content=[{"type": "pdf", "source": "base64", "data": PDF_BASE64, "title": "sample.pdf"}],
                    )
                ],
            }
        )
    )
    text = body["messages"][0]["content"][0]["text"]
    assert "[sample.pdf]" in text
    assert "Hello PDF" in text


def test_to_openai_request_pdf_url():
    body = to_openai_request(
        StreamRequest(
            **{
                **BASE_REQUEST.__dict__,
                "messages": [
                    Message(
                        role="user",
                        content=[{"type": "pdf", "source": "url", "url": "https://example.com/doc.pdf"}],
                    )
                ],
            }
        )
    )
    assert body["messages"][0]["content"] == [
        {"type": "text", "text": "[PDF document: https://example.com/doc.pdf]"}
    ]


def test_parse_openai_usage_cached():
    usage = parse_openai_usage(
        {
            "prompt_tokens": 100,
            "completion_tokens": 20,
            "total_tokens": 120,
            "prompt_tokens_details": {"cached_tokens": 40},
        }
    )
    assert usage == {
        "promptTokens": 100,
        "completionTokens": 20,
        "totalTokens": 120,
        "cachedTokens": 40,
    }


def test_parse_openai_usage_no_cache():
    usage = parse_openai_usage({"prompt_tokens": 100, "completion_tokens": 20, "total_tokens": 120})
    assert usage == {"promptTokens": 100, "completionTokens": 20, "totalTokens": 120}
    assert "cachedTokens" not in usage


def test_to_anthropic_request_tools():
    tool = Tool(name="get_weather", description="Get weather", parameters={"type": "object", "properties": {}})
    body = to_anthropic_request(
        StreamRequest(**{**BASE_REQUEST.__dict__, "provider": "anthropic", "tools": [tool]})
    )
    assert body["tools"] == [
        {
            "name": "get_weather",
            "description": "Get weather",
            "input_schema": {"type": "object", "properties": {}},
        }
    ]


def test_to_anthropic_request_tool_cache_control():
    tool = Tool(
        name="get_weather",
        description="Get weather",
        parameters={"type": "object", "properties": {}},
        cache_control=CacheControl(),
    )
    body = to_anthropic_request(
        StreamRequest(**{**BASE_REQUEST.__dict__, "provider": "anthropic", "tools": [tool]})
    )
    assert body["tools"][0]["cache_control"] == {"type": "ephemeral"}


def test_to_anthropic_request_tool_choice_object():
    body = to_anthropic_request(
        StreamRequest(
            **{
                **BASE_REQUEST.__dict__,
                "provider": "anthropic",
                "tools": [Tool(name="get_weather", description="x", parameters={"type": "object"})],
                "tool_choice": {"name": "get_weather"},
            }
        )
    )
    assert body["tool_choice"] == {"type": "tool", "name": "get_weather"}


def test_to_anthropic_request_tool_choice_required():
    body = to_anthropic_request(
        StreamRequest(**{**BASE_REQUEST.__dict__, "provider": "anthropic", "tool_choice": "required"})
    )
    assert body["tool_choice"] == {"type": "any"}


def test_to_anthropic_request_search_result():
    body = to_anthropic_request(
        StreamRequest(
            **{
                **BASE_REQUEST.__dict__,
                "provider": "anthropic",
                "messages": [
                    Message(
                        role="user",
                        content=[
                            {"type": "text", "text": "What is Allternit?"},
                            {
                                "type": "search_result",
                                "title": "Allternit Docs",
                                "url": "https://docs.allternit.com",
                                "content": "Allternit is an AI governance and workflow system.",
                                "score": 0.95,
                            },
                        ],
                    )
                ],
            }
        )
    )
    content = body["messages"][0]["content"]
    assert len(content) == 2
    assert content[0] == {"type": "text", "text": "What is Allternit?"}
    assert content[1]["type"] == "text"
    assert '[search_result title="Allternit Docs" url="https://docs.allternit.com" score=0.95]' in content[1]["text"]
    assert "Allternit is an AI governance and workflow system." in content[1]["text"]
    assert "[/search_result]" in content[1]["text"]


def test_to_anthropic_request_vision_blocks():
    body = to_anthropic_request(
        StreamRequest(
            **{
                **BASE_REQUEST.__dict__,
                "provider": "anthropic",
                "messages": [
                    Message(
                        role="user",
                        content=[
                            {"type": "text", "text": "What is this?"},
                            {"type": "vision", "source": {"type": "url", "url": "https://example.com/image.png"}},
                            {
                                "type": "vision",
                                "source": {"type": "base64", "media_type": "image/png", "data": "abc123"},
                            },
                            {"type": "vision_coordinates", "x": 100, "y": 200},
                        ],
                    )
                ],
            }
        )
    )
    assert body["messages"] == [
        {
            "role": "user",
            "content": [
                {"type": "text", "text": "What is this?"},
                {"type": "image", "source": {"type": "url", "url": "https://example.com/image.png"}},
                {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": "abc123"}},
                {"type": "text", "text": "[vision_coordinates: 100, 200]"},
            ],
        }
    ]


def test_to_anthropic_request_system_vision_flattened():
    body = to_anthropic_request(
        StreamRequest(
            **{
                **BASE_REQUEST.__dict__,
                "provider": "anthropic",
                "messages": [
                    Message(
                        role="system",
                        content=[
                            {"type": "text", "text": "You are helpful."},
                            {"type": "vision", "source": {"type": "url", "url": "https://example.com/image.png"}},
                        ],
                    )
                ],
            }
        )
    )
    assert body["system"] == [{"type": "text", "text": "You are helpful.\n[image]"}]


def test_to_anthropic_request_pdf_base64():
    body = to_anthropic_request(
        StreamRequest(
            **{
                **BASE_REQUEST.__dict__,
                "provider": "anthropic",
                "messages": [
                    Message(
                        role="user",
                        content=[{"type": "pdf", "source": "base64", "data": PDF_BASE64, "title": "sample.pdf"}],
                    )
                ],
            }
        )
    )
    assert body["messages"][0]["content"] == [
        {
            "type": "document",
            "source": {"type": "base64", "media_type": "application/pdf", "data": PDF_BASE64},
        }
    ]


def test_to_anthropic_request_pdf_file_id():
    body = to_anthropic_request(
        StreamRequest(
            **{
                **BASE_REQUEST.__dict__,
                "provider": "anthropic",
                "messages": [
                    Message(
                        role="user",
                        content=[{"type": "pdf", "source": "file_id", "fileId": "file_123", "title": "uploaded.pdf"}],
                    )
                ],
            }
        )
    )
    assert body["messages"][0]["content"] == [
        {"type": "text", "text": "[uploaded.pdf: file_id=file_123]"}
    ]


def test_to_anthropic_request_tool_result_with_cache():
    body = to_anthropic_request(
        StreamRequest(
            **{
                **BASE_REQUEST.__dict__,
                "provider": "anthropic",
                "messages": [
                    Message(
                        role="user",
                        content=[
                            {
                                "type": "tool_result",
                                "tool_use_id": "call_1",
                                "content": "Large result payload",
                                "cache_control": {"type": "ephemeral"},
                            }
                        ],
                    )
                ],
            }
        )
    )
    assert body["messages"][0]["content"] == [
        {
            "type": "tool_result",
            "tool_use_id": "call_1",
            "content": "Large result payload",
            "cache_control": {"type": "ephemeral"},
        }
    ]


def test_to_kimi_request_uses_thinking():
    body = to_kimi_request(
        StreamRequest(
            **{
                **BASE_REQUEST.__dict__,
                "provider": "kimi",
                "reasoning": ReasoningConfig(enabled=True, budget_tokens=1024),
            }
        )
    )
    assert "reasoning_effort" not in body
    assert body["thinking"] == {"type": "enabled", "budget_tokens": 1024}
