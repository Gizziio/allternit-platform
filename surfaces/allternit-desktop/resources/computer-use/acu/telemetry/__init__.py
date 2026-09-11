"""
Allternit Computer Use — Telemetry Normalization
Wraps the existing telemetry.py from the operator.
Provides normalized event emission across all adapter families.
"""

from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
from datetime import datetime
import uuid
import json


@dataclass
class TelemetryEvent:
    """Normalized telemetry event."""
    event_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    event_type: str = ""  # adapter.start, adapter.complete, adapter.error, route.decision, policy.evaluated, receipt.emitted, session.created, session.destroyed
    adapter_id: str = ""
    family: str = ""
    mode: str = ""
    session_id: str = ""
    run_id: str = ""
    duration_ms: Optional[int] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "event_id": self.event_id,
            "timestamp": self.timestamp,
            "event_type": self.event_type,
            "adapter_id": self.adapter_id,
            "family": self.family,
            "mode": self.mode,
            "session_id": self.session_id,
            "run_id": self.run_id,
            "duration_ms": self.duration_ms,
            "metadata": self.metadata,
        }


class TelemetryCollector:
    """
    Collects and normalizes telemetry events across all adapters.
    Events can be forwarded to external providers or stored locally.
    """

    def __init__(self):
        self._events: List[TelemetryEvent] = []
        self._listeners: List[Any] = []

    def emit(self, event: TelemetryEvent) -> None:
        """Record a telemetry event."""
        self._events.append(event)
        for listener in self._listeners:
            try:
                listener(event)
            except Exception:
                pass

    def adapter_started(self, adapter_id: str, family: str, mode: str, session_id: str, run_id: str) -> TelemetryEvent:
        """Emit adapter start event."""
        event = TelemetryEvent(
            event_type="adapter.start",
            adapter_id=adapter_id,
            family=family,
            mode=mode,
            session_id=session_id,
            run_id=run_id,
        )
        self.emit(event)
        return event

    def adapter_completed(self, adapter_id: str, family: str, mode: str, session_id: str, run_id: str, duration_ms: int, status: str = "completed") -> TelemetryEvent:
        """Emit adapter completion event."""
        event = TelemetryEvent(
            event_type="adapter.complete",
            adapter_id=adapter_id,
            family=family,
            mode=mode,
            session_id=session_id,
            run_id=run_id,
            duration_ms=duration_ms,
            metadata={"status": status},
        )
        self.emit(event)
        return event

    def adapter_error(self, adapter_id: str, family: str, session_id: str, run_id: str, error: str) -> TelemetryEvent:
        """Emit adapter error event."""
        event = TelemetryEvent(
            event_type="adapter.error",
            adapter_id=adapter_id,
            family=family,
            session_id=session_id,
            run_id=run_id,
            metadata={"error": error},
        )
        self.emit(event)
        return event

    def fallback_used(self, primary_adapter: str, fallback_adapter: str, reason: str, session_id: str, run_id: str) -> TelemetryEvent:
        """Emit fallback usage event."""
        event = TelemetryEvent(
            event_type="adapter.fallback",
            adapter_id=fallback_adapter,
            session_id=session_id,
            run_id=run_id,
            metadata={"primary": primary_adapter, "reason": reason},
        )
        self.emit(event)
        return event

    def add_listener(self, listener: Any) -> None:
        """Add an event listener (function that accepts TelemetryEvent)."""
        self._listeners.append(listener)

    def get_events(self, session_id: Optional[str] = None, event_type: Optional[str] = None) -> List[TelemetryEvent]:
        """Query events, optionally filtered."""
        events = self._events
        if session_id:
            events = [e for e in events if e.session_id == session_id]
        if event_type:
            events = [e for e in events if e.event_type == event_type]
        return events

    def get_adapter_metrics(self, adapter_id: str) -> Dict[str, Any]:
        """Get aggregate metrics for an adapter."""
        adapter_events = [e for e in self._events if e.adapter_id == adapter_id]
        completions = [e for e in adapter_events if e.event_type == "adapter.complete"]
        errors = [e for e in adapter_events if e.event_type == "adapter.error"]
        fallbacks = [e for e in adapter_events if e.event_type == "adapter.fallback"]
        durations = [e.duration_ms for e in completions if e.duration_ms is not None]

        return {
            "adapter_id": adapter_id,
            "total_runs": len(completions) + len(errors),
            "completions": len(completions),
            "errors": len(errors),
            "fallback_count": len(fallbacks),
            "avg_duration_ms": sum(durations) / len(durations) if durations else 0,
            "min_duration_ms": min(durations) if durations else 0,
            "max_duration_ms": max(durations) if durations else 0,
        }
