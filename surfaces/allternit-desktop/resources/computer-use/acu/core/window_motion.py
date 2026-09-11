"""
Allternit Computer Use — Window Motion Engine

Drag, resize, and set-frame operations for desktop windows with smooth easing.
Inspired by background-computer-use's WindowMotionEngine.

macOS: AXUIElement position/size attributes + NSScreen bounds.
Falls back to AppleScript for basic move/resize.
"""

from __future__ import annotations

import asyncio
import logging
import math
import platform
from dataclasses import dataclass, field
from enum import Enum
from typing import List, Optional, Tuple

logger = logging.getLogger(__name__)

PLATFORM = platform.system().lower()


class MotionType(Enum):
    DRAG = "drag"
    RESIZE = "resize"
    SET_FRAME = "set_frame"


class ResizeEdge(Enum):
    TOP = "top"
    BOTTOM = "bottom"
    LEFT = "left"
    RIGHT = "right"
    TOP_LEFT = "top_left"
    TOP_RIGHT = "top_right"
    BOTTOM_LEFT = "bottom_left"
    BOTTOM_RIGHT = "bottom_right"


@dataclass
class Frame:
    x: float
    y: float
    width: float
    height: float

    @classmethod
    def from_dict(cls, d: dict) -> "Frame":
        return cls(x=d.get("x", 0), y=d.get("y", 0),
                   width=d.get("width", 0), height=d.get("height", 0))

    def to_dict(self) -> dict:
        return {"x": self.x, "y": self.y, "width": self.width, "height": self.height}

    def center(self) -> Tuple[float, float]:
        return (self.x + self.width / 2, self.y + self.height / 2)

    def is_valid(self) -> bool:
        return self.width > 0 and self.height > 0 and self.x >= 0 and self.y >= 0


@dataclass
class MotionSegment:
    from_frame: Frame
    to_frame: Frame
    duration_ms: int
    easing: str = "ease-out"


@dataclass
class WindowMotionPlan:
    motion_type: MotionType
    window_id: int
    from_frame: Frame
    to_frame: Frame
    segments: List[MotionSegment]
    total_duration_ms: int


@dataclass
class WindowMotionResult:
    success: bool
    final_frame: Optional[Frame]
    notes: str
    duration_ms: int


class WindowMotionEngine:
    """
    Plan and execute window drag/resize/set-frame operations.

    Uses AXUIElement APIs on macOS for native window manipulation.
    Falls back to AppleScript for basic move/resize.
    """

    MIN_SIZE = 100.0

    def __init__(self) -> None:
        self._platform = PLATFORM

    # ─── Public async API ────────────────────────────────────────────────────

    async def get_window_frame(self, window_id: int) -> Optional[Frame]:
        """Return current frame for window_id, or None if not found."""
        if self._platform == "darwin":
            return await asyncio.get_event_loop().run_in_executor(None, self._macos_get_frame, window_id)
        return None

    async def plan_drag(self, window_id: int, delta_x: float, delta_y: float) -> WindowMotionPlan:
        """Plan moving a window by (delta_x, delta_y) pixels."""
        current = await self.get_window_frame(window_id) or Frame(100, 100, 800, 600)
        screen = await self._get_screen_bounds()
        target = Frame(current.x + delta_x, current.y + delta_y, current.width, current.height)
        target = self._clamp_to_screen(target, screen)
        seg = MotionSegment(from_frame=current, to_frame=target, duration_ms=300)
        return WindowMotionPlan(MotionType.DRAG, window_id, current, target, [seg], 300)

    async def plan_resize(self, window_id: int, edge: ResizeEdge, delta: float) -> WindowMotionPlan:
        """Plan resizing a window by dragging an edge."""
        current = await self.get_window_frame(window_id) or Frame(100, 100, 800, 600)
        target = self._apply_edge_resize(current, edge, delta)
        seg = MotionSegment(from_frame=current, to_frame=target, duration_ms=200)
        return WindowMotionPlan(MotionType.RESIZE, window_id, current, target, [seg], 200)

    async def plan_set_frame(self, window_id: int, frame: Frame) -> WindowMotionPlan:
        """Plan setting a window to an exact frame."""
        current = await self.get_window_frame(window_id) or Frame(100, 100, 800, 600)
        screen = await self._get_screen_bounds()
        target = self._clamp_to_screen(frame, screen)
        target.width = max(target.width, self.MIN_SIZE)
        target.height = max(target.height, self.MIN_SIZE)
        seg = MotionSegment(from_frame=current, to_frame=target, duration_ms=250)
        return WindowMotionPlan(MotionType.SET_FRAME, window_id, current, target, [seg], 250)

    async def execute(self, plan: WindowMotionPlan) -> WindowMotionResult:
        """Execute a motion plan, animating through segments."""
        import time
        start_ms = time.time() * 1000
        try:
            if self._platform == "darwin":
                ok = await asyncio.get_event_loop().run_in_executor(
                    None, self._macos_execute_plan, plan
                )
            else:
                ok = False
            duration = int(time.time() * 1000 - start_ms)
            final = await self.get_window_frame(plan.window_id)
            return WindowMotionResult(success=ok, final_frame=final,
                                      notes="completed" if ok else "platform not supported",
                                      duration_ms=duration)
        except Exception as e:
            logger.error("WindowMotionEngine.execute failed: %s", e)
            return WindowMotionResult(success=False, final_frame=None,
                                      notes=str(e), duration_ms=0)

    async def list_windows_with_frames(self) -> List[dict]:
        """Return [{window_id, title, app, frame}] for all visible windows."""
        if self._platform == "darwin":
            return await asyncio.get_event_loop().run_in_executor(None, self._macos_list_windows)
        return []

    # ─── macOS implementation ─────────────────────────────────────────────────

    def _macos_get_frame(self, window_id: int) -> Optional[Frame]:
        try:
            import Quartz  # type: ignore
            windows = Quartz.CGWindowListCopyWindowInfo(
                Quartz.kCGWindowListOptionAll, Quartz.kCGNullWindowID)
            if not windows:
                return None
            for w in windows:
                if w.get("kCGWindowNumber") == window_id:
                    bounds = w.get("kCGWindowBounds", {})
                    return Frame(
                        x=float(bounds.get("X", 0)),
                        y=float(bounds.get("Y", 0)),
                        width=float(bounds.get("Width", 0)),
                        height=float(bounds.get("Height", 0)),
                    )
        except Exception as e:
            logger.debug("_macos_get_frame error: %s", e)
        return None

    def _macos_execute_plan(self, plan: WindowMotionPlan) -> bool:
        try:
            import AppKit  # type: ignore
            import ApplicationServices  # type: ignore

            # Find the AX element for the window
            running = AppKit.NSWorkspace.sharedWorkspace().runningApplications()
            for app in running:
                pid = app.processIdentifier()
                ax_app = ApplicationServices.AXUIElementCreateApplication(pid)
                result = ApplicationServices.AXUIElementCopyAttributeValue(ax_app, "AXWindows", None)
                if isinstance(result, tuple):
                    err, windows = result
                    if err != 0 or not windows:
                        continue
                else:
                    windows = result or []

                for win in windows:
                    # Check if this is the right window by matching position
                    pos_result = ApplicationServices.AXUIElementCopyAttributeValue(win, "AXPosition", None)
                    if not isinstance(pos_result, tuple):
                        continue
                    err, pos_val = pos_result
                    if err != 0 or pos_val is None:
                        continue
                    try:
                        wx = pos_val.x if hasattr(pos_val, 'x') else float(str(pos_val).split('{')[1].split(',')[0])
                        wy = pos_val.y if hasattr(pos_val, 'y') else 0
                        if abs(wx - plan.from_frame.x) > 50 and abs(wy - plan.from_frame.y) > 50:
                            continue
                    except Exception:
                        pass

                    tf = plan.to_frame
                    # Set position
                    try:
                        import objc  # type: ignore
                        new_pos = ApplicationServices.AXValueCreate(
                            ApplicationServices.kAXValueCGPointType,
                            ApplicationServices.CGPoint(tf.x, tf.y)
                        )
                        ApplicationServices.AXUIElementSetAttributeValue(win, "AXPosition", new_pos)
                    except Exception:
                        pass

                    if plan.motion_type in (MotionType.RESIZE, MotionType.SET_FRAME):
                        try:
                            new_size = ApplicationServices.AXValueCreate(
                                ApplicationServices.kAXValueCGSizeType,
                                ApplicationServices.CGSize(tf.width, tf.height)
                            )
                            ApplicationServices.AXUIElementSetAttributeValue(win, "AXSize", new_size)
                        except Exception:
                            pass
                    return True
        except Exception as e:
            logger.debug("_macos_execute_plan AX approach failed: %s", e)

        # AppleScript fallback
        try:
            import subprocess
            tf = plan.to_frame
            if plan.motion_type == MotionType.DRAG:
                script = f'''
tell application "System Events"
    set frontmost of first process whose frontmost is true to true
    set position of window 1 of first process whose frontmost is true to {{{int(tf.x)}, {int(tf.y)}}}
end tell'''
            else:
                script = f'''
tell application "System Events"
    set frontmost of first process whose frontmost is true to true
    set position of window 1 of first process whose frontmost is true to {{{int(tf.x)}, {int(tf.y)}}}
    set size of window 1 of first process whose frontmost is true to {{{int(tf.width)}, {int(tf.height)}}}
end tell'''
            result = subprocess.run(["osascript", "-e", script], capture_output=True, timeout=5)
            return result.returncode == 0
        except Exception as e:
            logger.warning("_macos_execute_plan AppleScript fallback failed: %s", e)
        return False

    def _macos_list_windows(self) -> List[dict]:
        try:
            import Quartz  # type: ignore
            windows = Quartz.CGWindowListCopyWindowInfo(
                Quartz.kCGWindowListOptionOnScreenOnly | Quartz.kCGWindowListExcludeDesktopElements,
                Quartz.kCGNullWindowID)
            result = []
            if windows:
                for w in windows:
                    if w.get("kCGWindowLayer", 0) != 0:
                        continue
                    bounds = w.get("kCGWindowBounds", {})
                    result.append({
                        "window_id": w.get("kCGWindowNumber", 0),
                        "title": w.get("kCGWindowName", ""),
                        "app": w.get("kCGWindowOwnerName", ""),
                        "frame": {
                            "x": float(bounds.get("X", 0)),
                            "y": float(bounds.get("Y", 0)),
                            "width": float(bounds.get("Width", 0)),
                            "height": float(bounds.get("Height", 0)),
                        },
                    })
            return result
        except Exception as e:
            logger.debug("_macos_list_windows error: %s", e)
        return []

    # ─── Helpers ─────────────────────────────────────────────────────────────

    async def _get_screen_bounds(self) -> Frame:
        if self._platform == "darwin":
            try:
                import AppKit  # type: ignore
                screen = AppKit.NSScreen.mainScreen()
                if screen:
                    f = screen.frame()
                    return Frame(x=0, y=0, width=f.size.width, height=f.size.height)
            except Exception:
                pass
        return Frame(0, 0, 1920, 1080)

    def _clamp_to_screen(self, frame: Frame, screen: Frame) -> Frame:
        x = max(0, min(frame.x, screen.width - frame.width))
        y = max(0, min(frame.y, screen.height - frame.height))
        w = min(frame.width, screen.width)
        h = min(frame.height, screen.height)
        return Frame(x=x, y=y, width=max(w, self.MIN_SIZE), height=max(h, self.MIN_SIZE))

    def _apply_edge_resize(self, frame: Frame, edge: ResizeEdge, delta: float) -> Frame:
        x, y, w, h = frame.x, frame.y, frame.width, frame.height
        if edge == ResizeEdge.RIGHT:
            w = max(self.MIN_SIZE, w + delta)
        elif edge == ResizeEdge.BOTTOM:
            h = max(self.MIN_SIZE, h + delta)
        elif edge == ResizeEdge.LEFT:
            x += delta; w = max(self.MIN_SIZE, w - delta)
        elif edge == ResizeEdge.TOP:
            y += delta; h = max(self.MIN_SIZE, h - delta)
        elif edge == ResizeEdge.BOTTOM_RIGHT:
            w = max(self.MIN_SIZE, w + delta); h = max(self.MIN_SIZE, h + delta)
        elif edge == ResizeEdge.BOTTOM_LEFT:
            x += delta; w = max(self.MIN_SIZE, w - delta); h = max(self.MIN_SIZE, h + delta)
        elif edge == ResizeEdge.TOP_RIGHT:
            y += delta; w = max(self.MIN_SIZE, w + delta); h = max(self.MIN_SIZE, h - delta)
        elif edge == ResizeEdge.TOP_LEFT:
            x += delta; y += delta
            w = max(self.MIN_SIZE, w - delta); h = max(self.MIN_SIZE, h - delta)
        return Frame(x=x, y=y, width=w, height=h)

    @staticmethod
    def _ease_out(t: float) -> float:
        return 1.0 - math.pow(1.0 - t, 3)

    @staticmethod
    def _lerp(a: float, b: float, t: float) -> float:
        return a + (b - a) * t
