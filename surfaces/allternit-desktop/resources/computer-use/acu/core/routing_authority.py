"""Evidence-gated canonical migration stages by capability cell."""

from __future__ import annotations

import json
import sqlite3
import threading
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict

from core.evaluation_authority import EvaluationAuthority


@dataclass(frozen=True)
class RoutingCell:
    capability_cell: str
    canonical_provider_id: str
    legacy_route_id: str
    stage: str
    updated_at: str
    evidence_gate: Dict[str, Any]


class RoutingAuthority:
    STAGES = ("shadow", "dual_route", "canonical_default", "retired")

    def __init__(self, path: str | Path, evaluations: EvaluationAuthority) -> None:
        self._evaluations = evaluations
        self._connection = sqlite3.connect(str(path), check_same_thread=False)
        self._connection.row_factory = sqlite3.Row
        self._lock = threading.RLock()
        with self._connection:
            self._connection.execute(
                """CREATE TABLE IF NOT EXISTS canonical_routing_cells (
                    capability_cell TEXT PRIMARY KEY, payload TEXT NOT NULL
                )"""
            )

    def get(self, capability_cell: str) -> RoutingCell:
        row = self._connection.execute(
            "SELECT payload FROM canonical_routing_cells WHERE capability_cell = ?", (capability_cell,)
        ).fetchone()
        if row is None:
            raise KeyError(f"Unknown routing cell {capability_cell!r}")
        return RoutingCell(**json.loads(row["payload"]))

    def configure(
        self, *, capability_cell: str, canonical_provider_id: str, legacy_route_id: str,
    ) -> RoutingCell:
        try:
            existing = self.get(capability_cell)
            if (
                existing.canonical_provider_id != canonical_provider_id
                or existing.legacy_route_id != legacy_route_id
            ):
                raise ValueError("Routing cell provider identities are immutable")
            return existing
        except KeyError:
            record = RoutingCell(
                capability_cell, canonical_provider_id, legacy_route_id, "shadow",
                datetime.now(timezone.utc).isoformat(), {},
            )
            with self._lock, self._connection:
                self._connection.execute(
                    "INSERT INTO canonical_routing_cells VALUES (?, ?)",
                    (capability_cell, json.dumps(asdict(record), sort_keys=True)),
                )
            return record

    def transition(self, capability_cell: str, stage: str) -> RoutingCell:
        if stage not in self.STAGES:
            raise ValueError(f"Unknown routing stage {stage!r}")
        current = self.get(capability_cell)
        current_index = self.STAGES.index(current.stage)
        next_index = self.STAGES.index(stage)
        if next_index > current_index + 1:
            raise ValueError("Routing stages cannot be skipped")
        gate: Dict[str, Any] = current.evidence_gate
        if next_index > current_index:
            gate = self._evaluations.release_gate(
                current.canonical_provider_id, capability_cell,
            )
            if not gate["passed"]:
                raise ValueError("Measured release gate has not passed for this capability cell")
        updated = RoutingCell(
            current.capability_cell, current.canonical_provider_id, current.legacy_route_id,
            stage, datetime.now(timezone.utc).isoformat(), gate,
        )
        with self._lock, self._connection:
            self._connection.execute(
                "UPDATE canonical_routing_cells SET payload = ? WHERE capability_cell = ?",
                (json.dumps(asdict(updated), sort_keys=True), capability_cell),
            )
        return updated

    def list(self) -> tuple[RoutingCell, ...]:
        rows = self._connection.execute(
            "SELECT payload FROM canonical_routing_cells ORDER BY capability_cell"
        ).fetchall()
        return tuple(RoutingCell(**json.loads(row["payload"])) for row in rows)

    def close(self) -> None:
        self._connection.close()
