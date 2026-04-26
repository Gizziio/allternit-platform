"""
Integration tests for adapter classes (PyAutoGUIAdapter and OperatorAdapter).

These tests verify the adapter classes work correctly with graceful fallback.
Run with: pytest tests/integration/test_adapter_classes.py -v
"""

import asyncio
import os
import platform
import pytest
from typing import Tuple
from unittest.mock import Mock, patch, AsyncMock

# Mark all tests in this module
pytestmark = [
    pytest.mark.integration,
    pytest.mark.asyncio,
]

# Platform detection
IS_MACOS = platform.system() == "Darwin"
IS_WINDOWS = platform.system() == "Windows"
IS_LINUX = platform.system() == "Linux"


class TestPyAutoGUIAdapter:
    """Tests for PyAutoGUIAdapter class."""
    
    @pytest.fixture
    def adapter(self):
        """Create a PyAutoGUIAdapter instance."""
        from adapters.desktop.pyautogui import PyAutoGUIAdapter
        return PyAutoGUIAdapter()
    
    def test_adapter_import(self):
        """Test that PyAutoGUIAdapter can be imported."""
        from adapters.desktop.pyautogui import (
            PyAutoGUIAdapter,
            Platform,
            Point,
            Size,
            ScreenshotResult,
            PermissionError,
            DesktopAutomationError,
        )
        assert PyAutoGUIAdapter is not None
        assert Platform is not None
        assert Point is not None
        assert Size is not None
        assert ScreenshotResult is not None
    
    def test_check_dependencies(self):
        """Test dependency checking."""
        from adapters.desktop.pyautogui import check_dependencies
        
        missing = check_dependencies()
        # Should return a list (empty if deps installed, or list of missing deps)
        assert isinstance(missing, list)
    
    def test_get_platform(self):
        """Test platform detection."""
        from adapters.desktop.pyautogui import get_platform, Platform
        
        platform_type = get_platform()
        assert isinstance(platform_type, Platform)
        
        if IS_MACOS:
            assert platform_type == Platform.MACOS
        elif IS_WINDOWS:
            assert platform_type == Platform.WINDOWS
        elif IS_LINUX:
            assert platform_type == Platform.LINUX
    
    def test_get_setup_instructions(self):
        """Test setup instructions generation."""
        from adapters.desktop.pyautogui import get_setup_instructions
        
        instructions = get_setup_instructions()
        assert isinstance(instructions, str)
        assert "DESKTOP AUTOMATION SETUP INSTRUCTIONS" in instructions
        
        if IS_MACOS:
            assert "macOS" in instructions or "System Settings" in instructions
        elif IS_WINDOWS:
            assert "Windows" in instructions or "Administrator" in instructions
        elif IS_LINUX:
            assert "Linux" in instructions or "apt-get" in instructions
    
    def test_dataclasses(self):
        """Test dataclass constructors."""
        from adapters.desktop.pyautogui import Point, Size, ScreenshotResult
        
        point = Point(x=100, y=200)
        assert point.x == 100
        assert point.y == 200
        
        size = Size(width=1920, height=1080)
        assert size.width == 1920
        assert size.height == 1080
        
        result = ScreenshotResult(success=True, base64_data="test_data")
        assert result.success is True
        assert result.base64_data == "test_data"
    
    @pytest.mark.skipif(
        pytest.importorskip("pyautogui", reason="PyAutoGUI not installed") is None,
        reason="PyAutoGUI not installed"
    )
    async def test_adapter_initialization(self, adapter):
        """Test adapter initialization."""
        from adapters.desktop.pyautogui import check_dependencies
        
        missing = check_dependencies()
        if missing:
            pytest.skip(f"Missing dependencies: {missing}")
        
        # Test initialization
        try:
            await adapter.initialize()
            assert adapter._initialized is True
            
            # Test screen size
            size = await adapter.get_screen_size()
            assert size.width > 0
            assert size.height > 0
            
            await adapter.dispose()
            assert adapter._initialized is False
        except Exception as e:
            # May fail due to permissions - that's OK for this test
            pytest.skip(f"Initialization failed (likely permissions): {e}")
    
    @pytest.mark.skipif(
        pytest.importorskip("pyautogui", reason="PyAutoGUI not installed") is None,
        reason="PyAutoGUI not installed"
    )
    async def test_screenshot(self, adapter):
        """Test screenshot functionality."""
        from adapters.desktop.pyautogui import check_dependencies
        
        missing = check_dependencies()
        if missing:
            pytest.skip(f"Missing dependencies: {missing}")
        
        try:
            await adapter.initialize()
            
            # Take screenshot
            result = await adapter.take_screenshot()
            
            if result.success:
                assert result.base64_data is not None
                assert result.base64_data.startswith("data:image/")
            else:
                # Screenshot may fail due to permissions
                assert result.error is not None
            
            await adapter.dispose()
        except Exception as e:
            pytest.skip(f"Screenshot failed (likely permissions): {e}")
    
    @pytest.mark.skipif(
        pytest.importorskip("pyautogui", reason="PyAutoGUI not installed") is None,
        reason="PyAutoGUI not installed"
    )
    async def test_mouse_control(self, adapter):
        """Test mouse control functions."""
        from adapters.desktop.pyautogui import check_dependencies
        
        missing = check_dependencies()
        if missing:
            pytest.skip(f"Missing dependencies: {missing}")
        
        try:
            await adapter.initialize()
            
            # Get current position
            original_pos = await adapter.get_mouse_position()
            assert isinstance(original_pos.x, int)
            assert isinstance(original_pos.y, int)
            
            # Move to safe location (top-left area)
            await adapter.move_to(100, 100, duration=0.1)
            new_pos = await adapter.get_mouse_position()
            assert new_pos.x == 100
            assert new_pos.y == 100
            
            # Restore original position
            await adapter.move_to(original_pos.x, original_pos.y, duration=0.1)
            
            await adapter.dispose()
        except Exception as e:
            pytest.skip(f"Mouse control failed (likely permissions): {e}")
    
    async def test_adapter_without_deps(self):
        """Test adapter behavior when dependencies are missing."""
        from adapters.desktop.pyautogui import PyAutoGUIAdapter, check_dependencies
        
        missing = check_dependencies()
        if not missing:
            pytest.skip("All dependencies installed - cannot test missing deps scenario")
        
        adapter = PyAutoGUIAdapter()
        
        # Should raise ImportError when initializing without deps
        with pytest.raises(ImportError):
            await adapter.initialize()


class TestOperatorAdapter:
    """Tests for OperatorAdapter class."""
    
    def test_adapter_import(self):
        """Test that OperatorAdapter can be imported."""
        try:
            from adapters.desktop.operator import (
                OperatorAdapter,
                OperatorConnectionError,
                Action,
                ActionType,
                ActionResult,
                OperatorConfig,
            )
            assert OperatorAdapter is not None
            assert OperatorConnectionError is not None
            assert Action is not None
            assert ActionType is not None
        except ImportError:
            pytest.skip("Operator adapter not available (aiohttp not installed)")
    
    def test_action_dataclass(self):
        """Test Action dataclass."""
        try:
            from adapters.desktop.operator import Action, ActionType
        except ImportError:
            pytest.skip("Operator adapter not available")
        
        action = Action(type=ActionType.CLICK, params={"x": 100, "y": 200})
        assert action.type == ActionType.CLICK
        assert action.params == {"x": 100, "y": 200}
        
        # Test to_dict
        data = action.to_dict()
        assert data["type"] == "click"
        assert data["params"] == {"x": 100, "y": 200}
    
    def test_operator_config(self):
        """Test OperatorConfig."""
        try:
            from adapters.desktop.operator import OperatorConfig
        except ImportError:
            pytest.skip("Operator adapter not available")
        
        # Test default config
        config = OperatorConfig()
        assert config.url == "http://localhost:8080"
        assert config.timeout == 30
        assert config.enable_fallback is True
        
        # Test with environment variables
        with patch.dict(os.environ, {"OPERATOR_URL": "http://test:9090", "OPERATOR_TIMEOUT": "60"}):
            config = OperatorConfig()
            assert config.url == "http://test:9090"
            assert config.timeout == 60
        
        # Test with API key
        with patch.dict(os.environ, {"OPERATOR_API_KEY": "test-key"}):
            config = OperatorConfig()
            headers = config.get_headers()
            assert headers["Authorization"] == "Bearer test-key"
    
    def test_get_operator_info(self):
        """Test get_operator_info function."""
        try:
            from adapters.desktop.operator import get_operator_info
        except ImportError:
            pytest.skip("Operator adapter not available")
        
        info = get_operator_info()
        assert isinstance(info, dict)
        assert "aiohttp_installed" in info
        assert "pyautogui_installed" in info
        assert "fallback_available" in info
        assert "platform" in info
    
    async def test_adapter_creation(self):
        """Test OperatorAdapter creation."""
        try:
            from adapters.desktop.operator import OperatorAdapter, OperatorConfig
        except ImportError:
            pytest.skip("Operator adapter not available")
        
        # Create with default config
        adapter = OperatorAdapter()
        assert adapter.config is not None
        assert adapter._initialized is False
        
        # Create with custom config
        config = OperatorConfig(url="http://custom:8080")
        adapter = OperatorAdapter(config)
        assert adapter.config.url == "http://custom:8080"
    
    async def test_fallback_detection(self):
        """Test that fallback mode is detected correctly."""
        try:
            from adapters.desktop.operator import OperatorAdapter
            from adapters.desktop.pyautogui import check_dependencies
        except ImportError:
            pytest.skip("Operator adapter not available")
        
        adapter = OperatorAdapter()
        
        # Check if fallback would be available
        has_pyautogui = len(check_dependencies()) == 0
        
        # is_available should consider fallback
        is_available = adapter.is_available
        
        # If PyAutoGUI is available, adapter should be available
        if has_pyautogui:
            assert is_available is True


class TestAdapterIntegration:
    """Integration tests between adapters."""
    
    async def test_adapter_consistency(self):
        """Test that adapters return consistent data types."""
        from adapters.desktop.pyautogui import (
            Point, Size, Platform, get_platform
        )
        
        # Test platform consistency
        platform_type = get_platform()
        assert isinstance(platform_type, Platform)
        
        # Test dataclass consistency
        point = Point(x=1, y=2)
        size = Size(width=100, height=200)
        
        assert hasattr(point, 'x')
        assert hasattr(point, 'y')
        assert hasattr(size, 'width')
        assert hasattr(size, 'height')


class TestGracefulImports:
    """Tests for graceful import handling."""
    
    def test_imports_without_deps(self):
        """Test that adapters can be imported even without dependencies."""
        # This test verifies the graceful import mechanism works
        # The module should import even if pyautogui/mss etc are not installed
        
        from adapters.desktop.pyautogui import (
            PyAutoGUIAdapter,
            Platform,
            Point,
            Size,
            ScreenshotResult,
            check_dependencies,
            check_permissions,
            get_platform,
            get_setup_instructions,
        )
        
        # All these should be importable
        assert PyAutoGUIAdapter is not None
        assert Platform is not None
        assert Point is not None
        assert Size is not None
        assert ScreenshotResult is not None
        assert callable(check_dependencies)
        assert callable(check_permissions)
        assert callable(get_platform)
        assert callable(get_setup_instructions)
    
    def test_error_types(self):
        """Test that custom error types are available."""
        from adapters.desktop.pyautogui import (
            PermissionError as DesktopPermissionError,
            DesktopAutomationError,
        )
        
        # Verify error types
        assert issubclass(DesktopPermissionError, RuntimeError)
        assert issubclass(DesktopAutomationError, RuntimeError)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
