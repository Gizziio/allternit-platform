from fastapi import APIRouter
from core.retriever import retriever
from core.llm_proxy import llm
from models import TransformRequest, TransformResponse

router = APIRouter(prefix="/api/notebooks/{notebook_id}/transform", tags=["transform"])

TRANSFORM_PROMPTS = {
    "summary": "Summarize the key points from these sources in 3-5 bullet points.",
    "briefing": "Create an executive briefing document with: Situation, Key Findings, Recommendations, and Next Steps.",
    "faq": "Generate a FAQ section with 5-7 questions and answers based on these sources.",
    "timeline": "Extract all dated events and create a chronological timeline.",
}


@router.post("", response_model=TransformResponse)
async def transform(notebook_id: str, req: TransformRequest):
    results = await retriever.search("key information", notebook_id, limit=10)
    context = "\n\n".join([f"[Source]: {r['text']}" for r in results])
    
    prompt = f"""{TRANSFORM_PROMPTS[req.type]}

Sources:
{context}"""

    messages = [
        {"role": "system", "content": "You are a research document generator."},
        {"role": "user", "content": prompt},
    ]
    
    try:
        content = ""
        async for chunk in llm.complete(messages, stream=False, temperature=0.4):
            content += chunk
        
        return TransformResponse(content=content, type=req.type)
    except Exception as e:
        return TransformResponse(
            content=f"# {req.type.title()}\n\nError: {str(e)}\n\nPlease ensure Allternit's AI provider is configured (OpenAI, Anthropic, or Ollama).",
            type=req.type,
        )
