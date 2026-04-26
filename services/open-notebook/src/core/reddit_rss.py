"""
Reddit RSS fetcher.
Reddit's native API blocks most clients with 403, but their RSS feeds (.rss)
work fine with a proper browser User-Agent header.
"""

import re
import html
from typing import List, Dict, Any, Optional
from datetime import datetime
import httpx

BROWSER_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36"
)


def _strip_html(raw: str) -> str:
    text = re.sub(r"<[^>]+>", " ", raw)
    text = html.unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def _parse_rss_date(date_str: str) -> Optional[str]:
    """Parse RSS/Atom date formats to ISO."""
    formats = [
        "%a, %d %b %Y %H:%M:%S %z",
        "%a, %d %b %Y %H:%M:%S GMT",
        "%Y-%m-%dT%H:%M:%S%z",
        "%Y-%m-%dT%H:%M:%SZ",
    ]
    for fmt in formats:
        try:
            dt = datetime.strptime(date_str, fmt)
            return dt.isoformat()
        except ValueError:
            continue
    return None


def _extract_atom_items(xml_text: str) -> List[Dict[str, Any]]:
    """Extract items from Atom RSS XML (Reddit uses Atom format)."""
    import xml.etree.ElementTree as ET

    items = []
    ns = {"atom": "http://www.w3.org/2005/Atom"}
    try:
        root = ET.fromstring(xml_text)
        for entry in root.findall("atom:entry", ns):
            title = entry.findtext("atom:title", "", ns)
            link_el = entry.find("atom:link", ns)
            link = link_el.get("href") if link_el is not None else ""
            content = entry.findtext("atom:content", "", ns)
            if not content:
                content = entry.findtext("atom:summary", "", ns)
            pub_date = entry.findtext("atom:updated", "", ns)
            if not pub_date:
                pub_date = entry.findtext("atom:published", "", ns)
            author_el = entry.find("atom:author/atom:name", ns)
            author = author_el.text if author_el is not None else ""

            # Extract thumbnail from media:content if present
            thumb = ""
            media_content = entry.find("media:content", {"media": "http://search.yahoo.com/mrss/"})
            if media_content is not None:
                thumb = media_content.get("url", "")

            items.append({
                "title": _strip_html(title),
                "url": link,
                "content": _strip_html(content)[:500],
                "published_at": _parse_rss_date(pub_date) if pub_date else None,
                "author": author.replace("/u/", ""),
                "thumbnail": thumb,
                "source": "reddit",
            })
    except ET.ParseError as e:
        print(f"[RedditRSS] XML parse error: {e}")
    return items


async def fetch_subreddit(
    subreddit: str,
    sort: str = "hot",
    limit: int = 20,
) -> List[Dict[str, Any]]:
    """
    Fetch a subreddit via Reddit's native RSS feed.
    sort: hot, new, top, rising
    """
    url = f"https://www.reddit.com/r/{subreddit}/.rss"
    if sort != "hot":
        url = f"https://www.reddit.com/r/{subreddit}/{sort}/.rss"

    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            res = await client.get(url, headers={"User-Agent": BROWSER_USER_AGENT})
            if res.status_code == 200:
                items = _extract_atom_items(res.text)
                return items[:limit]
            elif res.status_code == 429:
                print(f"[RedditRSS] Rate limited by Reddit for r/{subreddit}")
            else:
                print(f"[RedditRSS] Reddit returned {res.status_code} for r/{subreddit}")
    except Exception as e:
        print(f"[RedditRSS] Failed to fetch r/{subreddit}: {e}")

    return []


async def fetch_user_posts(
    username: str,
    limit: int = 20,
) -> List[Dict[str, Any]]:
    """Fetch a Reddit user's posts via RSS."""
    url = f"https://www.reddit.com/user/{username}/.rss"

    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            res = await client.get(url, headers={"User-Agent": BROWSER_USER_AGENT})
            if res.status_code == 200:
                items = _extract_atom_items(res.text)
                return items[:limit]
            elif res.status_code == 429:
                print(f"[RedditRSS] Rate limited by Reddit for u/{username}")
            else:
                print(f"[RedditRSS] Reddit returned {res.status_code} for u/{username}")
    except Exception as e:
        print(f"[RedditRSS] Failed to fetch u/{username}: {e}")

    return []
