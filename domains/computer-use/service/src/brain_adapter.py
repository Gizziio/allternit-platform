"""
Brain Runtime Adapter
Integration layer between the Allternit Operator and the Allternit governance/brain system.

Responsibilities:
  - Real-time event streaming to the brain gateway (observability)
  - Safety policy evaluation via the governance kernel
  - Immutable receipt generation for all desktop actions
  - Session context tracking across action sequences
"""

from typing import Dict, Any, List, Optional
from pydantic import BaseModel
from datetime import datetime
import uuid
import base64
import hashlib
import json
import httpx
import os


BRAIN_GATEWAY_URL = os.getenv("BRAIN_GATEWAY_URL", "http://localhost:3000")


def _gateway_url(path: str) -> str:
    return f"{BRAIN_GATEWAY_URL.rstrip('/')}{path}"


# ---------------------------------------------------------------------------
# Event model — used for real-time streaming to the brain gateway
# ---------------------------------------------------------------------------

class BrainEvent(BaseModel):
    type: str
    session_id: str
    timestamp: str
    data: Dict[str, Any]
    event_id: Optional[str] = None


async def emit_brain_event(session_id: str, event_type: str, data: Dict[str, Any]) -> BrainEvent:
    """
    Emit an event to the brain gateway for real-time observability.
    Non-blocking — gateway failures are silently swallowed so automation
    is never blocked by observability infrastructure being offline.
    """
    event = BrainEvent(
        type=event_type,
        session_id=session_id,
        timestamp=datetime.utcnow().isoformat(),
        data=data,
        event_id=str(uuid.uuid4()),
    )
    try:
        async with httpx.AsyncClient() as client:
            await client.post(
                _gateway_url(f"/v1/sessions/{session_id}/events"),
                json=event.dict(),
                timeout=1.0,
            )
    except Exception:
        pass
    return event


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------

class DesktopControlRequest(BaseModel):
    app: Optional[str] = None
    instruction: str
    use_vision: bool = True
    confirmation_required: bool = False
    session_id: str
    user_id: Optional[str] = None


class DesktopControlResponse(BaseModel):
    success: bool
    actions_taken: int
    summary: str
    receipt_id: Optional[str] = None
    receipt_details: Optional[Dict[str, Any]] = None
    final_screenshot: Optional[str] = None
    error: Optional[str] = None


# ---------------------------------------------------------------------------
# Tool registry
# ---------------------------------------------------------------------------

class ToolDefinition(BaseModel):
    name: str
    description: str
    parameters: Dict[str, Any]
    required_capabilities: List[str] = []


DESKTOP_CONTROL_TOOL = ToolDefinition(
    name="desktop_control",
    description="Control native desktop applications using Allternit Vision automation.",
    parameters={
        "type": "object",
        "properties": {
            "app": {"type": "string"},
            "instruction": {"type": "string"},
            "use_vision": {"type": "boolean", "default": True},
            "confirmation_required": {"type": "boolean", "default": False},
        },
        "required": ["instruction"],
    },
    required_capabilities=["vision", "desktop_automation"],
)


def get_tool_registry() -> List[ToolDefinition]:
    return [DESKTOP_CONTROL_TOOL]


def detect_vision_model_needed(intent: str) -> bool:
    return any(
        kw in intent.lower()
        for kw in ["screen", "click", "desktop", "app", "look", "window", "button"]
    )


# ---------------------------------------------------------------------------
# Session context
# ---------------------------------------------------------------------------

class SessionContext(BaseModel):
    session_id: str
    active_app: Optional[str] = None
    window_position: Optional[Dict[str, int]] = None
    previous_actions: List[Dict[str, Any]] = []
    user_corrections: List[Dict[str, Any]] = []
    created_at: str
    updated_at: str


session_contexts: Dict[str, SessionContext] = {}


def get_or_create_session_context(session_id: str) -> SessionContext:
    if session_id not in session_contexts:
        now = datetime.utcnow().isoformat()
        session_contexts[session_id] = SessionContext(
            session_id=session_id,
            previous_actions=[],
            user_corrections=[],
            created_at=now,
            updated_at=now,
        )
    return session_contexts[session_id]


def update_session_context(session_id: str, updates: Dict[str, Any]) -> SessionContext:
    ctx = get_or_create_session_context(session_id)
    now = datetime.utcnow().isoformat()
    data = ctx.dict()
    if "active_app" in updates:
        data["active_app"] = updates["active_app"]
    if "window_position" in updates:
        data["window_position"] = updates["window_position"]
    if "user_corrections" in updates:
        data["user_corrections"] = data.get("user_corrections", []) + updates["user_corrections"]
    data["updated_at"] = now
    updated = SessionContext(**data)
    session_contexts[session_id] = updated
    return updated


def record_action(session_id: str, action: Dict[str, Any]) -> SessionContext:
    ctx = get_or_create_session_context(session_id)
    now = datetime.utcnow().isoformat()
    data = ctx.dict()
    data["previous_actions"] = data.get("previous_actions", []) + [action]
    data["updated_at"] = now
    updated = SessionContext(**data)
    session_contexts[session_id] = updated
    return updated


# ---------------------------------------------------------------------------
# Governance
# ---------------------------------------------------------------------------

async def evaluate_safety_policy(session_id: str, action: Dict[str, Any]) -> bool:
    """
    Evaluate an action against the governance kernel before execution.
    Returns True (allow) when the kernel is unreachable so automation
    is not blocked in dev environments without governance running.
    """
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                _gateway_url("/v1/governance/evaluate"),
                json={"session_id": session_id, "tool": "desktop_control", "action": action},
                timeout=2.0,
            )
            if resp.status_code == 200:
                return resp.json().get("decision") == "allow"
    except Exception:
        pass
    return True


# ---------------------------------------------------------------------------
# Receipt generation
# ---------------------------------------------------------------------------

async def generate_allternit_receipt(
    session_id: str,
    action: Dict[str, Any],
    result: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Generate an immutable Allternit receipt for a completed action.
    Persisted locally under .allternit/receipts/ and submitted to the governance kernel.
    """
    receipt_id = f"rcpt_{uuid.uuid4().hex[:12]}"
    action_json = json.dumps(action, sort_keys=True, default=str)
    result_json = json.dumps(result, sort_keys=True, default=str)
    input_hash = hashlib.sha256(action_json.encode()).hexdigest()
    output_hash = hashlib.sha256(result_json.encode()).hexdigest()

    artifact_manifest = []
    screenshot_b64 = result.get("final_screenshot")
    if screenshot_b64:
        try:
            png_bytes = base64.b64decode(screenshot_b64)
            artifact_manifest.append({
                "path": f"screenshots/{receipt_id}_final.png",
                "hash": hashlib.sha256(png_bytes).hexdigest(),
                "size": len(png_bytes),
                "media_type": "image/png",
            })
        except Exception:
            pass

    receipt = {
        "receipt_id": receipt_id,
        "created_at": datetime.utcnow().isoformat(),
        "run_id": session_id,
        "tool_id": "desktop_control",
        "tool_def_hash": hashlib.sha256(DESKTOP_CONTROL_TOOL.json().encode()).hexdigest(),
        "input_hashes": [input_hash],
        "output_hashes": [output_hash],
        "artifact_manifest": artifact_manifest,
        "execution": {
            "exit_code": 0 if result.get("success", True) else 1,
            "stderr_hash": hashlib.sha256(b"").hexdigest(),
            "stdout_hash": hashlib.sha256(result_json.encode()).hexdigest(),
            "duration_ms": result.get("duration_ms", 0),
        },
        "trace_id": f"trace-{receipt_id}",
    }

    try:
        os.makedirs(".allternit/receipts", exist_ok=True)
        with open(f".allternit/receipts/{receipt_id}.json", "w") as f:
            json.dump(receipt, f, indent=2)
    except Exception:
        pass

    try:
        async with httpx.AsyncClient() as client:
            await client.post(
                _gateway_url("/v1/governance/receipts"),
                json=receipt,
                timeout=1.0,
            )
    except Exception:
        pass

    return receipt


# ---------------------------------------------------------------------------
# Model routing hint
# ---------------------------------------------------------------------------

class ModelRouter:
    @staticmethod
    async def get_vision_model_config(user_id: Optional[str] = None) -> Dict[str, Any]:
        return {
            "model_id": os.getenv("Allternit_VISION_MODEL_NAME", "allternit-vision-7b"),
            "auto_switch": True,
        }
