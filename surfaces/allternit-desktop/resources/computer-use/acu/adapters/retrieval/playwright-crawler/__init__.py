"""
Allternit Computer Use — Playwright Crawler Adapter
Systematic multi-page crawl and content extraction using Playwright.

Actions:
  crawl   — Crawl a URL and follow links up to max_depth
  extract — Extract structured content from a single page
  goto    — Navigate to URL (single page, no link following)
  observe — Return page metadata (title, links, status)

Unlike the browser.playwright adapter which is session-oriented and
interactive, this adapter is batch-oriented: it navigates, extracts,
and closes. No persistent page state between calls.
"""

from core import BaseAdapter, ActionRequest, ResultEnvelope, Artifact
from datetime import datetime
from typing import Optional, Dict, Any, List, Set
from urllib.parse import urljoin, urlparse
import os
import json


class PlaywrightCrawlerAdapter(BaseAdapter):
    """Playwright-based web crawler for structured content retrieval."""

    def __init__(self, max_depth: int = 2, max_pages: int = 50):
        self._max_depth = max_depth
        self._max_pages = max_pages
        self._pw = None
        self._browser = None

    @property
    def adapter_id(self) -> str:
        return "retrieval.playwright-crawler"

    @property
    def family(self) -> str:
        return "retrieval"

    async def initialize(self) -> None:
        try:
            from playwright.async_api import async_playwright
            self._pw = await async_playwright().start()
            self._browser = await self._pw.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-dev-shm-usage"],
            )
        except ImportError:
            raise RuntimeError(
                "Playwright not installed. Run: pip install playwright && playwright install chromium"
            )

    async def execute(self, action: ActionRequest, session_id: str, run_id: str) -> ResultEnvelope:
        envelope = self._make_envelope(action, session_id, run_id)

        try:
            if not self._browser:
                await self.initialize()

            if action.action_type == "crawl":
                result_data = await self._crawl(action)
            elif action.action_type == "extract":
                result_data = await self._extract_single(action)
            elif action.action_type == "goto":
                result_data = await self._goto(action)
            elif action.action_type == "observe":
                result_data = await self._observe(action)
            else:
                envelope.status = "failed"
                envelope.error = {
                    "code": "UNSUPPORTED_ACTION",
                    "message": f"Crawler does not support action '{action.action_type}'",
                    "adapter_id": self.adapter_id,
                }
                envelope.completed_at = datetime.utcnow().isoformat()
                return envelope

            envelope.status = "completed"
            envelope.extracted_content = result_data
            envelope.completed_at = datetime.utcnow().isoformat()

            # Add crawl results as artifact
            if action.action_type == "crawl" and result_data.get("pages"):
                artifact = Artifact(
                    type="crawl_results",
                    path=f"crawl/{run_id}.json",
                    size_bytes=len(json.dumps(result_data)),
                    media_type="application/json",
                )
                envelope.artifacts.append(artifact)

            self._emit_receipt(envelope, action, result_data)

        except Exception as e:
            envelope.status = "failed"
            envelope.error = {
                "code": "CRAWLER_ERROR",
                "message": str(e),
                "adapter_id": self.adapter_id,
            }
            envelope.completed_at = datetime.utcnow().isoformat()

        return envelope

    async def _crawl(self, action: ActionRequest) -> Dict[str, Any]:
        """Crawl starting from target URL, following links up to max_depth."""
        start_url = action.target
        max_depth = action.parameters.get("max_depth", self._max_depth)
        max_pages = action.parameters.get("max_pages", self._max_pages)
        same_origin = action.parameters.get("same_origin", True)

        parsed_start = urlparse(start_url)
        origin = f"{parsed_start.scheme}://{parsed_start.netloc}"

        visited: Set[str] = set()
        pages: List[Dict[str, Any]] = []
        queue: List[tuple] = [(start_url, 0)]  # (url, depth)

        context = await self._browser.new_context()
        page = await context.new_page()

        try:
            while queue and len(visited) < max_pages:
                url, depth = queue.pop(0)
                normalized = url.split("#")[0].rstrip("/")

                if normalized in visited:
                    continue
                visited.add(normalized)

                try:
                    response = await page.goto(url, timeout=action.timeout_ms, wait_until="domcontentloaded")
                    status = response.status if response else None

                    title = await page.title()
                    text = await page.evaluate("() => document.body ? document.body.innerText : ''")

                    page_data = {
                        "url": page.url,
                        "title": title,
                        "status": status,
                        "depth": depth,
                        "text_length": len(text),
                        "text_preview": text[:500] if text else "",
                    }

                    # Extract if requested
                    if action.parameters.get("extract_full_text", False):
                        page_data["full_text"] = text

                    pages.append(page_data)

                    # Follow links if not at max depth
                    if depth < max_depth:
                        links = await page.evaluate("""() => {
                            return Array.from(document.querySelectorAll('a[href]'))
                                .map(a => a.href)
                                .filter(href => href.startsWith('http'))
                        }""")

                        for link in links:
                            link_normalized = link.split("#")[0].rstrip("/")
                            if link_normalized not in visited:
                                if same_origin and not link.startswith(origin):
                                    continue
                                queue.append((link, depth + 1))

                except Exception as e:
                    pages.append({
                        "url": url,
                        "depth": depth,
                        "error": str(e),
                    })

        finally:
            await context.close()

        return {
            "start_url": start_url,
            "pages_crawled": len(pages),
            "max_depth_reached": max(p.get("depth", 0) for p in pages) if pages else 0,
            "pages": pages,
        }

    async def _extract_single(self, action: ActionRequest) -> Dict[str, Any]:
        """Extract content from a single page."""
        context = await self._browser.new_context()
        page = await context.new_page()
        try:
            response = await page.goto(action.target, timeout=action.timeout_ms, wait_until="domcontentloaded")
            title = await page.title()
            text = await page.evaluate("() => document.body ? document.body.innerText : ''")
            html = await page.content()

            result = {
                "url": page.url,
                "title": title,
                "status": response.status if response else None,
                "text": text,
                "html_length": len(html),
            }

            # Optional: extract by selector
            selector = action.parameters.get("selector")
            if selector:
                try:
                    el = await page.query_selector(selector)
                    if el:
                        result["selected_text"] = await el.inner_text()
                        result["selected_html"] = await el.inner_html()
                except Exception:
                    result["selector_error"] = f"Could not find selector: {selector}"

            return result
        finally:
            await context.close()

    async def _goto(self, action: ActionRequest) -> Dict[str, Any]:
        """Navigate to a single URL and return basic info."""
        context = await self._browser.new_context()
        page = await context.new_page()
        try:
            response = await page.goto(action.target, timeout=action.timeout_ms, wait_until="domcontentloaded")
            return {
                "url": page.url,
                "title": await page.title(),
                "status": response.status if response else None,
            }
        finally:
            await context.close()

    async def _observe(self, action: ActionRequest) -> Dict[str, Any]:
        """Get page metadata: title, links, meta tags."""
        context = await self._browser.new_context()
        page = await context.new_page()
        try:
            response = await page.goto(action.target, timeout=action.timeout_ms, wait_until="domcontentloaded")
            links = await page.evaluate("""() => {
                return Array.from(document.querySelectorAll('a[href]'))
                    .map(a => ({ href: a.href, text: a.innerText.trim().substring(0, 100) }))
                    .slice(0, 100)
            }""")
            meta = await page.evaluate("""() => {
                return Array.from(document.querySelectorAll('meta'))
                    .map(m => ({ name: m.name || m.getAttribute('property'), content: m.content }))
                    .filter(m => m.name)
            }""")
            return {
                "url": page.url,
                "title": await page.title(),
                "status": response.status if response else None,
                "link_count": len(links),
                "links": links,
                "meta": meta,
            }
        finally:
            await context.close()

    async def close(self) -> None:
        if self._browser:
            await self._browser.close()
            self._browser = None
        if self._pw:
            await self._pw.stop()
            self._pw = None
