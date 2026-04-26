from typing import Literal
from pydantic import BaseModel


class TransformRequest(BaseModel):
    type: Literal["summary", "briefing", "faq", "timeline"]


class TransformResponse(BaseModel):
    content: str
    type: str
