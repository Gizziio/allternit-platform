"""
Chrome DevTools Protocol (CDP) adapter for allternit-computer-use.

Provides CDP connection handling for Chrome/Chromium/Edge browsers,
including automatic browser launch if not running.
"""

import os
import json
import base64
import subprocess
import time
import socket
from typing import Optional, Dict, Any, List, Union, Callable
from pathlib import Path
from dataclasses import dataclass, field
from urllib.parse import urljoin
import logging
import platform

# Optional imports - handled gracefully
try:
    import websocket
    from websocket import create_connection
    WEBSOCKET_AVAILABLE = True
except ImportError:
    WEBSOCKET_AVAILABLE = False

try:
    import requests
    REQUESTS_AVAILABLE = True
except ImportError:
    REQUESTS_AVAILABLE = False

from .setup import detect_chrome_executable

logger = logging.getLogger(__name__)


class CDPError(Exception):
    """Base exception for CDP errors."""
    pass


class CDPConnectionError(CDPError):
    """Raised when CDP connection fails."""
    pass


class CDPCommandError(CDPError):
    """Raised when a CDP command fails."""
    pass


@dataclass
class CDPConfig:
    """Configuration for CDP connection."""
    host: str = "localhost"
    port: int = 9222
    chrome_path: Optional[str] = None
    headless: bool = False
    window_size: tuple = (1280, 720)
    user_data_dir: Optional[str] = None
    additional_args: List[str] = field(default_factory=list)
    
    def __post_init__(self):
        if self.chrome_path is None:
            self.chrome_path = detect_chrome_executable()


class CDPAdapter:
    """
    Chrome DevTools Protocol adapter.
    
    Connects to Chrome/Chromium/Edge via CDP for browser automation.
    Can automatically launch Chrome if not running with remote debugging.
    
    Features:
    - Connect to existing Chrome with remote debugging
    - Auto-launch Chrome if not running
    - Screenshot capture
    - Page navigation
    - Element interaction via CDP
    """
    
    def __init__(self, config: Optional[CDPConfig] = None):
        """
        Initialize CDP adapter.
        
        Args:
            config: CDP configuration. Uses defaults if not provided.
        """
        if not WEBSOCKET_AVAILABLE:
            raise ImportError(
                "websocket-client is not installed. "
                "Install with: pip install allternit-computer-use[browser]"
            )
        
        if not REQUESTS_AVAILABLE:
            raise ImportError(
                "requests is not installed. "
                "Install with: pip install allternit-computer-use[browser]"
            )
        
        self.config = config or CDPConfig()
        self._ws: Optional[websocket.WebSocket] = None
        self._ws_url: Optional[str] = None
        self._chrome_process: Optional[subprocess.Popen] = None
        self._command_id = 0
        self._session_id: Optional[str] = None
        self._is_connected = False
    
    def __enter__(self):
        """Context manager entry."""
        self.connect()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit."""
        self.disconnect()
    
    def _get_ws_url(self) -> Optional[str]:
        """Get WebSocket URL from Chrome DevTools HTTP endpoint."""
        try:
            response = requests.get(
                f"http://{self.config.host}:{self.config.port}/json/version",
                timeout=5
            )
            if response.status_code == 200:
                data = response.json()
                return data.get("webSocketDebuggerUrl")
        except Exception as e:
            logger.debug(f"Could not get WS URL: {e}")
        
        # Try to get from /json/list
        try:
            response = requests.get(
                f"http://{self.config.host}:{self.config.port}/json/list",
                timeout=5
            )
            if response.status_code == 200:
                pages = response.json()
                if pages:
                    return pages[0].get("webSocketDebuggerUrl")
        except Exception as e:
            logger.debug(f"Could not get WS URL from list: {e}")
        
        return None
    
    def _is_chrome_running(self) -> bool:
        """Check if Chrome is running with remote debugging."""
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(2)
            result = sock.connect_ex((self.config.host, self.config.port))
            sock.close()
            return result == 0
        except Exception:
            return False
    
    def _launch_chrome(self) -> bool:
        """
        Launch Chrome with remote debugging enabled.
        
        Returns:
            True if launched successfully, False otherwise.
        """
        if not self.config.chrome_path:
            raise CDPError(
                "Chrome executable not found. "
                "Please install Chrome or provide chrome_path."
            )
        
        if not os.path.exists(self.config.chrome_path):
            raise CDPError(f"Chrome executable not found: {self.config.chrome_path}")
        
        logger.info(f"Launching Chrome from: {self.config.chrome_path}")
        
        # Build Chrome arguments
        args = [
            self.config.chrome_path,
            f"--remote-debugging-port={self.config.port}",
            f"--window-size={self.config.window_size[0]},{self.config.window_size[1]}",
            "--no-first-run",
            "--no-default-browser-check",
        ]
        
        if self.config.headless:
            args.append("--headless")
        
        # Use temporary user data dir if not provided
        if self.config.user_data_dir:
            args.append(f"--user-data-dir={self.config.user_data_dir}")
        else:
            import tempfile
            temp_dir = tempfile.mkdtemp(prefix="chrome_cdp_")
            args.append(f"--user-data-dir={temp_dir}")
        
        # Add additional args
        args.extend(self.config.additional_args)
        
        try:
            # Launch Chrome
            if platform.system() == "Windows":
                self._chrome_process = subprocess.Popen(
                    args,
                    creationflags=subprocess.CREATE_NEW_PROCESS_GROUP
                )
            else:
                self._chrome_process = subprocess.Popen(
                    args,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    preexec_fn=os.setsid if hasattr(os, "setsid") else None
                )
            
            # Wait for Chrome to start
            logger.info("Waiting for Chrome to start...")
            for _ in range(30):  # Wait up to 30 seconds
                if self._is_chrome_running():
                    logger.info("Chrome started successfully")
                    return True
                time.sleep(1)
            
            raise CDPError("Chrome did not start within timeout")
            
        except Exception as e:
            raise CDPError(f"Failed to launch Chrome: {e}")
    
    def connect(self, auto_launch: bool = True) -> "CDPAdapter":
        """
        Connect to Chrome via CDP.
        
        Args:
            auto_launch: Whether to auto-launch Chrome if not running.
        
        Returns:
            Self for method chaining.
        """
        # Check if Chrome is running
        if not self._is_chrome_running():
            if auto_launch:
                self._launch_chrome()
            else:
                raise CDPConnectionError(
                    f"Chrome not running on {self.config.host}:{self.config.port}. "
                    f"Start Chrome with: --remote-debugging-port={self.config.port}"
                )
        
        # Get WebSocket URL
        self._ws_url = self._get_ws_url()
        if not self._ws_url:
            raise CDPConnectionError("Could not get WebSocket URL from Chrome")
        
        logger.info(f"Connecting to CDP: {self._ws_url}")
        
        # Connect to WebSocket
        try:
            self._ws = create_connection(
                self._ws_url,
                timeout=30,
                enable_multithread=True
            )
            self._is_connected = True
            logger.info("Connected to Chrome via CDP")
        except Exception as e:
            raise CDPConnectionError(f"Failed to connect to CDP: {e}")
        
        # Enable required domains
        self._enable_domain("Page")
        self._enable_domain("Runtime")
        
        return self
    
    def disconnect(self) -> None:
        """Disconnect from Chrome and clean up."""
        logger.info("Disconnecting from Chrome...")
        
        if self._ws:
            try:
                self._ws.close()
            except Exception:
                pass
            self._ws = None
        
        # Terminate Chrome process if we launched it
        if self._chrome_process:
            try:
                import signal
                if platform.system() == "Windows":
                    self._chrome_process.terminate()
                else:
                    os.killpg(os.getpgid(self._chrome_process.pid), signal.SIGTERM)
                self._chrome_process.wait(timeout=5)
            except Exception:
                try:
                    self._chrome_process.kill()
                except Exception:
                    pass
            self._chrome_process = None
        
        self._is_connected = False
        self._ws_url = None
        logger.info("Disconnected from Chrome")
    
    @property
    def is_connected(self) -> bool:
        """Check if connected to Chrome."""
        return self._is_connected and self._ws is not None
    
    def _send_command(self, method: str, params: Optional[Dict] = None) -> Dict:
        """
        Send a CDP command.
        
        Args:
            method: CDP method name.
            params: Method parameters.
        
        Returns:
            Command response.
        """
        if not self.is_connected:
            raise CDPError("Not connected to Chrome")
        
        self._command_id += 1
        command = {
            "id": self._command_id,
            "method": method,
            "params": params or {}
        }
        
        if self._session_id:
            command["sessionId"] = self._session_id
        
        try:
            self._ws.send(json.dumps(command))
            response = json.loads(self._ws.recv())
            
            if "error" in response:
                raise CDPCommandError(
                    f"CDP command failed: {response['error']}"
                )
            
            return response.get("result", {})
        except websocket.WebSocketException as e:
            raise CDPConnectionError(f"WebSocket error: {e}")
        except Exception as e:
            raise CDPError(f"Command failed: {e}")
    
    def _enable_domain(self, domain: str) -> None:
        """Enable a CDP domain."""
        self._send_command(f"{domain}.enable")
    
    def _evaluate(self, expression: str) -> Any:
        """
        Evaluate JavaScript expression.
        
        Args:
            expression: JavaScript expression to evaluate.
        
        Returns:
            Evaluation result.
        """
        result = self._send_command("Runtime.evaluate", {
            "expression": expression,
            "returnByValue": True
        })
        
        if "exceptionDetails" in result:
            raise CDPCommandError(
                f"JavaScript error: {result['exceptionDetails']}"
            )
        
        return result.get("result", {}).get("value")
    
    # Navigation methods
    
    def navigate(self, url: str) -> None:
        """
        Navigate to a URL.
        
        Args:
            url: URL to navigate to.
        """
        logger.info(f"Navigating to: {url}")
        result = self._send_command("Page.navigate", {"url": url})
        
        # Wait for load
        frame_id = result.get("frameId")
        if frame_id:
            # Wait a bit for page to load
            time.sleep(0.5)
    
    def get_url(self) -> str:
        """Get current page URL."""
        return self._evaluate("window.location.href")
    
    def get_title(self) -> str:
        """Get current page title."""
        return self._evaluate("document.title")
    
    def reload(self, ignore_cache: bool = False) -> None:
        """
        Reload the page.
        
        Args:
            ignore_cache: Whether to ignore cache.
        """
        self._send_command("Page.reload", {"ignoreCache": ignore_cache})
        time.sleep(0.5)
    
    def go_back(self) -> None:
        """Go back in browser history."""
        self._evaluate("history.back()")
        time.sleep(0.5)
    
    def go_forward(self) -> None:
        """Go forward in browser history."""
        self._evaluate("history.forward()")
        time.sleep(0.5)
    
    # Screenshot methods
    
    def screenshot(
        self,
        path: Optional[str] = None,
        full_page: bool = False,
        encoding: str = "png"
    ) -> Union[str, bytes]:
        """
        Take a screenshot.
        
        Args:
            path: File path to save screenshot. If None, returns bytes/base64.
            full_page: Whether to capture full page.
            encoding: Output format (png, jpeg).
        
        Returns:
            Screenshot as bytes, base64 string, or file path.
        """
        params = {
            "format": encoding,
            "fromSurface": True
        }
        
        if full_page:
            # Get full page dimensions
            metrics = self._send_command("Page.getLayoutMetrics")
            content_size = metrics.get("contentSize", {})
            params["clip"] = {
                "x": 0,
                "y": 0,
                "width": content_size.get("width", 1280),
                "height": content_size.get("height", 720),
                "scale": 1
            }
        
        result = self._send_command("Page.captureScreenshot", params)
        screenshot_data = base64.b64decode(result["data"])
        
        if path:
            Path(path).parent.mkdir(parents=True, exist_ok=True)
            with open(path, "wb") as f:
                f.write(screenshot_data)
            return path
        
        return screenshot_data
    
    def screenshot_base64(self, full_page: bool = False) -> str:
        """
        Take a screenshot and return as base64 string.
        
        Args:
            full_page: Whether to capture full page.
        
        Returns:
            Base64-encoded screenshot.
        """
        result = self._send_command("Page.captureScreenshot", {
            "format": "png",
            "fromSurface": True
        })
        return result["data"]
    
    # Element interaction methods
    
    def _find_element(self, selector: str) -> Optional[Dict]:
        """
        Find element by CSS selector.
        
        Args:
            selector: CSS selector.
        
        Returns:
            Element object or None.
        """
        result = self._send_command("Runtime.evaluate", {
            "expression": f"""
                (function() {{
                    const el = document.querySelector({json.dumps(selector)});
                    if (!el) return null;
                    const rect = el.getBoundingClientRect();
                    return {{
                        found: true,
                        x: rect.left + rect.width / 2,
                        y: rect.top + rect.height / 2,
                        tagName: el.tagName,
                        text: el.textContent
                    }};
                }})()
            """,
            "returnByValue": True
        })
        
        value = result.get("result", {}).get("value")
        return value if value and value.get("found") else None
    
    def click(self, selector: str) -> None:
        """
        Click an element.
        
        Args:
            selector: CSS selector for the element.
        """
        logger.info(f"Clicking element: {selector}")
        
        element = self._find_element(selector)
        if not element:
            raise CDPError(f"Element not found: {selector}")
        
        # Use Input domain for mouse click
        self._send_command("Input.dispatchMouseEvent", {
            "type": "mousePressed",
            "x": element["x"],
            "y": element["y"],
            "button": "left",
            "clickCount": 1
        })
        
        self._send_command("Input.dispatchMouseEvent", {
            "type": "mouseReleased",
            "x": element["x"],
            "y": element["y"],
            "button": "left",
            "clickCount": 1
        })
    
    def fill(self, selector: str, text: str) -> None:
        """
        Fill an input field.
        
        Args:
            selector: CSS selector for the input element.
            text: Text to fill.
        """
        logger.info(f"Filling element {selector}")
        
        # Use JavaScript to fill
        escaped_text = json.dumps(text)
        escaped_selector = json.dumps(selector)
        
        self._evaluate(f"""
            (function() {{
                const el = document.querySelector({escaped_selector});
                if (!el) throw new Error('Element not found: {selector}');
                el.focus();
                el.value = {escaped_text};
                el.dispatchEvent(new Event('input', {{ bubbles: true }}));
                el.dispatchEvent(new Event('change', {{ bubbles: true }}));
            }})()
        """)
    
    def type_text(self, selector: str, text: str, delay_ms: int = 10) -> None:
        """
        Type text character by character.
        
        Args:
            selector: CSS selector for the element.
            text: Text to type.
            delay_ms: Delay between keystrokes.
        """
        element = self._find_element(selector)
        if not element:
            raise CDPError(f"Element not found: {selector}")
        
        # Focus the element first
        self.click(selector)
        
        # Type each character
        for char in text:
            char_code = ord(char)
            
            # Key down
            self._send_command("Input.dispatchKeyEvent", {
                "type": "keyDown",
                "text": char,
                "windowsVirtualKeyCode": char_code,
                "nativeVirtualKeyCode": char_code
            })
            
            # Key up
            self._send_command("Input.dispatchKeyEvent", {
                "type": "keyUp",
                "windowsVirtualKeyCode": char_code,
                "nativeVirtualKeyCode": char_code
            })
            
            if delay_ms > 0:
                time.sleep(delay_ms / 1000)
    
    def press(self, key: str) -> None:
        """
        Press a special key.
        
        Args:
            key: Key name (Enter, Escape, ArrowDown, etc.).
        """
        key_map = {
            "Enter": 13,
            "Escape": 27,
            "Tab": 9,
            "Backspace": 8,
            "ArrowUp": 38,
            "ArrowDown": 40,
            "ArrowLeft": 37,
            "ArrowRight": 39,
        }
        
        key_code = key_map.get(key, ord(key) if len(key) == 1 else 0)
        
        self._send_command("Input.dispatchKeyEvent", {
            "type": "keyDown",
            "windowsVirtualKeyCode": key_code,
            "nativeVirtualKeyCode": key_code
        })
        
        self._send_command("Input.dispatchKeyEvent", {
            "type": "keyUp",
            "windowsVirtualKeyCode": key_code,
            "nativeVirtualKeyCode": key_code
        })
    
    def get_text(self, selector: str) -> str:
        """
        Get text content of an element.
        
        Args:
            selector: CSS selector.
        
        Returns:
            Element text content.
        """
        escaped_selector = json.dumps(selector)
        return self._evaluate(f"""
            (function() {{
                const el = document.querySelector({escaped_selector});
                return el ? el.textContent : null;
            }})()
        """) or ""
    
    def is_visible(self, selector: str) -> bool:
        """
        Check if an element is visible.
        
        Args:
            selector: CSS selector.
        
        Returns:
            True if visible, False otherwise.
        """
        escaped_selector = json.dumps(selector)
        result = self._evaluate(f"""
            (function() {{
                const el = document.querySelector({escaped_selector});
                if (!el) return false;
                const style = window.getComputedStyle(el);
                return style.display !== 'none' && style.visibility !== 'hidden';
            }})()
        """)
        return bool(result)
    
    def wait_for_selector(
        self,
        selector: str,
        timeout: float = 30.0,
        interval: float = 0.5
    ) -> bool:
        """
        Wait for an element to appear.
        
        Args:
            selector: CSS selector.
            timeout: Maximum time to wait in seconds.
            interval: Polling interval in seconds.
        
        Returns:
            True if element found, False if timeout.
        """
        start_time = time.time()
        while time.time() - start_time < timeout:
            if self._find_element(selector):
                return True
            time.sleep(interval)
        return False
    
    # JavaScript execution
    
    def evaluate(self, expression: str) -> Any:
        """
        Execute JavaScript on the page.
        
        Args:
            expression: JavaScript expression.
        
        Returns:
            Execution result.
        """
        return self._evaluate(expression)
    
    def get_page_content(self) -> str:
        """Get the full HTML content of the page."""
        return self._evaluate("document.documentElement.outerHTML")
    
    # Utility methods
    
    def set_viewport(self, width: int, height: int) -> None:
        """
        Set the viewport size.
        
        Args:
            width: Viewport width.
            height: Viewport height.
        """
        self._send_command("Emulation.setDeviceMetricsOverride", {
            "width": width,
            "height": height,
            "deviceScaleFactor": 1,
            "mobile": False
        })
    
    def scroll_to(self, x: int = 0, y: int = 0) -> None:
        """
        Scroll to a position.

        Args:
            x: X coordinate.
            y: Y coordinate.
        """
        self._evaluate(f"window.scrollTo({x}, {y})")


# ---------------------------------------------------------------------------
# PlaywrightCDPAdapter — BaseAdapter subclass using Playwright connect_over_cdp
#
# This is the adapter registered in the ComputerUseExecutor waterfall as
# "browser.cdp". It attaches to an already-running Chrome/Electron instance
# that was launched with --remote-debugging-port=<port>.
#
# Handles all of Claude's 9 native actions + browser extensions.
# ---------------------------------------------------------------------------

import sys as _sys, os as _os
_sys.path.insert(0, _os.path.join(_os.path.dirname(__file__), "../.."))

try:
    from core.base_adapter import (
        ActionRequest,
        AdapterCapabilities,
        BaseAdapter,
        ResultEnvelope,
    )
    _CDPBase = BaseAdapter
except ImportError:
    _CDPBase = object  # type: ignore[assignment,misc]
    ActionRequest = None  # type: ignore[assignment]
    AdapterCapabilities = None  # type: ignore[assignment]
    ResultEnvelope = None  # type: ignore[assignment]


class PlaywrightCDPAdapter(_CDPBase):
    """
    browser.cdp adapter — attaches to an existing Chrome/Electron via CDP.

    Connects using Playwright's connect_over_cdp() so we get the full
    Playwright page API on top of the existing browser session. The target
    browser must already be running with --remote-debugging-port=<port>.

    Used as the second adapter in the waterfall when browser.extension is
    unavailable (e.g. extension not installed, or desktop/Electron app).

    Env vars:
      ACU_CDP_URL   — CDP endpoint URL (default: http://localhost:9222)
      ACU_CDP_PORT  — shorthand port (used if ACU_CDP_URL not set)
    """

    def __init__(
        self,
        cdp_url: Optional[str] = None,
        port: Optional[int] = None,
        slow_mo: int = 0,
    ) -> None:
        import os as _os2
        if cdp_url:
            self._cdp_url = cdp_url
        elif port:
            self._cdp_url = f"http://localhost:{port}"
        else:
            env_url = _os2.environ.get("ACU_CDP_URL")
            env_port = _os2.environ.get("ACU_CDP_PORT", "9222")
            self._cdp_url = env_url or f"http://localhost:{env_port}"

        self._slow_mo = slow_mo
        self._browser = None
        self._page = None
        self._playwright = None

    @property
    def adapter_id(self) -> str:
        return "browser.cdp"

    @property
    def family(self) -> str:
        return "browser"

    async def initialize(self) -> None:
        try:
            from playwright.async_api import async_playwright
        except ImportError:
            raise RuntimeError("playwright not installed — run: pip install playwright")
        self._playwright = await async_playwright().start()
        self._browser = await self._playwright.chromium.connect_over_cdp(
            self._cdp_url,
            slow_mo=self._slow_mo,
        )
        # Use the first available page, or open a new one
        contexts = self._browser.contexts
        if contexts and contexts[0].pages:
            self._page = contexts[0].pages[0]
        else:
            ctx = contexts[0] if contexts else await self._browser.new_context()
            self._page = await ctx.new_page()
        logger.info("[cdp-adapter] attached to %s — page: %s", self._cdp_url, self._page.url)

    async def close(self) -> None:
        if self._browser:
            try:
                await self._browser.close()
            except Exception:
                pass
        if self._playwright:
            try:
                await self._playwright.stop()
            except Exception:
                pass
        self._browser = None
        self._page = None

    async def health_check(self) -> bool:
        if self._page is None:
            try:
                await self.initialize()
            except Exception:
                return False
        try:
            await self._page.title()
            return True
        except Exception:
            return False

    async def capabilities(self) -> "AdapterCapabilities":
        return AdapterCapabilities(
            adapter_id=self.adapter_id,
            family=self.family,
            dom_tree=True,
            vision_required=False,
            multi_tab=True,
            auth_flows=True,
            platform="any",
        )

    async def execute(self, action: "ActionRequest", session_id: str, run_id: str) -> "ResultEnvelope":
        from datetime import datetime, timezone as _tz
        env = self._make_envelope(action, session_id, run_id)

        if self._page is None:
            env.status = "failed"
            env.error = {"code": "NOT_INITIALIZED", "message": "CDP page not connected"}
            env.completed_at = datetime.now(_tz.utc).isoformat()
            return env

        try:
            result_data = await self._dispatch(action)
            env.status = "completed"
            env.extracted_content = result_data or None
            env.completed_at = datetime.now(_tz.utc).isoformat()
            self._emit_receipt(env, action, result_data or {})
        except Exception as exc:
            logger.warning("[cdp-adapter] %s error: %s", action.action_type, exc)
            env.status = "failed"
            env.error = {"code": "CDP_ERROR", "message": str(exc)}
            env.completed_at = datetime.now(_tz.utc).isoformat()
        return env

    def _make_envelope(self, action, session_id, run_id):
        if _CDPBase is not object:
            return super()._make_envelope(action, session_id, run_id)
        # Fallback when BaseAdapter not available
        from datetime import datetime, timezone as _tz
        from core.base_adapter import ResultEnvelope as _RE
        return _RE(
            run_id=run_id,
            session_id=session_id,
            adapter_id=self.adapter_id,
            family=self.family,
            mode="execute",
            action=action.action_type,
            target=action.target,
            status="running",
            started_at=datetime.now(_tz.utc).isoformat(),
        )

    def _emit_receipt(self, envelope, action, result_data):
        if _CDPBase is not object:
            super()._emit_receipt(envelope, action, result_data)

    async def _dispatch(self, action: "ActionRequest") -> Optional[Dict]:
        p = action.parameters
        at = action.action_type

        if at == "screenshot":
            raw = await self._page.screenshot(type="png")
            b64 = base64.b64encode(raw).decode()
            return {"data_url": f"data:image/png;base64,{b64}", "size_bytes": len(raw)}

        if at == "navigate":
            url = action.target or p.get("url", "")
            await self._page.goto(url, wait_until=p.get("wait_until", "domcontentloaded"))
            return {"url": self._page.url, "title": await self._page.title()}

        if at == "left_click":
            x, y = p.get("x"), p.get("y")
            if x is not None and y is not None:
                await self._page.mouse.click(float(x), float(y))
            else:
                await self._page.click(action.target or p.get("selector", ""))
            return {}

        if at == "right_click":
            x, y = p.get("x"), p.get("y")
            if x is not None and y is not None:
                await self._page.mouse.click(float(x), float(y), button="right")
            else:
                await self._page.click(action.target or p.get("selector", ""), button="right")
            return {}

        if at == "middle_click":
            x, y = p.get("x"), p.get("y")
            if x is not None and y is not None:
                await self._page.mouse.click(float(x), float(y), button="middle")
            return {}

        if at == "double_click":
            x, y = p.get("x"), p.get("y")
            if x is not None and y is not None:
                await self._page.mouse.dblclick(float(x), float(y))
            else:
                await self._page.dblclick(action.target or p.get("selector", ""))
            return {}

        if at == "left_click_drag":
            sx, sy = p.get("startX", p.get("x", 0)), p.get("startY", p.get("y", 0))
            ex, ey = p.get("endX", 0), p.get("endY", 0)
            await self._page.mouse.move(float(sx), float(sy))
            await self._page.mouse.down()
            await self._page.mouse.move(float(ex), float(ey))
            await self._page.mouse.up()
            return {}

        if at == "type":
            text = p.get("text", action.target or "")
            await self._page.keyboard.type(text)
            return {"chars_typed": len(text)}

        if at == "key":
            key = p.get("key", action.target or "")
            await self._page.keyboard.press(key)
            return {"key": key}

        if at == "scroll":
            x = float(p.get("x", 0))
            y = float(p.get("y", 0))
            dx = p.get("deltaX", 0)
            dy = p.get("deltaY", p.get("delta", 0))
            await self._page.mouse.move(x, y)
            await self._page.mouse.wheel(dx, dy)
            return {"deltaX": dx, "deltaY": dy}

        if at == "cursor_position":
            # CDP doesn't expose mouse position natively; track it via a mousemove listener
            # injected once per page, falling back to (0,0) if never moved.
            pos = await self._page.evaluate("""() => {
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
                content = await self._page.inner_text(sel) if sel else await self._page.evaluate("() => document.body.innerText")
            elif fmt == "html":
                content = await self._page.inner_html(sel) if sel else await self._page.content()
            else:
                content = await self._page.evaluate("() => ({title: document.title, url: location.href})")
            return {"content": content, "format": fmt}

        if at == "fill":
            sel = action.target or p.get("selector", "")
            text = p.get("text", "")
            await self._page.fill(sel, text)
            return {}

        if at == "wait":
            import asyncio as _asyncio
            ms = p.get("ms", 1000)
            await _asyncio.sleep(ms / 1000)
            return {"waited_ms": ms}

        if at == "tabs":
            pages = self._browser.contexts[0].pages if self._browser.contexts else []
            return {"tabs": [{"url": pg.url, "title": await pg.title()} for pg in pages]}

        raise CDPError(f"Unsupported action: {at!r}")
