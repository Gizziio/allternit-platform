"""Versioned, deterministic, redacted canonical trajectory export."""

from __future__ import annotations

import hashlib
import json
import re
from typing import Any, Dict

from core.canonical_events import EventLedger


TRAJECTORY_SCHEMA_VERSION = "1.0.0-alpha.1"
SENSITIVE_KEY = re.compile(r"(authorization|cookie|token|secret|password|api[_-]?key|clipboard)", re.I)


def _redact(value: Any) -> Any:
    if isinstance(value, dict):
        return {
            str(key): "[REDACTED]" if SENSITIVE_KEY.search(str(key)) else _redact(item)
            for key, item in sorted(value.items(), key=lambda pair: str(pair[0]))
        }
    if isinstance(value, list):
        return [_redact(item) for item in value]
    if isinstance(value, tuple):
        return [_redact(item) for item in value]
    return value


def export_trajectory(ledger: EventLedger, session_id: str) -> Dict[str, Any]:
    events = ledger.list_session(session_id, limit=5000)
    redacted = _redact(events)
    core = {
        "schema_version": TRAJECTORY_SCHEMA_VERSION,
        "session_id": session_id,
        "event_count": len(redacted),
        "events": redacted,
        "redaction": {"sensitive_keys": True, "deterministic": True},
    }
    encoded = json.dumps(core, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    return {**core, "sha256": hashlib.sha256(encoded).hexdigest()}
