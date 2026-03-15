"""
A2R Computer Use — Retrieval Family Adapter
HTTP-based content retrieval: fetch, scrape, search, download.
No browser required — pure async HTTP via httpx/requests.
"""

import asyncio
import base64
import json
import mimetypes
import os
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse, quote_plus

from core import BaseAdapter, ActionRequest, ResultEnvelope, Receipt, Artifact


class RetrievalAdapter(BaseAdapter):
    """
    Retrieval adapter — fetches content from URLs using async HTTP.

    Supported action_type values:
      fetch        — GET a URL, return text/html/json
      scrape       — GET a URL, extract visible text (strip tags)
      search       — Query a search engine and return result links/snippets
      download     — GET a URL binary, save to artifact path
      head         — HEAD request, return headers/status
      post         — POST JSON body to a URL, return response
      observe      — fetch + extract text + screenshot_b64 placeholder (for VisionLoop)
    """

    def __init__(self):
        self._session = None

    @property
    def adapter_id(self) -> str:
        return "retrieval.http"

    @property
    def family(self) -> str:
        return "retrieval"

    async def initialize(self) -> None:
        """No persistent state needed — httpx client is created per-request."""
        pass

    async def close(self) -> None:
        if self._session is not None:
            await self._session.aclose()
            self._session = None

    async def _get_client(self):
        try:
            import httpx
            return httpx.AsyncClient(
                timeout=30.0,
                follow_redirects=True,
                verify=False,  # avoids macOS Homebrew Python SSL cert chain issues in dev
                headers={
                    "User-Agent": (
                        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                        "AppleWebKit/537.36 (KHTML, like Gecko) "
                        "Chrome/120.0.0.0 Safari/537.36"
                    )
                },
            )
        except ImportError:
            raise RuntimeError("httpx not installed. Run: pip install httpx")

    def _strip_tags(self, html: str) -> str:
        """Simple HTML tag stripper — no external deps."""
        import re
        # Remove script/style blocks
        html = re.sub(r"<(script|style)[^>]*>.*?</(script|style)>", " ", html, flags=re.DOTALL | re.IGNORECASE)
        # Remove all remaining tags
        html = re.sub(r"<[^>]+>", " ", html)
        # Collapse whitespace
        html = re.sub(r"\s+", " ", html).strip()
        return html

    def _extract_links(self, html: str, base_url: str) -> List[Dict[str, str]]:
        """Extract href links from HTML."""
        import re
        from urllib.parse import urljoin
        links = []
        for m in re.finditer(r'<a[^>]+href=["\']([^"\']+)["\'][^>]*>(.*?)</a>', html, re.DOTALL | re.IGNORECASE):
            href = m.group(1).strip()
            text = re.sub(r"<[^>]+>", "", m.group(2)).strip()
            if href.startswith(("http", "/", "#")):
                full = urljoin(base_url, href)
                links.append({"url": full, "text": text[:200]})
        return links[:50]

    def _parse_search_results(self, html: str, base_url: str) -> List[Dict[str, str]]:
        """Parse search engine results from HTML (DuckDuckGo / Google / Bing heuristic)."""
        import re
        results = []
        # DuckDuckGo: result__a class links
        for m in re.finditer(
            r'<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>(.*?)</a>',
            html, re.DOTALL | re.IGNORECASE
        ):
            url = m.group(1).strip()
            title = re.sub(r"<[^>]+>", "", m.group(2)).strip()
            results.append({"url": url, "title": title, "snippet": ""})

        # Google: /url?q= redirects
        if not results:
            for m in re.finditer(r'/url\?q=([^&"]+)', html):
                from urllib.parse import unquote
                url = unquote(m.group(1))
                if url.startswith("http") and "google.com" not in url:
                    results.append({"url": url, "title": "", "snippet": ""})

        # Bing: b_algo class
        if not results:
            for m in re.finditer(
                r'<h2><a[^>]+href="([^"]+)"[^>]*>(.*?)</a>',
                html, re.DOTALL | re.IGNORECASE
            ):
                url = m.group(1).strip()
                title = re.sub(r"<[^>]+>", "", m.group(2)).strip()
                if url.startswith("http"):
                    results.append({"url": url, "title": title, "snippet": ""})

        return results[:10]

    async def execute(self, action: ActionRequest, session_id: str, run_id: str) -> ResultEnvelope:
        envelope = self._make_envelope(action, session_id, run_id)
        result_data: Dict[str, Any] = {}

        try:
            async with await self._get_client() as client:
                atype = action.action_type
                url = action.target or action.parameters.get("url", "")

                if atype == "fetch":
                    resp = await client.get(url, timeout=action.timeout_ms / 1000)
                    content_type = resp.headers.get("content-type", "")
                    body = resp.text
                    parsed = None
                    if "json" in content_type:
                        try:
                            parsed = resp.json()
                        except Exception:
                            pass
                    result_data = {
                        "url": str(resp.url),
                        "status_code": resp.status_code,
                        "content_type": content_type,
                        "body": body,
                        "json": parsed,
                        "size": len(resp.content),
                    }
                    envelope.extracted_content = result_data

                elif atype == "scrape":
                    resp = await client.get(url, timeout=action.timeout_ms / 1000)
                    html = resp.text
                    text = self._strip_tags(html)
                    links = self._extract_links(html, str(resp.url))
                    result_data = {
                        "url": str(resp.url),
                        "status_code": resp.status_code,
                        "text": text,
                        "links": links,
                        "html_size": len(html),
                    }
                    envelope.extracted_content = result_data

                elif atype == "search":
                    query = action.parameters.get("query") or url
                    engine = action.parameters.get("engine", "duckduckgo").lower()
                    search_urls = {
                        "duckduckgo": f"https://duckduckgo.com/html/?q={quote_plus(query)}",
                        "google": f"https://www.google.com/search?q={quote_plus(query)}",
                        "bing": f"https://www.bing.com/search?q={quote_plus(query)}",
                    }
                    search_url = search_urls.get(engine, search_urls["duckduckgo"])
                    resp = await client.get(search_url, timeout=action.timeout_ms / 1000)
                    results = self._parse_search_results(resp.text, search_url)
                    result_data = {
                        "query": query,
                        "engine": engine,
                        "results": results,
                        "result_count": len(results),
                        "url": search_url,
                        "status_code": resp.status_code,
                    }
                    envelope.extracted_content = result_data

                elif atype == "download":
                    resp = await client.get(url, timeout=action.timeout_ms / 1000)
                    content_type = resp.headers.get("content-type", "application/octet-stream")
                    b64 = base64.b64encode(resp.content).decode("utf-8")
                    fname = Path(urlparse(url).path).name or "download"
                    artifact = Artifact(
                        type="file",
                        path=f"downloads/{run_id}/{fname}",
                        size_bytes=len(resp.content),
                        media_type=content_type,
                    )
                    envelope.artifacts.append(artifact)
                    result_data = {
                        "url": str(resp.url),
                        "status_code": resp.status_code,
                        "content_type": content_type,
                        "size": len(resp.content),
                        "filename": fname,
                        "content_b64": b64,
                    }
                    envelope.extracted_content = result_data

                elif atype == "head":
                    resp = await client.head(url, timeout=action.timeout_ms / 1000)
                    result_data = {
                        "url": str(resp.url),
                        "status_code": resp.status_code,
                        "headers": dict(resp.headers),
                        "content_type": resp.headers.get("content-type", ""),
                        "content_length": resp.headers.get("content-length"),
                    }
                    envelope.extracted_content = result_data

                elif atype == "post":
                    body = action.parameters.get("body") or action.parameters.get("json")
                    headers = action.parameters.get("headers", {})
                    if isinstance(body, dict):
                        resp = await client.post(url, json=body, headers=headers, timeout=action.timeout_ms / 1000)
                    else:
                        resp = await client.post(url, content=body or "", headers=headers, timeout=action.timeout_ms / 1000)
                    content_type = resp.headers.get("content-type", "")
                    parsed_json = None
                    if "json" in content_type:
                        try:
                            parsed_json = resp.json()
                        except Exception:
                            pass
                    result_data = {
                        "url": str(resp.url),
                        "status_code": resp.status_code,
                        "content_type": content_type,
                        "body": resp.text,
                        "json": parsed_json,
                    }
                    envelope.extracted_content = result_data

                elif atype == "observe":
                    # VisionLoop compat: fetch page, extract text, no screenshot (HTTP-only)
                    resp = await client.get(url, timeout=action.timeout_ms / 1000)
                    html = resp.text
                    text = self._strip_tags(html)
                    links = self._extract_links(html, str(resp.url))
                    result_data = {
                        "url": str(resp.url),
                        "status_code": resp.status_code,
                        "text": text,
                        "links": links,
                        "screenshot_b64": "",  # no visual — retrieval adapter is headless HTTP
                        "elements": links,
                    }
                    envelope.extracted_content = result_data

                else:
                    # Unknown action — fall back to fetch
                    resp = await client.get(url, timeout=action.timeout_ms / 1000)
                    result_data = {
                        "url": str(resp.url),
                        "status_code": resp.status_code,
                        "body": resp.text,
                        "note": f"Unknown action '{atype}', defaulted to fetch",
                    }
                    envelope.extracted_content = result_data

            envelope.status = "completed"
            envelope.completed_at = datetime.utcnow().isoformat()
            self._emit_receipt(envelope, action, result_data)

        except Exception as e:
            envelope.status = "failed"
            envelope.error = {
                "code": "RETRIEVAL_ERROR",
                "message": str(e),
                "adapter_id": self.adapter_id,
            }
            envelope.completed_at = datetime.utcnow().isoformat()

        return envelope

    async def close(self) -> None:
        pass
