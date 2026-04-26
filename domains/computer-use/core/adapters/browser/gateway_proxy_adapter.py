"""
GatewayProxyAdapter — BaseAdapter-compatible adapter that proxies to /v1/execute.

Registered as "browser.playwright" in the ComputerUseExecutor waterfall.
Calls session_manager's Playwright sessions via the gateway's /v1/execute endpoint,
giving the executor a real headless Playwright fallback when neither the Chrome
extension nor an existing CDP browser is available.

Two call modes:
  1. Executor mode  — execute(action, session_id, run_id) → ResultEnvelope
     Called by ComputerUseExecutor with the standard three-arg signature.
  2. Legacy mode    — execute(req) → _ResultEnvelope
     Called by PlanningLoop (still uses duck-typed single-arg call).
     Detected by checking whether session_id/run_id args are present.

ACU_GATEWAY_URL controls the target (default http://localhost:8760).
"""

from __future__ import annotations

import base64
import logging
import os
import sys
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger(__name__)

ACTION_MAP: Dict[str, str] = {
    # ACU / VisionAction type → /v1/execute action name
    "click": "click",
    "left_click": "click",
    "right_click": "click",
    "double_click": "click",
    "middle_click": "click",
    "left_click_drag": "click",
    "type": "fill",
    "fill": "fill",
    "goto": "goto",
    "navigate": "goto",
    "screenshot": "screenshot",
    "scroll": "scroll",
    "key": "key",
    "press": "key",
    "extract": "extract",
    "inspect": "inspect",
    "close": "close",
    "wait": "wait",
    "tabs": "tabs",
    "cursor_position": "screenshot",  # best-effort: no cursor API in /v1/execute
}

GATEWAY_BASE = os.environ.get("ACU_GATEWAY_URL", "http://localhost:8760")


# ---------------------------------------------------------------------------
# Legacy response types (used by PlanningLoop duck-type path)
# ---------------------------------------------------------------------------

class _Artifact:
    def __init__(self, type: str, content: Optional[str] = None,
                 path: Optional[str] = None, url: Optional[str] = None):
        self.type = type
        self.content = content
        self.path = path
        self.url = url


class _ResultEnvelope:
    def __init__(self, success: bool, action_type: str,
                 artifacts: List[_Artifact], raw: Dict[str, Any]):
        self.success = success
        self.action_type = action_type
        self.artifacts = artifacts
        self.raw = raw
        self.status = "completed" if success else "failed"
        self.error: Optional[str] = (
            raw.get("error", {}).get("message") if raw.get("error") else None
        )
        # Expose extracted_content directly so PlanningLoop can read it
        self.extracted_content = raw.get("extracted_content")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "success": self.success,
            "status": self.status,
            "action_type": self.action_type,
            "error": self.error,
            "extracted_content": self.extracted_content,
            "receipts": self.raw.get("receipts", []),
        }


# ---------------------------------------------------------------------------
# GatewayProxyAdapter
# ---------------------------------------------------------------------------

class GatewayProxyAdapter:
    """
    browser.playwright adapter — proxies through gateway's Playwright sessions.

    Compatible with both ComputerUseExecutor (3-arg execute) and PlanningLoop
    (1-arg duck-type execute). health_check() verifies the gateway is reachable
    and Playwright sessions are functional.
    """

    adapter_id = "browser.playwright"
    family = "browser"

    def __init__(self, gateway_url: Optional[str] = None):
        self._base = (gateway_url or GATEWAY_BASE).rstrip("/")

    # ── BaseAdapter interface (ComputerUseExecutor path) ─────────────────────

    async def initialize(self) -> None:
        pass  # stateless — gateway manages Playwright sessions

    async def close(self) -> None:
        pass

    async def health_check(self) -> bool:
        """
        True if the gateway can actually serve Playwright actions — not just
        that it's alive. Checks /health for active_sessions or verifies that a
        screenshot action against a probe session would succeed.

        Strategy: GET /health and require that Playwright is enabled AND the
        session manager reports no error. This avoids the false-positive where
        /health returns 200 but session_manager failed to initialize.
        """
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(f"{self._base}/health")
                if resp.status_code != 200:
                    return False
                data = resp.json()
                # Confirm playwright is enabled and session manager is functional
                if not data.get("playwright"):
                    return False
                sessions = data.get("sessions", {})
                # If sessions key is present and not an error dict, we're good
                if isinstance(sessions, dict) and "error" in sessions:
                    return False
                return True
        except Exception:
            return False

    async def capabilities(self) -> dict:
        return {
            "adapter_id": self.adapter_id,
            "family": self.family,
            "dom_tree": False,
            "vision_required": True,
            "code_execution": False,
            "file_access": False,
            "multi_tab": True,
            "platform": "any",
        }

    async def execute(self, action_or_req, session_id: Optional[str] = None,
                      run_id: Optional[str] = None):
        """
        Dual-mode execute:
          • 3-arg (executor): execute(action, session_id, run_id) → ResultEnvelope
          • 1-arg (planning loop): execute(req) → _ResultEnvelope
        """
        if session_id is not None:
            # Executor path — return a proper ResultEnvelope
            return await self._execute_for_executor(action_or_req, session_id, run_id or str(uuid.uuid4()))
        else:
            # PlanningLoop duck-type path — return _ResultEnvelope
            return await self._execute_legacy(action_or_req)

    # ── Executor path ─────────────────────────────────────────────────────────

    async def _execute_for_executor(self, action, session_id: str, run_id: str):
        # Import ResultEnvelope lazily to avoid circular imports at module load
        sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))
        try:
            from core.base_adapter import ResultEnvelope
        except ImportError:
            # Fallback: convert _ResultEnvelope to a dict-like object
            legacy = await self._execute_legacy(action)
            return legacy

        started_at = datetime.now(timezone.utc).isoformat()
        env = ResultEnvelope(
            run_id=run_id,
            session_id=session_id,
            adapter_id=self.adapter_id,
            family=self.family,
            mode="execute",
            action=action.action_type,
            target=getattr(action, "target", "") or "",
            status="running",
            started_at=started_at,
        )

        try:
            legacy = await self._execute_legacy(
                _LegacyReq(action.action_type, getattr(action, "target", "") or "",
                           getattr(action, "parameters", {}) or {},
                           session_id, run_id)
            )
            env.status = "completed" if legacy.success else "failed"
            env.extracted_content = legacy.extracted_content
            if legacy.error:
                env.error = {"code": "GATEWAY_ERROR", "message": legacy.error}
            # Promote screenshot data_url from artifacts into extracted_content
            if env.extracted_content is None:
                for art in legacy.artifacts:
                    if art.type == "screenshot" and art.content:
                        env.extracted_content = {
                            "data_url": f"data:image/png;base64,{art.content}"
                        }
                        break
        except Exception as exc:
            env.status = "failed"
            env.error = {"code": "PROXY_ERROR", "message": str(exc)}

        env.completed_at = datetime.now(timezone.utc).isoformat()
        return env

    # ── Legacy path (PlanningLoop) ────────────────────────────────────────────

    async def _execute_legacy(self, req) -> _ResultEnvelope:
        action_type = getattr(req, "action_type", "screenshot")
        gateway_action = ACTION_MAP.get(action_type, action_type)
        target = getattr(req, "target", "") or ""
        parameters = dict(getattr(req, "parameters", {}) or {})
        session_id = getattr(req, "session_id", "") or ""
        run_id = getattr(req, "run_id", None) or getattr(req, "action_id", None) or str(uuid.uuid4())

        body: Dict[str, Any] = {
            "action": gateway_action,
            "session_id": session_id,
            "run_id": run_id,
            "parameters": parameters,
        }
        if target:
            body["target"] = target

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(f"{self._base}/v1/execute", json=body)
                resp.raise_for_status()
                data = resp.json()
        except Exception as exc:
            logger.warning("[gateway-proxy] request failed: %s", exc)
            return _ResultEnvelope(
                success=False, action_type=action_type, artifacts=[],
                raw={"error": {"message": str(exc)}},
            )

        artifacts: List[_Artifact] = []
        for art in data.get("artifacts", []):
            content = art.get("content")
            art_url = art.get("url", "")
            if not content and art_url.startswith("data:"):
                content = art_url.split(",", 1)[-1]
            artifacts.append(_Artifact(
                type=art.get("type", "unknown"),
                content=content,
                path=art.get("path"),
                url=art_url,
            ))

        success = data.get("status") == "completed"
        return _ResultEnvelope(success=success, action_type=action_type,
                               artifacts=artifacts, raw=data)

    # ── Convenience (PlanningLoop screenshot helper) ──────────────────────────

    async def screenshot(self, session_id: str) -> bytes:
        req = _LegacyReq("screenshot", "", {}, session_id, str(uuid.uuid4()))
        result = await self._execute_legacy(req)
        for art in result.artifacts:
            if art.type == "screenshot" and art.content:
                try:
                    return base64.b64decode(art.content)
                except Exception as exc:
                    logger.warning("[gateway-proxy] screenshot b64decode failed: %s", exc)
        return b""


class _LegacyReq:
    """Minimal request object for the _execute_legacy path."""
    __slots__ = ("action_type", "target", "parameters", "session_id", "run_id")

    def __init__(self, action_type: str, target: str, parameters: dict,
                 session_id: str, run_id: str):
        self.action_type = action_type
        self.target = target
        self.parameters = parameters
        self.session_id = session_id
        self.run_id = run_id
