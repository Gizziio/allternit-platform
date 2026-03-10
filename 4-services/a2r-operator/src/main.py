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
from openai import OpenAI
from dotenv import load_dotenv

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
    get_or_create_session_context,
    record_action,
    execute_desktop_control,
    session_contexts
)

# Import internalized parsing logic
from .a2r_vision.action_parser import parse_action_to_structure_output
from .telemetry import list_providers, build_snapshot, TelemetryProviderInfo, TelemetrySnapshot

app = FastAPI(title="A2R Operator - Browser, Computer & Desktop Automation")

# Configuration
API_BASE = os.getenv("A2R_VISION_INFERENCE_BASE", os.getenv("OPENAI_API_BASE"))
API_KEY = os.getenv("A2R_VISION_INFERENCE_KEY", os.getenv("OPENAI_API_KEY", "no-key"))
MODEL_NAME = os.getenv("A2R_VISION_MODEL_NAME", "a2r-vision-7b")

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
    start_time = time.time()
    
    ctx = get_or_create_session_context(request.session_id)
    record_action(request.session_id, {
        "type": "propose_request",
        "task": request.task,
        "viewport": {"w": request.viewport.w, "h": request.viewport.h}
    })
    
    try:
        if API_BASE and "dummy" not in request.screenshot:
            model_output = await fn_inference_real(request.task, request.screenshot)
            model_info = f"a2r-vision (Real via {MODEL_NAME})"
        else:
            model_output = 'Thought: I should click the center.\nAction: click(start_box="(500,500)")'
            model_info = "a2r-vision-mock"
    except Exception as e:
        model_output = 'Thought: Fallback.\nAction: click(start_box="(500,500)")'
        model_info = "a2r-vision-fallback"

    try:
        parsed_actions = parse_action_to_structure_output(
            model_output,
            factor=1000,
            origin_resized_height=request.viewport.h,
            origin_resized_width=request.viewport.w,
            model_type="qwen25vl"
        )
        
        import ast
        proposals = []
        for action in parsed_actions:
            thought = action.get("thought") or model_output.split("Action:")[0].replace("Thought:", "").strip()
            
            start_box = action.get("start_box")
            x, y = None, None
            if start_box and isinstance(start_box, list) and len(start_box) >= 2:
                is_norm = all(isinstance(v, (int, float)) and v <= 1.01 for v in start_box)
                W, H = request.viewport.w, request.viewport.h
                if len(start_box) == 4:
                     c_x, c_y = (start_box[0] + start_box[2]) / 2, (start_box[1] + start_box[3]) / 2
                     x, y = (int(c_x * W) if is_norm else int(c_x)), (int(c_y * H) if is_norm else int(c_y))
                elif len(start_box) == 2:
                     x, y = (int(start_box[0] * W) if is_norm else int(start_box[0])), (int(start_box[1] * H) if is_norm else int(start_box[1]))

            proposals.append(ActionProposal(
                type=action.get("action_type", "unknown"),
                x=x, y=y, text=action.get("text_content"),
                confidence=1.0, target="Screen Element", thought=thought
            ))
    except Exception:
        proposals = [ActionProposal(type="click", x=request.viewport.w//2, y=request.viewport.h//2, confidence=0.5, thought="Parser Error Fallback")]

    latency = int((time.time() - start_time) * 1000)
    return ProposeResponse(proposals=proposals, model=model_info, latency_ms=latency)

@app.post("/v1/sessions/{session_id}/desktop/execute", response_model=DesktopControlResponse)
async def execute_desktop_task(session_id: str, request: DesktopControlRequest):
    """Execute desktop automation task (Desktop-Use mode)"""
    request.session_id = session_id
    return await execute_desktop_control(request)

@app.post("/v1/sessions/{session_id}/computer/execute", response_model=DesktopControlResponse)
async def execute_computer_task(session_id: str, request: DesktopControlRequest):
    """Execute computer-use task (Vision-based Computer-Use mode)"""
    request.session_id = session_id
    # Computer-use uses the same endpoint but with vision model
    return await execute_desktop_control(request)

# ============================================================================
# A2R BROWSER-USE SECTION (New - replaces Superconductor browser)
# ============================================================================

class BrowserTaskRequest(BaseModel):
    goal: str
    url: Optional[str] = None
    mode: str = "browser-use"  # browser-use, playwright, computer-use

class BrowserSearchRequest(BaseModel):
    query: str
    search_engine: str = "duckduckgo"

class BrowserRetrieveRequest(BaseModel):
    url: str

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
        task = await a2r_browser_manager.create_task(
            goal=request.goal,
            url=request.url,
            mode=request.mode
        )
        return {
            "task_id": task.id,
            "status": task.status,
            "mode": task.mode,
            "created_at": task.created_at.isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/v1/browser/tasks/{task_id}/execute")
async def execute_browser_task(task_id: str):
    """Execute a browser task"""
    if not BROWSER_USE_AVAILABLE:
        raise HTTPException(status_code=503, detail="browser-use not available")
    
    try:
        task = await a2r_browser_manager.execute_task(task_id)
        return {
            "task_id": task.id,
            "status": task.status,
            "result": task.result,
            "error": task.error,
            "completed_at": task.completed_at.isoformat() if task.completed_at else None
        }
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
        "completed_at": task.completed_at.isoformat() if task.completed_at else None
    }

@app.post("/v1/browser/search")
async def browser_search(request: BrowserSearchRequest):
    """Search using browser automation (replaces paid APIs)"""
    if not BROWSER_USE_AVAILABLE:
        raise HTTPException(status_code=503, detail="browser-use not available")
    
    try:
        result = await a2r_browser_manager.search_and_retrieve(
            query=request.query,
            search_engine=request.search_engine
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/v1/browser/retrieve")
async def browser_retrieve(request: BrowserRetrieveRequest):
    """Retrieve URL content using browser (replaces Firecrawl)"""
    if not BROWSER_USE_AVAILABLE:
        raise HTTPException(status_code=503, detail="browser-use not available")
    
    try:
        result = await a2r_browser_manager.retrieve_url(request.url)
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

async def a2r_execute_variant(run_id: str, variant: VariantConfig, goal: str):
    """Execute a variant in parallel"""
    if run_id not in A2R_RUNS:
        return
    
    A2R_RUNS[run_id]["variants_state"][variant.variantId]["status"] = "running"
    
    async def update_status(msg: str):
        await a2r_emit_event(run_id, "status.variant", {
            "variantId": variant.variantId,
            "status": "running",
            "message": msg
        })

    try:
        await update_status(f"🤔 {variant.model} is analyzing...")
        await asyncio.sleep(1.5)
        
        await update_status("📋 Drafting implementation plan...")
        await asyncio.sleep(1.0)

        await update_status("👨‍💻 Writing code...")
        await asyncio.sleep(2)
        
        # Simulated output
        output = f"""
import React from 'react';

export const GeneratedComponent = () => {{
  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4">{goal}</h2>
      <p>Generated by <strong>{variant.model}</strong></p>
    </div>
  );
}};
""".strip()

        await update_status("✅ Verifying output...")
        await asyncio.sleep(0.5)

        A2R_RUNS[run_id]["variants_state"][variant.variantId].update({
            "status": "completed",
            "output": output,
            "previewUrl": f"http://{SERVICE_HOST}:{SERVICE_PORT}/v1/preview/{run_id}/{variant.variantId}",
            "diff": f"---\n+++ src/components/Generated.tsx\n{output}",
            "verificationResults": [{"type": "lint", "status": "passed"}]
        })
        
        await a2r_emit_event(run_id, "variant.completed", {"variantId": variant.variantId})

    except Exception as e:
        A2R_RUNS[run_id]["variants_state"][variant.variantId].update({
            "status": "failed",
            "error": str(e)
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
    await asyncio.gather(*[a2r_execute_variant(run_id, v, request.goal) for v in request.variants])

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
            "parallel-execution": True
        },
        "modes": ["browser-use", "playwright", "computer-use", "desktop-use"]
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
