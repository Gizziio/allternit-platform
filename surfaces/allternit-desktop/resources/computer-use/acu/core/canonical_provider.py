"""Provider capability negotiation and transaction preflight."""

from __future__ import annotations

from contracts.canonical import (
    CONTRACT_VERSION,
    REQUIRED_INVARIANTS,
    ActionTransaction,
    CapabilityManifest,
    ExecutionMode,
    Observation,
)
from core.canonical_observation import element_index
from core.canonical_runtime import CanonicalRuntimeError


class ProviderCompatibilityError(CanonicalRuntimeError):
    pass


class TransactionPreflightError(CanonicalRuntimeError):
    pass


def validate_provider(manifest: CapabilityManifest) -> None:
    if manifest.contract_version != CONTRACT_VERSION:
        raise ProviderCompatibilityError(
            f"Provider {manifest.provider_id!r} uses contract {manifest.contract_version!r}; "
            f"required {CONTRACT_VERSION!r}"
        )
    missing = sorted(set(REQUIRED_INVARIANTS) - set(manifest.invariants))
    if missing:
        raise ProviderCompatibilityError(
            f"Provider {manifest.provider_id!r} is missing invariants: {', '.join(missing)}"
        )
    if manifest.max_concurrency < 1:
        raise ProviderCompatibilityError("Provider max_concurrency must be positive")
    if manifest.strict_background and ExecutionMode.BACKGROUND_STRICT.value not in manifest.execution_modes:
        raise ProviderCompatibilityError(
            "Provider advertises strict_background without the background_strict execution mode"
        )


def preflight_transaction(
    transaction: ActionTransaction,
    base: Observation,
    manifest: CapabilityManifest,
) -> None:
    validate_provider(manifest)
    if transaction.mode not in manifest.execution_modes:
        raise TransactionPreflightError(
            f"Provider {manifest.provider_id!r} does not support mode {transaction.mode!r}"
        )
    if transaction.mode == ExecutionMode.BACKGROUND_STRICT.value and not manifest.strict_background:
        raise TransactionPreflightError(
            f"Provider {manifest.provider_id!r} cannot guarantee strict background execution"
        )
    if not transaction.steps:
        raise TransactionPreflightError("A transaction must contain at least one action step")

    refs = element_index(base)
    for index, step in enumerate(transaction.steps):
        if manifest.actions and step.action not in manifest.actions:
            raise TransactionPreflightError(
                f"Provider does not support action {step.action!r} at step {index}"
            )
        target = step.target
        if target is None:
            continue
        if target.ref is not None and target.ref not in refs:
            raise TransactionPreflightError(
                f"Ref {target.ref!r} at step {index} does not belong to base state {base.state_id!r}"
            )
        has_x = target.x is not None
        has_y = target.y is not None
        if has_x != has_y:
            raise TransactionPreflightError(
                f"Coordinate target at step {index} must provide both x and y"
            )
        if has_x and base.image is None:
            raise TransactionPreflightError(
                f"Coordinate action at step {index} requires image evidence from the base state"
            )

