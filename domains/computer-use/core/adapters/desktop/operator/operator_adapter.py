"""
Operator Desktop Adapter

Adapter for Anthropic's Operator service with fallback to PyAutoGUI.
Operator provides more advanced AI-driven desktop automation capabilities.

This adapter attempts to connect to a local Operator service first,
falling back to PyAutoGUI if Operator is unavailable.

Installation:
    pip install allternit-computer-use[desktop]

Environment Variables:
    OPERATOR_URL: URL of the Operator service (default: http://localhost:8080)
    OPERATOR_API_KEY: API key for Operator authentication
    OPERATOR_TIMEOUT: Request timeout in seconds (default: 30)
"""

from __future__ import annotations

import asyncio
import base64
import json
import logging
import os
import platform
from dataclasses import dataclass, field
from enum import Enum
from typing import TYPE_CHECKING, Any, Literal

# Configure logging
logger = logging.getLogger(__name__)

# Try to import aiohttp for async HTTP requests
try:
    import aiohttp
    HAS_AIOHTTP = True
except ImportError:
    HAS_AIOHTTP = False
    aiohttp = None  # type: ignore

# Try to import PyAutoGUI for fallback
try:
    from ..pyautogui.pyautogui_adapter import PyAutoGUIAdapter, ScreenshotResult
    HAS_PYAUTOGUI = True
except ImportError:
    HAS_PYAUTOGUI = False
    PyAutoGUIAdapter = None  # type: ignore
    ScreenshotResult = None  # type: ignore

if TYPE_CHECKING:
    from PIL.Image import Image as PILImage


class OperatorConnectionError(ConnectionError):
    """Raised when connection to Operator service fails."""
    
    def __init__(self, message: str, fallback_available: bool = False) -> None:
        super().__init__(message)
        self.fallback_available = fallback_available


class OperatorError(RuntimeError):
    """Raised when Operator service returns an error."""
    pass


class ActionType(Enum):
    """Types of desktop actions."""
    CLICK = "click"
    DOUBLE_CLICK = "double_click"
    RIGHT_CLICK = "right_click"
    MOVE = "move"
    DRAG = "drag"
    SCROLL = "scroll"
    TYPE = "type"
    KEYPRESS = "keypress"
    HOTKEY = "hotkey"
    SCREENSHOT = "screenshot"
    WAIT = "wait"


@dataclass
class Action:
    """A desktop automation action."""
    type: ActionType
    params: dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for API request."""
        return {
            "type": self.type.value,
            "params": self.params
        }


@dataclass
class OperatorConfig:
    """Configuration for Operator connection."""
    url: str = field(default_factory=lambda: os.getenv("OPERATOR_URL", "http://localhost:8080"))
    api_key: str | None = field(default_factory=lambda: os.getenv("OPERATOR_API_KEY"))
    timeout: int = field(default_factory=lambda: int(os.getenv("OPERATOR_TIMEOUT", "30")))
    enable_fallback: bool = True
    
    def get_headers(self) -> dict[str, str]:
        """Get HTTP headers for requests."""
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers


@dataclass
class ActionResult:
    """Result of a desktop automation action."""
    success: bool
    action_type: ActionType | None = None
    data: dict[str, Any] = field(default_factory=dict)
    screenshot: str | None = None  # base64 encoded
    error: str | None = None
    using_fallback: bool = False


@dataclass
class SessionInfo:
    """Information about an Operator session."""
    session_id: str
    status: Literal["active", "inactive", "error"]
    platform: str
    screen_size: tuple[int, int] | None = None
    capabilities: list[str] = field(default_factory=list)


class OperatorAdapter:
    """Desktop automation adapter using Anthropic's Operator.
    
    This adapter provides intelligent desktop automation by connecting
    to a local or remote Operator service. If Operator is unavailable,
    it automatically falls back to PyAutoGUI for basic automation.
    
    Example:
        >>> adapter = OperatorAdapter()
        >>> await adapter.initialize()
        >>> 
        >>> # Take a screenshot
        >>> result = await adapter.screenshot()
        >>> 
        >>> # Execute an action
        >>> result = await adapter.execute(Action(
        ...     type=ActionType.CLICK,
        ...     params={"x": 100, "y": 200}
        ... ))
        >>> 
        >>> await adapter.dispose()
    
    Environment Variables:
        OPERATOR_URL: Operator service URL (default: http://localhost:8080)
        OPERATOR_API_KEY: API key for authentication
        OPERATOR_TIMEOUT: Request timeout in seconds (default: 30)
    """
    
    def __init__(self, config: OperatorConfig | None = None) -> None:
        """Initialize the Operator adapter.
        
        Args:
            config: Optional configuration. Uses environment variables if not provided.
        """
        self.config = config or OperatorConfig()
        self._session: aiohttp.ClientSession | None = None
        self._session_info: SessionInfo | None = None
        self._fallback_adapter: PyAutoGUIAdapter | None = None
        self._using_fallback = False
        self._initialized = False
        
    @property
    def is_available(self) -> bool:
        """Check if Operator or fallback is available.
        
        Returns:
            True if Operator or PyAutoGUI fallback is available
        """
        if HAS_AIOHTTP:
            return True
        if self.config.enable_fallback and HAS_PYAUTOGUI:
            return True
        return False
    
    @property
    def using_fallback(self) -> bool:
        """Check if currently using PyAutoGUI fallback.
        
        Returns:
            True if using fallback mode
        """
        return self._using_fallback
    
    @property
    def session_id(self) -> str | None:
        """Get current session ID.
        
        Returns:
            Session ID if active, None otherwise
        """
        return self._session_info.session_id if self._session_info else None
    
    async def _check_operator_health(self) -> tuple[bool, str]:
        """Check if Operator service is healthy.
        
        Returns:
            Tuple of (is_healthy, message)
        """
        if not HAS_AIOHTTP:
            return False, "aiohttp not installed (pip install aiohttp)"
        
        if not self._session:
            return False, "No active session"
        
        try:
            async with self._session.get(
                f"{self.config.url}/health",
                timeout=aiohttp.ClientTimeout(total=5)
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    return True, f"Operator v{data.get('version', 'unknown')} ready"
                return False, f"Health check failed: HTTP {response.status}"
        except asyncio.TimeoutError:
            return False, f"Connection timeout to {self.config.url}"
        except aiohttp.ClientConnectorError as e:
            return False, f"Cannot connect to Operator at {self.config.url}: {e}"
        except Exception as e:
            return False, f"Health check error: {type(e).__name__}: {e}"
    
    async def initialize(self) -> SessionInfo:
        """Initialize the adapter and create a session.
        
        Attempts to connect to Operator service first. If that fails
        and fallback is enabled, initializes PyAutoGUI instead.
        
        Returns:
            Session information
            
        Raises:
            OperatorConnectionError: If neither Operator nor fallback is available
        """
        if self._initialized:
            return self._session_info  # type: ignore
        
        # Try to connect to Operator first
        if HAS_AIOHTTP:
            self._session = aiohttp.ClientSession(
                headers=self.config.get_headers()
            )
            
            is_healthy, message = await self._check_operator_health()
            
            if is_healthy:
                logger.info(f"Operator connected: {message}")
                self._using_fallback = False
                
                # Create session with Operator
                try:
                    async with self._session.post(
                        f"{self.config.url}/sessions",
                        timeout=aiohttp.ClientTimeout(total=self.config.timeout)
                    ) as response:
                        if response.status == 201:
                            data = await response.json()
                            self._session_info = SessionInfo(
                                session_id=data["session_id"],
                                status="active",
                                platform=platform.system(),
                                screen_size=tuple(data.get("screen_size", [0, 0])),
                                capabilities=data.get("capabilities", [])
                            )
                        else:
                            logger.warning(f"Failed to create session: HTTP {response.status}")
                except Exception as e:
                    logger.warning(f"Session creation failed: {e}")
                    is_healthy = False
        
        # Fallback to PyAutoGUI if Operator not available
        if not is_healthy and self.config.enable_fallback and HAS_PYAUTOGUI:
            logger.info("Falling back to PyAutoGUI")
            self._using_fallback = True
            
            try:
                self._fallback_adapter = PyAutoGUIAdapter()
                await self._fallback_adapter.initialize()
                
                screen_size = await self._fallback_adapter.get_screen_size()
                
                self._session_info = SessionInfo(
                    session_id=f"pyautogui-{id(self._fallback_adapter)}",
                    status="active",
                    platform=platform.system(),
                    screen_size=(screen_size.width, screen_size.height),
                    capabilities=["screenshot", "mouse", "keyboard"]
                )
                
                if not HAS_AIOHTTP:
                    logger.warning("aiohttp not installed. Install with: pip install aiohttp")
                    
            except Exception as e:
                # Clean up session if created
                if self._session:
                    await self._session.close()
                    self._session = None
                    
                fallback_msg = " PyAutoGUI fallback also failed." if HAS_PYAUTOGUI else ""
                raise OperatorConnectionError(
                    f"Could not connect to Operator at {self.config.url}.{fallback_msg}\n"
                    f"Error: {e}\n\n"
                    f"To use Operator:\n"
                    f"1. Start Operator service on port 8080, or\n"
                    f"2. Set OPERATOR_URL to the correct address\n\n"
                    f"To use PyAutoGUI fallback:\n"
                    f"  pip install allternit-computer-use[desktop]",
                    fallback_available=HAS_PYAUTOGUI
                )
        
        elif not is_healthy:
            # Clean up session if created
            if self._session:
                await self._session.close()
                self._session = None
                
            raise OperatorConnectionError(
                f"Could not connect to Operator at {self.config.url}: {message}\n\n"
                f"To start Operator:\n"
                f"  operator serve --port 8080\n\n"
                f"Or set OPERATOR_URL to the correct address.",
                fallback_available=False
            )
        
        self._initialized = True
        return self._session_info  # type: ignore
    
    async def execute(self, action: Action) -> ActionResult:
        """Execute a desktop automation action.
        
        Args:
            action: The action to execute
            
        Returns:
            Action result with success status and optional screenshot
            
        Raises:
            RuntimeError: If adapter not initialized
            OperatorError: If action execution fails
        """
        if not self._initialized:
            raise RuntimeError("Adapter not initialized. Call initialize() first.")
        
        if self._using_fallback:
            return await self._execute_with_fallback(action)
        
        # Execute via Operator
        try:
            async with self._session.post(  # type: ignore
                f"{self.config.url}/sessions/{self.session_id}/actions",
                json=action.to_dict(),
                timeout=aiohttp.ClientTimeout(total=self.config.timeout)
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    return ActionResult(
                        success=data.get("success", False),
                        action_type=action.type,
                        data=data.get("data", {}),
                        screenshot=data.get("screenshot"),
                        error=data.get("error")
                    )
                else:
                    error_text = await response.text()
                    raise OperatorError(f"Action failed: HTTP {response.status}: {error_text}")
                    
        except asyncio.TimeoutError:
            return ActionResult(
                success=False,
                action_type=action.type,
                error=f"Action timeout after {self.config.timeout}s"
            )
        except Exception as e:
            return ActionResult(
                success=False,
                action_type=action.type,
                error=f"Action failed: {type(e).__name__}: {e}"
            )
    
    async def _execute_with_fallback(self, action: Action) -> ActionResult:
        """Execute action using PyAutoGUI fallback.
        
        Args:
            action: The action to execute
            
        Returns:
            Action result
        """
        if not self._fallback_adapter:
            return ActionResult(
                success=False,
                action_type=action.type,
                error="Fallback adapter not available"
            )
        
        try:
            adapter = self._fallback_adapter
            params = action.params
            
            if action.type == ActionType.SCREENSHOT:
                region = params.get("region")
                result = await adapter.take_screenshot(region=region)
                return ActionResult(
                    success=result.success,
                    action_type=action.type,
                    screenshot=result.base64_data,
                    error=result.error,
                    using_fallback=True
                )
            
            elif action.type == ActionType.CLICK:
                await adapter.click(
                    x=params.get("x"),
                    y=params.get("y"),
                    button=params.get("button", "left"),
                    clicks=1
                )
                return ActionResult(success=True, action_type=action.type, using_fallback=True)
            
            elif action.type == ActionType.DOUBLE_CLICK:
                await adapter.click(
                    x=params.get("x"),
                    y=params.get("y"),
                    button="left",
                    clicks=2
                )
                return ActionResult(success=True, action_type=action.type, using_fallback=True)
            
            elif action.type == ActionType.RIGHT_CLICK:
                await adapter.click(
                    x=params.get("x"),
                    y=params.get("y"),
                    button="right",
                    clicks=1
                )
                return ActionResult(success=True, action_type=action.type, using_fallback=True)
            
            elif action.type == ActionType.MOVE:
                await adapter.move_to(
                    x=params["x"],
                    y=params["y"],
                    duration=params.get("duration", 0.5)
                )
                return ActionResult(success=True, action_type=action.type, using_fallback=True)
            
            elif action.type == ActionType.SCROLL:
                await adapter.scroll(
                    amount=params["amount"],
                    x=params.get("x"),
                    y=params.get("y")
                )
                return ActionResult(success=True, action_type=action.type, using_fallback=True)
            
            elif action.type == ActionType.TYPE:
                await adapter.typewrite(
                    text=params["text"],
                    interval=params.get("interval", 0.01)
                )
                return ActionResult(success=True, action_type=action.type, using_fallback=True)
            
            elif action.type == ActionType.KEYPRESS:
                await adapter.press(params["key"])
                return ActionResult(success=True, action_type=action.type, using_fallback=True)
            
            elif action.type == ActionType.HOTKEY:
                keys = params.get("keys", [])
                await adapter.hotkey(*keys)
                return ActionResult(success=True, action_type=action.type, using_fallback=True)
            
            elif action.type == ActionType.WAIT:
                await asyncio.sleep(params.get("seconds", 1))
                return ActionResult(success=True, action_type=action.type, using_fallback=True)
            
            else:
                return ActionResult(
                    success=False,
                    action_type=action.type,
                    error=f"Unsupported action in fallback mode: {action.type.value}",
                    using_fallback=True
                )
                
        except Exception as e:
            return ActionResult(
                success=False,
                action_type=action.type,
                error=f"Fallback execution failed: {e}",
                using_fallback=True
            )
    
    async def screenshot(self, region: tuple[int, int, int, int] | None = None) -> ActionResult:
        """Take a screenshot.
        
        Args:
            region: Optional (left, top, width, height) region
            
        Returns:
            Action result with base64-encoded screenshot
        """
        return await self.execute(Action(
            type=ActionType.SCREENSHOT,
            params={"region": region} if region else {}
        ))
    
    async def click(
        self,
        x: int,
        y: int,
        button: Literal["left", "right", "middle"] = "left",
        clicks: int = 1
    ) -> ActionResult:
        """Click at coordinates.
        
        Args:
            x: X coordinate
            y: Y coordinate
            button: Mouse button
            clicks: Number of clicks
            
        Returns:
            Action result
        """
        if clicks == 2:
            action_type = ActionType.DOUBLE_CLICK
        elif button == "right":
            action_type = ActionType.RIGHT_CLICK
        else:
            action_type = ActionType.CLICK
            
        return await self.execute(Action(
            type=action_type,
            params={"x": x, "y": y, "button": button}
        ))
    
    async def move(self, x: int, y: int, duration: float = 0.5) -> ActionResult:
        """Move mouse to coordinates.
        
        Args:
            x: X coordinate
            y: Y coordinate
            duration: Movement duration in seconds
            
        Returns:
            Action result
        """
        return await self.execute(Action(
            type=ActionType.MOVE,
            params={"x": x, "y": y, "duration": duration}
        ))
    
    async def scroll(self, amount: int, x: int | None = None, y: int | None = None) -> ActionResult:
        """Scroll the mouse wheel.
        
        Args:
            amount: Scroll amount (positive=up, negative=down)
            x: Optional X coordinate
            y: Optional Y coordinate
            
        Returns:
            Action result
        """
        params: dict[str, Any] = {"amount": amount}
        if x is not None:
            params["x"] = x
        if y is not None:
            params["y"] = y
            
        return await self.execute(Action(type=ActionType.SCROLL, params=params))
    
    async def typewrite(self, text: str, interval: float = 0.01) -> ActionResult:
        """Type text.
        
        Args:
            text: Text to type
            interval: Seconds between keystrokes
            
        Returns:
            Action result
        """
        return await self.execute(Action(
            type=ActionType.TYPE,
            params={"text": text, "interval": interval}
        ))
    
    async def press(self, key: str) -> ActionResult:
        """Press a key.
        
        Args:
            key: Key to press (e.g., 'enter', 'esc')
            
        Returns:
            Action result
        """
        return await self.execute(Action(
            type=ActionType.KEYPRESS,
            params={"key": key}
        ))
    
    async def hotkey(self, *keys: str) -> ActionResult:
        """Press a key combination.
        
        Args:
            *keys: Keys to press simultaneously
            
        Returns:
            Action result
        """
        return await self.execute(Action(
            type=ActionType.HOTKEY,
            params={"keys": list(keys)}
        ))
    
    async def wait(self, seconds: float) -> ActionResult:
        """Wait for specified duration.
        
        Args:
            seconds: Seconds to wait
            
        Returns:
            Action result
        """
        return await self.execute(Action(
            type=ActionType.WAIT,
            params={"seconds": seconds}
        ))
    
    async def batch_execute(self, actions: list[Action]) -> list[ActionResult]:
        """Execute multiple actions in sequence.
        
        Args:
            actions: List of actions to execute
            
        Returns:
            List of action results
        """
        results = []
        for action in actions:
            result = await self.execute(action)
            results.append(result)
            if not result.success:
                logger.warning(f"Action {action.type.value} failed: {result.error}")
        return results
    
    async def dispose(self) -> None:
        """Clean up resources and end session."""
        if not self._initialized:
            return
        
        # Close Operator session
        if self._session and not self._using_fallback:
            try:
                async with self._session.delete(
                    f"{self.config.url}/sessions/{self.session_id}",
                    timeout=aiohttp.ClientTimeout(total=5)
                ):
                    pass  # Ignore response
            except Exception as e:
                logger.debug(f"Session cleanup failed: {e}")
            
            await self._session.close()
            self._session = None
        
        # Clean up fallback
        if self._fallback_adapter:
            await self._fallback_adapter.dispose()
            self._fallback_adapter = None
        
        self._session_info = None
        self._initialized = False
        self._using_fallback = False
        
        logger.info("Operator adapter disposed")
    
    async def __aenter__(self) -> "OperatorAdapter":
        """Async context manager entry."""
        await self.initialize()
        return self
    
    async def __aexit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        """Async context manager exit."""
        await self.dispose()


def get_operator_info() -> dict[str, Any]:
    """Get information about Operator availability.
    
    Returns:
        Dictionary with availability information
    """
    config = OperatorConfig()
    
    return {
        "aiohttp_installed": HAS_AIOHTTP,
        "pyautogui_installed": HAS_PYAUTOGUI,
        "fallback_available": HAS_PYAUTOGUI,
        "configured_url": config.url,
        "configured_timeout": config.timeout,
        "has_api_key": config.api_key is not None,
        "platform": platform.system(),
        "python_version": platform.python_version(),
    }


def print_setup_instructions() -> None:
    """Print setup instructions for Operator."""
    info = get_operator_info()
    
    print("""
╔══════════════════════════════════════════════════════════════════════════════╗
║                        OPERATOR SETUP INSTRUCTIONS                           ║
╚══════════════════════════════════════════════════════════════════════════════╝

Operator provides intelligent AI-driven desktop automation.

Prerequisites:
""")
    
    if not info["aiohttp_installed"]:
        print("  ✗ aiohttp not installed")
        print("    Install: pip install aiohttp")
    else:
        print("  ✓ aiohttp installed")
    
    if not info["pyautogui_installed"]:
        print("  ✗ PyAutoGUI not installed (fallback unavailable)")
        print("    Install: pip install allternit-computer-use[desktop]")
    else:
        print("  ✓ PyAutoGUI installed (fallback available)")
    
    print(f"""
Configuration (via environment variables):
  OPERATOR_URL     : {info['configured_url']}
  OPERATOR_API_KEY : {'Set' if info['has_api_key'] else 'Not set'}
  OPERATOR_TIMEOUT : {info['configured_timeout']}s

Starting Operator Service:

  # Option 1: Local Operator service
  $ operator serve --port 8080

  # Option 2: Docker
  $ docker run -p 8080:8080 anthropic/operator:latest

  # Option 3: Use PyAutoGUI fallback (no Operator needed)
  $ export OPERATOR_URL=""  # Disable Operator to force fallback

Usage:

  adapter = OperatorAdapter()
  await adapter.initialize()  # Connects to Operator or uses fallback
  
  # Take screenshot
  result = await adapter.screenshot()
  
  # Execute actions
  await adapter.click(100, 200)
  await adapter.typewrite("Hello, World!")
  
  await adapter.dispose()

For more information:
  https://docs.anthropic.com/operator
""")


if __name__ == "__main__":
    print_setup_instructions()
