"""
Browser setup and installation utilities for allternit-computer-use.

This module handles:
- Automated Playwright browser installation
- Chrome/Chromium detection
- Browser download and setup scripts
"""

import os
import sys
import subprocess
import platform
from pathlib import Path
from typing import Optional, List, Dict, Any
import logging

logger = logging.getLogger(__name__)


class BrowserSetupError(Exception):
    """Raised when browser setup fails."""
    pass


class BrowserNotFoundError(BrowserSetupError):
    """Raised when a required browser is not found."""
    pass


def get_platform() -> str:
    """Get the current platform identifier."""
    system = platform.system().lower()
    machine = platform.machine().lower()
    
    if system == "darwin":
        return "macos"
    elif system == "linux":
        return "linux"
    elif system == "windows":
        return "windows"
    else:
        return f"{system}_{machine}"


def detect_chrome_executable() -> Optional[str]:
    """
    Detect Chrome or Chromium executable path on the system.
    
    Returns:
        Path to Chrome/Chromium executable or None if not found.
    """
    platform_name = get_platform()
    
    possible_paths: List[str] = []
    
    if platform_name == "macos":
        possible_paths = [
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
            "/Applications/Chromium.app/Contents/MacOS/Chromium",
            "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
            os.path.expanduser("~/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"),
        ]
    elif platform_name == "linux":
        possible_paths = [
            "/usr/bin/google-chrome",
            "/usr/bin/google-chrome-stable",
            "/usr/bin/chromium",
            "/usr/bin/chromium-browser",
            "/snap/bin/chromium",
            "/usr/bin/microsoft-edge",
            "/usr/bin/microsoft-edge-stable",
        ]
    elif platform_name == "windows":
        program_files = os.environ.get("ProgramFiles", "C:\\Program Files")
        program_files_x86 = os.environ.get("ProgramFiles(x86)", "C:\\Program Files (x86)")
        local_app_data = os.environ.get("LocalAppData", "")
        
        possible_paths = [
            os.path.join(program_files_x86, "Google\\Chrome\\Application\\chrome.exe"),
            os.path.join(program_files, "Google\\Chrome\\Application\\chrome.exe"),
            os.path.join(local_app_data, "Google\\Chrome\\Application\\chrome.exe"),
            os.path.join(program_files_x86, "Microsoft\\Edge\\Application\\msedge.exe"),
            os.path.join(program_files, "Microsoft\\Edge\\Application\\msedge.exe"),
        ]
    
    for path in possible_paths:
        if path and os.path.isfile(path):
            return path
    
    # Try which/where command as fallback
    try:
        if platform_name == "windows":
            result = subprocess.run(
                ["where", "chrome"],
                capture_output=True,
                text=True,
                check=False
            )
            if result.returncode == 0 and result.stdout.strip():
                return result.stdout.strip().split("\n")[0]
        else:
            for cmd in ["google-chrome", "chromium", "chromium-browser", "chrome"]:
                result = subprocess.run(
                    ["which", cmd],
                    capture_output=True,
                    text=True,
                    check=False
                )
                if result.returncode == 0 and result.stdout.strip():
                    return result.stdout.strip()
    except Exception:
        pass
    
    return None


def is_playwright_installed() -> bool:
    """Check if Playwright is installed."""
    try:
        import playwright
        return True
    except ImportError:
        return False


def get_playwright_browsers_status() -> Dict[str, bool]:
    """
    Check which Playwright browsers are installed.
    
    Returns:
        Dictionary with browser names as keys and installation status as values.
    """
    browsers = {
        "chromium": False,
        "firefox": False,
        "webkit": False,
    }
    
    if not is_playwright_installed():
        return browsers
    
    try:
        from playwright.sync_api import sync_playwright
        
        with sync_playwright() as p:
            for browser_name in browsers.keys():
                try:
                    browser_type = getattr(p, browser_name)
                    # Try to get the executable path
                    executable_path = browser_type.executable_path
                    browsers[browser_name] = os.path.exists(executable_path)
                except Exception:
                    browsers[browser_name] = False
    except Exception:
        pass
    
    return browsers


def install_playwright_browsers(browsers: Optional[List[str]] = None) -> bool:
    """
    Install Playwright browsers.
    
    Args:
        browsers: List of browsers to install (chromium, firefox, webkit).
                 If None, installs chromium only.
    
    Returns:
        True if installation succeeded, False otherwise.
    """
    if browsers is None:
        browsers = ["chromium"]
    
    logger.info(f"Installing Playwright browsers: {', '.join(browsers)}")
    
    try:
        cmd = [sys.executable, "-m", "playwright", "install"]
        
        # Add specific browsers
        for browser in browsers:
            cmd.append(browser)
        
        # Add dependencies flag for system dependencies on Linux
        if get_platform() == "linux":
            cmd.append("--with-deps")
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            check=False
        )
        
        if result.returncode == 0:
            logger.info("Playwright browsers installed successfully")
            return True
        else:
            logger.error(f"Playwright install failed: {result.stderr}")
            return False
            
    except Exception as e:
        logger.error(f"Failed to install Playwright browsers: {e}")
        return False


def setup_browsers(auto_install: bool = True) -> Dict[str, Any]:
    """
    Complete browser setup - detect and install as needed.
    
    Args:
        auto_install: Whether to automatically install missing browsers.
    
    Returns:
        Dictionary with setup results.
    """
    results = {
        "chrome_detected": False,
        "chrome_path": None,
        "playwright_installed": False,
        "playwright_browsers": {},
        "install_attempted": False,
        "install_success": False,
    }
    
    # Detect Chrome/Chromium
    chrome_path = detect_chrome_executable()
    results["chrome_detected"] = chrome_path is not None
    results["chrome_path"] = chrome_path
    
    if chrome_path:
        logger.info(f"Detected Chrome/Chromium at: {chrome_path}")
    else:
        logger.warning("No Chrome/Chromium detected on system")
    
    # Check Playwright
    results["playwright_installed"] = is_playwright_installed()
    
    if results["playwright_installed"]:
        results["playwright_browsers"] = get_playwright_browsers_status()
        
        # Check if chromium is installed
        chromium_installed = results["playwright_browsers"].get("chromium", False)
        
        if not chromium_installed and auto_install:
            results["install_attempted"] = True
            results["install_success"] = install_playwright_browsers(["chromium"])
            
            if results["install_success"]:
                results["playwright_browsers"] = get_playwright_browsers_status()
    else:
        logger.warning("Playwright not installed. Run: pip install playwright")
    
    return results


def ensure_browser_available(browser_type: str = "chromium") -> bool:
    """
    Ensure a browser is available for use.
    
    Args:
        browser_type: Type of browser to ensure (chromium, firefox, webkit, chrome).
    
    Returns:
        True if browser is available, False otherwise.
    """
    if browser_type == "chrome":
        return detect_chrome_executable() is not None
    
    if not is_playwright_installed():
        logger.error("Playwright not installed. Run: pip install playwright")
        return False
    
    browsers = get_playwright_browsers_status()
    
    if browsers.get(browser_type, False):
        return True
    
    # Try to install
    logger.info(f"{browser_type} not found, attempting to install...")
    if install_playwright_browsers([browser_type]):
        return True
    
    return False


# Post-install hook for pip
def post_install():
    """Run browser setup after package installation."""
    print("Setting up browsers for allternit-computer-use...")
    
    if not is_playwright_installed():
        print("Playwright not installed. Skipping browser installation.")
        print("Install with: pip install allternit-computer-use[browser]")
        return
    
    results = setup_browsers(auto_install=True)
    
    if results["install_success"]:
        print("✓ Playwright browsers installed successfully")
    elif not results["playwright_browsers"].get("chromium", False):
        print("⚠ Warning: Chromium not installed")
        print("  Install manually with: playwright install chromium")
    
    if results["chrome_detected"]:
        print(f"✓ Chrome detected: {results['chrome_path']}")
    else:
        print("ℹ No Chrome/Chromium detected (optional, for CDP mode)")


if __name__ == "__main__":
    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format="%(levelname)s: %(message)s"
    )
    
    # Run setup
    results = setup_browsers(auto_install=True)
    
    print("\n=== Browser Setup Results ===")
    print(f"Chrome detected: {results['chrome_detected']}")
    if results['chrome_path']:
        print(f"  Path: {results['chrome_path']}")
    print(f"Playwright installed: {results['playwright_installed']}")
    if results['playwright_browsers']:
        print("Playwright browsers:")
        for browser, installed in results['playwright_browsers'].items():
            status = "✓" if installed else "✗"
            print(f"  {status} {browser}")
    print(f"Install attempted: {results['install_attempted']}")
    print(f"Install success: {results['install_success']}")
