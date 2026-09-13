"""
Session-preservation contract record tests (core/batch_context.py).

Covers the D1 record type: opened-before-RPC / closed-with-outcome payloads,
pointer discipline (methods only, no arguments), ledger-failure resilience,
and the contract invariants a reader relies on (batch_id == descriptor hash
slot, version pinned).
"""

import sys
from pathlib import Path

import pytest

DOMAIN_CORE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(DOMAIN_CORE_ROOT / "gateway"))
sys.path.insert(0, str(DOMAIN_CORE_ROOT))

_existing_core = sys.modules.get("core")
if _existing_core is not None:
    _existing_file = getattr(_existing_core, "__file__", "") or ""
    if Path(_existing_file).parent != DOMAIN_CORE_ROOT / "core":
        for _name in [
            m for m in list(sys.modules)
            if (m == "core" or m.startswith("core.")) and not m.startswith("core.tests")
        ]:
            del sys.modules[_name]

from core.batch_context import (  # noqa: E402
    CONTRACT_VERSION,
    BatchContextRecord,
    close_batch_context,
    open_batch_context,
)


def _collector(events):
    def ledger(event_type, payload):
        events.append((event_type, payload))

    return ledger


class TestBatchContextRecord:
    def test_open_payload_carries_contract_fields(self):
        events = []
        record = BatchContextRecord(
            run_id="r-1",
            session_id="s-1",
            step_count=3,
            step_methods=["click", "fill", "press"],
            page_url="http://127.0.0.1:8080/",
            batch_mode="batch",
        )
        open_batch_context(_collector(events), record)

        assert len(events) == 1
        event_type, payload = events[0]
        assert event_type == "batch.context.opened"
        assert payload["contract_version"] == CONTRACT_VERSION
        assert payload["batch_id"] == "pending"  # hash unknown until dispatch
        assert payload["run_id"] == "r-1"
        assert payload["session_id"] == "s-1"
        assert payload["step_count"] == 3
        assert payload["step_methods"] == ["click", "fill", "press"]
        assert payload["page_url"] == "http://127.0.0.1:8080/"
        assert "arguments" not in payload  # secrets never enter this record

    def test_close_payload_adds_outcome_and_receipt_pointer(self):
        events = []
        record = BatchContextRecord(
            run_id="r-1",
            session_id="s-1",
            step_count=3,
            step_methods=["click", "fill", "press"],
        )
        record.batch_id = "abc123"
        record.descriptor_hash = "abc123"
        open_batch_context(_collector(events), record)
        close_batch_context(
            _collector(events),
            record,
            status="completed_halted",
            halted_at=1,
            steps_completed=1,
            receipt_id="rcpt-9",
            model_turns_saved=2,
        )

        assert [e[0] for e in events] == ["batch.context.opened", "batch.context.closed"]
        closed = events[1][1]
        assert closed["batch_id"] == "abc123"
        assert closed["status"] == "completed_halted"
        assert closed["halted_at"] == 1
        assert closed["steps_completed"] == 1
        assert closed["receipt_id"] == "rcpt-9"
        assert closed["model_turns_saved"] == 2

    def test_batch_id_and_descriptor_hash_share_the_grant_binding(self):
        # Contract invariant: the ledger pointer names the same SHA-256 the
        # batch grant binds, so pointer and grant surface agree by construction.
        record = BatchContextRecord(run_id="r", session_id="s", step_count=1, step_methods=["click"])
        record.batch_id = record.descriptor_hash = "deadbeef"
        payload = record.open_payload()
        assert payload["batch_id"] == payload["descriptor_hash"]

    def test_ledger_failure_never_raises(self):
        def broken(event_type, payload):
            raise RuntimeError("ledger down")

        record = BatchContextRecord(run_id="r", session_id="s", step_count=1, step_methods=["click"])
        open_batch_context(broken, record)  # must not raise
        close_batch_context(broken, record, status="completed")

    def test_none_ledger_is_a_noop(self):
        record = BatchContextRecord(run_id="r", session_id="s", step_count=1, step_methods=["click"])
        open_batch_context(None, record)
        close_batch_context(None, record, status="completed")
