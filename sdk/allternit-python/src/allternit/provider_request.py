from __future__ import annotations

import base64
import json
import re
from dataclasses import asdict
from typing import Any, Dict, List, Optional

from .types import (
    CacheControl,
    JsonSchemaResponseFormat,
    Message,
    ReasoningConfig,
    StreamRequest,
    Tool,
)


def _to_dict(value: Any) -> Any:
    if isinstance(value, list):
        return [_to_dict(v) for v in value]
    if isinstance(value, dict):
        return {k: _to_dict(v) for k, v in value.items()}
    if isinstance(value, (str, int, float, bool, type(None))):
        return value
    try:
        return asdict(value)
    except TypeError:
        return value


def compact(value: Dict[str, Any]) -> Dict[str, Any]:
    return {k: v for k, v in value.items() if v is not None}


def cache_marker(
    value: Dict[str, Any],
    fallback: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    cc = value.get("cache_control") or fallback
    if not cc and value.get("cache"):
        cc = {"type": "ephemeral"}
    if cc:
        cc = {k: v for k, v in cc.items() if v is not None}
    return {"cache_control": cc} if cc else {}


def map_stop_reason(provider: str, raw: Optional[str]) -> Optional[str]:
    if not raw:
        return None
    value = raw.lower().replace("-", "_").replace(" ", "_")
    if provider == "anthropic":
        if value == "end_turn":
            return "end_turn"
        if value == "max_tokens":
            return "max_tokens"
        if value == "stop_sequence":
            return "stop_sequence"
        if value in ("tool_use", "tool_calls"):
            return "tool_use"
    if provider == "openai":
        if value == "stop":
            return "end_turn"
        if value == "length":
            return "max_tokens"
        if value in ("tool_calls", "function_call"):
            return "tool_use"
        if value == "content_filter":
            return "refusal"
    return None


def has_cache_control(request: Dict[str, Any]) -> bool:
    for message in request.get("messages", []):
        if message.get("cache_control") or message.get("cache"):
            return True
        content = message.get("content")
        if isinstance(content, list):
            for block in content:
                if block and block.get("type") == "tool_result" and (
                    block.get("cache_control") or block.get("cache")
                ):
                    return True
    for tool in request.get("tools") or []:
        if tool.get("cache_control") or tool.get("cache"):
            return True
    return False


def _search_result_text(block: Dict[str, Any]) -> str:
    score_suffix = f" score={block['score']}" if block.get("score") is not None else ""
    return (
        f'[search_result title="{block["title"]}" url="{block["url"]}"{score_suffix}]\n'
        f"{block['content']}\n"
        "[/search_result]"
    )


def _unescape_pdf_string(s: str) -> str:
    s = s.replace("\\\\", "\\")
    s = s.replace("\\n", "\n")
    s = s.replace("\\r", "\r")
    s = s.replace("\\t", "\t")
    s = s.replace("\\(", "(")
    s = s.replace("\\)", ")")
    s = re.sub(r"\\([0-7]{1,3})", lambda m: chr(int(m.group(1), 8)), s)
    return s


def extract_pdf_text(base64_data: str) -> str:
    try:
        raw = base64.b64decode(base64_data).decode("latin-1")
    except Exception:
        return "[PDF: could not decode base64 data]"

    fragments: List[str] = []
    for match in re.finditer(r"\(([^)]{2,})\)", raw):
        text = _unescape_pdf_string(match.group(1)).strip()
        if text:
            fragments.append(text)

    for match in re.finditer(r"<([0-9A-Fa-f\s]{4,})>", raw):
        hex_str = match.group(1).replace(" ", "").replace("\n", "")
        try:
            decoded = "".join(
                chr(int(hex_str[i : i + 2], 16)) for i in range(0, len(hex_str), 2)
            )
            if re.search(r"[A-Za-z0-9\s]{2,}", decoded):
                fragments.append(decoded)
        except Exception:
            continue

    deduped = [v for i, v in enumerate(fragments) if i == 0 or v != fragments[i - 1]]
    return "\n".join(deduped).strip()


def flatten_pdf_to_text(block: Dict[str, Any]) -> str:
    title = block.get("title") or "PDF document"
    source = block.get("source")
    parts: List[str] = []

    if source == "base64" and block.get("data"):
        parts.append(f"[{title}]")
        text = extract_pdf_text(block["data"])
        parts.append(text if text else "[PDF text could not be extracted]")
    elif source == "url" and block.get("url"):
        parts.append(f"[{title}: {block['url']}]")
    elif source == "file_id" and block.get("fileId"):
        parts.append(f"[{title}: file_id={block['fileId']}]")
    else:
        parts.append(f"[{title}]")

    return "\n".join(parts)


def openai_content_block(block: Dict[str, Any]) -> Dict[str, Any]:
    bt = block.get("type")
    if bt == "text":
        return {"type": "text", "text": block.get("text", "")}
    if bt == "search_result":
        return {"type": "text", "text": _search_result_text(block)}
    if bt == "vision":
        source = block.get("source", {})
        if source.get("type") == "url":
            return {"type": "image_url", "image_url": {"url": source["url"]}}
        return {
            "type": "image_url",
            "image_url": {
                "url": f"data:{source['media_type']};base64,{source['data']}"
            },
        }
    if bt == "vision_coordinates":
        return {
            "type": "text",
            "text": f"[vision_coordinates: {block['x']}, {block['y']}]",
        }
    if bt == "pdf":
        return {"type": "text", "text": flatten_pdf_to_text(block)}
    if bt == "tool_result":
        return {
            "type": "text",
            "text": f"[tool_result:{block['tool_use_id']}] {block['content']}",
        }
    return {"type": "text", "text": ""}


def to_openai_message(message: Dict[str, Any]) -> Dict[str, Any]:
    content = (
        message["content"]
        if isinstance(message["content"], str)
        else [openai_content_block(b) for b in message["content"]]
    )
    rest = {
        k: v
        for k, v in message.items()
        if k not in ("cache", "cache_control", "content") and v is not None
    }
    return {**rest, "content": content}


def _openai_tool(tool: Dict[str, Any]) -> Dict[str, Any]:
    function: Dict[str, Any] = {
        "name": tool["name"],
        "description": tool["description"],
        "parameters": tool["parameters"],
    }
    if tool.get("strict") is not None:
        function["strict"] = tool["strict"]
    return {"type": "function", "function": function}


def _openai_tool_choice(choice: Any) -> Any:
    if isinstance(choice, dict):
        return {"type": "function", "function": {"name": choice["name"]}}
    return choice


def _openai_function(fn: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "name": fn["name"],
        "description": fn["description"],
        "parameters": fn["parameters"],
    }


def _openai_function_call(choice: Any) -> Any:
    if isinstance(choice, dict):
        return {"name": choice["name"]}
    if choice == "required":
        return "auto"
    return choice


def to_openai_request(request: StreamRequest) -> Dict[str, Any]:
    request = _to_dict(request)
    response_format = None
    rf = request.get("response_format")
    if rf:
        json_schema: Dict[str, Any] = {
            "name": rf.get("name") or "response",
            "schema": rf["schema"],
            "strict": rf.get("strict") if rf.get("strict") is not None else True,
        }
        if rf.get("description"):
            json_schema["description"] = rf["description"]
        response_format = {"type": "json_schema", "json_schema": json_schema}

    use_functions = bool(request.get("functions"))
    tools_part: Dict[str, Any] = {}
    if use_functions:
        tools_part = {
            "functions": [_openai_function(f) for f in request["functions"]],
            "function_call": _openai_function_call(request.get("tool_choice")),
        }
    else:
        tools_part = {
            "tools": [_openai_tool(t) for t in request.get("tools") or []],
            "tool_choice": _openai_tool_choice(request.get("tool_choice")),
        }

    return compact(
        {
            "model": request["model"],
            "messages": [to_openai_message(m) for m in request["messages"]],
            "temperature": request.get("temperature"),
            "max_tokens": request.get("max_tokens"),
            "top_p": request.get("top_p"),
            **tools_part,
            "parallel_tool_calls": request.get("parallel_tool_calls"),
            "reasoning_effort": request.get("reasoning", {}).get("effort")
            if request.get("reasoning")
            else None,
            "response_format": response_format,
            "service_tier": "flex" if has_cache_control(request) else None,
            "stream": request.get("stream"),
        }
    )


def parse_openai_usage(usage: Dict[str, Any]) -> Dict[str, Any]:
    prompt_tokens = usage.get("prompt_tokens") if isinstance(usage.get("prompt_tokens"), int) else 0
    completion_tokens = (
        usage.get("completion_tokens") if isinstance(usage.get("completion_tokens"), int) else 0
    )
    total_tokens = usage.get("total_tokens") if isinstance(usage.get("total_tokens"), int) else prompt_tokens + completion_tokens
    prompt_details = usage.get("prompt_tokens_details") or {}
    cached_tokens = prompt_details.get("cached_tokens") if isinstance(prompt_details.get("cached_tokens"), int) else None

    result: Dict[str, Any] = {
        "promptTokens": prompt_tokens,
        "completionTokens": completion_tokens,
        "totalTokens": total_tokens,
    }
    if isinstance(cached_tokens, int) and cached_tokens > 0:
        result["cachedTokens"] = cached_tokens
    return result


def anthropic_content_block(
    block: Dict[str, Any],
    cacheable: Dict[str, Any],
) -> Dict[str, Any]:
    marker = cache_marker(cacheable)
    bt = block.get("type")
    if bt == "text":
        return {"type": "text", "text": block.get("text", ""), **marker}
    if bt == "search_result":
        return {"type": "text", "text": _search_result_text(block), **marker}
    if bt == "vision":
        source = block.get("source", {})
        if source.get("type") == "url":
            return {
                "type": "image",
                "source": {"type": "url", "url": source["url"]},
                **marker,
            }
        return {
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": source["media_type"],
                "data": source["data"],
            },
            **marker,
        }
    if bt == "vision_coordinates":
        return {
            "type": "text",
            "text": f"[vision_coordinates: {block['x']}, {block['y']}]",
            **marker,
        }
    if bt == "pdf":
        if block.get("source") == "base64" and block.get("data"):
            return {
                "type": "document",
                "source": {
                    "type": "base64",
                    "media_type": "application/pdf",
                    "data": block["data"],
                },
                **marker,
            }
        return {"type": "text", "text": flatten_pdf_to_text(block), **marker}
    if bt == "tool_result":
        return compact(
            {
                "type": "tool_result",
                "tool_use_id": block["tool_use_id"],
                "content": block["content"],
                "is_error": block.get("is_error"),
                **cache_marker(block),
            }
        )
    return {"type": "text", "text": "", **marker}


def to_anthropic_message_content(message: Dict[str, Any]) -> List[Dict[str, Any]]:
    if isinstance(message["content"], str):
        return [{"type": "text", "text": message["content"], **cache_marker(message)}]
    return [anthropic_content_block(b, message) for b in message["content"]]


def message_content_text(message: Dict[str, Any]) -> str:
    content = message.get("content")
    if isinstance(content, str):
        return content
    parts: List[str] = []
    for block in content:
        bt = block.get("type")
        if bt == "text":
            parts.append(block.get("text", ""))
        elif bt == "search_result":
            parts.append(_search_result_text(block))
        elif bt == "vision":
            parts.append("[image]")
        elif bt == "vision_coordinates":
            parts.append(f"[vision_coordinates: {block['x']}, {block['y']}]")
        elif bt == "pdf":
            parts.append(flatten_pdf_to_text(block))
    return "\n".join(parts)


def to_anthropic_request(request: StreamRequest) -> Dict[str, Any]:
    request = _to_dict(request)
    system_messages = [m for m in request.get("messages", []) if m.get("role") == "system"]
    system: List[Dict[str, Any]] = []
    for index, message in enumerate(system_messages):
        fallback = request.get("system_cache_control") if index == len(system_messages) - 1 else None
        system.append(
            {
                "type": "text",
                "text": message_content_text(message),
                **cache_marker(message, _to_dict(fallback) if fallback else None),
            }
        )

    tools = [
        compact(
            {
                "name": tool["name"],
                "description": tool["description"],
                "input_schema": tool["parameters"],
                "strict": tool.get("strict"),
                **cache_marker(tool),
            }
        )
        for tool in (request.get("tools") or [])
    ]

    tool_choice = request.get("tool_choice")
    if tool_choice:
        if isinstance(tool_choice, dict):
            tool_choice = {"type": "tool", "name": tool_choice["name"]}
        elif tool_choice == "required":
            tool_choice = {"type": "any"}
        else:
            tool_choice = {"type": tool_choice}

    reasoning = request.get("reasoning")
    thinking = None
    if reasoning and reasoning.get("enabled") is not False:
        thinking = {
            "type": "enabled",
            "budget_tokens": reasoning.get("budget_tokens") or 1024,
        }

    response_format = None
    rf = request.get("response_format")
    if rf:
        response_format = {"type": "json_schema", "schema": rf["schema"]}

    return compact(
        {
            "model": request["model"],
            "system": system if system else None,
            "messages": [
                {
                    "role": m["role"],
                    "content": to_anthropic_message_content(m),
                }
                for m in request["messages"]
                if m.get("role") != "system"
            ],
            "max_tokens": request.get("max_tokens"),
            "temperature": request.get("temperature"),
            "top_p": request.get("top_p"),
            "tools": tools if tools else None,
            "tool_choice": tool_choice,
            "disable_parallel_tool_use": (
                not request["parallel_tool_calls"]
                if request.get("parallel_tool_calls") is not None
                else None
            ),
            "thinking": thinking,
            "output_format": response_format,
            "citations": request.get("citations"),
            "stream": request.get("stream"),
        }
    )


def to_kimi_request(request: StreamRequest) -> Dict[str, Any]:
    request = _to_dict(request)
    body = to_openai_request(request)
    body.pop("reasoning_effort", None)
    reasoning = request.get("reasoning")
    thinking = None
    if reasoning:
        thinking = {
            "type": "disabled" if reasoning.get("enabled") is False else "enabled",
        }
        if reasoning.get("budget_tokens"):
            thinking["budget_tokens"] = reasoning["budget_tokens"]
    return compact({**body, "thinking": thinking})
