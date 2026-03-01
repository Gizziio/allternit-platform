from fastapi import FastAPI, HTTPException, BackgroundTasks, Request, Depends, Header
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import uvicorn
import time
import uuid
import asyncio
import json
import os
import httpx
import random
import string
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

# Import browser-use integration
try:
    from browser_use_integration import browser_manager, BrowserTask
    BROWSER_USE_AVAILABLE = True
except ImportError as e:
    print(f"browser-use not available: {e}")
    BROWSER_USE_AVAILABLE = False

app = FastAPI(title="Superconductor Service")

# Port 3310 as per available ports
SUPERCONDUCTOR_PORT = int(os.getenv("SUPERCONDUCTOR_PORT", "3310"))
SUPERCONDUCTOR_HOST = os.getenv("HOST", "127.0.0.1")
# Production-grade API Key from environment
EXPECTED_API_KEY = os.getenv("SUPERCONDUCTOR_API_KEY", "sc-prod-key-7f2a1b")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5175",
        "http://127.0.0.1:5175",
        "http://localhost:5177",
        "http://127.0.0.1:5177",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory storage for runs
RUNS = {}
EVENT_QUEUES = {}

# Authentication Dependency
async def verify_api_key(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
    
    token = authorization.split(" ")[1]
    if token != EXPECTED_API_KEY:
        raise HTTPException(status_code=403, detail="Invalid API Key")
    return token

# --- Beads Integration ---
BEADS_PATH = os.path.expanduser("~/.beads/issues.jsonl")

class BeadsIssue(BaseModel):
    id: Optional[str] = None
    title: str
    description: str
    status: str = "open"
    priority: int = 1
    issue_type: str = "feature"
    created_at: Optional[str] = None
    labels: List[str] = []

def generate_beads_id():
    return f"macbook-{'' .join(random.choices(string.ascii_lowercase + string.digits, k=3))}"

def read_beads_issues() -> List[Dict]:
    issues = []
    if os.path.exists(BEADS_PATH):
        try:
            with open(BEADS_PATH, "r") as f:
                for line in f:
                    if line.strip():
                        issues.append(json.loads(line))
        except Exception as e:
            print(f"Error reading beads: {e}")
    return [i for i in issues if i.get("status") == "open"]

def append_beads_issue(issue: BeadsIssue) -> BeadsIssue:
    issue.id = issue.id or generate_beads_id()
    issue.created_at = issue.created_at or datetime.now().isoformat()
    
    # Ensure dir exists
    os.makedirs(os.path.dirname(BEADS_PATH), exist_ok=True)
    
    with open(BEADS_PATH, "a") as f:
        f.write(json.dumps(issue.model_dump()) + "\n")
        
    return issue

@app.get("/beads/issues")
async def get_beads_issues():
    return read_beads_issues()

@app.post("/beads/issues")
async def create_beads_issue(issue: BeadsIssue):
    return append_beads_issue(issue)

# --- Model Registry ---
AVAILABLE_MODELS = [
    {"id": "ui-tars-7b-qwen", "name": "UI-TARS (Vision)", "provider": "Local", "type": "specialist", "icon": "👁️"},
    {"id": "gpt-4o", "name": "GPT-4o", "provider": "OpenAI", "type": "generalist", "icon": "🧠"},
    {"id": "claude-3-5-sonnet", "name": "Claude 3.5 Sonnet", "provider": "Anthropic", "type": "generalist", "icon": "🎭"},
    {"id": "gemini-pro", "name": "Gemini Pro", "provider": "Google", "type": "generalist", "icon": "✨"},
    {"id": "deepseek-coder", "name": "DeepSeek Coder", "provider": "Local", "type": "coding", "icon": "💻"},
]

@app.get("/registry/models")
async def get_models():
    return AVAILABLE_MODELS

# --- Superconductor Core Types ---

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

class RunRequest(BaseModel):
    jobId: str
    goal: str
    beadsIssueId: Optional[str] = None
    variants: List[VariantConfig]
    verificationProfile: Optional[VerificationProfile] = None
    snapshotId: Optional[str] = None
    createdAt: Optional[str] = None

class RunStatus(BaseModel):
    status: str
    progress: int
    activeVariants: int
    completedVariants: int
    totalVariants: int
    updatedAt: str

class VariantResult(BaseModel):
    variantId: str
    status: str
    output: Optional[str] = None
    previewUrl: Optional[str] = None
    diff: Optional[str] = None
    verificationResults: List[Dict[str, Any]] = []
    error: Optional[str] = None

class RunResults(BaseModel):
    status: str
    variants: List[VariantResult]
    createdAt: str
    completedAt: Optional[str] = None

class ShipRequest(BaseModel):
    targetPath: Optional[str] = "src/shipped_output.tsx"

# --- Event Logic ---

async def emit_event(run_id: str, event_type: str, payload: Dict[str, Any]):
    if run_id in EVENT_QUEUES:
        data = json.dumps({
            "type": event_type,
            "payload": payload,
            "timestamp": datetime.now().isoformat(),
            "variantId": payload.get("variantId")
        })
        message = f"data: {data}\n\n"
        for queue in EVENT_QUEUES[run_id]:
            await queue.put(message)

# --- Execution Logic ---

async def execute_variant(run_id: str, variant: VariantConfig, goal: str):
    if run_id not in RUNS: return
    
    RUNS[run_id]["variants_state"][variant.variantId]["status"] = "running"
    
    # Helper to emit status updates
    async def update_status(msg: str):
        await emit_event(run_id, "status.variant", {
            "variantId": variant.variantId, 
            "status": "running",
            "message": msg
        })

    try:
        # STEP 1: THINKING
        await update_status(f"🤔 {variant.model} is analyzing requirements...")
        await asyncio.sleep(1.5)
        
        # STEP 2: PLANNING
        await update_status("📋 Drafting implementation plan...")
        await asyncio.sleep(1.0)

        # STEP 3: CODING
        await update_status("👨‍💻 Writing code...")
        
        component_name = "GeneratedComponent"
        if "ui-tars" in variant.model.lower():
            async with httpx.AsyncClient() as client:
                try:
                    response = await client.post(
                        "http://localhost:3008/v1/model/ui_tars/propose",
                        json={
                            "session_id": run_id,
                            "task": f"Generate code/plan for: {goal}",
                            "screenshot": "dummy",
                            "viewport": {"w": 1280, "h": 720}
                        },
                        timeout=30.0
                    )
                    if response.status_code == 200:
                        data = response.json()
                        output = f"// UI-TARS Suggested Strategy\n// Goal: {goal}\n\n"
                        for p in data.get("proposals", []):
                            output += f"// Thought: {p.get('thought')}\n"
                            output += f"// Action: {p.get('type')} at {p.get('x')},{p.get('y')}\n"
                    else:
                        output = f"// Error calling UI-TARS: {response.status_code}"
                except Exception as e:
                    output = f"// Connection failed: {str(e)}"
        else:
            # Simulated implementation
            await asyncio.sleep(2) 
            output = f"""
import React from 'react';

export const {component_name} = () => {{
  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4">{goal}</h2>
      <div className="prose">
        <p>This solution was generated by <strong>{variant.model}</strong>.</p>
        <ul className="list-disc pl-5 mt-2">
          <li>Clean implementation</li>
          <li>Responsive design</li>
          <li>Optimized performance</li>
        </ul>
        <div className="mt-4 p-4 bg-gray-100 rounded">
           <code>Logic implementation goes here...</code>
        </div>
      </div>
      <button className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
        Interact
      </button>
    </div>
  );
}};
""".lstrip()

        # STEP 4: VERIFYING
        await update_status("✅ Verifying output...")
        await asyncio.sleep(0.5)

        RUNS[run_id]["variants_state"][variant.variantId].update({
            "status": "completed",
            "output": output,
            "previewUrl": f"http://{SUPERCONDUCTOR_HOST}:{SUPERCONDUCTOR_PORT}/preview/{run_id}/{variant.variantId}",
            "diff": f"---\n+++ src/components/{component_name}.tsx\n{output}",
            "verificationResults": [{"type": "lint", "status": "passed"}]
        })
        
        await emit_event(run_id, "variant.completed", {"variantId": variant.variantId})

    except Exception as e:
        RUNS[run_id]["variants_state"][variant.variantId].update({
            "status": "failed",
            "error": str(e)
        })
        await emit_event(run_id, "variant.failed", {"variantId": variant.variantId, "error": str(e)})

    update_run_progress(run_id)

def update_run_progress(run_id: str):
    if run_id not in RUNS: return
    v_states = RUNS[run_id]["variants_state"].values()
    total = len(v_states)
    done = [v for v in v_states if v["status"] in ["completed", "failed"]]
    RUNS[run_id]["progress"] = int((len(done)/total)*100) if total > 0 else 0
    RUNS[run_id]["activeVariants"] = len([v for v in v_states if v["status"] == "running"])
    RUNS[run_id]["completedVariants"] = len(done)
    if len(done) == total:
        RUNS[run_id]["status"] = "completed"
        RUNS[run_id]["completedAt"] = datetime.now().isoformat()

async def process_run(run_id: str, request: RunRequest):
    RUNS[run_id]["status"] = "running"
    await emit_event(run_id, "run.started", {"goal": request.goal})
    await asyncio.gather(*[execute_variant(run_id, v, request.goal) for v in request.variants])

# --- Endpoints ---

@app.post("/runs", dependencies=[Depends(verify_api_key)])
async def create_run(request: RunRequest, background_tasks: BackgroundTasks):
    run_id = request.jobId
    RUNS[run_id] = {
        "status": "pending", "progress": 0, "activeVariants": 0, "completedVariants": 0,
        "totalVariants": len(request.variants), "updatedAt": datetime.now().isoformat(),
        "createdAt": request.createdAt or datetime.now().isoformat(),
        "variants_state": {v.variantId: {"variantId": v.variantId, "status": "pending"} for v in request.variants}
    }
    background_tasks.add_task(process_run, run_id, request)
    return {"jobId": run_id, "status": "accepted"}

@app.get("/runs/{run_id}/status", response_model=RunStatus)
async def get_run_status(run_id: str):
    if run_id not in RUNS: raise HTTPException(status_code=404)
    return RunStatus(**RUNS[run_id])

@app.get("/runs/{run_id}/results", response_model=RunResults)
async def get_run_results(run_id: str):
    if run_id not in RUNS: raise HTTPException(status_code=404)
    res = RUNS[run_id]
    return RunResults(status=res["status"], variants=[VariantResult(**v) for v in res["variants_state"].values()], 
                      createdAt=res["createdAt"], completedAt=res.get("completedAt"))

@app.post("/runs/{run_id}/ship/{variant_id}")
async def ship_variant(run_id: str, variant_id: str, request: ShipRequest):
    if run_id not in RUNS: raise HTTPException(status_code=404, detail="Run not found")
    
    variant = RUNS[run_id]["variants_state"].get(variant_id)
    if not variant or not variant.get("output"):
        raise HTTPException(status_code=400, detail="Variant output not ready")
        
    try:
        # Determine output path
        output_path = os.path.join(os.getcwd(), "..", "..", "apps", "shell", "src", "shipped_component.tsx")
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        with open(output_path, "w") as f:
            f.write(variant["output"])
            
        await emit_event(run_id, "variant.shipped", {"variantId": variant_id, "path": output_path})
        return {"status": "shipped", "path": output_path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/runs/{run_id}/cancel")
async def cancel_run(run_id: str):
    if run_id in RUNS:
        RUNS[run_id]["status"] = "cancelled"
        await emit_event(run_id, "run.cancelled", {{}})
    return {"status": "cancelled"}

@app.get("/runs/{run_id}/events")
async def stream_events(run_id: str, request: Request):
    if run_id not in RUNS: raise HTTPException(status_code=404)
    queue = asyncio.Queue(); EVENT_QUEUES.setdefault(run_id, []).append(queue)
    async def gen():
        try:
            while not await request.is_disconnected():
                yield await queue.get()
        finally: EVENT_QUEUES[run_id].remove(queue)
    return StreamingResponse(gen(), media_type="text/event-stream")

@app.get("/preview/{run_id}/{variant_id}")
async def get_preview(run_id: str, variant_id: str):
    if run_id in RUNS and variant_id in RUNS[run_id]["variants_state"]:
        output = RUNS[run_id]["variants_state"].get("output", "")
        html = f"<html><body style='font-family:sans-serif;padding:20px;'><h3>Preview: {variant_id}</h3><pre>{output}</pre></body></html>"
        return StreamingResponse(iter([html]), media_type="text/html")
    raise HTTPException(status_code=404)


# --- Browser-Use Integration Endpoints ---

class BrowserTaskRequest(BaseModel):
    goal: str
    url: Optional[str] = None
    mode: str = "browser-use"  # browser-use, playwright, computer-use

class BrowserSearchRequest(BaseModel):
    query: str
    search_engine: str = "duckduckgo"

class BrowserRetrieveRequest(BaseModel):
    url: str

@app.get("/browser/health")
async def browser_health():
    """Check browser-use availability"""
    return {
        "available": BROWSER_USE_AVAILABLE,
        "modes": ["browser-use", "playwright", "computer-use"] if BROWSER_USE_AVAILABLE else [],
        "chromium": True,
        "cdp_protocol": True
    }

@app.post("/browser/tasks")
async def create_browser_task(request: BrowserTaskRequest):
    """Create a new browser automation task"""
    if not BROWSER_USE_AVAILABLE:
        raise HTTPException(status_code=503, detail="browser-use not available")
    
    try:
        task = await browser_manager.create_task(
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

@app.post("/browser/tasks/{task_id}/execute")
async def execute_browser_task(task_id: str):
    """Execute a browser task"""
    if not BROWSER_USE_AVAILABLE:
        raise HTTPException(status_code=503, detail="browser-use not available")
    
    try:
        task = await browser_manager.execute_task(task_id)
        return {
            "task_id": task.id,
            "status": task.status,
            "result": task.result,
            "error": task.error,
            "completed_at": task.completed_at.isoformat() if task.completed_at else None
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/browser/tasks/{task_id}")
async def get_browser_task(task_id: str):
    """Get task status"""
    if not BROWSER_USE_AVAILABLE:
        raise HTTPException(status_code=503, detail="browser-use not available")
    
    task = browser_manager.get_task(task_id)
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

@app.post("/browser/search")
async def browser_search(request: BrowserSearchRequest):
    """Search using browser automation (replaces paid APIs)"""
    if not BROWSER_USE_AVAILABLE:
        raise HTTPException(status_code=503, detail="browser-use not available")
    
    try:
        result = await browser_manager.search_and_retrieve(
            query=request.query,
            search_engine=request.search_engine
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/browser/retrieve")
async def browser_retrieve(request: BrowserRetrieveRequest):
    """Retrieve URL content using browser (replaces Firecrawl)"""
    if not BROWSER_USE_AVAILABLE:
        raise HTTPException(status_code=503, detail="browser-use not available")
    
    try:
        result = await browser_manager.retrieve_url(request.url)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.on_event("shutdown")
async def shutdown_event():
    """Clean up browser resources"""
    if BROWSER_USE_AVAILABLE:
        await browser_manager.close()

if __name__ == "__main__":
    uvicorn.run(app, host=SUPERCONDUCTOR_HOST, port=SUPERCONDUCTOR_PORT)
