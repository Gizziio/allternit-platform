"""
PyAutoGUI Desktop Adapter

A cross-platform desktop automation adapter using PyAutoGUI.
Supports macOS, Windows, and Linux with graceful permission handling.

Installation:
    pip install allternit-computer-use[desktop]

Platform-specific:
    macOS:   pip install allternit-computer-use[desktop-macos]
    Windows: pip install allternit-computer-use[desktop-windows]
    Linux:   pip install allternit-computer-use[desktop-linux]

Permissions:
    macOS: Grant Accessibility permissions in System Settings
    Windows: May require Administrator for some actions
    Linux: X11 access required (Wayland support limited)
"""

from __future__ import annotations

import base64
import io
import logging
import platform
import subprocess
import sys
from dataclasses import dataclass
from enum import Enum
from typing import TYPE_CHECKING, Any

# Configure logging
logger = logging.getLogger(__name__)

# Graceful imports with helpful error messages
_MISSING_DEPS = []

# Try to import PIL/Pillow
try:
    from PIL import Image
except ImportError:
    _MISSING_DEPS.append("Pillow>=10.0.0")
    Image = None  # type: ignore

# Try to import mss for screenshots
try:
    import mss
except ImportError:
    _MISSING_DEPS.append("mss>=9.0.0")
    mss = None  # type: ignore

# Try to import pynput for keyboard/mouse monitoring
try:
    from pynput import keyboard, mouse
except ImportError:
    _MISSING_DEPS.append("pynput>=1.7.6")
    keyboard = None  # type: ignore
    mouse = None  # type: ignore

# Try to import pyautogui (main dependency)
try:
    import pyautogui
    # Configure pyautogui for safety
    pyautogui.FAILSAFE = True
    pyautogui.PAUSE = 0.1
except ImportError:
    _MISSING_DEPS.append("pyautogui>=0.9.54")
    pyautogui = None  # type: ignore


if TYPE_CHECKING:
    from PIL.Image import Image as PILImage


class Platform(Enum):
    """Supported platforms."""
    MACOS = "darwin"
    WINDOWS = "windows"
    LINUX = "linux"
    UNKNOWN = "unknown"


class PermissionError(RuntimeError):
    """Raised when required permissions are not granted."""
    pass


class DesktopAutomationError(RuntimeError):
    """Raised when desktop automation fails."""
    pass


@dataclass
class Point:
    """2D coordinate point."""
    x: int
    y: int


@dataclass
class Size:
    """Screen or window size."""
    width: int
    height: int


@dataclass
class ScreenshotResult:
    """Result of a screenshot operation."""
    success: bool
    image: PILImage | None = None
    base64_data: str | None = None
    error: str | None = None


def check_dependencies() -> list[str]:
    """Check for missing dependencies.
    
    Returns:
        List of missing dependency strings
    """
    return _MISSING_DEPS.copy()


def ensure_dependencies() -> None:
    """Ensure all required dependencies are installed.
    
    Raises:
        ImportError: If dependencies are missing with installation instructions
    """
    if _MISSING_DEPS:
        deps_str = "\n  ".join(_MISSING_DEPS)
        platform_name = platform.system().lower()
        
        install_cmd = "pip install allternit-computer-use[desktop]"
        if platform_name == "darwin":
            install_cmd = "pip install allternit-computer-use[desktop-macos]"
        elif platform_name == "windows":
            install_cmd = "pip install allternit-computer-use[desktop-windows]"
        elif platform_name == "linux":
            install_cmd = "pip install allternit-computer-use[desktop-linux]"
        
        raise ImportError(
            f"Missing required dependencies:\n  {deps_str}\n\n"
            f"Install with:\n  {install_cmd}\n\n"
            f"Or install all platform-specific dependencies:\n"
            f"  pip install allternit-computer-use[desktop-all]"
        )


def get_platform() -> Platform:
    """Get the current platform.
    
    Returns:
        Current platform enum
    """
    system = platform.system().lower()
    if system == "darwin":
        return Platform.MACOS
    elif system == "windows":
        return Platform.WINDOWS
    elif system == "linux":
        return Platform.LINUX
    return Platform.UNKNOWN


def check_macos_permissions() -> tuple[bool, str]:
    """Check if macOS has required Accessibility permissions.
    
    Returns:
        Tuple of (has_permissions, message)
    """
    if get_platform() != Platform.MACOS:
        return True, "Not on macOS"
    
    # Check if we can get screen size (basic test)
    try:
        if pyautogui:
            pyautogui.size()
            return True, "Accessibility permissions granted"
    except Exception as e:
        return False, (
            f"Accessibility permissions not granted: {e}\n\n"
            "To fix this:\n"
            "1. Open System Settings > Privacy & Security > Accessibility\n"
            "2. Add your terminal application (Terminal, iTerm2, etc.)\n"
            "3. Restart your terminal\n\n"
            "Or run with Administrator privileges for some actions."
        )
    
    return False, "Unable to verify permissions"


def check_windows_permissions() -> tuple[bool, str]:
    """Check Windows permissions.
    
    Returns:
        Tuple of (has_permissions, message)
    """
    if get_platform() != Platform.WINDOWS:
        return True, "Not on Windows"
    
    try:
        if pyautogui:
            pyautogui.size()
            return True, "Windows automation accessible"
    except Exception as e:
        return False, f"Windows automation error: {e}"
    
    return True, "Windows automation accessible"


def check_linux_permissions() -> tuple[bool, str]:
    """Check Linux X11/Wayland permissions.
    
    Returns:
        Tuple of (has_permissions, message)
    """
    if get_platform() != Platform.LINUX:
        return True, "Not on Linux"
    
    # Check for X11 display
    display = subprocess.run(
        ["echo", "$DISPLAY"],
        capture_output=True,
        shell=True,
        text=True
    )
    
    if display.returncode != 0 or not display.stdout.strip():
        return False, (
            "No X11 display available.\n\n"
            "PyAutoGUI requires X11 on Linux.\n"
            "For Wayland, consider using XWayland or alternative tools."
        )
    
    try:
        if pyautogui:
            pyautogui.size()
            return True, "X11 access available"
    except Exception as e:
        return False, (
            f"X11 access error: {e}\n\n"
            "Ensure python3-xlib is installed:\n"
            "  sudo apt-get install python3-xlib  # Debian/Ubuntu\n"
            "  sudo yum install python3-xlib      # RHEL/CentOS\n"
            "  sudo pacman -S python-xlib         # Arch"
        )
    
    return True, "X11 access available"


def check_permissions() -> tuple[bool, str]:
    """Check platform-specific permissions.
    
    Returns:
        Tuple of (has_permissions, message)
    """
    platform_type = get_platform()
    
    if platform_type == Platform.MACOS:
        return check_macos_permissions()
    elif platform_type == Platform.WINDOWS:
        return check_windows_permissions()
    elif platform_type == Platform.LINUX:
        return check_linux_permissions()
    
    return False, f"Unknown platform: {platform.system()}"


class PyAutoGUIAdapter:
    """Desktop automation adapter using PyAutoGUI.
    
    This adapter provides cross-platform desktop automation capabilities
    including screenshots, mouse control, and keyboard input.
    
    Example:
        >>> adapter = PyAutoGUIAdapter()
        >>> await adapter.initialize()
        >>> screenshot = await adapter.take_screenshot()
        >>> await adapter.click(100, 200)
        >>> await adapter.typewrite("Hello, World!")
    """
    
    def __init__(self) -> None:
        """Initialize the adapter."""
        self._initialized = False
        self._screen_size: Size | None = None
        self._platform = get_platform()
        
        # Safety settings
        self.safe_mode = True
        self.max_move_duration = 2.0  # seconds
        
    @property
    def is_available(self) -> bool:
        """Check if PyAutoGUI is available.
        
        Returns:
            True if PyAutoGUI is installed
        """
        return pyautogui is not None and not _MISSING_DEPS
    
    async def capabilities(self):
        from core.base_adapter import AdapterCapabilities
        return AdapterCapabilities(
            adapter_id="desktop.pyautogui",
            family="desktop",
            dom_tree=False,
            vision_required=True,
            multi_tab=False,
            platform=str(self._platform),
        )

    async def health_check(self) -> bool:
        return self.is_available and self._initialized

    async def initialize(self) -> None:
        """Initialize the adapter and verify permissions.

        Raises:
            ImportError: If dependencies are missing
            PermissionError: If required permissions are not granted
        """
        ensure_dependencies()
        
        has_perms, message = check_permissions()
        if not has_perms:
            raise PermissionError(message)
        
        if pyautogui:
            width, height = pyautogui.size()
            self._screen_size = Size(width=width, height=height)
        
        self._initialized = True
        logger.info(f"PyAutoGUI adapter initialized on {self._platform.value}")
    
    async def get_screen_size(self) -> Size:
        """Get the primary screen size.
        
        Returns:
            Screen size
            
        Raises:
            RuntimeError: If adapter is not initialized
        """
        if not self._initialized:
            raise RuntimeError("Adapter not initialized. Call initialize() first.")
        
        if self._screen_size:
            return self._screen_size
        
        if pyautogui:
            width, height = pyautogui.size()
            return Size(width=width, height=height)
        
        raise RuntimeError("PyAutoGUI not available")
    
    async def take_screenshot(
        self,
        region: tuple[int, int, int, int] | None = None,
        output_format: str = "png"
    ) -> ScreenshotResult:
        """Take a screenshot.
        
        Args:
            region: Optional (left, top, width, height) region
            output_format: Image format (png, jpg)
            
        Returns:
            Screenshot result with base64-encoded image
        """
        if not self._initialized:
            return ScreenshotResult(
                success=False,
                error="Adapter not initialized. Call initialize() first."
            )
        
        try:
            # Prefer mss for screenshots (faster, more reliable)
            if mss:
                with mss.mss() as sct:
                    if region:
                        monitor = {
                            "left": region[0],
                            "top": region[1],
                            "width": region[2],
                            "height": region[3]
                        }
                    else:
                        monitor = sct.monitors[1]  # Primary monitor
                    
                    screenshot = sct.grab(monitor)
                    img = Image.frombytes("RGB", screenshot.size, screenshot.bgra, "raw", "BGRX")
            elif pyautogui:
                # Fallback to pyautogui
                if region:
                    img = pyautogui.screenshot(region=region)
                else:
                    img = pyautogui.screenshot()
            else:
                return ScreenshotResult(
                    success=False,
                    error="No screenshot library available (mss or pyautogui)"
                )
            
            # Convert to base64
            buffer = io.BytesIO()
            img.save(buffer, format=output_format.upper())
            base64_data = base64.b64encode(buffer.getvalue()).decode("utf-8")
            
            return ScreenshotResult(
                success=True,
                image=img,
                base64_data=f"data:image/{output_format};base64,{base64_data}"
            )
            
        except Exception as e:
            logger.error(f"Screenshot failed: {e}")
            return ScreenshotResult(
                success=False,
                error=f"Screenshot failed: {str(e)}"
            )
    
    async def click(
        self,
        x: int | None = None,
        y: int | None = None,
        button: str = "left",
        clicks: int = 1
    ) -> None:
        """Click at specified coordinates or current position.
        
        Args:
            x: X coordinate (None for current position)
            y: Y coordinate (None for current position)
            button: Mouse button (left, right, middle)
            clicks: Number of clicks
            
        Raises:
            RuntimeError: If adapter not initialized or click fails
        """
        if not self._initialized:
            raise RuntimeError("Adapter not initialized. Call initialize() first.")
        
        if not pyautogui:
            raise RuntimeError("PyAutoGUI not available")
        
        try:
            if x is not None and y is not None:
                pyautogui.click(x, y, button=button, clicks=clicks)
            else:
                pyautogui.click(button=button, clicks=clicks)
        except Exception as e:
            raise RuntimeError(f"Click failed: {e}")
    
    async def move_to(self, x: int, y: int, duration: float = 0.5) -> None:
        """Move mouse to coordinates.
        
        Args:
            x: X coordinate
            y: Y coordinate
            duration: Movement duration in seconds
            
        Raises:
            RuntimeError: If adapter not initialized or move fails
        """
        if not self._initialized:
            raise RuntimeError("Adapter not initialized. Call initialize() first.")
        
        if not pyautogui:
            raise RuntimeError("PyAutoGUI not available")
        
        # Safety limit for duration
        if self.safe_mode:
            duration = min(duration, self.max_move_duration)
        
        try:
            pyautogui.moveTo(x, y, duration=duration)
        except Exception as e:
            raise RuntimeError(f"Mouse move failed: {e}")
    
    async def scroll(self, amount: int, x: int | None = None, y: int | None = None) -> None:
        """Scroll the mouse wheel.
        
        Args:
            amount: Scroll amount (positive=up, negative=down)
            x: Optional X coordinate to move to first
            y: Optional Y coordinate to move to first
            
        Raises:
            RuntimeError: If adapter not initialized or scroll fails
        """
        if not self._initialized:
            raise RuntimeError("Adapter not initialized. Call initialize() first.")
        
        if not pyautogui:
            raise RuntimeError("PyAutoGUI not available")
        
        try:
            if x is not None and y is not None:
                pyautogui.scroll(amount, x, y)
            else:
                pyautogui.scroll(amount)
        except Exception as e:
            raise RuntimeError(f"Scroll failed: {e}")
    
    async def typewrite(self, text: str, interval: float = 0.01) -> None:
        """Type text.
        
        Args:
            text: Text to type
            interval: Seconds between keystrokes
            
        Raises:
            RuntimeError: If adapter not initialized or typing fails
        """
        if not self._initialized:
            raise RuntimeError("Adapter not initialized. Call initialize() first.")
        
        if not pyautogui:
            raise RuntimeError("PyAutoGUI not available")
        
        try:
            pyautogui.typewrite(text, interval=interval)
        except Exception as e:
            raise RuntimeError(f"Typewrite failed: {e}")
    
    async def press(self, key: str) -> None:
        """Press a single key.
        
        Args:
            key: Key to press (e.g., 'enter', 'esc', 'f1')
            
        Raises:
            RuntimeError: If adapter not initialized or press fails
        """
        if not self._initialized:
            raise RuntimeError("Adapter not initialized. Call initialize() first.")
        
        if not pyautogui:
            raise RuntimeError("PyAutoGUI not available")
        
        try:
            pyautogui.press(key)
        except Exception as e:
            raise RuntimeError(f"Key press failed: {e}")
    
    async def hotkey(self, *keys: str) -> None:
        """Press a hotkey combination.
        
        Args:
            *keys: Keys to press simultaneously (e.g., 'ctrl', 'c')
            
        Raises:
            RuntimeError: If adapter not initialized or hotkey fails
        """
        if not self._initialized:
            raise RuntimeError("Adapter not initialized. Call initialize() first.")
        
        if not pyautogui:
            raise RuntimeError("PyAutoGUI not available")
        
        try:
            pyautogui.hotkey(*keys)
        except Exception as e:
            raise RuntimeError(f"Hotkey failed: {e}")
    
    async def get_mouse_position(self) -> Point:
        """Get current mouse position.
        
        Returns:
            Current mouse coordinates
            
        Raises:
            RuntimeError: If adapter not initialized
        """
        if not self._initialized:
            raise RuntimeError("Adapter not initialized. Call initialize() first.")
        
        if not pyautogui:
            raise RuntimeError("PyAutoGUI not available")
        
        try:
            x, y = pyautogui.position()
            return Point(x=x, y=y)
        except Exception as e:
            raise RuntimeError(f"Get position failed: {e}")
    
    async def locate_on_screen(
        self,
        image_path: str,
        confidence: float = 0.9,
        grayscale: bool = False
    ) -> Point | None:
        """Locate an image on screen.
        
        Args:
            image_path: Path to image to search for
            confidence: Matching confidence (0-1), requires opencv-python
            grayscale: Convert to grayscale for matching
            
        Returns:
            Center point of match, or None if not found
            
        Raises:
            RuntimeError: If adapter not initialized
        """
        if not self._initialized:
            raise RuntimeError("Adapter not initialized. Call initialize() first.")
        
        if not pyautogui:
            raise RuntimeError("PyAutoGUI not available")
        
        try:
            # Confidence requires opencv-python
            location = pyautogui.locateOnScreen(
                image_path,
                confidence=confidence if confidence < 1.0 else None,
                grayscale=grayscale
            )
            if location:
                center = pyautogui.center(location)
                return Point(x=center.x, y=center.y)
            return None
        except Exception as e:
            logger.warning(f"Locate on screen failed: {e}")
            return None
    
    async def alert(self, text: str, title: str = "", button: str = "OK") -> str:
        """Display an alert dialog.
        
        Args:
            text: Alert message
            title: Alert title
            button: Button text
            
        Returns:
            Button that was clicked
            
        Raises:
            RuntimeError: If adapter not initialized
        """
        if not self._initialized:
            raise RuntimeError("Adapter not initialized. Call initialize() first.")
        
        if not pyautogui:
            raise RuntimeError("PyAutoGUI not available")
        
        try:
            return pyautogui.alert(text=text, title=title, button=button)
        except Exception as e:
            raise RuntimeError(f"Alert failed: {e}")
    
    async def confirm(
        self,
        text: str,
        title: str = "",
        buttons: tuple[str, ...] = ("OK", "Cancel")
    ) -> str:
        """Display a confirmation dialog.
        
        Args:
            text: Confirmation message
            title: Confirmation title
            buttons: Button texts
            
        Returns:
            Button that was clicked
            
        Raises:
            RuntimeError: If adapter not initialized
        """
        if not self._initialized:
            raise RuntimeError("Adapter not initialized. Call initialize() first.")
        
        if not pyautogui:
            raise RuntimeError("PyAutoGUI not available")
        
        try:
            return pyautogui.confirm(text=text, title=title, buttons=list(buttons))
        except Exception as e:
            raise RuntimeError(f"Confirm failed: {e}")
    
    async def dispose(self) -> None:
        """Clean up resources."""
        self._initialized = False
        logger.info("PyAutoGUI adapter disposed")

    async def screenshot(self, session_id: str = "") -> bytes:
        """Return raw PNG bytes — convenience method for PlanningLoop."""
        if not self._initialized:
            await self.initialize()
        result = await self.take_screenshot()
        if result.success and result.base64_data:
            import base64 as _b64
            # strip data URI prefix if present
            raw = result.base64_data.split(",", 1)[-1] if "," in result.base64_data else result.base64_data
            return _b64.b64decode(raw)
        return b""

    async def execute(self, req) -> "_DesktopResult":
        """Duck-typed execute() for PlanningLoop compatibility."""
        if not self._initialized:
            await self.initialize()
        action_type = getattr(req, "action_type", "screenshot")
        params = getattr(req, "parameters", {}) or {}
        session_id = getattr(req, "session_id", "")
        success = True
        error_msg = None
        try:
            if action_type == "screenshot":
                pass  # handled by PlanningLoop via self.screenshot()
            elif action_type in ("click",):
                x = params.get("x")
                y = params.get("y")
                await self.click(x, y)
            elif action_type in ("type", "fill"):
                text = params.get("text", "")
                await self.typewrite(text)
            elif action_type == "scroll":
                amount = int(params.get("amount", 3))
                if params.get("direction", "down") == "up":
                    amount = -amount
                await self.scroll(amount)
            elif action_type in ("key", "press"):
                keys = params.get("keys", "") or getattr(req, "target", "")
                await self.press(keys)
            elif action_type == "move":
                await self.move_to(int(params.get("x", 0)), int(params.get("y", 0)))
            else:
                error_msg = f"Unsupported desktop action: {action_type}"
                success = False
        except Exception as e:
            error_msg = str(e)
            success = False
        return _DesktopResult(success=success, action_type=action_type, error=error_msg)


class _DesktopResult:
    def __init__(self, success: bool, action_type: str, error=None):
        self.success = success
        self.action_type = action_type
        self.error = error
        self.artifacts: list = []

    def to_dict(self):
        return {"success": self.success, "action_type": self.action_type, "error": self.error}


def get_setup_instructions() -> str:
    """Get platform-specific setup instructions.
    
    Returns:
        Setup instructions for the current platform
    """
    platform_type = get_platform()
    
    base_instructions = """
╔══════════════════════════════════════════════════════════════════════════════╗
║                    DESKTOP AUTOMATION SETUP INSTRUCTIONS                     ║
╚══════════════════════════════════════════════════════════════════════════════╝

Installation:
"""
    
    if platform_type == Platform.MACOS:
        return base_instructions + """
# 1. Install the package
pip install allternit-computer-use[desktop-macos]

# 2. Grant Accessibility Permissions (REQUIRED)
#    - Open System Settings > Privacy & Security > Accessibility
#    - Click the lock to make changes (enter password)
#    - Add your terminal application:
#      * Terminal.app (if using default Terminal)
#      * iTerm.app (if using iTerm2)
#      * Code.app (if using VS Code terminal)
#      * Cursor.app (if using Cursor terminal)
#    - Ensure the checkbox is checked
#
# 3. Grant Screen Recording Permissions (for screenshots)
#    - Open System Settings > Privacy & Security > Screen Recording
#    - Add your terminal application as above
#    - Restart your terminal after granting

# 4. Verify Installation
python -c "from adapters.desktop.pyautogui import PyAutoGUIAdapter; print('✓ OK')"

Troubleshooting:
- If you get permission errors, re-grant accessibility permissions
- Some actions may require Administrator privileges
- For Apple Silicon Macs, no additional setup required
"""
    
    elif platform_type == Platform.WINDOWS:
        return base_instructions + """
# 1. Install the package
pip install allternit-computer-use[desktop-windows]

# 2. No additional permissions required for basic usage
#    Some actions may require running as Administrator:
#    - Right-click on your terminal/IDE
#    - Select "Run as Administrator"

# 3. Verify Installation
python -c "from adapters.desktop.pyautogui import PyAutoGUIAdapter; print('OK')"

Troubleshooting:
- If UAC prompts appear, click "Yes" to allow
- For UAC-protected windows, run as Administrator
- Windows Defender may prompt for certain actions
"""
    
    elif platform_type == Platform.LINUX:
        return base_instructions + """
# 1. Install system dependencies
# Debian/Ubuntu:
sudo apt-get install python3-xlib python3-tk python3-dev

# RHEL/CentOS/Fedora:
sudo yum install python3-xlib python3-tkinter python3-devel

# Arch Linux:
sudo pacman -S python-xlib tk python-dev

# 2. Install the package
pip install allternit-computer-use[desktop-linux]

# 3. Ensure X11 is available
#    PyAutoGUI requires X11 display server
#    For Wayland, use XWayland compatibility layer

# 4. Verify Installation
python -c "from adapters.desktop.pyautogui import PyAutoGUIAdapter; print('✓ OK')"

Troubleshooting:
- For headless servers, install Xvfb:
  sudo apt-get install xvfb
  export DISPLAY=:99
  Xvfb :99 -screen 0 1920x1080x24 &
- Ensure $DISPLAY environment variable is set
- Some distributions may require additional X11 development packages
"""
    
    else:
        return base_instructions + """
# 1. Install base package
pip install allternit-computer-use[desktop]

# 2. Install platform-specific dependencies:
#    macOS:   pip install pyobjc>=10.0
#    Windows: pip install pywin32>=306
#    Linux:   sudo apt-get install python3-xlib

# 3. Verify Installation
python -c "from adapters.desktop.pyautogui import PyAutoGUIAdapter; print('OK')"

Unknown platform detected. Please report this issue.
"""


# Convenience function for quick setup
def setup() -> None:
    """Print setup instructions for the current platform."""
    print(get_setup_instructions())


if __name__ == "__main__":
    setup()
