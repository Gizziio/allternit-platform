from __future__ import annotations

import dataclasses
import json
from typing import Any, AsyncGenerator, Dict, List, Optional

import httpx

from .provider_request import (
    map_stop_reason,
    parse_openai_usage,
    to_anthropic_request,
    to_kimi_request,
    to_openai_request,
)
from .types import HarnessError, Message, StreamRequest, ToolCall


class Harness:
    """Unified async interface for Allternit AI provider calls."""

    def __init__(
        self,
        mode: str,
        byok: Optional[Dict[str, Any]] = None,
        cloud: Optional[Dict[str, Any]] = None,
        local: Optional[Dict[str, Any]] = None,
    ):
        self.mode = mode
        self.byok = byok or {}
        self.cloud = cloud
        self.local = local
        self._client = httpx.AsyncClient(timeout=httpx.Timeout(60.0))
        self._validate_config()

    def _validate_config(self) -> None:
        if not self.mode:
            raise HarnessError("CONFIG_INVALID", "Mode is required")

        valid_modes = {"byok", "cloud", "local"}
        if self.mode not in valid_modes:
            raise HarnessError(
                "MODE_UNSUPPORTED",
                f"Unsupported mode: {self.mode}. Must be one of: {', '.join(sorted(valid_modes))}",
            )

        if self.mode == "byok":
            if not self.byok:
                raise HarnessError(
                    "CONFIG_INVALID",
                    "BYOK mode requires byok configuration with at least one provider API key",
                )
            providers = {"anthropic", "openai", "kimi", "vertex", "google"}
            if not any(
                self.byok.get(p, {}).get("api_key")
                for p in providers
            ):
                raise HarnessError(
                    "CONFIG_INVALID",
                    "BYOK mode requires at least one provider API key (anthropic, openai, kimi, or vertex)",
                )

        elif self.mode == "cloud":
            if not self.cloud or not self.cloud.get("base_url") or not self.cloud.get("access_token"):
                raise HarnessError(
                    "CONFIG_INVALID", "Cloud mode requires base_url and access_token"
                )

        elif self.mode == "local":
            if not self.local or not self.local.get("base_url"):
                raise HarnessError("CONFIG_INVALID", "Local mode requires base_url")

    async def aclose(self) -> None:
        await self._client.aclose()

    async def stream(self, request: StreamRequest) -> AsyncGenerator[Dict[str, Any], None]:
        if not isinstance(request, StreamRequest):
            request = StreamRequest(**request)

        if not request.provider or not request.model:
            raise HarnessError("CONFIG_INVALID", "Provider and model are required")

        provider = request.provider.lower()

        try:
            if self.mode == "byok":
                if provider == "anthropic":
                    async for chunk in self._stream_anthropic(request):
                        yield chunk
                elif provider == "openai":
                    async for chunk in self._stream_openai(request):
                        yield chunk
                elif provider in ("kimi", "moonshot"):
                    async for chunk in self._stream_kimi(request):
                        yield chunk
                elif provider == "vertex":
                    raise HarnessError(
                        "PROVIDER_NOT_FOUND",
                        "Vertex BYOK streaming is not implemented in this parity scaffold",
                    )
                else:
                    raise HarnessError(
                        "PROVIDER_NOT_FOUND",
                        f'Provider "{provider}" not supported in BYOK mode',
                    )
            elif self.mode == "cloud":
                raise HarnessError("MODE_UNSUPPORTED", "Cloud streaming not yet implemented")
            elif self.mode == "local":
                raise HarnessError("MODE_UNSUPPORTED", "Local streaming not yet implemented")
            else:
                raise HarnessError("MODE_UNSUPPORTED", f"Mode {self.mode} is not implemented")
        except HarnessError:
            raise
        except Exception as exc:
            raise HarnessError(
                "UNKNOWN_ERROR",
                str(exc) or "Unknown error during streaming",
                exc,
            ) from exc

    async def complete(self, request: StreamRequest) -> Dict[str, Any]:
        return await self.run(request)

    async def run(self, request: StreamRequest) -> Dict[str, Any]:
        chunks: List[str] = []
        tool_call_buffers: Dict[Any, Dict[str, Any]] = {}
        tool_calls_complete: List[ToolCall] = []
        usage: Optional[Dict[str, int]] = None
        stop_reason: Optional[str] = None

        async for chunk in self.stream(request):
            ctype = chunk.get("type")
            if ctype == "text":
                chunks.append(chunk.get("text", ""))
            elif ctype == "tool_call":
                index = chunk.get("index", chunk.get("id", 0))
                buf = tool_call_buffers.setdefault(
                    index, {"id": "", "name": "", "arguments": ""}
                )
                if chunk.get("id"):
                    buf["id"] = chunk["id"]
                if chunk.get("name"):
                    buf["name"] = chunk["name"]
                buf["arguments"] += chunk.get("arguments", "")
            elif ctype == "tool_call_complete":
                tool_calls_complete.append(
                    ToolCall(
                        id=chunk["id"],
                        name=chunk["name"],
                        arguments=chunk["arguments"],
                    )
                )
            elif ctype == "done":
                usage = chunk.get("usage")
                stop_reason = chunk.get("stop_reason")

        for buf in tool_call_buffers.values():
            if buf.get("name"):
                try:
                    args = json.loads(buf["arguments"]) if buf["arguments"] else {}
                except Exception:
                    args = {}
                tool_calls_complete.append(
                    ToolCall(id=buf.get("id", ""), name=buf["name"], arguments=args)
                )

        response: Dict[str, Any] = {"content": "".join(chunks)}
        if tool_calls_complete:
            response["tool_calls"] = [
                dataclasses.asdict(tc) for tc in tool_calls_complete
            ]
        if usage:
            response["usage"] = usage
        if stop_reason:
            response["stop_reason"] = stop_reason
        return response

    # ------------------------------------------------------------------
    # Anthropic
    # ------------------------------------------------------------------
    async def _stream_anthropic(self, request: StreamRequest) -> AsyncGenerator[Dict[str, Any], None]:
        cfg = self.byok.get("anthropic")
        if not cfg or not cfg.get("api_key"):
            raise HarnessError("AUTHENTICATION_ERROR", "Anthropic API key not configured")

        base_url = cfg.get("base_url", "https://api.anthropic.com").rstrip("/")
        body = to_anthropic_request({**dataclasses.asdict(request), "stream": True})

        response = await self._client.post(
            f"{base_url}/v1/messages",
            headers={
                "content-type": "application/json",
                "x-api-key": cfg["api_key"],
                "anthropic-version": "2023-06-01",
            },
            json=body,
        )
        await self._raise_on_error(response, "Anthropic")

        input_tokens = 0
        output_tokens = 0
        stop_reason: Optional[str] = None

        async for event in _read_sse_json(response.aiter_text()):
            etype = event.get("type")
            if etype == "message_start":
                input_tokens = event.get("message", {}).get("usage", {}).get("input_tokens", 0)
            elif etype == "message_delta":
                output_tokens = event.get("usage", {}).get("output_tokens", output_tokens)
                stop_reason = (
                    map_stop_reason(
                        "anthropic",
                        event.get("delta", {}).get("stop_reason") or event.get("stop_reason"),
                    )
                    or stop_reason
                )
            elif etype == "message_stop":
                stop_reason = (
                    map_stop_reason("anthropic", event.get("message", {}).get("stop_reason"))
                    or stop_reason
                )
            elif etype == "content_block_delta":
                delta = event.get("delta", {})
                dtype = delta.get("type")
                if dtype == "text_delta":
                    yield {"type": "text", "text": delta.get("text", "")}
                elif dtype == "thinking_delta":
                    yield {"type": "thinking_delta", "thinking": delta.get("thinking", "")}
                elif dtype == "signature_delta":
                    yield {"type": "signature_delta", "signature": delta.get("signature", "")}
                elif dtype == "citations_delta":
                    yield {"type": "citation", "citation": delta.get("citation", {})}
            elif etype == "error":
                raise HarnessError(
                    "API_ERROR", event.get("error", {}).get("message", "Anthropic stream error")
                )

        yield {
            "type": "done",
            "usage": {
                "promptTokens": input_tokens,
                "completionTokens": output_tokens,
                "totalTokens": input_tokens + output_tokens,
            },
            "stop_reason": stop_reason,
        }

    # ------------------------------------------------------------------
    # OpenAI
    # ------------------------------------------------------------------
    async def _stream_openai(
        self,
        request: StreamRequest,
        *,
        base_url: str = "https://api.openai.com",
        api_key: Optional[str] = None,
    ) -> AsyncGenerator[Dict[str, Any], None]:
        key = api_key
        if key is None:
            cfg = self.byok.get("openai")
            if not cfg or not cfg.get("api_key"):
                raise HarnessError("AUTHENTICATION_ERROR", "OpenAI API key not configured")
            key = cfg["api_key"]
            base_url = cfg.get("base_url", base_url).rstrip("/")

        body = to_openai_request({**dataclasses.asdict(request), "stream": True})
        response = await self._client.post(
            f"{base_url}/v1/chat/completions",
            headers={
                "content-type": "application/json",
                "authorization": f"Bearer {key}",
            },
            json=body,
        )
        await self._raise_on_error(response, "OpenAI")

        usage: Optional[Dict[str, int]] = None
        stop_reason: Optional[str] = None
        tool_call_buffers: Dict[int, Dict[str, str]] = {}

        async for event in _read_sse_json(response.aiter_text()):
            if not isinstance(event, dict):
                continue
            choices = event.get("choices") or []
            choice = choices[0] if choices else None

            if choice is not None:
                delta = choice.get("delta") or {}
                content = delta.get("content")
                if content:
                    yield {"type": "text", "text": content}

                for tc in delta.get("tool_calls") or []:
                    index = tc.get("index", 0)
                    buf = tool_call_buffers.setdefault(index, {"id": "", "name": "", "arguments": ""})
                    if tc.get("id"):
                        buf["id"] = tc["id"]
                    func = tc.get("function") or {}
                    if func.get("name"):
                        buf["name"] = func["name"]
                    if func.get("arguments"):
                        buf["arguments"] += func["arguments"]
                    yield {
                        "type": "tool_call",
                        "index": index,
                        "id": buf["id"],
                        "name": buf["name"],
                        "arguments": func.get("arguments", ""),
                    }

                finish = choice.get("finish_reason")
                if finish:
                    stop_reason = map_stop_reason("openai", finish) or stop_reason

            if event.get("usage"):
                usage = parse_openai_usage(event["usage"])

        for buf in tool_call_buffers.values():
            if buf.get("name"):
                try:
                    args = json.loads(buf["arguments"]) if buf["arguments"] else {}
                except Exception:
                    args = {}
                yield {"type": "tool_call_complete", "id": buf["id"], "name": buf["name"], "arguments": args}

        yield {"type": "done", "usage": usage, "stop_reason": stop_reason}

    # ------------------------------------------------------------------
    # Kimi (OpenAI-compatible)
    # ------------------------------------------------------------------
    async def _stream_kimi(self, request: StreamRequest) -> AsyncGenerator[Dict[str, Any], None]:
        cfg = self.byok.get("kimi") or self.byok.get("moonshot")
        if not cfg or not cfg.get("api_key"):
            raise HarnessError("AUTHENTICATION_ERROR", "Kimi API key not configured")

        base_url = cfg.get("base_url", "https://api.moonshot.cn").rstrip("/")
        body = to_kimi_request({**dataclasses.asdict(request), "stream": True})
        response = await self._client.post(
            f"{base_url}/v1/chat/completions",
            headers={
                "content-type": "application/json",
                "authorization": f"Bearer {cfg['api_key']}",
            },
            json=body,
        )
        await self._raise_on_error(response, "Kimi")

        usage: Optional[Dict[str, int]] = None
        stop_reason: Optional[str] = None
        chunks: List[str] = []

        async for event in _read_sse_json(response.aiter_text()):
            if not isinstance(event, dict):
                continue
            choices = event.get("choices") or []
            choice = choices[0] if choices else None
            if choice is not None:
                delta = choice.get("delta") or {}
                if delta.get("content"):
                    chunks.append(delta["content"])
                    yield {"type": "text", "text": delta["content"]}
                if choice.get("finish_reason"):
                    stop_reason = map_stop_reason("openai", choice["finish_reason"]) or stop_reason
            if event.get("usage"):
                usage = parse_openai_usage(event["usage"])

        yield {"type": "done", "usage": usage, "stop_reason": stop_reason}

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    async def _raise_on_error(self, response: httpx.Response, provider: str) -> None:
        if response.is_success:
            return
        body_text = ""
        try:
            body_text = response.text
        except Exception:
            pass
        raise HarnessError(
            "API_ERROR",
            f"{provider} request failed with status {response.status_code}{': ' + body_text if body_text else ''}",
            {"status": response.status_code, "body": body_text},
        )


async def _read_sse_json(aiter_text):
    buffer = ""
    async for text in aiter_text:
        buffer += text
        while "\n\n" in buffer:
            frame, buffer = buffer.split("\n\n", 1)
            data_lines = [
                line[5:].strip() for line in frame.splitlines() if line.startswith("data:")
            ]
            data = "\n".join(data_lines)
            if data and data != "[DONE]":
                try:
                    yield json.loads(data)
                except json.JSONDecodeError:
                    continue
