"""
A2R Computer Use — CDP Adapter
Chrome DevTools Protocol for inspect/debug workflows.
Uses HTTP for target discovery and WebSocket for page interaction.
"""

from core import BaseAdapter, ActionRequest, ResultEnvelope
from datetime import datetime
from typing import Dict, Any, Optional
import json
import base64


class CDPAdapter(BaseAdapter):
    """CDP adapter for inspect and debug mode via Chrome DevTools Protocol."""

    def __init__(self, port: int = 9222):
        self._port = port
        self._ws_url: Optional[str] = None

    @property
    def adapter_id(self) -> str:
        return "browser.cdp"

    @property
    def family(self) -> str:
        return "browser"

    async def initialize(self) -> None:
        pass  # CDP connects on-demand per action

    async def _get_ws_url(self, session) -> str:
        """Get WebSocket debugger URL for the first available page target."""
        if self._ws_url:
            return self._ws_url
        base = f"http://127.0.0.1:{self._port}"
        async with session.get(f"{base}/json") as resp:
            targets = await resp.json()
        for t in targets:
            if t.get("type") == "page" and "webSocketDebuggerUrl" in t:
                self._ws_url = t["webSocketDebuggerUrl"]
                return self._ws_url
        raise RuntimeError("No page targets with WebSocket URL found on CDP port {self._port}")

    async def _send_cdp_command(self, ws, method: str, params: dict = None) -> dict:
        """Send a CDP command over WebSocket and return the result."""
        import aiohttp
        msg_id = 1
        payload = {"id": msg_id, "method": method}
        if params:
            payload["params"] = params
        await ws.send_json(payload)
        async for msg in ws:
            if msg.type == aiohttp.WSMsgType.TEXT:
                data = json.loads(msg.data)
                if data.get("id") == msg_id:
                    if "error" in data:
                        raise RuntimeError(f"CDP error: {data['error']}")
                    return data.get("result", {})
            elif msg.type in (aiohttp.WSMsgType.ERROR, aiohttp.WSMsgType.CLOSED):
                raise RuntimeError("CDP WebSocket closed unexpectedly")
        raise RuntimeError("No response from CDP")

    async def execute(self, action: ActionRequest, session_id: str, run_id: str) -> ResultEnvelope:
        envelope = self._make_envelope(action, session_id, run_id, mode="inspect")

        try:
            import aiohttp
            base = f"http://127.0.0.1:{self._port}"

            async with aiohttp.ClientSession() as session:
                if action.action_type == "inspect":
                    # List all debuggable targets via HTTP — no WebSocket needed
                    async with session.get(f"{base}/json") as resp:
                        targets = await resp.json()
                    envelope.extracted_content = targets

                elif action.action_type == "screenshot":
                    ws_url = await self._get_ws_url(session)
                    async with session.ws_connect(ws_url) as ws:
                        result = await self._send_cdp_command(ws, "Page.captureScreenshot", {
                            "format": "png",
                            "quality": 80,
                        })
                        png_b64 = result.get("data", "")
                        png_bytes = base64.b64decode(png_b64)
                        envelope.extracted_content = {
                            "format": "png",
                            "size_bytes": len(png_bytes),
                        }
                        envelope.artifacts = [{
                            "type": "screenshot",
                            "mime": "image/png",
                            "size_bytes": len(png_bytes),
                            "data_b64": png_b64,
                        }]

                elif action.action_type == "eval":
                    expression = action.parameters.get("expression", action.target or "1+1")
                    ws_url = await self._get_ws_url(session)
                    async with session.ws_connect(ws_url) as ws:
                        result = await self._send_cdp_command(ws, "Runtime.evaluate", {
                            "expression": expression,
                            "returnByValue": True,
                        })
                        remote_obj = result.get("result", {})
                        envelope.extracted_content = {
                            "type": remote_obj.get("type"),
                            "value": remote_obj.get("value"),
                        }
                        if result.get("exceptionDetails"):
                            envelope.extracted_content["exception"] = result["exceptionDetails"].get("text")

                elif action.action_type == "goto":
                    url = action.parameters.get("url", action.target)
                    ws_url = await self._get_ws_url(session)
                    async with session.ws_connect(ws_url) as ws:
                        result = await self._send_cdp_command(ws, "Page.navigate", {"url": url})
                        envelope.extracted_content = {
                            "frameId": result.get("frameId"),
                            "url": url,
                        }

                else:
                    envelope.status = "failed"
                    envelope.error = {
                        "code": "UNSUPPORTED_ACTION",
                        "message": f"CDP adapter supports: inspect, screenshot, eval, goto. Got: '{action.action_type}'",
                        "adapter_id": self.adapter_id,
                    }
                    envelope.completed_at = datetime.utcnow().isoformat()
                    return envelope

            envelope.status = "completed"
            envelope.completed_at = datetime.utcnow().isoformat()
            self._emit_receipt(envelope, action)

        except Exception as e:
            envelope.status = "failed"
            envelope.error = {"code": "CDP_ERROR", "message": str(e), "adapter_id": self.adapter_id}
            envelope.completed_at = datetime.utcnow().isoformat()

        return envelope

    async def close(self) -> None:
        self._ws_url = None
