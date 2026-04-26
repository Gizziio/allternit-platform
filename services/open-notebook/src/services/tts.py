"""
Text-to-Speech Service — supports open-source and premium providers.

Providers (in priority order):
1. ElevenLabs (premium, best quality)
2. OpenAI TTS (good quality, simple API)
3. Coqui TTS (open source, local, free)
4. Piper TTS (ultra-lightweight, local, works on CPU)

Configuration via environment variables:
- TTS_PROVIDER: "elevenlabs" | "openai" | "coqui" | "piper"
- ELEVENLABS_API_KEY
- OPENAI_API_KEY (reused from Allternit pipeline)
- PIPER_MODEL_PATH
"""

import os
import uuid
import asyncio
import subprocess
from typing import Optional
import httpx

DATA_DIR = os.path.expanduser("~/.allternit/services/open-notebook/data")
os.makedirs(DATA_DIR, exist_ok=True)


class TTSService:
    def __init__(self):
        self.provider = os.getenv("TTS_PROVIDER", "piper").lower()
        self.elevenlabs_key = os.getenv("ELEVENLABS_API_KEY")
        self.openai_key = os.getenv("OPENAI_API_KEY")
        self.piper_model = os.getenv("PIPER_MODEL_PATH", "")

    async def generate(self, text: str, speakers: int = 2, style: str = "conversational") -> str:
        """Generate audio from text. Returns file URL/path."""
        if self.provider == "elevenlabs" and self.elevenlabs_key:
            return await self._generate_elevenlabs(text)
        elif self.provider == "openai" and self.openai_key:
            return await self._generate_openai(text)
        elif self.provider == "coqui":
            return await self._generate_coqui(text)
        else:
            return await self._generate_piper(text)

    async def _generate_elevenlabs(self, text: str) -> str:
        """ElevenLabs multilingual v2."""
        voice_id = os.getenv("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM")
        output_path = os.path.join(DATA_DIR, f"podcast_{uuid.uuid4().hex}.mp3")
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}",
                headers={
                    "xi-api-key": self.elevenlabs_key,
                    "Content-Type": "application/json",
                },
                json={
                    "text": text[:5000],  # ElevenLabs limit
                    "model_id": "eleven_multilingual_v2",
                    "voice_settings": {
                        "stability": 0.5,
                        "similarity_boost": 0.75,
                    },
                },
                timeout=120.0,
            )
            response.raise_for_status()
            
            with open(output_path, "wb") as f:
                f.write(response.content)
        
        return f"/data/{os.path.basename(output_path)}"

    async def _generate_openai(self, text: str) -> str:
        """OpenAI TTS (tts-1-hd)."""
        output_path = os.path.join(DATA_DIR, f"podcast_{uuid.uuid4().hex}.mp3")
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.openai.com/v1/audio/speech",
                headers={
                    "Authorization": f"Bearer {self.openai_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "tts-1-hd",
                    "input": text[:4096],  # OpenAI limit
                    "voice": "onyx",
                    "response_format": "mp3",
                },
                timeout=120.0,
            )
            response.raise_for_status()
            
            with open(output_path, "wb") as f:
                f.write(response.content)
        
        return f"/data/{os.path.basename(output_path)}"

    async def _generate_coqui(self, text: str) -> str:
        """Coqui TTS — open source, local inference."""
        output_path = os.path.join(DATA_DIR, f"podcast_{uuid.uuid4().hex}.wav")
        
        # Run Coqui TTS via subprocess
        # Requires: pip install TTS
        proc = await asyncio.create_subprocess_exec(
            "python", "-m", "TTS",
            "--text", text[:5000],
            "--out_path", output_path,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await proc.communicate()
        
        if proc.returncode != 0:
            raise RuntimeError(f"Coqui TTS failed: {stderr.decode()}")
        
        return f"/data/{os.path.basename(output_path)}"

    async def _generate_piper(self, text: str) -> str:
        """Piper TTS — ultra-lightweight, runs on CPU, no GPU needed."""
        output_path = os.path.join(DATA_DIR, f"podcast_{uuid.uuid4().hex}.wav")
        
        # Piper reads from stdin, writes WAV to stdout
        # Requires: piper-tts binary + voice model
        piper_bin = os.getenv("PIPER_BIN", "piper")
        model_path = self.piper_model or os.path.expanduser("~/.local/share/piper/voices/en_US-lessac-medium.onnx")
        
        if not os.path.exists(model_path):
            # Fallback: return placeholder with instructions
            raise FileNotFoundError(
                f"Piper model not found at {model_path}. "
                "Install: brew install piper-tts && download a voice model."
            )
        
        proc = await asyncio.create_subprocess_exec(
            piper_bin,
            "--model", model_path,
            "--output_file", output_path,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await proc.communicate(input=text[:5000].encode())
        
        if proc.returncode != 0:
            raise RuntimeError(f"Piper TTS failed: {stderr.decode()}")
        
        return f"/data/{os.path.basename(output_path)}"

    def get_available_providers(self) -> list:
        """Return list of available TTS providers based on config."""
        providers = []
        if self.elevenlabs_key:
            providers.append("elevenlabs")
        if self.openai_key:
            providers.append("openai")
        providers.append("coqui")
        providers.append("piper")
        return providers


tts_service = TTSService()
