"""
Discovery Briefing Generator
Transforms external live feeds into Allternit-style briefing publications.

Uses Allternit's LLM gateway when available, falls back to extractive summarization.
"""

from datetime import datetime
from typing import List, Dict, Any, Optional

from .reddit_rss import fetch_subreddit
from api.discovery import fetch_hn_frontpage, fetch_arxiv_papers
from .llm_proxy import llm


def _extract_key_sentence(text: str, max_len: int = 180) -> str:
    """Extract the first substantial sentence as a summary."""
    if not text:
        return ""
    sentences = text.replace("\n", " ").split(". ")
    for s in sentences:
        s = s.strip()
        if len(s) > 40 and len(s) <= max_len:
            return s + "."
        if len(s) > 40:
            return s[:max_len].rsplit(" ", 1)[0] + "..."
    return text[:max_len].rsplit(" ", 1)[0] + "..." if len(text) > max_len else text


async def _llm_summarize_briefing(sources_text: str, date_str: str) -> Optional[str]:
    """Use Allternit's LLM to generate an abstractive briefing."""
    try:
        system_prompt = (
            "You are Allternit Signal, a research intelligence curator. "
            "Write a concise daily AI/tech briefing in markdown. "
            "Group items by source (arXiv, Hacker News, Reddit). "
            "For each item: write a compelling 1-2 sentence summary, then the link. "
            "Skip meta threads, hiring posts, and self-promotion. "
            "Tone: sharp, technical, no fluff."
        )
        user_prompt = f"Write the Daily AI Brief for {date_str} from these sources:\n\n{sources_text}"

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]

        chunks = []
        async for chunk in llm.complete(messages, stream=False, temperature=0.4):
            chunks.append(chunk)

        return "".join(chunks).strip()
    except Exception as e:
        print(f"[BriefingGenerator] LLM failed, falling back: {e}")
        return None


def _build_sources_text(
    hn_items: List[Dict],
    reddit_items: List[Dict],
    arxiv_items: List[Dict],
) -> str:
    """Format raw sources into a plain-text prompt for the LLM."""
    lines = []

    if arxiv_items:
        lines.append("=== arXiv Papers ===")
        for item in arxiv_items[:5]:
            lines.append(f"Title: {item['title']}")
            lines.append(f"Authors: {item.get('author', 'Unknown')}")
            lines.append(f"Abstract: {item.get('content', '')[:300]}")
            lines.append(f"URL: {item['url']}")
            lines.append("")

    if hn_items:
        lines.append("=== Hacker News ===")
        for item in hn_items[:5]:
            lines.append(f"Title: {item['title']}")
            lines.append(f"URL: {item['url']}")
            if item.get('content'):
                lines.append(f"Text: {item['content'][:200]}")
            lines.append("")

    if reddit_items:
        lines.append("=== Reddit r/MachineLearning ===")
        for item in reddit_items[:5]:
            lines.append(f"Title: {item['title']}")
            lines.append(f"URL: {item['url']}")
            if item.get('content'):
                lines.append(f"Text: {item['content'][:200]}")
            lines.append("")

    return "\n".join(lines)


def _build_extractive_briefing(
    hn_items: List[Dict],
    reddit_items: List[Dict],
    arxiv_items: List[Dict],
) -> str:
    """Fallback: build briefing using extractive summarization (no LLM)."""
    sections = []

    if arxiv_items:
        sections.append("## Latest Research (arXiv)\n")
        for item in arxiv_items[:3]:
            summary = _extract_key_sentence(item.get("content", ""))
            sections.append(f"**{item['title']}** — {item.get('author', 'Unknown')}\n{summary}\n[{item['url']}]({item['url']})\n")

    if hn_items:
        sections.append("## Hacker News Front Page\n")
        for item in hn_items[:3]:
            summary = _extract_key_sentence(item.get("content", ""))
            score_info = f"{item.get('score', 0)} points"
            if item.get('comment_count'):
                score_info += f", {item['comment_count']} comments"
            sections.append(f"**{item['title']}** — {score_info}\n{summary}\n[{item['url']}]({item['url']})\n")

    if reddit_items:
        sections.append("## Reddit r/MachineLearning\n")
        for item in reddit_items[:3]:
            summary = _extract_key_sentence(item.get("content", ""))
            sections.append(f"**{item['title']}** — u/{item.get('author', 'unknown')}\n{summary}\n[{item['url']}]({item['url']})\n")

    return "\n".join(sections)


async def generate_daily_briefing() -> Dict[str, Any]:
    """
    Generate a daily AI/tech briefing from external sources.
    Tries Allternit LLM first, falls back to extractive summarization.
    Returns a Publication-like dict ready for the discovery feed.
    """
    now = datetime.utcnow()
    date_str = now.strftime("%B %d, %Y")
    iso_date = now.isoformat()

    # Fetch sources concurrently
    import asyncio
    hn_items, reddit_items, arxiv_items = await asyncio.gather(
        fetch_hn_frontpage(limit=5),
        fetch_subreddit("MachineLearning", sort="hot", limit=5),
        fetch_arxiv_papers(category="cs.AI", limit=5),
        return_exceptions=True,
    )

    # Filter out exceptions
    hn_items = [i for i in (hn_items if not isinstance(hn_items, Exception) else []) if isinstance(i, dict)]
    reddit_items = [i for i in (reddit_items if not isinstance(reddit_items, Exception) else []) if isinstance(i, dict)]
    arxiv_items = [i for i in (arxiv_items if not isinstance(arxiv_items, Exception) else []) if isinstance(i, dict)]

    # Filter meta threads from Reddit
    reddit_filtered = [
        i for i in reddit_items
        if not any(k in i.get("title", "").lower() for k in ["[d] self-promotion", "who's hiring", "weekly", "monthly", "moderator"])
    ]

    total_sources = len(arxiv_items) + len(hn_items) + len(reddit_filtered)

    # Try LLM first
    sources_text = _build_sources_text(hn_items, reddit_filtered, arxiv_items)
    llm_body = await _llm_summarize_briefing(sources_text, date_str)

    if llm_body:
        body = llm_body
        summary_method = "llm"
    else:
        body = _build_extractive_briefing(hn_items, reddit_filtered, arxiv_items)
        summary_method = "extractive"

    # Build abstract
    abstract_parts = []
    if arxiv_items:
        abstract_parts.append(f"{len(arxiv_items)} arXiv papers")
    if hn_items:
        abstract_parts.append(f"{len(hn_items)} HN stories")
    if reddit_filtered:
        abstract_parts.append(f"{len(reddit_filtered)} Reddit discussions")

    abstract = f"Daily curated intelligence for {date_str}. "
    if abstract_parts:
        abstract += "Featuring " + ", ".join(abstract_parts) + ". "
    abstract += "All sources linked for deep reading."

    return {
        "id": f"briefing-{now.strftime('%Y-%m-%d')}",
        "title": f"Daily AI Brief: {date_str}",
        "subtitle": "Allternit Signal · Curated Intelligence",
        "abstract": abstract,
        "content": {
            "body": body,
            "sources": {
                "arxiv": [{"t": i["title"], "u": i["url"]} for i in arxiv_items],
                "hackernews": [{"t": i["title"], "u": i["url"]} for i in hn_items],
                "reddit": [{"t": i["title"], "u": i["url"]} for i in reddit_filtered],
            },
            "summary_method": summary_method,
        },
        "reading_time": max(3, min(total_sources, 12)),
        "source_count": total_sources,
        "created_at": iso_date,
        "updated_at": iso_date,
    }
