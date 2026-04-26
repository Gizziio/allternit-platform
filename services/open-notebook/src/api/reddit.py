"""
Reddit proxy via RSSHub.
Reddit's native API blocks most clients with 403. This uses RSSHub as a workaround.
"""

from typing import List, Dict, Any
from fastapi import APIRouter

from core.reddit_rss import fetch_subreddit, fetch_user_posts

router = APIRouter(prefix="/api/reddit", tags=["reddit"])


@router.get("/r/{subreddit}")
async def get_subreddit(subreddit: str, sort: str = "hot", limit: int = 20):
    """Fetch posts from a subreddit via RSSHub."""
    items = await fetch_subreddit(subreddit, sort=sort, limit=limit)
    return {"subreddit": subreddit, "sort": sort, "items": items}


@router.get("/user/{username}")
async def get_user_posts(username: str, limit: int = 20):
    """Fetch posts from a Reddit user via RSSHub."""
    items = await fetch_user_posts(username, limit=limit)
    return {"username": username, "items": items}
