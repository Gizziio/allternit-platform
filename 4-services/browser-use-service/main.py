"""
Browser-Use Service

FastAPI backend that wraps browser-use library for browser automation.
Provides HTTP API for the Rust API to execute browser actions.
"""

import os
import asyncio
import uuid
from typing import Optional, Dict, Any, List
from datetime import datetime

from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
import uvicorn

# Browser-use imports
try:
    from browser_use import Agent, Browser, BrowserConfig, Controller
    from browser_use.agent.views import ActionResult
    BROWSER_USE_AVAILABLE = True
except ImportError:
    BROWSER_USE_AVAILABLE = False
    print("WARNING: browser-use not installed. Install with: pip install browser-use")

# Playwright fallback
try:
    from playwright.async_api import async_playwright
    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    PLAYWRIGHT_AVAILABLE = False

app = FastAPI(
    title="Browser-Use Service",
    description="Browser automation service using browser-use library",
    version="1.0.0"
)

# ============================================================================
# Session Management
# ============================================================================

class BrowserSession:
    """Manages a browser session"""
    
    def __init__(self, session_id: str, headless: bool = False):
        self.session_id = session_id
        self.headless = headless
        self.browser = None
        self.context = None
        self.page = None
        self.created_at = datetime.now()
        self.last_activity = datetime.now()
        self.agent = None
        
    async def start(self):
        """Start browser session"""
        if PLAYWRIGHT_AVAILABLE:
            playwright = await async_playwright().start()
            self.browser = await playwright.chromium.launch(
                headless=self.headless,
                args=[
                    '--no-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--remote-debugging-port=9222',
                ]
            )
            self.context = await self.browser.new_context(
                viewport={'width': 1280, 'height': 720}
            )
            self.page = await self.context.new_page()
        else:
            # Fallback to browser-use
            browser_config = BrowserConfig(headless=self.headless)
            self.browser = Browser(config=browser_config)
            
    async def stop(self):
        """Stop browser session"""
        if self.browser:
            await self.browser.close()
            self.browser = None
            
    async def navigate(self, url: str):
        """Navigate to URL"""
        if self.page:
            await self.page.goto(url, wait_until='networkidle')
        elif self.browser and hasattr(self.browser, 'navigate'):
            await self.browser.navigate(url)
            
    async def screenshot(self, full_page: bool = False) -> dict:
        """Take screenshot"""
        if self.page:
            screenshot = await self.page.screenshot(
                full_page=full_page,
                type='png'
            )
            import base64
            return {
                'image': 'data:image/png;base64,' + base64.b64encode(screenshot).decode(),
                'size': {'width': 1280, 'height': 720}
            }
        return {'image': '', 'size': {'width': 0, 'height': 0}}
        
    async def click(self, selector: str):
        """Click element"""
        if self.page:
            await self.page.click(selector)
            
    async def type_text(self, selector: str, text: str):
        """Type text into element"""
        if self.page:
            await self.page.fill(selector, text)
            
    async def get_content(self) -> dict:
        """Get page content"""
        if self.page:
            title = await self.page.title()
            url = self.page.url
            html = await self.page.content()
            return {
                'title': title,
                'url': url,
                'html': html,
                'screenshot': await self.screenshot()
            }
        return {'title': '', 'url': '', 'html': '', 'screenshot': None}


# Session store
sessions: Dict[str, BrowserSession] = {}


# ============================================================================
# Request/Response Models
# ============================================================================

class CreateSessionRequest(BaseModel):
    headless: bool = False
    viewport: Optional[Dict[str, int]] = None

class SessionMetadata(BaseModel):
    session_id: str
    
class NavigateRequest(BaseModel):
    url: str
    wait_until: str = 'networkidle'
    
class ScreenshotRequest(BaseModel):
    full_page: bool = False
    format: str = 'png'
    
class ActionRequest(BaseModel):
    actions: List[Dict[str, Any]]
    timeout_ms: int = 30000
    wait_for_navigation: bool = False
    
class ActionResult(BaseModel):
    success: bool
    data: Optional[Any] = None
    error: Optional[str] = None


# ============================================================================
# API Endpoints
# ============================================================================

@app.get("/health")
async def health():
    """Health check"""
    return {
        'status': 'healthy',
        'browser_use_available': BROWSER_USE_AVAILABLE,
        'playwright_available': PLAYWRIGHT_AVAILABLE,
        'active_sessions': len(sessions)
    }

@app.post("/browser/session")
async def create_session(request: CreateSessionRequest):
    """Create new browser session"""
    session_id = f"browser_{uuid.uuid4().hex[:8]}"
    
    session = BrowserSession(session_id, headless=request.headless)
    await session.start()
    
    sessions[session_id] = session
    
    return {'session_id': session_id}

@app.delete("/browser/session/{session_id}")
async def close_session(session_id: str):
    """Close browser session"""
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = sessions.pop(session_id)
    await session.stop()
    
    return {'success': True}

@app.post("/browser/{session_id}/navigate")
async def navigate(session_id: str, request: NavigateRequest):
    """Navigate to URL"""
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = sessions[session_id]
    await session.navigate(request.url)
    
    return {
        'success': True,
        'url': request.url,
        'title': await session.page.title() if session.page else ''
    }

@app.post("/browser/{session_id}/screenshot")
async def screenshot(session_id: str, request: ScreenshotRequest):
    """Take screenshot"""
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = sessions[session_id]
    result = await session.screenshot(full_page=request.full_page)
    
    return {
        'success': True,
        'image': result['image'],
        'size': result['size']
    }

@app.post("/browser/{session_id}/action")
async def execute_action(session_id: str, request: ActionRequest):
    """Execute browser actions"""
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = sessions[session_id]
    results = []
    
    for action in request.actions:
        try:
            action_type = action.get('type')
            target = action.get('target', {})
            
            # Get selector from target
            selector = None
            if isinstance(target, dict):
                selector = target.get('value') or target.get('selector')
            elif isinstance(target, str):
                selector = target
            
            if action_type == 'click':
                if selector:
                    await session.click(selector)
                    results.append({'success': True, 'action': 'click', 'selector': selector})
                else:
                    results.append({'success': False, 'error': 'No selector provided'})
                    
            elif action_type == 'type':
                text = action.get('text', '')
                if selector:
                    await session.type_text(selector, text)
                    results.append({'success': True, 'action': 'type', 'selector': selector, 'text': text})
                else:
                    results.append({'success': False, 'error': 'No selector provided'})
                    
            elif action_type == 'navigate':
                url = action.get('url', '')
                if url:
                    await session.navigate(url)
                    results.append({'success': True, 'action': 'navigate', 'url': url})
                    
            elif action_type == 'screenshot':
                screenshot_result = await session.screenshot()
                results.append({
                    'success': True,
                    'action': 'screenshot',
                    'image': screenshot_result['image']
                })
                
            else:
                results.append({'success': False, 'error': f'Unknown action type: {action_type}'})
                
        except Exception as e:
            results.append({'success': False, 'error': str(e)})
    
    return results

@app.get("/browser/{session_id}/context")
async def get_context(session_id: str):
    """Get browser context (page info)"""
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = sessions[session_id]
    content = await session.get_content()
    
    return {
        'success': True,
        'session_id': session_id,
        'url': content['url'],
        'title': content['title'],
        'screenshot': content['screenshot']
    }


# ============================================================================
# Main
# ============================================================================

if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8080"))
    host = os.environ.get("HOST", "0.0.0.0")
    
    print(f"Starting Browser-Use Service on {host}:{port}")
    print(f"Browser-use available: {BROWSER_USE_AVAILABLE}")
    print(f"Playwright available: {PLAYWRIGHT_AVAILABLE}")
    
    uvicorn.run(app, host=host, port=port)
