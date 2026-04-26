from typing import Optional, List
from pydantic import BaseModel


class Citation(BaseModel):
    index: int
    source_id: str
    excerpt: str
    page_number: Optional[int] = None


class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None


class ChatChunk(BaseModel):
    text: Optional[str] = None
    citation: Optional[Citation] = None
    done: bool = False


class ChatResponse(BaseModel):
    message: str
    citations: List[Citation] = []
    session_id: Optional[str] = None


class ChatMessage(BaseModel):
    id: Optional[str] = None
    role: str
    content: str
    citations: List[Citation] = []
    created_at: Optional[str] = None
