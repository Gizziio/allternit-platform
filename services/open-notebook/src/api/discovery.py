"""
Live discovery feed aggregator.
Pulls from Reddit (RSS), Hacker News (official API), and ArXiv (API).
No API keys required.
"""

import asyncio
from typing import List, Dict, Any, Optional
from datetime import datetime
from fastapi import APIRouter
import httpx

from core.reddit_rss import fetch_subreddit

router = APIRouter(prefix="/api/discovery", tags=["discovery"])


# ── Hacker News ─────────────────────────────────────────────────────────────

HN_API_BASE = "https://hacker-news.firebaseio.com/v0"


async def _fetch_hn_story(story_id: int) -> Optional[Dict[str, Any]]:
    """Fetch a single HN story by ID."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.get(f"{HN_API_BASE}/item/{story_id}.json")
            if res.status_code == 200:
                data = res.json()
                if data and data.get("type") == "story" and not data.get("deleted"):
                    return {
                        "id": f"hn-{story_id}",
                        "title": data.get("title", "Untitled"),
                        "url": data.get("url") or f"https://news.ycombinator.com/item?id={story_id}",
                        "content": data.get("text", "")[:500],
                        "published_at": datetime.utcfromtimestamp(data.get("time", 0)).isoformat() if data.get("time") else None,
                        "author": data.get("by", ""),
                        "score": data.get("score", 0),
                        "comment_count": len(data.get("kids", [])),
                        "source": "hackernews",
                    }
    except Exception as e:
        print(f"[Discovery] HN story {story_id} failed: {e}")
    return None


async def fetch_hn_frontpage(limit: int = 15) -> List[Dict[str, Any]]:
    """Fetch HN front page stories."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.get(f"{HN_API_BASE}/topstories.json")
            if res.status_code != 200:
                return []
            story_ids = res.json()[:limit * 2]  # Fetch extra in case some fail

        # Fetch stories concurrently
        stories = await asyncio.gather(*[_fetch_hn_story(sid) for sid in story_ids])
        results = [s for s in stories if s is not None]
        return results[:limit]
    except Exception as e:
        print(f"[Discovery] HN fetch failed: {e}")
        return []


# ── ArXiv ───────────────────────────────────────────────────────────────────

ARXIV_API = "http://export.arxiv.org/api/query"


async def fetch_arxiv_papers(category: str = "cs.AI", limit: int = 10) -> List[Dict[str, Any]]:
    """Fetch recent ArXiv papers by category."""
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.get(
                ARXIV_API,
                params={
                    "search_query": f"cat:{category}",
                    "sortBy": "submittedDate",
                    "sortOrder": "descending",
                    "max_results": limit,
                },
            )
            if res.status_code != 200:
                return []

        import xml.etree.ElementTree as ET

        ns = {"atom": "http://www.w3.org/2005/Atom", "arxiv": "http://arxiv.org/schemas/atom"}
        items = []
        try:
            root = ET.fromstring(res.text)
            for entry in root.findall("atom:entry", ns):
                title = entry.findtext("atom:title", "", ns).replace("\n", " ").strip()
                summary = entry.findtext("atom:summary", "", ns).replace("\n", " ").strip()
                link_el = entry.find("atom:link[@title='pdf']", ns)
                if link_el is None:
                    link_el = entry.find("atom:link", ns)
                url = link_el.get("href") if link_el is not None else ""
                published = entry.findtext("atom:published", "", ns)
                authors = [a.text for a in entry.findall("atom:author/atom:name", ns) if a.text]
                categories = [c.get("term", "") for c in entry.findall("atom:category", ns)]

                items.append({
                    "id": f"arxiv-{entry.findtext('atom:id', '', ns).split('/')[-1]}",
                    "title": title,
                    "url": url,
                    "content": summary[:500],
                    "published_at": published,
                    "author": ", ".join(authors[:3]),
                    "categories": categories,
                    "source": "arxiv",
                })
        except ET.ParseError as e:
            print(f"[Discovery] ArXiv XML parse error: {e}")

        return items
    except Exception as e:
        print(f"[Discovery] ArXiv fetch failed: {e}")
        return []


# ── Unified Feed ────────────────────────────────────────────────────────────

@router.get("/live")
async def discovery_live(
    sources: str = "all",  # comma-separated: all, reddit, hackernews, arxiv
    limit: int = 20,
):
    """
    Aggregate live discovery feed from multiple free sources.
    No API keys required.
    """
    requested = {s.strip().lower() for s in sources.split(",")}
    include_all = "all" in requested

    tasks = []
    labels = []

    if include_all or "reddit" in requested:
        tasks.append(fetch_subreddit("programming", sort="hot", limit=min(limit, 10)))
        labels.append("reddit")
    if include_all or "hackernews" in requested:
        tasks.append(fetch_hn_frontpage(limit=min(limit, 15)))
        labels.append("hackernews")
    if include_all or "arxiv" in requested:
        tasks.append(fetch_arxiv_papers(category="cs.AI", limit=min(limit, 10)))
        labels.append("arxiv")

    results = await asyncio.gather(*tasks, return_exceptions=True)

    all_items = []
    for label, result in zip(labels, results):
        if isinstance(result, Exception):
            print(f"[Discovery] {label} error: {result}")
            continue
        for item in result:
            all_items.append({
                "id": item["id"],
                "title": item["title"],
                "url": item["url"],
                "content": item.get("content", ""),
                "published_at": item.get("published_at"),
                "author": item.get("author", ""),
                "source": label,
                "metadata": {k: v for k, v in item.items() if k not in ("id", "title", "url", "content", "published_at", "author", "source")},
            })

    # Sort by published date (newest first), fallback to keeping source order
    def sort_key(item):
        ts = item.get("published_at")
        if ts:
            try:
                return datetime.fromisoformat(ts.replace("Z", "+00:00")).timestamp()
            except Exception:
                pass
        return 0

    all_items.sort(key=sort_key, reverse=True)

    return {
        "items": all_items[:limit],
        "sources": labels,
        "count": len(all_items),
    }
