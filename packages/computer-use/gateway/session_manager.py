"""
Persistent Browser Session Manager for A2R Computer Use Gateway

Manages Playwright browser contexts keyed by session_id.
Provides persistent sessions across multiple actions.
"""

from __future__ import annotations

import asyncio
import time
from typing import Dict, Optional, Tuple
from playwright.async_api import async_playwright, Browser, BrowserContext, Page


class SessionInfo:
    """Information about a browser session."""
    
    def __init__(self, session_id: str, context: BrowserContext, page: Page):
        self.session_id = session_id
        self.context = context
        self.current_page = page
        self.created_at = time.time()
        self.last_accessed = time.time()
        self.action_count = 0
    
    def touch(self):
        """Update last accessed time."""
        self.last_accessed = time.time()
        self.action_count += 1
    
    @property
    def idle_time(self) -> float:
        """Seconds since last access."""
        return time.time() - self.last_accessed
    
    @property
    def age(self) -> float:
        """Seconds since creation."""
        return time.time() - self.created_at


class SessionManager:
    """
    Manages persistent browser sessions.
    
    Each session_id maps to:
    - One BrowserContext (isolated cookies/storage)
    - One current Page (active tab)
    """
    
    def __init__(
        self,
        idle_timeout: float = 1800,  # 30 minutes
        max_sessions: int = 10,
    ):
        self.idle_timeout = idle_timeout
        self.max_sessions = max_sessions
        
        self._playwright: Optional[async_playwright] = None
        self._browser: Optional[Browser] = None
        self._sessions: Dict[str, SessionInfo] = {}
        self._lock = asyncio.Lock()
        self._cleanup_task: Optional[asyncio.Task] = None
        self._initialized = False
    
    async def initialize(self) -> None:
        """Initialize Playwright and browser."""
        if self._initialized:
            return
        
        async with self._lock:
            if self._initialized:
                return
            
            self._playwright = await async_playwright().start()
            self._browser = await self._playwright.chromium.launch(
                headless=True,
                args=[
                    "--no-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-gpu",
                    "--disable-web-security",
                    "--disable-features=IsolateOrigins,site-per-process",
                ]
            )
            self._initialized = True
            
            # Start background cleanup task
            self._cleanup_task = asyncio.create_task(self._cleanup_loop())
    
    async def _cleanup_loop(self) -> None:
        """Background task to clean up expired sessions."""
        while True:
            try:
                await asyncio.sleep(60)  # Check every minute
                await self.cleanup_expired()
            except asyncio.CancelledError:
                break
            except Exception:
                # Log error but keep running
                pass
    
    async def get_or_create_session(
        self,
        session_id: str,
    ) -> Tuple[BrowserContext, Page]:
        """
        Get existing session or create new one.
        
        Returns (context, current_page) for the session.
        """
        await self.initialize()
        
        async with self._lock:
            # Check for existing session
            if session_id in self._sessions:
                session = self._sessions[session_id]
                session.touch()
                
                # Verify page is still valid
                if session.current_page.is_closed():
                    # Create new page in same context
                    session.current_page = await session.context.new_page()
                
                return session.context, session.current_page
            
            # Check session limit
            if len(self._sessions) >= self.max_sessions:
                # Close oldest idle session
                await self._close_oldest_session()
            
            # Create new session
            context = await self._browser.new_context(
                viewport={"width": 1280, "height": 720},
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                accept_downloads=True,
            )
            
            page = await context.new_page()
            
            session = SessionInfo(session_id, context, page)
            self._sessions[session_id] = session
            
            return context, page
    
    async def get_page(self, session_id: str) -> Optional[Page]:
        """
        Get current page for session.
        Returns None if session doesn't exist.
        """
        async with self._lock:
            if session_id not in self._sessions:
                return None
            
            session = self._sessions[session_id]
            session.touch()
            
            if session.current_page.is_closed():
                session.current_page = await session.context.new_page()
            
            return session.current_page
    
    async def close_session(self, session_id: str) -> bool:
        """
        Close a specific session.
        Returns True if session was found and closed.
        """
        async with self._lock:
            if session_id not in self._sessions:
                return False
            
            session = self._sessions.pop(session_id)
            
            try:
                await session.context.close()
            except Exception:
                pass
            
            return True
    
    async def cleanup_expired(self) -> int:
        """
        Close sessions that have been idle too long.
        Returns number of sessions closed.
        """
        closed_count = 0
        
        async with self._lock:
            now = time.time()
            expired = [
                sid for sid, s in self._sessions.items()
                if now - s.last_accessed > self.idle_timeout
            ]
            
            for sid in expired:
                session = self._sessions.pop(sid, None)
                if session:
                    try:
                        await session.context.close()
                    except Exception:
                        pass
                    closed_count += 1
        
        return closed_count
    
    async def _close_oldest_session(self) -> None:
        """Close the oldest idle session to make room."""
        if not self._sessions:
            return
        
        # Find oldest by last_accessed
        oldest_sid = min(
            self._sessions.keys(),
            key=lambda sid: self._sessions[sid].last_accessed
        )
        
        session = self._sessions.pop(oldest_sid, None)
        if session:
            try:
                await session.context.close()
            except Exception:
                pass
    
    async def get_session_stats(self) -> dict:
        """Get statistics about current sessions."""
        async with self._lock:
            return {
                "active_sessions": len(self._sessions),
                "max_sessions": self.max_sessions,
                "idle_timeout": self.idle_timeout,
                "sessions": [
                    {
                        "session_id": sid,
                        "action_count": s.action_count,
                        "idle_seconds": s.idle_time,
                        "age_seconds": s.age,
                    }
                    for sid, s in self._sessions.items()
                ]
            }
    
    async def shutdown(self) -> None:
        """Shutdown session manager and close all sessions."""
        # Stop cleanup task
        if self._cleanup_task:
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass
        
        async with self._lock:
            # Close all sessions
            for session in self._sessions.values():
                try:
                    await session.context.close()
                except Exception:
                    pass
            
            self._sessions.clear()
            
            # Close browser
            if self._browser:
                try:
                    await self._browser.close()
                except Exception:
                    pass
                self._browser = None
            
            # Stop playwright
            if self._playwright:
                try:
                    await self._playwright.stop()
                except Exception:
                    pass
                self._playwright = None
            
            self._initialized = False


# Global session manager instance
session_manager = SessionManager()
