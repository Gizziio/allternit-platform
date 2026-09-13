"""
Remote CDP browser adapter for allternit-computer-use.

Connects to a Chrome/Chromium instance running on a remote host (e.g. an
Incus container desktop) via Playwright's connect_over_cdp. The target
endpoint is supplied per-action in ``parameters.cdp_url`` so the same
adapter can drive many remote desktops without process-level state.

Intended for the heterogeneous Allternit desktop-cloud MVP where the bot
desktop is an Incus container and the ACU gateway may run elsewhere on the
Tailscale mesh.
"""

from __future__ import annotations

import base64
import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Tuple

from core.base_adapter import ActionRequest, AdapterCapabilities, BaseAdapter, ResultEnvelope

logger = logging.getLogger(__name__)


class RemoteCDPAdapter(BaseAdapter):
    """
    ``browser.remote-cdp`` — remote Playwright-over-CDP adapter.

    Endpoint resolution order:
      1. ``action.parameters["cdp_url"]``
      2. ``os.environ["ACU_CDP_URL"]``

    Connections are cached per ``(session_id, cdp_url)`` so a multi-step run
    reuses the same browser tab.
    """

    def __init__(self) -> None:
        self._sessions: Dict[Tuple[str, str], Tuple[Any, Any, Any]] = {}

    @property
    def adapter_id(self) -> str:
        return "browser.remote-cdp"

    @property
    def family(self) -> str:
        return "browser"

    async def initialize(self) -> None:
        return

    async def close(self) -> None:
        for playwright, browser, _ in self._sessions.values():
            try:
                await browser.close()
            except Exception:
                pass
            try:
                await playwright.stop()
            except Exception:
                pass
        self._sessions.clear()

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

    async def health_check(self) -> bool:
        return True

    def _cdp_url(self, action: ActionRequest) -> Optional[str]:
        return action.parameters.get("cdp_url") or os.environ.get("ACU_CDP_URL")

    async def _page(self, session_id: str, cdp_url: str) -> Any:
        key = (session_id, cdp_url)
        cached = self._sessions.get(key)
        if cached is not None:
            _, _, page = cached
            try:
                await page.title()
                return page
            except Exception:
                logger.warning("[remote-cdp] cached page disconnected, reconnecting")
                await self._drop_session(key)

        from playwright.async_api import async_playwright

        playwright = await async_playwright().start()
        browser = await playwright.chromium.connect_over_cdp(cdp_url)
        contexts = browser.contexts
        if contexts and contexts[0].pages:
            page = contexts[0].pages[0]
        else:
            ctx = contexts[0] if contexts else await browser.new_context()
            page = await ctx.new_page()

        logger.info("[remote-cdp] connected to %s for session %s", cdp_url, session_id)
        self._sessions[key] = (playwright, browser, page)
        return page

    async def _drop_session(self, key: Tuple[str, str]) -> None:
        entry = self._sessions.pop(key, None)
        if not entry:
            return
        playwright, browser, _ = entry
        try:
            await browser.close()
        except Exception:
            pass
        try:
            await playwright.stop()
        except Exception:
            pass

    async def execute(self, action: ActionRequest, session_id: str, run_id: str) -> ResultEnvelope:
        envelope = self._make_envelope(action, session_id, run_id)
        cdp_url = self._cdp_url(action)
        if not cdp_url:
            envelope.status = "failed"
            envelope.error = {"code": "MISSING_CDP_URL", "message": "parameters.cdp_url or ACU_CDP_URL required"}
            envelope.completed_at = datetime.now(timezone.utc).isoformat()
            return envelope

        try:
            result = await self._dispatch(action, session_id, cdp_url)
            envelope.status = "completed"
            envelope.extracted_content = result or None
            envelope.completed_at = datetime.now(timezone.utc).isoformat()
            self._emit_receipt(envelope, action, result or {})
        except Exception as exc:
            logger.warning("[remote-cdp] %s error: %s", action.action_type, exc)
            envelope.status = "failed"
            envelope.error = {"code": "REMOTE_CDP_ERROR", "message": str(exc)}
            envelope.completed_at = datetime.now(timezone.utc).isoformat()
        return envelope

    async def _dispatch(self, action: ActionRequest, session_id: str, cdp_url: str) -> Optional[Dict[str, Any]]:
        p = action.parameters
        at = action.action_type
        page = await self._page(session_id, cdp_url)

        if at == "screenshot":
            raw = await page.screenshot(type="png", full_page=p.get("full_page", False))
            b64 = base64.b64encode(raw).decode()
            return {"data_url": f"data:image/png;base64,{b64}", "size_bytes": len(raw)}

        if at == "navigate":
            url = action.target or p.get("url", "")
            await page.goto(url, wait_until=p.get("wait_until", "domcontentloaded"))
            return {"url": page.url, "title": await page.title()}

        if at == "left_click":
            x, y = p.get("x"), p.get("y")
            if x is not None and y is not None:
                await page.mouse.click(float(x), float(y))
            else:
                await page.click(action.target or p.get("selector", ""))
            return {}

        if at == "right_click":
            x, y = p.get("x"), p.get("y")
            if x is not None and y is not None:
                await page.mouse.click(float(x), float(y), button="right")
            else:
                await page.click(action.target or p.get("selector", ""), button="right")
            return {}

        if at == "double_click":
            x, y = p.get("x"), p.get("y")
            if x is not None and y is not None:
                await page.mouse.dblclick(float(x), float(y))
            else:
                await page.dblclick(action.target or p.get("selector", ""))
            return {}

        if at == "left_click_drag":
            sx, sy = p.get("startX", p.get("x", 0)), p.get("startY", p.get("y", 0))
            ex, ey = p.get("endX", 0), p.get("endY", 0)
            await page.mouse.move(float(sx), float(sy))
            await page.mouse.down()
            await page.mouse.move(float(ex), float(ey))
            await page.mouse.up()
            return {}

        if at == "type":
            text = p.get("text", action.target or "")
            await page.keyboard.type(text)
            return {"chars_typed": len(text)}

        if at == "key":
            key = p.get("key", action.target or "")
            await page.keyboard.press(key)
            return {"key": key}

        if at == "scroll":
            x = float(p.get("x", 0))
            y = float(p.get("y", 0))
            dx = p.get("deltaX", 0)
            dy = p.get("deltaY", p.get("delta", 0))
            await page.mouse.move(x, y)
            await page.mouse.wheel(dx, dy)
            return {"deltaX": dx, "deltaY": dy}

        if at == "cursor_position":
            pos = await page.evaluate("""() => {
                if (!window.__acu_mouse) window.__acu_mouse = {x: 0, y: 0};
                if (!window.__acu_mouse_tracked) {
                    window.__acu_mouse_tracked = true;
                    document.addEventListener('mousemove', (e) => {
                        window.__acu_mouse = {x: e.clientX, y: e.clientY};
                    }, {passive: true});
                }
                return window.__acu_mouse;
            }""")
            return pos or {"x": 0, "y": 0}

        if at == "extract":
            fmt = p.get("format", "text")
            sel = action.target or p.get("selector")
            if fmt == "text":
                content = await page.inner_text(sel) if sel else await page.evaluate("() => document.body.innerText")
            elif fmt == "html":
                content = await page.inner_html(sel) if sel else await page.content()
            else:
                content = await page.evaluate("() => ({title: document.title, url: location.href})")
            return {"content": content, "format": fmt}

        if at == "fill":
            sel = action.target or p.get("selector", "")
            text = p.get("text", "")
            await page.fill(sel, text)
            return {}

        if at == "wait":
            import asyncio
            ms = p.get("ms", 1000)
            await asyncio.sleep(ms / 1000)
            return {"waited_ms": ms}

        if at == "tabs":
            pages = page.context.pages if page.context else []
            return {"tabs": [{"url": pg.url, "title": await pg.title()} for pg in pages]}

        raise RuntimeError(f"Unsupported action: {at!r}")
