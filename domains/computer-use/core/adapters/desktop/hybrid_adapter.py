"""
Allternit Computer Use — Hybrid Adapter

Orchestrates browser + desktop actions in a single session.

Use case: open URL in browser → interact with native file picker/dialog → return to browser.

The adapter keeps a single PlaywrightAdapter alive across the entire session so
that browser state (cookies, navigation history, open pages) is preserved between
browser steps.  Desktop steps are executed via AccessibilityAdapter which is
stateless and can be called at any point without teardown.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional

from core import BaseAdapter, ActionRequest, ResultEnvelope

logger = logging.getLogger(__name__)


# ── Step model ────────────────────────────────────────────────────────────────

@dataclass
class HybridStep:
    surface: str    # "browser" or "desktop"
    action: str     # action type (goto, click, type_text, screenshot, …)
    params: Dict[str, Any] = field(default_factory=dict)


# ── Adapter ───────────────────────────────────────────────────────────────────

class HybridAdapter(BaseAdapter):
    """
    Dispatches a sequence of steps to browser (Playwright) or desktop
    (Accessibility) adapters.  The Playwright adapter is lazy-initialized and
    kept alive for the session's lifetime so the browser context persists.
    """

    ADAPTER_ID = "desktop.hybrid"

    def __init__(self) -> None:
        self._browser_adapter = None   # lazy-init PlaywrightAdapter
        self._desktop_adapter = None   # lazy-init AccessibilityAdapter
        self._initialized = False

    # ── BaseAdapter interface ─────────────────────────────────────────────────

    @property
    def adapter_id(self) -> str:
        return self.ADAPTER_ID

    @property
    def family(self) -> str:
        return "hybrid"

    async def initialize(self) -> None:
        """Pre-warm both sub-adapters (called lazily by execute_sequence)."""
        if self._initialized:
            return
        await self._ensure_desktop()
        # Browser adapter is initialized on first browser step to avoid launching
        # an unnecessary Chromium process when the sequence is desktop-only.
        self._initialized = True

    async def execute(self, action: ActionRequest, session_id: str, run_id: str) -> ResultEnvelope:
        """
        Single-action dispatch — routes to browser or desktop based on
        action.metadata['surface'] or action.parameters['surface'].
        Falls back to 'browser' if surface is not specified.
        """
        envelope = self._make_envelope(action, session_id, run_id)

        try:
            surface = action.parameters.get("surface", "browser")
            run_id_local = run_id

            if surface == "browser":
                adapter = await self._ensure_browser()
                result_env = await adapter.execute(action, session_id, run_id_local)
            elif surface == "desktop":
                # AccessibilityAdapter.execute takes (action, params) — wrap it
                adapter = await self._ensure_desktop()
                desktop_result = await adapter.execute(action.action_type, action.parameters)
                envelope.status = "completed" if desktop_result.get("success") else "failed"
                envelope.extracted_content = desktop_result
                envelope.completed_at = datetime.utcnow().isoformat()
                if not desktop_result.get("success"):
                    envelope.error = {
                        "code": "DESKTOP_ACTION_FAILED",
                        "message": desktop_result.get("error", "Desktop action failed"),
                        "adapter_id": self.ADAPTER_ID,
                    }
                self._emit_receipt(envelope, action, desktop_result)
                return envelope
            else:
                raise ValueError(
                    f"Unknown surface '{surface}' in hybrid action. Expected 'browser' or 'desktop'."
                )

            # Propagate result from the sub-adapter envelope
            envelope.status = result_env.status
            envelope.extracted_content = result_env.extracted_content
            envelope.artifacts = result_env.artifacts
            envelope.receipts = result_env.receipts
            envelope.error = result_env.error
            envelope.completed_at = result_env.completed_at

        except Exception as exc:
            envelope.status = "failed"
            envelope.error = {
                "code": "HYBRID_ERROR",
                "message": str(exc),
                "adapter_id": self.ADAPTER_ID,
            }
            envelope.completed_at = datetime.utcnow().isoformat()

        return envelope

    async def close(self) -> None:
        """Close the browser adapter; desktop adapter has no persistent resources."""
        if self._browser_adapter:
            try:
                await self._browser_adapter.close()
            except Exception as exc:
                logger.debug("HybridAdapter close browser error: %s", exc)
            self._browser_adapter = None

    # ── Public sequence API ───────────────────────────────────────────────────

    async def execute_sequence(
        self,
        steps: List[HybridStep],
        session_id: str,
    ) -> List[Dict[str, Any]]:
        """
        Execute a sequence of browser/desktop steps, returning a result dict
        for each step.  Steps are run sequentially; the browser context is
        preserved between browser steps.
        """
        results: List[Dict[str, Any]] = []

        for i, step in enumerate(steps):
            step_label = f"step[{i}] surface={step.surface} action={step.action}"
            try:
                if step.surface == "browser":
                    result = await self._run_browser_step(step, session_id)
                elif step.surface == "desktop":
                    result = await self._run_desktop_step(step)
                else:
                    result = {
                        "success": False,
                        "error": f"Unknown surface '{step.surface}' in step {i}",
                        "step": i,
                        "surface": step.surface,
                        "action": step.action,
                    }
                result["step"] = i
                results.append(result)

                if not result.get("success", True):
                    logger.warning("%s failed: %s", step_label, result.get("error"))

            except Exception as exc:
                logger.error("%s raised: %s", step_label, exc)
                results.append({
                    "success": False,
                    "error": str(exc),
                    "step": i,
                    "surface": step.surface,
                    "action": step.action,
                })

        return results

    # ── Internal step runners ─────────────────────────────────────────────────

    async def _run_browser_step(self, step: HybridStep, session_id: str) -> Dict[str, Any]:
        """Execute one browser step using the persistent PlaywrightAdapter."""
        adapter = await self._ensure_browser()
        run_id = f"hyb-br-{id(step):x}"

        action = ActionRequest(
            action_type=step.action,
            target=step.params.get("url") or step.params.get("selector") or step.params.get("target", ""),
            parameters=step.params,
            timeout_ms=int(step.params.get("timeout_ms", 30000)),
        )
        env = await adapter.execute(action, session_id, run_id)
        return {
            "success": env.status == "completed",
            "surface": "browser",
            "action": step.action,
            "extracted_content": env.extracted_content,
            "error": env.error.get("message") if env.error else None,
            "status": env.status,
        }

    async def _run_desktop_step(self, step: HybridStep) -> Dict[str, Any]:
        """Execute one desktop step using AccessibilityAdapter."""
        adapter = await self._ensure_desktop()
        result = await adapter.execute(step.action, step.params)
        return {
            "success": result.get("success", False),
            "surface": "desktop",
            "action": step.action,
            "extracted_content": result,
            "error": result.get("error") if not result.get("success") else None,
        }

    # ── Lazy adapter initializers ─────────────────────────────────────────────

    async def _ensure_browser(self):
        """Lazy-initialize the PlaywrightAdapter and keep it open."""
        if self._browser_adapter is None:
            from adapters.browser.playwright import PlaywrightAdapter
            self._browser_adapter = PlaywrightAdapter()
            await self._browser_adapter.initialize()
        return self._browser_adapter

    async def _ensure_desktop(self):
        """Lazy-initialize the AccessibilityAdapter."""
        if self._desktop_adapter is None:
            from adapters.desktop.accessibility_adapter import AccessibilityAdapter
            self._desktop_adapter = AccessibilityAdapter()
        return self._desktop_adapter
