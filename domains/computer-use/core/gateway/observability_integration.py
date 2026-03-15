"""
Observability Integration for Computer Use Gateway

Wires the observability recorder into gateway action handlers.
Captures frames before/after actions for replay and analysis.

Usage in main.py:
    from observability_integration import recorder, maybe_record_action
    
    @app.post("/v1/execute")
    async def execute(req: ExecuteRequest) -> ExecuteResponse:
        frame = await maybe_record_before(req)
        try:
            result = await handle_action(req)
            await maybe_record_after(frame, result)
            return result
        except Exception as e:
            await maybe_record_failure(frame, e)
            raise
"""

import os
import sys
from pathlib import Path
from typing import Optional, Any

# Add observability to path
OBSERVABILITY_PATH = Path(__file__).parent.parent / "observability"
if str(OBSERVABILITY_PATH) not in sys.path:
    sys.path.insert(0, str(OBSERVABILITY_PATH))

# Import recorder
from recorder import SessionRecorder, RecorderConfig, ActionFrame
from analyzer import RunAnalyzer
from replay import MultiFormatBuilder, ReplayConfig

# Global recorder instance
recorder: Optional[SessionRecorder] = None
analyzer = RunAnalyzer()
replay_builder: Optional[MultiFormatBuilder] = None

# Step counters per run
_run_steps: dict[str, int] = {}


def init_observability() -> None:
    """Initialize observability components."""
    global recorder, replay_builder
    
    # Check if observability is enabled
    if os.environ.get("A2R_ENABLE_OBSERVABILITY", "true").lower() != "true":
        print("Observability disabled (set A2R_ENABLE_OBSERVABILITY=true to enable)")
        return
    
    # Configure from environment
    storage_path = os.environ.get("A2R_RECORDINGS_PATH", "/tmp/a2r-recordings")
    
    config = RecorderConfig(
        storage_path=storage_path,
        capture_before_screenshot=True,
        capture_after_screenshot=True,
        async_save=True,
    )
    
    recorder = SessionRecorder(config)
    
    # Initialize replay builder
    replay_config = ReplayConfig(
        formats=[],  # Will be configured per-run
        parallel_builds=True,
    )
    replay_builder = MultiFormatBuilder(replay_config)
    
    print(f"Observability initialized: recordings -> {storage_path}")


def get_step_index(run_id: str) -> int:
    """Get and increment step index for a run."""
    idx = _run_steps.get(run_id, 0)
    _run_steps[run_id] = idx + 1
    return idx


async def maybe_record_before(
    req,
    screenshot_bytes: Optional[bytes] = None,
) -> Optional[ActionFrame]:
    """
    Record frame before action execution.
    
    Call this at the start of action handlers.
    Returns frame object to be passed to maybe_record_after.
    """
    if recorder is None:
        return None
    
    try:
        step = get_step_index(req.run_id)
        
        frame = await recorder.start_frame(
            run_id=req.run_id,
            session_id=req.session_id,
            step_index=step,
            action=req.action,
            target=req.target,
            goal=req.goal,
            parameters=req.parameters,
            adapter_id="browser.playwright",
            before_screenshot=screenshot_bytes,
        )
        
        return frame
    except Exception as e:
        # Don't let recording failures break execution
        print(f"Warning: Failed to record frame start: {e}")
        return None


async def maybe_record_after(
    frame: Optional[ActionFrame],
    result,
    screenshot_bytes: Optional[bytes] = None,
) -> None:
    """
    Record frame completion after action.
    
    Call this after successful action execution.
    """
    if recorder is None or frame is None:
        return
    
    try:
        # Convert result status
        status = "completed" if result.status == "completed" else "failed"
        
        # Build result dict
        result_dict = {
            "extracted_content": result.extracted_content,
            "family": result.family,
        }
        
        # Extract error if failed
        error = None
        if result.error:
            error = {
                "code": result.error.code,
                "message": result.error.message,
            }
        
        await recorder.complete_frame(
            frame=frame,
            status=status,
            result=result_dict,
            after_screenshot=screenshot_bytes,
            error=error,
        )
    except Exception as e:
        print(f"Warning: Failed to record frame completion: {e}")


async def maybe_record_failure(
    frame: Optional[ActionFrame],
    error: Exception,
    screenshot_bytes: Optional[bytes] = None,
) -> None:
    """
    Record frame failure.
    
    Call this when action fails with exception.
    """
    if recorder is None or frame is None:
        return
    
    try:
        error_dict = {
            "code": "EXECUTION_ERROR",
            "message": str(error),
        }
        
        await recorder.capture_failure(
            frame=frame,
            error=error_dict,
            failure_screenshot=screenshot_bytes,
        )
    except Exception as e:
        print(f"Warning: Failed to record frame failure: {e}")


async def finalize_run_observability(
    run_id: str,
    build_replay: bool = True,
) -> Optional[dict]:
    """
    Finalize observability for a run.
    
    Call this when run is complete to:
    - Save timeline
    - Build replay artifacts
    - Generate analysis
    
    Returns analysis summary.
    """
    if recorder is None:
        return None
    
    try:
        # Finalize timeline
        timeline = await recorder.finalize_run(run_id)
        
        result = {
            "run_id": run_id,
            "steps": timeline.total_steps,
            "completed": timeline.completed_steps,
            "failed": timeline.failed_steps,
        }
        
        # Build replay artifacts
        if build_replay and replay_builder is not None:
            from replay import ReplayFormat
            
            # Get screenshots for replay
            storage = await recorder._get_storage()
            screenshots = await storage.get_run_screenshots(run_id)
            
            if screenshots:
                # Prepare frames for builder
                frames = [
                    (i, path, f"Step {i}")
                    for i, (frame_id, path) in enumerate(screenshots)
                ]
                
                # Build GIF
                replay_config = ReplayConfig(
                    formats=[ReplayFormat.GIF, ReplayFormat.TIMELINE_JSON],
                    gif_fps=2,
                )
                builder = MultiFormatBuilder(replay_config)
                
                output_dir = Path(recorder.config.storage_path) / "replays"
                artifacts = await builder.build_from_frames(
                    frames=frames,
                    output_dir=str(output_dir),
                    run_id=run_id,
                )
                
                result["replay_artifacts"] = artifacts
                
                # Update timeline with replay paths
                if "gif" in artifacts:
                    timeline.replay_gif_path = artifacts["gif"]
                if "webm" in artifacts:
                    timeline.replay_video_path = artifacts["webm"]
                
                await storage.save_timeline(timeline)
        
        # Generate analysis
        analysis = await analyzer.analyze(timeline)
        result["analysis"] = analysis.to_dict()
        
        # Save analysis
        import json
        analysis_path = Path(recorder.config.storage_path) / f"{run_id}_analysis.json"
        with open(analysis_path, 'w') as f:
            json.dump(analysis.to_dict(), f, indent=2)
        
        # Cleanup step counter
        if run_id in _run_steps:
            del _run_steps[run_id]
        
        return result
        
    except Exception as e:
        print(f"Warning: Failed to finalize run observability: {e}")
        return {"error": str(e)}


def get_recorder() -> Optional[SessionRecorder]:
    """Get the global recorder instance."""
    return recorder
