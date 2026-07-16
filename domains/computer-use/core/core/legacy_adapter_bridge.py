"""Compatibility bridge from legacy BaseAdapter results to canonical outcomes.

The bridge is intentionally conservative: a legacy `completed` status proves
that an adapter returned, not that the UI intent worked. It becomes `unknown`
unless the adapter supplies explicit verification evidence.
"""

from __future__ import annotations

from typing import Any, Awaitable, Callable, Dict, Optional

from contracts.canonical import (
    ActionEvidence,
    ActionStep,
    ActionTransaction,
    CapabilityManifest,
    Observation,
    OutcomeStatus,
    StepOutcome,
    TransactionOutcome,
)
from core.base_adapter import ActionRequest, BaseAdapter, ResultEnvelope
from core.canonical_provider import preflight_transaction
from core.canonical_runtime import TransactionExecutor


SuccessorObserver = Callable[[int], Awaitable[Observation]]


def _target(step: ActionStep) -> str:
    if step.target is None:
        return ""
    if step.target.ref is not None:
        return step.target.ref
    if step.target.x is not None and step.target.y is not None:
        return f"{step.target.x},{step.target.y}"
    return step.target.root_id or ""


def _verification_payload(envelope: ResultEnvelope) -> Optional[Dict[str, Any]]:
    content = envelope.extracted_content
    if not isinstance(content, dict):
        return None
    verification = content.get("verification")
    if isinstance(verification, dict):
        return verification
    if content.get("verified") is True:
        return {"verified": True}
    return None


def legacy_envelope_outcome(index: int, envelope: ResultEnvelope) -> StepOutcome:
    verification = _verification_payload(envelope)
    if envelope.status == "cancelled":
        status = OutcomeStatus.CANCELLED.value
    elif envelope.status == "failed" or envelope.error is not None:
        status = OutcomeStatus.DIDNT.value
    elif envelope.status == "completed" and verification is not None:
        status = OutcomeStatus.WORKED.value
    else:
        status = OutcomeStatus.UNKNOWN.value

    return StepOutcome(
        index=index,
        status=status,
        evidence=ActionEvidence(
            grounding="legacy_adapter",
            delivery=envelope.adapter_id or "legacy_adapter",
            details={
                "legacy_status": envelope.status,
                "verification": verification,
                "fallbacks_used": list(envelope.fallbacks_used),
                "trace_id": envelope.trace_id,
            },
            artifact_ids=tuple(artifact.artifact_id for artifact in envelope.artifacts),
        ),
        error_code=(envelope.error or {}).get("code") if envelope.error else None,
        message=(envelope.error or {}).get("message") if envelope.error else None,
    )


class LegacyAdapterTransactionBridge:
    def __init__(
        self,
        adapter: BaseAdapter,
        manifest: CapabilityManifest,
        runtime: TransactionExecutor,
    ) -> None:
        self._adapter = adapter
        self._manifest = manifest
        self._runtime = runtime

    async def execute(
        self,
        transaction: ActionTransaction,
        base: Observation,
        observe_successor: SuccessorObserver,
        *,
        run_id: str,
    ) -> TransactionOutcome:
        preflight_transaction(transaction, base, self._manifest)

        async def execute_step(index: int, step: object) -> StepOutcome:
            if not isinstance(step, ActionStep):
                raise TypeError("Canonical transaction contained a non-ActionStep value")
            request = ActionRequest(
                action_type=step.action,
                target=_target(step),
                parameters={
                    **step.arguments,
                    "canonical_target": {
                        "ref": step.target.ref if step.target else None,
                        "x": step.target.x if step.target else None,
                        "y": step.target.y if step.target else None,
                        "root_id": step.target.root_id if step.target else None,
                    },
                    "base_state_id": transaction.base_state_id,
                    "execution_mode": transaction.mode,
                },
            )
            envelope = await self._adapter.execute(
                request,
                transaction.session_id,
                run_id,
            )
            return legacy_envelope_outcome(index, envelope)

        return await self._runtime.execute(
            transaction,
            execute_step,
            observe_successor,
        )

