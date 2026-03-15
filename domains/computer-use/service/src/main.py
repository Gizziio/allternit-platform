"""
A2R Operator Service
Unified service for A2R automation capabilities:
- Browser-Use: Agent-based browser automation (Chromium + CDP)
- Computer-Use: Vision-based computer control
- Desktop-Use: Desktop automation (A2R Vision)
- Parallel Execution: Multi-variant task execution
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks, Request, Depends, Header
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import uvicorn
import time
import uuid
import sys
import os
import base64
import json
import asyncio
import random
import string
from datetime import datetime
from openai import OpenAI, AsyncOpenAI
from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# Computer-Use package bootstrap
# ---------------------------------------------------------------------------
_CU_DEFAULT_PATH = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "../../../../packages/computer-use")
)
_CU_PATH = os.getenv("A2R_COMPUTER_USE_PATH", _CU_DEFAULT_PATH)
if _CU_PATH not in sys.path:
    sys.path.insert(0, _CU_PATH)

try:
    from core import ActionRequest  # type: ignore
    from adapters.browser.playwright import PlaywrightAdapter  # type: ignore
    from adapters.desktop.pyautogui import PyAutoGUIAdapter  # type: ignore
    from adapters.retrieval import RetrievalAdapter  # type: ignore
    from vision.loop import VisionLoop, VisionLoopResult  # type: ignore
    COMPUTER_USE_ADAPTERS_AVAILABLE = True
except Exception as _cu_import_err:
    print(f"[operator] computer-use adapters not importable: {_cu_import_err}")
    COMPUTER_USE_ADAPTERS_AVAILABLE = False

# Load environment variables
load_dotenv()

# Import A2R Browser-Use
try:
    from .browser_use.manager import a2r_browser_manager, A2RBrowserManager, BrowserTask
    BROWSER_USE_AVAILABLE = True
except ImportError as e:
    print(f"Browser-use not available: {e}")
    BROWSER_USE_AVAILABLE = False

# Import internalized brain adapter for desktop
from .brain_adapter import (
    DesktopControlRequest,
    DesktopControlResponse,
    BrainEvent,
    emit_brain_event,
    get_or_create_session_context,
    record_action,
    generate_a2r_receipt,
    evaluate_safety_policy,
    session_contexts,
)

# Import internalized parsing logic
from .a2r_vision.action_parser import parse_action_to_structure_output
from .telemetry import list_providers, build_snapshot, TelemetryProviderInfo, TelemetrySnapshot

app = FastAPI(title="A2R Operator - Browser, Computer & Desktop Automation")

# Configuration
API_BASE = os.getenv("A2R_VISION_INFERENCE_BASE", os.getenv("OPENAI_API_BASE"))
API_KEY = os.getenv("A2R_VISION_INFERENCE_KEY", os.getenv("OPENAI_API_KEY", "no-key"))
MODEL_NAME = os.getenv("A2R_VISION_MODEL_NAME", "a2r-vision-7b")


class SubprocessLLM:
    """
    LLM adapter for CLI tools already authenticated outside of gizzi.

    Covers:
      - `claude` CLI (Claude Code / claude.ai subscription, already logged in)
      - `llm`, `aichat`, `fabric`, or any tool that reads stdin / flags
      - Custom shell scripts that wrap a proprietary or subscription LLM

    llm_config fields:
      subprocess_cmd  — base command, e.g. "claude" or "/usr/local/bin/llm -m gpt-4o"
      model           — forwarded as --model flag if the cmd doesn't already include it
      subprocess_args — extra args list, merged after cmd
    """

    def __init__(self, cmd: str, model: str = "", extra_args: List[str] = None):
        self._cmd = cmd
        self.model = model or cmd.split()[0]
        self._extra_args = extra_args or []

    @property
    def provider(self) -> str:
        return "subprocess"

    @property
    def name(self) -> str:
        return f"subprocess:{self._cmd.split()[0]}"

    @property
    def model_name(self) -> str:
        return self.model

    def bind(self, **kwargs) -> "SubprocessLLM":
        return self  # kwargs like max_tokens ignored; CLI controls its own limits

    async def ainvoke(self, messages, output_format=None, **kwargs):
        import asyncio, shlex
        from langchain_core.messages import BaseMessage

        # Build prompt: system messages prepended, then user/assistant turns
        parts = []
        for m in messages:
            if hasattr(m, "type"):
                role = m.type  # "system", "human", "ai"
                content = m.content if isinstance(m.content, str) else str(m.content)
                if role == "system":
                    parts.insert(0, content)
                else:
                    parts.append(content)
            else:
                parts.append(str(m))
        prompt = "\n\n".join(parts)

        # Build argv
        argv = shlex.split(self._cmd) + self._extra_args
        # If model not already in cmd, append as --model flag when non-empty
        if self.model and "--model" not in self._cmd and "-m" not in self._cmd:
            argv += ["--model", self.model]

        proc = await asyncio.create_subprocess_exec(
            *argv,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await proc.communicate(input=prompt.encode())

        if proc.returncode != 0:
            err = stderr.decode().strip()
            raise RuntimeError(f"subprocess LLM exited {proc.returncode}: {err}")

        text = stdout.decode().strip()

        # Return a duck-typed object that satisfies browser-use ChatInvokeCompletion
        class _Completion:
            def __init__(self, content):
                self.content = content          # langchain compat
                self.completion = content       # browser-use compat
                self.usage = None
                self.stop_reason = "end_turn"
                self.thinking = None
                self.redacted_thinking = None

        return _Completion(text)


def _build_llm_from_config(llm_config: Optional[Dict[str, Any]]) -> Optional[Any]:
    """
    Build an LLM driver from caller-forwarded config. No hardcoded keys.

    Auth modes (via llm_config.auth_type):
      "api_key"    (default) — standard secret key, sent as Authorization / X-Api-Key header
      "none"       — local model, no auth (Ollama, LM Studio, vLLM); uses placeholder key
      "bearer"     — OAuth / subscription token in Authorization: Bearer header
      "subprocess" — CLI already authed in OS (claude CLI, llm, aichat, …); spawns subprocess

    Provider routing for api_key / bearer / none:
      claude-* or anthropic.com → ChatAnthropic
      everything else           → ChatOpenAI(base_url=…)
    """
    if not llm_config:
        return None

    auth_type  = llm_config.get("auth_type", "api_key")
    base_url   = llm_config.get("base_url", "")
    model      = llm_config.get("model", "")
    api_key    = llm_config.get("api_key", "")
    token      = llm_config.get("token", "")      # bearer / subscription token
    subprocess_cmd = llm_config.get("subprocess_cmd", "")
    extra_args = llm_config.get("subprocess_args", [])

    # ── subprocess: CLI tool already authed in the OS ──────────────────────
    if auth_type == "subprocess" or subprocess_cmd:
        if not subprocess_cmd:
            return None
        return SubprocessLLM(cmd=subprocess_cmd, model=model, extra_args=extra_args)

    if not model:
        return None

    # ── no-auth local model (Ollama, LM Studio, vLLM, …) ──────────────────
    if auth_type == "none":
        if not base_url:
            return None
        try:
            from langchain_openai import ChatOpenAI
            return ChatOpenAI(
                model=model,
                base_url=base_url,
                api_key="no-auth",  # placeholder — local servers ignore it
                temperature=0.1,
            )
        except ImportError:
            return None

    # ── bearer / subscription token ────────────────────────────────────────
    if auth_type == "bearer":
        cred = token or api_key
        if not cred or not base_url:
            return None
        try:
            from langchain_openai import ChatOpenAI
            return ChatOpenAI(
                model=model,
                base_url=base_url,
                api_key=cred,           # most OpenAI-compat proxies accept Bearer in api_key
                default_headers={"Authorization": f"Bearer {cred}"},
                temperature=0.1,
            )
        except ImportError:
            return None

    # ── api_key (default) ──────────────────────────────────────────────────
    if not api_key:
        return None

    is_anthropic = model.startswith("claude-") or "anthropic.com" in (base_url or "")

    if is_anthropic:
        try:
            from langchain_anthropic import ChatAnthropic
            return ChatAnthropic(
                model_name=model,
                anthropic_api_key=api_key,
                **({"anthropic_api_url": base_url} if base_url and "anthropic.com" not in base_url else {}),
                temperature=0.1,
            )
        except ImportError:
            pass  # fall through to OpenAI-compat

    if not base_url:
        return None
    try:
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(model=model, base_url=base_url, api_key=api_key, temperature=0.1)
    except ImportError:
        return None

# Service configuration
SERVICE_PORT = int(os.getenv("A2R_OPERATOR_PORT", "3010"))
SERVICE_HOST = os.getenv("A2R_OPERATOR_HOST", "127.0.0.1")
BRAIN_GATEWAY_URL = os.getenv("BRAIN_GATEWAY_URL", "http://localhost:3000")

# API Key for A2R Operator
EXPECTED_API_KEY = os.getenv("A2R_OPERATOR_API_KEY", "a2r-operator-key")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Authentication Dependency
async def verify_api_key(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
    
    token = authorization.split(" ")[1]
    if token != EXPECTED_API_KEY:
        raise HTTPException(status_code=403, detail="Invalid API Key")
    return token

# ============================================================================
# A2R VISION / DESKTOP SECTION (Existing)
# ============================================================================

class Viewport(BaseModel):
    w: int
    h: int

class ProposeRequest(BaseModel):
    session_id: str
    task: str
    screenshot: str 
    viewport: Viewport
    constraints: Optional[Dict[str, Any]] = None

class ActionProposal(BaseModel):
    type: str
    x: Optional[int] = None
    y: Optional[int] = None
    text: Optional[str] = None
    confidence: float
    target: Optional[str] = None
    thought: Optional[str] = None

class ProposeResponse(BaseModel):
    proposals: List[ActionProposal]
    model: str
    latency_ms: int

async def fn_inference_real(task: str, screenshot_b64: str) -> str:
    """Perform real inference using a VLM API"""
    if not API_BASE:
        raise ValueError("Inference API Base not configured (A2R_VISION_INFERENCE_BASE)")
    
    client = OpenAI(base_url=API_BASE, api_key=API_KEY)
    prompt = f"Task: {task}"
    
    response = client.chat.completions.create(
        model=MODEL_NAME,
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/png;base64,{screenshot_b64}"
                        },
                    },
                ],
            }
        ],
        max_tokens=512,
        temperature=0
    )
    
    return response.choices[0].message.content

@app.post("/v1/vision/propose", response_model=ProposeResponse)
async def propose(request: ProposeRequest):
    """Proposal endpoint for vision-based actions (Desktop/Computer-Use)"""
    # ... existing code ...

@app.get("/v1/vision/screenshot")
async def take_screenshot():
    """Capture a real-time screenshot of the desktop for VLM analysis"""
    import pyautogui
    from io import BytesIO
    import base64
    
    try:
        screenshot = pyautogui.screenshot()
        buffered = BytesIO()
        screenshot.save(buffered, format="PNG")
        img_str = base64.b64encode(buffered.getvalue()).decode()
        return {"screenshot": img_str}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Screenshot failed: {str(e)}")

async def execute_desktop_control(request: DesktopControlRequest) -> DesktopControlResponse:
    """
    Execute a natural-language desktop instruction via PyAutoGUIAdapter + VisionLoop.
    Uses the VLM when A2R_VISION_INFERENCE_BASE is set; falls back to heuristic.
    """
    if not COMPUTER_USE_ADAPTERS_AVAILABLE:
        return DesktopControlResponse(
            success=False,
            actions_taken=0,
            summary="Desktop adapters not available",
            error="COMPUTER_USE_ADAPTERS_AVAILABLE is False — check A2R_COMPUTER_USE_PATH",
        )

    t0 = datetime.utcnow()
    session_id = request.session_id
    run_id = f"desktop-{uuid.uuid4().hex[:12]}"

    action_payload = {"instruction": request.instruction, "app": request.app}
    allowed = await evaluate_safety_policy(session_id, action_payload)
    if not allowed:
        await emit_brain_event(session_id, "tool_call.blocked", {"instruction": request.instruction, "reason": "governance_policy"})
        return DesktopControlResponse(
            success=False,
            actions_taken=0,
            summary="Action blocked by governance policy",
            error="POLICY_DENIED",
        )

    await emit_brain_event(session_id, "tool_call.started", {"tool": "desktop_control", "instruction": request.instruction, "app": request.app, "run_id": run_id})

    try:
        adapter = await _get_or_create_adapter(session_id, "desktop")
    except Exception as exc:
        await emit_brain_event(session_id, "tool_call.error", {"error": str(exc), "run_id": run_id})
        return DesktopControlResponse(
            success=False,
            actions_taken=0,
            summary="Adapter initialization failed",
            error=str(exc),
        )

    try:
        from vision import VisionInference  # type: ignore
        _vi = VisionInference(api_base=API_BASE, api_key=API_KEY, model=MODEL_NAME) if API_BASE else None
    except Exception:
        _vi = None

    goal = request.instruction
    if request.app:
        goal = f"In {request.app}: {request.instruction}"

    loop = VisionLoop(adapter, vision_inference=_vi)  # type: ignore[name-defined]
    loop_result = await loop.run(
        goal=goal,
        session_id=session_id,
        run_id=run_id,
        max_steps=int(os.getenv("A2R_VISION_MAX_STEPS", "10")),
    )

    duration_ms = int((datetime.utcnow() - t0).total_seconds() * 1000)
    success = loop_result.final_status == "success"
    steps_taken = loop_result.steps_taken

    final_screenshot: Optional[str] = None
    try:
        action_req = ActionRequest(action_type="capture_screen", target="", parameters={})
        env = await adapter.execute(action_req, session_id, run_id)
        if env.status == "completed" and isinstance(env.extracted_content, dict):
            final_screenshot = env.extracted_content.get("screenshot_b64")
    except Exception:
        pass

    record_action(session_id, {
        "run_id": run_id,
        "instruction": request.instruction,
        "app": request.app,
        "steps": steps_taken,
        "status": loop_result.final_status,
        "timestamp": t0.isoformat(),
    })

    result_payload = {
        "success": success,
        "steps": steps_taken,
        "final_screenshot": final_screenshot,
        "duration_ms": duration_ms,
    }
    receipt = await generate_a2r_receipt(session_id, action_payload, result_payload)

    await emit_brain_event(session_id, "tool_call.completed", {
        "run_id": run_id,
        "success": success,
        "steps": steps_taken,
        "receipt_id": receipt.get("receipt_id"),
        "duration_ms": duration_ms,
    })

    return DesktopControlResponse(
        success=success,
        actions_taken=steps_taken,
        summary=loop_result.escalation_reason or f"Desktop task {'completed' if success else 'did not complete'} in {steps_taken} step(s)",
        receipt_id=receipt.get("receipt_id"),
        receipt_details=receipt,
        final_screenshot=final_screenshot,
        error=loop_result.escalation_reason if not success else None,
    )


@app.post("/v1/sessions/{session_id}/desktop/execute", response_model=DesktopControlResponse)
async def execute_desktop_task(session_id: str, request: DesktopControlRequest):
    request.session_id = session_id
    return await execute_desktop_control(request)


@app.post("/v1/sessions/{session_id}/computer/execute", response_model=DesktopControlResponse)
async def execute_computer_task(session_id: str, request: DesktopControlRequest):
    request.session_id = session_id
    return await execute_desktop_control(request)

# ============================================================================
# A2R BROWSER-USE SECTION (New - replaces Superconductor browser)
# ============================================================================

class BrowserTaskRequest(BaseModel):
    goal: str
    url: Optional[str] = None
    mode: str = "browser-use"  # browser-use, playwright, computer-use

class ExecuteTaskRequest(BaseModel):
    llm_config: Optional[Dict[str, Any]] = None

class BrowserSearchRequest(BaseModel):
    query: str
    search_engine: str = "duckduckgo"
    llm_config: Optional[Dict[str, Any]] = None

class BrowserRetrieveRequest(BaseModel):
    url: str
    llm_config: Optional[Dict[str, Any]] = None

@app.get("/v1/browser/health")
async def browser_health():
    """Check browser-use availability"""
    return {
        "available": BROWSER_USE_AVAILABLE,
        "service": "a2r-operator",
        "modes": ["browser-use", "playwright", "computer-use"] if BROWSER_USE_AVAILABLE else [],
        "chromium": True,
        "cdp_protocol": True
    }

@app.post("/v1/browser/tasks")
async def create_browser_task(request: BrowserTaskRequest):
    """Create a new browser automation task"""
    if not BROWSER_USE_AVAILABLE:
        raise HTTPException(status_code=503, detail="browser-use not available. Run: pip install browser-use playwright")
    
    try:
        task = a2r_browser_manager.create_task(
            goal=request.goal,
            url=request.url,
            mode=request.mode,
        )
        return {
            "task_id": task.id,
            "status": task.status,
            "mode": task.mode,
            "created_at": task.created_at.isoformat(),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/v1/browser/tasks/{task_id}/execute")
async def execute_browser_task(task_id: str, request: ExecuteTaskRequest = None):
    """Execute a browser task. Requires llm_config in the request body."""
    if not BROWSER_USE_AVAILABLE:
        raise HTTPException(status_code=503, detail="browser-use not available")

    body = request or ExecuteTaskRequest()
    llm = _build_llm_from_config(body.llm_config)
    if llm is None:
        raise HTTPException(
            status_code=422,
            detail="llm_config is required (base_url, api_key, model). Pass the active agent's LLM config.",
        )

    try:
        task = await a2r_browser_manager.execute_task(task_id, llm)
        return {
            "task_id": task.id,
            "status": task.status,
            "result": task.result,
            "error": task.error,
            "completed_at": task.completed_at.isoformat() if task.completed_at else None,
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/v1/browser/tasks/{task_id}")
async def get_browser_task(task_id: str):
    """Get task status"""
    if not BROWSER_USE_AVAILABLE:
        raise HTTPException(status_code=503, detail="browser-use not available")
    
    task = a2r_browser_manager.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    return {
        "task_id": task.id,
        "status": task.status,
        "goal": task.goal,
        "url": task.url,
        "mode": task.mode,
        "result": task.result,
        "error": task.error,
        "created_at": task.created_at.isoformat(),
        "completed_at": task.completed_at.isoformat() if task.completed_at else None,
    }

@app.post("/v1/browser/search")
async def browser_search(request: BrowserSearchRequest):
    """Search using browser automation (replaces paid APIs)"""
    if not BROWSER_USE_AVAILABLE:
        raise HTTPException(status_code=503, detail="browser-use not available")
    
    llm = _build_llm_from_config(request.llm_config)
    if llm is None:
        raise HTTPException(
            status_code=422,
            detail="llm_config is required (base_url, api_key, model).",
        )
    try:
        result = await a2r_browser_manager.search_and_retrieve(
            query=request.query,
            search_engine=request.search_engine,
            llm=llm,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/v1/browser/retrieve")
async def browser_retrieve(request: BrowserRetrieveRequest):
    """Retrieve URL content using browser (replaces Firecrawl)"""
    if not BROWSER_USE_AVAILABLE:
        raise HTTPException(status_code=503, detail="browser-use not available")
    
    llm = _build_llm_from_config(request.llm_config)
    if llm is None:
        raise HTTPException(
            status_code=422,
            detail="llm_config is required (base_url, api_key, model).",
        )
    try:
        result = await a2r_browser_manager.retrieve_url(request.url, llm)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# A2R PARALLEL EXECUTION SECTION (Rebranded from Superconductor)
# ============================================================================

# In-memory storage for runs (replaces Superconductor RUNS)
A2R_RUNS = {}
A2R_EVENT_QUEUES = {}

class VariantConfig(BaseModel):
    variantId: str
    model: str
    agentType: Optional[str] = "code"
    params: Optional[Dict[str, Any]] = {}
    priority: Optional[int] = 1

class VerificationProfile(BaseModel):
    tests: bool = False
    linting: bool = False
    typechecking: bool = False
    customChecks: List[Any] = []

class A2RRunRequest(BaseModel):
    jobId: str
    goal: str
    beadsIssueId: Optional[str] = None
    variants: List[VariantConfig]
    verificationProfile: Optional[VerificationProfile] = None
    snapshotId: Optional[str] = None
    createdAt: Optional[str] = None
    llm_config: Optional[Dict[str, Any]] = None

class A2RRunStatus(BaseModel):
    status: str
    progress: int
    activeVariants: int
    completedVariants: int
    totalVariants: int
    updatedAt: str

class A2RVariantResult(BaseModel):
    variantId: str
    status: str
    output: Optional[str] = None
    previewUrl: Optional[str] = None
    diff: Optional[str] = None
    verificationResults: List[Dict[str, Any]] = []
    error: Optional[str] = None

class A2RRunResults(BaseModel):
    status: str
    variants: List[A2RVariantResult]
    createdAt: str
    completedAt: Optional[str] = None

async def a2r_emit_event(run_id: str, event_type: str, payload: Dict[str, Any]):
    """Emit event for parallel runs"""
    data_dict = {
        "type": event_type,
        "payload": payload,
        "timestamp": datetime.now().isoformat(),
        "variantId": payload.get("variantId")
    }
    data = json.dumps(data_dict)

    # Persist the event to .a2r/autoland/{run_id}.jsonl for Proof of Work
    autoland_dir = os.path.join(os.getcwd(), ".a2r", "autoland")
    os.makedirs(autoland_dir, exist_ok=True)
    pow_path = os.path.join(autoland_dir, f"{run_id}.jsonl")
    try:
        with open(pow_path, "a") as f:
            f.write(data + "\n")
    except Exception as e:
        logger.error(f"Failed to persist proof of work event: {e}")

    if run_id in A2R_EVENT_QUEUES:
        message = f"data: {data}\n\n"
        for queue in A2R_EVENT_QUEUES[run_id]:
            await queue.put(message)

async def a2r_execute_variant(
    run_id: str,
    variant: VariantConfig,
    goal: str,
    llm_config: Optional[Dict[str, Any]] = None,
):
    """Execute a variant using a real LLM call via the forwarded llm_config."""
    if run_id not in A2R_RUNS:
        return

    A2R_RUNS[run_id]["variants_state"][variant.variantId]["status"] = "running"

    async def update_status(msg: str):
        await a2r_emit_event(run_id, "status.variant", {
            "variantId": variant.variantId,
            "status": "running",
            "message": msg,
        })

    if not llm_config or not llm_config.get("api_key"):
        A2R_RUNS[run_id]["variants_state"][variant.variantId].update({
            "status": "failed",
            "error": "llm_config with api_key is required in the run request.",
        })
        await a2r_emit_event(run_id, "variant.failed", {
            "variantId": variant.variantId,
            "error": "No llm_config provided",
        })
        a2r_update_run_progress(run_id)
        return

    try:
        await update_status(f"{variant.model} is analyzing the goal...")

        # Use provider routing so any LLM (Anthropic, OpenAI, Kimi, Groq, Ollama, …) works.
        # Merge variant.model into the config so the right model is used for this variant.
        variant_config = {**llm_config, "model": variant.model}
        lc_llm = _build_llm_from_config(variant_config)

        if lc_llm is None:
            raise ValueError(
                f"Could not build LLM for model={variant.model!r}. "
                "Check llm_config has api_key and (for non-Anthropic providers) base_url."
            )

        agent_type = variant.agentType or "code"
        if agent_type == "code":
            system_prompt = (
                "You are an expert software engineer. "
                "Generate complete, production-quality code based on the user's goal. "
                "Return only the code with no markdown fencing or explanation."
            )
        else:
            system_prompt = (
                "You are an expert AI assistant. Complete the task described by the user."
            )

        await update_status(f"{variant.model} is generating...")

        from langchain_core.messages import HumanMessage, SystemMessage

        # Filter variant.params to safe kwargs that langchain models accept
        lc_kwargs: Dict[str, Any] = {}
        if variant.params:
            for key in ("max_tokens", "temperature", "top_p"):
                if key in variant.params:
                    lc_kwargs[key] = variant.params[key]

        bound = lc_llm.bind(**lc_kwargs) if lc_kwargs else lc_llm
        ai_msg = await bound.ainvoke([
            SystemMessage(content=system_prompt),
            HumanMessage(content=goal),
        ])
        output = ai_msg.content or ""

        await update_status("Verifying output...")

        A2R_RUNS[run_id]["variants_state"][variant.variantId].update({
            "status": "completed",
            "output": output,
            "previewUrl": f"http://{SERVICE_HOST}:{SERVICE_PORT}/v1/preview/{run_id}/{variant.variantId}",
            "diff": f"---\n+++ output/{variant.variantId}\n{output}",
            "verificationResults": [{"type": "generation", "status": "passed", "model": variant.model}],
        })

        await a2r_emit_event(run_id, "variant.completed", {"variantId": variant.variantId})

    except Exception as e:
        A2R_RUNS[run_id]["variants_state"][variant.variantId].update({
            "status": "failed",
            "error": str(e),
        })
        await a2r_emit_event(run_id, "variant.failed", {"variantId": variant.variantId, "error": str(e)})

    a2r_update_run_progress(run_id)

def a2r_update_run_progress(run_id: str):
    """Update run progress"""
    if run_id not in A2R_RUNS:
        return
    v_states = A2R_RUNS[run_id]["variants_state"].values()
    total = len(v_states)
    done = [v for v in v_states if v["status"] in ["completed", "failed"]]
    A2R_RUNS[run_id]["progress"] = int((len(done)/total)*100) if total > 0 else 0
    A2R_RUNS[run_id]["activeVariants"] = len([v for v in v_states if v["status"] == "running"])
    A2R_RUNS[run_id]["completedVariants"] = len(done)
    if len(done) == total:
        A2R_RUNS[run_id]["status"] = "completed"
        A2R_RUNS[run_id]["completedAt"] = datetime.now().isoformat()

async def a2r_process_run(run_id: str, request: A2RRunRequest):
    """Process a parallel run"""
    A2R_RUNS[run_id]["status"] = "running"
    await a2r_emit_event(run_id, "run.started", {"goal": request.goal})
    await asyncio.gather(*[
        a2r_execute_variant(run_id, v, request.goal, request.llm_config)
        for v in request.variants
    ])

@app.post("/v1/parallel/runs", dependencies=[Depends(verify_api_key)])
async def a2r_create_run(request: A2RRunRequest, background_tasks: BackgroundTasks):
    """Create a parallel execution run (replaces Superconductor)"""
    run_id = request.jobId
    A2R_RUNS[run_id] = {
        "status": "pending",
        "progress": 0,
        "activeVariants": 0,
        "completedVariants": 0,
        "totalVariants": len(request.variants),
        "updatedAt": datetime.now().isoformat(),
        "createdAt": request.createdAt or datetime.now().isoformat(),
        "variants_state": {v.variantId: {"variantId": v.variantId, "status": "pending"} for v in request.variants}
    }
    background_tasks.add_task(a2r_process_run, run_id, request)
    return {"jobId": run_id, "status": "accepted"}

@app.get("/v1/parallel/runs/{run_id}/status", response_model=A2RRunStatus)
async def a2r_get_run_status(run_id: str):
    """Get parallel run status"""
    if run_id not in A2R_RUNS:
        raise HTTPException(status_code=404)
    return A2RRunStatus(**A2R_RUNS[run_id])

@app.get("/v1/parallel/runs/{run_id}/results", response_model=A2RRunResults)
async def a2r_get_run_results(run_id: str):
    """Get parallel run results"""
    if run_id not in A2R_RUNS:
        raise HTTPException(status_code=404)
    res = A2R_RUNS[run_id]
    return A2RRunResults(
        status=res["status"],
        variants=[A2RVariantResult(**v) for v in res["variants_state"].values()],
        createdAt=res["createdAt"],
        completedAt=res.get("completedAt")
    )

@app.get("/v1/parallel/runs/{run_id}/events")
async def a2r_stream_events(run_id: str, request: Request):
    """Stream events for parallel run"""
    if run_id not in A2R_RUNS:
        raise HTTPException(status_code=404)
    queue = asyncio.Queue()
    A2R_EVENT_QUEUES.setdefault(run_id, []).append(queue)
    async def gen():
        try:
            while not await request.is_disconnected():
                yield await queue.get()
        finally:
            A2R_EVENT_QUEUES[run_id].remove(queue)
    return StreamingResponse(gen(), media_type="text/event-stream")

@app.get("/v1/operator/autoland/{run_id}/proof_of_work")
async def a2r_get_proof_of_work(run_id: str):
    """Retrieve the stored proof of work events for an autoland run"""
    autoland_dir = os.path.join(os.getcwd(), ".a2r", "autoland")
    pow_path = os.path.join(autoland_dir, f"{run_id}.jsonl")
    
    if not os.path.exists(pow_path):
        raise HTTPException(status_code=404, detail="Proof of work not found")
        
    events = []
    with open(pow_path, "r") as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    events.append(json.loads(line))
                except json.JSONDecodeError:
                    continue
                    
    return {"run_id": run_id, "events": events}

@app.get("/v1/preview/{run_id}/{variant_id}")
async def a2r_get_preview(run_id: str, variant_id: str):
    """Get preview for variant"""
    if run_id in A2R_RUNS and variant_id in A2R_RUNS[run_id]["variants_state"]:
        output = A2R_RUNS[run_id]["variants_state"][variant_id].get("output", "")
        html = f"<html><body style='font-family:sans-serif;padding:20px;'><h3>Preview: {variant_id}</h3><pre>{output}</pre></body></html>"
        return StreamingResponse(iter([html]), media_type="text/html")
    raise HTTPException(status_code=404)

# ============================================================================
# /v1/execute  — Unified gateway (GIZZI BrowserTool → adapters)
# ============================================================================

# ---------------------------------------------------------------------------
# Session persistence — file-backed metadata store
# ---------------------------------------------------------------------------

class SessionStore:
    """
    Persists session metadata to .a2r/sessions/sessions.json so sessions
    survive operator restarts. Adapter instances (Playwright pages, etc.)
    cannot be serialised — only lightweight metadata is stored. On reconnect
    the last_url is used to restore the browser to the right page.
    """

    _PATH = os.path.join(".a2r", "sessions", "sessions.json")

    def __init__(self):
        os.makedirs(os.path.dirname(self._PATH), exist_ok=True)
        self._data: Dict[str, Any] = self._load()

    def _load(self) -> Dict[str, Any]:
        try:
            with open(self._PATH) as f:
                return json.load(f)
        except Exception:
            return {}

    def _flush(self):
        try:
            with open(self._PATH, "w") as f:
                json.dump(self._data, f, indent=2)
        except Exception:
            pass

    def set(self, session_id: str, metadata: Dict[str, Any]):
        self._data[session_id] = metadata
        self._flush()

    def get(self, session_id: str) -> Optional[Dict[str, Any]]:
        return self._data.get(session_id)

    def update(self, session_id: str, patch: Dict[str, Any]):
        if session_id in self._data:
            self._data[session_id].update(patch)
        else:
            self._data[session_id] = patch
        self._flush()

    def delete(self, session_id: str):
        self._data.pop(session_id, None)
        self._flush()

    def all(self) -> Dict[str, Any]:
        return dict(self._data)


_session_store = SessionStore()

# Per-session adapter cache: { session_id: { "browser": PlaywrightAdapter, "desktop": PyAutoGUIAdapter } }
_GATEWAY_SESSIONS: Dict[str, Dict[str, Any]] = {}


class GatewayExecuteRequest(BaseModel):
    """Request shape emitted by browser.ts callComputerUseGateway()."""
    action: str                                 # goto | click | fill | extract | screenshot | inspect | execute
    session_id: Optional[str] = None
    run_id: Optional[str] = None
    target: Optional[str] = None               # URL for goto; CSS selector for click/fill
    goal: Optional[str] = None                 # Natural-language goal (execute action)
    parameters: Optional[Dict[str, Any]] = {}  # text, message_id, call_id, …
    adapter_preference: Optional[str] = None   # playwright | browser-use | cdp | desktop
    llm_config: Optional[Dict[str, Any]] = None  # {base_url, api_key, model} forwarded from the calling LLM


class GatewayArtifact(BaseModel):
    type: str
    url: Optional[str] = None
    mime: Optional[str] = None
    data: Optional[str] = None  # base64 for inline screenshots


class GatewayReceipt(BaseModel):
    action: str
    timestamp: str
    success: bool


class GatewayExecuteResponse(BaseModel):
    run_id: str
    session_id: str
    adapter_id: str
    family: str
    mode: str
    status: str
    summary: Optional[str] = None
    extracted_content: Optional[Any] = None
    artifacts: List[GatewayArtifact] = []
    receipts: List[GatewayReceipt] = []
    error: Optional[Dict[str, Any]] = None
    trace_id: str


def _action_to_cu_request(req: GatewayExecuteRequest) -> tuple:
    """
    Map a GatewayExecuteRequest to (action_type, target, parameters, family).
    Returns a tuple suitable for constructing an ActionRequest.
    """
    action = req.action.lower()
    params = dict(req.parameters or {})
    if req.adapter_preference == "desktop":
        family = "desktop"
    elif req.adapter_preference in ("retrieval", "http"):
        family = "retrieval"
    else:
        family = "browser"

    if action == "goto":
        return "goto", req.target or "", params, "browser"
    elif action == "click":
        params.setdefault("selector", req.target or "")
        return "act", req.target or "", params, "browser"
    elif action == "fill":
        params.setdefault("selector", req.target or "")
        params.setdefault("text", req.parameters.get("text", "") if req.parameters else "")
        return "act", req.target or "", params, "browser"
    elif action == "extract":
        return "extract", req.target or "", params, "browser"
    elif action in ("fetch", "scrape", "download", "head", "post"):
        return action, req.target or "", params, "retrieval"
    elif action == "search":
        params.setdefault("query", req.parameters.get("query", req.target or "") if req.parameters else (req.target or ""))
        params.setdefault("engine", req.parameters.get("engine", "duckduckgo") if req.parameters else "duckduckgo")
        return "search", req.target or "", params, "retrieval"
    elif action == "screenshot":
        return "screenshot", req.target or "", params, family
    elif action == "inspect":
        return "observe", req.target or "", params, "browser"
    elif action == "execute":
        # High-level goal execution — route to desktop if preference says so
        if family == "desktop":
            params["goal"] = req.goal or ""
            return "observe", "", params, "desktop"
        else:
            params["goal"] = req.goal or ""
            return "extract", req.target or "", params, "browser"
    else:
        return action, req.target or "", params, family


async def _get_or_create_adapter(session_id: str, family: str) -> Any:
    """
    Get a cached adapter for this session+family, creating it if needed.
    On first creation the session is registered in the persistent store.
    If a browser session has a stored last_url it navigates back there on
    reconnect (i.e. after an operator restart).
    """
    if not COMPUTER_USE_ADAPTERS_AVAILABLE:
        raise RuntimeError("computer-use adapters not available — check A2R_COMPUTER_USE_PATH")

    session = _GATEWAY_SESSIONS.setdefault(session_id, {})
    meta = _session_store.get(session_id) or {}

    if family == "retrieval":
        if "retrieval" not in session:
            adapter = RetrievalAdapter()
            await adapter.initialize()
            session["retrieval"] = adapter
            _session_store.set(session_id, {
                **meta,
                "session_id": session_id,
                "adapters": list(set(meta.get("adapters", []) + ["retrieval"])),
                "created_at": meta.get("created_at", datetime.utcnow().isoformat()),
                "last_used_at": datetime.utcnow().isoformat(),
            })
        return session["retrieval"]
    elif family == "desktop":
        if "desktop" not in session:
            adapter = PyAutoGUIAdapter()
            await adapter.initialize()
            session["desktop"] = adapter
            _session_store.set(session_id, {
                **meta,
                "session_id": session_id,
                "adapters": list(set(meta.get("adapters", []) + ["desktop"])),
                "created_at": meta.get("created_at", datetime.utcnow().isoformat()),
                "last_used_at": datetime.utcnow().isoformat(),
            })
        return session["desktop"]
    else:
        if "browser" not in session:
            adapter = PlaywrightAdapter()
            await adapter.initialize()
            session["browser"] = adapter
            # Restore last URL if session existed before operator restart
            last_url = meta.get("last_url")
            if last_url:
                try:
                    from core import ActionRequest as _AR  # type: ignore
                    await adapter.execute(_AR(action_type="goto", target=last_url, parameters={}), session_id, "restore")
                except Exception:
                    pass  # Restoration is best-effort
            _session_store.set(session_id, {
                **meta,
                "session_id": session_id,
                "adapters": list(set(meta.get("adapters", []) + ["browser"])),
                "created_at": meta.get("created_at", datetime.utcnow().isoformat()),
                "last_used_at": datetime.utcnow().isoformat(),
            })
        return session["browser"]


def _envelope_to_response(
    envelope: Any,
    req: GatewayExecuteRequest,
    adapter: Any,
    mode: str,
    trace_id: str,
) -> GatewayExecuteResponse:
    """Convert a ResultEnvelope to the GatewayExecuteResponse JSON shape."""
    session_id = req.session_id or ""
    run_id = req.run_id or trace_id

    # Artifacts: convert screenshot bytes to base64 data URI
    artifacts: List[GatewayArtifact] = []
    for art in getattr(envelope, "artifacts", []):
        if hasattr(art, "to_dict"):
            art_dict = art.to_dict()
        elif hasattr(art, "__dict__"):
            art_dict = art.__dict__
        else:
            art_dict = {}
        art_type = art_dict.get("type", "unknown")
        art_path = art_dict.get("path", "")

        if art_type == "screenshot" and art_dict.get("data"):
            raw = art_dict["data"]
            b64 = base64.b64encode(raw).decode() if isinstance(raw, bytes) else raw
            artifacts.append(GatewayArtifact(
                type="screenshot",
                mime="image/png",
                url=f"data:image/png;base64,{b64}",
            ))
        elif art_type == "screenshot" and art_path.startswith("data:image"):
            # Injected inline data from screenshot post-processing
            artifacts.append(GatewayArtifact(
                type="screenshot",
                mime="image/png",
                url=art_path,
            ))
        else:
            artifacts.append(GatewayArtifact(
                type=art_type,
                url=art_path or art_dict.get("url"),
                mime=art_dict.get("media_type") or art_dict.get("mime"),
            ))

    # Receipts — envelope.receipts is a list of receipt ID strings (not objects)
    receipts: List[GatewayReceipt] = []
    for r in getattr(envelope, "receipts", []):
        if isinstance(r, str):
            # receipt ID string — convert to lightweight receipt record
            receipts.append(GatewayReceipt(
                action=req.action,
                timestamp=datetime.utcnow().isoformat(),
                success=getattr(envelope, "status", "completed") == "completed",
            ))
        else:
            r_dict = r.to_dict() if hasattr(r, "to_dict") else (r.__dict__ if hasattr(r, "__dict__") else {})
            receipts.append(GatewayReceipt(
                action=r_dict.get("action_type", req.action),
                timestamp=r_dict.get("timestamp", datetime.utcnow().isoformat()),
                success=r_dict.get("status", "completed") in ("completed", "success"),
            ))

    # Summary from extracted_content
    ec = getattr(envelope, "extracted_content", None)
    summary: Optional[str] = None
    if isinstance(ec, dict):
        summary = ec.get("title") or ec.get("url") or ec.get("summary")
    elif isinstance(ec, str) and len(ec) < 200:
        summary = ec

    return GatewayExecuteResponse(
        run_id=run_id or trace_id,
        session_id=session_id,
        adapter_id=getattr(adapter, "adapter_id", "unknown"),
        family=getattr(adapter, "family", "browser"),
        mode=mode,
        status=getattr(envelope, "status", "completed"),
        summary=summary,
        extracted_content=ec,
        artifacts=artifacts,
        receipts=receipts,
        error=getattr(envelope, "error", None),
        trace_id=trace_id,
    )


@app.post("/v1/execute", response_model=GatewayExecuteResponse)
async def gateway_execute(req: GatewayExecuteRequest):
    """
    Unified GIZZI → Computer-Use gateway.

    Accepts the request format produced by browser.ts callComputerUseGateway()
    and routes it to the appropriate adapter (PlaywrightAdapter for browser
    actions, PyAutoGUIAdapter for desktop actions).

    Per-session adapter instances are cached so that a goto → extract → click
    sequence shares the same browser page.
    """
    if not COMPUTER_USE_ADAPTERS_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="computer-use adapters not available. Check A2R_COMPUTER_USE_PATH and adapter dependencies."
        )

    trace_id = str(uuid.uuid4())
    session_id = req.session_id or f"gw-{trace_id[:8]}"
    run_id = req.run_id or trace_id

    action_type, target, params, family = _action_to_cu_request(req)

    # Resolve effective adapter from preference.
    # Golden-path routing:
    #   - goto/click/fill/extract/inspect/screenshot  → Playwright (deterministic)
    #   - execute + browser-use preference            → browser-use (LLM-powered)
    #   - execute + desktop preference                → PyAutoGUI + VisionLoop
    #   - execute + no preference / playwright        → Playwright + VisionLoop
    pref = (req.adapter_preference or "playwright").lower()
    if pref == "desktop":
        family = "desktop"
    elif pref in ("retrieval", "http"):
        family = "retrieval"
    elif req.action.lower() in ("fetch", "scrape", "download", "head", "post", "search"):
        family = "retrieval"  # retrieval actions always go to retrieval adapter
    elif req.action == "execute" and pref == "browser-use":
        family = "browser-use"  # handled below; no Playwright adapter needed
    else:
        family = "browser"  # Playwright for all concrete actions

    mode_map = {
        "browser": "execute",
        "browser-use": "execute",
        "desktop": "desktop",
    }
    mode = mode_map.get(family, "execute")

    # ------------------------------------------------------------------
    # browser-use path: route execute goals to A2RBrowserManager
    # ------------------------------------------------------------------
    if family == "browser-use":
        _bu_llm = _build_llm_from_config(req.llm_config or {})
        if not BROWSER_USE_AVAILABLE:
            raise HTTPException(status_code=503, detail="browser-use package not installed.")
        if _bu_llm is None:
            raise HTTPException(
                status_code=422,
                detail=(
                    "llm_config is required: provide api_key and model "
                    "(and base_url for non-Anthropic providers). "
                    "Supported: Anthropic (claude-*), OpenAI, Kimi, Groq, Ollama, any OpenAI-compatible endpoint."
                ),
            )
        try:
            mode = "execute"
            task = BrowserTask(
                goal=req.goal or req.target or "",
                session_id=session_id,
                run_id=run_id,
                starting_url=req.target or None,
            )
            bu_result = await a2r_browser_manager.run_task(task, llm=_bu_llm)
            bu_status = "completed" if bu_result.get("status") == "success" else "failed"
            return GatewayExecuteResponse(
                run_id=run_id,
                session_id=session_id,
                adapter_id="browser-use",
                family="browser",
                mode=mode,
                status=bu_status,
                summary=bu_result.get("summary") or f"browser-use {bu_status}",
                extracted_content=bu_result.get("extracted_content"),
                artifacts=[
                    GatewayArtifact(
                        type="screenshot",
                        mime="image/png",
                        url=sc,
                    )
                    for sc in (bu_result.get("screenshots") or [])
                    if sc
                ],
                receipts=[GatewayReceipt(
                    action="execute",
                    timestamp=datetime.utcnow().isoformat(),
                    success=bu_status == "completed",
                )],
                error={"code": "BROWSER_USE_FAILED", "message": bu_result.get("error", "")} if bu_status == "failed" else None,
                trace_id=trace_id,
            )
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"browser-use execution failed: {e}")

    try:
        adapter = await _get_or_create_adapter(session_id, family)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Adapter init failed: {e}")

    # ------------------------------------------------------------------
    # Execute action — route high-level goals through the VisionLoop;
    # all other actions go directly to the adapter.
    # ------------------------------------------------------------------

    if req.action == "execute" and req.goal and COMPUTER_USE_ADAPTERS_AVAILABLE:
        # Vision loop: observe → decide → act → verify (up to max_steps)
        mode = "execute"
        try:
            # Wire VLM if the inference endpoint is configured; heuristic fallback otherwise
            try:
                from vision import VisionInference  # type: ignore
                _vi = VisionInference(api_base=API_BASE, api_key=API_KEY, model=MODEL_NAME) if API_BASE else None
            except Exception:
                _vi = None
            loop = VisionLoop(adapter, vision_inference=_vi)
            loop_result: VisionLoopResult = await loop.run(
                goal=req.goal,
                session_id=session_id,
                run_id=run_id,
                max_steps=int(os.getenv("A2R_VISION_MAX_STEPS", "10")),
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"VisionLoop error: {e}")

        # Convert VisionLoopResult → GatewayExecuteResponse
        loop_status = "completed" if loop_result.final_status == "success" else "failed"
        return GatewayExecuteResponse(
            run_id=run_id,
            session_id=session_id,
            adapter_id=getattr(adapter, "adapter_id", "unknown"),
            family=getattr(adapter, "family", "browser"),
            mode=mode,
            status=loop_status,
            summary=f"Vision loop {loop_result.final_status} after {loop_result.steps_taken} step(s)",
            extracted_content={
                "goal": loop_result.goal,
                "final_status": loop_result.final_status,
                "steps_taken": loop_result.steps_taken,
                "steps": loop_result.steps,
                "escalation_reason": loop_result.escalation_reason,
                "started_at": loop_result.started_at,
                "completed_at": loop_result.completed_at,
            },
            artifacts=[],
            receipts=[GatewayReceipt(
                action="execute",
                timestamp=loop_result.completed_at or datetime.utcnow().isoformat(),
                success=loop_result.final_status == "success",
            )],
            error={
                "code": f"VISION_{loop_result.final_status.upper()}",
                "message": loop_result.escalation_reason or "",
            } if loop_result.final_status != "success" else None,
            trace_id=trace_id,
        )

    try:
        cu_action = ActionRequest(
            action_type=action_type,
            target=target,
            parameters=params,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid action request: {e}")

    try:
        envelope = await adapter.execute(cu_action, session_id, run_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Adapter execution error: {e}")

    # Persist last_url after a successful goto so browser can restore on reconnect
    if action_type == "goto" and envelope.status == "completed":
        url_now = (envelope.extracted_content or {}).get("url") if isinstance(envelope.extracted_content, dict) else None
        if url_now:
            _session_store.update(session_id, {"last_url": url_now, "last_used_at": datetime.utcnow().isoformat()})
    else:
        _session_store.update(session_id, {"last_used_at": datetime.utcnow().isoformat()})

    # Screenshot post-processing: PlaywrightAdapter captures bytes but doesn't persist them.
    # Grab the bytes directly from the page and inject as base64 data URI artifact.
    if action_type == "screenshot" and envelope.status == "completed":
        try:
            page = getattr(adapter, "_page", None)
            if page:
                raw = await page.screenshot()
                b64 = base64.b64encode(raw).decode()
                from core import Artifact  # type: ignore
                envelope.artifacts = [
                    Artifact(
                        type="screenshot",
                        path=f"data:image/png;base64,{b64}",
                        media_type="image/png",
                        size_bytes=len(raw),
                    )
                ]
        except Exception:
            pass  # Leave original artifact if page access fails

    return _envelope_to_response(envelope, req, adapter, mode, trace_id)


@app.delete("/v1/sessions/{session_id}")
async def close_gateway_session(session_id: str):
    """
    Close and remove all adapters associated with a gateway session.
    Called when GIZZI finishes a task or the user closes the tool.
    """
    if session_id not in _GATEWAY_SESSIONS:
        raise HTTPException(status_code=404, detail="Session not found")

    session = _GATEWAY_SESSIONS.pop(session_id)
    for adapter in session.values():
        try:
            await adapter.close()
        except Exception:
            pass

    _session_store.delete(session_id)
    return {"session_id": session_id, "status": "closed"}


@app.get("/v1/sessions")
async def list_gateway_sessions():
    """List active gateway sessions (in-memory) plus persisted metadata."""
    persisted = _session_store.all()
    active_ids = set(_GATEWAY_SESSIONS.keys())
    sessions = []
    # Merge in-memory (live) with persisted (may include disconnected sessions)
    all_ids = active_ids | set(persisted.keys())
    for sid in sorted(all_ids):
        meta = persisted.get(sid, {})
        sessions.append({
            "session_id": sid,
            "live": sid in active_ids,
            "adapters": list(_GATEWAY_SESSIONS[sid].keys()) if sid in active_ids else meta.get("adapters", []),
            "last_url": meta.get("last_url"),
            "created_at": meta.get("created_at"),
            "last_used_at": meta.get("last_used_at"),
        })
    return {"sessions": sessions}


# ============================================================================
# SHARED ENDPOINTS
# ============================================================================

@app.get("/v1/receipts/{receipt_id}")
async def get_receipt(receipt_id: str):
    """Retrieve a specific receipt by ID"""
    try:
        receipt_path = f".a2r/receipts/{receipt_id}.json"
        if os.path.exists(receipt_path):
            with open(receipt_path, "r") as f:
                receipt_data = json.load(f)
            return receipt_data
        else:
            raise HTTPException(status_code=404, detail="Receipt not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving receipt: {str(e)}")

@app.get("/health")
async def health():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "a2r-operator",
        "capabilities": {
            "browser-use": BROWSER_USE_AVAILABLE,
            "computer-use": True,
            "desktop-use": True,
            "parallel-execution": True,
            "gateway": COMPUTER_USE_ADAPTERS_AVAILABLE,
        },
        "modes": ["browser-use", "playwright", "computer-use", "desktop-use"],
        "gateway_endpoint": "/v1/execute",
        "active_sessions": len(_GATEWAY_SESSIONS),
    }

@app.get("/v1/telemetry/providers", response_model=List[TelemetryProviderInfo])
async def get_providers(api_key: str = Depends(verify_api_key)):
    return list_providers()


@app.get("/v1/telemetry/sessions/{session_id}", response_model=TelemetrySnapshot)
async def get_snapshot(session_id: str, provider_id: Optional[str] = None, api_key: str = Depends(verify_api_key)):
    providers = list_providers()
    provider = None
    if provider_id:
        provider = next((p for p in providers if p.id == provider_id), None)
    if not provider and providers:
        provider = providers[0]
    return build_snapshot(session_id, provider)

@app.on_event("shutdown")
async def shutdown_event():
    """Clean up resources"""
    if BROWSER_USE_AVAILABLE:
        await a2r_browser_manager.close()

if __name__ == "__main__":
    uvicorn.run(app, host=SERVICE_HOST, port=SERVICE_PORT)
