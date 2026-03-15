"""
A2R Computer Use Gateway - FastAPI with Persistent Sessions

Phase 3: Persistent browser sessions + core actions

Run: uvicorn main:app --host 127.0.0.1 --port 8080 --reload
"""

from __future__ import annotations

import asyncio
import base64
from datetime import datetime, timezone
from typing import Any, Literal

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from uuid import uuid4

from session_manager import session_manager
from observability_integration import (
    init_observability,
    maybe_record_before,
    maybe_record_after,
    maybe_record_failure,
    finalize_run_observability,
)


app = FastAPI(title="A2R Computer Use Gateway", version="0.3.0")


ActionType = Literal[
    "execute",
    "goto",
    "click",
    "fill",
    "extract",
    "screenshot",
    "inspect",
    "close",
]

AdapterPreference = Literal["playwright", "browser-use", "cdp", "desktop"]

FamilyType = Literal["browser", "desktop", "retrieval", "hybrid"]

ModeType = Literal[
    "assist",
    "execute",
    "inspect",
    "parallel",
    "desktop",
    "hybrid",
    "crawl",
]

StatusType = Literal["pending", "running", "completed", "failed", "cancelled"]


class ExecuteRequest(BaseModel):
    action: ActionType
    session_id: str
    run_id: str
    target: str | None = None
    goal: str | None = None
    parameters: dict[str, Any] = Field(default_factory=dict)
    adapter_preference: AdapterPreference | None = None


class Artifact(BaseModel):
    type: Literal["screenshot", "download", "json", "text", "html"]
    path: str | None = None
    url: str | None = None
    mime: str | None = None
    content: str | None = None


class Receipt(BaseModel):
    action: str
    timestamp: str
    success: bool
    details: dict[str, Any] | None = None


class ErrorDetail(BaseModel):
    code: str
    message: str


class ExecuteResponse(BaseModel):
    run_id: str
    session_id: str
    adapter_id: str
    family: FamilyType
    mode: ModeType
    status: StatusType
    summary: str | None = None
    extracted_content: Any | None = None
    artifacts: list[Artifact] = Field(default_factory=list)
    receipts: list[Receipt] = Field(default_factory=list)
    error: ErrorDetail | None = None
    trace_id: str | None = None


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def infer_mode(req: ExecuteRequest) -> ModeType:
    if req.action == "inspect":
        return "inspect"
    return "execute"


def validate_request(req: ExecuteRequest) -> None:
    """Validate request parameters."""
    if req.action == "goto" and not req.target:
        raise HTTPException(status_code=400, detail="target is required for goto")
    if req.action == "click" and not req.target:
        raise HTTPException(status_code=400, detail="target is required for click")
    if req.action == "fill":
        if not req.target:
            raise HTTPException(status_code=400, detail="target is required for fill")
        if not req.parameters.get("text"):
            raise HTTPException(
                status_code=400,
                detail="parameters.text is required for fill",
            )
    if req.action == "execute" and not req.goal:
        raise HTTPException(status_code=400, detail="goal is required for execute")


# ============================================================================
# Action Handlers - All wired with observability
# ============================================================================

async def handle_goto(req: ExecuteRequest) -> ExecuteResponse:
    """Navigate to URL using persistent session."""
    trace_id = str(uuid4())
    adapter_id = "browser.playwright"
    
    # Record frame start
    frame = await maybe_record_before(req)
    
    try:
        # Get or create session
        context, page = await session_manager.get_or_create_session(req.session_id)
        
        timeout = req.parameters.get("timeout", 30000)
        wait_until = req.parameters.get("wait_until", "domcontentloaded")
        
        # Navigate
        await page.goto(req.target, timeout=timeout, wait_until=wait_until)
        
        # Get page info
        url = page.url
        title = await page.title()
        
        # Capture after screenshot for observability
        after_screenshot = None
        try:
            after_screenshot = await page.screenshot(type="png")
        except Exception:
            pass  # Screenshot optional for observability
        
        result = ExecuteResponse(
            run_id=req.run_id,
            session_id=req.session_id,
            adapter_id=adapter_id,
            family="browser",
            mode="execute",
            status="completed",
            summary=f"Navigated to {url}",
            extracted_content={
                "url": url,
                "title": title,
            },
            artifacts=[],
            receipts=[
                Receipt(
                    action="goto",
                    timestamp=utc_now_iso(),
                    success=True,
                    details={
                        "target": req.target,
                        "url": url,
                        "title": title,
                    },
                )
            ],
            trace_id=trace_id,
        )
        
        # Record frame completion
        await maybe_record_after(frame, result, after_screenshot)
        
        return result
        
    except Exception as e:
        # Capture failure screenshot if possible
        failure_screenshot = None
        try:
            page = await session_manager.get_page(req.session_id)
            if page:
                failure_screenshot = await page.screenshot(type="png")
        except Exception:
            pass
        
        result = ExecuteResponse(
            run_id=req.run_id,
            session_id=req.session_id,
            adapter_id=adapter_id,
            family="browser",
            mode="execute",
            status="failed",
            summary=f"Failed to navigate to {req.target}",
            error=ErrorDetail(code="NAVIGATION_ERROR", message=str(e)),
            receipts=[
                Receipt(
                    action="goto",
                    timestamp=utc_now_iso(),
                    success=False,
                    details={"error": str(e)},
                )
            ],
            trace_id=trace_id,
        )
        
        # Record frame failure
        await maybe_record_failure(frame, e, failure_screenshot)
        
        return result


async def handle_screenshot(req: ExecuteRequest) -> ExecuteResponse:
    """Capture screenshot using persistent session."""
    trace_id = str(uuid4())
    adapter_id = "browser.playwright"
    
    # Record frame start
    frame = await maybe_record_before(req)
    
    try:
        # Get or create session
        context, page = await session_manager.get_or_create_session(req.session_id)
        
        # Optional: navigate first if target provided
        if req.target:
            timeout = req.parameters.get("timeout", 30000)
            await page.goto(req.target, timeout=timeout, wait_until="domcontentloaded")
        
        # Capture screenshot
        screenshot_bytes = await page.screenshot(
            full_page=req.parameters.get("full_page", False),
            type="png",
        )
        
        # Encode as base64 data URL
        b64_data = base64.b64encode(screenshot_bytes).decode("utf-8")
        data_url = f"data:image/png;base64,{b64_data}"
        
        url = page.url
        
        result = ExecuteResponse(
            run_id=req.run_id,
            session_id=req.session_id,
            adapter_id=adapter_id,
            family="browser",
            mode="inspect",
            status="completed",
            summary=f"Screenshot captured: {url}",
            artifacts=[
                Artifact(
                    type="screenshot",
                    mime="image/png",
                    url=data_url,
                )
            ],
            receipts=[
                Receipt(
                    action="screenshot",
                    timestamp=utc_now_iso(),
                    success=True,
                    details={
                        "url": url,
                        "size_bytes": len(screenshot_bytes),
                        "full_page": req.parameters.get("full_page", False),
                    },
                )
            ],
            trace_id=trace_id,
        )
        
        # Record frame completion (screenshot as after_screenshot)
        await maybe_record_after(frame, result, screenshot_bytes)
        
        return result
        
    except Exception as e:
        result = ExecuteResponse(
            run_id=req.run_id,
            session_id=req.session_id,
            adapter_id=adapter_id,
            family="browser",
            mode="inspect",
            status="failed",
            summary="Failed to capture screenshot",
            error=ErrorDetail(code="SCREENSHOT_ERROR", message=str(e)),
            receipts=[
                Receipt(
                    action="screenshot",
                    timestamp=utc_now_iso(),
                    success=False,
                    details={"error": str(e)},
                )
            ],
            trace_id=trace_id,
        )
        
        # Record frame failure
        await maybe_record_failure(frame, e)
        
        return result


async def handle_click(req: ExecuteRequest) -> ExecuteResponse:
    """Click element on current page."""
    trace_id = str(uuid4())
    adapter_id = "browser.playwright"
    
    # Record frame start
    frame = await maybe_record_before(req)
    
    try:
        page = await session_manager.get_page(req.session_id)
        if not page:
            raise Exception("No active session. Use 'goto' first.")
        
        selector = req.target
        timeout = req.parameters.get("timeout", 5000)
        
        # Wait for element and click
        await page.wait_for_selector(selector, timeout=timeout)
        
        # Capture URL before click (to detect navigation)
        url_before = page.url
        
        await page.click(selector)
        
        # Wait a bit for potential navigation
        await asyncio.sleep(0.5)
        
        # Check if navigated
        url_after = page.url
        navigated = url_after != url_before
        
        # Capture after screenshot
        after_screenshot = None
        try:
            after_screenshot = await page.screenshot(type="png")
        except Exception:
            pass
        
        result = ExecuteResponse(
            run_id=req.run_id,
            session_id=req.session_id,
            adapter_id=adapter_id,
            family="browser",
            mode="execute",
            status="completed",
            summary=f"Clicked {selector}" + (f" and navigated to {url_after}" if navigated else ""),
            extracted_content={
                "navigated": navigated,
                "url_before": url_before,
                "url_after": url_after,
            },
            receipts=[
                Receipt(
                    action="click",
                    timestamp=utc_now_iso(),
                    success=True,
                    details={
                        "selector": selector,
                        "navigated": navigated,
                        "url": url_after,
                    },
                )
            ],
            trace_id=trace_id,
        )
        
        # Record frame completion
        await maybe_record_after(frame, result, after_screenshot)
        
        return result
        
    except Exception as e:
        # Capture failure screenshot if possible
        failure_screenshot = None
        try:
            page = await session_manager.get_page(req.session_id)
            if page:
                failure_screenshot = await page.screenshot(type="png")
        except Exception:
            pass
        
        result = ExecuteResponse(
            run_id=req.run_id,
            session_id=req.session_id,
            adapter_id=adapter_id,
            family="browser",
            mode="execute",
            status="failed",
            summary=f"Failed to click {req.target}",
            error=ErrorDetail(
                code="SELECTOR_ERROR" if "Timeout" in str(e) else "CLICK_ERROR",
                message=str(e)
            ),
            receipts=[
                Receipt(
                    action="click",
                    timestamp=utc_now_iso(),
                    success=False,
                    details={"selector": req.target, "error": str(e)},
                )
            ],
            trace_id=trace_id,
        )
        
        # Record frame failure
        await maybe_record_failure(frame, e, failure_screenshot)
        
        return result


async def handle_fill(req: ExecuteRequest) -> ExecuteResponse:
    """Fill input field on current page."""
    trace_id = str(uuid4())
    adapter_id = "browser.playwright"
    
    # Record frame start
    frame = await maybe_record_before(req)
    
    try:
        page = await session_manager.get_page(req.session_id)
        if not page:
            raise Exception("No active session. Use 'goto' first.")
        
        selector = req.target
        text = req.parameters.get("text")
        submit = req.parameters.get("submit", False)
        timeout = req.parameters.get("timeout", 5000)
        
        # Wait for element
        await page.wait_for_selector(selector, timeout=timeout)
        
        # Clear and fill
        await page.fill(selector, text)
        
        # Optional submit
        submitted = False
        if submit:
            await page.press(selector, "Enter")
            submitted = True
        
        # Capture after screenshot
        after_screenshot = None
        try:
            after_screenshot = await page.screenshot(type="png")
        except Exception:
            pass
        
        result = ExecuteResponse(
            run_id=req.run_id,
            session_id=req.session_id,
            adapter_id=adapter_id,
            family="browser",
            mode="execute",
            status="completed",
            summary=f"Filled {selector}" + (" and submitted" if submitted else ""),
            extracted_content={
                "selector": selector,
                "submitted": submitted,
            },
            receipts=[
                Receipt(
                    action="fill",
                    timestamp=utc_now_iso(),
                    success=True,
                    details={
                        "selector": selector,
                        "text_length": len(text),
                        "submitted": submitted,
                    },
                )
            ],
            trace_id=trace_id,
        )
        
        # Record frame completion
        await maybe_record_after(frame, result, after_screenshot)
        
        return result
        
    except Exception as e:
        # Capture failure screenshot if possible
        failure_screenshot = None
        try:
            page = await session_manager.get_page(req.session_id)
            if page:
                failure_screenshot = await page.screenshot(type="png")
        except Exception:
            pass
        
        result = ExecuteResponse(
            run_id=req.run_id,
            session_id=req.session_id,
            adapter_id=adapter_id,
            family="browser",
            mode="execute",
            status="failed",
            summary=f"Failed to fill {req.target}",
            error=ErrorDetail(
                code="SELECTOR_ERROR" if "Timeout" in str(e) else "FILL_ERROR",
                message=str(e)
            ),
            receipts=[
                Receipt(
                    action="fill",
                    timestamp=utc_now_iso(),
                    success=False,
                    details={"selector": req.target, "error": str(e)},
                )
            ],
            trace_id=trace_id,
        )
        
        # Record frame failure
        await maybe_record_failure(frame, e, failure_screenshot)
        
        return result


async def handle_extract(req: ExecuteRequest) -> ExecuteResponse:
    """Extract content from current page."""
    trace_id = str(uuid4())
    adapter_id = "browser.playwright"
    
    # Record frame start
    frame = await maybe_record_before(req)
    
    try:
        page = await session_manager.get_page(req.session_id)
        if not page:
            raise Exception("No active session. Use 'goto' first.")
        
        format_type = req.parameters.get("format", "text")
        selector = req.target  # Optional CSS selector
        
        if format_type == "text":
            if selector:
                # Extract text from specific element
                text = await page.text_content(selector)
            else:
                # Extract all text from page
                text = await page.evaluate("() => document.body.innerText")
            extracted = text
            
        elif format_type == "html":
            if selector:
                html = await page.inner_html(selector)
            else:
                html = await page.content()
            extracted = html
            
        elif format_type == "json":
            # Extract structured data (links, headings, etc.)
            data = await page.evaluate("""() => {
                return {
                    title: document.title,
                    url: window.location.href,
                    headings: Array.from(document.querySelectorAll('h1, h2, h3')).map(h => ({
                        level: h.tagName,
                        text: h.innerText.trim()
                    })),
                    links: Array.from(document.querySelectorAll('a[href]')).map(a => ({
                        text: a.innerText.trim(),
                        href: a.href
                    })).slice(0, 20),
                };
            }""")
            extracted = data
        else:
            extracted = None
        
        result = ExecuteResponse(
            run_id=req.run_id,
            session_id=req.session_id,
            adapter_id=adapter_id,
            family="browser",
            mode="inspect",
            status="completed",
            summary=f"Extracted {format_type} from page",
            extracted_content=extracted,
            receipts=[
                Receipt(
                    action="extract",
                    timestamp=utc_now_iso(),
                    success=True,
                    details={
                        "format": format_type,
                        "selector": selector,
                        "content_length": len(str(extracted)) if extracted else 0,
                    },
                )
            ],
            trace_id=trace_id,
        )
        
        # Record frame completion (no screenshot for extract)
        await maybe_record_after(frame, result)
        
        return result
        
    except Exception as e:
        result = ExecuteResponse(
            run_id=req.run_id,
            session_id=req.session_id,
            adapter_id=adapter_id,
            family="browser",
            mode="inspect",
            status="failed",
            summary="Failed to extract content",
            error=ErrorDetail(code="EXTRACT_ERROR", message=str(e)),
            receipts=[
                Receipt(
                    action="extract",
                    timestamp=utc_now_iso(),
                    success=False,
                    details={"error": str(e)},
                )
            ],
            trace_id=trace_id,
        )
        
        # Record frame failure
        await maybe_record_failure(frame, e)
        
        return result


async def handle_inspect(req: ExecuteRequest) -> ExecuteResponse:
    """Inspect current page structure."""
    trace_id = str(uuid4())
    adapter_id = "browser.playwright"
    
    # Record frame start
    frame = await maybe_record_before(req)
    
    try:
        page = await session_manager.get_page(req.session_id)
        if not page:
            raise Exception("No active session. Use 'goto' first.")
        
        url = page.url
        title = await page.title()
        
        # Get simplified page structure
        structure = await page.evaluate("""() => {
            return {
                title: document.title,
                url: window.location.href,
                meta: {
                    description: document.querySelector('meta[name="description"]')?.content || '',
                },
                headings: Array.from(document.querySelectorAll('h1, h2, h3')).map(h => ({
                    level: h.tagName,
                    text: h.innerText.trim().slice(0, 100)
                })),
                forms: Array.from(document.querySelectorAll('form')).length,
                links: Array.from(document.querySelectorAll('a[href]')).length,
                inputs: Array.from(document.querySelectorAll('input, textarea, select')).length,
            };
        }""")
        
        result = ExecuteResponse(
            run_id=req.run_id,
            session_id=req.session_id,
            adapter_id=adapter_id,
            family="browser",
            mode="inspect",
            status="completed",
            summary=f"Inspected: {title}",
            extracted_content=structure,
            receipts=[
                Receipt(
                    action="inspect",
                    timestamp=utc_now_iso(),
                    success=True,
                    details={
                        "url": url,
                        "title": title,
                    },
                )
            ],
            trace_id=trace_id,
        )
        
        # Record frame completion (no screenshot for inspect)
        await maybe_record_after(frame, result)
        
        return result
        
    except Exception as e:
        result = ExecuteResponse(
            run_id=req.run_id,
            session_id=req.session_id,
            adapter_id=adapter_id,
            family="browser",
            mode="inspect",
            status="failed",
            summary="Failed to inspect page",
            error=ErrorDetail(code="INSPECT_ERROR", message=str(e)),
            receipts=[
                Receipt(
                    action="inspect",
                    timestamp=utc_now_iso(),
                    success=False,
                    details={"error": str(e)},
                )
            ],
            trace_id=trace_id,
        )
        
        # Record frame failure
        await maybe_record_failure(frame, e)
        
        return result


async def handle_close(req: ExecuteRequest) -> ExecuteResponse:
    """Close browser session."""
    trace_id = str(uuid4())
    adapter_id = "browser.playwright"
    
    # Record frame start
    frame = await maybe_record_before(req)
    
    try:
        closed = await session_manager.close_session(req.session_id)
        
        result = ExecuteResponse(
            run_id=req.run_id,
            session_id=req.session_id,
            adapter_id=adapter_id,
            family="browser",
            mode="execute",
            status="completed",
            summary="Session closed" if closed else "Session not found",
            receipts=[
                Receipt(
                    action="close",
                    timestamp=utc_now_iso(),
                    success=closed,
                    details={"was_active": closed},
                )
            ],
            trace_id=trace_id,
        )
        
        # Record frame completion
        await maybe_record_after(frame, result)
        
        return result
        
    except Exception as e:
        result = ExecuteResponse(
            run_id=req.run_id,
            session_id=req.session_id,
            adapter_id=adapter_id,
            family="browser",
            mode="execute",
            status="failed",
            summary="Failed to close session",
            error=ErrorDetail(code="CLOSE_ERROR", message=str(e)),
            receipts=[
                Receipt(
                    action="close",
                    timestamp=utc_now_iso(),
                    success=False,
                    details={"error": str(e)},
                )
            ],
            trace_id=trace_id,
        )
        
        # Record frame failure
        await maybe_record_failure(frame, e)
        
        return result


async def handle_stub(req: ExecuteRequest) -> ExecuteResponse:
    """Stub handler for actions not yet implemented."""
    trace_id = str(uuid4())
    
    # Record frame start
    frame = await maybe_record_before(req)
    
    result = ExecuteResponse(
        run_id=req.run_id,
        session_id=req.session_id,
        adapter_id="browser.stub",
        family="browser",
        mode="execute",
        status="completed",
        summary=f"Stub executed {req.action}",
        receipts=[
            Receipt(
                action=req.action,
                timestamp=utc_now_iso(),
                success=True,
                details={"note": "Stub implementation"},
            )
        ],
        trace_id=trace_id,
    )
    
    # Record frame completion
    await maybe_record_after(frame, result)
    
    return result


# ============================================================================
# API Endpoints
# ============================================================================

@app.get("/health")
async def health() -> dict[str, Any]:
    """Health check with session stats."""
    stats = await session_manager.get_session_stats()
    return {
        "status": "ok",
        "version": "0.3.0",
        "playwright": "enabled",
        "sessions": {
            "active": stats["active_sessions"],
            "max": stats["max_sessions"],
        }
    }


@app.post("/v1/execute", response_model=ExecuteResponse)
async def execute(req: ExecuteRequest) -> ExecuteResponse:
    """Execute a browser automation action with persistent sessions."""
    validate_request(req)
    
    # Route to appropriate handler
    handlers = {
        "goto": handle_goto,
        "screenshot": handle_screenshot,
        "click": handle_click,
        "fill": handle_fill,
        "extract": handle_extract,
        "inspect": handle_inspect,
        "close": handle_close,
        "execute": handle_stub,  # Future: browser-use adapter
    }
    
    handler = handlers.get(req.action, handle_stub)
    return await handler(req)


@app.post("/v1/finalize")
async def finalize_run(run_id: str, build_replay: bool = True) -> dict[str, Any]:
    """
    Finalize a run and generate observability artifacts.
    
    Call this after a sequence of actions to:
    - Save timeline
    - Build replay GIF/video
    - Generate analysis
    """
    result = await finalize_run_observability(run_id, build_replay)
    return result or {"status": "observability_disabled"}


@app.get("/v1/recordings/{run_id}")
async def get_recording(run_id: str) -> dict[str, Any]:
    """Get recording data for a run."""
    from observability_integration import recorder
    
    if recorder is None:
        return {"error": "observability_disabled"}
    
    timeline = await recorder.get_timeline(run_id)
    if timeline is None:
        raise HTTPException(status_code=404, detail="Recording not found")
    
    return {
        "run_id": run_id,
        "session_id": timeline.session_id,
        "total_steps": timeline.total_steps,
        "completed": timeline.completed_steps,
        "failed": timeline.failed_steps,
        "replay_gif": timeline.replay_gif_path,
        "replay_video": timeline.replay_video_path,
    }


@app.on_event("startup")
async def startup_event():
    """Initialize session manager and observability on startup."""
    await session_manager.initialize()
    init_observability()  # Initialize observability/recorder


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown."""
    await session_manager.shutdown()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8080)
