"""
Allternit Computer Use — Retrieval Adapter

Crawls URLs with Playwright and extracts structured content without running a
full LLM planning loop. Low-risk, read-only family for data gathering tasks.

Supported actions:
  crawl            — fetch URL, extract title/text/links; follow links up to
                     max_depth levels, visiting at most max_pages pages total
  extract_links    — return all <a href> from a page as [{text, url, is_external}]
  extract_structured — return {title, headings, paragraphs, tables, lists}
  search_page      — find all text matches on page, return [{match, context, position}]
"""

from __future__ import annotations

import asyncio
import logging
import os
import re
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional
from urllib.parse import urljoin, urlparse

from core import BaseAdapter, ActionRequest, ResultEnvelope, Artifact

logger = logging.getLogger(__name__)


class RetrievalAdapter(BaseAdapter):
    """Playwright-backed retrieval adapter for crawling and extracting web content."""

    ADAPTER_ID = "browser.retrieval"

    def __init__(self) -> None:
        self._pw = None
        self._browser = None

    # ── BaseAdapter interface ─────────────────────────────────────────────────

    @property
    def adapter_id(self) -> str:
        return self.ADAPTER_ID

    @property
    def family(self) -> str:
        return "retrieval"

    async def initialize(self) -> None:
        """Launch headless Chromium."""
        try:
            from playwright.async_api import async_playwright
            self._pw = await async_playwright().start()
            self._browser = await self._pw.chromium.launch(
                headless=os.getenv("BROWSER_HEADLESS", "true").lower() == "true",
                args=["--no-sandbox", "--disable-dev-shm-usage"],
            )
        except ImportError:
            raise RuntimeError(
                "Playwright not installed. Run: pip install playwright && playwright install chromium"
            )

    async def execute(self, action: ActionRequest, session_id: str, run_id: str) -> ResultEnvelope:
        envelope = self._make_envelope(action, session_id, run_id, mode="crawl")

        try:
            if not self._browser:
                await self.initialize()

            action_type = action.action_type
            result_data: Any = None

            if action_type == "crawl":
                result_data = await self._action_crawl(action)
            elif action_type in ("goto", "extract"):
                result_data = await self._fetch_page(action.target)
            elif action_type == "observe":
                result_data = await self._action_observe(action)
            elif action_type == "extract_links":
                result_data = await self._action_extract_links(action)
            elif action_type == "extract_structured":
                result_data = await self._action_extract_structured(action)
            elif action_type == "search_page":
                result_data = await self._action_search_page(action)
            else:
                raise ValueError(
                    f"RetrievalAdapter does not support action '{action_type}'. "
                    f"Supported: crawl, goto, observe, extract, extract_links, extract_structured, search_page."
                )

            envelope.status = "completed"
            envelope.extracted_content = result_data
            envelope.completed_at = datetime.utcnow().isoformat()
            self._emit_receipt(envelope, action, result_data if isinstance(result_data, dict) else {})

        except Exception as exc:
            envelope.status = "failed"
            envelope.error = {
                "code": "RETRIEVAL_ERROR",
                "message": str(exc),
                "adapter_id": self.ADAPTER_ID,
            }
            envelope.completed_at = datetime.utcnow().isoformat()

        return envelope

    async def close(self) -> None:
        if self._browser:
            await self._browser.close()
            self._browser = None
        if self._pw:
            await self._pw.stop()
            self._pw = None

    # ── Action implementations ────────────────────────────────────────────────

    async def _action_crawl(self, action: ActionRequest) -> Dict[str, Any]:
        """
        Fetch action.target URL, extract title + all text + all links.
        Follow links up to max_depth levels, visiting at most max_pages pages.
        """
        start_url: str = action.target
        max_depth: int = int(action.parameters.get("max_depth", 1))
        max_pages: int = int(action.parameters.get("max_pages", 10))

        visited: Dict[str, Dict] = {}
        queue: List[tuple[str, int]] = [(start_url, 0)]
        start_origin = urlparse(start_url).netloc

        while queue and len(visited) < max_pages:
            url, depth = queue.pop(0)
            if url in visited:
                continue

            page_data = await self._fetch_page(url)
            visited[url] = {**page_data, "depth": depth}

            if depth < max_depth:
                for link in page_data.get("links", []):
                    href = link.get("url", "")
                    if href and href not in visited:
                        link_origin = urlparse(href).netloc
                        # Only follow same-origin links during crawl
                        if link_origin == start_origin or not link_origin:
                            queue.append((href, depth + 1))

        return {
            "start_url": start_url,
            "pages_visited": len(visited),
            "pages_crawled": len(visited),   # alias expected by conformance suite
            "max_depth": max_depth,
            "max_pages": max_pages,
            "pages": list(visited.values()),
        }

    async def _action_observe(self, action: ActionRequest) -> Dict[str, Any]:
        """Observe page metadata: url, title, link_count, heading_count, text_length."""
        page = await self._browser.new_page()
        try:
            await page.goto(action.target, timeout=action.timeout_ms, wait_until="domcontentloaded")
            meta: Dict = await page.evaluate(r"""() => ({
                url: location.href,
                title: document.title,
                link_count: document.querySelectorAll('a[href]').length,
                heading_count: document.querySelectorAll('h1,h2,h3,h4,h5,h6').length,
                text_length: (document.body ? document.body.innerText : '').length,
            })""")
            return meta
        finally:
            await page.close()

    async def _action_extract_links(self, action: ActionRequest) -> List[Dict[str, Any]]:
        """Return all <a href> from action.target as [{text, url, is_external}]."""
        page = await self._browser.new_page()
        try:
            await page.goto(action.target, timeout=action.timeout_ms, wait_until="domcontentloaded")
            base_origin = urlparse(page.url).netloc
            raw_links: List[Dict] = await page.evaluate(r"""() => {
                return Array.from(document.querySelectorAll('a[href]')).map(a => ({
                    text: (a.innerText || a.textContent || '').trim().slice(0, 200),
                    href: a.href,
                }));
            }""")
            result = []
            for lnk in raw_links:
                href = lnk.get("href", "")
                if not href or href.startswith("javascript:") or href.startswith("mailto:"):
                    continue
                link_origin = urlparse(href).netloc
                result.append({
                    "text": lnk.get("text", ""),
                    "url": href,
                    "is_external": bool(link_origin) and link_origin != base_origin,
                })
            return result
        finally:
            await page.close()

    async def _action_extract_structured(self, action: ActionRequest) -> Dict[str, Any]:
        """
        Return {title, headings: [], paragraphs: [], tables: [], lists: []} from page.
        """
        page = await self._browser.new_page()
        try:
            await page.goto(action.target, timeout=action.timeout_ms, wait_until="domcontentloaded")
            data: Dict = await page.evaluate(r"""() => {
                const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).map(h => ({
                    level: h.tagName.toLowerCase(),
                    text: h.innerText.trim().slice(0, 300),
                }));
                const paragraphs = Array.from(document.querySelectorAll('p')).map(p =>
                    p.innerText.trim()
                ).filter(t => t.length > 0).slice(0, 100);
                const tables = Array.from(document.querySelectorAll('table')).map(tbl => {
                    const rows = Array.from(tbl.querySelectorAll('tr')).map(tr =>
                        Array.from(tr.querySelectorAll('th, td')).map(c => c.innerText.trim())
                    );
                    return rows;
                }).slice(0, 10);
                const lists = Array.from(document.querySelectorAll('ul, ol')).map(lst => ({
                    type: lst.tagName.toLowerCase(),
                    items: Array.from(lst.querySelectorAll('li')).map(li =>
                        li.innerText.trim().slice(0, 200)
                    ).slice(0, 50),
                })).slice(0, 20);
                return {
                    title: document.title,
                    headings,
                    paragraphs,
                    tables,
                    lists,
                };
            }""")
            return data
        finally:
            await page.close()

    async def _action_search_page(self, action: ActionRequest) -> List[Dict[str, Any]]:
        """
        Find all text matches of action.parameters['query'] on action.target page.
        Returns [{match, context, position}].
        """
        query: str = action.parameters.get("query", "")
        if not query:
            raise ValueError("search_page requires a 'query' parameter")

        page = await self._browser.new_page()
        try:
            await page.goto(action.target, timeout=action.timeout_ms, wait_until="domcontentloaded")
            full_text: str = await page.evaluate("() => document.body ? document.body.innerText : ''")
        finally:
            await page.close()

        pattern = re.compile(re.escape(query), re.IGNORECASE)
        matches = []
        for m in pattern.finditer(full_text):
            start = max(0, m.start() - 80)
            end = min(len(full_text), m.end() + 80)
            context = full_text[start:end].replace("\n", " ").strip()
            matches.append({
                "match": m.group(0),
                "context": context,
                "position": m.start(),
            })

        return matches

    # ── Internal helpers ──────────────────────────────────────────────────────

    async def _fetch_page(self, url: str) -> Dict[str, Any]:
        """Fetch a single URL and return title, text, and links."""
        page = await self._browser.new_page()
        try:
            await page.goto(url, timeout=30000, wait_until="domcontentloaded")
            actual_url = page.url
            title = await page.title()
            text: str = await page.evaluate("() => document.body ? document.body.innerText : ''")
            raw_links: List[Dict] = await page.evaluate(r"""() => {
                return Array.from(document.querySelectorAll('a[href]')).map(a => ({
                    text: (a.innerText || '').trim().slice(0, 200),
                    href: a.href,
                }));
            }""")
            links = [
                {"text": lnk["text"], "url": lnk["href"]}
                for lnk in raw_links
                if lnk.get("href") and not lnk["href"].startswith("javascript:")
            ]
            return {
                "url": actual_url,
                "title": title,
                "text": text[:10000],  # cap per-page text to 10 KB
                "links": links,
            }
        except Exception as exc:
            return {"url": url, "error": str(exc), "title": "", "text": "", "links": []}
        finally:
            await page.close()
