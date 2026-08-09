from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Union


@dataclass
class CacheControl:
    type: str = "ephemeral"
    ttl: Optional[str] = None


@dataclass
class ReasoningConfig:
    enabled: Optional[bool] = None
    budget_tokens: Optional[int] = None
    effort: Optional[str] = None


@dataclass
class JsonSchemaResponseFormat:
    schema: Dict[str, Any]
    type: str = "json_schema"
    name: Optional[str] = None
    description: Optional[str] = None
    strict: Optional[bool] = None


@dataclass
class Tool:
    name: str
    description: str
    parameters: Dict[str, Any]
    strict: Optional[bool] = None
    cache: Optional[bool] = None
    cache_control: Optional[CacheControl] = None


@dataclass
class ToolCall:
    id: str
    name: str
    arguments: Dict[str, Any]


@dataclass
class Message:
    role: str
    content: Union[str, List[Dict[str, Any]]]
    name: Optional[str] = None
    tool_calls: Optional[List[ToolCall]] = None
    tool_call_id: Optional[str] = None
    cache: Optional[bool] = None
    cache_control: Optional[CacheControl] = None


@dataclass
class StreamRequest:
    provider: str
    model: str
    messages: List[Message]
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None
    top_p: Optional[float] = None
    top_k: Optional[int] = None
    tools: Optional[List[Tool]] = None
    tool_choice: Optional[Union[str, Dict[str, str]]] = None
    functions: Optional[List[Dict[str, Any]]] = None
    parallel_tool_calls: Optional[bool] = None
    reasoning: Optional[ReasoningConfig] = None
    response_format: Optional[JsonSchemaResponseFormat] = None
    system_cache_control: Optional[CacheControl] = None
    citations: Optional[bool] = None
    stream: Optional[bool] = None


@dataclass
class HarnessResponse:
    content: str
    tool_calls: Optional[List[ToolCall]] = None
    usage: Optional[Dict[str, int]] = None
    stop_reason: Optional[str] = None


class HarnessError(Exception):
    def __init__(self, code: str, message: str, cause: Any = None):
        super().__init__(message)
        self.code = code
        self.cause = cause
