from typing import Optional, Literal
from pydantic import BaseModel


class PodcastRequest(BaseModel):
    speakers: int = 2
    style: Literal["conversational", "formal", "debate"] = "conversational"


class PodcastResponse(BaseModel):
    audio_url: str
    duration: int
    transcript: Optional[str] = None
