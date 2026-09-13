"""
Allternit Computer Use — Playwright Adapter
Wraps the existing Playwright path from Allternit Operator browser manager.
"""

from core import BaseAdapter, ActionRequest, ResultEnvelope, Receipt
from datetime import datetime
from typing import Optional, Dict, Any
import os


class PlaywrightAdapter(BaseAdapter):
    """Deterministic browser automation via Playwright."""

    def __init__(self):
        self._browser = None
        self._page = None

    @property
    def adapter_id(self) -> str:
        return "browser.playwright"

    @property
    def family(self) -> str:
        return "browser"

    async def initialize(self) -> None:
        """Initialize Playwright browser"""
        try:
            from playwright.async_api import async_playwright
            self._pw = await async_playwright().start()
            self._browser = await self._pw.chromium.launch(
                headless=os.getenv("BROWSER_HEADLESS", "true").lower() == "true",
                args=["--no-sandbox", "--disable-dev-shm-usage"]
            )
        except ImportError:
            raise RuntimeError("Playwright not installed. Run: pip install playwright && playwright install chromium")

    async def execute(self, action: ActionRequest, session_id: str, run_id: str) -> ResultEnvelope:
        envelope = self._make_envelope(action, session_id, run_id)

        try:
            if not self._browser:
                await self.initialize()

            page = self._page or await self._browser.new_page()
            self._page = page

            result_data = {}

            if action.action_type == "goto":
                await page.goto(action.target, timeout=action.timeout_ms)
                result_data = {"url": page.url, "title": await page.title()}
                envelope.extracted_content = result_data

            elif action.action_type == "extract":
                result_data = {
                    "url": page.url,
                    "title": await page.title(),
                    "text": await page.evaluate("() => document.body.innerText"),
                    "html": await page.content(),
                }
                envelope.extracted_content = result_data

            elif action.action_type == "screenshot":
                # REST-facing screenshot: return PNG as artifact, metadata in extracted_content
                import base64
                screenshot = await page.screenshot()
                b64 = base64.b64encode(screenshot).decode("utf-8")
                from core import Artifact
                artifact = Artifact(type="screenshot", path=f"screenshots/{run_id}.png", size_bytes=len(screenshot), media_type="image/png")
                envelope.artifacts.append(artifact)
                result_data = {
                    "url": page.url,
                    "title": await page.title(),
                    "size": len(screenshot),
                    "screenshot_b64": b64,
                }
                envelope.extracted_content = result_data

            elif action.action_type == "capture_screen":
                # VisionLoop observe: screenshot_b64 must be in extracted_content
                import base64
                screenshot = await page.screenshot()
                b64 = base64.b64encode(screenshot).decode("utf-8")
                result_data = {
                    "screenshot_b64": b64,
                    "url": page.url,
                    "title": await page.title(),
                    "elements": [],
                    "text": await page.evaluate("() => document.body ? document.body.innerText : ''"),
                }
                envelope.extracted_content = result_data

            elif action.action_type == "act":
                selector = action.parameters.get("selector", action.target)
                text = action.parameters.get("text")
                if text:
                    await page.fill(selector, text)
                else:
                    await page.click(selector)
                result_data = {"selector": selector, "action": "fill" if text else "click"}
                envelope.extracted_content = result_data

            elif action.action_type == "eval":
                script = action.parameters.get("script") or action.parameters.get("expression") or action.target
                eval_result = await page.evaluate(script)
                result_data = {"result": eval_result}
                envelope.extracted_content = eval_result

            elif action.action_type == "observe":
                import base64
                screenshot_b64 = ""
                try:
                    png = await page.screenshot()
                    screenshot_b64 = base64.b64encode(png).decode("utf-8")
                except Exception:
                    pass
                result_data = {
                    "url": page.url,
                    "title": await page.title(),
                    "screenshot_b64": screenshot_b64,
                    "elements": [],
                    "text": await page.evaluate("() => document.body ? document.body.innerText : ''"),
                }
                envelope.extracted_content = result_data

            else:
                result_data = {"note": f"Action '{action.action_type}' delegated to base playwright page"}

            envelope.status = "completed"
            envelope.completed_at = datetime.utcnow().isoformat()

            receipt = self._emit_receipt(envelope, action, result_data)

        except Exception as e:
            envelope.status = "failed"
            envelope.error = {"code": "PLAYWRIGHT_ERROR", "message": str(e), "adapter_id": self.adapter_id}
            envelope.completed_at = datetime.utcnow().isoformat()

        return envelope

    async def close(self) -> None:
        if self._browser:
            await self._browser.close()
        if hasattr(self, '_pw') and self._pw:
            await self._pw.stop()
