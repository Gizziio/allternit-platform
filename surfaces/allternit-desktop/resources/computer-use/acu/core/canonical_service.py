"""Canonical provider registry and session-independent dispatch service."""

from __future__ import annotations

from typing import Any, Awaitable, Callable, Dict, Optional, Protocol

from contracts.canonical import (
    ActionStep,
    ActionTransaction,
    CapabilityManifest,
    Observation,
    Root,
    StepOutcome,
    TransactionOutcome,
)
from core.canonical_provider import ProviderCompatibilityError, preflight_transaction, validate_provider
from core.canonical_runtime import ImmutableObservationStore, ResourceScheduler, TransactionExecutor


class ComputerProvider(Protocol):
    @property
    def provider_id(self) -> str: ...

    async def capabilities(self) -> CapabilityManifest: ...

    async def observe(
        self,
        *,
        session_id: str,
        environment_id: str,
        resource_id: str,
        epoch: int,
    ) -> Observation: ...

    async def execute_step(
        self,
        *,
        transaction: ActionTransaction,
        index: int,
        step: ActionStep,
    ) -> StepOutcome: ...

    async def close(self) -> None: ...


class ProviderNotFoundError(LookupError):
    pass


class CanonicalComputerService:
    """Owns canonical provider registration, observations, and transactions."""

    def __init__(
        self,
        store: ImmutableObservationStore | object | None = None,
        scheduler: ResourceScheduler | None = None,
    ) -> None:
        self.store = store or ImmutableObservationStore()
        self.scheduler = scheduler or ResourceScheduler()
        self.transactions = TransactionExecutor(self.store, self.scheduler)  # type: ignore[arg-type]
        self._providers: Dict[str, ComputerProvider] = {}
        self._manifests: Dict[str, CapabilityManifest] = {}
        self._root_discovery_diagnostics: Dict[str, Dict[str, str]] = {}

    @property
    def root_discovery_diagnostics(self) -> Dict[str, Dict[str, str]]:
        return {key: dict(value) for key, value in self._root_discovery_diagnostics.items()}

    async def register(self, provider: ComputerProvider) -> CapabilityManifest:
        manifest = await provider.capabilities()
        if provider.provider_id != manifest.provider_id:
            raise ProviderCompatibilityError(
                f"Provider identity {provider.provider_id!r} does not match manifest {manifest.provider_id!r}"
            )
        validate_provider(manifest)
        existing = self._providers.get(provider.provider_id)
        if existing is not None and existing is not provider:
            raise ProviderCompatibilityError(
                f"Provider {provider.provider_id!r} is already registered"
            )
        self._providers[provider.provider_id] = provider
        self._manifests[provider.provider_id] = manifest
        return manifest

    def provider(self, provider_id: str) -> ComputerProvider:
        try:
            return self._providers[provider_id]
        except KeyError as error:
            raise ProviderNotFoundError(f"Unknown provider {provider_id!r}") from error

    def capabilities(self) -> tuple[CapabilityManifest, ...]:
        return tuple(self._manifests[key] for key in sorted(self._manifests))

    async def find_roots(
        self,
        *,
        session_id: str,
        environment_id: str,
        provider_id: Optional[str] = None,
    ) -> Dict[str, tuple[Root, ...]]:
        provider_ids = (provider_id,) if provider_id else tuple(sorted(self._providers))
        result: Dict[str, tuple[Root, ...]] = {}
        self._root_discovery_diagnostics = {}
        for candidate_id in provider_ids:
            provider = self.provider(candidate_id)
            discover = getattr(provider, "discover_roots", None)
            if discover is None:
                result[candidate_id] = ()
                self._root_discovery_diagnostics[candidate_id] = {
                    "status": "unsupported",
                    "reason": "root_discovery_not_implemented",
                }
                continue
            try:
                roots = await discover(session_id=session_id, environment_id=environment_id)
                result[candidate_id] = tuple(roots)
                self._root_discovery_diagnostics[candidate_id] = {
                    "status": "ok",
                    "root_count": str(len(result[candidate_id])),
                }
            except Exception as error:
                if provider_id is not None:
                    raise
                result[candidate_id] = ()
                self._root_discovery_diagnostics[candidate_id] = {
                    "status": "failed",
                    "reason": type(error).__name__,
                    "message": str(error),
                }
        return result

    async def observe(
        self,
        provider_id: str,
        *,
        session_id: str,
        environment_id: str,
        resource_id: str,
    ) -> Observation:
        provider = self.provider(provider_id)

        async def capture(epoch: int) -> Observation:
            observation = await provider.observe(
                session_id=session_id,
                environment_id=environment_id,
                resource_id=resource_id,
                epoch=epoch,
            )
            if (
                observation.session_id != session_id
                or observation.environment_id != environment_id
                or observation.resource_id != resource_id
                or observation.epoch != epoch
                or observation.provider_id != provider_id
            ):
                raise ProviderCompatibilityError(
                    f"Provider {provider_id!r} returned an observation outside the requested scope"
                )
            self.store.put(observation)  # type: ignore[attr-defined]
            return observation

        return await self.scheduler.observe(resource_id, capture)

    async def execute(
        self,
        provider_id: str,
        transaction: ActionTransaction,
    ) -> TransactionOutcome:
        provider = self.provider(provider_id)
        manifest = self._manifests[provider_id]
        base = self.store.require_scope(  # type: ignore[attr-defined]
            transaction.base_state_id,
            session_id=transaction.session_id,
            environment_id=transaction.environment_id,
            resource_id=transaction.resource_id,
        )
        preflight_transaction(transaction, base, manifest)

        async def execute_step(index: int, step: object) -> StepOutcome:
            if not isinstance(step, ActionStep):
                raise TypeError("Canonical transaction contained a non-ActionStep value")
            return await provider.execute_step(
                transaction=transaction,
                index=index,
                step=step,
            )

        async def observe_successor(epoch: int) -> Observation:
            return await provider.observe(
                session_id=transaction.session_id,
                environment_id=transaction.environment_id,
                resource_id=transaction.resource_id,
                epoch=epoch,
            )

        return await self.transactions.execute(
            transaction,
            execute_step,
            observe_successor,
        )

    async def close(self) -> None:
        providers = tuple(self._providers.values())
        self._providers.clear()
        self._manifests.clear()
        for provider in providers:
            await provider.close()
