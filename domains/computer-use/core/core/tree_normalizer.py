"""Normalize provider trees into canonical state-scoped element forests."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Iterable, Mapping, Optional

from contracts.canonical import ElementNode, Rect


@dataclass(frozen=True)
class NormalizedForest:
    roots: tuple[ElementNode, ...]
    by_ref: Dict[str, ElementNode]
    provider_targets: Dict[str, str]
    truncated: bool


def _text(value: Any, limit: int = 500) -> str:
    return "" if value is None else str(value)[:limit]


def _bounds(node: Mapping[str, Any]) -> Optional[Rect]:
    raw = node.get("bounds", node.get("rect"))
    if not isinstance(raw, Mapping):
        return None
    try:
        return Rect(
            float(raw.get("x", raw.get("left", 0))),
            float(raw.get("y", raw.get("top", 0))),
            float(raw.get("width", float(raw.get("right", 0)) - float(raw.get("left", 0)))),
            float(raw.get("height", float(raw.get("bottom", 0)) - float(raw.get("top", 0)))),
        )
    except (TypeError, ValueError):
        return None


def normalize_tree(
    values: Any, *, max_nodes: int = 5000,
    child_keys: Iterable[str] = ("children", "elements", "nodes"),
) -> NormalizedForest:
    counter = 0
    by_ref: Dict[str, ElementNode] = {}
    targets: Dict[str, str] = {}
    truncated = False

    def visit(raw: Any) -> tuple[ElementNode, ...]:
        nonlocal counter, truncated
        if isinstance(raw, list):
            result = []
            for item in raw:
                result.extend(visit(item))
            return tuple(result)
        if not isinstance(raw, Mapping):
            return ()
        if counter >= max_nodes:
            truncated = True
            return ()
        counter += 1
        ref = f"@e{counter}"
        children_raw: Any = []
        for key in child_keys:
            if isinstance(raw.get(key), (list, dict)):
                children_raw = raw[key]
                break
        children = visit(children_raw)
        selector = raw.get("selector", raw.get("css", raw.get("cssSelector", raw.get("token"))))
        if selector is not None:
            targets[ref] = str(selector)
        states_raw = raw.get("states", ())
        actions_raw = raw.get("actions", ())
        states = tuple(str(item) for item in states_raw) if isinstance(states_raw, (list, tuple, set)) else ()
        actions = tuple(str(item) for item in actions_raw) if isinstance(actions_raw, (list, tuple, set)) else ()
        element = ElementNode(
            ref=ref,
            role=_text(raw.get("role", raw.get("tag", raw.get("control_type", "unknown")))),
            name=_text(raw.get("name", raw.get("text", raw.get("label", "")))),
            value=_text(raw.get("value", "")), description=_text(raw.get("description", "")),
            bounds=_bounds(raw), states=states, actions=actions, children=children,
            provider_metadata={"provider_target": selector} if selector is not None else {},
        )
        by_ref[ref] = element
        return (element,)

    roots = visit(values)
    return NormalizedForest(roots, by_ref, targets, truncated)
