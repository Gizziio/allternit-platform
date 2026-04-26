import re
import html
from datetime import datetime
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import httpx

from db.surreal_client import db, extract_id
from core.chunker import chunk_text
from core.retriever import retriever
from models import Source

router = APIRouter(prefix="/api/notebooks/{notebook_id}/canvas-sync", tags=["canvas"])


class CanvasSyncRequest(BaseModel):
    canvas_course_id: str
    canvas_token: str
    canvas_domain: str = "https://canvas.instructure.com"


def _strip_html(raw: str) -> str:
    """Strip HTML tags and decode entities."""
    text = re.sub(r"<[^>]+>", " ", raw)
    text = html.unescape(text)
    return re.sub(r"\s+", " ", text).strip()


async def _canvas_get(base_url: str, token: str, path: str) -> Any:
    """Make an authenticated Canvas API request."""
    url = f"{base_url}{path}"
    if "?" in url:
        url += "&per_page=100"
    else:
        url += "?per_page=100"

    async with httpx.AsyncClient(timeout=30.0) as client:
        res = await client.get(
            url,
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/json+canvas-string-ids",
            },
        )
    if res.status_code == 401:
        raise HTTPException(status_code=401, detail="Invalid Canvas API token")
    if res.status_code == 404:
        raise HTTPException(status_code=404, detail="Canvas course not found")
    if not res.is_success:
        raise HTTPException(status_code=502, detail=f"Canvas API error {res.status_code}: {res.text[:200]}")
    return res.json()


async def _create_source(
    notebook_id: str,
    source_type: str,
    title: str,
    content: str,
    url: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> Source:
    """Create a source record, chunk it, and update notebook counts."""
    now = datetime.utcnow().isoformat()

    record = await db.create("source", {
        "notebook_id": notebook_id,
        "type": source_type,
        "title": title,
        "url": url,
        "content": content,
        "token_count": len(content.split()),
        "status": "extracted",
        "metadata": metadata or {},
        "created_at": now,
        "updated_at": now,
    })

    source_id = extract_id(record)

    # Chunk and index
    if content:
        chunks = chunk_text(content, source_id, notebook_id)
        await retriever.add_chunks(chunks)

    return Source(**{**record, "id": source_id})


async def _update_notebook_counts(notebook_id: str):
    """Recalculate notebook source_count and token_count."""
    sources = await db.query("SELECT * FROM source WHERE notebook_id = $nb", {"nb": notebook_id})
    records = sources if sources else []
    total_tokens = sum(s["token_count"] for s in records)
    await db.update("notebook", notebook_id, {
        "source_count": len(records),
        "token_count": total_tokens,
        "updated_at": datetime.utcnow().isoformat(),
    })


@router.post("")
async def canvas_sync(
    notebook_id: str,
    req: CanvasSyncRequest,
):
    """
    Fetch course content from Canvas LMS and ingest it as sources into a notebook.
    """
    # Verify notebook exists
    notebook = await db.select("notebook", notebook_id)
    if not notebook:
        raise HTTPException(status_code=404, detail="Notebook not found")

    base_url = req.canvas_domain.rstrip("/") + "/api/v1"

    try:
        # Fetch course info
        course = await _canvas_get(base_url, req.canvas_token, f"/courses/{req.canvas_course_id}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Canvas connection failed: {str(e)}")

    created_sources: List[Dict[str, Any]] = []

    # --- Modules ---
    try:
        modules = await _canvas_get(base_url, req.canvas_token, f"/courses/{req.canvas_course_id}/modules")
        for mod in modules:
            mod_id = mod.get("id")
            mod_name = mod.get("name", "Untitled Module")
            mod_state = mod.get("state", "unknown")

            # Fetch module items
            items: List[Dict[str, Any]] = []
            try:
                items = await _canvas_get(
                    base_url, req.canvas_token,
                    f"/courses/{req.canvas_course_id}/modules/{mod_id}/items"
                )
            except Exception:
                pass  # Some modules may not have accessible items

            items_text = "\n".join(
                f"- {item.get('title', 'Untitled')} ({item.get('type', 'unknown')})"
                f"{item.get('external_url') and f' → {item['external_url']}' or ''}"
                for item in items
            )

            content = f"Module: {mod_name}\nState: {mod_state}\n\nItems:\n{items_text}"
            source = await _create_source(
                notebook_id,
                "url",
                f"Module: {mod_name}",
                content,
                metadata={"canvas_type": "module", "canvas_id": mod_id},
            )
            created_sources.append({"id": source.id, "title": source.title, "type": "module"})
    except Exception as e:
        print(f"[Canvas Sync] Module fetch warning: {e}")

    # --- Assignments ---
    try:
        assignments = await _canvas_get(base_url, req.canvas_token, f"/courses/{req.canvas_course_id}/assignments")
        if assignments:
            assignments_text = "\n\n".join(
                f"- {a.get('name', 'Untitled')} ({a.get('points_possible', 0)} pts)"
                f"{a.get('due_at') and f' — Due: {a['due_at']}' or ''}\n"
                f"  {_strip_html(a.get('description', ''))[:400]}"
                for a in assignments
            )
            content = f"Assignments for {course.get('name', 'Course')}:\n\n{assignments_text}"
            source = await _create_source(
                notebook_id,
                "text",
                "Assignments",
                content,
                metadata={"canvas_type": "assignments", "count": len(assignments)},
            )
            created_sources.append({"id": source.id, "title": source.title, "type": "assignments"})
    except Exception as e:
        print(f"[Canvas Sync] Assignment fetch warning: {e}")

    # --- Pages ---
    try:
        pages = await _canvas_get(base_url, req.canvas_token, f"/courses/{req.canvas_course_id}/pages")
        if pages:
            # Fetch full body for each page
            page_contents: List[str] = []
            for page in pages:
                page_url = page.get("url")
                page_title = page.get("title", "Untitled Page")
                body = ""
                if page_url:
                    try:
                        page_detail = await _canvas_get(
                            base_url, req.canvas_token,
                            f"/courses/{req.canvas_course_id}/pages/{page_url}"
                        )
                        body = _strip_html(page_detail.get("body", ""))
                    except Exception:
                        pass
                page_contents.append(f"## {page_title}\n\n{body[:800]}")

            full_content = f"Wiki Pages for {course.get('name', 'Course')}:\n\n" + "\n\n---\n\n".join(page_contents)
            source = await _create_source(
                notebook_id,
                "text",
                "Wiki Pages",
                full_content,
                metadata={"canvas_type": "pages", "count": len(pages)},
            )
            created_sources.append({"id": source.id, "title": source.title, "type": "pages"})
    except Exception as e:
        print(f"[Canvas Sync] Page fetch warning: {e}")

    # --- Files ---
    try:
        files = await _canvas_get(base_url, req.canvas_token, f"/courses/{req.canvas_course_id}/files")
        if files:
            files_text = "\n".join(
                f"- {f.get('display_name', 'Untitled')} ({f.get('size', 0)} bytes)"
                for f in files
            )
            content = f"Files for {course.get('name', 'Course')}:\n\n{files_text}"
            source = await _create_source(
                notebook_id,
                "text",
                "Files",
                content,
                metadata={"canvas_type": "files", "count": len(files)},
            )
            created_sources.append({"id": source.id, "title": source.title, "type": "files"})
    except Exception as e:
        print(f"[Canvas Sync] File fetch warning: {e}")

    # Update notebook counts once at the end
    await _update_notebook_counts(notebook_id)

    return {
        "success": True,
        "course": {
            "id": course.get("id"),
            "name": course.get("name"),
            "course_code": course.get("course_code"),
        },
        "sources_created": len(created_sources),
        "sources": created_sources,
    }
