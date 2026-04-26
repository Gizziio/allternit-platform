"""
Allternit Computer Use — Parallel Execution Coordinator

Fans N tasks out across isolated Playwright browser contexts (or accessibility
sessions) and aggregates results. Each task gets its own session_id.
"""

from __future__ import annotations

import asyncio
import time
import uuid
import logging
from dataclasses import dataclass, field
from typing import Any, AsyncGenerator, Dict, List, Optional

logger = logging.getLogger(__name__)


# ── Data models ───────────────────────────────────────────────────────────────

@dataclass
class ParallelTask:
    task_id: str
    goal: str
    url: Optional[str]
    family: str               # "browser" or "desktop"
    adapter_id: str           # e.g. "browser.playwright"
    timeout_ms: int = 30000


@dataclass
class ParallelResult:
    task_id: str
    session_id: str
    success: bool
    result: Optional[Dict]
    error: Optional[str]
    duration_ms: int


# ── Coordinator ───────────────────────────────────────────────────────────────

class ParallelCoordinator:
    """
    Runs N tasks concurrently up to max_concurrent using asyncio.Semaphore.

    Each task is dispatched to the adapter named by task.adapter_id.
    Supported adapters:
      - "browser.playwright"    → PlaywrightAdapter
      - "desktop.accessibility" → AccessibilityAdapter

    Any unknown adapter_id causes that task to fail with a clear error.
    """

    def __init__(self, max_concurrent: int = 4) -> None:
        self.max_concurrent = max_concurrent
        self._semaphore = asyncio.Semaphore(max_concurrent)

    # ── Public API ─────────────────────────────────────────────────────────────

    async def run(self, tasks: List[ParallelTask]) -> List[ParallelResult]:
        """Run all tasks concurrently up to max_concurrent; return aggregated results."""
        coros = [self._run_single(task) for task in tasks]
        results = await asyncio.gather(*coros, return_exceptions=False)
        return list(results)

    async def run_streaming(self, tasks: List[ParallelTask]) -> AsyncGenerator[Dict, None]:
        """
        Yield SSE-style dicts as tasks start and complete.

        Each dict has at minimum:
          - event: "task_started" | "task_completed" | "task_failed" | "done"
          - task_index: int (0-based index in the tasks list)
          - task_id: str
        """
        queue: asyncio.Queue[Optional[Dict]] = asyncio.Queue()
        remaining = len(tasks)

        async def _wrapped(index: int, task: ParallelTask) -> None:
            await queue.put({
                "event": "task_started",
                "task_index": index,
                "task_id": task.task_id,
            })
            result = await self._run_single(task)
            event = "task_completed" if result.success else "task_failed"
            await queue.put({
                "event": event,
                "task_index": index,
                "task_id": result.task_id,
                "session_id": result.session_id,
                "success": result.success,
                "result": result.result,
                "error": result.error,
                "duration_ms": result.duration_ms,
            })

        async def _run_all() -> None:
            await asyncio.gather(*[_wrapped(i, t) for i, t in enumerate(tasks)])
            await queue.put(None)  # sentinel

        asyncio.create_task(_run_all())

        completed = 0
        while True:
            item = await queue.get()
            if item is None:
                yield {"event": "done", "total": len(tasks), "completed": completed}
                return
            if item["event"] in ("task_completed", "task_failed"):
                completed += 1
            yield item

    # ── Internal ───────────────────────────────────────────────────────────────

    async def _run_single(self, task: ParallelTask) -> ParallelResult:
        """Acquire semaphore, then run one task."""
        async with self._semaphore:
            return await self._dispatch(task)

    async def _dispatch(self, task: ParallelTask) -> ParallelResult:
        """Dispatch a task to the appropriate adapter and time it."""
        session_id = f"par_{task.task_id}_{uuid.uuid4().hex[:8]}"
        run_id = f"run_{uuid.uuid4().hex[:12]}"
        started = time.monotonic()

        try:
            envelope = await asyncio.wait_for(
                self._execute_with_adapter(task, session_id, run_id),
                timeout=task.timeout_ms / 1000.0,
            )
            duration_ms = int((time.monotonic() - started) * 1000)
            success = envelope.status == "completed"
            error = envelope.error.get("message") if envelope.error else None
            return ParallelResult(
                task_id=task.task_id,
                session_id=session_id,
                success=success,
                result=envelope.extracted_content if isinstance(envelope.extracted_content, dict)
                       else {"content": envelope.extracted_content},
                error=error,
                duration_ms=duration_ms,
            )

        except asyncio.TimeoutError:
            duration_ms = int((time.monotonic() - started) * 1000)
            logger.warning("Task %s timed out after %dms", task.task_id, task.timeout_ms)
            return ParallelResult(
                task_id=task.task_id,
                session_id=session_id,
                success=False,
                result=None,
                error=f"Task timed out after {task.timeout_ms}ms",
                duration_ms=duration_ms,
            )

        except Exception as exc:
            duration_ms = int((time.monotonic() - started) * 1000)
            logger.error("Task %s failed: %s", task.task_id, exc)
            return ParallelResult(
                task_id=task.task_id,
                session_id=session_id,
                success=False,
                result=None,
                error=str(exc),
                duration_ms=duration_ms,
            )

    async def _execute_with_adapter(self, task: ParallelTask, session_id: str, run_id: str):
        """Instantiate the requested adapter and execute the task goal."""
        from core.base_adapter import ActionRequest

        action = ActionRequest(
            action_type="goto" if task.url else "execute",
            target=task.url or task.goal,
            parameters={"goal": task.goal, "url": task.url},
            timeout_ms=task.timeout_ms,
        )

        adapter = self._build_adapter(task.adapter_id)
        await adapter.initialize()
        try:
            return await adapter.execute(action, session_id, run_id)
        finally:
            try:
                await adapter.close()
            except Exception:
                pass

    @staticmethod
    def _build_adapter(adapter_id: str):
        """Instantiate the adapter for the given adapter_id."""
        if adapter_id == "browser.playwright":
            from adapters.browser.playwright import PlaywrightAdapter
            return PlaywrightAdapter()

        if adapter_id == "desktop.accessibility":
            from adapters.desktop.accessibility_adapter import AccessibilityAdapter
            return AccessibilityAdapter()

        raise ValueError(
            f"Unknown adapter_id '{adapter_id}' for parallel execution. "
            f"Supported: browser.playwright, desktop.accessibility."
        )


# ── Module-level singleton factory ────────────────────────────────────────────

_coordinator_instance: Optional[ParallelCoordinator] = None


def get_coordinator(max_concurrent: int = 4) -> ParallelCoordinator:
    """
    Return the module-level ParallelCoordinator singleton.
    If max_concurrent differs from the existing instance's value a new instance
    is created and replaces the singleton.
    """
    global _coordinator_instance
    if _coordinator_instance is None or _coordinator_instance.max_concurrent != max_concurrent:
        _coordinator_instance = ParallelCoordinator(max_concurrent=max_concurrent)
    return _coordinator_instance
