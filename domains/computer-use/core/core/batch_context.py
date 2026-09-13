"""Run-scoped batch-context records for the canonical event ledger.

Implements the record type defined in
``domains/computer-use/docs/session-preservation-contract.md`` (§4): exactly two
canonical ledger events per planning-loop batch — ``batch.context.opened`` before
the batch RPC is sent (audit-before-act, mirroring the Rust receipt ordering) and
``batch.context.closed`` with the outcome. The record is a *pointer*: per-step
outcomes live in the Rust ``batch-receipts.jsonl``; this links a run's model turns
to the exact granted batch it dispatched.

Cross-batch state rule (contract §2): these events plus the Rust receipt and the
LoopStep observation are the ONLY legitimate carriers of state across a batch
boundary. Do not add implicit channels without a contract revision.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional

logger = logging.getLogger(__name__)

CONTRACT_VERSION = "1"

# Ledger callable: (event_type, payload) -> None. The caller binds session_id and
# run_id (the canonical EventLedger append takes them separately); keeping this
# two-argument shape makes the record unit-testable with a plain list collector.
LedgerFn = Callable[[str, Dict[str, Any]], None]


@dataclass
class BatchContextRecord:
    """One batch's ledger context. ``batch_id`` is the descriptor SHA-256 — the
    same hash the batch grant binds — so the ledger pointer and the grant surface
    agree by construction."""

    run_id: str
    session_id: str
    step_count: int
    step_methods: List[str]
    origin: str = "aci.batch"
    page_url: Optional[str] = None
    batch_mode: str = "batch"
    batch_id: str = "pending"
    descriptor_hash: str = "pending"
    receipt_id: Optional[str] = None

    def open_payload(self) -> Dict[str, Any]:
        return self._payload()

    def close_payload(
        self,
        *,
        status: str,
        halted_at: Optional[int] = None,
        steps_completed: int = 0,
        receipt_id: Optional[str] = None,
        model_turns_saved: int = 0,
    ) -> Dict[str, Any]:
        payload = self._payload()
        payload.update({
            "status": status,
            "halted_at": halted_at,
            "steps_completed": steps_completed,
            "model_turns_saved": model_turns_saved,
        })
        if receipt_id:
            payload["receipt_id"] = receipt_id
            self.receipt_id = receipt_id
        return payload

    def _payload(self) -> Dict[str, Any]:
        return {
            "contract_version": CONTRACT_VERSION,
            "batch_id": self.batch_id,
            "descriptor_hash": self.descriptor_hash,
            "run_id": self.run_id,
            "session_id": self.session_id,
            "step_count": self.step_count,
            # Method names only — arguments may carry typed secrets and never enter
            # this record (contract §4; sandbox_env rules for typed material).
            "step_methods": list(self.step_methods),
            "origin": self.origin,
            "page_url": self.page_url,
            "batch_mode": self.batch_mode,
        }


def open_batch_context(
    ledger: Optional[LedgerFn],
    record: BatchContextRecord,
) -> None:
    """Persist ``batch.context.opened`` — call BEFORE the batch RPC is sent."""
    _append(ledger, "batch.context.opened", record.open_payload())


def close_batch_context(
    ledger: Optional[LedgerFn],
    record: BatchContextRecord,
    *,
    status: str,
    halted_at: Optional[int] = None,
    steps_completed: int = 0,
    receipt_id: Optional[str] = None,
    model_turns_saved: int = 0,
) -> None:
    """Persist ``batch.context.closed`` with the batch outcome."""
    _append(
        ledger,
        "batch.context.closed",
        record.close_payload(
            status=status,
            halted_at=halted_at,
            steps_completed=steps_completed,
            receipt_id=receipt_id,
            model_turns_saved=model_turns_saved,
        ),
    )


def _append(ledger: Optional[LedgerFn], event_type: str, payload: Dict[str, Any]) -> None:
    if ledger is None:
        return
    try:
        ledger(event_type, payload)
    except Exception as exc:  # Never let ledger failures break a run.
        logger.warning("batch context ledger append failed (%s): %s", event_type, exc)
