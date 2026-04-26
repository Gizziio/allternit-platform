from fastapi import APIRouter
from core.retriever import retriever
from models import SearchRequest, SearchResponse, SearchResult

router = APIRouter(prefix="/api/notebooks/{notebook_id}/search", tags=["search"])


@router.post("", response_model=SearchResponse)
async def search(notebook_id: str, req: SearchRequest):
    results = await retriever.search(req.query, notebook_id, limit=req.limit)
    
    search_results = [
        SearchResult(
            source_id=r["source_id"],
            excerpt=r["text"][:300],
            score=r["score"],
        )
        for r in results
    ]
    
    return SearchResponse(results=search_results, query=req.query)
