"""Code-mode dispatch for the planning loop — C2 of the code-mode-execution spec.

Code execution is the THIRD integration mode and never the default: a run
reaches this surface only when ``PlanningLoopConfig.code_mode_enabled`` is
explicitly set AND the model's plan carries a ``code`` payload. Policy stays
on the Rust side: this module never decides what is grantable — descriptor
validation, the refuse-list, and grant enforcement all live in
``cmd/allternit-api/src/aci_code.rs``. The engine only:

1. Presents the payload with its declared targets (one grant per payload).
2. Handles both response shapes: the executed fixed envelope, and
   ``confirmation_required`` (retry with the approved ``approvalId``) /
   ``code_refused`` (validation refusal — surfaced as an observation so the
   loop re-plans with whitelist actions; the payload is NEVER retried
   mutated without a new grant).

Session-preservation contract (docs/session-preservation-contract.md §8): the
loop writes the code-context ledger record around the dispatch; no state
survives between code runs except explicit ledger writes — the same rule as
batches.
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from typing import Any, Callable, Dict, List, Optional

logger = logging.getLogger(__name__)


@dataclass
class CodeContextRecord:
    """One code run's ledger context (contract §8). ``code_id`` is the
    descriptor SHA-256 — the same hash the grant binds."""

    run_id: str
    session_id: str
    language: str
    code_bytes: int
    declared_targets: List[str]
    origin: str = "aci.code"
    code_id: str = "pending"
    descriptor_hash: str = "pending"
    receipt_id: Optional[str] = None

    def open_payload(self) -> Dict[str, Any]:
        return self._payload()

    def close_payload(
        self,
        *,
        status: str,
        receipt_id: Optional[str] = None,
        exit_status: Optional[int] = None,
        timed_out: bool = False,
    ) -> Dict[str, Any]:
        payload = self._payload()
        payload.update({
            "status": status,
            "exit_status": exit_status,
            "timed_out": timed_out,
        })
        if receipt_id:
            payload["receipt_id"] = receipt_id
            self.receipt_id = receipt_id
        return payload

    def _payload(self) -> Dict[str, Any]:
        return {
            # Code-mode records start at v1 (contract §8); the batch record
            # version is independent.
            "contract_version": "1",
            "code_id": self.code_id,
            "descriptor_hash": self.descriptor_hash,
            "run_id": self.run_id,
            "session_id": self.session_id,
            "language": self.language,
            "code_bytes": self.code_bytes,
            # Target HOSTS only — the payload itself can carry typed secrets
            # in literals and never enters the ledger (same discipline as
            # batch step arguments).
            "declared_targets": list(self.declared_targets),
            "origin": self.origin,
        }


LedgerFn = Callable[[str, Dict[str, Any]], None]


def open_code_context(ledger: Optional[LedgerFn], record: CodeContextRecord) -> None:
    """Persist ``code.context.opened`` — BEFORE the code RPC is sent."""
    _append(ledger, "code.context.opened", record.open_payload())


def close_code_context(
    ledger: Optional[LedgerFn],
    record: CodeContextRecord,
    *,
    status: str,
    receipt_id: Optional[str] = None,
    exit_status: Optional[int] = None,
    timed_out: bool = False,
) -> None:
    """Persist ``code.context.closed`` with the run outcome."""
    _append(
        ledger,
        "code.context.closed",
        record.close_payload(
            status=status,
            receipt_id=receipt_id,
            exit_status=exit_status,
            timed_out=timed_out,
        ),
    )


def _append(ledger: Optional[LedgerFn], event_type: str, payload: Dict[str, Any]) -> None:
    if ledger is None:
        return
    try:
        ledger(event_type, payload)
    except Exception as exc:  # Never let ledger failures break a run.
        logger.warning("code context ledger append failed (%s): %s", event_type, exc)


@dataclass
class CodeDispatchResult:
    """Normalized outcome of one code dispatch attempt (or approved retry)."""

    executed: bool                              # False → refusal/denial/failure detail below
    confirmation_required: bool = False         # Rust gate asked for a grant
    approval_id: Optional[str] = None           # Grant id to redeem after human approval
    action_hash: Optional[str] = None           # Descriptor hash the grant binds
    descriptor_hash: Optional[str] = None
    receipt: Optional[Dict[str, Any]] = None
    receipt_id: Optional[str] = None
    envelope: Optional[Dict[str, Any]] = None   # The fixed model-visible result envelope
    refused: bool = False                       # Descriptor-time validation refusal
    refusal_class: Optional[str] = None
    refusal_message: Optional[str] = None
    status_code: int = 0
    error: Optional[str] = None                 # Hard failure (5xx, transport, ...)


class AciCodeClient:
    """Thin HTTP client for the C0 code invocation surface
    (``POST {ALLTERNIT_API_URL}/api/aci/code``). Auth mirrors
    ``AciBatchClient`` — same headers, same defaults."""

    def __init__(
        self,
        base_url: Optional[str] = None,
        token: Optional[str] = None,
        user_id: str = "computer-use-planning-loop",
        timeout_s: float = 90.0,
    ) -> None:
        self._base = (base_url or os.environ.get("ALLTERNIT_API_URL")
                      or "http://localhost:8013").rstrip("/")
        self._token = token or os.environ.get("ALLTERNIT_INTERNAL_SERVICE_TOKEN")
        self._user_id = user_id
        self._timeout_s = timeout_s

    @property
    def base_url(self) -> str:
        return self._base

    async def execute_code(
        self,
        *,
        code: str,
        language: str = "playwright-js",
        declared_targets: Optional[List[str]] = None,
        origin: str = "aci.code",
        session: Optional[str] = None,
        approval_id: Optional[str] = None,
    ) -> CodeDispatchResult:
        """One dispatch attempt. Never raises for gate/refusal responses."""
        body: Dict[str, Any] = {
            "origin": origin,
            "language": language,
            "code": code,
            "declaredTargets": declared_targets or [],
        }
        if session:
            body["session"] = session
        if approval_id:
            body["approvalId"] = approval_id

        headers = {"Content-Type": "application/json", "x-allternit-user-id": self._user_id}
        if self._token:
            headers["x-allternit-internal-token"] = self._token

        try:
            import httpx
        except ImportError:
            return CodeDispatchResult(executed=False, error="httpx not installed")

        try:
            async with httpx.AsyncClient(timeout=self._timeout_s) as client:
                resp = await client.post(f"{self._base}/api/aci/code", json=body, headers=headers)
        except Exception as exc:
            logger.warning("code dispatch transport failed: %s", exc)
            return CodeDispatchResult(executed=False, error=f"transport: {exc}")

        data: Dict[str, Any] = {}
        try:
            data = resp.json()
        except Exception:
            data = {}

        if resp.status_code == 403 and data.get("error") == "confirmation_required":
            return CodeDispatchResult(
                executed=False,
                confirmation_required=True,
                approval_id=data.get("approval_id"),
                action_hash=data.get("action_hash"),
                status_code=resp.status_code,
            )

        if resp.status_code == 400 and data.get("error") == "code_refused":
            # Validation refusal: surface it; the caller re-plans with
            # whitelist actions — never a silent retry of mutated code.
            return CodeDispatchResult(
                executed=False,
                refused=True,
                refusal_class=data.get("class"),
                refusal_message=data.get("message"),
                status_code=resp.status_code,
            )

        if resp.status_code >= 400:
            return CodeDispatchResult(
                executed=False,
                status_code=resp.status_code,
                error=data.get("message") or data.get("error") or f"HTTP {resp.status_code}",
            )

        envelope = data.get("result") if isinstance(data.get("result"), dict) else None
        receipt = data.get("receipt") if isinstance(data.get("receipt"), dict) else None
        return CodeDispatchResult(
            executed=True,
            descriptor_hash=data.get("descriptor_hash"),
            receipt=receipt,
            receipt_id=data.get("receipt_id"),
            envelope=envelope,
            status_code=resp.status_code,
        )
