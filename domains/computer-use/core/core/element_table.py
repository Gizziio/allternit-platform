"""
Allternit Computer Use — Shadow Element Table

Atomic indexed table of OBSERVED elements, built from the planning loop's AX
skeleton observation (``AccessibilityInspector.snapshot(skeleton=True)`` /
the ``ax_tree.captured`` compact-dict shape in core/planning_loop.py).

Shadow-mode policy heads (core/decision_head.py) consume this table: model
output maps only to row indices in this table — never to selectors,
coordinates, or JS. Each row carries the ``@eN`` ref from
core/element_refs.py when the refmap has been applied to the tree, so a head's
index choice can be resolved back to the loop's existing element reference
vocabulary without any generative grounding.

Pruning: tables are capped (default 250, matching the jev-ultrafast reference
pattern). When the observed set exceeds the cap, rows are kept by priority,
preserving depth-first observation order within each tier:

1. interactive elements (``is_interactive``) — the actionable set,
2. elements carrying a ``ref_id`` — already addressable via the refmap,
3. elements with a non-empty name — semantically identifiable,
4. remaining role-only elements.

Ties never reorder: the sort is stable, so the cap keeps the first ``cap``
rows of the priority-sorted depth-first walk and drops the tail.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Sequence, Tuple

# The 11-action vocabulary, mirrored from WHITELIST_METHODS in
# core/batch_dispatch.py (Rust BATCH_ACTION_WHITELIST in
# cmd/allternit-api/src/aci_batch.rs is authoritative).
WHITELIST_OPERATIONS = frozenset({
    "click", "fill", "type", "press", "scrollTo", "nextChunk", "prevChunk",
    "selectOptionFromDropdown", "hover", "doubleClick", "dragAndDrop",
})

# Closed operation set per AX role. Every mapped operation is a member of
# WHITELIST_OPERATIONS; roles without an entry support no closed-set action
# (the head then simply has no target options for them).
ROLE_OPERATIONS: Dict[str, Tuple[str, ...]] = {
    "AXButton": ("click", "hover", "doubleClick"),
    "AXLink": ("click", "hover"),
    "AXTextField": ("fill", "type", "press"),
    "AXTextArea": ("fill", "type", "press"),
    "AXComboBox": ("fill", "click", "selectOptionFromDropdown"),
    "AXPopUpButton": ("click", "selectOptionFromDropdown"),
    "AXCheckBox": ("click",),
    "AXRadioButton": ("click",),
    "AXSlider": ("press",),
    "AXMenuItem": ("click",),
    "AXMenuBarItem": ("click",),
    "AXCell": ("click", "hover"),
    "AXRow": ("click", "hover"),
    "AXTab": ("click",),
    "AXScrollArea": ("scrollTo",),
}

DEFAULT_MAX_ELEMENTS = 250

# Reserved shadow-head operation slots (System One graft from cua's jev-use
# recipe, trycua/cua PR #3916 — stack-agnostic contract). Appended AFTER the
# whitelist operations in the operation question's option list. They are not
# whitelist methods, carry no target menus, and are never executed — the head
# proposes them as shadow.decision answers only.
RESERVED_SLOT_OPERATIONS: Tuple[str, ...] = ("reobserve", "abstain")

# One-line explanation of the reserved slots, rendered into [INSTRUCTIONS]
# (planning loop state text) and the KimiCliHead prompt when the slots are on.
RESERVED_SLOTS_INSTRUCTION = (
    "reobserve: the page changed in a way not reflected above; take a fresh "
    "observation instead of acting. abstain: none of the listed "
    "operations/targets is the right next action."
)

# Cap on each delta list rendered into the [SINCE LAST STEP] block; the
# overflow count is reported as a "+N more" line instead.
DELTA_DISPLAY_CAP = 30

_NORMALIZE_RE = re.compile(r"[^a-z0-9]+")


def operations_for_role(role: str) -> Tuple[str, ...]:
    """Closed whitelist subset compatible with an AX role (empty if none)."""
    return ROLE_OPERATIONS.get(role, ())


@dataclass
class ElementRow:
    """One observed element in the shadow element table."""
    index: int
    role: str
    name: str
    value: str = ""
    ref_id: str = ""
    bounds: Dict[str, float] = field(default_factory=dict)
    operations: Tuple[str, ...] = ()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "index": self.index,
            "role": self.role,
            "name": self.name,
            "value": self.value,
            "ref_id": self.ref_id,
            "bounds": self.bounds,
            "operations": list(self.operations),
        }


@dataclass
class ElementTable:
    """Indexed table of observed elements for one decision step."""
    rows: List[ElementRow] = field(default_factory=list)
    total_observed: int = 0
    pruned_count: int = 0

    def __len__(self) -> int:
        return len(self.rows)

    def row(self, index: int) -> Optional[ElementRow]:
        if 0 <= index < len(self.rows):
            return self.rows[index]
        return None

    def supported_operations(self) -> List[str]:
        """Whitelist operations that at least one observed row supports."""
        ops = set()
        for row in self.rows:
            ops.update(row.operations)
        return sorted(ops & WHITELIST_OPERATIONS)

    def target_options(self, operation: str) -> List[str]:
        """Row indices supporting ``operation`` — head target choices map to
        observed element indices only, never to selectors or coordinates."""
        if operation not in WHITELIST_OPERATIONS:
            return []
        return [str(row.index) for row in self.rows if operation in row.operations]

    def to_prompt_text(self) -> str:
        """Render the table in the same ``[<id>] <role>: <name>`` line shape
        the browser runtime's treeFormatUtils.ts produces, with the table
        index as the id (plus the @eN ref when the refmap assigned one)."""
        lines = []
        for row in self.rows:
            ident = row.ref_id or str(row.index)
            label = row.name or row.value or "(unnamed)"
            lines.append(f"[{ident}] {row.role or 'AXUnknown'}: {label}")
        return "\n".join(lines)

    def match_target(self, target: str) -> Optional[int]:
        """Best-effort deterministic match of a free-text LLM target (element
        name, @eN ref, or selector-like string) to a row index.

        Used by the shadow eval harness to score agreement; the head itself
        never sees free text — its choices are already indices.
        """
        text = (target or "").strip()
        if not text:
            return None
        if text.startswith("@e"):
            for row in self.rows:
                if row.ref_id == text:
                    return row.index
        needle = _normalize(text)
        if not needle:
            return None
        # Exact normalized name match wins over substring match.
        for row in self.rows:
            if _normalize(row.name) == needle:
                return row.index
        for row in self.rows:
            haystack = _normalize(f"{row.name} {row.value} {row.ref_id}")
            if needle and needle in haystack:
                return row.index
        return None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "element_count": len(self.rows),
            "total_observed": self.total_observed,
            "pruned_count": self.pruned_count,
            "rows": [row.to_dict() for row in self.rows],
        }


def _normalize(text: str) -> str:
    return _NORMALIZE_RE.sub("", (text or "").lower())


# ---------------------------------------------------------------------------
# Per-step state deltas ([SINCE LAST STEP] block)
# ---------------------------------------------------------------------------

def _row_identity(row: ElementRow) -> Tuple[str, str, str]:
    """Identity key for delta classification: WHO the element is, ignoring
    its mutable value (a value change is a CHANGED row, not REMOVED+ADDED)."""
    return (row.role, row.name, row.ref_id)


@dataclass
class TableDelta:
    """Element-table difference between two consecutive decision steps.

    ``changed`` pairs (previous_row, current_row) share an identity but
    differ in value. The ``*_overflow`` counters hold list sizes beyond
    ``DELTA_DISPLAY_CAP`` (the full lists stay available to consumers; only
    the rendering is capped).
    """
    added: List[ElementRow] = field(default_factory=list)
    removed: List[ElementRow] = field(default_factory=list)
    changed: List[Tuple[ElementRow, ElementRow]] = field(default_factory=list)
    added_overflow: int = 0
    removed_overflow: int = 0
    changed_overflow: int = 0

    @property
    def has_changes(self) -> bool:
        return bool(self.added or self.removed or self.changed)

    def counts(self) -> Dict[str, int]:
        """Full per-class totals including uncapped overflow."""
        return {
            "added": len(self.added) + self.added_overflow,
            "removed": len(self.removed) + self.removed_overflow,
            "changed": len(self.changed) + self.changed_overflow,
        }

    def one_line(self) -> str:
        """Compact trajectory summary: counts, or the actual changed rows
        when the delta is a few value changes and nothing else."""
        counts = self.counts()
        if not any(counts.values()):
            return "no change in observed elements"
        if (
            counts["added"] == 0
            and counts["removed"] == 0
            and 0 < counts["changed"] <= 3
        ):
            parts = [
                f'{_current.name or _current.role} = "{_current.value}"'
                for _previous, _current in self.changed[:3]
            ]
            return "changed: " + "; ".join(parts)
        return (
            f"+{counts['added']} added, "
            f"{counts['removed']} removed, "
            f"{counts['changed']} changed"
        )


def diff_tables(
    previous: ElementTable,
    current: ElementTable,
    cap: int = DELTA_DISPLAY_CAP,
) -> TableDelta:
    """Classify row-level changes between two consecutive element tables.

    Row identity is the (role, name, ref_id) tuple; a same-identity row with
    a different value is CHANGED, not REMOVED+ADDED. Each class list is
    capped at ``cap`` rows with the overflow counted on the delta.
    """
    previous_by_identity = {_row_identity(row): row for row in previous.rows}
    current_by_identity = {_row_identity(row): row for row in current.rows}

    added = [row for identity, row in current_by_identity.items()
             if identity not in previous_by_identity]
    removed = [row for identity, row in previous_by_identity.items()
               if identity not in current_by_identity]
    # Intersection via dict membership, ordered by the CURRENT table's row
    # order (depth-first observation order) — a bare set intersection has
    # arbitrary order, which would make the rendered delta non-deterministic.
    changed = [
        (previous_by_identity[_row_identity(row)], row)
        for row in current.rows
        if _row_identity(row) in previous_by_identity
        and previous_by_identity[_row_identity(row)].value != row.value
    ]

    def _cap(rows: List[Any]) -> Tuple[List[Any], int]:
        return rows[:cap], max(0, len(rows) - cap)

    added, added_overflow = _cap(added)
    removed, removed_overflow = _cap(removed)
    changed, changed_overflow = _cap(changed)
    return TableDelta(
        added=added,
        removed=removed,
        changed=changed,
        added_overflow=added_overflow,
        removed_overflow=removed_overflow,
        changed_overflow=changed_overflow,
    )


def _delta_row_line(prefix: str, row: ElementRow) -> str:
    ident = row.ref_id or str(row.index)
    label = row.name or row.value or "(unnamed)"
    return f"{prefix} [{ident}] {row.role or 'AXUnknown'}: {label}"


def render_delta_block(delta: TableDelta) -> str:
    """Render the [SINCE LAST STEP] block for the shadow state text.

    Lines are prefixed with +/- / ~ so they can never be mistaken for the
    ``[<id>] <role>: <name>`` element-table lines by consumers that parse
    the state text (e.g. core/shadow_eval.py ``_parse_table_rows``).
    """
    if not delta.has_changes:
        return "[SINCE LAST STEP]\nNo change in observed elements since the last step."
    lines = ["[SINCE LAST STEP]"]
    counts = delta.counts()
    if counts["added"]:
        lines.append(f"ADDED ({counts['added']}):")
        lines.extend(_delta_row_line("+", row) for row in delta.added)
        if delta.added_overflow:
            lines.append(f"+ {delta.added_overflow} more")
    if counts["removed"]:
        lines.append(f"REMOVED ({counts['removed']}):")
        lines.extend(_delta_row_line("-", row) for row in delta.removed)
        if delta.removed_overflow:
            lines.append(f"+ {delta.removed_overflow} more")
    if counts["changed"]:
        lines.append(f"CHANGED ({counts['changed']}):")
        for previous, current in delta.changed:
            lines.append(
                _delta_row_line("~", current)
                + f' = "{current.value}" (was "{previous.value}")'
            )
        if delta.changed_overflow:
            lines.append(f"+ {delta.changed_overflow} more")
    return "\n".join(lines)


def coverage_gaps(table: "ElementTable", expected_names: Sequence[str]) -> List[str]:
    """Expected control names with NO observed row — AX under-reporting.

    Reference finding (third impl): a11y trees can silently omit interactive
    inputs a DOM snapshot sees (a search box surfaced only via DOM). The table
    indexes observed AX elements only, so an under-reported input is a real
    coverage gap, not something to paper over with fuzzy matching — this
    helper uses exact normalized name/value matching (no substring fallbacks,
    unlike ``match_target``) so gaps stay visible. Callers should log/record
    the result rather than drop it.
    """
    observed = {
        _normalize(row.name) for row in table.rows if _normalize(row.name)
    } | {
        _normalize(row.value) for row in table.rows if _normalize(row.value)
    }
    return [name for name in expected_names if _normalize(name) not in observed]


def _flatten_tree(tree: Any) -> List[Dict[str, Any]]:
    """Depth-first flatten of an AX tree in compact-dict or node-object form."""
    flat: List[Dict[str, Any]] = []

    def visit(node: Any) -> None:
        if node is None:
            return
        if isinstance(node, dict):
            flat.append(node)
            children = node.get("children") or []
        else:
            flat.append({
                "role": getattr(node, "role", ""),
                "name": getattr(node, "name", ""),
                "value": getattr(node, "value", ""),
                "ref_id": getattr(node, "ref_id", ""),
                "bounds": getattr(node, "bounds", {}) or {},
                "is_interactive": getattr(node, "is_interactive", False),
            })
            children = getattr(node, "children", []) or []
        for child in children:
            visit(child)

    visit(tree)
    return flat


def build_element_table(
    ax_tree: Any,
    max_elements: int = DEFAULT_MAX_ELEMENTS,
) -> ElementTable:
    """Build an indexed element table from an AX skeleton observation.

    ``ax_tree`` is the compact dict emitted by
    ``AccessibilityNode.to_dict(compact=True)`` (the ``ax_tree.captured``
    event payload) or the AccessibilityNode itself. Only observed elements —
    nodes carrying a role or a name — are indexed; nothing is invented.
    """
    if max_elements < 1:
        max_elements = 1

    observed: List[Dict[str, Any]] = []
    for node in _flatten_tree(ax_tree):
        role = str(node.get("role") or "")
        name = str(node.get("name") or "")
        if not role and not name:
            continue
        observed.append(node)

    total = len(observed)

    def priority(node: Dict[str, Any]) -> int:
        if node.get("is_interactive"):
            return 0
        if node.get("ref_id"):
            return 1
        if str(node.get("name") or "").strip():
            return 2
        return 3

    kept = sorted(observed, key=priority) if total > max_elements else list(observed)
    kept = kept[:max_elements]
    if total > max_elements:
        # Re-apply depth-first order within the kept set for stable indexing.
        kept_ids = {id(n) for n in kept}
        kept = [n for n in observed if id(n) in kept_ids]

    rows: List[ElementRow] = []
    for index, node in enumerate(kept):
        role = str(node.get("role") or "")
        rows.append(ElementRow(
            index=index,
            role=role,
            name=str(node.get("name") or ""),
            value=str(node.get("value") or ""),
            ref_id=str(node.get("ref_id") or ""),
            bounds=dict(node.get("bounds") or {}),
            operations=operations_for_role(role),
        ))

    return ElementTable(
        rows=rows,
        total_observed=total,
        pruned_count=max(0, total - len(rows)),
    )
