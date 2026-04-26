from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


class NotebookBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)


class NotebookCreate(NotebookBase):
    owner_id: Optional[str] = Field(None, description="User or agent ID who owns this notebook")


class NotebookUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)


class NotebookShareRequest(BaseModel):
    user_id: str = Field(..., description="User or agent ID to share with")


class Notebook(NotebookBase):
    id: str
    source_count: int = 0
    token_count: int = 0
    owner_id: Optional[str] = None
    shared_with: List[str] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
