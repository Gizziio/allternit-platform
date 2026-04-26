"""
LLM Proxy — delegates all language model calls to Allternit's existing AI infrastructure.
No API keys stored in this service. Allternit's provider routing handles auth.
"""

import os
import json
from typing import AsyncGenerator, List, Dict, Any
import httpx

# Allternit's AI gateway endpoint (configured by desktop shell)
ALLTERNIT_AI_URL = os.getenv("ALLTERNIT_AI_URL", "http://127.0.0.1:8765")
ALLTERNIT_API_KEY = os.getenv("ALLTERNIT_API_KEY", "")

# Local Ollama fallback (Allternit already runs this for local models)
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://127.0.0.1:11434")


class LLMProxy:
    """
    Proxy for LLM calls. Tries Allternit's AI gateway first, falls back to Ollama.
    """

    def __init__(self):
        self.ai_url = ALLTERNIT_AI_URL.rstrip("/")
        self.ollama_url = OLLAMA_URL.rstrip("/")
        self.headers = {}
        if ALLTERNIT_API_KEY:
            self.headers["Authorization"] = f"Bearer {ALLTERNIT_API_KEY}"

    async def _call_allternit(self, messages: List[Dict[str, str]], stream: bool = False, temperature: float = 0.3) -> AsyncGenerator[str, None]:
        """Call Allternit's AI gateway."""
        try:
            async with httpx.AsyncClient() as client:
                if stream:
                    async with client.stream(
                        "POST",
                        f"{self.ai_url}/v1/chat/completions",
                        headers={**self.headers, "Content-Type": "application/json"},
                        json={
                            "messages": messages,
                            "stream": True,
                            "temperature": temperature,
                        },
                        timeout=120.0,
                    ) as response:
                        response.raise_for_status()
                        async for line in response.aiter_lines():
                            if line.startswith("data: "):
                                data = line[6:]
                                if data == "[DONE]":
                                    return
                                try:
                                    parsed = json.loads(data)
                                    delta = parsed["choices"][0]["delta"].get("content", "")
                                    if delta:
                                        yield delta
                                except (json.JSONDecodeError, KeyError):
                                    pass
                else:
                    response = await client.post(
                        f"{self.ai_url}/v1/chat/completions",
                        headers={**self.headers, "Content-Type": "application/json"},
                        json={
                            "messages": messages,
                            "stream": False,
                            "temperature": temperature,
                        },
                        timeout=120.0,
                    )
                    response.raise_for_status()
                    data = response.json()
                    yield data["choices"][0]["message"]["content"]
        except Exception as e:
            print(f"[LLMProxy] Allternit gateway failed: {e}")
            raise

    async def _call_ollama(self, messages: List[Dict[str, str]], stream: bool = False, temperature: float = 0.3) -> AsyncGenerator[str, None]:
        """Fallback to local Ollama."""
        try:
            async with httpx.AsyncClient() as client:
                payload = {
                    "model": os.getenv("OLLAMA_MODEL", "qwen3:4b"),
                    "messages": messages,
                    "stream": stream,
                    "options": {"temperature": temperature},
                }
                
                if stream:
                    async with client.stream(
                        "POST",
                        f"{self.ollama_url}/api/chat",
                        json=payload,
                        timeout=120.0,
                    ) as response:
                        response.raise_for_status()
                        async for line in response.aiter_lines():
                            if line:
                                try:
                                    parsed = json.loads(line)
                                    if "message" in parsed and "content" in parsed["message"]:
                                        yield parsed["message"]["content"]
                                    if parsed.get("done"):
                                        return
                                except json.JSONDecodeError:
                                    pass
                else:
                    response = await client.post(
                        f"{self.ollama_url}/api/chat",
                        json=payload,
                        timeout=120.0,
                    )
                    response.raise_for_status()
                    data = response.json()
                    yield data["message"]["content"]
        except Exception as e:
            print(f"[LLMProxy] Ollama fallback failed: {e}")
            raise

    async def complete(
        self,
        messages: List[Dict[str, str]],
        stream: bool = False,
        temperature: float = 0.3,
    ) -> AsyncGenerator[str, None]:
        """
        Complete a conversation. Tries Allternit gateway, falls back to Ollama.
        """
        try:
            async for chunk in self._call_allternit(messages, stream, temperature):
                yield chunk
        except Exception:
            print("[LLMProxy] Falling back to Ollama...")
            async for chunk in self._call_ollama(messages, stream, temperature):
                yield chunk

    async def embed(self, texts: List[str]) -> List[List[float]]:
        """
        Get embeddings. Tries Allternit gateway first, then Ollama embeddings.
        """
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.ai_url}/v1/embeddings",
                    headers={**self.headers, "Content-Type": "application/json"},
                    json={"input": texts},
                    timeout=60.0,
                )
                response.raise_for_status()
                data = response.json()
                return [item["embedding"] for item in data["data"]]
        except Exception as e:
            print(f"[LLMProxy] Allternit embed failed: {e}, trying Ollama...")
            # Ollama embedding fallback
            async with httpx.AsyncClient() as client:
                embeddings = []
                for text in texts:
                    response = await client.post(
                        f"{self.ollama_url}/api/embeddings",
                        json={
                            "model": os.getenv("OLLAMA_EMBED_MODEL", "nomic-embed-text"),
                            "prompt": text,
                        },
                        timeout=60.0,
                    )
                    response.raise_for_status()
                    data = response.json()
                    embeddings.append(data["embedding"])
                return embeddings


llm = LLMProxy()
