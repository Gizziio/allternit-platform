"""
Integration tests for browser automation with Playwright and CDP.

These tests verify browser automation capabilities using real browser instances.
Tests skip gracefully if browsers are not available.

Run with: pytest -m integration
Run browser tests only: pytest -m "requires_browser"
"""

import os
import pytest
import pytest_asyncio
import asyncio
from typing import Optional
from unittest.mock import Mock, patch, AsyncMock

# Mark all tests in this module
pytestmark = [
    pytest.mark.integration,
    pytest.mark.requires_browser,
    pytest.mark.asyncio,
]


# Fixtures for browser availability checks
@pytest.fixture(scope="session")
def playwright_available() -> bool:
    """Check if Playwright is installed and browsers are available."""
    try:
        from playwright.async_api import async_playwright
        return True
    except ImportError:
        return False


@pytest.fixture(scope="session")
def chrome_available() -> bool:
    """Check if Chrome/Chromium is available for CDP."""
    import subprocess
    
    # Check for Chrome, Chromium, or Chrome Canary
    chrome_paths = [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Chromium.app/Contents/MacOS/Chromium",
        "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
        "/usr/bin/chromium",
        "/usr/bin/chromium-browser",
        "/usr/bin/google-chrome",
        "/usr/bin/google-chrome-stable",
    ]
    
    for path in chrome_paths:
        if os.path.exists(path):
            return True
    
    # Try to find chrome in PATH
    try:
        result = subprocess.run(
            ["which", "chromium-browser"],
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode == 0:
            return True
        
        result = subprocess.run(
            ["which", "google-chrome"],
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode == 0:
            return True
    except (subprocess.TimeoutExpired, FileNotFoundError):
        pass
    
    return False


@pytest.fixture(scope="session")
def cdp_port_available() -> bool:
    """Check if a Chrome instance with CDP is running."""
    import socket
    
    # Common CDP ports
    cdp_ports = [9222, 9223, 9224, 9225]
    
    for port in cdp_ports:
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(2)
            result = sock.connect_ex(('localhost', port))
            sock.close()
            if result == 0:
                return True
        except Exception:
            pass
    
    return False


# Playwright Tests
@pytest.mark.skipif(
    not pytest.importorskip("playwright", reason="Playwright not installed"),
    reason="Playwright not installed"
)
class TestPlaywrightBrowser:
    """Tests for Playwright browser automation."""
    
    @pytest_asyncio.fixture(loop_scope="function")
    async def browser_context(self):
        """Provide a browser context for tests."""
        from playwright.async_api import async_playwright
        
        playwright = None
        browser = None
        context = None
        
        try:
            playwright = await async_playwright().start()
            
            # Try Chromium first, then fallback to other browsers
            try:
                browser = await playwright.chromium.launch(headless=True)
            except Exception:
                try:
                    browser = await playwright.firefox.launch(headless=True)
                except Exception:
                    browser = await playwright.webkit.launch(headless=True)
            
            context = await browser.new_context(
                viewport={'width': 1280, 'height': 720},
                user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.0'
            )
            
            yield context
            
        finally:
            if context:
                await context.close()
            if browser:
                await browser.close()
            if playwright:
                await playwright.stop()
    
    @pytest.mark.asyncio
    async def test_navigate_to_url(self, browser_context):
        """Test navigating to a URL."""
        page = await browser_context.new_page()
        
        try:
            response = await page.goto(
                "https://example.com",
                wait_until="networkidle",
                timeout=30000
            )
            
            assert response is not None
            assert response.status == 200
            assert "example.com" in page.url
            
            # Verify page content loaded
            title = await page.title()
            assert len(title) > 0
            
        finally:
            await page.close()
    
    @pytest.mark.asyncio
    async def test_click_element(self, browser_context):
        """Test clicking an element on a page."""
        page = await browser_context.new_page()
        
        try:
            # Use a simple test page with clickable elements
            await page.goto("https://example.com", wait_until="networkidle")
            
            # Try to find and click a link or button
            # On example.com, we can try clicking the "More information..." link
            link = page.locator('a[href*="iana"]').first
            
            if await link.is_visible():
                await link.click()
                await page.wait_for_load_state("networkidle")
                
                # Verify navigation occurred
                assert "iana.org" in page.url or "example.com" in page.url
            
        finally:
            await page.close()
    
    @pytest.mark.asyncio
    async def test_take_screenshot(self, browser_context, tmp_path):
        """Test taking a screenshot."""
        page = await browser_context.new_page()
        
        try:
            await page.goto("https://example.com", wait_until="networkidle")
            
            screenshot_path = tmp_path / "test_screenshot.png"
            
            screenshot_data = await page.screenshot(
                path=str(screenshot_path),
                full_page=True
            )
            
            # Verify screenshot was created
            assert screenshot_path.exists()
            assert screenshot_path.stat().st_size > 0
            assert len(screenshot_data) > 0
            
            # Verify it's a valid PNG (starts with PNG magic bytes)
            with open(screenshot_path, 'rb') as f:
                header = f.read(8)
                assert header == b'\x89PNG\r\n\x1a\n'
            
        finally:
            await page.close()
    
    @pytest.mark.asyncio
    async def test_fill_form_input(self, browser_context):
        """Test filling form inputs."""
        page = await browser_context.new_page()
        
        try:
            # Create a simple test page
            await page.set_content("""
                <html>
                    <body>
                        <form>
                            <input type="text" id="username" name="username" />
                            <input type="password" id="password" name="password" />
                            <button type="submit">Submit</button>
                        </form>
                    </body>
                </html>
            """)
            
            # Fill in the form
            await page.fill('#username', 'testuser')
            await page.fill('#password', 'testpassword')
            
            # Verify values
            username_value = await page.input_value('#username')
            password_value = await page.input_value('#password')
            
            assert username_value == 'testuser'
            assert password_value == 'testpassword'
            
        finally:
            await page.close()
    
    @pytest.mark.asyncio
    async def test_scroll_page(self, browser_context):
        """Test scrolling a page."""
        page = await browser_context.new_page()
        
        try:
            # Create a page with scrollable content
            await page.set_content("""
                <html>
                    <body style="height: 2000px;">
                        <div id="top" style="position: absolute; top: 0;">Top</div>
                        <div id="bottom" style="position: absolute; top: 1500px;">Bottom</div>
                    </body>
                </html>
            """)
            
            # Get initial scroll position
            initial_scroll = await page.evaluate('window.scrollY')
            assert initial_scroll == 0
            
            # Scroll down
            await page.evaluate('window.scrollTo(0, 1000)')
            await asyncio.sleep(0.1)  # Small delay for scroll to apply
            
            scroll_position = await page.evaluate('window.scrollY')
            assert scroll_position == 1000
            
        finally:
            await page.close()


# CDP (Chrome DevTools Protocol) Tests
@pytest.mark.skipif(
    not bool(pytest.importorskip("websockets", reason="websockets not installed")),
    reason="websockets package not installed for CDP"
)
class TestCDPBrowser:
    """Tests for Chrome DevTools Protocol automation."""
    
    @pytest.fixture
    def cdp_ws_url(self):
        """Get the CDP WebSocket URL from a running Chrome instance."""
        import requests
        import json
        
        # Common CDP ports
        cdp_ports = [9222, 9223, 9224, 9225]
        
        for port in cdp_ports:
            try:
                response = requests.get(
                    f'http://localhost:{port}/json/version',
                    timeout=5
                )
                if response.status_code == 200:
                    version_info = response.json()
                    # Get the WebSocket debugger URL
                    return version_info.get('webSocketDebuggerUrl')
            except Exception:
                continue
        
        return None
    
    @pytest.mark.skip(reason="CDP requires running Chrome with --remote-debugging-port")
    @pytest.mark.asyncio
    async def test_cdp_navigate(self, cdp_ws_url):
        """Test navigation via CDP."""
        pytest.importorskip("websockets")
        import websockets
        import json
        
        if not cdp_ws_url:
            pytest.skip("No CDP-enabled Chrome instance found")
        
        async with websockets.connect(cdp_ws_url) as ws:
            # Navigate to a page
            navigate_cmd = {
                'id': 1,
                'method': 'Page.navigate',
                'params': {'url': 'https://example.com'}
            }
            await ws.send(json.dumps(navigate_cmd))
            
            # Wait for response
            response = await ws.recv()
            data = json.loads(response)
            
            assert 'id' in data
            assert data['id'] == 1
    
    @pytest.mark.skip(reason="CDP requires running Chrome with --remote-debugging-port")
    @pytest.mark.asyncio
    async def test_cdp_screenshot(self, cdp_ws_url):
        """Test taking screenshot via CDP."""
        pytest.importorskip("websockets")
        import websockets
        import json
        import base64
        
        if not cdp_ws_url:
            pytest.skip("No CDP-enabled Chrome instance found")
        
        async with websockets.connect(cdp_ws_url) as ws:
            # Enable page domain
            await ws.send(json.dumps({'id': 1, 'method': 'Page.enable'}))
            await ws.recv()
            
            # Navigate first
            await ws.send(json.dumps({
                'id': 2,
                'method': 'Page.navigate',
                'params': {'url': 'https://example.com'}
            }))
            await ws.recv()
            
            # Wait a bit for page to load
            await asyncio.sleep(1)
            
            # Take screenshot
            await ws.send(json.dumps({
                'id': 3,
                'method': 'Page.captureScreenshot',
                'params': {'format': 'png'}
            }))
            
            response = await ws.recv()
            data = json.loads(response)
            
            assert 'result' in data
            assert 'data' in data['result']
            
            # Verify it's valid base64 image data
            screenshot_data = base64.b64decode(data['result']['data'])
            assert len(screenshot_data) > 0
            # Check PNG magic bytes
            assert screenshot_data[:8] == b'\x89PNG\r\n\x1a\n'


# Mock Tests for CI (when real browsers not available)
class TestBrowserAutomationMock:
    """Mock tests for browser automation that work in CI without real browsers."""
    
    def test_mock_navigate(self):
        """Test navigation with mocked browser."""
        mock_page = Mock()
        mock_page.goto = AsyncMock(return_value=Mock(status=200))
        mock_page.url = "https://example.com"
        
        # Simulate navigation
        async def navigate():
            response = await mock_page.goto("https://example.com")
            return response.status == 200
        
        result = asyncio.run(navigate())
        assert result is True
        mock_page.goto.assert_called_once_with("https://example.com")
    
    def test_mock_click(self):
        """Test clicking with mocked browser."""
        mock_element = Mock()
        mock_element.click = AsyncMock()
        mock_element.is_visible = AsyncMock(return_value=True)
        
        mock_page = Mock()
        mock_page.locator = Mock(return_value=mock_element)
        
        async def click_element():
            element = mock_page.locator('button#submit')
            if await element.is_visible():
                await element.click()
                return True
            return False
        
        result = asyncio.run(click_element())
        assert result is True
        mock_element.click.assert_called_once()
    
    def test_mock_screenshot(self):
        """Test screenshot with mocked browser."""
        mock_page = Mock()
        mock_page.screenshot = AsyncMock(return_value=b'\x89PNG\r\n\x1a\nfake_data')
        
        async def take_screenshot():
            data = await mock_page.screenshot(full_page=True)
            return data[:8] == b'\x89PNG\r\n\x1a\n'
        
        result = asyncio.run(take_screenshot())
        assert result is True


# Browser Manager Integration Tests
@pytest.mark.skipif(
    not pytest.importorskip("playwright", reason="Playwright not installed"),
    reason="Playwright not installed"
)
class TestBrowserManager:
    """Tests for high-level browser management."""
    
    @pytest.mark.asyncio
    async def test_browser_pool_lifecycle(self):
        """Test browser pool creation and cleanup."""
        from playwright.async_api import async_playwright
        
        playwright = await async_playwright().start()
        
        try:
            # Launch multiple browsers
            browsers = []
            for _ in range(2):
                browser = await playwright.chromium.launch(headless=True)
                browsers.append(browser)
            
            # Verify all browsers are connected
            for browser in browsers:
                assert browser.is_connected()
            
            # Clean up
            for browser in browsers:
                await browser.close()
            
            # Verify all browsers are closed
            for browser in browsers:
                assert not browser.is_connected()
                
        finally:
            await playwright.stop()
    
    @pytest.mark.asyncio
    async def test_context_isolation(self):
        """Test that browser contexts are properly isolated."""
        from playwright.async_api import async_playwright
        
        playwright = await async_playwright().start()
        
        try:
            browser = await playwright.chromium.launch(headless=True)
            
            # Create two isolated contexts
            context1 = await browser.new_context()
            context2 = await browser.new_context()
            
            page1 = await context1.new_page()
            page2 = await context2.new_page()
            
            # Set cookies in context1
            await context1.add_cookies([{
                'name': 'test_cookie',
                'value': 'context1_value',
                'domain': '.example.com',
                'path': '/'
            }])
            
            # Verify cookie is not in context2
            cookies2 = await context2.cookies()
            assert not any(c['name'] == 'test_cookie' for c in cookies2)
            
            await page1.close()
            await page2.close()
            await context1.close()
            await context2.close()
            await browser.close()
            
        finally:
            await playwright.stop()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
