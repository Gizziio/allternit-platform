"""
Allternit Computer Use — DOM/Accessibility Tree Adapter

Uses Playwright's accessibility snapshot and DOM tree for element location.
4x more token-efficient than vision-based approaches for structured pages.
Falls back to coordinate-based actions when DOM structure is insufficient.

Inspired by: Playwright MCP (microsoft/playwright-mcp), SeeClick
"""

from __future__ import annotations

import asyncio
import base64
import json
import logging
import uuid
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

try:
    from playwright.async_api import async_playwright, Page, Browser, BrowserContext, ElementHandle
    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    PLAYWRIGHT_AVAILABLE = False
    Page = Any
    Browser = Any


@dataclass
class DOMElement:
    """Simplified DOM/accessibility element."""
    role: str
    name: str
    selector: Optional[str] = None
    text: Optional[str] = None
    value: Optional[str] = None
    placeholder: Optional[str] = None
    checked: Optional[bool] = None
    disabled: bool = False
    level: int = 0                  # nesting level
    children: List["DOMElement"] = None

    def __post_init__(self):
        if self.children is None:
            self.children = []

    def to_dict(self) -> Dict:
        return {
            "role": self.role,
            "name": self.name,
            "selector": self.selector,
            "text": self.text,
            "value": self.value,
            "placeholder": self.placeholder,
            "checked": self.checked,
            "disabled": self.disabled,
        }

    def matches(self, description: str) -> bool:
        """Fuzzy match against a natural language description."""
        desc_lower = description.lower()
        candidates = [
            self.name or "",
            self.text or "",
            self.placeholder or "",
            self.role or "",
            self.value or "",
        ]
        return any(desc_lower in c.lower() for c in candidates if c)


@dataclass
class AccessibilitySnapshot:
    """Full accessibility tree snapshot of a page."""
    url: str
    title: str
    elements: List[DOMElement]
    raw_tree: Optional[Dict] = None

    def find(self, description: str, role: Optional[str] = None) -> Optional[DOMElement]:
        """Find element by description, optionally filtered by role."""
        for el in self.elements:
            if role and el.role.lower() != role.lower():
                continue
            if el.matches(description):
                return el
        return None

    def find_all(self, description: str) -> List[DOMElement]:
        return [el for el in self.elements if el.matches(description)]

    def to_compact_text(self, max_elements: int = 100) -> str:
        """Compact text representation for LLM context (DOM-first strategy)."""
        lines = [f"URL: {self.url}", f"Title: {self.title}", "Elements:"]
        for el in self.elements[:max_elements]:
            indent = "  " * min(el.level, 4)
            label = el.name or el.text or el.placeholder or ""
            value = f" = '{el.value}'" if el.value else ""
            disabled = " [disabled]" if el.disabled else ""
            lines.append(f"{indent}[{el.role}] {label}{value}{disabled}")
        return "\n".join(lines)


class DomMcpAdapter:
    """
    DOM + Accessibility Tree browser adapter.

    Strategy (DOM-first with vision fallback):
    1. Get accessibility snapshot via Playwright
    2. Find element by description in snapshot (zero LLM calls)
    3. If not found, fall back to vision coordinates
    4. Execute action via Playwright

    This is the Playwright MCP approach — structured DOM eliminates
    most vision API calls for standard web pages.
    """

    ADAPTER_ID = "browser.dom_mcp"

    def __init__(
        self,
        headless: bool = True,
        viewport: Tuple[int, int] = (1280, 720),
        timeout_ms: int = 30000,
    ):
        if not PLAYWRIGHT_AVAILABLE:
            raise ImportError("playwright not installed: pip install playwright && playwright install chromium")
        self.headless = headless
        self.viewport = viewport
        self.timeout_ms = timeout_ms
        self._playwright = None
        self._browser: Optional[Browser] = None
        self._context: Optional[BrowserContext] = None
        self._page: Optional[Page] = None

    async def initialize(self) -> None:
        if self._browser:
            return
        self._playwright = await async_playwright().start()
        self._browser = await self._playwright.chromium.launch(headless=self.headless)
        self._context = await self._browser.new_context(
            viewport={"width": self.viewport[0], "height": self.viewport[1]},
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        )
        self._page = await self._context.new_page()
        self._page.set_default_timeout(self.timeout_ms)

    async def close(self) -> None:
        if self._browser:
            await self._browser.close()
            self._browser = None
        if self._playwright:
            await self._playwright.stop()
            self._playwright = None

    async def navigate(self, url: str) -> Dict[str, str]:
        await self.initialize()
        await self._page.goto(url, wait_until="domcontentloaded")
        return {"url": self._page.url, "title": await self._page.title()}

    async def get_accessibility_snapshot(self) -> AccessibilitySnapshot:
        """Get full accessibility tree snapshot of current page."""
        await self.initialize()
        raw = await self._page.accessibility.snapshot(interesting_only=True)
        elements = _flatten_a11y_tree(raw) if raw else []
        return AccessibilitySnapshot(
            url=self._page.url,
            title=await self._page.title(),
            elements=elements,
            raw_tree=raw,
        )

    async def get_dom_tree(self, max_depth: int = 5) -> str:
        """Get compact DOM representation as text."""
        await self.initialize()
        snapshot = await self.get_accessibility_snapshot()
        return snapshot.to_compact_text()

    async def find_element(self, description: str, strategy: str = "auto") -> Optional[Dict]:
        """
        Find element by natural language description.
        strategy: "auto" | "dom" | "vision"
        Returns element info dict or None.
        """
        await self.initialize()

        if strategy in ("auto", "dom"):
            snapshot = await self.get_accessibility_snapshot()
            el = snapshot.find(description)
            if el and el.selector:
                return {"found": True, "strategy": "dom", "element": el.to_dict(), "selector": el.selector}
            elif el:
                # Try to locate via Playwright role+name
                try:
                    role = el.role.lower()
                    name = el.name or el.text or ""
                    locator = self._page.get_by_role(role, name=name)
                    count = await locator.count()
                    if count > 0:
                        box = await locator.first.bounding_box()
                        if box:
                            return {
                                "found": True,
                                "strategy": "dom",
                                "element": el.to_dict(),
                                "coordinates": [box["x"] + box["width"] / 2, box["y"] + box["height"] / 2],
                            }
                except Exception:
                    pass

        # Fallback: return snapshot text for vision-based grounding
        snapshot = await self.get_accessibility_snapshot()
        return {
            "found": False,
            "strategy": "dom_snapshot",
            "dom_text": snapshot.to_compact_text(50),
            "message": f"Element '{description}' not found in DOM tree. Use vision grounding.",
        }

    async def click(self, selector: Optional[str] = None, x: Optional[int] = None, y: Optional[int] = None,
                    description: Optional[str] = None, button: str = "left", double: bool = False) -> Dict:
        """Click by selector, coordinates, or natural language description."""
        await self.initialize()
        try:
            if description and not selector and x is None:
                found = await self.find_element(description)
                if found and found.get("found"):
                    selector = found.get("selector")
                    if not selector and found.get("coordinates"):
                        coords = found["coordinates"]
                        x, y = int(coords[0]), int(coords[1])

            if selector:
                locator = self._page.locator(selector)
                if double:
                    await locator.dbl_click(button=button)
                else:
                    await locator.click(button=button)
            elif x is not None and y is not None:
                if double:
                    await self._page.mouse.dblclick(x, y, button=button)
                else:
                    await self._page.mouse.click(x, y, button=button)
            else:
                return {"success": False, "error": "No selector, coordinates, or description provided"}

            return {"success": True, "action": "click", "selector": selector, "x": x, "y": y}
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def type_text(self, text: str, selector: Optional[str] = None,
                         description: Optional[str] = None, delay_ms: int = 0) -> Dict:
        """Type text into an element."""
        await self.initialize()
        try:
            if description and not selector:
                found = await self.find_element(description)
                if found and found.get("found"):
                    selector = found.get("selector")

            if selector:
                await self._page.locator(selector).fill(text)
            else:
                await self._page.keyboard.type(text, delay=delay_ms)
            return {"success": True, "action": "type", "text": text[:50]}
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def press_key(self, keys: str) -> Dict:
        await self.initialize()
        try:
            await self._page.keyboard.press(keys)
            return {"success": True, "action": "key", "keys": keys}
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def scroll(self, x: int, y: int, direction: str, amount: int = 3) -> Dict:
        await self.initialize()
        try:
            delta_y = -120 * amount if direction == "up" else 120 * amount if direction == "down" else 0
            delta_x = -120 * amount if direction == "left" else 120 * amount if direction == "right" else 0
            await self._page.mouse.wheel(delta_x, delta_y)
            return {"success": True, "action": "scroll", "direction": direction}
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def screenshot(self, full_page: bool = False) -> bytes:
        await self.initialize()
        return await self._page.screenshot(full_page=full_page)

    async def screenshot_b64(self, full_page: bool = False) -> str:
        data = await self.screenshot(full_page)
        return base64.b64encode(data).decode("utf-8")

    async def read_screen(self) -> str:
        """Read current page as structured text (accessibility tree)."""
        return await self.get_dom_tree()

    async def get_url(self) -> str:
        await self.initialize()
        return self._page.url

    async def get_title(self) -> str:
        await self.initialize()
        return await self._page.title()

    async def execute_js(self, code: str) -> Any:
        await self.initialize()
        return await self._page.evaluate(code)

    async def health_check(self) -> bool:
        try:
            await self.initialize()
            return self._page is not None
        except Exception:
            return False

    async def capabilities(self) -> Dict:
        return {
            "adapter_id": self.ADAPTER_ID,
            "dom_tree": True,
            "vision_required": False,
            "code_execution": False,
            "file_access": False,
            "auth_flows": False,
            "multi_tab": True,
            "platform": "any",
        }


def _flatten_a11y_tree(node: Dict, level: int = 0) -> List[DOMElement]:
    """Recursively flatten Playwright accessibility tree."""
    elements = []
    if not node:
        return elements

    role = node.get("role", "")
    name = node.get("name", "")

    # Skip purely structural/invisible nodes
    skip_roles = {"generic", "none", "presentation", "InlineTextBox"}
    if role not in skip_roles and (name or role in {"link", "button", "textbox", "checkbox", "radio", "combobox", "listitem", "menuitem", "option", "tab"}):
        el = DOMElement(
            role=role,
            name=name,
            text=node.get("value", ""),
            value=node.get("value"),
            placeholder=node.get("placeholder"),
            checked=node.get("checked"),
            disabled=node.get("disabled", False),
            level=level,
        )
        elements.append(el)

    for child in node.get("children", []):
        elements.extend(_flatten_a11y_tree(child, level + 1))

    return elements
