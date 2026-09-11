#!/usr/bin/env python3
"""Test script to verify desktop automation setup."""

import asyncio
import sys

def test_imports():
    """Test that all imports work correctly."""
    print("Testing imports...")
    
    # Test graceful imports (should not fail even without deps)
    try:
        from adapters.desktop.pyautogui import (
            PyAutoGUIAdapter,
            check_dependencies,
            check_permissions,
            get_platform,
            get_setup_instructions,
        )
        print("  ✓ PyAutoGUI adapter imports OK")
    except ImportError as e:
        print(f"  ✗ PyAutoGUI adapter import failed: {e}")
        return False
    
    try:
        from adapters.desktop.operator import OperatorAdapter, OperatorConnectionError
        print("  ✓ Operator adapter imports OK")
    except ImportError as e:
        print(f"  ✗ Operator adapter import failed: {e}")
        return False
    
    return True


def test_dependency_check():
    """Test dependency checking."""
    print("\nChecking dependencies...")
    
    from adapters.desktop.pyautogui import check_dependencies
    
    missing = check_dependencies()
    if missing:
        print(f"  ⚠ Missing dependencies: {missing}")
        print("  Install with: pip install -e '.[desktop-all]'")
    else:
        print("  ✓ All dependencies available")
    
    return missing


def test_platform_detection():
    """Test platform detection."""
    print("\nDetecting platform...")
    
    from adapters.desktop.pyautogui import get_platform, Platform
    
    platform = get_platform()
    print(f"  Platform: {platform.value}")
    
    if platform == Platform.UNKNOWN:
        print("  ⚠ Unknown platform detected")
        return False
    
    print("  ✓ Platform detected")
    return True


def test_permission_check():
    """Test permission checking."""
    print("\nChecking permissions...")
    
    from adapters.desktop.pyautogui import check_dependencies, check_permissions
    
    missing = check_dependencies()
    if missing:
        print(f"  ⚠ Cannot check permissions - missing dependencies")
        return None
    
    has_perms, message = check_permissions()
    if has_perms:
        print(f"  ✓ Permissions OK")
    else:
        print(f"  ⚠ Permission issue: {message}")
    
    return has_perms


async def test_basic_functionality():
    """Test basic adapter functionality."""
    print("\nTesting basic functionality...")
    
    from adapters.desktop.pyautogui import PyAutoGUIAdapter, check_dependencies
    
    missing = check_dependencies()
    if missing:
        print(f"  ⚠ Skipping - missing dependencies: {missing}")
        return None
    
    try:
        adapter = PyAutoGUIAdapter()
        await adapter.initialize()
        
        # Get screen size
        size = await adapter.get_screen_size()
        print(f"  ✓ Screen size: {size.width}x{size.height}")
        
        # Get mouse position
        pos = await adapter.get_mouse_position()
        print(f"  ✓ Mouse position: ({pos.x}, {pos.y})")
        
        await adapter.dispose()
        print("  ✓ Adapter initialized and disposed successfully")
        return True
        
    except Exception as e:
        print(f"  ✗ Functionality test failed: {e}")
        return False


def print_setup_info():
    """Print platform-specific setup instructions."""
    print("\n" + "="*70)
    print("SETUP INSTRUCTIONS")
    print("="*70)
    
    from adapters.desktop.pyautogui import get_setup_instructions
    print(get_setup_instructions())


async def main():
    """Run all tests."""
    print("="*70)
    print("Allternit Computer Use - Desktop Automation Setup Test")
    print("="*70)
    
    results = []
    
    # Test 1: Imports
    results.append(("Imports", test_imports()))
    
    # Test 2: Dependency check
    missing = test_dependency_check()
    results.append(("Dependencies", len(missing) == 0 if missing else None))
    
    # Test 3: Platform detection
    results.append(("Platform", test_platform_detection()))
    
    # Test 4: Permission check
    perm_result = test_permission_check()
    results.append(("Permissions", perm_result))
    
    # Test 5: Basic functionality (if deps available)
    if not missing:
        func_result = await test_basic_functionality()
        results.append(("Functionality", func_result))
    
    # Summary
    print("\n" + "="*70)
    print("TEST SUMMARY")
    print("="*70)
    
    for name, result in results:
        status = "✓ PASS" if result is True else "✗ FAIL" if result is False else "⚠ SKIP"
        print(f"  {name:<20} {status}")
    
    all_passed = all(r is True for _, r in results if r is not None)
    
    if all_passed:
        print("\n✓ All tests passed! Desktop automation is ready to use.")
        return 0
    else:
        print("\n⚠ Some tests skipped or failed. See setup instructions below.")
        print_setup_info()
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
