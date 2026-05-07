"""
Discovery Briefing API
Generates and stores Allternit-style briefings from external live feeds.
"""

from datetime import datetime
from typing import List, Dict, Any
from fastapi import APIRouter, HTTPException

from db.surreal_client import db, extract_id
from core.briefing_generator import generate_daily_briefing

router = APIRouter(prefix="/api/discovery/briefings", tags=["briefings"])


@router.post("/generate")
async def generate_briefing():
    """Generate a new daily briefing from live sources."""
    briefing = await generate_daily_briefing()

    # Store in SurrealDB
    now = datetime.utcnow().isoformat()
    record = await db.create("briefing", {
        "briefing_id": briefing["id"],
        "title": briefing["title"],
        "subtitle": briefing["subtitle"],
        "abstract": briefing["abstract"],
        "content": briefing["content"],
        "reading_time": briefing["reading_time"],
        "source_count": briefing["source_count"],
        "created_at": now,
        "updated_at": now,
    })

    return {
        "success": True,
        "briefing": {**briefing, "db_id": extract_id(record)},
    }


@router.get("")
async def list_briefings(limit: int = 10):
    """List recent briefings."""
    result = await db.query(
        "SELECT * FROM briefing ORDER BY created_at DESC LIMIT $limit",
        {"limit": limit},
    )
    items = []
    for row in (result or []):
        if isinstance(row, dict):
            items.append({
                "id": row.get("briefing_id", extract_id(row)),
                "title": row.get("title", ""),
                "subtitle": row.get("subtitle", ""),
                "abstract": row.get("abstract", ""),
                "content": row.get("content", {}),
                "reading_time": row.get("reading_time", 5),
                "source_count": row.get("source_count", 0),
                "created_at": row.get("created_at", ""),
                "updated_at": row.get("updated_at", ""),
            })

    return {"items": items, "count": len(items)}


@router.post("/{briefing_id}/publish")
async def publish_briefing(briefing_id: str):
    """
    Publish a briefing as a Publication-compatible object.
    This can be sent to the platform's /api/v1/discovery/sync endpoint.
    """
    result = await db.query(
        "SELECT * FROM briefing WHERE briefing_id = $id",
        {"id": briefing_id},
    )
    rows = [r for r in (result or []) if isinstance(r, dict)]
    if not rows:
        raise HTTPException(status_code=404, detail="Briefing not found")

    row = rows[0]
    content = row.get("content", {})
    body = content.get("body", "") if isinstance(content, dict) else ""
    sources = content.get("sources", {}) if isinstance(content, dict) else {}

    publication = {
        "id": row.get("briefing_id", briefing_id),
        "slug": f"daily-brief-{row.get('briefing_id', '').replace('briefing-', '')}",
        "type": "blog",
        "contentType": "signal",
        "status": "published",
        "title": row.get("title", "Daily Brief"),
        "subtitle": row.get("subtitle", "Allternit Signal"),
        "abstract": row.get("abstract", ""),
        "authors": ["Allternit Signal"],
        "teams": ["research"],
        "tags": ["daily-brief", "ai-news", "curated"],
        "keywords": ["briefing", "curated", "intelligence"],
        "createdAt": row.get("created_at", ""),
        "updatedAt": row.get("updated_at", ""),
        "publishedAt": row.get("created_at", ""),
        "content": {
            "body": body,
            "sources": sources,
        },
        "readingTime": row.get("reading_time", 5),
        "featured": False,
        "series": "Daily AI Brief",
        "metrics": {"views": 0, "uniqueVisitors": 0, "downloads": 0, "citationCount": 0},
        "license": "CC BY 4.0",
        "accessLevel": "public",
    }

    return {
        "success": True,
        "publication": publication,
    }


@router.get("/{briefing_id}")
async def get_briefing(briefing_id: str):
    """Get a specific briefing by ID."""
    result = await db.query(
        "SELECT * FROM briefing WHERE briefing_id = $id",
        {"id": briefing_id},
    )
    rows = [r for r in (result or []) if isinstance(r, dict)]
    if not rows:
        return {"error": "Briefing not found"}

    row = rows[0]
    return {
        "id": row.get("briefing_id", extract_id(row)),
        "title": row.get("title", ""),
        "subtitle": row.get("subtitle", ""),
        "abstract": row.get("abstract", ""),
        "content": row.get("content", {}),
        "reading_time": row.get("reading_time", 5),
        "source_count": row.get("source_count", 0),
        "created_at": row.get("created_at", ""),
        "updated_at": row.get("updated_at", ""),
    }
