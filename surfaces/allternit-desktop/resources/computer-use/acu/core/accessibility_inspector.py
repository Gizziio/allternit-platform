"""
Allternit Computer Use — Accessibility Inspector

Ports:
  - agent-desktop: skeleton snapshot, progressive drill-down, deterministic refs, multi-surface
  - background-computer-use: coordinate contracts, window state pipeline, AX semantic targeting

macOS only (pyobjc). Gracefully no-ops on other platforms.
"""

from __future__ import annotations

import hashlib
import logging
import platform
import sys
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional, Tuple

logger = logging.getLogger(__name__)

# Sentinel for "attribute not set" in to_dict (used for optional change_type)
_MISSING = object()

# ---------------------------------------------------------------------------
# Platform-specific imports — all wrapped in try/except
# ---------------------------------------------------------------------------

_IS_DARWIN = platform.system() == "Darwin"
_PYOBJC_AVAILABLE = False
_QUARTZ_AVAILABLE = False
_AX_AVAILABLE = False

if _IS_DARWIN:
    try:
        import AppKit
        import Foundation
        _PYOBJC_AVAILABLE = True
    except ImportError:
        pass

    try:
        import Quartz
        import Quartz.CoreGraphics as CG
        _QUARTZ_AVAILABLE = True
    except ImportError:
        pass

    try:
        import ApplicationServices
        _AX_AVAILABLE = True
    except ImportError:
        pass

# ---------------------------------------------------------------------------
# Type aliases
# ---------------------------------------------------------------------------

SurfaceName = Literal["window", "menu", "alert", "popover", "sheet", "focused"]

# Roles considered interactive for ref assignment
_INTERACTIVE_ROLES = frozenset({
    "AXButton",
    "AXTextField",
    "AXTextArea",
    "AXCheckBox",
    "AXRadioButton",
    "AXPopUpButton",
    "AXComboBox",
    "AXSlider",
    "AXLink",
    "AXMenuItem",
    "AXMenuBarItem",
    "AXCell",
    "AXRow",
    "AXTab",
    "AXScrollArea",
})


# ---------------------------------------------------------------------------
# Module-level snapshot cache (keyed by window_id or "focused")
# ---------------------------------------------------------------------------

_snapshot_cache: Dict[str, Any] = {}


# ---------------------------------------------------------------------------
# Diff utilities
# ---------------------------------------------------------------------------

def _node_key(node: "AccessibilityNode") -> str:
    """Stable key for matching nodes between snapshots: (role, name)."""
    return f"{node.role}::{node.name}"


def diff_tree(
    old_node: Optional["AccessibilityNode"],
    new_node: Optional["AccessibilityNode"],
) -> Optional["AccessibilityNode"]:
    """
    Compare two AX tree snapshots and annotate each node with a ``change_type``.

    Matching is done by ``(role, name)`` key within the same parent's child list.
    Each returned node is a copy of ``new_node`` (or a tombstone for removed nodes)
    with an extra ``change_type`` field:

    - ``"added"``    – node exists in new but not old
    - ``"removed"``  – node exists in old but not new (included as a tombstone)
    - ``"modified"`` – value or bounds changed
    - ``None``       – unchanged

    Returns the annotated ``new_node`` tree (with removed children appended).
    """
    import copy

    if new_node is None and old_node is None:
        return None

    # Entirely new subtree
    if old_node is None:
        result = copy.deepcopy(new_node)
        _mark_subtree(result, "added")
        return result

    # Entirely removed subtree — return as tombstone with removed children
    if new_node is None:
        result = copy.deepcopy(old_node)
        _mark_subtree(result, "removed")
        return result

    # Both exist — compare values/bounds
    result = copy.deepcopy(new_node)
    result.children = []

    value_changed = new_node.value != old_node.value
    bounds_changed = new_node.bounds != old_node.bounds
    result.change_type = "modified" if (value_changed or bounds_changed) else None  # type: ignore[attr-defined]

    # Match children by (role, name) key
    old_by_key: Dict[str, List["AccessibilityNode"]] = {}
    for child in old_node.children:
        k = _node_key(child)
        old_by_key.setdefault(k, []).append(child)

    new_by_key: Dict[str, List["AccessibilityNode"]] = {}
    for child in new_node.children:
        k = _node_key(child)
        new_by_key.setdefault(k, []).append(child)

    # Process new children, pair them with old counterparts positionally
    for child in new_node.children:
        k = _node_key(child)
        old_siblings = old_by_key.get(k, [])
        old_match = old_siblings.pop(0) if old_siblings else None
        child_diff = diff_tree(old_match, child)
        if child_diff is not None:
            result.children.append(child_diff)

    # Append tombstones for children removed from old that were not consumed
    for old_children_list in old_by_key.values():
        for old_child in old_children_list:
            tombstone = diff_tree(old_child, None)
            if tombstone is not None:
                result.children.append(tombstone)

    return result


def _mark_subtree(node: "AccessibilityNode", change_type: str) -> None:
    """Recursively mark every node in the subtree with the given change_type."""
    node.change_type = change_type  # type: ignore[attr-defined]
    for child in node.children:
        _mark_subtree(child, change_type)


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclass
class AccessibilityNode:
    """A node in the accessibility tree."""
    ref_id: str = ""
    role: str = ""
    name: str = ""
    value: str = ""
    description: str = ""
    hint: str = ""
    states: List[str] = field(default_factory=list)
    bounds: Dict[str, float] = field(default_factory=dict)
    children: List[AccessibilityNode] = field(default_factory=list)
    is_interactive: bool = False

    def to_dict(self, include_children: bool = True, compact: bool = False) -> Dict[str, Any]:
        d: Dict[str, Any] = {}
        if not compact or self.ref_id:
            d["ref_id"] = self.ref_id
        if not compact or self.role:
            d["role"] = self.role
        if not compact or self.name:
            d["name"] = self.name
        if not compact or self.value:
            d["value"] = self.value
        if not compact or self.description:
            d["description"] = self.description
        if not compact or self.hint:
            d["hint"] = self.hint
        if not compact or self.states:
            d["states"] = self.states
        if not compact or self.bounds:
            d["bounds"] = self.bounds
        if not compact or self.is_interactive:
            d["is_interactive"] = self.is_interactive

        if compact:
            # Remove empty/None values
            d = {k: v for k, v in d.items() if v or v == 0}

        # Include change_type when present (set by diff_tree on annotated copies)
        change_type = getattr(self, "change_type", _MISSING)
        if change_type is not _MISSING:
            d["change_type"] = change_type

        if include_children:
            d["children"] = [
                c.to_dict(include_children=True, compact=compact)
                for c in self.children
            ]
        return d


@dataclass
class CoordinateContract:
    """Maps between raw screen coordinates and model-space coordinates."""
    scale_factor: float = 1.0
    offset_x: float = 0.0
    offset_y: float = 0.0
    raw_width: int = 1920
    raw_height: int = 1080
    model_width: int = 1280
    model_height: int = 800
    coordinate_system: str = "AppKit"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "scale_factor": self.scale_factor,
            "offset_x": self.offset_x,
            "offset_y": self.offset_y,
            "raw_width": self.raw_width,
            "raw_height": self.raw_height,
            "model_width": self.model_width,
            "model_height": self.model_height,
            "coordinate_system": self.coordinate_system,
        }

    def screen_to_model(self, x: float, y: float) -> Tuple[float, float]:
        """Convert raw screen coordinates to model-space coordinates."""
        mx = (x * self.scale_factor + self.offset_x) * (self.model_width / max(self.raw_width, 1))
        my = (y * self.scale_factor + self.offset_y) * (self.model_height / max(self.raw_height, 1))
        return (mx, my)

    def model_to_screen(self, x: float, y: float) -> Tuple[float, float]:
        """Convert model-space coordinates back to raw screen coordinates."""
        sx = (x * (self.raw_width / max(self.model_width, 1)) - self.offset_x) / max(self.scale_factor, 0.001)
        sy = (y * (self.raw_height / max(self.model_height, 1)) - self.offset_y) / max(self.scale_factor, 0.001)
        return (sx, sy)


@dataclass
class WindowInfo:
    """Information about a desktop window."""
    window_id: int = 0
    title: str = ""
    app_name: str = ""
    bundle_id: str = ""
    frame: Dict[str, float] = field(default_factory=dict)
    is_minimized: bool = False
    is_focused: bool = False


@dataclass
class AppInfo:
    """Information about a running application."""
    pid: int = 0
    name: str = ""
    bundle_id: str = ""
    is_active: bool = False


@dataclass
class NotificationInfo:
    """A macOS notification center notification."""
    notification_id: str = ""
    title: str = ""
    body: str = ""
    app_name: str = ""
    timestamp: str = ""
    actions: List[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# AccessibilityInspector
# ---------------------------------------------------------------------------

class AccessibilityInspector:
    """
    Full accessibility tree inspection using pyobjc AX APIs.

    On non-Darwin platforms or when pyobjc is unavailable, all methods
    return empty lists / None gracefully.
    """

    def __init__(self) -> None:
        self._platform = platform.system()
        self._pyobjc_ok = _PYOBJC_AVAILABLE
        self._quartz_ok = _QUARTZ_AVAILABLE
        self._ax_ok = _AX_AVAILABLE
        # ref counter — reset on each snapshot call
        self._ref_counter: List[int] = [0]

    # ── Availability ─────────────────────────────────────────────────────────

    async def is_available(self) -> bool:
        """Return True if pyobjc is present and accessibility permissions granted."""
        if not _IS_DARWIN or not _PYOBJC_AVAILABLE:
            return False
        try:
            import ApplicationServices as AS
            # kAXTrustedCheckOptionPrompt = False → no dialog
            opts = Foundation.NSDictionary.dictionaryWithObject_forKey_(
                Foundation.NSNumber.numberWithBool_(False),
                "AXTrustedCheckOptionPrompt",
            )
            trusted = AS.AXIsProcessTrustedWithOptions(opts)
            return bool(trusted)
        except Exception as exc:
            logger.debug("[AX] is_available check failed: %s", exc)
            return False

    # ── Application listing ───────────────────────────────────────────────────

    async def list_apps(self) -> List[AppInfo]:
        """List running applications via NSWorkspace."""
        if not _IS_DARWIN or not _PYOBJC_AVAILABLE:
            return []
        try:
            workspace = AppKit.NSWorkspace.sharedWorkspace()
            apps = workspace.runningApplications()
            result: List[AppInfo] = []
            for app in apps:
                try:
                    name = str(app.localizedName() or "")
                    bundle = str(app.bundleIdentifier() or "")
                    pid = int(app.processIdentifier())
                    active = bool(app.isActive())
                    result.append(AppInfo(pid=pid, name=name, bundle_id=bundle, is_active=active))
                except Exception:
                    continue
            return result
        except Exception as exc:
            logger.warning("[AX] list_apps failed: %s", exc)
            return []

    # ── Window listing ────────────────────────────────────────────────────────

    async def list_windows(self, app_name: Optional[str] = None) -> List[WindowInfo]:
        """List on-screen windows, optionally filtered by app name."""
        if not _IS_DARWIN or not _QUARTZ_AVAILABLE:
            return []
        try:
            window_list = CG.CGWindowListCopyWindowInfo(
                CG.kCGWindowListOptionOnScreenOnly | CG.kCGWindowListExcludeDesktopElements,
                CG.kCGNullWindowID,
            )
            if window_list is None:
                return []

            result: List[WindowInfo] = []
            for win in window_list:
                try:
                    w_app = str(win.get("kCGWindowOwnerName", ""))
                    if app_name and w_app.lower() != app_name.lower():
                        continue

                    bounds_dict = win.get("kCGWindowBounds", {})
                    frame: Dict[str, float] = {
                        "x": float(bounds_dict.get("X", 0)),
                        "y": float(bounds_dict.get("Y", 0)),
                        "width": float(bounds_dict.get("Width", 0)),
                        "height": float(bounds_dict.get("Height", 0)),
                    }
                    window_id = int(win.get("kCGWindowNumber", 0))
                    title = str(win.get("kCGWindowName", ""))
                    layer = int(win.get("kCGWindowLayer", 0))
                    is_minimized = layer < 0

                    result.append(WindowInfo(
                        window_id=window_id,
                        title=title,
                        app_name=w_app,
                        bundle_id="",
                        frame=frame,
                        is_minimized=is_minimized,
                        is_focused=False,
                    ))
                except Exception:
                    continue

            # Mark focused window
            if result and _PYOBJC_AVAILABLE:
                try:
                    workspace = AppKit.NSWorkspace.sharedWorkspace()
                    front_app = workspace.frontmostApplication()
                    front_name = str(front_app.localizedName() or "") if front_app else ""
                    for w in result:
                        if w.app_name == front_name:
                            w.is_focused = True
                            break
                except Exception:
                    pass

            return result
        except Exception as exc:
            logger.warning("[AX] list_windows failed: %s", exc)
            return []

    # ── Coordinate contract ───────────────────────────────────────────────────

    async def get_coordinate_contract(
        self, window_id: Optional[int] = None
    ) -> CoordinateContract:
        """Build a coordinate contract for the main screen (or specified window)."""
        scale = 1.0
        raw_w, raw_h = 1920, 1080
        offset_x, offset_y = 0.0, 0.0

        if not _IS_DARWIN or not _PYOBJC_AVAILABLE:
            return CoordinateContract(
                scale_factor=scale,
                offset_x=offset_x,
                offset_y=offset_y,
                raw_width=raw_w,
                raw_height=raw_h,
            )

        try:
            main_screen = AppKit.NSScreen.mainScreen()
            if main_screen:
                scale = float(main_screen.backingScaleFactor())
                frame = main_screen.frame()
                raw_w = int(frame.size.width)
                raw_h = int(frame.size.height)

            if window_id is not None and _QUARTZ_AVAILABLE:
                wl = CG.CGWindowListCopyWindowInfo(
                    CG.kCGWindowListOptionOnScreenOnly,
                    CG.kCGNullWindowID,
                )
                for win in (wl or []):
                    if int(win.get("kCGWindowNumber", -1)) == window_id:
                        bounds = win.get("kCGWindowBounds", {})
                        offset_x = float(bounds.get("X", 0))
                        offset_y = float(bounds.get("Y", 0))
                        break
        except Exception as exc:
            logger.debug("[AX] get_coordinate_contract partial failure: %s", exc)

        return CoordinateContract(
            scale_factor=scale,
            offset_x=offset_x,
            offset_y=offset_y,
            raw_width=raw_w,
            raw_height=raw_h,
            model_width=1280,
            model_height=800,
            coordinate_system="AppKit",
        )

    # ── Tree snapshot ─────────────────────────────────────────────────────────

    async def snapshot(
        self,
        surface: SurfaceName = "window",
        window_id: Optional[int] = None,
        depth: int = -1,
        skeleton: bool = False,
        interactive_only: bool = False,
    ) -> Optional[AccessibilityNode]:
        """
        Take an accessibility tree snapshot.

        skeleton=True limits traversal to depth=3 for fast high-level scans
        (78-96% token reduction per agent-desktop benchmarks).
        """
        if not _IS_DARWIN or not _PYOBJC_AVAILABLE:
            return None

        try:
            import ApplicationServices as AS

            max_depth = 3 if skeleton else depth

            # Find the frontmost app PID
            pid = await self._get_frontmost_pid()
            if pid is None:
                logger.debug("[AX] snapshot: no frontmost PID")
                return None

            app_el = AS.AXUIElementCreateApplication(pid)
            if app_el is None:
                return None

            # Choose root element based on surface
            root_element = self._get_surface_element(app_el, surface)
            if root_element is None:
                return None

            self._ref_counter = [0]
            root_node = self._traverse_ax(root_element, depth=0, max_depth=max_depth)
            if root_node is None:
                return None

            if interactive_only:
                root_node = self._filter_interactive(root_node)

            self._alloc_refs(root_node, self._ref_counter)
            return root_node

        except Exception as exc:
            logger.warning("[AX] snapshot failed: %s", exc)
            return None

    # ── Named capture helpers (used by AccessibilityAdapter) ─────────────────

    async def capture_focused(self, skeleton: bool = True) -> Optional[AccessibilityNode]:
        """
        Capture the AX tree for the currently focused window.
        Equivalent to snapshot(surface="window", skeleton=skeleton).
        """
        return await self.snapshot(surface="window", skeleton=skeleton)

    async def capture_window(
        self, window_id: int, skeleton: bool = True
    ) -> Optional[AccessibilityNode]:
        """
        Capture the AX tree for a specific window by CGWindowID.

        Locates the owning app via Quartz CGWindowList, finds its PID, then
        takes a full AX snapshot scoped to that app's focused window.
        Falls back to the frontmost app if the window cannot be resolved.
        """
        if not _IS_DARWIN or not _QUARTZ_AVAILABLE:
            return await self.capture_focused(skeleton=skeleton)

        try:
            wl = CG.CGWindowListCopyWindowInfo(
                CG.kCGWindowListOptionAll, CG.kCGNullWindowID
            )
            target_pid: Optional[int] = None
            for win in (wl or []):
                if int(win.get("kCGWindowNumber", -1)) == window_id:
                    target_pid = int(win.get("kCGWindowOwnerPID", 0)) or None
                    break

            if target_pid is None:
                return await self.capture_focused(skeleton=skeleton)

            import ApplicationServices as AS

            max_depth = 3 if skeleton else -1
            app_el = AS.AXUIElementCreateApplication(target_pid)
            if app_el is None:
                return await self.capture_focused(skeleton=skeleton)

            root_element = self._get_surface_element(app_el, "window")
            if root_element is None:
                return await self.capture_focused(skeleton=skeleton)

            self._ref_counter = [0]
            root_node = self._traverse_ax(root_element, depth=0, max_depth=max_depth)
            if root_node is None:
                return None

            self._alloc_refs(root_node, self._ref_counter)
            return root_node

        except Exception as exc:
            logger.warning("[AX] capture_window(%d) failed: %s", window_id, exc)
            return await self.capture_focused(skeleton=skeleton)

    async def capture_diff(
        self,
        window_id: Optional[int] = None,
        skeleton: bool = True,
    ) -> Tuple[Optional[AccessibilityNode], Optional[AccessibilityNode]]:
        """
        Capture a new AX tree snapshot and diff it against the previous cached snapshot.

        Returns ``(new_tree, diff_result)`` where ``diff_result`` is the annotated
        difference tree from :func:`diff_tree`.  Each node in the diff has a
        ``change_type`` attribute: ``"added"``, ``"removed"``, ``"modified"``, or ``None``.

        The new snapshot is stored in the module-level ``_snapshot_cache`` keyed by
        ``str(window_id)`` or ``"focused"``.
        """
        cache_key = str(window_id) if window_id is not None else "focused"

        if window_id is not None:
            new_tree = await self.capture_window(window_id, skeleton=skeleton)
        else:
            new_tree = await self.capture_focused(skeleton=skeleton)

        old_tree = _snapshot_cache.get(cache_key)

        if new_tree is not None:
            _snapshot_cache[cache_key] = new_tree

        diff_result = diff_tree(old_tree, new_tree)
        return (new_tree, diff_result)

    # ── Subtree drill-down ────────────────────────────────────────────────────

    async def get_subtree(
        self, ref_id: str, depth: int = 5
    ) -> Optional[AccessibilityNode]:
        """
        Drill into a specific @e ref for deeper inspection.
        Corresponds to agent-desktop's progressive drill-down strategy.
        """
        if not _IS_DARWIN or not _PYOBJC_AVAILABLE:
            return None

        # Take a fresh snapshot, then find the ref
        root = await self.snapshot(depth=depth)
        if root is None:
            return None
        return self._find_by_ref(root, ref_id)

    # ── Element search ────────────────────────────────────────────────────────

    async def find_element(
        self,
        query: str,
        surface: SurfaceName = "window",
    ) -> Optional[AccessibilityNode]:
        """Find the first element whose name, role, or value contains query."""
        root = await self.snapshot(surface=surface)
        if root is None:
            return None
        return self._search_node(root, query.lower())

    # ── Notifications ─────────────────────────────────────────────────────────

    async def list_notifications(self) -> List[NotificationInfo]:
        """
        Enumerate Notification Center notifications via AX.

        Activates the Notification Center app and traverses its AX tree
        to collect visible notification items.
        """
        if not _IS_DARWIN or not _PYOBJC_AVAILABLE:
            return []

        try:
            import ApplicationServices as AS

            # Find Notification Center PID
            nc_pid: Optional[int] = None
            apps = await self.list_apps()
            for app in apps:
                if "NotificationCenter" in (app.name or "") or \
                   "com.apple.notificationcenterui" in (app.bundle_id or ""):
                    nc_pid = app.pid
                    break

            if nc_pid is None:
                return []

            app_el = AS.AXUIElementCreateApplication(nc_pid)
            if app_el is None:
                return []

            self._ref_counter = [0]
            root_node = self._traverse_ax(app_el, depth=0, max_depth=6)
            if root_node is None:
                return []

            notifications: List[NotificationInfo] = []
            self._collect_notifications(root_node, notifications)
            return notifications

        except Exception as exc:
            logger.warning("[AX] list_notifications failed: %s", exc)
            return []

    async def dismiss_notification(self, notification_id: str) -> bool:
        """Dismiss a notification by clicking its close button."""
        if not _IS_DARWIN or not _PYOBJC_AVAILABLE:
            return False
        try:
            notifications = await self.list_notifications()
            for n in notifications:
                if n.notification_id == notification_id:
                    # Attempt AX press on close button via find_element
                    el = await self.find_element("Close")
                    if el:
                        return await self._press_element(el)
            return False
        except Exception as exc:
            logger.warning("[AX] dismiss_notification failed: %s", exc)
            return False

    async def perform_notification_action(
        self, notification_id: str, action: str
    ) -> bool:
        """Perform a named action (e.g. 'Reply', 'Accept') on a notification."""
        if not _IS_DARWIN or not _PYOBJC_AVAILABLE:
            return False
        try:
            el = await self.find_element(action)
            if el:
                return await self._press_element(el)
            return False
        except Exception as exc:
            logger.warning("[AX] perform_notification_action failed: %s", exc)
            return False

    # ── Private helpers ───────────────────────────────────────────────────────

    async def _get_frontmost_pid(self) -> Optional[int]:
        """Return the PID of the frontmost application."""
        try:
            workspace = AppKit.NSWorkspace.sharedWorkspace()
            front = workspace.frontmostApplication()
            if front:
                return int(front.processIdentifier())
        except Exception:
            pass
        return None

    def _get_surface_element(self, app_el: Any, surface: SurfaceName) -> Any:
        """Return the AX element corresponding to the requested surface."""
        try:
            import ApplicationServices as AS

            if surface == "menu":
                return self._ax_attr(app_el, "AXMenuBar")
            elif surface in ("alert", "sheet"):
                # Check focused window for sheets/dialogs first
                win = self._ax_attr(app_el, "AXFocusedWindow")
                if win is not None:
                    children = self._ax_attr(win, "AXChildren") or []
                    for child in children:
                        role = self._ax_attr(child, "AXRole") or ""
                        if role in ("AXSheet", "AXDialog"):
                            return child
                return win or app_el
            elif surface == "focused":
                el = self._ax_attr(app_el, "AXFocusedUIElement")
                return el or app_el
            else:
                # "window", "popover", default
                win = self._ax_attr(app_el, "AXFocusedWindow")
                return win or app_el
        except Exception as exc:
            logger.debug("[AX] _get_surface_element failed: %s", exc)
            return app_el

    def _traverse_ax(
        self,
        element: Any,
        depth: int,
        max_depth: int,
        result_list: Optional[List[Any]] = None,
    ) -> Optional[AccessibilityNode]:
        """
        Recursively traverse an AX element tree.

        Returns an AccessibilityNode tree. Respects max_depth (-1 = unlimited).
        """
        if element is None:
            return None

        try:
            role = str(self._ax_attr(element, "AXRole") or "")
            name = str(self._ax_attr(element, "AXTitle") or "")
            value_raw = self._ax_attr(element, "AXValue")
            value = str(value_raw) if value_raw is not None else ""
            description = str(self._ax_attr(element, "AXDescription") or "")
            hint = str(self._ax_attr(element, "AXHelp") or "")

            # States
            states: List[str] = []
            if self._ax_attr(element, "AXFocused"):
                states.append("focused")
            enabled = self._ax_attr(element, "AXEnabled")
            if enabled is not None and not enabled:
                states.append("disabled")
            if self._ax_attr(element, "AXSelected"):
                states.append("selected")
            if self._ax_attr(element, "AXExpanded"):
                states.append("expanded")

            # Bounds
            bounds: Dict[str, float] = {}
            frame_raw = self._ax_attr(element, "AXFrame")
            if frame_raw is not None:
                try:
                    # AXFrame is an NSValue of NSRect
                    rect = frame_raw  # pyobjc NSRect
                    bounds = {
                        "x": float(rect.origin.x),
                        "y": float(rect.origin.y),
                        "width": float(rect.size.width),
                        "height": float(rect.size.height),
                    }
                except Exception:
                    pass

            is_interactive = role in _INTERACTIVE_ROLES

            node = AccessibilityNode(
                ref_id="",
                role=role,
                name=name,
                value=value,
                description=description,
                hint=hint,
                states=states,
                bounds=bounds,
                children=[],
                is_interactive=is_interactive,
            )

            if result_list is not None:
                result_list.append(node)

            # Recurse into children if depth permits
            if max_depth == -1 or depth < max_depth:
                children_raw = self._ax_attr(element, "AXChildren")
                if children_raw:
                    for child in children_raw:
                        child_node = self._traverse_ax(
                            child,
                            depth=depth + 1,
                            max_depth=max_depth,
                            result_list=result_list,
                        )
                        if child_node is not None:
                            node.children.append(child_node)

            return node

        except Exception as exc:
            logger.debug("[AX] _traverse_ax error: %s", exc)
            return None

    def _alloc_refs(
        self,
        node: AccessibilityNode,
        counter: List[int],
    ) -> None:
        """
        Assign deterministic @e1, @e2, ... refs to interactive nodes depth-first.
        Only interactive nodes receive a ref_id.
        """
        if node.is_interactive:
            counter[0] += 1
            node.ref_id = f"@e{counter[0]}"
        for child in node.children:
            self._alloc_refs(child, counter)

    def _ax_attr(self, element: Any, attr: str) -> Any:
        """
        Safely read an AX attribute from an element.

        pyobjc returns attributes as (error, value) tuples in some bindings;
        handles both the tuple and direct-value forms.
        """
        if element is None:
            return None
        try:
            import ApplicationServices as AS
            result = AS.AXUIElementCopyAttributeValue(element, attr, None)
            # pyobjc binding returns (error_code, value) tuple
            if isinstance(result, tuple):
                err, val = result
                if err == 0:
                    return val
                return None
            return result
        except Exception:
            return None

    def _filter_interactive(self, node: AccessibilityNode) -> AccessibilityNode:
        """Return a new tree containing only interactive nodes (and their path)."""
        filtered_children = [
            self._filter_interactive(c)
            for c in node.children
            if c.is_interactive or self._has_interactive_descendant(c)
        ]
        node.children = filtered_children
        return node

    def _has_interactive_descendant(self, node: AccessibilityNode) -> bool:
        if node.is_interactive:
            return True
        return any(self._has_interactive_descendant(c) for c in node.children)

    def _find_by_ref(
        self, node: AccessibilityNode, ref_id: str
    ) -> Optional[AccessibilityNode]:
        if node.ref_id == ref_id:
            return node
        for child in node.children:
            found = self._find_by_ref(child, ref_id)
            if found:
                return found
        return None

    def _search_node(
        self, node: AccessibilityNode, query: str
    ) -> Optional[AccessibilityNode]:
        if (
            query in node.name.lower()
            or query in node.role.lower()
            or query in node.value.lower()
        ):
            return node
        for child in node.children:
            found = self._search_node(child, query)
            if found:
                return found
        return None

    def _collect_notifications(
        self,
        node: AccessibilityNode,
        out: List[NotificationInfo],
    ) -> None:
        """Walk the tree and collect notification-like items."""
        if node.role in ("AXGroup", "AXCell") and node.name:
            notif = NotificationInfo(
                notification_id=hashlib.md5(
                    (node.name + node.description).encode()
                ).hexdigest()[:12],
                title=node.name,
                body=node.description,
                app_name="",
                timestamp=datetime.now(timezone.utc).isoformat(),
                actions=[c.name for c in node.children if c.role == "AXButton" and c.name],
            )
            out.append(notif)
        for child in node.children:
            self._collect_notifications(child, out)

    async def _press_element(self, node: AccessibilityNode) -> bool:
        """Attempt AXPress on a node (by looking it up in a fresh snapshot)."""
        if not _IS_DARWIN or not _PYOBJC_AVAILABLE:
            return False
        try:
            import ApplicationServices as AS
            pid = await self._get_frontmost_pid()
            if pid is None:
                return False
            app_el = AS.AXUIElementCreateApplication(pid)
            el = self._ax_attr(app_el, "AXFocusedUIElement")
            if el:
                AS.AXUIElementPerformAction(el, "AXPress")
                return True
        except Exception as exc:
            logger.debug("[AX] _press_element failed: %s", exc)
        return False

    def _to_tree_text(self, node: AccessibilityNode, indent: int = 0) -> str:
        """Render the AX tree as human-readable text for debugging."""
        prefix = "  " * indent
        ref = f" {node.ref_id}" if node.ref_id else ""
        name = f' "{node.name}"' if node.name else ""
        value = f" val={node.value!r}" if node.value else ""
        states = f" [{','.join(node.states)}]" if node.states else ""
        line = f"{prefix}{node.role}{ref}{name}{value}{states}"
        parts = [line]
        for child in node.children:
            parts.append(self._to_tree_text(child, indent + 1))
        return "\n".join(parts)
