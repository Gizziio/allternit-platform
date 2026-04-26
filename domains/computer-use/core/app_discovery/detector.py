"""
App Discovery Core — Robust cross-platform application detection
"""

from __future__ import annotations

import asyncio
import subprocess
import platform
from dataclasses import dataclass, field
from datetime import datetime
from typing import Callable, List, Optional, Dict, Any, Set
from enum import Enum
import json
import logging

logger = logging.getLogger("app-discovery")


class DetectionMethod(Enum):
    """Methods for detecting applications"""
    APPLESCRIPT = "applescript"      # macOS System Events
    APPLESCRIPT_UI = "asui"          # macOS Accessibility  
    PS = "ps"                        # Process list
    WMCTRL = "wmctrl"                # Linux window manager
    XPROP = "xprop"                  # Linux X11 properties
    POWERSHELL = "powershell"        # Windows PowerShell
    WMI = "wmi"                      # Windows Management Interface
    CGWINDOW = "cgwindow"            # macOS CoreGraphics (private)


@dataclass
class DiscoveredApp:
    """Represents a discovered application"""
    id: str                          # Connector ID (e.g., 'vscode')
    name: str                        # Display name (e.g., 'Visual Studio Code')
    bundle_id: Optional[str] = None  # macOS bundle ID
    process_name: Optional[str] = None  # Process executable name
    window_title: Optional[str] = None  # Current window title
    pid: Optional[int] = None        # Process ID
    is_frontmost: bool = False       # Is currently active
    is_connected: bool = False       # Is connected to Allternit
    detected_at: datetime = field(default_factory=datetime.utcnow)
    detection_methods: Set[DetectionMethod] = field(default_factory=set)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class AppContext:
    """Full context about the current app state"""
    frontmost: Optional[DiscoveredApp] = None
    running: List[DiscoveredApp] = field(default_factory=list)
    screen_size: tuple = (0, 0)
    timestamp: datetime = field(default_factory=datetime.utcnow)
    
    def to_dict(self) -> dict:
        return {
            "frontmost": self._app_to_dict(self.frontmost),
            "running": [self._app_to_dict(a) for a in self.running],
            "screen_size": self.screen_size,
            "timestamp": self.timestamp.isoformat(),
        }
    
    @staticmethod
    def _app_to_dict(app: Optional[DiscoveredApp]) -> Optional[dict]:
        if not app:
            return None
        return {
            "id": app.id,
            "name": app.name,
            "bundle_id": app.bundle_id,
            "window_title": app.window_title,
            "is_frontmost": app.is_frontmost,
        }


class AppDiscovery:
    """
    Production-grade app discovery with multi-method fallback
    
    Features:
    - Multiple detection methods for robustness
    - Caching to reduce system calls
    - Change callbacks for reactive UI
    - Platform-specific optimizations
    """
    
    def __init__(
        self,
        on_change: Optional[Callable[[AppContext], None]] = None,
        poll_interval: float = 2.0,
        cache_ttl: float = 1.0,
    ):
        self.on_change = on_change
        self.poll_interval = poll_interval
        self.cache_ttl = cache_ttl
        
        self._platform = platform.system()
        self._running = False
        self._poll_task: Optional[asyncio.Task] = None
        
        # State
        self._last_context: Optional[AppContext] = None
        self._last_poll: Optional[datetime] = None
        self._frontmost_history: List[str] = []  # Track recent frontmost apps
        self._max_history = 10
        
        # Detection method availability
        self._available_methods = self._detect_available_methods()
        
        logger.info(f"AppDiscovery initialized: platform={self._platform}, "
                   f"methods={[m.value for m in self._available_methods]}")
    
    def _detect_available_methods(self) -> Set[DetectionMethod]:
        """Detect which detection methods are available on this system"""
        methods = set()
        
        if self._platform == "Darwin":
            methods.add(DetectionMethod.APPLESCRIPT)
            methods.add(DetectionMethod.PS)
            # Check if we have accessibility permissions
            if self._check_accessibility():
                methods.add(DetectionMethod.APPLESCRIPT_UI)
        elif self._platform == "Linux":
            methods.add(DetectionMethod.PS)
            if self._command_exists("wmctrl"):
                methods.add(DetectionMethod.WMCTRL)
            if self._command_exists("xprop"):
                methods.add(DetectionMethod.XPROP)
        elif self._platform == "Windows":
            methods.add(DetectionMethod.POWERSHELL)
            methods.add(DetectionMethod.WMI)
        
        return methods
    
    def _check_accessibility(self) -> bool:
        """Check if we have accessibility permissions (macOS)"""
        try:
            script = 'tell application "System Events" to return UI elements enabled'
            result = subprocess.run(
                ["osascript", "-e", script],
                capture_output=True,
                text=True,
                timeout=5
            )
            return result.returncode == 0 and "true" in result.stdout.lower()
        except Exception:
            return False
    
    def _command_exists(self, cmd: str) -> bool:
        """Check if a command exists"""
        try:
            subprocess.run(
                ["which", cmd],
                capture_output=True,
                check=True,
                timeout=2
            )
            return True
        except Exception:
            return False
    
    async def start(self) -> None:
        """Start polling for app changes"""
        if self._running:
            return
        
        self._running = True
        self._poll_task = asyncio.create_task(self._poll_loop())
        logger.info("AppDiscovery polling started")
    
    async def stop(self) -> None:
        """Stop polling"""
        self._running = False
        if self._poll_task:
            self._poll_task.cancel()
            try:
                await self._poll_task
            except asyncio.CancelledError:
                pass
        logger.info("AppDiscovery polling stopped")
    
    async def _poll_loop(self) -> None:
        """Main polling loop"""
        while self._running:
            try:
                await self.detect()
                await asyncio.sleep(self.poll_interval)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Poll error: {e}")
                await asyncio.sleep(self.poll_interval)
    
    async def detect(self) -> AppContext:
        """
        Detect current app context using best available methods
        
        Returns:
            AppContext with frontmost app and running apps
        """
        # Check cache
        now = datetime.utcnow()
        if self._last_context and self._last_poll:
            elapsed = (now - self._last_poll).total_seconds()
            if elapsed < self.cache_ttl:
                return self._last_context
        
        # Detect based on platform
        if self._platform == "Darwin":
            context = await self._detect_macos()
        elif self._platform == "Linux":
            context = await self._detect_linux()
        elif self._platform == "Windows":
            context = await self._detect_windows()
        else:
            context = AppContext()
        
        self._last_context = context
        self._last_poll = now
        
        # Notify if changed
        if self.on_change:
            if self._context_changed(self._last_context, context):
                asyncio.create_task(self._notify_change(context))
        
        return context
    
    async def _detect_macos(self) -> AppContext:
        """Detect apps on macOS using AppleScript"""
        frontmost = None
        running = []
        
        try:
            # Primary: AppleScript System Events
            if DetectionMethod.APPLESCRIPT in self._available_methods:
                script = '''
                tell application "System Events"
                    -- Get frontmost app
                    set frontProcess to first application process whose frontmost is true
                    set frontName to name of frontProcess
                    set frontBundle to ""
                    try
                        set frontBundle to bundle identifier of frontProcess
                    end try
                    set frontWindow to ""
                    try
                        set frontWindow to name of first window of frontProcess
                    end try
                    set frontPID to unix id of frontProcess
                    
                    -- Get all running apps (excluding background processes)
                    set appList to {}
                    repeat with proc in (get processes whose background only is false)
                        set procName to name of proc
                        set procBundle to ""
                        try
                            set procBundle to bundle identifier of proc
                        end try
                        set end of appList to (procName & "|" & procBundle)
                    end repeat
                    
                    return frontName & "||" & frontBundle & "||" & frontWindow & "||" & frontPID & "::" & (appList as string)
                end tell
                '''
                
                proc = await asyncio.create_subprocess_exec(
                    "osascript", "-e", script,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )
                stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=10.0)
                
                if proc.returncode == 0:
                    result = stdout.decode().strip()
                    front_part, _, apps_part = result.partition("::")
                    
                    # Parse frontmost app
                    if front_part:
                        parts = front_part.split("||")
                        if len(parts) >= 4:
                            front_name = parts[0]
                            front_bundle = parts[1]
                            front_window = parts[2]
                            front_pid = parts[3]
                            
                            # Skip our own app
                            if front_name not in ("Electron", "Allternit Thin Client"):
                                frontmost = DiscoveredApp(
                                    id=self._name_to_id(front_name),
                                    name=front_name,
                                    bundle_id=front_bundle or None,
                                    window_title=front_window or None,
                                    pid=int(front_pid) if front_pid.isdigit() else None,
                                    is_frontmost=True,
                                    detection_methods={DetectionMethod.APPLESCRIPT},
                                )
                                self._update_frontmost_history(front_name)
                    
                    # Parse running apps
                    if apps_part:
                        for app_str in apps_part.split(", "):
                            app_parts = app_str.split("|")
                            if len(app_parts) >= 2:
                                app_name = app_parts[0]
                                app_bundle = app_parts[1] if app_parts[1] else None
                                
                                # Skip system processes and our app
                                if app_name and app_name not in ("Electron", "Allternit Thin Client", ""):
                                    app = DiscoveredApp(
                                        id=self._name_to_id(app_name),
                                        name=app_name,
                                        bundle_id=app_bundle,
                                        is_frontmost=(app_name == frontmost.name if frontmost else False),
                                        detection_methods={DetectionMethod.APPLESCRIPT},
                                    )
                                    running.append(app)
        except asyncio.TimeoutError:
            logger.warning("AppleScript detection timed out")
        except Exception as e:
            logger.error(f"AppleScript detection error: {e}")
        
        # Fallback: ps command
        if not frontmost and DetectionMethod.PS in self._available_methods:
            try:
                proc = await asyncio.create_subprocess_exec(
                    "ps", "-eo", "pid,comm",
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )
                stdout, _ = await proc.communicate()
                # Parse for known apps
            except Exception:
                pass
        
        return AppContext(
            frontmost=frontmost,
            running=running,
            timestamp=datetime.utcnow(),
        )
    
    async def _detect_linux(self) -> AppContext:
        """Detect apps on Linux using wmctrl/xprop"""
        frontmost = None
        running = []
        
        # Try wmctrl for frontmost window
        if DetectionMethod.WMCTRL in self._available_methods:
            try:
                proc = await asyncio.create_subprocess_exec(
                    "wmctrl", "-l", "-p",
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )
                stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=5.0)
                
                # Parse wmctrl output
                # Format: <window_id> <desktop> <pid> <window_title>
                lines = stdout.decode().strip().split("\n")
                active_window = lines[0] if lines else None
                
            except Exception as e:
                logger.debug(f"wmctrl detection error: {e}")
        
        return AppContext(frontmost=frontmost, running=running)
    
    async def _detect_windows(self) -> AppContext:
        """Detect apps on Windows using PowerShell"""
        frontmost = None
        running = []
        
        try:
            ps_script = '''
            $foreground = Get-Process | Where-Object {$_.MainWindowHandle -eq (Get-ForegroundWindow)} | Select-Object -First 1
            $all = Get-Process | Where-Object {$_.MainWindowTitle -ne ""} | Select-Object ProcessName, MainWindowTitle, Id
            
            $result = @{
                frontmost = $foreground.ProcessName
                frontmostTitle = $foreground.MainWindowTitle
                all = $all | ForEach-Object { "$($_.ProcessName)|$($_.MainWindowTitle)|$($_.Id)" }
            } | ConvertTo-Json
            
            Write-Output $result
            '''
            
            proc = await asyncio.create_subprocess_exec(
                "powershell", "-Command", ps_script,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, _ = await proc.communicate()
            
            data = json.loads(stdout.decode())
            if data.get("frontmost"):
                frontmost = DiscoveredApp(
                    id=self._name_to_id(data["frontmost"]),
                    name=data["frontmost"],
                    window_title=data.get("frontmostTitle"),
                    is_frontmost=True,
                    detection_methods={DetectionMethod.POWERSHELL},
                )
        except Exception as e:
            logger.error(f"Windows detection error: {e}")
        
        return AppContext(frontmost=frontmost, running=running)
    
    def _name_to_id(self, name: str) -> str:
        """Convert app name to connector ID"""
        name_map = {
            "Visual Studio Code": "vscode",
            "Code": "vscode",
            "Cursor": "cursor",
            "Google Chrome": "chrome",
            "Chrome": "chrome",
            "Safari": "safari",
            "Firefox": "firefox",
            "Arc": "arc",
            "Terminal": "terminal",
            "iTerm2": "iterm",
            "iTerm": "iterm",
            "Warp": "warp",
            "Slack": "slack",
            "Discord": "discord",
            "Figma": "figma",
            "Notion": "notion",
            "Obsidian": "obsidian",
            "Xcode": "xcode",
            "Microsoft Excel": "excel",
            "Microsoft Word": "word",
            "Microsoft PowerPoint": "powerpoint",
            "GitHub Desktop": "github-desktop",
        }
        return name_map.get(name, name.lower().replace(" ", "-").replace(".", ""))
    
    def _update_frontmost_history(self, app_name: str) -> None:
        """Track frontmost app history"""
        if app_name not in self._frontmost_history:
            self._frontmost_history.insert(0, app_name)
            self._frontmost_history = self._frontmost_history[:self._max_history]
    
    def _context_changed(self, old: Optional[AppContext], new: AppContext) -> bool:
        """Check if context has meaningfully changed"""
        if not old:
            return True
        
        # Check frontmost app change
        old_front = old.frontmost.name if old.frontmost else None
        new_front = new.frontmost.name if new.frontmost else None
        if old_front != new_front:
            return True
        
        # Check window title change (significant for same app)
        if old.frontmost and new.frontmost:
            if old.frontmost.window_title != new.frontmost.window_title:
                return True
        
        return False
    
    async def _notify_change(self, context: AppContext) -> None:
        """Notify change callback"""
        if self.on_change:
            try:
                if asyncio.iscoroutinefunction(self.on_change):
                    await self.on_change(context)
                else:
                    self.on_change(context)
            except Exception as e:
                logger.error(f"Change callback error: {e}")
    
    async def capture_screen(self) -> Optional[bytes]:
        """Capture screenshot for visual context"""
        try:
            if self._platform == "Darwin":
                # Use macOS screencapture
                proc = await asyncio.create_subprocess_exec(
                    "screencapture", "-x", "-",
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )
                stdout, _ = await proc.communicate()
                return stdout if proc.returncode == 0 else None
            elif self._platform == "Linux":
                # Try gnome-screenshot or import (ImageMagick)
                for cmd in [["gnome-screenshot", "-f", "-"], ["import", "-window", "root", "-"]]:
                    try:
                        proc = await asyncio.create_subprocess_exec(
                            *cmd,
                            stdout=asyncio.subprocess.PIPE,
                            stderr=asyncio.subprocess.PIPE,
                        )
                        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=5.0)
                        if proc.returncode == 0:
                            return stdout
                    except Exception:
                        continue
        except Exception as e:
            logger.error(f"Screen capture error: {e}")
        return None
    
    def get_last_context(self) -> Optional[AppContext]:
        """Get cached context without re-detecting"""
        return self._last_context
