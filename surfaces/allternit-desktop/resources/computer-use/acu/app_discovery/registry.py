"""
App Registry — Maps applications to connectors and provides metadata

This is the source of truth for:
- Which apps can be connected
- App icons, bundle IDs, process names
- Automation capabilities per app
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set
from enum import Enum


class AppCategory(Enum):
    IDE = "ide"
    BROWSER = "browser"
    TERMINAL = "terminal"
    PRODUCTIVITY = "productivity"
    COMMUNICATION = "communication"
    DESIGN = "design"
    OFFICE = "office"
    MEDIA = "media"
    SYSTEM = "system"


class AutomationCapability(Enum):
    """What can be automated in this app"""
    SCREENSHOT = "screenshot"      # Can capture window
    TEXT_INPUT = "text_input"      # Can type text
    CLICK = "click"                # Can click elements
    KEYBOARD = "keyboard"          # Can send keyboard shortcuts
    READ_TEXT = "read_text"        # Can extract text (OCR/accessibility)
    EXECUTE = "execute"            # Can execute commands within app


@dataclass
class AppDefinition:
    """Definition of a connectable application"""
    id: str
    name: str
    category: AppCategory
    
    # Detection patterns
    bundle_ids: List[str] = field(default_factory=list)      # macOS bundle IDs
    process_names: List[str] = field(default_factory=list)   # Process names
    window_titles: List[str] = field(default_factory=list)   # Window title patterns
    
    # Automation
    capabilities: Set[AutomationCapability] = field(default_factory=set)
    
    # Display
    icon_svg: Optional[str] = None
    color: str = "#888888"
    
    # Connection config
    requires_accessibility: bool = False
    connection_url: Optional[str] = None  # For web-based apps


class AppRegistry:
    """Registry of all connectable applications"""
    
    # Built-in app definitions
    APPS: List[AppDefinition] = [
        # IDEs
        AppDefinition(
            id="vscode",
            name="Visual Studio Code",
            category=AppCategory.IDE,
            bundle_ids=["com.microsoft.VSCode"],
            process_names=["Code", "Visual Studio Code", "Electron"],
            capabilities={
                AutomationCapability.SCREENSHOT,
                AutomationCapability.TEXT_INPUT,
                AutomationCapability.KEYBOARD,
                AutomationCapability.EXECUTE,
            },
            color="#007ACC",
        ),
        AppDefinition(
            id="cursor",
            name="Cursor",
            category=AppCategory.IDE,
            bundle_ids=["com.todesktop.230313mzl4w4u92"],
            process_names=["Cursor"],
            capabilities={
                AutomationCapability.SCREENSHOT,
                AutomationCapability.TEXT_INPUT,
                AutomationCapability.KEYBOARD,
            },
            color="#1E1E1E",
        ),
        AppDefinition(
            id="xcode",
            name="Xcode",
            category=AppCategory.IDE,
            bundle_ids=["com.apple.dt.Xcode"],
            process_names=["Xcode"],
            capabilities={
                AutomationCapability.SCREENSHOT,
                AutomationCapability.TEXT_INPUT,
                AutomationCapability.KEYBOARD,
            },
            color="#147EFB",
        ),
        
        # Browsers
        AppDefinition(
            id="chrome",
            name="Google Chrome",
            category=AppCategory.BROWSER,
            bundle_ids=["com.google.Chrome"],
            process_names=["Google Chrome", "Chrome"],
            capabilities={
                AutomationCapability.SCREENSHOT,
                AutomationCapability.TEXT_INPUT,
                AutomationCapability.CLICK,
                AutomationCapability.READ_TEXT,
                AutomationCapability.EXECUTE,
            },
            color="#4285F4",
        ),
        AppDefinition(
            id="safari",
            name="Safari",
            category=AppCategory.BROWSER,
            bundle_ids=["com.apple.Safari"],
            process_names=["Safari"],
            capabilities={
                AutomationCapability.SCREENSHOT,
                AutomationCapability.TEXT_INPUT,
                AutomationCapability.CLICK,
            },
            color="#00D8FF",
        ),
        AppDefinition(
            id="firefox",
            name="Firefox",
            category=AppCategory.BROWSER,
            bundle_ids=["org.mozilla.firefox"],
            process_names=["firefox", "Firefox"],
            capabilities={
                AutomationCapability.SCREENSHOT,
                AutomationCapability.TEXT_INPUT,
                AutomationCapability.CLICK,
            },
            color="#FF7139",
        ),
        AppDefinition(
            id="arc",
            name="Arc",
            category=AppCategory.BROWSER,
            bundle_ids=["company.thebrowser.Browser"],
            process_names=["Arc"],
            capabilities={
                AutomationCapability.SCREENSHOT,
                AutomationCapability.TEXT_INPUT,
                AutomationCapability.CLICK,
            },
            color="#FC5B30",
        ),
        
        # Terminals
        AppDefinition(
            id="terminal",
            name="Terminal",
            category=AppCategory.TERMINAL,
            bundle_ids=["com.apple.Terminal"],
            process_names=["Terminal"],
            capabilities={
                AutomationCapability.SCREENSHOT,
                AutomationCapability.TEXT_INPUT,
                AutomationCapability.KEYBOARD,
                AutomationCapability.EXECUTE,
            },
            color="#34C759",
        ),
        AppDefinition(
            id="iterm",
            name="iTerm2",
            category=AppCategory.TERMINAL,
            bundle_ids=["com.googlecode.iterm2"],
            process_names=["iTerm2", "iTerm"],
            capabilities={
                AutomationCapability.SCREENSHOT,
                AutomationCapability.TEXT_INPUT,
                AutomationCapability.KEYBOARD,
                AutomationCapability.EXECUTE,
            },
            color="#000000",
        ),
        AppDefinition(
            id="warp",
            name="Warp",
            category=AppCategory.TERMINAL,
            bundle_ids=["dev.warp.Warp-Stable"],
            process_names=["Warp"],
            capabilities={
                AutomationCapability.SCREENSHOT,
                AutomationCapability.TEXT_INPUT,
                AutomationCapability.KEYBOARD,
            },
            color="#7C3AED",
        ),
        
        # Productivity
        AppDefinition(
            id="notion",
            name="Notion",
            category=AppCategory.PRODUCTIVITY,
            bundle_ids=["notion.id"],
            process_names=["Notion"],
            capabilities={
                AutomationCapability.SCREENSHOT,
                AutomationCapability.TEXT_INPUT,
                AutomationCapability.CLICK,
            },
            color="#000000",
        ),
        AppDefinition(
            id="obsidian",
            name="Obsidian",
            category=AppCategory.PRODUCTIVITY,
            bundle_ids=["md.obsidian"],
            process_names=["Obsidian"],
            capabilities={
                AutomationCapability.SCREENSHOT,
                AutomationCapability.TEXT_INPUT,
            },
            color="#7C3AED",
        ),
        
        # Communication
        AppDefinition(
            id="slack",
            name="Slack",
            category=AppCategory.COMMUNICATION,
            bundle_ids=["com.tinyspeck.slackmacgap"],
            process_names=["Slack"],
            capabilities={
                AutomationCapability.SCREENSHOT,
                AutomationCapability.TEXT_INPUT,
                AutomationCapability.CLICK,
            },
            color="#4A154B",
        ),
        AppDefinition(
            id="discord",
            name="Discord",
            category=AppCategory.COMMUNICATION,
            bundle_ids=["com.hnc.Discord"],
            process_names=["Discord"],
            capabilities={
                AutomationCapability.SCREENSHOT,
                AutomationCapability.TEXT_INPUT,
            },
            color="#5865F2",
        ),
        
        # Design
        AppDefinition(
            id="figma",
            name="Figma",
            category=AppCategory.DESIGN,
            bundle_ids=["com.figma.Desktop"],
            process_names=["Figma"],
            capabilities={
                AutomationCapability.SCREENSHOT,
                AutomationCapability.CLICK,
                AutomationCapability.KEYBOARD,
            },
            color="#F24E1E",
        ),
        
        # Office
        AppDefinition(
            id="excel",
            name="Microsoft Excel",
            category=AppCategory.OFFICE,
            bundle_ids=["com.microsoft.Excel"],
            process_names=["Microsoft Excel"],
            capabilities={
                AutomationCapability.SCREENSHOT,
                AutomationCapability.TEXT_INPUT,
                AutomationCapability.KEYBOARD,
            },
            color="#217346",
        ),
        AppDefinition(
            id="word",
            name="Microsoft Word",
            category=AppCategory.OFFICE,
            bundle_ids=["com.microsoft.Word"],
            process_names=["Microsoft Word"],
            capabilities={
                AutomationCapability.SCREENSHOT,
                AutomationCapability.TEXT_INPUT,
            },
            color="#2B579A",
        ),
        AppDefinition(
            id="powerpoint",
            name="Microsoft PowerPoint",
            category=AppCategory.OFFICE,
            bundle_ids=["com.microsoft.PowerPoint"],
            process_names=["Microsoft PowerPoint"],
            capabilities={
                AutomationCapability.SCREENSHOT,
                AutomationCapability.TEXT_INPUT,
            },
            color="#D24726",
        ),
        
        # Development
        AppDefinition(
            id="github-desktop",
            name="GitHub Desktop",
            category=AppCategory.IDE,
            bundle_ids=["com.github.GitHubClient"],
            process_names=["GitHub Desktop"],
            capabilities={
                AutomationCapability.SCREENSHOT,
                AutomationCapability.CLICK,
            },
            color="#6e40c9",
        ),
    ]
    
    def __init__(self):
        self._apps_by_id: Dict[str, AppDefinition] = {
            app.id: app for app in self.APPS
        }
        self._apps_by_bundle: Dict[str, AppDefinition] = {}
        self._apps_by_process: Dict[str, AppDefinition] = {}
        
        # Build lookup indexes
        for app in self.APPS:
            for bundle_id in app.bundle_ids:
                self._apps_by_bundle[bundle_id.lower()] = app
            for proc in app.process_names:
                self._apps_by_process[proc.lower()] = app
    
    def get_by_id(self, app_id: str) -> Optional[AppDefinition]:
        """Get app definition by ID"""
        return self._apps_by_id.get(app_id)
    
    def get_by_bundle_id(self, bundle_id: str) -> Optional[AppDefinition]:
        """Get app by macOS bundle ID"""
        return self._apps_by_bundle.get(bundle_id.lower())
    
    def get_by_process_name(self, process_name: str) -> Optional[AppDefinition]:
        """Get app by process name"""
        return self._apps_by_process.get(process_name.lower())
    
    def find_by_name(self, name: str) -> Optional[AppDefinition]:
        """Find app by fuzzy name matching"""
        name_lower = name.lower()
        
        # Exact match
        if name_lower in self._apps_by_id:
            return self._apps_by_id[name_lower]
        
        # Process name match
        if name_lower in self._apps_by_process:
            return self._apps_by_process[name_lower]
        
        # Substring match
        for app in self.APPS:
            if name_lower in app.name.lower():
                return app
            for proc in app.process_names:
                if name_lower in proc.lower():
                    return app
        
        return None
    
    def get_by_category(self, category: AppCategory) -> List[AppDefinition]:
        """Get all apps in a category"""
        return [app for app in self.APPS if app.category == category]
    
    def get_all(self) -> List[AppDefinition]:
        """Get all registered apps"""
        return self.APPS.copy()
    
    def get_connectors(self) -> List[AppDefinition]:
        """Get apps that can be connected (have capabilities)"""
        return [app for app in self.APPS if len(app.capabilities) > 0]
    
    def can_automate(
        self,
        app_id: str,
        capability: AutomationCapability
    ) -> bool:
        """Check if an app supports a specific automation capability"""
        app = self.get_by_id(app_id)
        if not app:
            return False
        return capability in app.capabilities
