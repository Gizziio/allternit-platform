#!/usr/bin/env python3
"""
Autonomous.ai office/furniture/pod scraper.

Fetches the Autonomous.ai office section, product pages, and discovered internal
links, then saves each page as Markdown with an index.json mapping file.

Usage:
    python3 scraper.py
"""

import json
import os
import re
import time
from datetime import datetime, timezone
from urllib.parse import urljoin, urlparse

import html2text
import requests
from bs4 import BeautifulSoup

BASE_URL = "https://www.autonomous.ai"
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "markdown")
INDEX_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "index.json")

# Seed URLs that cover the office/furniture/pod catalog.
SEED_URLS = [
    "https://www.autonomous.ai/office",
    "https://www.autonomous.ai/products",
    "https://www.autonomous.ai/adus",
    "https://www.autonomous.ai/adus/autonomous-work-pod",
    "https://www.autonomous.ai/adus/workpod-versatile",
    "https://www.autonomous.ai/adus/workpod-mini",
    "https://www.autonomous.ai/office-chairs",
    "https://www.autonomous.ai/office-chairs/ergonomic-chair",
    "https://www.autonomous.ai/office-chairs/autonomous-chair-ultra-v2",
    "https://www.autonomous.ai/office-chairs/ergochair-core",
    "https://www.autonomous.ai/standing-desks",
    "https://www.autonomous.ai/standing-desks/desk-5-pro",
    "https://www.autonomous.ai/standing-desks/autonomous-desk-eureka",
    "https://www.autonomous.ai/standing-desks/autonomous-desk-levitate",
    "https://www.autonomous.ai/thinking-desk",
    "https://www.autonomous.ai/brand-facts.html",
    "https://www.autonomous.ai/ourblog/ergochair-pro-vs-ultra-2",
    "https://www.autonomous.ai/ourblog/15-privacy-pods-and-booths",
    "https://www.autonomous.ai/ourblog/adus-without-permits",
]

# Maximum number of extra discovered links to crawl.
MAX_DISCOVERED = 30
REQUEST_DELAY_SECONDS = 2.0

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
    ),
    "Accept": (
        "text/html,application/xhtml+xml,application/xml;q=0.9,"
        "image/avif,image/webp,image/apng,*/*;q=0.8"
    ),
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
}


def sanitize_text(text: str) -> str:
    """Ensure text is valid UTF-8 and free of stray control characters."""
    # Encode/decode to drop surrogate pairs and invalid bytes.
    text = text.encode("utf-8", errors="ignore").decode("utf-8")
    # Remove null bytes and other disallowed control characters.
    cleaned = []
    for ch in text:
        code = ord(ch)
        if code == 0:
            continue
        if code < 32 and code not in (9, 10, 13):
            continue
        cleaned.append(ch)
    return "".join(cleaned)


def sanitize_filename(url: str) -> str:
    """Convert URL path into a filesystem-safe markdown filename."""
    parsed = urlparse(url)
    path = parsed.path.strip("/")
    if not path:
        return "index.md"
    # Remove file extensions and collapse non-alphanumerics to hyphens.
    path = re.sub(r"\.html?$", "", path, flags=re.IGNORECASE)
    safe = re.sub(r"[^a-zA-Z0-9_/-]+", "-", path).strip("-/_")
    safe = re.sub(r"-+", "-", safe)
    return safe.replace("/", "-") + ".md"


def extract_title(soup: BeautifulSoup, url: str) -> str:
    """Extract a readable page title."""
    if soup.title:
        title_text = soup.title.get_text(strip=True)
        if title_text:
            return title_text
    h1 = soup.find("h1")
    if h1:
        return h1.get_text(strip=True)
    return urlparse(url).path.strip("/") or "Home"


def html_to_markdown(html: str, url: str) -> str:
    """Convert HTML to Markdown, keeping links absolute."""
    soup = BeautifulSoup(html, "html.parser")

    # Remove script/style/noscript to keep output clean.
    for tag in soup(["script", "style", "noscript"]):
        tag.decompose()

    # Rewrite relative links to absolute.
    for tag in soup.find_all(["a", "img", "link"]):
        attr = "href" if tag.name in ("a", "link") else "src"
        value = tag.get(attr)
        if value:
            tag[attr] = urljoin(url, value)

    converter = html2text.HTML2Text()
    converter.ignore_links = False
    converter.ignore_images = False
    converter.wrap_links = False
    converter.body_width = 0
    converter.protect_links = True
    converter.mark_code = True

    markdown = converter.handle(str(soup))
    return markdown


def discover_links(html: str, base_url: str) -> set:
    """Find internal Autonomous.ai links worth following."""
    soup = BeautifulSoup(html, "html.parser")
    found = set()
    for tag in soup.find_all("a", href=True):
        href = tag["href"].strip()
        if not href or href.startswith(("#", "javascript:", "mailto:", "tel:")):
            continue
        absolute = urljoin(base_url, href)
        parsed = urlparse(absolute)
        if parsed.netloc not in ("www.autonomous.ai", "autonomous.ai"):
            continue
        # Focus on product/catalog/help content.
        path = parsed.path.lower()
        if any(
            path.startswith(p)
            for p in (
                "/office",
                "/products",
                "/adus",
                "/office-chairs",
                "/standing-desks",
                "/thinking-desk",
                "/desk-accessories",
                "/accessories",
                "/ourblog/",
                "/brand-facts",
            )
        ):
            # Drop query params and fragments for deduplication.
            clean = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
            found.add(clean)
    return found


def fetch_page(url: str) -> dict:
    """Fetch a single URL and return metadata + markdown content."""
    print(f"Fetching {url} ...")
    response = requests.get(url, headers=HEADERS, timeout=60)
    response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")
    title = extract_title(soup, url)
    markdown = html_to_markdown(response.text, url)

    return {
        "url": url,
        "title": title,
        "markdown": markdown,
        "status_code": response.status_code,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    to_crawl = list(dict.fromkeys(SEED_URLS))  # preserve order, dedupe
    crawled = {}
    discovered = set()

    while to_crawl:
        url = to_crawl.pop(0)
        if url in crawled:
            continue

        try:
            page = fetch_page(url)
        except Exception as exc:
            print(f"  ERROR fetching {url}: {exc}")
            crawled[url] = {
                "url": url,
                "title": "ERROR",
                "filename": None,
                "status_code": None,
                "error": str(exc),
                "fetched_at": datetime.now(timezone.utc).isoformat(),
            }
            continue

        filename = sanitize_filename(url)
        filepath = os.path.join(OUTPUT_DIR, filename)

        # Avoid filename collisions by appending a counter.
        counter = 1
        original_filename = filename
        while os.path.exists(filepath):
            stem, ext = os.path.splitext(original_filename)
            filename = f"{stem}-{counter}{ext}"
            filepath = os.path.join(OUTPUT_DIR, filename)
            counter += 1

        with open(filepath, "w", encoding="utf-8") as f:
            f.write(sanitize_text(f"# {page['title']}\n\n"))
            f.write(sanitize_text(f"**Source:** {page['url']}\n\n"))
            f.write(sanitize_text(f"**Fetched:** {page['fetched_at']}\n\n"))
            f.write("---\n\n")
            f.write(sanitize_text(page["markdown"]))

        crawled[url] = {
            "url": page["url"],
            "title": page["title"],
            "filename": filename,
            "status_code": page["status_code"],
            "fetched_at": page["fetched_at"],
        }
        print(f"  saved {filename} ({len(page['markdown'])} chars)")

        # Discover new links if we have budget.
        if len(discovered) < MAX_DISCOVERED:
            links = discover_links(requests.get(url, headers=HEADERS, timeout=60).text, url)
            for link in links:
                if link not in crawled and link not in discovered:
                    discovered.add(link)
                    to_crawl.append(link)

        # Be respectful of rate limits.
        time.sleep(REQUEST_DELAY_SECONDS)

    # Write index.json
    index = {
        "scraper": {
            "base_url": BASE_URL,
            "output_dir": OUTPUT_DIR,
            "pages_crawled": len(crawled),
            "generated_at": datetime.now(timezone.utc).isoformat(),
        },
        "pages": list(crawled.values()),
    }
    with open(INDEX_PATH, "w", encoding="utf-8") as f:
        json.dump(index, f, indent=2, ensure_ascii=False)

    print(f"\nDone. Crawled {len(crawled)} pages. Index: {INDEX_PATH}")


if __name__ == "__main__":
    main()
