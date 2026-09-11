"""Trust-core runtime primitives for canonical computer-use providers."""

from __future__ import annotations

import asyncio
import time
from collections import OrderedDict
from dataclasses import dataclass, replace
from typing import Awaitable, Callable, Dict, Optional, TypeVar

from contracts.canonical import (
    ActionEvidence,
    ActionTransaction,
    Observation,
    OutcomeStatus,
    StepOutcome,
    TransactionOutcome,
)
from core.canonical_observation import postcondition_matches


class CanonicalRuntimeError(RuntimeError):
    """Base error for trust-core validation failures."""


class StateNotFoundError(CanonicalRuntimeError):
    pass


class StateScopeError(CanonicalRuntimeError):
    pass


class StaleResourceStateError(CanonicalRuntimeError):
    def __init__(self, resource_id: str, expected: int, actual: int) -> None:
        super().__init__(
            f"Resource {resource_id!r} is stale: expected epoch {expected}, actual {actual}"
        )
        self.resource_id = resource_id
        self.expected = expected
        self.actual = actual


class ImmutableObservationStore:
    """Bounded immutable observation store with state-scope validation."""

    def __init__(self, limit: int = 128) -> None:
        if limit < 1:
            raise ValueError("Observation store limit must be positive")
        self._limit = limit
        self._records: "OrderedDict[str, Observation]" = OrderedDict()

    def put(self, observation: Observation) -> None:
        existing = self._records.get(observation.state_id)
        if existing is not None and existing != observation:
            raise CanonicalRuntimeError(
                f"Observation {observation.state_id!r} is immutable and cannot be replaced"
            )
        self._records[observation.state_id] = observation
        self._records.move_to_end(observation.state_id)
        while len(self._records) > self._limit:
            self._records.popitem(last=False)

    def get(self, state_id: str) -> Observation:
        try:
            return self._records[state_id]
        except KeyError as error:
            raise StateNotFoundError(f"Unknown or evicted state {state_id!r}") from error

    def require_scope(
        self,
        state_id: str,
        *,
        session_id: str,
        environment_id: str,
        resource_id: str,
    ) -> Observation:
        observation = self.get(state_id)
        actual = (
            observation.session_id,
            observation.environment_id,
            observation.resource_id,
        )
        expected = (session_id, environment_id, resource_id)
        if actual != expected:
            raise StateScopeError(
                f"State {state_id!r} belongs to {actual!r}, not {expected!r}"
            )
        return observation

    def clear(self) -> None:
        self._records.clear()

    def __len__(self) -> int:
        return len(self._records)


T = TypeVar("T")


@dataclass
class _ResourceLane:
    epoch: int
    lock: asyncio.Lock


class ResourceScheduler:
    """Serializes live work per physical resource and rejects stale writes."""

    def __init__(self) -> None:
        self._lanes: Dict[str, _ResourceLane] = {}
        self._lanes_lock = asyncio.Lock()

    async def _lane(self, resource_id: str) -> _ResourceLane:
        async with self._lanes_lock:
            return self._lanes.setdefault(resource_id, _ResourceLane(0, asyncio.Lock()))

    async def current_epoch(self, resource_id: str) -> int:
        lane = await self._lane(resource_id)
        return lane.epoch

    async def observe(self, resource_id: str, work: Callable[[int], Awaitable[T]]) -> T:
        lane = await self._lane(resource_id)
        async with lane.lock:
            return await work(lane.epoch)

    async def mutate(
        self,
        resource_id: str,
        expected_epoch: int,
        work: Callable[[int], Awaitable[T]],
    ) -> T:
        lane = await self._lane(resource_id)
        async with lane.lock:
            if lane.epoch != expected_epoch:
                raise StaleResourceStateError(resource_id, expected_epoch, lane.epoch)
            next_epoch = lane.epoch + 1
            value = await work(next_epoch)
            lane.epoch = next_epoch
            return value


StepExecutor = Callable[[int, object], Awaitable[StepOutcome]]
SuccessorObserver = Callable[[int], Awaitable[Observation]]


class TransactionExecutor:
    """Validates one base state and stops at the first non-worked action."""

    def __init__(self, store: ImmutableObservationStore, scheduler: ResourceScheduler) -> None:
        self._store = store
        self._scheduler = scheduler

    async def execute(
        self,
        transaction: ActionTransaction,
        execute_step: StepExecutor,
        observe_successor: SuccessorObserver,
    ) -> TransactionOutcome:
        base = self._store.require_scope(
            transaction.base_state_id,
            session_id=transaction.session_id,
            environment_id=transaction.environment_id,
            resource_id=transaction.resource_id,
        )

        async def run(next_epoch: int) -> TransactionOutcome:
            results = []
            stopped_at: Optional[int] = None
            pending_verification: Optional[int] = None
            for index, step in enumerate(transaction.steps):
                result = await execute_step(index, step)
                if result.index != index:
                    raise CanonicalRuntimeError(
                        f"Provider returned step index {result.index}, expected {index}"
                    )
                results.append(result)
                if result.status != OutcomeStatus.WORKED.value:
                    if (
                        result.status == OutcomeStatus.UNKNOWN.value
                        and transaction.postcondition is not None
                        and index == len(transaction.steps) - 1
                    ):
                        pending_verification = index
                        break
                    stopped_at = index
                    break

            successor = await observe_successor(next_epoch)
            if successor.resource_id != transaction.resource_id or successor.epoch != next_epoch:
                raise CanonicalRuntimeError("Provider returned an invalid successor observation")

            condition_met = False
            if stopped_at is None and transaction.postcondition is not None:
                deadline = time.monotonic() + transaction.postcondition.timeout_ms / 1000
                while (
                    not postcondition_matches(successor, transaction.postcondition)
                    and time.monotonic() < deadline
                ):
                    await asyncio.sleep(min(0.1, max(0.0, deadline - time.monotonic())))
                    successor = await observe_successor(next_epoch)
                    if successor.resource_id != transaction.resource_id or successor.epoch != next_epoch:
                        raise CanonicalRuntimeError("Provider returned an invalid successor observation")
                condition_met = postcondition_matches(successor, transaction.postcondition)

            self._store.put(successor)

            if pending_verification is not None and condition_met:
                previous = results[pending_verification]
                results[pending_verification] = replace(
                    previous,
                    status=OutcomeStatus.WORKED.value,
                    evidence=replace(
                        previous.evidence,
                        details={
                            **previous.evidence.details,
                            "postcondition_verified": True,
                        },
                    ),
                    message="Semantic postcondition verified",
                )

            if (
                stopped_at is None
                and transaction.postcondition is not None
                and not condition_met
            ):
                if pending_verification is not None:
                    stopped_at = pending_verification
                    previous = results[pending_verification]
                    results[pending_verification] = replace(
                        previous,
                        status=OutcomeStatus.DIDNT.value,
                        error_code="postcondition_failed",
                        message="Action delivery completed but the semantic postcondition was not met",
                    )
                else:
                    stopped_at = len(results)
                    results.append(StepOutcome(
                        index=stopped_at,
                        status=OutcomeStatus.DIDNT.value,
                        evidence=ActionEvidence(
                            grounding="semantic_postcondition",
                            delivery="observation",
                            details={
                                "kind": transaction.postcondition.kind,
                                "value": transaction.postcondition.value,
                                "gone": transaction.postcondition.gone,
                            },
                        ),
                        error_code="postcondition_failed",
                        message="Action delivery completed but the semantic postcondition was not met",
                    ))

            status = (
                OutcomeStatus.WORKED.value
                if stopped_at is None and len(results) == len(transaction.steps)
                else results[-1].status if results else OutcomeStatus.DIDNT.value
            )
            return TransactionOutcome(
                transaction_id=transaction.transaction_id,
                status=status,
                step_outcomes=tuple(results),
                stopped_at=stopped_at,
                successor_state_id=successor.state_id,
            )

        return await self._scheduler.mutate(
            transaction.resource_id,
            base.epoch,
            run,
        )


def provider_failure(index: int, message: str, *, unknown: bool = False) -> StepOutcome:
    """Create an explicit failure without collapsing ambiguity into success."""
    return StepOutcome(
        index=index,
        status=OutcomeStatus.UNKNOWN.value if unknown else OutcomeStatus.DIDNT.value,
        evidence=ActionEvidence(),
        message=message,
    )
