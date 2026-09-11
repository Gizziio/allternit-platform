"""Strict JSON codecs for canonical computer-use observations."""

from __future__ import annotations

import json
from dataclasses import asdict
from typing import Any, Dict

from .canonical import (
    ActionStep,
    ActionTarget,
    ActionTransaction,
    ElementNode,
    ImageEvidence,
    Observation,
    Postcondition,
    Rect,
    Root,
)


def _rect(value: Any) -> Rect | None:
    if value is None:
        return None
    if not isinstance(value, dict):
        raise ValueError("Rect must be an object or null")
    return Rect(
        x=float(value["x"]),
        y=float(value["y"]),
        width=float(value["width"]),
        height=float(value["height"]),
    )


def _element(value: Any) -> ElementNode:
    if not isinstance(value, dict):
        raise ValueError("Element must be an object")
    return ElementNode(
        ref=str(value["ref"]),
        role=str(value["role"]),
        name=str(value.get("name", "")),
        value=str(value.get("value", "")),
        description=str(value.get("description", "")),
        bounds=_rect(value.get("bounds")),
        states=tuple(str(item) for item in value.get("states", ())),
        actions=tuple(str(item) for item in value.get("actions", ())),
        children=tuple(_element(item) for item in value.get("children", ())),
        provider_metadata=dict(value.get("provider_metadata", {})),
    )


def observation_to_json(observation: Observation) -> str:
    return json.dumps(asdict(observation), sort_keys=True, separators=(",", ":"))


def observation_from_dict(value: Dict[str, Any]) -> Observation:
    image_value = value.get("image")
    image = None
    if image_value is not None:
        image = ImageEvidence(
            artifact_id=str(image_value["artifact_id"]),
            media_type=str(image_value["media_type"]),
            width=int(image_value["width"]),
            height=int(image_value["height"]),
            sha256=str(image_value["sha256"]),
            coordinate_space=str(image_value.get("coordinate_space", "screen")),
        )
    return Observation(
        state_id=str(value["state_id"]),
        session_id=str(value["session_id"]),
        environment_id=str(value["environment_id"]),
        resource_id=str(value["resource_id"]),
        epoch=int(value["epoch"]),
        captured_at=str(value["captured_at"]),
        provider_id=str(value["provider_id"]),
        provider_version=str(value["provider_version"]),
        roots=tuple(
            Root(
                root_id=str(root["root_id"]),
                resource_id=str(root["resource_id"]),
                kind=str(root["kind"]),
                title=str(root.get("title", "")),
                application=str(root.get("application", "")),
                process_id=int(root["process_id"]) if root.get("process_id") is not None else None,
                bounds=_rect(root.get("bounds")),
                focused=bool(root.get("focused", False)),
            )
            for root in value.get("roots", ())
        ),
        elements=tuple(_element(item) for item in value.get("elements", ())),
        image=image,
        truncated=bool(value.get("truncated", False)),
        metadata=dict(value.get("metadata", {})),
    )


def observation_from_json(payload: str) -> Observation:
    value = json.loads(payload)
    if not isinstance(value, dict):
        raise ValueError("Observation JSON must contain an object")
    return observation_from_dict(value)


def transaction_from_dict(value: Dict[str, Any]) -> ActionTransaction:
    postcondition_value = value.get("postcondition")
    postcondition = None
    if postcondition_value is not None:
        postcondition = Postcondition(
            kind=str(postcondition_value["kind"]),
            value=str(postcondition_value["value"]),
            gone=bool(postcondition_value.get("gone", False)),
            timeout_ms=int(postcondition_value.get("timeout_ms", 3000)),
        )

    steps = []
    for step_value in value.get("steps", ()):
        target_value = step_value.get("target")
        target = None
        if target_value is not None:
            target = ActionTarget(
                ref=str(target_value["ref"]) if target_value.get("ref") is not None else None,
                x=float(target_value["x"]) if target_value.get("x") is not None else None,
                y=float(target_value["y"]) if target_value.get("y") is not None else None,
                root_id=str(target_value["root_id"]) if target_value.get("root_id") is not None else None,
            )
        steps.append(
            ActionStep(
                action=str(step_value["action"]),
                target=target,
                arguments=dict(step_value.get("arguments", {})),
            )
        )
    return ActionTransaction(
        transaction_id=str(value["transaction_id"]),
        session_id=str(value["session_id"]),
        environment_id=str(value["environment_id"]),
        resource_id=str(value["resource_id"]),
        base_state_id=str(value["base_state_id"]),
        mode=str(value["mode"]),
        steps=tuple(steps),
        postcondition=postcondition,
        approval_id=str(value["approval_id"]) if value.get("approval_id") is not None else None,
    )
