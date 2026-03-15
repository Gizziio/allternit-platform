"""
Session recorder - main interface for CU-030/031

Captures action frames with screenshots, manages timelines.
"""

from dataclasses import dataclass
from typing import Optional, Any
import asyncio
import logging

from .frame import ActionFrame, ActionType, FrameStatus, RunTimeline
from .storage import StorageBackend, FileSystemStorage

logger = logging.getLogger(__name__)


@dataclass
class RecorderConfig:
    """Configuration for session recorder."""
    
    # Storage
    storage_path: str = "/tmp/a2r-recordings"
    storage_backend: str = "filesystem"  # or "memory"
    
    # Capture settings
    capture_before_screenshot: bool = True
    capture_after_screenshot: bool = True
    capture_failure_screenshot: bool = True
    screenshot_format: str = "png"
    screenshot_quality: int = 80
    
    # Performance
    async_save: bool = True  # Save frames asynchronously
    max_concurrent_saves: int = 3
    
    # Retention
    retention_days: int = 7
    max_runs_per_session: int = 100


class SessionRecorder:
    """
    Records browser/desktop sessions for replay and analysis.
    
    Usage:
        recorder = SessionRecorder()
        
        # Before action
        frame = await recorder.start_frame(
            run_id="run_123",
            session_id="sess_456", 
            step=0,
            action="click",
            target="#submit"
        )
        
        # ... execute action ...
        
        # After action
        await recorder.complete_frame(
            frame,
            status="completed",
            result={...}
        )
    """
    
    def __init__(self, config: Optional[RecorderConfig] = None):
        self.config = config or RecorderConfig()
        self._storage: Optional[StorageBackend] = None
        self._timelines: dict[str, RunTimeline] = {}  # Active timelines
        self._semaphore = asyncio.Semaphore(self.config.max_concurrent_saves)
        self._save_tasks: set[asyncio.Task] = set()
    
    async def _get_storage(self) -> StorageBackend:
        """Lazy initialization of storage."""
        if self._storage is None:
            if self.config.storage_backend == "memory":
                from .storage import MemoryStorage
                self._storage = MemoryStorage()
            else:
                self._storage = FileSystemStorage(self.config.storage_path)
        return self._storage
    
    def _get_timeline(self, run_id: str, session_id: str) -> RunTimeline:
        """Get or create timeline for run."""
        if run_id not in self._timelines:
            self._timelines[run_id] = RunTimeline(
                run_id=run_id,
                session_id=session_id,
            )
        return self._timelines[run_id]
    
    async def start_frame(
        self,
        run_id: str,
        session_id: str,
        step_index: int,
        action: str | ActionType,
        target: Optional[str] = None,
        goal: Optional[str] = None,
        parameters: Optional[dict] = None,
        adapter_id: Optional[str] = None,
        before_screenshot: Optional[bytes] = None,
    ) -> ActionFrame:
        """
        Start recording a new action frame.
        
        Call this BEFORE executing the action.
        """
        storage = await self._get_storage()
        
        # Create frame
        frame = ActionFrame(
            run_id=run_id,
            session_id=session_id,
            step_index=step_index,
            action=action if isinstance(action, ActionType) else ActionType(action),
            target=target,
            goal=goal,
            parameters=parameters or {},
            adapter_id=adapter_id,
            status=FrameStatus.RUNNING,
        )
        
        # Save before screenshot
        if before_screenshot and self.config.capture_before_screenshot:
            path = await storage.save_screenshot(
                run_id, frame.id, "before", before_screenshot
            )
            frame.before_screenshot_path = path
        
        # Save frame
        if self.config.async_save:
            task = asyncio.create_task(self._save_frame_async(storage, frame))
            self._save_tasks.add(task)
            task.add_done_callback(self._save_tasks.discard)
        else:
            await storage.save_frame(frame)
        
        logger.debug(f"Started frame {frame.id} for run {run_id}: {action}")
        return frame
    
    async def _save_frame_async(self, storage: StorageBackend, frame: ActionFrame) -> None:
        """Save frame with semaphore-controlled concurrency."""
        async with self._semaphore:
            await storage.save_frame(frame)
    
    async def complete_frame(
        self,
        frame: ActionFrame,
        status: str | FrameStatus,
        result: Optional[dict] = None,
        after_screenshot: Optional[bytes] = None,
        error: Optional[dict] = None,
    ) -> ActionFrame:
        """
        Complete a frame with results.
        
        Call this AFTER action execution.
        """
        storage = await self._get_storage()
        
        # Convert status
        frame_status = status if isinstance(status, FrameStatus) else FrameStatus(status)
        
        # Save after screenshot
        if after_screenshot and self.config.capture_after_screenshot:
            path = await storage.save_screenshot(
                frame.run_id, frame.id, "after", after_screenshot
            )
            frame.after_screenshot_path = path
        
        # Update frame
        kwargs = {
            "extracted_content": result.get("extracted_content") if result else None,
            "adapter_family": result.get("family") if result else None,
        }
        if error:
            kwargs["error"] = error
        
        frame.complete(frame_status, **kwargs)
        
        # Add to timeline
        timeline = self._get_timeline(frame.run_id, frame.session_id)
        timeline.add_frame(frame)
        
        # Save
        if self.config.async_save:
            task = asyncio.create_task(self._save_frame_async(storage, frame))
            self._save_tasks.add(task)
            task.add_done_callback(self._save_tasks.discard)
        else:
            await storage.save_frame(frame)
        
        logger.debug(f"Completed frame {frame.id}: {frame_status.value}")
        return frame
    
    async def capture_failure(
        self,
        frame: ActionFrame,
        error: dict[str, Any],
        failure_screenshot: Optional[bytes] = None,
    ) -> ActionFrame:
        """
        Capture a failed action with error details.
        """
        storage = await self._get_storage()
        
        # Save failure screenshot
        if failure_screenshot and self.config.capture_failure_screenshot:
            path = await storage.save_screenshot(
                frame.run_id, frame.id, "failure", failure_screenshot
            )
            frame.failure_screenshot_path = path
        
        return await self.complete_frame(
            frame,
            status=FrameStatus.FAILED,
            error=error,
        )
    
    async def finalize_run(
        self,
        run_id: str,
        replay_gif_path: Optional[str] = None,
        replay_video_path: Optional[str] = None,
    ) -> RunTimeline:
        """
        Finalize a run and save complete timeline.
        
        Call this when run is complete (success or failure).
        """
        storage = await self._get_storage()
        
        timeline = self._timelines.get(run_id)
        if not timeline:
            logger.warning(f"No timeline found for run {run_id}")
            # Create minimal timeline
            timeline = RunTimeline(run_id=run_id, session_id="unknown")
        
        timeline.replay_gif_path = replay_gif_path
        timeline.replay_video_path = replay_video_path
        
        # Save timeline
        await storage.save_timeline(timeline)
        
        # Clean up from memory
        if run_id in self._timelines:
            del self._timelines[run_id]
        
        logger.info(f"Finalized run {run_id}: {timeline.total_steps} steps, "
                   f"{timeline.completed_steps} completed, {timeline.failed_steps} failed")
        
        return timeline
    
    async def get_timeline(self, run_id: str) -> Optional[RunTimeline]:
        """Load a timeline by run ID."""
        # First check memory
        if run_id in self._timelines:
            return self._timelines[run_id]
        
        # Then check storage
        storage = await self._get_storage()
        return await storage.load_timeline(run_id)
    
    async def wait_for_saves(self) -> None:
        """Wait for all async save operations to complete."""
        if self._save_tasks:
            await asyncio.gather(*self._save_tasks, return_exceptions=True)
            self._save_tasks.clear()
