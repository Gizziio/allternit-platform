import httpx
import os
import logging
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)

class CanvasConnector:
    """
    Summit-Specific Canvas API Connector.
    Used by the Summit Copilot to manage course objects.
    """
    def __init__(self, base_url: Optional[str] = None, api_token: Optional[str] = None):
        self.base_url = base_url or os.getenv("CANVAS_BASE_URL", "")
        self.api_token = api_token or os.getenv("CANVAS_API_TOKEN", "")

    def is_configured(self) -> bool:
        return bool(self.base_url and self.api_token)

    async def _request(self, endpoint: str, method: str = "GET", data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        if not self.is_configured():
            raise ValueError("Canvas not configured: CANVAS_BASE_URL or CANVAS_API_TOKEN missing")

        url = f"{self.base_url.rstrip('/')}/api/v1{endpoint}"
        headers = {
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/json"
        }

        async with httpx.AsyncClient() as client:
            resp = await client.request(method, url, headers=headers, json=data)
            if resp.status_code >= 400:
                logger.error(f"Canvas API Error: {resp.status_code} - {resp.text}")
                resp.raise_for_status()
            return resp.json()

    async def create_module(self, course_id: str, name: str) -> Dict[str, Any]:
        """Action: create_module"""
        return await self._request(f"/courses/{course_id}/modules", method="POST", data={
            "module": {"name": name, "published": False}
        })

    async def list_modules(self, course_id: str) -> List[Dict[str, Any]]:
        """Action: list_modules"""
        return await self._request(f"/courses/{course_id}/modules")
