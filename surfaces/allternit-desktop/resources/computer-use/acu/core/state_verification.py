"""
Allternit Computer Use — State Verification

Captures before/after screen state and verifies that actions had the expected effect.
Inspired by background-computer-use's state token + verification evidence system.
"""

from __future__ import annotations

import hashlib
import json
import logging
import platform
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

_IS_DARWIN = platform.system() == "Darwin"


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclass
class StateToken:
    """
    A compact fingerprint of the current screen state.

    Serves as a before/after marker for verifying that an action
    had the expected effect (ported from background-computer-use's StateToken.swift).
    """
    token_id: str
    screenshot_hash: str
    ax_tree_hash: str
    timestamp: str
    window_count: int
    focused_app: str

    @classmethod
    def from_screenshot_and_tree(
        cls,
        screenshot_bytes: bytes,
        ax_tree: Optional[Any],
    ) -> StateToken:
        """
        Build a token from a screenshot and optional AX tree snapshot.

        ax_tree can be a dict, an AccessibilityNode, or None.
        """
        screenshot_hash = (
            hashlib.md5(screenshot_bytes).hexdigest()
            if screenshot_bytes
            else ""
        )

        tree_hash = ""
        if ax_tree is not None:
            try:
                if isinstance(ax_tree, dict):
                    serialized = json.dumps(ax_tree, sort_keys=True, default=str)
                elif hasattr(ax_tree, "to_dict"):
                    serialized = json.dumps(
                        ax_tree.to_dict(compact=True), sort_keys=True, default=str
                    )
                else:
                    serialized = str(ax_tree)
                tree_hash = hashlib.md5(serialized.encode("utf-8")).hexdigest()
            except Exception as exc:
                logger.debug("[StateToken] ax_tree hash failed: %s", exc)

        focused_app = _get_focused_app_name()
        window_count = _get_window_count()

        return cls(
            token_id=str(uuid.uuid4()),
            screenshot_hash=screenshot_hash,
            ax_tree_hash=tree_hash,
            timestamp=datetime.now(timezone.utc).isoformat(),
            window_count=window_count,
            focused_app=focused_app,
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "token_id": self.token_id,
            "screenshot_hash": self.screenshot_hash,
            "ax_tree_hash": self.ax_tree_hash,
            "timestamp": self.timestamp,
            "window_count": self.window_count,
            "focused_app": self.focused_app,
        }


@dataclass
class VerificationEvidence:
    """
    Comparison between two state captures.

    Quantifies whether an action had the expected effect and provides
    a confidence score for downstream planning decisions.
    """
    before_token: StateToken
    after_token: StateToken
    changed: bool
    screenshot_changed: bool
    tree_changed: bool
    confidence: float
    notes: List[str]
    verified_success: bool

    def to_dict(self) -> Dict[str, Any]:
        return {
            "before_token": self.before_token.to_dict(),
            "after_token": self.after_token.to_dict(),
            "changed": self.changed,
            "screenshot_changed": self.screenshot_changed,
            "tree_changed": self.tree_changed,
            "confidence": self.confidence,
            "notes": self.notes,
            "verified_success": self.verified_success,
        }


@dataclass
class StateCapture:
    """
    A full state capture — token + raw data.

    Used internally by StateVerifier; not persisted by default.
    """
    token: StateToken
    screenshot_bytes: bytes
    ax_tree: Optional[Dict[str, Any]]
    captured_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )


# ---------------------------------------------------------------------------
# StateVerifier
# ---------------------------------------------------------------------------

class StateVerifier:
    """
    Captures screen state before/after an action and computes verification evidence.

    Usage:
        verifier = StateVerifier(inspector=ax_inspector)
        before = await verifier.capture(session_id, screenshot_bytes)
        # ... perform action ...
        after = await verifier.capture(session_id, new_screenshot_bytes)
        evidence = verifier.verify(before, after, expected_action_type="click")
    """

    def __init__(self, inspector: Optional[Any] = None) -> None:
        """
        inspector: an AccessibilityInspector instance (optional).
        When provided, state captures will include an AX tree snapshot.
        """
        self._inspector = inspector

    async def capture(
        self,
        session_id: str,
        screenshot_bytes: bytes,
    ) -> StateCapture:
        """
        Capture current state: screenshot token + optional AX tree snapshot.
        """
        ax_tree: Optional[Dict[str, Any]] = None

        if self._inspector is not None:
            try:
                root = await self._inspector.snapshot(skeleton=True)
                if root is not None:
                    ax_tree = root.to_dict(compact=True)
            except Exception as exc:
                logger.debug("[StateVerifier] AX snapshot skipped: %s", exc)

        token = StateToken.from_screenshot_and_tree(screenshot_bytes, ax_tree)
        return StateCapture(
            token=token,
            screenshot_bytes=screenshot_bytes,
            ax_tree=ax_tree,
            captured_at=token.timestamp,
        )

    def verify(
        self,
        before: StateCapture,
        after: StateCapture,
        expected_action_type: str = "",
    ) -> VerificationEvidence:
        """
        Compare two state captures and compute confidence that the action succeeded.

        Confidence rules (ported from background-computer-use VerificationEvidence):
          click/press:    0.9 if screenshot changed, 0.3 if not
          type/fill:      0.8 if tree changed, 0.5 if not
          screenshot/read: always 1.0 (read-only, no change expected)
          navigate/goto:  0.95 if both changed, 0.4 if neither
          scroll:         0.7 if screenshot changed, 0.5 if not
          default:        0.6 if anything changed, 0.4 if nothing
        """
        bt = before.token
        at = after.token
        notes: List[str] = []

        screenshot_changed = bt.screenshot_hash != at.screenshot_hash
        tree_changed = bt.ax_tree_hash != at.ax_tree_hash and bool(
            bt.ax_tree_hash and at.ax_tree_hash
        )
        window_count_changed = bt.window_count != at.window_count
        app_changed = bt.focused_app != at.focused_app
        changed = screenshot_changed or tree_changed or window_count_changed or app_changed

        # Build human-readable notes
        if screenshot_changed:
            notes.append("Screenshot changed — visible content differs.")
        else:
            notes.append("Screenshot unchanged.")

        if bt.ax_tree_hash and at.ax_tree_hash:
            if tree_changed:
                notes.append("Accessibility tree changed — UI structure updated.")
            else:
                notes.append("Accessibility tree unchanged.")
        else:
            notes.append("Accessibility tree not available for comparison.")

        if window_count_changed:
            notes.append(
                f"Window count changed: {bt.window_count} → {at.window_count}."
            )
        if app_changed:
            notes.append(
                f"Focused app changed: {bt.focused_app!r} → {at.focused_app!r}."
            )

        # Confidence scoring
        action = expected_action_type.lower()
        confidence: float
        verified_success: bool

        if action in ("click", "left_click", "right_click", "double_click",
                      "middle_click", "press"):
            if screenshot_changed:
                confidence = 0.9
                notes.append("Action: click — screenshot changed as expected.")
            else:
                confidence = 0.3
                notes.append("Action: click — no visual change detected; may have failed.")
            verified_success = screenshot_changed

        elif action in ("type", "fill", "key", "key_combo"):
            if tree_changed:
                confidence = 0.8
                notes.append("Action: type/key — AX tree updated as expected.")
            elif screenshot_changed:
                confidence = 0.65
                notes.append("Action: type/key — screenshot changed (AX tree unchanged).")
            else:
                confidence = 0.5
                notes.append("Action: type/key — no detectable change.")
            verified_success = tree_changed or screenshot_changed

        elif action in ("screenshot", "read", "observe", "inspect"):
            confidence = 1.0
            notes.append("Action: read-only — no change expected.")
            verified_success = True

        elif action in ("navigate", "goto"):
            if screenshot_changed and (tree_changed or app_changed):
                confidence = 0.95
                notes.append("Action: navigate — both screenshot and tree updated.")
            elif screenshot_changed:
                confidence = 0.7
                notes.append("Action: navigate — screenshot changed but tree unchanged.")
            else:
                confidence = 0.4
                notes.append("Action: navigate — no detectable page change.")
            verified_success = screenshot_changed

        elif action in ("scroll",):
            if screenshot_changed:
                confidence = 0.7
                notes.append("Action: scroll — visual change detected.")
            else:
                confidence = 0.5
                notes.append("Action: scroll — no visual change; content may be at boundary.")
            verified_success = screenshot_changed

        elif action in ("drag", "left_click_drag"):
            if screenshot_changed:
                confidence = 0.85
                notes.append("Action: drag — visual change detected.")
            else:
                confidence = 0.35
                notes.append("Action: drag — no visual change detected.")
            verified_success = screenshot_changed

        else:
            # Generic fallback
            if changed:
                confidence = 0.6
                notes.append("State changed — action likely had an effect.")
            else:
                confidence = 0.4
                notes.append("No state change detected; action may have had no effect.")
            verified_success = changed

        return VerificationEvidence(
            before_token=bt,
            after_token=at,
            changed=changed,
            screenshot_changed=screenshot_changed,
            tree_changed=tree_changed,
            confidence=round(confidence, 3),
            notes=notes,
            verified_success=verified_success,
        )

    def make_token(
        self,
        screenshot_bytes: bytes,
        ax_snapshot: Optional[Dict[str, Any]],
    ) -> StateToken:
        """Build a StateToken directly from raw data (no async I/O)."""
        return StateToken.from_screenshot_and_tree(screenshot_bytes, ax_snapshot)


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------

def _get_focused_app_name() -> str:
    """Return the name of the currently focused application."""
    if not _IS_DARWIN:
        return ""
    try:
        import AppKit
        workspace = AppKit.NSWorkspace.sharedWorkspace()
        front = workspace.frontmostApplication()
        if front:
            return str(front.localizedName() or "")
    except Exception:
        pass
    return ""


def _get_window_count() -> int:
    """Return the number of on-screen windows."""
    if not _IS_DARWIN:
        return 0
    try:
        import Quartz.CoreGraphics as CG
        window_list = CG.CGWindowListCopyWindowInfo(
            CG.kCGWindowListOptionOnScreenOnly | CG.kCGWindowListExcludeDesktopElements,
            CG.kCGNullWindowID,
        )
        return len(window_list) if window_list else 0
    except Exception:
        pass
    return 0
