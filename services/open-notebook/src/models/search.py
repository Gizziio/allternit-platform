from typing import List, Optional
from pydantic import BaseModel


class SearchRequest(BaseModel):
    query: str
    limit: int = 10


class SearchResult(BaseModel):
    source_id: str
    excerpt: str
    score: float
    page_number: Optional[int] = None


class SearchResponse(BaseModel):
    results: List[SearchResult]
    query: str
