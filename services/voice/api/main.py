"""
Allternitchitech Voice Service

FastAPI wrapper around Chatterbox TTS/VC models.
Provides HTTP API endpoints for text-to-speech and voice cloning.
"""

from fastapi import FastAPI, HTTPException, File, UploadFile
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import json
import logging
import os
import shutil
import subprocess
import threading
import time
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import urlopen

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("voice-service")

app = FastAPI(
    title="Allternitchitech Voice Service",
    description="Text-to-Speech and Voice Cloning powered by Chatterbox",
    version="1.0.0",
)

# Enable CORS for all origins (Electron app, web UI, etc.)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

AUDIO_OUTPUT_DIR = Path(os.getenv("AUDIO_OUTPUT_DIR", "/tmp/voice-service"))
AUDIO_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
VOICE_PROMPT_DIR = AUDIO_OUTPUT_DIR / "voice_prompts"
VOICE_PROMPT_DIR.mkdir(parents=True, exist_ok=True)
CHATTERBOX_PROMPT_DIR = VOICE_PROMPT_DIR / "chatterbox"
CHATTERBOX_PROMPT_DIR.mkdir(parents=True, exist_ok=True)
XTTS_PROMPT_DIR = VOICE_PROMPT_DIR / "xtts"
XTTS_PROMPT_DIR.mkdir(parents=True, exist_ok=True)
PIPER_MODEL_DIR = VOICE_PROMPT_DIR / "piper"
PIPER_MODEL_DIR.mkdir(parents=True, exist_ok=True)

DEFAULT_VOICE_PRESETS = [
    {"id": "default", "label": "Default", "engine": "chatterbox", "prompt": ""},
    {
        "id": "xtts-aura",
        "label": "Aura (XTTS)",
        "engine": "xtts_v2",
        "speaker_wav": "https://storage.googleapis.com/chatterbox-demo-samples/mtl_prompts/en_f1.flac",
        "language": "en",
    },
    {
        "id": "xtts-claire",
        "label": "Claire (XTTS)",
        "engine": "xtts_v2",
        "speaker_wav": "https://huggingface.co/coqui/XTTS-v2/resolve/main/samples/en_sample.wav",
        "language": "en",
    },
    {
        "id": "xtts-zephyr",
        "label": "Zephyr (XTTS)",
        "engine": "xtts_v2",
        "speaker_wav": "https://huggingface.co/coqui/XTTS-v2/resolve/main/samples/en_sample.wav",
        "language": "en",
    },
    {
        "id": "piper-amy",
        "label": "Amy (Piper)",
        "engine": "piper",
        "model": "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/medium/en_US-amy-medium.onnx",
    },
    {
        "id": "piper-ryan",
        "label": "Ryan (Piper)",
        "engine": "piper",
        "model": "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/ryan/medium/en_US-ryan-medium.onnx",
    },
    {
        "id": "piper-alan",
        "label": "Alan (Piper)",
        "engine": "piper",
        "model": "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/alan/medium/en_GB-alan-medium.onnx",
    },
    {
        "id": "piper-lessac",
        "label": "Lessac (Piper)",
        "engine": "piper",
        "model": "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx",
    },
    {
        "id": "piper-joe",
        "label": "Joe (Piper)",
        "engine": "piper",
        "model": "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/joe/medium/en_US-joe-medium.onnx",
    },
    {
        "id": "piper-kristin",
        "label": "Kristin (Piper)",
        "engine": "piper",
        "model": "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/kristin/medium/en_US-kristin-medium.onnx",
    },
    {
        "id": "xtts-luna",
        "label": "Luna (XTTS - IT)",
        "engine": "xtts_v2",
        "speaker_wav": "https://storage.googleapis.com/chatterbox-demo-samples/mtl_prompts/it_m1.flac",
        "language": "it",
    },
    {
        "id": "xtts-sol",
        "label": "Sol (XTTS - ES)",
        "engine": "xtts_v2",
        "speaker_wav": "https://storage.googleapis.com/chatterbox-demo-samples/mtl_prompts/es_f1.flac",
        "language": "es",
    },
    {
        "id": "xtts-nova",
        "label": "Nova (XTTS - FR)",
        "engine": "xtts_v2",
        "speaker_wav": "https://storage.googleapis.com/chatterbox-demo-samples/mtl_prompts/fr_f1.flac",
        "language": "fr",
    },
    {
        "id": "neutral",
        "label": "Neutral (CB)",
        "engine": "chatterbox",
        "prompt": "https://storage.googleapis.com/chatterbox-demo-samples/mtl_prompts/en_f1.flac",
    },
    {
        "id": "calm",
        "label": "Calm (CB)",
        "engine": "chatterbox",
        "prompt": "https://storage.googleapis.com/chatterbox-demo-samples/mtl_prompts/sv_f.flac",
    },
]

VOICE_ASSET_LOCK = threading.Lock()

_chatterbox_model = None
_xtts_model = None
_xtts_model_id = None


def get_chatterbox_model():
    global _chatterbox_model
    if _chatterbox_model is None:
        try:
            from chatterbox.tts_turbo import ChatterboxTurboTTS

            logger.info("Loading Chatterbox Turbo model...")
            _chatterbox_model = ChatterboxTurboTTS.from_pretrained(device="cpu")
            logger.info("Chatterbox Turbo model loaded successfully")
        except ImportError:
            logger.error("Chatterbox TTS not installed. TTS features disabled.")
            raise HTTPException(
                status_code=503, detail="TTS not available. Install chatterbox-tts."
            )
        except Exception as e:
            logger.error(f"Failed to load Chatterbox model: {e}")
            raise HTTPException(
                status_code=500, detail="Voice model not available. Check server logs."
            )
    return _chatterbox_model


def get_xtts_model(model_id: str):
    global _xtts_model, _xtts_model_id
    if _xtts_model is None or _xtts_model_id != model_id:
        try:
            from TTS.api import TTS
            import torch

            device = os.getenv("XTTS_DEVICE")
            if not device:
                device = "cuda" if torch.cuda.is_available() else "cpu"
            logger.info(f"Loading XTTS model {model_id} on {device}...")
            _xtts_model = TTS(model_id).to(device)
            _xtts_model_id = model_id
            logger.info("XTTS model loaded successfully")
        except ImportError:
            logger.error("TTS library not installed. XTTS features disabled.")
            raise HTTPException(
                status_code=503, detail="XTTS not available. Install TTS."
            )
        except Exception as e:
            logger.error(f"Failed to load XTTS model: {e}")
            raise HTTPException(
                status_code=500, detail="XTTS model not available. Check server logs."
            )
    return _xtts_model


def _normalize_engine(engine: str) -> str:
    normalized = (engine or "chatterbox").strip().lower()
    if normalized in ("chatterbox", "chatterbox_turbo", "turbo", "cb"):
        return "chatterbox"
    if normalized in ("xtts", "xtts_v2", "xtts2", "coqui_xtts"):
        return "xtts_v2"
    if normalized in ("piper", "piper_tts", "piper-tts"):
        return "piper"
    return "chatterbox"


def _normalize_voice_presets(raw_presets):
    presets = []
    seen = set()
    if not isinstance(raw_presets, list):
        raw_presets = []
    for item in raw_presets:
        if not item:
            continue
        if isinstance(item, str):
            voice_id = item.strip()
            label = voice_id
            engine = "chatterbox"
            prompt = ""
            speaker_wav = ""
            language = "en"
            model = ""
            config = ""
        elif isinstance(item, dict):
            voice_id = str(item.get("id", "")).strip()
            label = str(item.get("label") or voice_id).strip()
            engine = _normalize_engine(str(item.get("engine", "") or "chatterbox"))
            prompt = str(item.get("prompt") or item.get("url") or item.get("audio") or "").strip()
            speaker_wav = str(
                item.get("speaker_wav") or item.get("speaker") or item.get("voice") or ""
            ).strip()
            language = str(item.get("language") or item.get("lang") or "en").strip()
            model = str(item.get("model") or item.get("model_url") or item.get("onnx") or "").strip()
            config = str(item.get("config") or item.get("config_url") or item.get("json") or "").strip()
        else:
            continue
        if not voice_id or voice_id in seen:
            continue
        seen.add(voice_id)
        if engine == "xtts_v2" and not speaker_wav and prompt:
            speaker_wav = prompt
        if engine == "chatterbox" and not prompt and speaker_wav:
            prompt = speaker_wav
        presets.append({
            "id": voice_id,
            "label": label,
            "engine": engine,
            "prompt": prompt,
            "speaker_wav": speaker_wav,
            "language": language,
            "model": model,
            "config": config,
        })
    if "default" not in seen:
        presets.insert(0, {
            "id": "default",
            "label": "Default",
            "engine": "chatterbox",
            "prompt": "",
            "speaker_wav": "",
            "language": "en",
            "model": "",
            "config": "",
        })
    return presets


def load_voice_presets():
    manifest_json = os.getenv("VOICE_PRESET_JSON", "").strip()
    manifest_path = os.getenv("VOICE_PRESET_PATH", "").strip()
    if manifest_json:
        try:
            parsed = json.loads(manifest_json)
            return _normalize_voice_presets(parsed)
        except json.JSONDecodeError as exc:
            logger.warning(f"VOICE_PRESET_JSON invalid: {exc}")
    if manifest_path:
        try:
            with open(manifest_path, "r", encoding="utf-8") as handle:
                parsed = json.load(handle)
            return _normalize_voice_presets(parsed)
        except (OSError, json.JSONDecodeError) as exc:
            logger.warning(f"VOICE_PRESET_PATH invalid: {exc}")
    
    # Try local voices.json
    local_manifest = Path(__file__).parent / "voices.json"
    if local_manifest.exists():
        try:
            with open(local_manifest, "r", encoding="utf-8") as handle:
                parsed = json.load(handle)
            return _normalize_voice_presets(parsed)
        except (OSError, json.JSONDecodeError) as exc:
            logger.warning(f"local voices.json invalid: {exc}")

    return _normalize_voice_presets(DEFAULT_VOICE_PRESETS)



VOICE_PRESETS = load_voice_presets()
VOICE_PRESET_MAP = {preset["id"]: preset for preset in VOICE_PRESETS}


def _is_url(value: str) -> bool:
    parsed = urlparse(value)
    return parsed.scheme in ("http", "https")


def _audio_output_path(reference: str) -> Optional[Path]:
    if reference.startswith("/v1/voice/audio/"):
        filename = reference.split("/")[-1]
        return AUDIO_OUTPUT_DIR / filename
    return None


def _resolve_local_path(raw_path: str, base_dir: Path) -> Path:
    path = Path(raw_path)
    if not path.is_absolute():
        path = base_dir / path
    return path


def _download_asset(url: str, target_path: Path) -> bool:
    try:
        with urlopen(url, timeout=20) as response:
            target_path.parent.mkdir(parents=True, exist_ok=True)
            with open(target_path, "wb") as output_file:
                output_file.write(response.read())
        return True
    except Exception as exc:
        logger.warning(f"Failed to download asset {url}: {exc}")
        return False


def _resolve_asset_path(
    voice_id: str,
    value: str,
    base_dir: Path,
    default_ext: str,
    download: bool,
) -> Optional[Path]:
    if not value:
        return None
    audio_path = _audio_output_path(value)
    if audio_path and audio_path.exists():
        return audio_path
    if _is_url(value):
        ext = Path(urlparse(value).path).suffix or default_ext
        target_path = base_dir / f"{voice_id}{ext}"
        if target_path.exists():
            return target_path
        if not download:
            return None
        with VOICE_ASSET_LOCK:
            if target_path.exists():
                return target_path
            if _download_asset(value, target_path):
                return target_path
        return None
    local_path = _resolve_local_path(value, base_dir)
    if local_path.exists():
        return local_path
    logger.warning(f"Voice asset not found at {local_path}")
    return None


def resolve_chatterbox_prompt(voice_id: str, download: bool) -> Optional[Path]:
    preset = VOICE_PRESET_MAP.get(voice_id)
    if not preset:
        return None
    prompt = preset.get("prompt", "").strip()
    return _resolve_asset_path(voice_id, prompt, CHATTERBOX_PROMPT_DIR, ".wav", download)


def resolve_xtts_speaker(voice_id: str, download: bool) -> Optional[Path]:
    preset = VOICE_PRESET_MAP.get(voice_id)
    if not preset:
        return None
    speaker = preset.get("speaker_wav", "").strip() or preset.get("prompt", "").strip()
    return _resolve_asset_path(voice_id, speaker, XTTS_PROMPT_DIR, ".wav", download)


def _resolve_piper_config(
    voice_id: str,
    model_value: str,
    config_value: str,
    download: bool,
    model_path: Optional[Path],
) -> Optional[Path]:
    if model_path:
        preferred_target = model_path.with_suffix(model_path.suffix + ".json")
    else:
        preferred_target = PIPER_MODEL_DIR / f"{voice_id}.onnx.json"

    if config_value:
        if _is_url(config_value):
            if preferred_target.exists():
                return preferred_target
            if not download:
                return None
            if _download_asset(config_value, preferred_target):
                return preferred_target
            return None
        config_path = _resolve_local_path(config_value, PIPER_MODEL_DIR)
        if config_path.exists():
            if config_path == preferred_target:
                return config_path
            if download:
                preferred_target.parent.mkdir(parents=True, exist_ok=True)
                try:
                    shutil.copy(config_path, preferred_target)
                    return preferred_target
                except OSError:
                    return config_path
            return config_path
        return None

    if not model_value:
        return None
    if _is_url(model_value):
        candidate = f"{model_value}.json"
        if download and not preferred_target.exists():
            if _download_asset(candidate, preferred_target):
                return preferred_target
        if model_value.endswith(".onnx"):
            candidate = model_value.replace(".onnx", ".onnx.json")
            if download and not preferred_target.exists():
                if _download_asset(candidate, preferred_target):
                    return preferred_target
        return preferred_target if preferred_target.exists() else None
    if model_path and model_path.exists():
        if preferred_target.exists():
            return preferred_target
        alt = model_path.with_suffix(".json")
        if alt.exists():
            return alt
    return None


def resolve_piper_assets(voice_id: str, download: bool) -> tuple[Optional[Path], Optional[Path]]:
    preset = VOICE_PRESET_MAP.get(voice_id)
    if not preset:
        return None, None
    model_value = preset.get("model", "").strip()
    if not model_value:
        return None, None
    model_path = _resolve_asset_path(voice_id, model_value, PIPER_MODEL_DIR, ".onnx", download)
    config_path = _resolve_piper_config(
        voice_id,
        model_value,
        preset.get("config", "").strip(),
        download,
        model_path,
    )
    return model_path, config_path


def resolve_piper_fallback_assets(download: bool) -> tuple[Optional[Path], Optional[Path]]:
    model_value = os.getenv("PIPER_FALLBACK_MODEL", "").strip()
    if not model_value:
        # Default fallback to Amy medium if not specified
        model_value = "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/medium/en_US-amy-medium.onnx"
    
    model_path = _resolve_asset_path("piper-fallback", model_value, PIPER_MODEL_DIR, ".onnx", download)
    config_value = os.getenv("PIPER_FALLBACK_CONFIG", "").strip()
    config_path = _resolve_piper_config("piper-fallback", model_value, config_value, download, model_path)
    return model_path, config_path


def _get_audio_duration(path: Path) -> float:
    try:
        import librosa

        return float(librosa.get_duration(filename=str(path)))
    except Exception as exc:
        logger.warning(f"Failed to read duration for {path}: {exc}")
        return 0.0


def _save_chatterbox_audio(wav, sample_rate: int, output_path: Path) -> float:
    import torchaudio as ta

    ta.save(str(output_path), wav, sample_rate)
    return wav.shape[1] / sample_rate


def _generate_chatterbox_audio(text: str, prompt_path: Optional[Path], output_path: Path) -> float:
    model = get_chatterbox_model()
    if prompt_path:
        wav = model.generate(text, audio_prompt_path=str(prompt_path))
    else:
        wav = model.generate(text)
    return _save_chatterbox_audio(wav, model.sr, output_path)


def _generate_xtts_audio(
    text: str,
    speaker_path: Path,
    language: str,
    output_path: Path,
    model_id: str,
) -> float:
    tts = get_xtts_model(model_id)
    tts.tts_to_file(
        text=text,
        speaker_wav=str(speaker_path),
        language=language or "en",
        file_path=str(output_path),
    )
    return _get_audio_duration(output_path)


def _generate_piper_audio(text: str, model_path: Path, output_path: Path) -> float:
    piper_bin = os.getenv("PIPER_BIN") or shutil.which("piper")
    if not piper_bin:
        raise HTTPException(status_code=500, detail="Piper binary not available.")
    cmd = [piper_bin, "--model", str(model_path), "--output_file", str(output_path)]
    result = subprocess.run(
        cmd,
        input=text.encode("utf-8"),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr.decode("utf-8") or "Piper synthesis failed.")
    return _get_audio_duration(output_path)


class TTSRequest(BaseModel):
    text: str
    voice: Optional[str] = "default"
    format: Optional[str] = "wav"
    use_paralinguistic: Optional[bool] = True


class TTSResponse(BaseModel):
    audio_url: str
    duration: float
    filename: str


class VCRequest(BaseModel):
    text: str
    reference_audio_url: str
    format: Optional[str] = "wav"


class VCResponse(BaseModel):
    audio_url: str
    duration: float
    filename: str


class ModelsResponse(BaseModel):
    models: list[str]
    current_model: str


class VoicePresetEntry(BaseModel):
    id: str
    label: str
    engine: str
    asset_ready: bool


class VoicesResponse(BaseModel):
    voices: list[VoicePresetEntry]


class STTResponse(BaseModel):
    transcript: str
    language: Optional[str] = None
    confidence: Optional[float] = None


# Whisper model cache
_whisper_model = None
_whisper_model_size = os.getenv("WHISPER_MODEL", "base")


def get_whisper_model():
    global _whisper_model
    if _whisper_model is None:
        try:
            import whisper
            logger.info(f"Loading Whisper model: {_whisper_model_size}")
            _whisper_model = whisper.load_model(_whisper_model_size)
            logger.info("Whisper model loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load Whisper model: {e}")
            raise HTTPException(
                status_code=500, detail="STT model not available. Check server logs."
            )
    return _whisper_model


@app.post("/v1/stt/transcribe", response_model=STTResponse)
async def transcribe_audio(
    audio: UploadFile = File(...),
    language: Optional[str] = None
):
    """
    Transcribe audio file to text using Whisper.

    Args:
        audio: Audio file to transcribe (webm, wav, mp3, etc.)
        language: Optional language code (e.g., 'en', 'es', 'fr')

    Returns:
        STTResponse with transcript and metadata
    """
    logger.info(f"STT request: file={audio.filename}, language={language}")

    try:
        start_time = time.time()

        # Save uploaded file temporarily
        temp_input = AUDIO_OUTPUT_DIR / f"stt_input_{int(time.time() * 1000)}_{audio.filename}"
        temp_output = AUDIO_OUTPUT_DIR / f"stt_output_{int(time.time() * 1000)}.wav"

        try:
            with open(temp_input, "wb") as f:
                f.write(await audio.read())

            # Convert to wav if needed (Whisper works with many formats but wav is safest)
            try:
                import ffmpeg
                ffmpeg.input(str(temp_input)).output(
                    str(temp_output),
                    ac=1,  # mono
                    ar=16000,  # 16kHz (Whisper expects this)
                    y=True  # overwrite
                ).run(quiet=True)
                audio_path = temp_output
            except Exception as e:
                logger.warning(f"FFmpeg conversion failed, trying direct: {e}")
                audio_path = temp_input

            # Transcribe with Whisper
            model = get_whisper_model()
            options = {"language": language} if language else {}
            result = model.transcribe(str(audio_path), **options)

            transcript = result.get("text", "").strip()
            detected_language = result.get("language", language or "unknown")

            processing_time = time.time() - start_time
            logger.info(f"Transcription completed in {processing_time:.2f}s: '{transcript[:50]}...'")

            return STTResponse(
                transcript=transcript,
                language=detected_language,
                confidence=result.get("confidence", None)
            )

        finally:
            # Cleanup temp files
            try:
                if temp_input.exists():
                    temp_input.unlink()
                if temp_output.exists():
                    temp_output.unlink()
            except:
                pass

    except Exception as e:
        logger.error(f"STT transcription failed: {e}")
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")


@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "service": "voice-service",
        "model_loaded": _chatterbox_model is not None,
    }


@app.get("/v1/voice/models", response_model=ModelsResponse)
async def list_models():
    return ModelsResponse(
        models=["turbo", "multilingual", "standard", "xtts_v2", "piper"], current_model="turbo"
    )


@app.get("/v1/voice/voices", response_model=VoicesResponse)
async def list_voices():
    voices = []
    for preset in VOICE_PRESETS:
        voice_id = preset["id"]
        engine = preset.get("engine", "chatterbox")
        asset_ready = False
        if engine == "chatterbox":
            prompt_path = resolve_chatterbox_prompt(voice_id, download=False)
            asset_ready = voice_id == "default" or (prompt_path is not None and prompt_path.exists())
        elif engine == "xtts_v2":
            speaker_path = resolve_xtts_speaker(voice_id, download=False)
            asset_ready = speaker_path is not None and speaker_path.exists()
        elif engine == "piper":
            model_path, config_path = resolve_piper_assets(voice_id, download=False)
            asset_ready = (
                model_path is not None
                and model_path.exists()
                and config_path is not None
                and config_path.exists()
            )
        else:
            asset_ready = False
        voices.append(VoicePresetEntry(
            id=voice_id,
            label=preset.get("label", voice_id),
            engine=engine,
            asset_ready=asset_ready,
        ))
    return VoicesResponse(voices=voices)


@app.post("/v1/voice/tts", response_model=TTSResponse)
async def text_to_speech(request: TTSRequest):
    """
    Convert text to speech using the voice registry.

    Args:
        text: Text to convert to speech
        voice: Voice preset id (see /v1/voice/voices) or "default"
        format: Output audio format (wav, mp3)
        use_paralinguistic: Enable paralinguistic tags like [laugh], [chuckle]

    Returns:
        TTSResponse with audio URL and duration
    """
    logger.info(f"TTS request: text length={len(request.text)}, voice={request.voice}")

    try:
        start_time = time.time()

        voice_id = (request.voice or "default").strip()
        preset = VOICE_PRESET_MAP.get(voice_id)
        engine = preset.get("engine", "chatterbox") if preset else "chatterbox"
        format_hint = (request.format or "wav").strip().lower()
        if engine in ("xtts_v2", "piper") and format_hint != "wav":
            logger.warning(f"Engine {engine} only supports wav output. Falling back to wav.")
            format_hint = "wav"
        filename = f"tts_{int(time.time() * 1000)}.{format_hint}"
        output_path = AUDIO_OUTPUT_DIR / filename

        duration = None
        prompt_override = None
        if not preset and voice_id and (_is_url(voice_id) or Path(voice_id).exists()):
            prompt_override = voice_id

        try:
            if engine == "chatterbox":
                prompt_path = None
                if preset:
                    prompt_path = resolve_chatterbox_prompt(voice_id, download=True)
                if not prompt_path and prompt_override:
                    prompt_path = _resolve_asset_path("custom", prompt_override, CHATTERBOX_PROMPT_DIR, ".wav", True)
                duration = _generate_chatterbox_audio(request.text, prompt_path, output_path)
            elif engine == "xtts_v2":
                speaker_path = resolve_xtts_speaker(voice_id, download=True)
                model_id = (preset.get("model") if preset else "") or os.getenv(
                    "XTTS_MODEL_ID", "tts_models/multilingual/multi-dataset/xtts_v2"
                )
                language = (preset.get("language") if preset else "") or "en"
                if not speaker_path:
                    raise RuntimeError("XTTS speaker prompt is missing.")
                duration = _generate_xtts_audio(request.text, speaker_path, language, output_path, model_id)
            elif engine == "piper":
                model_path, config_path = resolve_piper_assets(voice_id, download=True)
                if not model_path or not config_path:
                    raise RuntimeError("Piper model/config not configured.")
                duration = _generate_piper_audio(request.text, model_path, output_path)
            else:
                raise RuntimeError(f"Unsupported engine '{engine}'")
        except Exception as exc:
            logger.warning(f"TTS generation failed for engine {engine}: {exc}")
            duration = None

        if duration is None and engine == "xtts_v2":
            fallback_model, fallback_config = resolve_piper_fallback_assets(download=True)
            if fallback_model and fallback_config:
                try:
                    duration = _generate_piper_audio(request.text, fallback_model, output_path)
                    engine = "piper"
                except Exception as exc:
                    logger.warning(f"Piper fallback failed: {exc}")
                    duration = None

        if duration is None:
            prompt_path = None
            if preset:
                prompt_path = resolve_chatterbox_prompt(voice_id, download=True)
            if not prompt_path and prompt_override:
                prompt_path = _resolve_asset_path("custom", prompt_override, CHATTERBOX_PROMPT_DIR, ".wav", True)
            if prompt_path:
                duration = _generate_chatterbox_audio(request.text, prompt_path, output_path)
            else:
                duration = _generate_chatterbox_audio(request.text, None, output_path)
            engine = "chatterbox"

        generation_time = time.time() - start_time
        logger.info(f"Audio generated with {engine} in {generation_time:.2f}s")

        logger.info(f"Audio saved to {filename}, duration: {duration:.2f}s")

        return TTSResponse(
            audio_url=f"/v1/voice/audio/{filename}",
            duration=duration,
            filename=filename,
        )

    except Exception as e:
        logger.error(f"TTS generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/v1/voice/clone", response_model=VCResponse)
async def voice_clone(request: VCRequest):
    """
    Clone voice from reference audio and generate speech.

    Args:
        text: Text to synthesize
        reference_audio_url: URL or path to reference audio file
        format: Output audio format

    Returns:
        VCResponse with cloned audio URL and duration
    """
    logger.info(f"Voice clone request: ref_audio={request.reference_audio_url}")

    try:
        model = get_chatterbox_model()

        if request.reference_audio_url.startswith("/v1/voice/audio/"):
            filename = request.reference_audio_url.split("/")[-1]
            reference_path = AUDIO_OUTPUT_DIR / filename
        else:
            reference_path = Path(request.reference_audio_url)

        if not reference_path.exists():
            raise HTTPException(status_code=404, detail="Reference audio not found")

        start_time = time.time()

        wav = model.generate(request.text, audio_prompt_path=str(reference_path))

        generation_time = time.time() - start_time
        logger.info(f"Voice clone generated in {generation_time:.2f}s")

        import torchaudio as ta

        filename = f"clone_{int(time.time() * 1000)}.{request.format}"
        output_path = AUDIO_OUTPUT_DIR / filename

        ta.save(str(output_path), wav, model.sr)
        duration = wav.shape[1] / model.sr

        logger.info(f"Cloned audio saved to {filename}, duration: {duration:.2f}s")

        return VCResponse(
            audio_url=f"/v1/voice/audio/{filename}",
            duration=duration,
            filename=filename,
        )

    except Exception as e:
        logger.error(f"Voice clone failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/v1/voice/upload")
async def upload_reference_audio(file: UploadFile = File(...)):
    """
    Upload reference audio for voice cloning.

    Returns:
        URL to access uploaded audio
    """
    try:
        filename = f"ref_{int(time.time())}_{file.filename}"
        output_path = AUDIO_OUTPUT_DIR / filename

        with open(output_path, "wb") as f:
            f.write(await file.read())

        logger.info(f"Reference audio uploaded: {filename}")

        return {
            "status": "ok",
            "audio_url": f"/v1/voice/audio/{filename}",
            "filename": filename,
        }

    except Exception as e:
        logger.error(f"Audio upload failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/v1/voice/audio/{filename}")
async def get_audio(filename: str):
    audio_path = AUDIO_OUTPUT_DIR / filename

    if not audio_path.exists():
        raise HTTPException(status_code=404, detail="Audio file not found")

    return FileResponse(path=audio_path, media_type="audio/wav", filename=filename)


@app.on_event("startup")
async def startup_event():
    logger.info("Starting Allternitchitech Voice Service...")
    logger.info(f"Audio output directory: {AUDIO_OUTPUT_DIR}")
    logger.info(f"Voice presets loaded: {len(VOICE_PRESETS)}")

    if os.getenv("PRELOAD_MODEL", "false").lower() == "true":
        logger.info("Pre-loading Chatterbox model...")
        get_chatterbox_model()

    if os.getenv("PRELOAD_XTTS_MODEL", "false").lower() == "true":
        model_id = os.getenv("XTTS_MODEL_ID", "tts_models/multilingual/multi-dataset/xtts_v2")
        logger.info(f"Pre-loading XTTS model {model_id}...")
        get_xtts_model(model_id)

    if os.getenv("PRELOAD_VOICE_PROMPTS", "true").lower() == "true":
        logger.info("Pre-loading voice prompt library...")
        for preset in VOICE_PRESETS:
            voice_id = preset.get("id", "default")
            engine = preset.get("engine", "chatterbox")
            if voice_id == "default":
                continue
            if engine == "chatterbox":
                resolve_chatterbox_prompt(voice_id, download=True)
            elif engine == "xtts_v2":
                resolve_xtts_speaker(voice_id, download=True)
            elif engine == "piper":
                resolve_piper_assets(voice_id, download=True)

    if os.getenv("PRELOAD_PIPER_FALLBACK", "false").lower() == "true":
        resolve_piper_fallback_assets(download=True)


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", "8001"))
    host = os.getenv("HOST", "127.0.0.1")
    uvicorn.run(app, host=host, port=port)
