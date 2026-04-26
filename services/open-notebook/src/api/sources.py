from datetime import datetime
from typing import List
from fastapi import APIRouter, HTTPException

from db.surreal_client import db, extract_id
from core.chunker import chunk_text
from core.retriever import retriever
from models import Source, SourceCreate

router = APIRouter(prefix="/api/notebooks/{notebook_id}/sources", tags=["sources"])


@router.get("", response_model=List[Source])
async def list_sources(notebook_id: str):
    result = await db.query("SELECT * FROM source WHERE notebook_id = $nb", {"nb": notebook_id})
    records = result if result else []
    return [Source(**{**r, "id": extract_id(r)}) for r in records]


@router.post("", response_model=Source)
async def add_source(notebook_id: str, data: SourceCreate):
    # Verify notebook exists
    notebook = await db.select("notebook", notebook_id)
    if not notebook:
        raise HTTPException(status_code=404, detail="Notebook not found")
    
    now = datetime.utcnow().isoformat()
    content = data.content or ""
    
    # Create source record
    record = await db.create("source", {
        "notebook_id": notebook_id,
        "type": data.type.value,
        "title": data.title,
        "url": data.url,
        "content": content,
        "token_count": len(content.split()),
        "status": "extracted" if content else "pending",
        "metadata": {},
        "created_at": now,
        "updated_at": now,
    })
    
    source_id = extract_id(record)
    
    # Chunk and index if content exists
    if content:
        chunks = chunk_text(content, source_id, notebook_id)
        await retriever.add_chunks(chunks)
    
    # Update notebook token count
    sources = await db.query("SELECT * FROM source WHERE notebook_id = $nb", {"nb": notebook_id})
    total_tokens = sum(s["token_count"] for s in sources) if sources else 0
    await db.update("notebook", notebook_id, {
        "source_count": len(sources) if sources else 1,
        "token_count": total_tokens,
        "updated_at": now,
    })
    
    return Source(**{**record, "id": source_id})


@router.delete("/{source_id}")
async def remove_source(notebook_id: str, source_id: str):
    await db.delete("source", source_id)
    await retriever.clear_source(source_id)
    
    # Update notebook counts
    sources = await db.query("SELECT * FROM source WHERE notebook_id = $nb", {"nb": notebook_id})
    total_tokens = sum(s["token_count"] for s in sources) if sources else 0
    await db.update("notebook", notebook_id, {
        "source_count": len(sources) if sources else 0,
        "token_count": total_tokens,
        "updated_at": datetime.utcnow().isoformat(),
    })
    
    return {"success": True}
