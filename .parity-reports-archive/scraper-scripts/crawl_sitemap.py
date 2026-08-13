#!/usr/bin/env python3
"""
Fetch every Anthropic docs page from the sitemap and save as Markdown.
Sitemap URL: https://platform.claude.com/docs/sitemap.xml
"""

import asyncio
import json
import os
import re
import time
import xml.etree.ElementTree as ET
from urllib.parse import urlparse

import aiohttp
from crawl4ai import AsyncWebCrawler, CrawlerRunConfig, BrowserConfig


SITEMAP_URL = "https://platform.claude.com/docs/sitemap.xml"
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "markdown")
INDEX_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "index.json")

# Concurrency and politeness.
CONCURRENCY = 5
RETRY_LIMIT = 2


def safe_filename(url: str) -> str:
    parsed = urlparse(url)
    host = parsed.netloc.replace(".", "-")
    path = parsed.path.strip("/") or "index"
    path = re.sub(r"[^a-zA-Z0-9_\-/]", "-", path).replace("/", "--")
    if len(path) > 180:
        path = path[:180]
    return f"{host}--{path}.md"


def is_docs_url(url: str) -> bool:
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        return False
    if parsed.netloc != "platform.claude.com":
        return False
    return parsed.path.startswith("/docs/")


async def fetch_sitemap(session: aiohttp.ClientSession) -> list[str]:
    async with session.get(SITEMAP_URL, timeout=aiohttp.ClientTimeout(total=60)) as resp:
        text = await resp.text()
    root = ET.fromstring(text)
    # Sitemap namespace.
    ns = {"ns": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    urls = [loc.text for loc in root.findall(".//ns:loc", ns) if loc.text]
    docs_urls = [u for u in urls if is_docs_url(u)]
    # Deduplicate and sort for determinism.
    docs_urls = sorted(set(docs_urls))
    return docs_urls


async def fetch_one(
    crawler: AsyncWebCrawler,
    url: str,
    semaphore: asyncio.Semaphore,
) -> dict | None:
    async with semaphore:
        for attempt in range(RETRY_LIMIT):
            try:
                result = await crawler.arun(url)
                markdown = getattr(result, "markdown", "") or ""
                metadata = getattr(result, "metadata", {}) or {}
                title = metadata.get("title", "") if isinstance(metadata, dict) else ""
                if not title:
                    title = getattr(result, "title", "")
                return {
                    "url": url,
                    "title": title,
                    "markdown": markdown,
                    "ok": True,
                }
            except Exception as e:
                if attempt == RETRY_LIMIT - 1:
                    return {"url": url, "title": "", "markdown": "", "ok": False, "error": str(e)}
                await asyncio.sleep(1)


async def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    async with aiohttp.ClientSession() as session:
        urls = await fetch_sitemap(session)

    print(f"Found {len(urls)} docs URLs in sitemap")

    browser_config = BrowserConfig(
        headless=True,
        browser_type="chromium",
        text_mode=True,
    )
    crawl_config = CrawlerRunConfig(
        excluded_tags=["nav", "footer", "aside", "header"],
        verbose=False,
    )

    start_time = time.time()
    index = []
    failed = []
    semaphore = asyncio.Semaphore(CONCURRENCY)

    async with AsyncWebCrawler(config=browser_config) as crawler:
        tasks = [fetch_one(crawler, url, semaphore) for url in urls]
        for i, coro in enumerate(asyncio.as_completed(tasks)):
            result = await coro
            if result is None:
                continue

            url = result["url"]
            if not result["ok"]:
                failed.append({"url": url, "error": result.get("error", "unknown")})
                print(f"[FAIL] {url}")
                continue

            markdown = result["markdown"]
            title = result["title"]
            filename = safe_filename(url)
            filepath = os.path.join(OUTPUT_DIR, filename)

            # Avoid collisions.
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

            if (i + 1) % 50 == 0 or (i + 1) == len(urls):
                elapsed = round(time.time() - start_time, 2)
                print(f"[{i+1}/{len(urls)}] {url} -> {os.path.basename(filepath)} ({len(markdown)} chars) [{elapsed}s]")

    # Save index.
    with open(INDEX_PATH, "w", encoding="utf-8") as f:
        json.dump({
            "sitemap_url": SITEMAP_URL,
            "pages_crawled": len(index),
            "pages_failed": len(failed),
            "duration_seconds": round(time.time() - start_time, 2),
            "pages": index,
            "failed": failed,
        }, f, indent=2, ensure_ascii=False)

    print(f"\nDone. Saved {len(index)} pages, {len(failed)} failed.")
    print(f"Index: {INDEX_PATH}")
    print(f"Markdown: {OUTPUT_DIR}")


if __name__ == "__main__":
    asyncio.run(main())
