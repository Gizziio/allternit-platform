"""
Allternit Computer Use — Element Reference Map

Deterministic @e1, @e2, @e3 refs assigned depth-first to interactive elements.
Persisted atomically to ~/.allternit/last_refmap.json (1MB limit).
Same UI state always generates same refs — enables reliable LLM targeting.
"""

from __future__ import annotations

import json
import logging
import os
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterator, List, Optional

logger = logging.getLogger(__name__)

_DEFAULT_PERSIST_PATH = Path.home() / ".allternit" / "last_refmap.json"
_MAX_PERSIST_BYTES = 1024 * 1024  # 1 MB
_MAX_REFS_ON_TRIM = 500


# ---------------------------------------------------------------------------
# Data class
# ---------------------------------------------------------------------------

@dataclass
class ElementRef:
    """A resolved element reference — one @eN entry in the map."""
    ref_id: str
    role: str
    name: str
    value: str
    bounds: Dict[str, float]
    surface: str
    app_name: str
    timestamp: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "ref_id": self.ref_id,
            "role": self.role,
            "name": self.name,
            "value": self.value,
            "bounds": self.bounds,
            "surface": self.surface,
            "app_name": self.app_name,
            "timestamp": self.timestamp,
        }

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> ElementRef:
        return cls(
            ref_id=d.get("ref_id", ""),
            role=d.get("role", ""),
            name=d.get("name", ""),
            value=d.get("value", ""),
            bounds=d.get("bounds", {}),
            surface=d.get("surface", ""),
            app_name=d.get("app_name", ""),
            timestamp=d.get("timestamp", ""),
        )


# ---------------------------------------------------------------------------
# RefMap
# ---------------------------------------------------------------------------

class RefMap:
    """
    Maintains a mapping of @e{N} → ElementRef.

    Thread-safety: not designed for concurrent async mutation — callers
    should coordinate externally if needed.
    """

    def __init__(self, persist_path: Optional[Path] = None) -> None:
        self._persist_path = persist_path or _DEFAULT_PERSIST_PATH
        self._counter: int = 0
        # Ordered dict: ref_id → ElementRef
        self._refs: Dict[str, ElementRef] = {}
        # Track allocation order for trimming
        self._alloc_order: List[str] = []

    # ── Core operations ───────────────────────────────────────────────────────

    def allocate(
        self,
        role: str,
        name: str,
        value: str,
        bounds: Dict[str, float],
        surface: str,
        app_name: str,
    ) -> str:
        """Allocate the next @e{N} ref and return it."""
        self._counter += 1
        ref_id = f"@e{self._counter}"
        ref = ElementRef(
            ref_id=ref_id,
            role=role,
            name=name,
            value=value,
            bounds=bounds,
            surface=surface,
            app_name=app_name,
        )
        self._refs[ref_id] = ref
        self._alloc_order.append(ref_id)
        return ref_id

    def resolve(self, ref_id: str) -> Optional[ElementRef]:
        """Look up a ref by its @eN id."""
        return self._refs.get(ref_id)

    def update(self, ref_id: str, ref: ElementRef) -> None:
        """Update an existing ref entry."""
        if ref_id in self._refs:
            self._refs[ref_id] = ref
        else:
            logger.debug("[RefMap] update called for unknown ref %s", ref_id)

    def remove_by_root(self, root_ref: str) -> None:
        """
        Invalidate all child refs of root_ref.

        Uses numeric ordering: removes refs whose numeric index is greater
        than root_ref's number and less than the next sibling's number
        (i.e., all refs allocated in the subtree under root_ref).
        """
        root_num = self._ref_num(root_ref)
        if root_num is None:
            return

        # Find next sibling: the smallest number in alloc_order after root_num
        # that is NOT a descendant. Since we don't track parent info explicitly,
        # we remove all refs from root_num+1 up until the next ref at the same
        # or lesser depth — conservatively: remove root_num+1 through the next
        # ref with a number <= root_num (i.e., all refs allocated after root
        # up to end of the current snapshot batch).
        #
        # Practical heuristic: remove all refs with numbers > root_num that
        # were allocated before any ref with number <= root_num (there won't
        # be any such; alloc order is strictly increasing). So simply remove
        # all refs with index > root_num in alloc_order until the next alloc
        # "returns" (i.e., all contiguous higher-numbered refs after root).
        to_remove: List[str] = []
        in_subtree = False
        for rid in self._alloc_order:
                n = self._ref_num(rid)
                if n is None:
                    continue
                if n == root_num:
                    to_remove.append(rid)
                    in_subtree = True
                elif in_subtree:
                    to_remove.append(rid)
                else:
                    in_subtree = False

        for rid in to_remove:
            self._refs.pop(rid, None)
        self._alloc_order = [r for r in self._alloc_order if r not in to_remove]
        logger.debug("[RefMap] removed %d refs under %s", len(to_remove), root_ref)

    def clear(self) -> None:
        """Reset all refs and counter."""
        self._refs.clear()
        self._alloc_order.clear()
        self._counter = 0

    # ── Persistence ───────────────────────────────────────────────────────────

    def save(self) -> None:
        """Atomically write the ref map to disk. Enforces 1MB limit."""
        try:
            self._persist_path.parent.mkdir(parents=True, exist_ok=True)
            data = self.to_dict()
            payload = json.dumps(data, ensure_ascii=False)

            # Enforce size limit
            if len(payload.encode("utf-8")) > _MAX_PERSIST_BYTES:
                logger.debug(
                    "[RefMap] payload exceeds 1MB — trimming to %d most recent refs",
                    _MAX_REFS_ON_TRIM,
                )
                # Keep last N refs
                recent_ids = self._alloc_order[-_MAX_REFS_ON_TRIM:]
                trimmed: Dict[str, Dict[str, Any]] = {
                    rid: self._refs[rid].to_dict()
                    for rid in recent_ids
                    if rid in self._refs
                }
                payload = json.dumps(
                    {
                        "counter": self._counter,
                        "refs": trimmed,
                        "alloc_order": recent_ids,
                    },
                    ensure_ascii=False,
                )

            tmp_path = self._persist_path.with_suffix(".tmp")
            tmp_path.write_text(payload, encoding="utf-8")
            tmp_path.replace(self._persist_path)
        except Exception as exc:
            logger.warning("[RefMap] save failed: %s", exc)

    def load(self) -> None:
        """Load refs from disk; silently ignore any errors."""
        try:
            if not self._persist_path.exists():
                return
            text = self._persist_path.read_text(encoding="utf-8")
            data = json.loads(text)
            self._counter = int(data.get("counter", 0))
            refs_raw = data.get("refs", {})
            self._refs = {
                rid: ElementRef.from_dict(d)
                for rid, d in refs_raw.items()
            }
            self._alloc_order = list(data.get("alloc_order", list(refs_raw.keys())))
        except Exception as exc:
            logger.debug("[RefMap] load silently ignored: %s", exc)

    # ── Serialisation ─────────────────────────────────────────────────────────

    def to_dict(self) -> Dict[str, Dict[str, Any]]:
        """Serialize all refs to a plain dict."""
        return {
            "counter": self._counter,
            "refs": {rid: ref.to_dict() for rid, ref in self._refs.items()},
            "alloc_order": self._alloc_order,
        }

    # ── Tree integration ──────────────────────────────────────────────────────

    def apply_to_tree(self, root_node: Any) -> None:
        """
        Walk an AccessibilityNode tree and assign ref_ids.

        For each interactive node: look up existing ref by role+name+bounds match;
        if found, re-use that ref_id. Otherwise allocate a new one.
        """
        self._walk_and_assign(root_node)

    def _walk_and_assign(self, node: Any) -> None:
        if node is None:
            return

        is_interactive = getattr(node, "is_interactive", False)
        if is_interactive and not getattr(node, "ref_id", ""):
            # Try to match existing ref
            existing = self._find_match(
                role=getattr(node, "role", ""),
                name=getattr(node, "name", ""),
                bounds=getattr(node, "bounds", {}),
            )
            if existing:
                node.ref_id = existing.ref_id
            else:
                node.ref_id = self.allocate(
                    role=getattr(node, "role", ""),
                    name=getattr(node, "name", ""),
                    value=getattr(node, "value", ""),
                    bounds=getattr(node, "bounds", {}),
                    surface=getattr(node, "surface", "window"),
                    app_name="",
                )

        children = getattr(node, "children", []) or []
        for child in children:
            self._walk_and_assign(child)

    def _find_match(
        self,
        role: str,
        name: str,
        bounds: Dict[str, float],
    ) -> Optional[ElementRef]:
        """Find an existing ref matching role + name + approximate bounds."""
        for ref in self._refs.values():
            if ref.role != role or ref.name != name:
                continue
            if self._bounds_match(ref.bounds, bounds):
                return ref
        return None

    @staticmethod
    def _bounds_match(
        a: Dict[str, float], b: Dict[str, float], tolerance: float = 4.0
    ) -> bool:
        """Return True if two bounds dicts are within tolerance pixels."""
        if not a or not b:
            return not a and not b
        for key in ("x", "y", "width", "height"):
            if abs(a.get(key, 0) - b.get(key, 0)) > tolerance:
                return False
        return True

    @staticmethod
    def _ref_num(ref_id: str) -> Optional[int]:
        """Extract the integer from @e{N}."""
        try:
            if ref_id.startswith("@e"):
                return int(ref_id[2:])
        except (ValueError, IndexError):
            pass
        return None

    # ── Dunder ────────────────────────────────────────────────────────────────

    def __len__(self) -> int:
        return len(self._refs)

    def __iter__(self) -> Iterator[str]:
        return iter(self._refs)


# ---------------------------------------------------------------------------
# Module-level singleton
# ---------------------------------------------------------------------------

_global_refmap: RefMap = RefMap()


def get_refmap() -> RefMap:
    """Return the module-level global RefMap singleton."""
    return _global_refmap


def resolve_ref(ref_id: str) -> Optional[ElementRef]:
    """Convenience — resolve a ref from the global map."""
    return _global_refmap.resolve(ref_id)
