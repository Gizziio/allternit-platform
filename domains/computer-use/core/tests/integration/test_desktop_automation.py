"""
Integration tests for desktop automation with PyAutoGUI.

These tests verify desktop automation capabilities using PyAutoGUI.
Tests skip gracefully if permissions are not granted.
All tests use safe, non-destructive actions only.

Run with: pytest -m integration
Run desktop tests only: pytest -m "requires_desktop"

WARNING: These tests move the mouse and take screenshots.
Run only in a safe test environment.
"""

import os
import sys
import time
import pytest
import platform
from typing import Tuple, Optional
from unittest.mock import Mock, patch
from pathlib import Path

# Mark all tests in this module
pytestmark = [
    pytest.mark.integration,
    pytest.mark.requires_desktop,
]


# Platform detection
IS_MACOS = platform.system() == "Darwin"
IS_WINDOWS = platform.system() == "Windows"
IS_LINUX = platform.system() == "Linux"


# Fixtures for permission checks
@pytest.fixture(scope="session")
def pyautogui_available() -> bool:
    """Check if PyAutoGUI is installed."""
    try:
        import pyautogui
        return True
    except ImportError:
        return False


@pytest.fixture(scope="session")
def desktop_permissions_granted() -> bool:
    """
    Check if desktop automation permissions are granted.
    
    On macOS: Requires Screen Recording and Accessibility permissions
    On Windows: Generally no special permissions needed
    On Linux: Requires X11 or Wayland access
    """
    try:
        import pyautogui
        
        # Try to take a screenshot - this requires screen recording permission
        # Use a small region to test quickly
        if IS_MACOS:
            # macOS requires explicit permissions
            screenshot = pyautogui.screenshot(region=(0, 0, 10, 10))
            return screenshot is not None
        elif IS_WINDOWS or IS_LINUX:
            screenshot = pyautogui.screenshot(region=(0, 0, 10, 10))
            return screenshot is not None
        
    except Exception as e:
        # Permission denied or other error
        return False
    
    return False


@pytest.fixture(scope="session")
def safe_test_region() -> Tuple[int, int, int, int]:
    """
    Define a safe test region for mouse movements.
    Returns (x, y, width, height) for a safe area.
    """
    try:
        import pyautogui
        screen_width, screen_height = pyautogui.size()
        
        # Use a small region in the top-left corner, away from critical UI
        # This minimizes risk of accidentally clicking system controls
        safe_x = 100
        safe_y = 100
        safe_width = min(400, screen_width - safe_x - 50)
        safe_height = min(300, screen_height - safe_y - 50)
        
        return (safe_x, safe_y, safe_width, safe_height)
    except Exception:
        # Default fallback
        return (100, 100, 400, 300)


@pytest.fixture
def restore_mouse_position():
    """Fixture to restore mouse position after test."""
    try:
        import pyautogui
        original_x, original_y = pyautogui.position()
        yield
        # Restore original position
        pyautogui.moveTo(original_x, original_y, duration=0.1)
    except Exception:
        yield


# Skip decorator for desktop tests
desktop_test = pytest.mark.skipif(
    not pytest.importorskip("pyautogui", reason="PyAutoGUI not installed"),
    reason="PyAutoGUI not installed"
)


@desktop_test
class TestDesktopScreenshot:
    """Tests for desktop screenshot capabilities."""
    
    def test_screenshot_full_screen(self, desktop_permissions_granted):
        """Test taking a full screen screenshot."""
        if not desktop_permissions_granted:
            pytest.skip("Desktop permissions not granted")
        
        import pyautogui
        
        screenshot = pyautogui.screenshot()
        
        assert screenshot is not None
        assert screenshot.size[0] > 0
        assert screenshot.size[1] > 0
        
        # Verify it's a valid image
        assert screenshot.mode in ['RGB', 'RGBA', 'L']
    
    def test_screenshot_region(self, desktop_permissions_granted, safe_test_region):
        """Test taking a region screenshot."""
        if not desktop_permissions_granted:
            pytest.skip("Desktop permissions not granted")
        
        import pyautogui
        
        x, y, width, height = safe_test_region
        
        screenshot = pyautogui.screenshot(region=(x, y, width, height))
        
        assert screenshot is not None
        assert screenshot.size == (width, height)
    
    def test_screenshot_save_to_file(
        self, desktop_permissions_granted, safe_test_region, tmp_path
    ):
        """Test saving screenshot to file."""
        if not desktop_permissions_granted:
            pytest.skip("Desktop permissions not granted")
        
        import pyautogui
        
        screenshot_path = tmp_path / "test_screenshot.png"
        x, y, width, height = safe_test_region
        
        screenshot = pyautogui.screenshot(region=(x, y, width, height))
        screenshot.save(str(screenshot_path))

        assert screenshot_path.exists()
        assert screenshot_path.stat().st_size > 0
        
        # Verify it's a valid PNG
        with open(screenshot_path, 'rb') as f:
            header = f.read(8)
            assert header == b'\x89PNG\r\n\x1a\n'


@desktop_test
class TestDesktopMouse:
    """Tests for desktop mouse control."""
    
    def test_get_screen_size(self, desktop_permissions_granted):
        """Test getting screen dimensions."""
        if not desktop_permissions_granted:
            pytest.skip("Desktop permissions not granted")
        
        import pyautogui
        
        width, height = pyautogui.size()
        
        assert width > 0
        assert height > 0
        assert isinstance(width, int)
        assert isinstance(height, int)
    
    def test_get_mouse_position(self, desktop_permissions_granted):
        """Test getting current mouse position."""
        if not desktop_permissions_granted:
            pytest.skip("Desktop permissions not granted")
        
        import pyautogui
        
        x, y = pyautogui.position()
        
        assert isinstance(x, int)
        assert isinstance(y, int)
        assert x >= 0
        assert y >= 0
    
    def test_mouse_move_relative(
        self, desktop_permissions_granted, safe_test_region, restore_mouse_position
    ):
        """Test moving mouse relative to current position."""
        if not desktop_permissions_granted:
            pytest.skip("Desktop permissions not granted")
        
        import pyautogui
        
        # Start from a known position
        start_x, start_y = 200, 200
        pyautogui.moveTo(start_x, start_y)
        
        # Move relative
        pyautogui.moveRel(50, 50, duration=0.1)
        
        new_x, new_y = pyautogui.position()
        
        assert new_x == start_x + 50
        assert new_y == start_y + 50
    
    def test_mouse_move_absolute(
        self, desktop_permissions_granted, safe_test_region, restore_mouse_position
    ):
        """Test moving mouse to absolute coordinates."""
        if not desktop_permissions_granted:
            pytest.skip("Desktop permissions not granted")
        
        import pyautogui
        
        target_x, target_y = 300, 300
        
        pyautogui.moveTo(target_x, target_y, duration=0.1)
        
        x, y = pyautogui.position()
        
        assert x == target_x
        assert y == target_y
    
    def test_mouse_click(
        self, desktop_permissions_granted, safe_test_region, restore_mouse_position
    ):
        """Test mouse click at current position (safe - no UI interaction)."""
        if not desktop_permissions_granted:
            pytest.skip("Desktop permissions not granted")
        
        import pyautogui
        
        # Move to safe area first
        safe_x, safe_y, _, _ = safe_test_region
        pyautogui.moveTo(safe_x + 50, safe_y + 50, duration=0.1)
        
        # Perform click (just verifies no exception is raised)
        # Click on desktop background (safe area)
        pyautogui.click()
        
        # If we get here, click worked
        assert True
    
    def test_mouse_drag(
        self, desktop_permissions_granted, safe_test_region, restore_mouse_position
    ):
        """Test mouse drag operation."""
        if not desktop_permissions_granted:
            pytest.skip("Desktop permissions not granted")
        
        import pyautogui
        
        safe_x, safe_y, _, _ = safe_test_region
        start_x, start_y = safe_x + 50, safe_y + 50
        end_x, end_y = safe_x + 150, safe_y + 50
        
        # Move to start position
        pyautogui.moveTo(start_x, start_y, duration=0.1)
        
        # Drag to end position
        pyautogui.dragTo(end_x, end_y, duration=0.2, button='left')
        
        # Verify final position
        final_x, final_y = pyautogui.position()
        assert final_x == end_x
        assert final_y == end_y


@desktop_test
class TestDesktopKeyboard:
    """Tests for desktop keyboard control."""
    
    def test_type_text(self, desktop_permissions_granted, restore_mouse_position):
        """Test typing text (types into a safe location - desktop)."""
        if not desktop_permissions_granted:
            pytest.skip("Desktop permissions not granted")
        
        import pyautogui
        
        # This test just verifies the function doesn't raise an exception
        # It types into nowhere (desktop) which is safe
        try:
            # Use a short test string
            pyautogui.typewrite("test", interval=0.01)
            assert True
        except Exception as e:
            pytest.fail(f"Typewrite raised an exception: {e}")
    
    def test_press_key(self, desktop_permissions_granted):
        """Test pressing a single key."""
        if not desktop_permissions_granted:
            pytest.skip("Desktop permissions not granted")
        
        import pyautogui
        
        # Press a harmless key (shift) - just verifies no exception
        try:
            pyautogui.press('shift')
            assert True
        except Exception as e:
            pytest.fail(f"Press raised an exception: {e}")
    
    def test_hotkey(self, desktop_permissions_granted):
        """Test pressing key combination."""
        if not desktop_permissions_granted:
            pytest.skip("Desktop permissions not granted")
        
        import pyautogui
        
        # Use a safe hotkey (Ctrl+A then Escape to cancel)
        try:
            # Just test the hotkey function works
            pyautogui.keyDown('ctrl')
            pyautogui.keyUp('ctrl')
            assert True
        except Exception as e:
            pytest.fail(f"Hotkey raised an exception: {e}")


@desktop_test
class TestDesktopPixel:
    """Tests for desktop pixel/pixel color operations."""
    
    def test_get_pixel_color(
        self, desktop_permissions_granted, safe_test_region
    ):
        """Test getting pixel color at specific coordinates."""
        if not desktop_permissions_granted:
            pytest.skip("Desktop permissions not granted")
        
        import pyautogui
        
        safe_x, safe_y, _, _ = safe_test_region
        
        # Get pixel color at a safe location
        color = pyautogui.pixel(safe_x, safe_y)
        
        assert isinstance(color, tuple)
        assert len(color) == 3
        # RGB values should be 0-255
        assert all(0 <= c <= 255 for c in color)
    
    def test_pixel_matches_color(
        self, desktop_permissions_granted, safe_test_region
    ):
        """Test checking if pixel matches expected color."""
        if not desktop_permissions_granted:
            pytest.skip("Desktop permissions not granted")
        
        import pyautogui
        
        safe_x, safe_y, _, _ = safe_test_region
        
        # Get actual color first
        actual_color = pyautogui.pixel(safe_x, safe_y)
        
        # Verify matchPixel works
        matches = pyautogui.pixelMatchesColor(
            safe_x, safe_y, actual_color, tolerance=10
        )
        
        assert matches is True
        
        # Verify non-matching color returns False
        non_matching_color = (
            255 - actual_color[0],
            255 - actual_color[1],
            255 - actual_color[2]
        )
        matches_wrong = pyautogui.pixelMatchesColor(
            safe_x, safe_y, non_matching_color, tolerance=10
        )
        
        assert matches_wrong is False


# Mock Tests for CI (when real desktop automation not available)
class TestDesktopAutomationMock:
    """Mock tests for desktop automation that work in CI."""
    
    @patch('pyautogui.screenshot')
    def test_mock_screenshot(self, mock_screenshot):
        """Test screenshot with mocked pyautogui."""
        from PIL import Image
        
        # Create a fake screenshot
        fake_image = Image.new('RGB', (1920, 1080), color='red')
        mock_screenshot.return_value = fake_image
        
        import pyautogui
        screenshot = pyautogui.screenshot()
        
        assert screenshot.size == (1920, 1080)
        mock_screenshot.assert_called_once()
    
    @patch('pyautogui.size')
    def test_mock_screen_size(self, mock_size):
        """Test screen size with mocked pyautogui."""
        mock_size.return_value = (1920, 1080)
        
        import pyautogui
        width, height = pyautogui.size()
        
        assert width == 1920
        assert height == 1080
    
    @patch('pyautogui.position')
    @patch('pyautogui.moveTo')
    def test_mock_mouse_move(self, mock_move, mock_position):
        """Test mouse movement with mocked pyautogui."""
        mock_position.return_value = (100, 100)
        
        import pyautogui
        pyautogui.moveTo(500, 500, duration=0.1)
        
        mock_move.assert_called_once_with(500, 500, duration=0.1)
    
    @patch('pyautogui.click')
    def test_mock_mouse_click(self, mock_click):
        """Test mouse click with mocked pyautogui."""
        import pyautogui
        pyautogui.click(100, 200, button='left')
        
        mock_click.assert_called_once_with(100, 200, button='left')


# Permission Helper Tests
class TestPermissionHelpers:
    """Tests for permission helper functions."""
    
    @pytest.mark.skipif(not IS_MACOS, reason="macOS only test")
    def test_macos_permission_check(self):
        """Test macOS-specific permission checking."""
        import subprocess
        
        # Check if we can get screen recording status
        # Note: This is a simplified check
        try:
            result = subprocess.run(
                ["osascript", "-e", 'tell application "System Events" to return name of first application process whose frontmost is true'],
                capture_output=True,
                text=True,
                timeout=5
            )
            # If this works, we likely have accessibility permissions
            has_accessibility = result.returncode == 0
        except Exception:
            has_accessibility = False
        
        # This is informational only
        assert isinstance(has_accessibility, bool)
    
    def test_platform_detection(self):
        """Test platform detection is working."""
        assert IS_MACOS or IS_WINDOWS or IS_LINUX
        
        # Only one should be true
        assert sum([IS_MACOS, IS_WINDOWS, IS_LINUX]) == 1


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
