# Browser Automation Adapters

Browser automation adapters for allternit-computer-use supporting Playwright and Chrome DevTools Protocol (CDP).

## Installation

### Automatic (Recommended)

```bash
pip install allternit-computer-use[browser]
# Playwright browsers auto-installed
```

### Manual

```bash
pip install allternit-computer-use[browser]
playwright install chromium
playwright install firefox  # optional
playwright install webkit   # optional
```

## Supported Browsers

### Playwright Adapter

| Browser | Status | Notes |
|---------|--------|-------|
| Chromium | ✅ Full | Recommended, fastest |
| Firefox | ✅ Full | Gecko engine |
| WebKit | ✅ Full | Safari engine |

### CDP Adapter

| Browser | Status | Notes |
|---------|--------|-------|
| Google Chrome | ✅ Full | Recommended |
| Microsoft Edge | ✅ Full | Chromium-based |
| Chromium | ✅ Full | Open-source Chrome |
| Brave | ⚠️ Partial | May need custom flags |
| Opera | ⚠️ Partial | May need custom flags |

## Quick Start

### Playwright Adapter

```python
import asyncio
from adapters.browser.playwright_adapter import PlaywrightAdapter, BrowserConfig

async def main():
    # Create adapter with default config (Chromium, headless)
    adapter = PlaywrightAdapter()
    
    # Start browser
    await adapter.start()
    
    # Navigate to page
    await adapter.navigate("https://example.com")
    
    # Take screenshot
    screenshot = await adapter.screenshot(path="screenshot.png")
    
    # Interact with elements
    await adapter.click("button#submit")
    await adapter.fill("input[name='search']", "hello world")
    await adapter.press("Enter")
    
    # Get page info
    title = await adapter.get_title()
    url = await adapter.get_url()
    
    # Stop browser
    await adapter.stop()

asyncio.run(main())
```

### Using Context Manager

```python
async def main():
    async with PlaywrightAdapter() as adapter:
        await adapter.navigate("https://example.com")
        screenshot = await adapter.screenshot()
        # Browser auto-stops on exit
```

### CDP Adapter

```python
from adapters.browser.cdp_adapter import CDPAdapter, CDPConfig

# Connect to existing Chrome with remote debugging
def main():
    # First, start Chrome with:
    # google-chrome --remote-debugging-port=9222
    
    with CDPAdapter(CDPConfig(port=9222)) as adapter:
        adapter.connect()
        
        # Navigate
        adapter.navigate("https://example.com")
        
        # Take screenshot
        screenshot = adapter.screenshot(path="screenshot.png")
        
        # Interact
        adapter.click("button#submit")
        adapter.fill("input[name='search']", "hello world")
        
        # Disconnect
        adapter.disconnect()
```

### CDP with Auto-Launch

```python
# CDP adapter can auto-launch Chrome if not running
with CDPAdapter() as adapter:
    adapter.connect(auto_launch=True)
    # Chrome starts automatically if not running
    adapter.navigate("https://example.com")
```

## Configuration

### Playwright Configuration

```python
from adapters.browser.playwright_adapter import (
    PlaywrightAdapter,
    BrowserConfig,
    BrowserType,
    Viewport
)

config = BrowserConfig(
    browser_type=BrowserType.CHROMIUM,  # CHROMIUM, FIREFOX, WEBKIT
    headless=False,  # Show browser window
    viewport=Viewport(width=1920, height=1080),
    slow_mo=100,  # Slow down operations by 100ms (for debugging)
    timeout=30000  # Default timeout in ms
)

adapter = PlaywrightAdapter(config)
```

### CDP Configuration

```python
from adapters.browser.cdp_adapter import CDPAdapter, CDPConfig

config = CDPConfig(
    host="localhost",
    port=9222,
    chrome_path="/usr/bin/google-chrome",  # Auto-detected if not set
    headless=False,
    window_size=(1920, 1080),
    user_data_dir="/path/to/profile",  # Use specific Chrome profile
    additional_args=["--disable-gpu", "--no-sandbox"]
)

adapter = CDPAdapter(config)
```

## Headless vs Headed Modes

### Headless Mode (Default)

```python
# No browser window visible
config = BrowserConfig(headless=True)
adapter = PlaywrightAdapter(config)
```

- Faster execution
- No GUI required
- Better for CI/CD
- Lower resource usage

### Headed Mode

```python
# Browser window visible
config = BrowserConfig(headless=False)
adapter = PlaywrightAdapter(config)
```

- Useful for debugging
- See automation in action
- Can interact manually

## Browser Detection

The setup module provides browser detection utilities:

```python
from adapters.browser.setup import (
    detect_chrome_executable,
    get_playwright_browsers_status,
    setup_browsers
)

# Detect Chrome on system
chrome_path = detect_chrome_executable()
print(f"Chrome found at: {chrome_path}")

# Check Playwright browser status
status = get_playwright_browsers_status()
print(f"Chromium installed: {status['chromium']}")
print(f"Firefox installed: {status['firefox']}")
print(f"WebKit installed: {status['webkit']}")

# Full setup with auto-install
results = setup_browsers(auto_install=True)
```

## Screenshots

### Full Page Screenshot

```python
# Playwright
await adapter.screenshot(path="full.png", full_page=True)

# CDP
adapter.screenshot(path="full.png", full_page=True)
```

### Element Screenshot (Playwright only)

```python
await adapter.screenshot(path="button.png", selector="button#submit")
```

### Base64 Screenshot

```python
# For embedding in HTML/APIs
base64_img = await adapter.screenshot_base64(full_page=True)
# Returns: "iVBORw0KGgoAAAANSUhEUgAA..."
```

## Element Interaction

### Click

```python
await adapter.click("button#submit")
await adapter.click("button#submit", button="right")  # Right-click
```

### Fill Input

```python
# Clear and fill
await adapter.fill("input[name='email']", "user@example.com")

# Type character by character (more human-like)
await adapter.type_text("input[name='email']", "user@example.com", delay=50)
```

### Keyboard

```python
await adapter.press("Enter")
await adapter.press("Escape")
await adapter.press("ArrowDown")
await adapter.press("Control+a", selector="input")  # Select all in input
```

### Select Dropdown

```python
await adapter.select_option("select#country", value="US")
await adapter.select_option("select#country", label="United States")
await adapter.select_option("select#country", index=0)
```

### Scroll

```python
await adapter.scroll_to(selector="footer")  # Scroll to element
await adapter.scroll_to(x=0, y=500)  # Scroll to position
```

## Navigation

```python
await adapter.navigate("https://example.com")
await adapter.navigate("https://example.com", wait_until="networkidle")

# Wait options: load, domcontentloaded, networkidle, commit

await adapter.reload()
await adapter.go_back()
await adapter.go_forward()

url = await adapter.get_url()
title = await adapter.get_title()
```

## JavaScript Execution

```python
# Evaluate JavaScript
result = await adapter.evaluate("document.title")
result = await adapter.evaluate("() => { return { width: window.innerWidth } }")

# Get page content
html = await adapter.get_page_content()
```

## Waiting

```python
# Wait for element
await adapter.wait_for_selector("button#load", timeout=10000)
await adapter.wait_for_selector(".loading", state="hidden")

# Wait for page load
await adapter.wait_for_load_state("networkidle")
```

## Troubleshooting

### Playwright Not Installed

```
ImportError: Playwright is not installed
```

**Solution:**
```bash
pip install allternit-computer-use[browser]
playwright install chromium
```

### Chrome Not Found (CDP)

```
CDPError: Chrome executable not found
```

**Solution:**
- Install Chrome/Chromium/Edge
- Or specify path: `CDPConfig(chrome_path="/path/to/chrome")`

### Port Already in Use (CDP)

```
CDPError: Chrome not running on localhost:9222
```

**Solution:**
```bash
# Find and kill process using port
lsof -ti:9222 | xargs kill -9  # macOS/Linux
netstat -ano | findstr :9222   # Windows
```

### WebSocket Connection Failed (CDP)

```
CDPConnectionError: Failed to connect to CDP
```

**Solution:**
- Ensure Chrome is running with `--remote-debugging-port=9222`
- Check firewall settings
- Verify port is not blocked

### Browser Launch Fails

```
Error: browserType.launch: Executable doesn't exist
```

**Solution:**
```bash
playwright install chromium
# On Linux, may need:
playwright install-deps chromium
```

### Permission Denied (Linux)

```
Error: EACCES: permission denied
```

**Solution:**
```bash
# Fix permissions
chmod +x ~/.cache/ms-playwright/chromium-*/chrome-linux/chrome
```

### Headless Mode Issues

Some sites block headless browsers:

```python
# Playwright - use headed mode
config = BrowserConfig(headless=False)

# CDP - use headed mode
config = CDPConfig(headless=False)
```

Or use stealth plugins with Playwright:

```python
# Additional setup may be needed for stealth
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PLAYWRIGHT_BROWSERS_PATH` | Path to browser binaries | Auto |
| `PLAYWRIGHT_DOWNLOAD_HOST` | Mirror for browser downloads | Official |
| `CHROME_PATH` | Path to Chrome executable | Auto-detected |
| `CHROME_DEBUG_PORT` | Chrome debug port | 9222 |

## Examples

### Search Automation

```python
async def search_google(query):
    async with PlaywrightAdapter() as adapter:
        await adapter.navigate("https://google.com")
        await adapter.fill("textarea[name='q']", query)
        await adapter.press("Enter")
        await adapter.wait_for_selector("#search")
        return await adapter.screenshot_base64()
```

### Form Submission

```python
async def submit_form(data):
    async with PlaywrightAdapter() as adapter:
        await adapter.navigate("https://example.com/form")
        
        await adapter.fill("input[name='name']", data['name'])
        await adapter.fill("input[name='email']", data['email'])
        await adapter.select_option("select[name='country']", value=data['country'])
        
        await adapter.click("button[type='submit']")
        await adapter.wait_for_selector(".success-message")
        
        return await adapter.get_text(".success-message")
```

### Multi-Page Navigation

```python
async def multi_page():
    async with PlaywrightAdapter() as adapter:
        await adapter.navigate("https://example.com")
        
        # Open new tab
        new_page = await adapter.new_tab("https://example.org")
        
        # Work with new page
        title = await new_page.title()
        
        # Close tab
        await adapter.close_tab(new_page)
```

## API Reference

See the Python docstrings in:
- `playwright_adapter.py` - Full Playwright adapter documentation
- `cdp_adapter.py` - Full CDP adapter documentation
- `setup.py` - Browser setup utilities
