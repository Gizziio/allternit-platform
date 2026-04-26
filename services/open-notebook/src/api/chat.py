import json
from datetime import datetime
from typing import List
from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from core.retriever import retriever
from core.llm_proxy import llm
from db.surreal_client import db
from models import ChatRequest, Citation, ChatMessage

router = APIRouter(prefix="/api/notebooks/{notebook_id}/chat", tags=["chat"])


@router.get("/messages", response_model=List[ChatMessage])
async def list_messages(notebook_id: str):
    """Get chat history for a notebook."""
    result = await db.query(
        "SELECT * FROM message WHERE notebook_id = $notebook_id ORDER BY created_at ASC",
        {"notebook_id": notebook_id},
    )
    records = []
    if result and len(result) > 0:
        rows = result[0].get("result", []) if isinstance(result[0], dict) else result[0] if isinstance(result[0], list) else []
        for row in rows:
            if isinstance(row, dict):
                records.append(ChatMessage(
                    id=row.get("id", "").split(":")[-1],
                    role=row.get("role", "user"),
                    content=row.get("content", ""),
                    citations=[Citation(**c) for c in row.get("citations", [])],
                    created_at=row.get("created_at", datetime.utcnow().isoformat()),
                ))
    return records


@router.post("")
async def chat(notebook_id: str, req: ChatRequest):
    # Persist user message
    user_msg_record = await db.create("message", {
        "notebook_id": notebook_id,
        "role": "user",
        "content": req.message,
        "citations": [],
        "created_at": datetime.utcnow().isoformat(),
    })

    # Retrieve relevant chunks
    results = await retriever.search(req.message, notebook_id, limit=8)

    # Build context with citations
    context_parts = []
    citations = []
    for i, result in enumerate(results, 1):
        context_parts.append(f"[Source {i}]: {result['text']}")
        citations.append(Citation(
            index=i,
            source_id=result["source_id"],
            excerpt=result["text"][:200],
        ))

    context = "\n\n".join(context_parts)

    system_prompt = f"""You are a research assistant. Answer the user's question using ONLY the provided sources.
Cite sources using [1], [2], etc. format. If the answer isn't in the sources, say so.

Sources:
{context}"""

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": req.message},
    ]

    assistant_content = ""

    async def stream_response():
        nonlocal assistant_content
        try:
            async for chunk in llm.complete(messages, stream=True, temperature=0.3):
                assistant_content += chunk
                yield f"data: {json.dumps({'text': chunk})}\n\n"

            # Send citations at end
            for c in citations:
                yield f"data: {json.dumps({'citation': c.dict()})}\n\n"
            yield f"data: {json.dumps({'done': True})}\n\n"

            # Persist assistant message
            await db.create("message", {
                "notebook_id": notebook_id,
                "role": "assistant",
                "content": assistant_content,
                "citations": [c.dict() for c in citations],
                "created_at": datetime.utcnow().isoformat(),
            })
        except Exception as e:
            error_text = f"\n\n[Error: {str(e)}]"
            assistant_content += error_text
            yield f"data: {json.dumps({'text': error_text})}\n\n"
            yield f"data: {json.dumps({'done': True})}\n\n"

            # Persist error message too
            await db.create("message", {
                "notebook_id": notebook_id,
                "role": "assistant",
                "content": assistant_content,
                "citations": [],
                "created_at": datetime.utcnow().isoformat(),
            })

    return StreamingResponse(stream_response(), media_type="text/event-stream")
