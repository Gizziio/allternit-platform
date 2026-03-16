"""
Browser-Use Integration for Superconductor Service
Provides agent-based browser automation using browser-use library
"""

import os
import asyncio
from typing import Optional, Dict, Any, List
from dataclasses import dataclass
from datetime import datetime

# Browser-use imports
from browser_use import Agent as BrowserAgent, Browser, BrowserConfig
from langchain_openai import ChatOpenAI


@dataclass
class BrowserTask:
    """A browser automation task"""
    id: str
    goal: str
    url: Optional[str] = None
    mode: str = "browser-use"  # browser-use, playwright, computer-use
    status: str = "pending"
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    created_at: datetime = None
    completed_at: Optional[datetime] = None


class BrowserUseManager:
    """
    Manages browser automation using browser-use library
    Supports multiple modes:
    - browser-use: Full agent-based browser automation
    - playwright: Direct Playwright control (headless)
    - computer-use: Desktop-like interaction mode
    """
    
    def __init__(self):
        self.tasks: Dict[str, BrowserTask] = {}
        self.browser: Optional[Browser] = None
        self.agent: Optional[BrowserAgent] = None
        self._initialized = False
        
    async def initialize(self):
        """Initialize the browser and agent"""
        if self._initialized:
            return
            
        # Configure browser with Chromium
        browser_config = BrowserConfig(
            headless=os.getenv("BROWSER_HEADLESS", "true").lower() == "true",
            extra_chromium_args=[
                "--no-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
            ]
        )
        
        self.browser = Browser(config=browser_config)
        
        # Initialize LLM for agent
        llm = ChatOpenAI(
            model="gpt-4o",
            api_key=os.getenv("OPENAI_API_KEY"),
            temperature=0.1,
        )
        
        self.agent = BrowserAgent(
            task="Initialize browser agent",
            llm=llm,
            browser=self.browser,
        )
        
        self._initialized = True
        
    async def close(self):
        """Clean up browser resources"""
        if self.browser:
            await self.browser.close()
        self._initialized = False
        
    async def create_task(
        self, 
        goal: str, 
        url: Optional[str] = None,
        mode: str = "browser-use"
    ) -> BrowserTask:
        """Create a new browser automation task"""
        task_id = f"browser-task-{datetime.now().timestamp()}"
        
        task = BrowserTask(
            id=task_id,
            goal=goal,
            url=url,
            mode=mode,
            status="pending",
            created_at=datetime.now()
        )
        
        self.tasks[task_id] = task
        return task
        
    async def execute_task(self, task_id: str) -> BrowserTask:
        """Execute a browser task"""
        if task_id not in self.tasks:
            raise ValueError(f"Task {task_id} not found")
            
        task = self.tasks[task_id]
        task.status = "running"
        
        try:
            await self.initialize()
            
            if task.mode == "browser-use":
                result = await self._execute_browser_use(task)
            elif task.mode == "playwright":
                result = await self._execute_playwright(task)
            elif task.mode == "computer-use":
                result = await self._execute_computer_use(task)
            else:
                raise ValueError(f"Unknown mode: {task.mode}")
                
            task.result = result
            task.status = "completed"
            
        except Exception as e:
            task.error = str(e)
            task.status = "failed"
            
        task.completed_at = datetime.now()
        return task
        
    async def _execute_browser_use(self, task: BrowserTask) -> Dict[str, Any]:
        """Execute using browser-use agent"""
        # Update agent with task
        self.agent.task = task.goal
        
        # Navigate to URL if provided
        if task.url:
            await self.browser.navigate_to(task.url)
        
        # Run the agent
        result = await self.agent.run()
        
        return {
            "success": result.success(),
            "actions": result.actions(),
            "extracted_content": result.extracted_content(),
            "final_url": result.final_url(),
        }
        
    async def _execute_playwright(self, task: BrowserTask) -> Dict[str, Any]:
        """Execute using direct Playwright control (headless mode)"""
        page = await self.browser.get_current_page()
        
        if task.url:
            await page.goto(task.url)
            
        # Execute simple commands based on goal
        # This is a simplified version - in production, parse the goal
        result = {
            "url": page.url,
            "title": await page.title(),
            "content": await page.content(),
        }
        
        return result
        
    async def _execute_computer_use(self, task: BrowserTask) -> Dict[str, Any]:
        """Execute using computer-use mode (desktop-like interactions)"""
        # Computer-use mode uses vision-based interactions
        # Similar to browser-use but with different action space
        page = await self.browser.get_current_page()
        
        if task.url:
            await page.goto(task.url)
            
        # Take screenshot for vision model
        screenshot = await page.screenshot()
        
        return {
            "url": page.url,
            "title": await page.title(),
            "screenshot": screenshot,
            "mode": "computer-use",
        }
        
    async def search_and_retrieve(
        self, 
        query: str, 
        search_engine: str = "duckduckgo"
    ) -> Dict[str, Any]:
        """
        Search for information and retrieve content
        Uses browser-use to perform search and extraction
        """
        task = await self.create_task(
            goal=f"Search for '{query}' using {search_engine}, then extract relevant information",
            url=f"https://duckduckgo.com/?q={query.replace(' ', '+')}",
            mode="browser-use"
        )
        
        return await self.execute_task(task.id)
        
    async def retrieve_url(self, url: str) -> Dict[str, Any]:
        """
        Retrieve content from a specific URL
        """
        task = await self.create_task(
            goal=f"Navigate to {url} and extract the main content, title, and relevant information",
            url=url,
            mode="browser-use"
        )
        
        result = await self.execute_task(task.id)
        return {
            "url": url,
            "title": result.result.get("title", "") if result.result else "",
            "content": result.result.get("extracted_content", "") if result.result else "",
            "success": result.status == "completed",
            "error": result.error,
        }
        
    def get_task(self, task_id: str) -> Optional[BrowserTask]:
        """Get task by ID"""
        return self.tasks.get(task_id)
        
    def list_tasks(self) -> List[BrowserTask]:
        """List all tasks"""
        return list(self.tasks.values())


# Singleton instance
browser_manager = BrowserUseManager()
