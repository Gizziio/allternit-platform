"""
A2R Computer Use — Browser Use Adapter
Wraps the existing browser-use agent path from A2R Operator.
"""

from core import BaseAdapter, ActionRequest, ResultEnvelope, Receipt, Artifact
from datetime import datetime
from typing import Optional, Dict, Any
import os


class BrowserUseAdapter(BaseAdapter):
    """LLM-powered adaptive browser automation via browser-use library."""

    def __init__(self):
        self._manager = None

    @property
    def adapter_id(self) -> str:
        return "browser.browser-use"

    @property
    def family(self) -> str:
        return "browser"

    async def initialize(self) -> None:
        """Initialize browser-use agent — wraps existing A2RBrowserManager"""
        try:
            # Import the existing operator's browser manager
            from browser_use import Agent as BrowserAgent, Browser, BrowserConfig
            from langchain_openai import ChatOpenAI

            config = BrowserConfig(
                headless=os.getenv("BROWSER_HEADLESS", "true").lower() == "true",
                extra_chromium_args=["--no-sandbox", "--disable-dev-shm-usage", "--remote-debugging-port=9222"]
            )
            self._browser = Browser(config=config)
            self._llm = ChatOpenAI(
                model=os.getenv("A2R_BROWSER_MODEL", "gpt-4o"),
                api_key=os.getenv("OPENAI_API_KEY"),
                temperature=0.1,
            )
        except ImportError:
            raise RuntimeError("browser-use not installed. Run: pip install browser-use langchain-openai")

    async def execute(self, action: ActionRequest, session_id: str, run_id: str) -> ResultEnvelope:
        envelope = self._make_envelope(action, session_id, run_id)

        try:
            if not self._browser:
                await self.initialize()

            from browser_use import Agent as BrowserAgent

            goal = action.parameters.get("goal", action.target)
            url = action.parameters.get("url", action.target if action.action_type == "goto" else None)

            agent = BrowserAgent(task=goal, llm=self._llm, browser=self._browser)

            if url:
                await self._browser.navigate_to(url)

            result = await agent.run()

            result_data = {
                "success": result.success(),
                "actions": result.actions(),
                "extracted_content": result.extracted_content(),
                "final_url": result.final_url(),
            }

            envelope.status = "completed"
            envelope.extracted_content = result_data
            envelope.completed_at = datetime.utcnow().isoformat()

            self._emit_receipt(envelope, action, result_data)

        except Exception as e:
            envelope.status = "failed"
            envelope.error = {"code": "BROWSER_USE_ERROR", "message": str(e), "adapter_id": self.adapter_id}
            envelope.completed_at = datetime.utcnow().isoformat()

        return envelope

    async def close(self) -> None:
        if self._browser:
            await self._browser.close()
