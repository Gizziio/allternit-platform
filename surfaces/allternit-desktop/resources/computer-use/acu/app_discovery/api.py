"""
App Discovery API — FastAPI endpoints for thin client and web integration
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime

from .detector import AppDiscovery, AppContext, DiscoveredApp
from .registry import AppRegistry, AppCategory


router = APIRouter(prefix="/app-discovery", tags=["app-discovery"])

# Global instances (initialized on startup)
discovery: Optional[AppDiscovery] = None
registry = AppRegistry()


class AppInfo(BaseModel):
    """App information response"""
    id: str
    name: str
    category: str
    bundle_id: Optional[str] = None
    window_title: Optional[str] = None
    is_frontmost: bool = False
    is_connected: bool = False
    capabilities: List[str] = []


class ContextResponse(BaseModel):
    """Full app context response"""
    frontmost: Optional[AppInfo] = None
    running: List[AppInfo] = []
    timestamp: datetime


class ConnectorListResponse(BaseModel):
    """Available connectors response"""
    connectors: List[AppInfo]
    categories: List[str]


def init_discovery(on_change=None):
    """Initialize the app discovery service"""
    global discovery
    discovery = AppDiscovery(on_change=on_change)
    return discovery


@router.get("/context", response_model=ContextResponse)
async def get_current_context() -> ContextResponse:
    """
    Get current app context (frontmost + running apps)
    
    This is the primary endpoint for the thin client to get
    contextual awareness of what the user is working on.
    """
    if not discovery:
        raise HTTPException(status_code=503, detail="App discovery not initialized")
    
    context = await discovery.detect()
    
    return ContextResponse(
        frontmost=_convert_app(context.frontmost),
        running=[_convert_app(a) for a in context.running],
        timestamp=context.timestamp,
    )


@router.get("/frontmost", response_model=Optional[AppInfo])
async def get_frontmost_app() -> Optional[AppInfo]:
    """Get just the frontmost application"""
    if not discovery:
        raise HTTPException(status_code=503, detail="App discovery not initialized")
    
    context = await discovery.detect()
    return _convert_app(context.frontmost)


@router.get("/connectors", response_model=ConnectorListResponse)
def get_available_connectors() -> ConnectorListResponse:
    """
    Get all available connectors (apps that can be connected)
    
    Used by the thin client to show the full connector list
    in the "Browse All Apps" overlay.
    """
    connectors = registry.get_connectors()
    
    # Get unique categories
    categories = list(set(c.value for c in AppCategory))
    
    return ConnectorListResponse(
        connectors=[
            AppInfo(
                id=app.id,
                name=app.name,
                category=app.category.value,
                capabilities=[c.value for c in app.capabilities],
            )
            for app in connectors
        ],
        categories=categories,
    )


@router.get("/connectors/{category}", response_model=List[AppInfo])
def get_connectors_by_category(category: str) -> List[AppInfo]:
    """Get connectors filtered by category"""
    try:
        cat = AppCategory(category)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid category: {category}")
    
    apps = registry.get_by_category(cat)
    return [
        AppInfo(
            id=app.id,
            name=app.name,
            category=app.category.value,
            capabilities=[c.value for c in app.capabilities],
        )
        for app in apps
    ]


@router.post("/connect/{app_id}")
async def connect_to_app(app_id: str) -> Dict[str, Any]:
    """
    Connect to a specific app for contextual assistance.

    Verifies the app is registered, checks whether it is currently running
    (when app discovery is initialized), and returns connection metadata.
    """
    app = registry.get_by_id(app_id)
    if not app:
        raise HTTPException(status_code=404, detail=f"App not found: {app_id}")

    is_running = False
    if discovery:
        try:
            context = await discovery.detect()
            running_names = {a.name.lower() for a in context.running if a}
            is_running = app.name.lower() in running_names
        except Exception:
            pass

    return {
        "success": True,
        "app_id": app_id,
        "app_name": app.name,
        "is_running": is_running,
        "capabilities": [c.value for c in app.capabilities],
        "message": f"Connected to {app.name}" + ("" if is_running else " (app not currently running)"),
    }


@router.get("/capabilities/{app_id}")
def get_app_capabilities(app_id: str) -> Dict[str, Any]:
    """Get automation capabilities for an app"""
    app = registry.get_by_id(app_id)
    if not app:
        raise HTTPException(status_code=404, detail=f"App not found: {app_id}")
    
    caps = [c.value for c in app.capabilities]
    return {
        "app_id": app_id,
        "app_name": app.name,
        "capabilities": caps,
        "can_screenshot": "screenshot" in caps,
    }


def _convert_app(app: Optional[DiscoveredApp]) -> Optional[AppInfo]:
    """Convert internal DiscoveredApp to API response"""
    if not app:
        return None
    
    # Look up capabilities from registry
    app_def = registry.get_by_id(app.id)
    capabilities = [c.value for c in app_def.capabilities] if app_def else []
    category = app_def.category.value if app_def else "unknown"
    
    return AppInfo(
        id=app.id,
        name=app.name,
        category=category,
        bundle_id=app.bundle_id,
        window_title=app.window_title,
        is_frontmost=app.is_frontmost,
        is_connected=app.is_connected,
        capabilities=capabilities,
    )
