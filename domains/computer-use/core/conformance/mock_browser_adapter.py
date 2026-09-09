"""
Allternit Computer Use — Mock Browser Adapter (conformance harness)

In-memory browser adapter used to measure the conformance harness itself
and to run deterministic conformance suites without a live browser. It is
deliberately labeled ``browser.mock`` everywhere so measured results are
never mistaken for real-browser evidence.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict

from core.base_adapter import ActionRequest, BaseAdapter


class MockBrowserAdapter(BaseAdapter):
    """Simulates a deterministic browser: every action succeeds.

    Content is shaped so Suite A assertions pass (Example Domain text,
    screenshot artifact with size, full envelope fields, receipts).
    """

    def __init__(self) -> None:
        self._initialized = False
        self.actions_executed = []

    @property
    def adapter_id(self) -> str:
        return "browser.mock"

    @property
    def family(self) -> str:
        return "browser"

    async def initialize(self) -> None:
        self._initialized = True

    async def capabilities(self) -> Dict[str, Any]:
        return {
            "dom_tree": True,
            "vision_required": False,
            "multi_tab": True,
            "auth_flows": True,
            "platform": "any",
            "family": "browser",
        }

    async def health_check(self) -> bool:
        return self._initialized

    async def execute(self, action: ActionRequest, session_id: str, run_id: str):
        envelope = self._make_envelope(action, session_id, run_id)
        self.actions_executed.append(action.action_type)
        kind = action.action_type

        if kind == "screenshot":
            envelope.artifacts = [{
                "type": "screenshot",
                "mime": "image/png",
                "size_bytes": 4096,
                "content": "",
            }]
            envelope.extracted_content = {"data_url": ""}
        elif kind in ("extract", "observe", "eval"):
            envelope.extracted_content = {
                "url": action.target or "https://example.com",
                "title": "Example Domain",
                "text": "Example Domain\nThis domain is for use in examples.",
                "content": "<html><body><h1>Example Domain</h1></body></html>",
                "link_count": 1,
                "result": "Example Domain",
                "screen_size": {"width": 1920, "height": 1080},
                "mouse_position": {"x": 0, "y": 0},
            }
        elif kind == "goto":
            envelope.extracted_content = {
                "url": action.target or action.parameters.get("url", ""),
                "title": "Example Domain",
            }
        else:
            envelope.extracted_content = {"ok": True}

        envelope.status = "completed"
        envelope.completed_at = datetime.utcnow().isoformat()
        self._emit_receipt(envelope, action, envelope.extracted_content)
        return envelope

    async def close(self) -> None:
        self._initialized = False
