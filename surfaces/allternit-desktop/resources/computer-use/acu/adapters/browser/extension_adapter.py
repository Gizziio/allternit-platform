"""
Allternit Computer Use — Browser Extension Adapter

Routes computer-use actions through the Allternit Chrome extension via the
Desktop app's ACU relay HTTP server (port 3012).

Architecture:
  ACU executor → ExtensionAdapter → HTTP POST :3012/extension/send
                                         ↓
                                   Desktop app main (unified-main.ts)
                                         ↓ extensionSocket.write()
                                   Native messaging host (com.allternit.desktop)
                                         ↓ chrome.runtime.connectNative
                                   Chrome extension (executor.ts)
                                   ├── BROWSER.SCREENSHOT
                                   ├── BROWSER.NAV
                                   ├── BROWSER.ACT  (click, type, scroll, press, fill)
                                   ├── BROWSER.EXTRACT
                                   ├── BROWSER.GET_CONTEXT
                                   └── BROWSER.WAIT

Native message protocol (id-correlated, newline-delimited JSON via TCP 3011):
  Outbound: { "id": str, "type": "execute", "payload": ExecuteRequest, "timestamp": int }
  Inbound:  { "id": str, "type": "result"|"error", "payload": {...}, "timestamp": int }

  ExecuteRequest: { "tabId": int, "actions": [BrowserAction, ...], "options"?: {...} }
  BrowserAction:  { "type": "BROWSER.NAV"|"BROWSER.SCREENSHOT"|"BROWSER.ACT"|...,
                    "tabId"?: int, "params": {...} }

Unsupported actions (no DOM/native-messaging equivalent):
  right_click, middle_click, left_click_drag, cursor_position
  → These return status="unsupported" so the executor waterfall falls through to CDP.
"""

from __future__ import annotations

import asyncio
import logging
import os
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

import httpx

from core.base_adapter import (
    ActionRequest,
    AdapterCapabilities,
    BaseAdapter,
    ResultEnvelope,
)

logger = logging.getLogger(__name__)

_RELAY_HOST = os.environ.get("ACU_EXTENSION_HOST", "127.0.0.1")
_RELAY_PORT = int(os.environ.get("ACU_EXTENSION_RELAY_PORT", "3012"))
_RESPONSE_TIMEOUT = float(os.environ.get("ACU_EXTENSION_TIMEOUT", "15"))


def _relay_url(path: str) -> str:
    return f"http://{_RELAY_HOST}:{_RELAY_PORT}{path}"


# ---------------------------------------------------------------------------
# HTTP relay client
# ---------------------------------------------------------------------------

class _HttpRelayClient:
    """
    HTTP client for the Desktop app's ACU extension relay (port 3012).

    POST /extension/send  — send correlated message, wait for response
    GET  /extension/status — check if native host is connected
    """

    def __init__(self, timeout: float = _RESPONSE_TIMEOUT) -> None:
        self._timeout = timeout
        self._client: Optional[httpx.AsyncClient] = None

    async def connect(self) -> None:
        self._client = httpx.AsyncClient(timeout=self._timeout)

    async def disconnect(self) -> None:
        if self._client:
            await self._client.aclose()
            self._client = None

    async def is_extension_connected(self) -> bool:
        try:
            c = self._client or httpx.AsyncClient(timeout=3.0)
            resp = await c.get(_relay_url("/extension/status"))
            return bool(resp.json().get("connected"))
        except Exception:
            return False

    async def send(
        self,
        actions: list,
        tab_id: int = 0,
        options: Optional[Dict] = None,
        msg_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        POST an execute message and return the correlated response payload.

        actions: list of BROWSER.* action objects
        tab_id:  0 = active tab (extension resolves this)
        """
        if self._client is None:
            raise RuntimeError("Relay client not initialized — call connect() first")

        msg_id = msg_id or str(uuid.uuid4())
        message = {
            "id": msg_id,
            "type": "execute",
            "payload": {
                "tabId": tab_id,
                "actions": actions,
                **({"options": options} if options else {}),
            },
            "timestamp": int(time.time() * 1000),
        }

        resp = await self._client.post(
            _relay_url("/extension/send"),
            json=message,
            timeout=self._timeout,
        )
        resp.raise_for_status()
        body = resp.json()

        if not body.get("ok"):
            error = body.get("error", "unknown_relay_error")
            if error == "extension_not_connected":
                raise RuntimeError("Chrome extension is not connected to the Desktop app")
            if error == "extension_timeout":
                raise TimeoutError(f"Extension did not respond within {self._timeout}s")
            raise RuntimeError(f"Relay error: {error}")

        return body.get("data") or {}

    async def ping(self) -> bool:
        if self._client is None:
            return False
        try:
            msg_id = str(uuid.uuid4())
            message = {
                "id": msg_id,
                "type": "ping",
                "timestamp": int(time.time() * 1000),
            }
            resp = await self._client.post(
                _relay_url("/extension/send"),
                json=message,
                timeout=5.0,
            )
            body = resp.json()
            # ping responses come back as {type: "pong"} in the data
            return body.get("ok", False)
        except Exception:
            return False


# ---------------------------------------------------------------------------
# Target helpers
# ---------------------------------------------------------------------------

def _make_target(action: ActionRequest) -> Dict[str, Any]:
    """Build a browser-actions.ts Target from ActionRequest parameters."""
    p = action.parameters
    if p.get("x") is not None and p.get("y") is not None:
        return {"type": "coordinates", "x": int(p["x"]), "y": int(p["y"])}
    selector = action.target or p.get("selector")
    if selector:
        return {"type": "selector", "value": selector}
    return {"type": "selector", "value": "body"}


# ---------------------------------------------------------------------------
# ExtensionAdapter
# ---------------------------------------------------------------------------

class ExtensionAdapter(BaseAdapter):
    """
    browser.extension adapter — routes actions through the Allternit Chrome extension.

    Uses BROWSER.* action types from executor.ts (not the BrowserAction types from
    browser-actions.ts, which are the content-script-level types).

    Unsupported actions (right_click, middle_click, left_click_drag, cursor_position)
    return status="unsupported" so ComputerUseExecutor falls through to browser.cdp.
    """

    def __init__(
        self,
        host: str = _RELAY_HOST,
        port: int = _RELAY_PORT,
        timeout: float = _RESPONSE_TIMEOUT,
    ) -> None:
        self._host = host
        self._port = port
        self._timeout = timeout
        self._client = _HttpRelayClient(timeout=timeout)

    @property
    def adapter_id(self) -> str:
        return "browser.extension"

    @property
    def family(self) -> str:
        return "browser"

    async def initialize(self) -> None:
        await self._client.connect()
        logger.info(
            "[extension-adapter] relay client initialized → http://%s:%d",
            self._host, self._port,
        )

    async def close(self) -> None:
        await self._client.disconnect()

    async def health_check(self) -> bool:
        if self._client._client is None:
            try:
                await self._client.connect()
            except Exception:
                return False
        return await self._client.is_extension_connected()

    async def capabilities(self) -> AdapterCapabilities:
        return AdapterCapabilities(
            adapter_id=self.adapter_id,
            family=self.family,
            dom_tree=True,
            vision_required=False,
            multi_tab=True,
            auth_flows=True,
            platform="any",
        )

    async def execute(self, action: ActionRequest, session_id: str, run_id: str) -> ResultEnvelope:
        envelope = self._make_envelope(action, session_id, run_id)

        if self._client._client is None:
            try:
                await self._client.connect()
            except Exception as exc:
                envelope.status = "failed"
                envelope.error = {"code": "CONNECT_FAILED", "message": str(exc)}
                envelope.completed_at = _utcnow()
                return envelope

        handler = self._ACTION_MAP.get(action.action_type)
        if handler is None:
            # Mark unsupported so executor waterfall moves to next adapter
            envelope.status = "unsupported"
            envelope.error = {
                "code": "UNSUPPORTED_ACTION",
                "message": (
                    f"browser.extension does not support '{action.action_type}' — "
                    "waterfall will try browser.cdp"
                ),
            }
            envelope.completed_at = _utcnow()
            return envelope

        try:
            result_data = await handler(self, action, session_id)
            envelope.status = result_data.pop("_status", "completed")
            envelope.extracted_content = result_data or None
            envelope.completed_at = _utcnow()
            self._emit_receipt(envelope, action, result_data)
        except TimeoutError as exc:
            envelope.status = "failed"
            envelope.error = {"code": "TIMEOUT", "message": str(exc)}
            envelope.completed_at = _utcnow()
        except Exception as exc:
            logger.exception("[extension-adapter] execute error for %s", action.action_type)
            envelope.status = "failed"
            envelope.error = {"code": "EXTENSION_ERROR", "message": str(exc)}
            envelope.completed_at = _utcnow()

        return envelope

    # ── Action implementations — BROWSER.* protocol ──────────────────────────

    async def _screenshot(self, action: ActionRequest, session_id: str) -> Dict[str, Any]:
        full_page = action.parameters.get("full_page", False)
        resp = await self._client.send([{
            "type": "BROWSER.SCREENSHOT",
            "params": {"fullPage": full_page, "format": action.parameters.get("format", "png")},
        }])
        # Extension returns {screenshot: "data:image/png;base64,..."}
        raw = resp.get("screenshot", "")
        if isinstance(raw, str) and raw.startswith("data:"):
            return {"data_url": raw}
        return {"data_url": raw}

    async def _navigate(self, action: ActionRequest, session_id: str) -> Dict[str, Any]:
        url = action.target or action.parameters.get("url", "")
        resp = await self._client.send([{
            "type": "BROWSER.NAV",
            "params": {"url": url},
        }])
        return {"url": resp.get("url", url), "title": resp.get("title", "")}

    async def _left_click(self, action: ActionRequest, session_id: str) -> Dict[str, Any]:
        return await self._client.send([{
            "type": "BROWSER.ACT",
            "params": {
                "action": "click",
                "target": _make_target(action),
                "options": {"force": action.parameters.get("force", False)},
            },
        }])

    async def _type(self, action: ActionRequest, session_id: str) -> Dict[str, Any]:
        text = action.parameters.get("text", action.target or "")
        return await self._client.send([{
            "type": "BROWSER.ACT",
            "params": {
                "action": "type",
                "target": _make_target(action),
                "text": text,
                "options": {"clear": False, "submit": False},
            },
        }])

    async def _fill(self, action: ActionRequest, session_id: str) -> Dict[str, Any]:
        text = action.parameters.get("text", "")
        return await self._client.send([{
            "type": "BROWSER.ACT",
            "params": {
                "action": "type",
                "target": _make_target(action),
                "text": text,
                "options": {"clear": True},
            },
        }])

    async def _key(self, action: ActionRequest, session_id: str) -> Dict[str, Any]:
        raw_key = action.parameters.get("key", action.target or "")
        # Parse "ctrl+c" → key="c", modifiers=["Control"]
        modifier_map = {"ctrl": "Control", "alt": "Alt", "shift": "Shift", "meta": "Meta", "cmd": "Meta"}
        parts = [p.strip() for p in raw_key.split("+")]
        modifiers = [modifier_map[p.lower()] for p in parts[:-1] if p.lower() in modifier_map]
        key = parts[-1]
        return await self._client.send([{
            "type": "BROWSER.ACT",
            "params": {"action": "press", "key": key, "modifiers": modifiers},
        }])

    async def _scroll(self, action: ActionRequest, session_id: str) -> Dict[str, Any]:
        p = action.parameters
        dx = int(p.get("deltaX", 0))
        dy = int(p.get("deltaY", p.get("delta", 0)))
        # Map deltaY to direction/amount for extension scroll
        if dy > 0:
            direction, amount = "down", dy
        elif dy < 0:
            direction, amount = "up", abs(dy)
        elif dx > 0:
            direction, amount = "right", dx
        else:
            direction, amount = "left", abs(dx)

        target = _make_target(action) if (p.get("x") or p.get("selector")) else None
        params: Dict[str, Any] = {
            "action": "scroll",
            "direction": direction,
            "amount": amount,
            "unit": "pixels",
        }
        if target:
            params["target"] = target
        return await self._client.send([{"type": "BROWSER.ACT", "params": params}])

    async def _extract(self, action: ActionRequest, session_id: str) -> Dict[str, Any]:
        selector = action.target or action.parameters.get("selector")
        fmt = action.parameters.get("format", "text")
        query: Dict[str, Any] = {"type": "selector", "value": selector} if selector else {"type": "links"}
        if fmt == "html":
            query = {"type": "html", "selector": selector or "body"}
        return await self._client.send([{
            "type": "BROWSER.EXTRACT",
            "params": {"query": query},
        }])

    async def _get_context(self, action: ActionRequest, session_id: str) -> Dict[str, Any]:
        return await self._client.send([{
            "type": "BROWSER.GET_CONTEXT",
            "params": {
                "includeDom": action.parameters.get("include_dom", True),
                "includeAccessibility": action.parameters.get("include_a11y", False),
            },
        }])

    async def _wait(self, action: ActionRequest, session_id: str) -> Dict[str, Any]:
        ms = action.parameters.get("ms", action.parameters.get("timeout_ms", 1000))
        resp = await self._client.send([{
            "type": "BROWSER.WAIT",
            "params": {"condition": "time", "timeout": int(ms)},
        }])
        return {"waited_ms": ms, **resp}

    async def _tabs(self, action: ActionRequest, session_id: str) -> Dict[str, Any]:
        """Get tab context via BROWSER.GET_CONTEXT."""
        return await self._client.send([{
            "type": "BROWSER.GET_CONTEXT",
            "params": {"includeDom": False},
        }])

    # Actions absent from this table return status="unsupported", causing the
    # executor waterfall to fall through to browser.cdp which handles them with
    # full coordinate precision via Playwright's page API:
    #   right_click, middle_click, left_click_drag, cursor_position
    #   double_click — omitted intentionally: two HTTP round-trips cannot reliably
    #                  satisfy the browser's <500ms dblclick threshold; CDP does it
    #                  atomically with page.mouse.dblclick()
    _ACTION_MAP = {
        "screenshot": _screenshot,
        "navigate": _navigate,
        "left_click": _left_click,
        "type": _type,
        "fill": _fill,
        "key": _key,
        "scroll": _scroll,
        "extract": _extract,
        "get_context": _get_context,
        "wait": _wait,
        "tabs": _tabs,
    }


def _utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()
