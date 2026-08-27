#!/usr/bin/env python3
"""
Crawl Anthropic's docs site and save every page as Markdown.
Docs currently live on platform.claude.com/docs/ and docs.anthropic.com.
"""

import asyncio
import json
import os
import re
import time
from urllib.parse import urlparse

from crawl4ai import AsyncWebCrawler, CrawlerRunConfig, BrowserConfig
from crawl4ai.deep_crawling import BFSDeepCrawlStrategy


BASE_URL = "https://platform.claude.com/docs/"
# Anthropic docs are split across these two hosts.
ALLOWED_DOMAINS = {"docs.anthropic.com", "platform.claude.com"}
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "markdown")
INDEX_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "index.json")

# Be polite: limit concurrent pages and add a small delay.
MAX_DEPTH = 7
MAX_PAGES = 3000
DELAY_PER_PAGE = 0.3  # seconds


def safe_filename(url: str) -> str:
    """Convert a URL path into a safe filename."""
    parsed = urlparse(url)
    # Include host so docs from both domains don't collide.
    host = parsed.netloc.replace(".", "-")
    path = parsed.path.strip("/")
    if not path:
        path = "index"
    path = re.sub(r"[^a-zA-Z0-9_\-/]", "-", path)
    path = path.replace("/", "--")
    if len(path) > 180:
        path = path[:180]
    return f"{host}--{path}.md"


def is_internal_docs(url: str) -> bool:
    """Stay within Anthropic docs hosts. Skip non-doc pages on platform.claude.com."""
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        return False
    if parsed.netloc not in ALLOWED_DOMAINS:
        return False
    # On platform.claude.com we only want /docs/ paths.
    if parsed.netloc == "platform.claude.com" and not parsed.path.startswith("/docs/"):
        return False
    return True


async def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    browser_config = BrowserConfig(
        headless=True,
        browser_type="chromium",
        text_mode=True,
    )

    crawl_config = CrawlerRunConfig(
        deep_crawl_strategy=BFSDeepCrawlStrategy(
            max_depth=MAX_DEPTH,
            include_external=False,
            max_pages=MAX_PAGES,
        ),
        # Only extract the main article content, skip nav/footers when possible.
        only_text=False,
        excluded_tags=["nav", "footer", "aside", "header"],
        verbose=False,
        stream=False,
    )

    print(f"Starting crawl of {BASE_URL}")
    print(f"Output directory: {OUTPUT_DIR}")
    print(f"Max depth: {MAX_DEPTH}, max pages: {MAX_PAGES}")

    start_time = time.time()
    index = []
    seen_urls = set()
    page_count = 0

    async with AsyncWebCrawler(config=browser_config) as crawler:
        results = await crawler.arun(BASE_URL, config=crawl_config)

        # Handle both single result and iterable results.
        if not hasattr(results, "__iter__"):
            results = [results]

        for result in results:
            url = getattr(result, "url", None)
            if not url or url in seen_urls:
                continue
            if not is_internal_docs(url):
                continue

            seen_urls.add(url)
            page_count += 1

            markdown = getattr(result, "markdown", "") or ""
            metadata = getattr(result, "metadata", {}) or {}
            title = metadata.get("title", "") if isinstance(metadata, dict) else ""
            if not title:
                title = getattr(result, "title", "")

            filename = safe_filename(url)
            filepath = os.path.join(OUTPUT_DIR, filename)

            # Avoid overwriting collisions by appending a counter.
            counter = 1
            original_filepath = filepath
            while os.path.exists(filepath):
                base, ext = os.path.splitext(original_filepath)
                filepath = f"{base}_{counter}{ext}"
                counter += 1

            with open(filepath, "w", encoding="utf-8") as f:
                f.write(f"# {title}\n\n")
                f.write(f"**URL:** {url}\n\n")
                f.write(f"**Source:** Anthropic Documentation\n\n")
                f.write("---\n\n")
                f.write(markdown)

            index.append({
                "url": url,
                "title": title,
                "filename": os.path.basename(filepath),
                "chars": len(markdown),
            })

            print(f"[{page_count}] {url} -> {os.path.basename(filepath)}")

            if DELAY_PER_PAGE > 0:
                await asyncio.sleep(DELAY_PER_PAGE)

    # Save index.
    with open(INDEX_PATH, "w", encoding="utf-8") as f:
        json.dump({
            "base_url": BASE_URL,
            "pages_crawled": page_count,
            "duration_seconds": round(time.time() - start_time, 2),
            "pages": index,
        }, f, indent=2, ensure_ascii=False)

    print(f"\nDone. Crawled {page_count} pages in {round(time.time() - start_time, 2)}s")
    print(f"Index saved to: {INDEX_PATH}")
    print(f"Markdown files saved to: {OUTPUT_DIR}")


if __name__ == "__main__":
    asyncio.run(main())
