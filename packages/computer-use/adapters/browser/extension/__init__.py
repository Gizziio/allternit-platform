"""
A2R Computer Use — Browser Extension Adapter (Assist Mode)
Connects to a user's active browser session via the thin-client extension.

In assist mode, the agent observes the page, suggests actions, and waits
for human confirmation before executing. This is the user-present workflow.

Communication: WebSocket to extension background service worker.
The extension must be running and connected for this adapter to work.

Actions:
  observe   — Get current page state from extension (URL, title, DOM snapshot)
  suggest   — Send action suggestion to extension UI for user confirmation
  act       — Execute a confirmed action via extension (click, type, navigate)
  screenshot — Request screenshot from extension's visible tab
"""

from core import BaseAdapter, ActionRequest, ResultEnvelope
from datetime import datetime
from typing import Optional, Dict, Any
import json


class ExtensionAdapter(BaseAdapter):
    """
    Browser extension adapter for user-present assist workflows.
    Communicates with A2R thin-client extension via WebSocket.
    """

    def __init__(self, ws_url: str = "ws://localhost:3011/extension"):
        self._ws_url = ws_url
        self._ws = None
        self._connected = False
        self._pending_confirmations: Dict[str, Any] = {}

    @property
    def adapter_id(self) -> str:
        return "browser.extension"

    @property
    def family(self) -> str:
        return "browser"

    async def initialize(self) -> None:
        """Connect to extension WebSocket."""
        try:
            import aiohttp
            self._session = aiohttp.ClientSession()
            self._ws = await self._session.ws_connect(self._ws_url, timeout=5)
            self._connected = True
        except ImportError:
            raise RuntimeError("aiohttp required for extension adapter. Run: pip install aiohttp")
        except Exception as e:
            self._connected = False
            raise RuntimeError(
                f"Could not connect to extension at {self._ws_url}. "
                f"Ensure the A2R extension is installed and running. Error: {e}"
            )

    async def execute(self, action: ActionRequest, session_id: str, run_id: str) -> ResultEnvelope:
        envelope = self._make_envelope(action, session_id, run_id)

        try:
            if not self._connected:
                envelope.status = "failed"
                envelope.error = {
                    "code": "NOT_CONNECTED",
                    "message": "Extension not connected. Ensure A2R extension is running.",
                    "adapter_id": self.adapter_id,
                }
                envelope.completed_at = datetime.utcnow().isoformat()
                return envelope

            if action.action_type == "observe":
                result_data = await self._observe(action)
            elif action.action_type == "suggest":
                result_data = await self._suggest(action)
            elif action.action_type == "act":
                result_data = await self._act(action)
            elif action.action_type == "screenshot":
                result_data = await self._screenshot(action)
            else:
                envelope.status = "failed"
                envelope.error = {
                    "code": "UNSUPPORTED_ACTION",
                    "message": f"Extension adapter does not support '{action.action_type}'",
                    "adapter_id": self.adapter_id,
                }
                envelope.completed_at = datetime.utcnow().isoformat()
                return envelope

            envelope.status = "completed"
            envelope.extracted_content = result_data
            envelope.completed_at = datetime.utcnow().isoformat()
            self._emit_receipt(envelope, action, result_data)

        except Exception as e:
            envelope.status = "failed"
            envelope.error = {
                "code": "EXTENSION_ERROR",
                "message": str(e),
                "adapter_id": self.adapter_id,
            }
            envelope.completed_at = datetime.utcnow().isoformat()

        return envelope

    async def _send_and_receive(self, msg_type: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Send a message to extension and wait for response."""
        import uuid
        msg_id = str(uuid.uuid4())
        message = {
            "id": msg_id,
            "type": msg_type,
            "payload": payload,
        }
        await self._ws.send_json(message)

        # Wait for response with matching ID
        async for msg in self._ws:
            if msg.type == 1:  # TEXT
                data = json.loads(msg.data)
                if data.get("id") == msg_id:
                    return data.get("payload", {})
            elif msg.type in (256, 257):  # CLOSE, ERROR
                raise RuntimeError("Extension WebSocket closed unexpectedly")

        raise RuntimeError("No response received from extension")

    async def _observe(self, action: ActionRequest) -> Dict[str, Any]:
        """Get current page state from extension."""
        return await self._send_and_receive("observe", {
            "target": action.target,
            "include_dom": action.parameters.get("include_dom", False),
        })

    async def _suggest(self, action: ActionRequest) -> Dict[str, Any]:
        """Send action suggestion to extension for user confirmation."""
        suggestion = {
            "action": action.parameters.get("suggested_action", "click"),
            "target": action.target,
            "description": action.parameters.get("description", ""),
            "selector": action.parameters.get("selector", ""),
        }
        return await self._send_and_receive("suggest", suggestion)

    async def _act(self, action: ActionRequest) -> Dict[str, Any]:
        """Execute a confirmed action via extension."""
        return await self._send_and_receive("act", {
            "action": action.parameters.get("sub_action", "click"),
            "selector": action.parameters.get("selector", action.target),
            "text": action.parameters.get("text", ""),
            "confirmed": action.parameters.get("confirmed", False),
        })

    async def _screenshot(self, action: ActionRequest) -> Dict[str, Any]:
        """Request screenshot from extension's visible tab."""
        return await self._send_and_receive("screenshot", {
            "format": action.parameters.get("format", "png"),
        })

    async def close(self) -> None:
        if self._ws and not self._ws.closed:
            await self._ws.close()
        if hasattr(self, "_session") and self._session:
            await self._session.close()
        self._connected = False
