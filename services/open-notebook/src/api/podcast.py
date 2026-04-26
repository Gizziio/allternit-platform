import os
from fastapi import APIRouter
from core.retriever import retriever
from core.llm_proxy import llm
from services.tts import tts_service
from models import PodcastRequest, PodcastResponse

router = APIRouter(prefix="/api/notebooks/{notebook_id}/podcast", tags=["podcast"])


@router.post("", response_model=PodcastResponse)
async def generate_podcast(notebook_id: str, req: PodcastRequest):
    # Get source context
    results = await retriever.search("main topics themes", notebook_id, limit=10)
    context = "\n\n".join([r["text"] for r in results])
    
    # Generate podcast script via LLM proxy
    script_prompt = f"""Create a {req.style} podcast script with {req.speakers} speaker(s) based on these research sources.
Format as a dialogue. Keep it engaging and accessible. Use Speaker 1, Speaker 2, etc.

Sources:
{context}"""

    messages = [
        {"role": "system", "content": "You are a podcast scriptwriter."},
        {"role": "user", "content": script_prompt},
    ]
    
    try:
        transcript = ""
        async for chunk in llm.complete(messages, stream=False, temperature=0.7):
            transcript += chunk
    except Exception as e:
        return PodcastResponse(
            audio_url="",
            duration=0,
            transcript=f"Error generating script: {str(e)}",
        )
    
    # Generate audio via TTS service
    try:
        audio_path = await tts_service.generate(
            text=transcript,
            speakers=req.speakers,
            style=req.style,
        )
        duration = len(transcript.split()) // 150  # Rough estimate
        
        return PodcastResponse(
            audio_url=audio_path,
            duration=duration,
            transcript=transcript,
        )
    except Exception as e:
        # Return transcript even if TTS fails
        return PodcastResponse(
            audio_url="",
            duration=len(transcript.split()) // 150,
            transcript=transcript + f"\n\n[Audio generation failed: {str(e)}]",
        )
