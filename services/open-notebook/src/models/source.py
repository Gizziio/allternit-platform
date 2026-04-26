from datetime import datetime
from typing import Optional, Dict, Any
from enum import Enum
from pydantic import BaseModel, Field


class SourceType(str, Enum):
    UPLOAD = "upload"
    URL = "url"
    GMAIL = "gmail"
    SLACK = "slack"
    NOTION = "notion"
    TEXT = "text"


class SourceBase(BaseModel):
    type: SourceType
    title: str = Field(..., min_length=1, max_length=300)
    url: Optional[str] = None
    content: Optional[str] = None


class SourceCreate(SourceBase):
    pass


class Source(SourceBase):
    id: str
    notebook_id: str
    token_count: int = 0
    status: str = "pending"  # pending | extracted | failed
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
