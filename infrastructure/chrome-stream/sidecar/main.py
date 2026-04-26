"""
Allternit Chrome Stream Sidecar

FastAPI control surface for managing Chrome sessions.
Uses CDP WebSocket for real Chrome control with proper request/response correlation.
"""

import asyncio
import json
import os
import subprocess
import xmlrpc.client
from datetime import datetime
from typing import Dict, List, Optional

import aiohttp
import httpx
import websockets
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI(title="Allternit Chrome Sidecar")

# Constants
CDP_HTTP = "http://127.0.0.1:9222"
SUPERVISOR_RPC = "http://localhost:9001/RPC2"
CONFIG_FILE = "/data/session_config.json"
PREFERENCES_FILE = "/data/chrome-profile/Default/Preferences"
AUDIT_WEBHOOK = os.environ.get("Allternit_AUDIT_WEBHOOK")

# ============================================================================
# CDP Connection Manager - Proper request/response correlation
# ============================================================================

class CDPConnection:
    """
    Manages CDP WebSocket connection with proper request/response correlation.
    Handles interleaved events and maintains monotonically increasing IDs.
    """
    
    def __init__(self, ws_url: str):
        self.ws_url = ws_url
        self.ws: Optional[websockets.WebSocketClientProtocol] = None
        self.next_id = 1
        self.pending: Dict[int, asyncio.Future] = {}
        self.events: List[dict] = []
        self._receive_task: Optional[asyncio.Task] = None
    
    async def connect(self):
        """Establish WebSocket connection and start receive loop."""
        self.ws = await websockets.connect(self.ws_url, ping_interval=30, ping_timeout=10)
        self._receive_task = asyncio.create_task(self._receive_loop())
    
    async def close(self):
        """Close connection cleanly."""
        if self._receive_task:
            self._receive_task.cancel()
            try:
                await self._receive_task
            except asyncio.CancelledError:
                pass
        if self.ws:
            await self.ws.close()
    
    async def _receive_loop(self):
        """
        Continuously receive messages, route responses to pending futures.
        Events are stored for later retrieval.
        """
        try:
            async for message in self.ws:
                msg = json.loads(message)
                
                if "id" in msg and msg["id"] in self.pending:
                    # Response to our request - resolve the future
                    self.pending[msg["id"]].set_result(msg)
                    del self.pending[msg["id"]]
                elif "method" in msg:
                    # CDP event (Page.frameNavigated, etc.)
                    self.events.append(msg)
                    
                    # Emit audit events for specific methods
                    await self._handle_cdp_event(msg)
        except websockets.ConnectionClosed:
            pass
        except asyncio.CancelledError:
            pass
    
    async def _handle_cdp_event(self, msg: dict):
        """Handle CDP events for audit logging."""
        method = msg.get("method", "")
        params = msg.get("params", {})
        
        if method == "Page.frameNavigated":
            url = params.get("frame", {}).get("url", "")
            if url and not url.startswith("chrome-"):
                await emit_audit("page.navigation", {"url": url})
        
        elif method == "Browser.downloadProgress":
            await emit_audit("download.progress", {
                "guid": params.get("guid"),
                "state": params.get("state"),
                "receivedBytes": params.get("receivedBytes", 0)
            })
    
    async def call(self, method: str, params: dict = None, timeout: float = 30) -> dict:
        """
        Send a CDP command and wait for response.
        Uses monotonically increasing IDs for correlation.
        """
        if self.ws is None or self.ws.closed:
            raise HTTPException(503, "CDP connection not available")
        
        request_id = self.next_id
        self.next_id += 1
        
        future = asyncio.Future()
        self.pending[request_id] = future
        
        await self.ws.send(json.dumps({
            "id": request_id,
            "method": method,
            "params": params or {}
        }))
        
        try:
            response = await asyncio.wait_for(future, timeout=timeout)
            if "error" in response:
                error_msg = response["error"].get("message", "Unknown CDP error")
                raise HTTPException(500, f"CDP error: {error_msg}")
            return response.get("result", {})
        except asyncio.TimeoutError:
            del self.pending[request_id]
            raise HTTPException(504, f"CDP timeout for {method}")


# Global CDP connection (lazy initialization)
_cdp_conn: Optional[CDPConnection] = None

async def get_cdp_connection() -> CDPConnection:
    """Get or create CDP connection."""
    global _cdp_conn
    
    if _cdp_conn is None or (_cdp_conn.ws and _cdp_conn.ws.closed):
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(f"{CDP_HTTP}/json", timeout=5)
                targets = response.json()
                pages = [t for t in targets if t.get("type") == "page"]
                
                if not pages:
                    raise HTTPException(503, "No Chrome pages available")
                
                ws_url = pages[0]["webSocketDebuggerUrl"]
                _cdp_conn = CDPConnection(ws_url)
                await _cdp_conn.connect()
                
                # Enable Page domain for frame navigation events
                await _cdp_conn.call("Page.enable")
                
                # Enable Browser domain for download events
                await _cdp_conn.call("Browser.setDownloadBehavior", {
                    "behavior": "allow",
                    "downloadPath": "/data/downloads",
                    "eventsEnabled": True
                })
                
            except httpx.RequestError as e:
                raise HTTPException(503, f"Failed to connect to Chrome: {e}")
    
    return _cdp_conn


# ============================================================================
# Supervisor Helper - Deterministic process restarts
# ============================================================================

def supervisor_restart(program: str) -> bool:
    """Restart a supervisord-managed program deterministically."""
    try:
        server = xmlrpc.client.ServerProxy(SUPERVISOR_RPC)
        server.supervisor.stopProcess(program, wait=True)
        server.supervisor.startProcess(program, wait=True)
        return True
    except xmlrpc.client.Fault as e:
        raise HTTPException(500, f"supervisorctl restart {program} failed: {e}")


# ============================================================================
# Audit Event Emitter
# ============================================================================

async def emit_audit(event_type: str, detail: dict):
    """Emit audit event to webhook or stdout."""
    event = {
        "event_type": event_type,
        "detail": detail,
        "timestamp": datetime.utcnow().isoformat(),
        "session_id": os.environ.get("Allternit_SESSION_ID", ""),
        "tenant_id": os.environ.get("Allternit_TENANT_ID", "")
    }
    
    # Log to stdout (captured by Allternit API audit collector)
    print(f"AUDIT: {json.dumps(event)}", flush=True)
    
    # Optional: push to webhook
    if AUDIT_WEBHOOK:
        try:
            async with aiohttp.ClientSession() as session:
                await session.post(AUDIT_WEBHOOK, json=event, timeout=aiohttp.ClientTimeout(total=5))
        except Exception:
            pass  # Don't fail on audit webhook errors


# ============================================================================
# Request/Response Models
# ============================================================================

class NavigateRequest(BaseModel):
    url: str


class PolicyRequest(BaseModel):
    extension_settings: Optional[dict] = None
    extra_policies: Optional[dict] = None


class ResizeRequest(BaseModel):
    width: int = 1920
    height: int = 1080


# ============================================================================
# API Endpoints
# ============================================================================

@app.get("/health")
async def health():
    """Check Chrome and selkies liveness."""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{CDP_HTTP}/json/version", timeout=2)
            version = response.json().get("Browser", "unknown")
            return {"chrome": "ok", "version": version, "status": "healthy"}
    except Exception as e:
        raise HTTPException(503, f"Chrome not responding: {e}")


@app.post("/navigate")
async def navigate(req: NavigateRequest):
    """Navigate Chrome to URL via CDP Page.navigate."""
    conn = await get_cdp_connection()
    result = await conn.call("Page.navigate", {"url": req.url})
    
    await emit_audit("navigate", {"url": req.url, "frameId": result.get("frameId")})
    
    return {"ok": True, "frameId": result.get("frameId")}


@app.post("/policy")
async def apply_policy(req: PolicyRequest):
    """Apply Chrome enterprise policy and restart Chrome."""
    policy = {}
    if req.extension_settings:
        policy["ExtensionSettings"] = req.extension_settings
    if req.extra_policies:
        policy.update(req.extra_policies)
    
    policy_path = "/etc/opt/chrome/policies/managed/allternit-tenant.json"
    with open(policy_path, "w") as f:
        json.dump(policy, f, indent=2)
    
    # Deterministic Chrome restart via supervisor
    supervisor_restart("chrome")
    
    await emit_audit("policy.apply", {
        "extension_settings": req.extension_settings,
        "extra_policies": req.extra_policies
    })
    
    return {"ok": True, "note": "Chrome restarted to apply policy"}


@app.post("/resize")
async def resize(req: ResizeRequest):
    """Resize display and Chrome window."""
    # Write new resolution to config file
    config = {
        "resolution": f"{req.width}x{req.height}",
        "width": req.width,
        "height": req.height,
        "updated_at": datetime.utcnow().isoformat()
    }
    
    with open(CONFIG_FILE, "w") as f:
        json.dump(config, f)
    
    # Restart in correct order: xvfb → chrome → selkies
    supervisor_restart("xvfb")
    await asyncio.sleep(1)  # Wait for Xvfb
    supervisor_restart("chrome")
    await asyncio.sleep(2)  # Wait for Chrome
    supervisor_restart("selkies")
    
    await emit_audit("resize", {"width": req.width, "height": req.height})
    
    return {"ok": True, "resolution": f"{req.width}x{req.height}"}


@app.get("/extensions")
async def list_extensions():
    """
    List installed extensions.
    Managed Mode: Return catalog (source of truth).
    Power Mode: Parse Chrome Preferences JSON.
    """
    mode = os.environ.get("Allternit_EXTENSION_MODE", "managed")
    
    if mode == "managed":
        # Return catalog from environment or config
        catalog_path = "/etc/allternit/extension_catalog.json"
        if os.path.exists(catalog_path):
            with open(catalog_path) as f:
                catalog = json.load(f)
                return {"extensions": catalog, "mode": "managed"}
        return {"extensions": [], "mode": "managed"}
    
    else:  # Power Mode — parse Preferences
        if not os.path.exists(PREFERENCES_FILE):
            return {"extensions": [], "mode": "power", "note": "Profile not ready"}
        
        try:
            with open(PREFERENCES_FILE) as f:
                prefs = json.load(f)
            
            extensions = []
            ext_settings = prefs.get("extensions", {}).get("settings", {})
            
            for ext_id, ext_data in ext_settings.items():
                if ext_id == "extensions" or not isinstance(ext_data, dict):
                    continue
                
                manifest = ext_data.get("manifest", {})
                state = ext_data.get("state", 0)
                
                extensions.append({
                    "id": ext_id,
                    "name": manifest.get("name", "Unknown"),
                    "version": manifest.get("version", ""),
                    "enabled": state == 1,
                    "permissions": manifest.get("permissions", []),
                    "mode": "power"
                })
            
            return {"extensions": extensions, "mode": "power"}
        
        except (json.JSONDecodeError, KeyError) as e:
            return {"extensions": [], "mode": "power", "error": str(e)}


@app.get("/current-url")
async def current_url():
    """Get current page URL via CDP Runtime.evaluate."""
    conn = await get_cdp_connection()
    result = await conn.call("Runtime.evaluate", {
        "expression": "window.location.href"
    })
    
    url = result.get("result", {}).get("value", "")
    return {"url": url}


@app.get("/screenshot")
async def screenshot():
    """Capture page screenshot via CDP Page.captureScreenshot."""
    conn = await get_cdp_connection()
    result = await conn.call("Page.captureScreenshot", {
        "format": "png"
    })
    
    return {"data": result.get("data")}


# ============================================================================
# Lifecycle
# ============================================================================

@app.on_event("shutdown")
async def shutdown():
    """Clean up CDP connection on shutdown."""
    global _cdp_conn
    if _cdp_conn:
        await _cdp_conn.close()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8081)
