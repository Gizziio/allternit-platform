# Desktop Automation Adapters

Cross-platform desktop automation for `allternit-computer-use`. Supports macOS, Windows, and Linux with intelligent fallback mechanisms.

## Features

- **PyAutoGUI Adapter**: Cross-platform desktop automation using PyAutoGUI
- **Operator Adapter**: AI-driven automation with PyAutoGUI fallback
- **Permission Management**: Automatic detection and guidance for missing permissions
- **Graceful Degradation**: Falls back to available tools when primary unavailable

## Installation

### Quick Start

```bash
# Auto-detect platform and install appropriate dependencies
pip install allternit-computer-use[desktop-all]
```

### Platform-Specific Installation

#### macOS

```bash
# Install with macOS-specific dependencies
pip install allternit-computer-use[desktop-macos]

# Or install all dependencies
pip install allternit-computer-use[desktop-all]
```

**System Requirements:**
- macOS 10.15 (Catalina) or later
- Python 3.9+

#### Windows

```bash
# Install with Windows-specific dependencies
pip install allternit-computer-use[desktop-windows]
```

**System Requirements:**
- Windows 10 or later
- Python 3.9+

#### Linux

```bash
# Install system dependencies first
# Debian/Ubuntu:
sudo apt-get install python3-xlib python3-tk python3-dev

# RHEL/CentOS/Fedora:
sudo yum install python3-xlib python3-tkinter python3-devel

# Arch Linux:
sudo pacman -S python-xlib tk python-dev

# Then install the package
pip install allternit-computer-use[desktop-linux]
```

**System Requirements:**
- X11 display server (Wayland support via XWayland)
- Python 3.9+

## Permission Setup

### macOS

Grant **Accessibility** permissions (required):

1. Open **System Settings** → **Privacy & Security** → **Accessibility**
2. Click the lock to make changes (enter your password)
3. Add your terminal application:
   - `Terminal.app` (if using default Terminal)
   - `iTerm.app` (if using iTerm2)
   - `Code.app` (if using VS Code terminal)
   - `Cursor.app` (if using Cursor)
   - Your Python interpreter if running scripts directly
4. Ensure the checkbox is checked

Grant **Screen Recording** permissions (for screenshots):

1. Open **System Settings** → **Privacy & Security** → **Screen Recording**
2. Add your terminal application as above
3. **Restart your terminal** after granting permissions

### Windows

No additional permissions required for basic automation.

**Administrator privileges** may be needed for:
- Interacting with UAC prompts
- Controlling applications running as Administrator
- System-level automation

To run as Administrator:
- Right-click on your terminal/IDE
- Select **"Run as Administrator"**

### Linux

**X11 Setup:**
```bash
# Ensure X11 is running
echo $DISPLAY
# Should output something like ":0" or ":1"

# If empty, set the display
export DISPLAY=:0
```

**Wayland Users:**
PyAutoGUI requires X11. Use XWayland compatibility:
```bash
# Most modern Wayland compositors support XWayland automatically
# If not, install and run:
sudo apt-get install xwayland
```

**Headless Servers (no display):**
```bash
# Install Xvfb for virtual display
sudo apt-get install xvfb

# Start virtual display
export DISPLAY=:99
Xvfb :99 -screen 0 1920x1080x24 > /dev/null 2>&1 &
```

## Usage

### PyAutoGUI Adapter

```python
import asyncio
from adapters.desktop.pyautogui import PyAutoGUIAdapter

async def main():
    # Initialize adapter
    adapter = PyAutoGUIAdapter()
    await adapter.initialize()
    
    try:
        # Get screen size
        size = await adapter.get_screen_size()
        print(f"Screen: {size.width}x{size.height}")
        
        # Take screenshot
        result = await adapter.take_screenshot()
        if result.success:
            print(f"Screenshot: {result.base64_data[:50]}...")
        
        # Move mouse
        await adapter.move_to(500, 500, duration=0.5)
        
        # Click
        await adapter.click(500, 500)
        
        # Type text
        await adapter.typewrite("Hello, World!")
        
        # Press keys
        await adapter.press("enter")
        await adapter.hotkey("ctrl", "a")
        await adapter.hotkey("ctrl", "c")
        
        # Scroll
        await adapter.scroll(500)  # Scroll up
        await adapter.scroll(-500)  # Scroll down
        
        # Get mouse position
        pos = await adapter.get_mouse_position()
        print(f"Mouse at: ({pos.x}, {pos.y})")
        
    finally:
        await adapter.dispose()

if __name__ == "__main__":
    asyncio.run(main())
```

### Operator Adapter

The Operator adapter connects to Anthropic's Operator service with automatic PyAutoGUI fallback:

```python
import asyncio
from adapters.desktop.operator import OperatorAdapter, Action, ActionType

async def main():
    # Initialize (connects to Operator or falls back to PyAutoGUI)
    adapter = OperatorAdapter()
    
    try:
        session = await adapter.initialize()
        print(f"Session: {session.session_id}")
        print(f"Using fallback: {adapter.using_fallback}")
        
        # Take screenshot
        result = await adapter.screenshot()
        if result.success:
            print(f"Screenshot captured: {len(result.screenshot or '')} bytes")
        
        # Execute actions
        await adapter.click(100, 200)
        await adapter.typewrite("Hello from Operator!")
        await adapter.press("enter")
        
        # Batch execution
        actions = [
            Action(ActionType.MOVE, {"x": 100, "y": 200}),
            Action(ActionType.CLICK, {"x": 100, "y": 200}),
            Action(ActionType.TYPE, {"text": "Batch action"}),
        ]
        results = await adapter.batch_execute(actions)
        
    except OperatorConnectionError as e:
        print(f"Connection failed: {e}")
        if e.fallback_available:
            print("Fallback was attempted but also failed")
    finally:
        await adapter.dispose()

if __name__ == "__main__":
    asyncio.run(main())
```

### Environment Configuration

```bash
# Operator configuration
export OPERATOR_URL="http://localhost:8080"
export OPERATOR_API_KEY="your-api-key"
export OPERATOR_TIMEOUT="30"

# Force fallback to PyAutoGUI (disable Operator)
export OPERATOR_URL=""
```

### Permission Checking

```python
from adapters.desktop.pyautogui import check_permissions, get_setup_instructions

# Check current permissions
has_perms, message = check_permissions()
print(f"Permissions OK: {has_perms}")
print(message)

# Print setup instructions
get_setup_instructions()
```

## API Reference

### PyAutoGUIAdapter

| Method | Description |
|--------|-------------|
| `initialize()` | Initialize adapter and verify permissions |
| `get_screen_size()` | Get primary screen dimensions |
| `take_screenshot(region=None)` | Capture screenshot (returns base64) |
| `click(x, y, button="left", clicks=1)` | Click at coordinates |
| `move_to(x, y, duration=0.5)` | Move mouse to position |
| `scroll(amount, x=None, y=None)` | Scroll mouse wheel |
| `typewrite(text, interval=0.01)` | Type text |
| `press(key)` | Press a single key |
| `hotkey(*keys)` | Press key combination |
| `get_mouse_position()` | Get current mouse coordinates |
| `locate_on_screen(image_path)` | Find image on screen |
| `alert(text, title, button)` | Show alert dialog |
| `confirm(text, title, buttons)` | Show confirmation dialog |
| `dispose()` | Clean up resources |

### OperatorAdapter

| Method | Description |
|--------|-------------|
| `initialize()` | Connect to Operator or fallback |
| `execute(action)` | Execute a single action |
| `screenshot(region=None)` | Take screenshot |
| `click(x, y, button="left", clicks=1)` | Click at coordinates |
| `move(x, y, duration=0.5)` | Move mouse |
| `scroll(amount, x=None, y=None)` | Scroll wheel |
| `typewrite(text, interval=0.01)` | Type text |
| `press(key)` | Press key |
| `hotkey(*keys)` | Press key combo |
| `wait(seconds)` | Wait duration |
| `batch_execute(actions)` | Execute multiple actions |
| `dispose()` | Clean up resources |

## Troubleshooting

### macOS Issues

**"Accessibility permissions not granted"**
```bash
# 1. Open System Settings > Privacy & Security > Accessibility
# 2. Add your terminal application
# 3. Restart your terminal

# Verify permissions
python -c "from adapters.desktop.pyautogui import check_permissions; print(check_permissions())"
```

**Screenshots return black/blank images**
- Grant Screen Recording permission in System Settings
- Restart terminal after granting permission

**"PyAutoGUI failsafe triggered"**
- PyAutoGUI has a failsafe: move mouse to corner (0,0) to abort
- This is a safety feature, not an error

### Windows Issues

**"Access is denied"**
- Run terminal as Administrator for some operations
- Some protected windows cannot be automated

**Screenshots don't capture specific windows**
- Windows with hardware acceleration may not appear
- Try disabling hardware acceleration in the target app

### Linux Issues

**"No X11 display available"**
```bash
# Check display
export DISPLAY=:0

# Or if running via SSH, enable X11 forwarding
ssh -X user@host

# For headless, use Xvfb
Xvfb :99 -screen 0 1920x1080x24 &
export DISPLAY=:99
```

**"python3-xlib not found"**
```bash
# Install the system package, not just pip
sudo apt-get install python3-xlib
```

**Wayland issues**
```bash
# Check if running Wayland
echo $XDG_SESSION_TYPE

# Force XWayland for specific apps
GDK_BACKEND=x11 your-app
QT_QPA_PLATFORM=xcb your-app
```

### General Issues

**Import errors**
```bash
# Verify installation
pip show allternit-computer-use

# Reinstall with all dependencies
pip install --force-reinstall allternit-computer-use[desktop-all]
```

**Actions not working**
```python
# Enable debug logging
import logging
logging.basicConfig(level=logging.DEBUG)

# Check what's available
from adapters.desktop.pyautogui import check_dependencies
print(check_dependencies())  # Should be empty list if all OK
```

## Safety Features

- **Fail-safe**: Move mouse to screen corner (0,0) to abort automation
- **Safe mode**: Maximum move duration limits
- **Pause**: Built-in delays between actions (configurable)
- **Permissions**: Explicit permission checks before operations

```python
adapter = PyAutoGUIAdapter()
adapter.safe_mode = True  # Enable safety limits
adapter.max_move_duration = 2.0  # Max 2 seconds for moves
```

## Dependencies

### Core Dependencies
- `pyautogui>=0.9.54` - Cross-platform GUI automation
- `pynput>=1.7.6` - Keyboard/mouse monitoring
- `Pillow>=10.0.0` - Image processing
- `mss>=9.0.0` - Multi-screen screenshot (faster than PIL)

### Platform Dependencies
- **macOS**: `pyobjc>=10.0`, `pyobjc-framework-Quartz`, `pyobjc-framework-ApplicationServices`
- **Windows**: `pywin32>=306` (optional, for extended features)
- **Linux**: `python3-xlib>=0.15` (system package required)

### Optional Dependencies
- `aiohttp` - For Operator adapter async HTTP
- `opencv-python` - For image recognition with confidence levels

## Contributing

When contributing new adapters or features:

1. Maintain cross-platform compatibility
2. Add graceful fallback mechanisms
3. Include comprehensive error messages
4. Update this README with examples
5. Add permission checks for platform-specific features

## License

MIT License - See LICENSE file for details.

## See Also

- [PyAutoGUI Documentation](https://pyautogui.readthedocs.io/)
- [Anthropic Operator](https://docs.anthropic.com/operator)
- [MSS Screenshot](https://python-mss.readthedocs.io/)
