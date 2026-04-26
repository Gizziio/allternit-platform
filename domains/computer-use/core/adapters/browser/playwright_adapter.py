"""
Playwright browser adapter for allternit-computer-use.

Provides automated browser management with Playwright, including:
- Automatic browser launch
- Screenshot capture
- Page navigation
- Element interaction
"""

import os
import base64
import asyncio
from typing import Optional, Dict, Any, Callable, Union, List
from pathlib import Path
from dataclasses import dataclass
from enum import Enum
import logging

# Optional imports - handled gracefully
try:
    from playwright.async_api import async_playwright, Page, Browser, BrowserContext
    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    PLAYWRIGHT_AVAILABLE = False
    Page = Any
    Browser = Any
    BrowserContext = Any

try:
    from PIL import Image
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False

from .setup import ensure_browser_available, get_playwright_browsers_status

logger = logging.getLogger(__name__)


class BrowserType(Enum):
    """Supported browser types."""
    CHROMIUM = "chromium"
    FIREFOX = "firefox"
    WEBKIT = "webkit"


@dataclass
class Viewport:
    """Browser viewport configuration."""
    width: int = 1280
    height: int = 720
    
    def to_dict(self) -> Dict[str, int]:
        return {"width": self.width, "height": self.height}


@dataclass
class BrowserConfig:
    """Browser configuration options."""
    browser_type: BrowserType = BrowserType.CHROMIUM
    headless: bool = True
    viewport: Viewport = None
    slow_mo: Optional[int] = None
    timeout: int = 30000
    
    def __post_init__(self):
        if self.viewport is None:
            self.viewport = Viewport()


class PlaywrightAdapter:
    """
    Playwright-based browser adapter with automatic browser management.
    
    Features:
    - Automatic browser launch if not running
    - Screenshot capture
    - Page navigation
    - Element interaction
    """
    
    def __init__(self, config: Optional[BrowserConfig] = None):
        """
        Initialize the Playwright adapter.
        
        Args:
            config: Browser configuration. Uses defaults if not provided.
        """
        if not PLAYWRIGHT_AVAILABLE:
            raise ImportError(
                "Playwright is not installed. "
                "Install with: pip install allternit-computer-use[browser]"
            )
        
        self.config = config or BrowserConfig()
        self._playwright = None
        self._browser: Optional[Browser] = None
        self._context: Optional[BrowserContext] = None
        self._page: Optional[Page] = None
        self._is_running = False
    
    async def __aenter__(self):
        """Async context manager entry."""
        await self.start()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        await self.stop()
    
    async def start(self) -> "PlaywrightAdapter":
        """
        Start the browser if not already running.
        
        Returns:
            Self for method chaining.
        """
        if self._is_running:
            return self
        
        # Ensure browser is available
        browser_type = self.config.browser_type.value
        if not ensure_browser_available(browser_type):
            raise RuntimeError(
                f"{browser_type} is not available. "
                f"Run: playwright install {browser_type}"
            )
        
        logger.info(f"Starting {browser_type} browser (headless={self.config.headless})")
        
        self._playwright = await async_playwright().start()
        
        # Get browser type
        browser_launcher = getattr(self._playwright, browser_type)
        
        # Launch browser
        launch_options = {
            "headless": self.config.headless,
        }
        
        if self.config.slow_mo:
            launch_options["slow_mo"] = self.config.slow_mo
        
        self._browser = await browser_launcher.launch(**launch_options)
        
        # Create context with viewport
        self._context = await self._browser.new_context(
            viewport=self.config.viewport.to_dict()
        )
        
        # Create page
        self._page = await self._context.new_page()
        self._page.set_default_timeout(self.config.timeout)
        
        self._is_running = True
        logger.info("Browser started successfully")
        
        return self
    
    async def stop(self) -> None:
        """Stop the browser and clean up resources."""
        logger.info("Stopping browser...")
        
        if self._page:
            await self._page.close()
            self._page = None
        
        if self._context:
            await self._context.close()
            self._context = None
        
        if self._browser:
            await self._browser.close()
            self._browser = None
        
        if self._playwright:
            await self._playwright.stop()
            self._playwright = None
        
        self._is_running = False
        logger.info("Browser stopped")
    
    @property
    def is_running(self) -> bool:
        """Check if browser is running."""
        return self._is_running and self._page is not None
    
    @property
    def page(self) -> Optional[Page]:
        """Get the current page."""
        return self._page
    
    async def ensure_running(self) -> None:
        """Ensure browser is running, start if not."""
        if not self.is_running:
            await self.start()
    
    # Navigation methods
    
    async def navigate(self, url: str, wait_until: str = "networkidle") -> None:
        """
        Navigate to a URL.
        
        Args:
            url: URL to navigate to.
            wait_until: When to consider navigation complete.
                       Options: load, domcontentloaded, networkidle, commit
        """
        await self.ensure_running()
        logger.info(f"Navigating to: {url}")
        await self._page.goto(url, wait_until=wait_until)
    
    async def go_back(self) -> None:
        """Go back in browser history."""
        await self.ensure_running()
        await self._page.go_back()
    
    async def go_forward(self) -> None:
        """Go forward in browser history."""
        await self.ensure_running()
        await self._page.go_forward()
    
    async def reload(self) -> None:
        """Reload the current page."""
        await self.ensure_running()
        await self._page.reload()
    
    async def get_url(self) -> str:
        """Get the current page URL."""
        await self.ensure_running()
        return self._page.url
    
    async def get_title(self) -> str:
        """Get the current page title."""
        await self.ensure_running()
        return await self._page.title()
    
    # Screenshot methods
    
    async def screenshot(
        self,
        path: Optional[str] = None,
        full_page: bool = False,
        selector: Optional[str] = None,
        encoding: str = "png"
    ) -> Union[str, bytes]:
        """
        Take a screenshot of the page.
        
        Args:
            path: File path to save screenshot. If None, returns bytes/base64.
            full_page: Whether to capture full page or just viewport.
            selector: CSS selector to capture specific element.
            encoding: Output encoding (png, jpeg, or base64).
        
        Returns:
            Screenshot as bytes, base64 string, or file path.
        """
        await self.ensure_running()
        
        screenshot_options = {
            "type": encoding if encoding != "base64" else "png",
            "full_page": full_page,
        }
        
        if selector:
            element = await self._page.query_selector(selector)
            if not element:
                raise ValueError(f"Element not found: {selector}")
            screenshot_bytes = await element.screenshot()
        else:
            screenshot_bytes = await self._page.screenshot(**screenshot_options)
        
        if path:
            Path(path).parent.mkdir(parents=True, exist_ok=True)
            with open(path, "wb") as f:
                f.write(screenshot_bytes)
            return path
        
        if encoding == "base64":
            return base64.b64encode(screenshot_bytes).decode("utf-8")
        
        return screenshot_bytes
    
    async def screenshot_base64(self, full_page: bool = False) -> str:
        """
        Take a screenshot and return as base64 string.
        
        Args:
            full_page: Whether to capture full page.
        
        Returns:
            Base64-encoded screenshot.
        """
        return await self.screenshot(full_page=full_page, encoding="base64")
    
    # Element interaction methods
    
    async def click(
        self,
        selector: str,
        button: str = "left",
        click_count: int = 1,
        delay: Optional[int] = None
    ) -> None:
        """
        Click an element.
        
        Args:
            selector: CSS selector for the element.
            button: Mouse button (left, right, middle).
            click_count: Number of clicks.
            delay: Delay between mousedown and mouseup in milliseconds.
        """
        await self.ensure_running()
        logger.info(f"Clicking element: {selector}")
        
        options = {"button": button, "click_count": click_count}
        if delay:
            options["delay"] = delay
        
        await self._page.click(selector, **options)
    
    async def fill(self, selector: str, text: str, clear_first: bool = True) -> None:
        """
        Fill an input field.
        
        Args:
            selector: CSS selector for the input element.
            text: Text to fill.
            clear_first: Whether to clear the field first.
        """
        await self.ensure_running()
        logger.info(f"Filling element {selector} with text")
        
        if clear_first:
            await self._page.fill(selector, text)
        else:
            await self._page.type(selector, text)
    
    async def type_text(
        self,
        selector: str,
        text: str,
        delay: Optional[int] = None
    ) -> None:
        """
        Type text into an element (character by character).
        
        Args:
            selector: CSS selector for the element.
            text: Text to type.
            delay: Delay between keystrokes in milliseconds.
        """
        await self.ensure_running()
        logger.info(f"Typing text into element: {selector}")
        
        options = {}
        if delay:
            options["delay"] = delay
        
        await self._page.type(selector, text, **options)
    
    async def press(self, key: str, selector: Optional[str] = None) -> None:
        """
        Press a keyboard key.
        
        Args:
            key: Key to press (e.g., 'Enter', 'ArrowDown', 'Control+a').
            selector: Optional CSS selector to focus before pressing.
        """
        await self.ensure_running()
        
        if selector:
            await self._page.press(selector, key)
        else:
            await self._page.keyboard.press(key)
    
    async def hover(self, selector: str) -> None:
        """
        Hover over an element.
        
        Args:
            selector: CSS selector for the element.
        """
        await self.ensure_running()
        await self._page.hover(selector)
    
    async def scroll_to(self, selector: Optional[str] = None, x: int = 0, y: int = 0) -> None:
        """
        Scroll to an element or position.
        
        Args:
            selector: CSS selector to scroll to. If None, scrolls to position.
            x: X coordinate to scroll to.
            y: Y coordinate to scroll to.
        """
        await self.ensure_running()
        
        if selector:
            await self._page.evaluate(
                "(selector) => document.querySelector(selector).scrollIntoView()",
                selector
            )
        else:
            await self._page.evaluate(f"() => window.scrollTo({x}, {y})")
    
    async def select_option(
        self,
        selector: str,
        value: Optional[str] = None,
        label: Optional[str] = None,
        index: Optional[int] = None
    ) -> None:
        """
        Select an option from a dropdown.
        
        Args:
            selector: CSS selector for the select element.
            value: Option value to select.
            label: Option label to select.
            index: Option index to select.
        """
        await self.ensure_running()
        
        options = {}
        if value:
            options["value"] = value
        elif label:
            options["label"] = label
        elif index is not None:
            options["index"] = index
        
        await self._page.select_option(selector, **options)
    
    # Element query methods
    
    async def get_text(self, selector: str) -> str:
        """
        Get text content of an element.
        
        Args:
            selector: CSS selector for the element.
        
        Returns:
            Element text content.
        """
        await self.ensure_running()
        element = await self._page.query_selector(selector)
        if not element:
            raise ValueError(f"Element not found: {selector}")
        return await element.text_content()
    
    async def get_attribute(self, selector: str, attribute: str) -> Optional[str]:
        """
        Get an attribute value of an element.
        
        Args:
            selector: CSS selector for the element.
            attribute: Attribute name.
        
        Returns:
            Attribute value or None.
        """
        await self.ensure_running()
        return await self._page.get_attribute(selector, attribute)
    
    async def is_visible(self, selector: str) -> bool:
        """
        Check if an element is visible.
        
        Args:
            selector: CSS selector for the element.
        
        Returns:
            True if visible, False otherwise.
        """
        await self.ensure_running()
        element = await self._page.query_selector(selector)
        if not element:
            return False
        return await element.is_visible()
    
    async def wait_for_selector(
        self,
        selector: str,
        state: str = "visible",
        timeout: Optional[int] = None
    ) -> None:
        """
        Wait for an element to appear.
        
        Args:
            selector: CSS selector to wait for.
            state: State to wait for (attached, detached, visible, hidden).
            timeout: Timeout in milliseconds.
        """
        await self.ensure_running()
        
        options = {"state": state}
        if timeout:
            options["timeout"] = timeout
        
        await self._page.wait_for_selector(selector, **options)
    
    async def wait_for_load_state(self, state: str = "networkidle") -> None:
        """
        Wait for page load state.
        
        Args:
            state: Load state to wait for (load, domcontentloaded, networkidle).
        """
        await self.ensure_running()
        await self._page.wait_for_load_state(state)
    
    # JavaScript execution
    
    async def evaluate(self, expression: str, *args) -> Any:
        """
        Execute JavaScript on the page.
        
        Args:
            expression: JavaScript expression to execute.
            *args: Arguments to pass to the expression.
        
        Returns:
            Result of the JavaScript execution.
        """
        await self.ensure_running()
        return await self._page.evaluate(expression, *args)
    
    # Utility methods
    
    async def get_page_content(self) -> str:
        """Get the full HTML content of the page."""
        await self.ensure_running()
        return await self._page.content()
    
    async def set_viewport(self, width: int, height: int) -> None:
        """
        Set the viewport size.
        
        Args:
            width: Viewport width.
            height: Viewport height.
        """
        await self.ensure_running()
        await self._page.set_viewport_size({"width": width, "height": height})
    
    async def new_tab(self, url: Optional[str] = None) -> Page:
        """
        Open a new tab.
        
        Args:
            url: Optional URL to navigate to.
        
        Returns:
            The new page object.
        """
        await self.ensure_running()
        new_page = await self._context.new_page()
        
        if url:
            await new_page.goto(url)
        
        return new_page
    
    async def close_tab(self, page: Optional[Page] = None) -> None:
        """
        Close a tab.

        Args:
            page: Page to close. If None, closes current page.
        """
        target_page = page or self._page
        if target_page:
            await target_page.close()

    async def get_accessibility_tree(self, interesting_only: bool = True) -> Dict:
        """Get Playwright accessibility snapshot of current page."""
        if not self._page:
            return {}
        try:
            return await self._page.accessibility.snapshot(interesting_only=interesting_only) or {}
        except Exception as e:
            logger.warning(f"Accessibility snapshot failed: {e}")
            return {}

    async def get_dom_tree(self, max_elements: int = 100) -> str:
        """Get compact DOM/accessibility text representation for LLM context."""
        tree = await self.get_accessibility_tree()
        if not tree:
            return "No accessibility tree available"
        lines = [f"URL: {self._page.url if self._page else 'unknown'}"]
        self._flatten_tree_text(tree, lines, depth=0, max_elements=max_elements, count=[0])
        return "\n".join(lines)

    def _flatten_tree_text(self, node: Dict, lines: List[str], depth: int, max_elements: int, count: List[int]) -> None:
        if count[0] >= max_elements:
            return
        role = node.get("role", "")
        name = node.get("name", "")
        skip = {"generic", "none", "presentation", "InlineTextBox", "group"}
        if role not in skip and name:
            indent = "  " * min(depth, 5)
            lines.append(f"{indent}[{role}] {name}")
            count[0] += 1
        for child in node.get("children", []):
            self._flatten_tree_text(child, lines, depth + 1, max_elements, count)


class SyncPlaywrightAdapter:
    """Synchronous wrapper for PlaywrightAdapter."""
    
    def __init__(self, config: Optional[BrowserConfig] = None):
        self._adapter = PlaywrightAdapter(config)
        self._loop: Optional[asyncio.AbstractEventLoop] = None
    
    def _get_loop(self) -> asyncio.AbstractEventLoop:
        """Get or create event loop."""
        try:
            return asyncio.get_running_loop()
        except RuntimeError:
            if self._loop is None or self._loop.is_closed():
                self._loop = asyncio.new_event_loop()
            return self._loop
    
    def _run(self, coro):
        """Run coroutine in the event loop."""
        loop = self._get_loop()
        return loop.run_until_complete(coro)
    
    def start(self) -> "SyncPlaywrightAdapter":
        """Start the browser."""
        self._run(self._adapter.start())
        return self
    
    def stop(self) -> None:
        """Stop the browser."""
        self._run(self._adapter.stop())
        if self._loop and not self._loop.is_closed():
            self._loop.close()
    
    def __enter__(self):
        self.start()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.stop()
    
    # Delegate all methods to async adapter
    def navigate(self, url: str, wait_until: str = "networkidle") -> None:
        """Navigate to URL."""
        self._run(self._adapter.navigate(url, wait_until))
    
    def screenshot(
        self,
        path: Optional[str] = None,
        full_page: bool = False,
        selector: Optional[str] = None,
        encoding: str = "png"
    ) -> Union[str, bytes]:
        """Take a screenshot."""
        return self._run(self._adapter.screenshot(path, full_page, selector, encoding))
    
    def screenshot_base64(self, full_page: bool = False) -> str:
        """Take a base64 screenshot."""
        return self._run(self._adapter.screenshot_base64(full_page))
    
    def click(self, selector: str, button: str = "left") -> None:
        """Click an element."""
        self._run(self._adapter.click(selector, button))
    
    def fill(self, selector: str, text: str, clear_first: bool = True) -> None:
        """Fill an input field."""
        self._run(self._adapter.fill(selector, text, clear_first))
    
    def type_text(self, selector: str, text: str, delay: Optional[int] = None) -> None:
        """Type text into an element."""
        self._run(self._adapter.type_text(selector, text, delay))
    
    def press(self, key: str, selector: Optional[str] = None) -> None:
        """Press a key."""
        self._run(self._adapter.press(key, selector))
    
    def get_text(self, selector: str) -> str:
        """Get element text."""
        return self._run(self._adapter.get_text(selector))
    
    def get_url(self) -> str:
        """Get current URL."""
        return self._run(self._adapter.get_url())
    
    def get_title(self) -> str:
        """Get page title."""
        return self._run(self._adapter.get_title())
