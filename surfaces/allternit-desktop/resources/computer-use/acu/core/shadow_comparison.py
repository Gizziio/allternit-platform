"""Read-only comparison of observations from two provider routes."""

from __future__ import annotations

from typing import Any, Dict

from contracts.canonical import ElementNode, Observation


def _flatten(elements: tuple[ElementNode, ...]) -> list[ElementNode]:
    result = []
    pending = list(elements)
    while pending:
        element = pending.pop(0)
        result.append(element)
        pending[0:0] = list(element.children)
    return result


def compare_observations(primary: Observation, shadow: Observation) -> Dict[str, Any]:
    primary_nodes = _flatten(primary.elements)
    shadow_nodes = _flatten(shadow.elements)
    primary_semantics = {(node.role.lower(), node.name.strip().lower()) for node in primary_nodes if node.role or node.name}
    shadow_semantics = {(node.role.lower(), node.name.strip().lower()) for node in shadow_nodes if node.role or node.name}
    union = primary_semantics | shadow_semantics
    intersection = primary_semantics & shadow_semantics
    return {
        "primary_state_id": primary.state_id,
        "shadow_state_id": shadow.state_id,
        "primary_provider_id": primary.provider_id,
        "shadow_provider_id": shadow.provider_id,
        "semantic_jaccard": len(intersection) / len(union) if union else 1.0,
        "primary_element_count": len(primary_nodes),
        "shadow_element_count": len(shadow_nodes),
        "both_have_image_evidence": primary.image is not None and shadow.image is not None,
        "same_image_hash": bool(primary.image and shadow.image and primary.image.sha256 == shadow.image.sha256),
        "scope_matches": (
            primary.session_id == shadow.session_id
            and primary.environment_id == shadow.environment_id
        ),
        "side_effects_executed": False,
    }
