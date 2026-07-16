"""Pure queries, semantic postconditions, and trustworthy successor diffs."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Iterable, Iterator, Optional, Tuple

from contracts.canonical import ElementNode, Observation, Postcondition


@dataclass(frozen=True)
class ElementChange:
    change: str
    ref: str
    before: Optional[ElementNode] = None
    after: Optional[ElementNode] = None


@dataclass(frozen=True)
class ObservationDiff:
    base_state_id: str
    successor_state_id: str
    trustworthy: bool
    changes: Tuple[ElementChange, ...]
    reason: Optional[str] = None


def walk_elements(elements: Iterable[ElementNode]) -> Iterator[ElementNode]:
    for element in elements:
        yield element
        yield from walk_elements(element.children)


def element_index(observation: Observation) -> Dict[str, ElementNode]:
    """Build the state-local ref index and reject duplicate provider refs."""
    result: Dict[str, ElementNode] = {}
    for element in walk_elements(observation.elements):
        if element.ref in result:
            raise ValueError(
                f"Observation {observation.state_id!r} contains duplicate ref {element.ref!r}"
            )
        result[element.ref] = element
    return result


def find_by_ref(observation: Observation, ref: str) -> ElementNode:
    try:
        return element_index(observation)[ref]
    except KeyError as error:
        raise KeyError(f"Ref {ref!r} does not exist in state {observation.state_id!r}") from error


def search_elements(observation: Observation, query: str) -> Tuple[ElementNode, ...]:
    normalized = query.casefold().strip()
    if not normalized:
        return ()
    return tuple(
        element
        for element in walk_elements(observation.elements)
        if normalized in " ".join(
            (element.role, element.name, element.value, element.description)
        ).casefold()
    )


def postcondition_matches(observation: Observation, condition: Postcondition) -> bool:
    """Evaluate a semantic condition over one complete successor observation."""
    wanted = condition.value.casefold()

    def matches(element: ElementNode) -> bool:
        if condition.kind == "text":
            return wanted in " ".join(
                (element.name, element.value, element.description)
            ).casefold()
        if condition.kind == "role":
            return element.role.casefold() == wanted
        if condition.kind == "value":
            return wanted in element.value.casefold()
        if condition.kind == "visible":
            visible = "hidden" not in element.states and "offscreen" not in element.states
            return visible and (not wanted or wanted in element.name.casefold())
        if condition.kind == "focused":
            focused = "focused" in element.states
            return focused and (not wanted or wanted in element.name.casefold())
        raise ValueError(f"Unsupported postcondition kind {condition.kind!r}")

    present = any(matches(element) for element in walk_elements(observation.elements))
    return not present if condition.gone else present


def diff_observations(
    base: Observation,
    successor: Observation,
    *,
    minimum_identity_ratio: float = 0.5,
    maximum_changes: int = 100,
) -> ObservationDiff:
    """Return a ref-based diff only when state identity is credible.

    Providers must stabilize refs from native/DOM identity before calling this
    function. Low overlap, a changed resource, or an excessive patch forces a
    full-observation fallback.
    """
    if base.resource_id != successor.resource_id:
        return ObservationDiff(
            base.state_id,
            successor.state_id,
            False,
            (),
            "resource_changed",
        )
    if successor.epoch < base.epoch:
        return ObservationDiff(
            base.state_id,
            successor.state_id,
            False,
            (),
            "epoch_regressed",
        )

    before = element_index(base)
    after = element_index(successor)
    shared = before.keys() & after.keys()
    identity_denominator = max(1, min(len(before), len(after)))
    if len(shared) / identity_denominator < minimum_identity_ratio:
        return ObservationDiff(
            base.state_id,
            successor.state_id,
            False,
            (),
            "insufficient_identity_overlap",
        )

    changes = []
    for ref in sorted(before.keys() - after.keys()):
        changes.append(ElementChange("removed", ref, before=before[ref]))
    for ref in sorted(after.keys() - before.keys()):
        changes.append(ElementChange("added", ref, after=after[ref]))
    for ref in sorted(shared):
        if before[ref] != after[ref]:
            changes.append(ElementChange("updated", ref, before=before[ref], after=after[ref]))

    if len(changes) > maximum_changes:
        return ObservationDiff(
            base.state_id,
            successor.state_id,
            False,
            (),
            "change_budget_exceeded",
        )
    return ObservationDiff(
        base.state_id,
        successor.state_id,
        True,
        tuple(changes),
    )

