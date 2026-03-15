"""
A2R Browser-Use Integration
Agent-based browser automation using the browser-use library.

The LLM driving the agent is provided by the caller (the operator).
This module owns no LLM selection logic — it is a pure tool wrapper.
"""

import asyncio
import base64
import os
import uuid
from typing import Optional, Dict, Any, List
from dataclasses import dataclass, field
from datetime import datetime


try:
    from browser_use import Agent as BrowserAgent, Browser, BrowserConfig
    BROWSER_USE_AVAILABLE = True
except ImportError:
    BROWSER_USE_AVAILABLE = False


@dataclass
class BrowserTask:
    goal: str
    session_id: str
    run_id: str
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    url: Optional[str] = None
    mode: str = "browser-use"
    starting_url: Optional[str] = None
    status: str = "pending"
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)
    completed_at: Optional[datetime] = None


class A2RBrowserManager:
    """
    Browser automation manager wrapping the browser-use library.
    The caller supplies the LLM; this class owns only browser lifecycle and task execution.
    """

    def __init__(self):
        self._browser: Optional[Any] = None
        self._initialized = False
        self._tasks: Dict[str, BrowserTask] = {}

    async def initialize(self) -> None:
        if self._initialized or not BROWSER_USE_AVAILABLE:
            return
        browser_config = BrowserConfig(
            headless=os.getenv("BROWSER_HEADLESS", "true").lower() == "true",
            extra_chromium_args=[
                "--no-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
            ],
        )
        self._browser = Browser(config=browser_config)
        self._initialized = True

    async def close(self) -> None:
        if self._browser:
            await self._browser.close()
        self._initialized = False

    def create_task(
        self,
        goal: str,
        url: Optional[str] = None,
        mode: str = "browser-use",
    ) -> BrowserTask:
        """Create and register a new browser task."""
        task_id = str(uuid.uuid4())
        task = BrowserTask(
            id=task_id,
            goal=goal,
            session_id=task_id,
            run_id=task_id,
            url=url,
            mode=mode,
            starting_url=url,
        )
        self._tasks[task_id] = task
        return task

    async def execute_task(self, task_id: str, llm: Any) -> BrowserTask:
        """
        Execute a previously created task with the provided LLM.
        Raises ValueError if the task does not exist.
        """
        task = self._tasks.get(task_id)
        if task is None:
            raise ValueError(f"Task {task_id!r} not found")
        await self.run_task(task, llm)
        return task

    def get_task(self, task_id: str) -> Optional[BrowserTask]:
        """Return a task by ID, or None if not found."""
        return self._tasks.get(task_id)

    async def search_and_retrieve(
        self,
        query: str,
        search_engine: str,
        llm: Any,
    ) -> Dict[str, Any]:
        """
        Use browser-use to search for a query and extract the top results.
        Returns titles, URLs, and snippets from the search results page.
        """
        search_urls: Dict[str, str] = {
            "duckduckgo": f"https://duckduckgo.com/?q={query.replace(' ', '+')}",
            "google": f"https://www.google.com/search?q={query.replace(' ', '+')}",
            "bing": f"https://www.bing.com/search?q={query.replace(' ', '+')}",
        }
        start_url = search_urls.get(search_engine.lower(), search_urls["duckduckgo"])

        task = BrowserTask(
            goal=(
                f"Search for '{query}' on {search_engine} and extract the top 10 results "
                "with their titles, URLs, and short snippets."
            ),
            session_id=str(uuid.uuid4()),
            run_id=str(uuid.uuid4()),
            starting_url=start_url,
        )
        result = await self.run_task(task, llm)
        return {
            "query": query,
            "search_engine": search_engine,
            "results": result.get("extracted_content"),
            "summary": result.get("summary"),
            "status": result.get("status"),
        }

    async def retrieve_url(self, url: str, llm: Any) -> Dict[str, Any]:
        """
        Navigate to a URL and extract all meaningful content using browser-use.
        Replaces paid scraping APIs.
        """
        task = BrowserTask(
            goal=(
                f"Navigate to {url} and extract all meaningful content: "
                "main text, headings, links, tables, and any structured data present."
            ),
            session_id=str(uuid.uuid4()),
            run_id=str(uuid.uuid4()),
            starting_url=url,
        )
        result = await self.run_task(task, llm)
        return {
            "url": url,
            "content": result.get("extracted_content"),
            "summary": result.get("summary"),
            "status": result.get("status"),
        }

    async def run_task(self, task: BrowserTask, llm: Any) -> Dict[str, Any]:
        """
        Execute a browser task using the provided LLM instance.

        Args:
            task: BrowserTask describing the goal and session context.
            llm:  A langchain-compatible chat model instance (any provider).

        Returns:
            Dict with keys: status, summary, extracted_content, screenshots, error.
        """
        if not BROWSER_USE_AVAILABLE:
            return {
                "status": "failed",
                "summary": "browser-use package not installed",
                "extracted_content": None,
                "screenshots": [],
                "error": "Install browser-use: pip install browser-use",
            }

        task.status = "running"
        try:
            await self.initialize()

            agent = BrowserAgent(
                task=task.goal,
                llm=llm,
                browser=self._browser,
            )

            if task.starting_url:
                await self._browser.navigate_to(task.starting_url)

            agent_result = await agent.run()

            screenshots: List[str] = []
            try:
                page = await self._browser.get_current_page()
                png_bytes = await page.screenshot()
                b64 = base64.b64encode(png_bytes).decode("utf-8")
                screenshots.append(f"data:image/png;base64,{b64}")
            except Exception:
                pass

            extracted = None
            try:
                extracted = agent_result.extracted_content()
            except Exception:
                pass

            summary = ""
            try:
                summary = str(agent_result.final_result() or "")
            except Exception:
                pass
            if not summary:
                summary = f"browser-use task completed: {task.goal}"

            task.status = "completed"
            task.completed_at = datetime.now()
            task.result = {
                "status": "success",
                "summary": summary,
                "extracted_content": extracted,
                "screenshots": screenshots,
                "error": None,
            }
            return task.result

        except Exception as exc:
            task.status = "failed"
            task.error = str(exc)
            task.completed_at = datetime.now()
            return {
                "status": "failed",
                "summary": f"browser-use task failed: {exc}",
                "extracted_content": None,
                "screenshots": [],
                "error": str(exc),
            }


# Singleton instance
a2r_browser_manager = A2RBrowserManager()
