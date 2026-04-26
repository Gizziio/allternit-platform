from typing import List
from fastapi import APIRouter
from services.connector_sync import connector_sync
from db.surreal_client import db, extract_id
from models import Source

router = APIRouter(prefix="/api/notebooks/{notebook_id}/connectors", tags=["connectors"])


@router.get("/available")
async def list_available_connectors():
    """List configured connectors in ~/.allternit/connectors/"""
    return {"connectors": connector_sync.list_available_connectors()}


@router.post("/{connector_type}/sync")
async def sync_connector(notebook_id: str, connector_type: str):
    """Sync content from a connector into notebook sources."""
    items = await connector_sync.sync_connector(notebook_id, connector_type)
    
    created_sources = []
    for item in items:
        record = await db.create("source", {
            "notebook_id": notebook_id,
            "type": item["type"],
            "title": item["title"],
            "content": item["content"],
            "token_count": len(item["content"].split()),
            "status": "extracted",
            "metadata": item.get("metadata", {}),
        })
        created_sources.append(Source(**{**record, "id": extract_id(record)}))
    
    return {"synced": len(created_sources), "sources": created_sources}
