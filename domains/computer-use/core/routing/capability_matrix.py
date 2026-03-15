"""
A2R Computer Use — Capability Matrix Loader
Loads and validates adapter manifests against the capability matrix rules.
Provides ranked adapter lists for the adapter selector.
"""

from typing import Dict, List, Optional, Any, Tuple
from pathlib import Path
import json
import os


# ── Status ranking (lower = preferred) ────────────────────────────────────
STATUS_RANK = {
    "production": 0,
    "beta": 1,
    "experimental": 2,
}

# ── Pattern ranking (lower = preferred, per RP-1) ─────────────────────────
PATTERN_RANK = {
    "deterministic": 0,
    "adaptive": 1,
    "orchestrated-hybrid": 2,
}

# ── Guarantee grade ranking (lower = better) ──────────────────────────────
GRADE_RANK = {"A": 0, "B": 1, "C": 2, "X": 3}


class AdapterCandidate:
    """A ranked adapter candidate for selection."""

    def __init__(self, manifest: Dict[str, Any]):
        self.manifest = manifest
        self.adapter_id: str = manifest["adapter_id"]
        self.family: str = manifest["family"]
        self.pattern: str = manifest.get("pattern", "deterministic")
        self.production_status: str = manifest.get("production_status", "experimental")
        self.fallback_rank: int = manifest.get("fallback_rank", 100)
        self.guarantees: Dict[str, str] = manifest.get("guarantees", {})
        self.traits: Dict[str, str] = manifest.get("traits", {})
        self.modes_supported: List[str] = manifest.get("modes_supported", [])

    @property
    def status_score(self) -> int:
        return STATUS_RANK.get(self.production_status, 99)

    @property
    def pattern_score(self) -> int:
        return PATTERN_RANK.get(self.pattern, 99)

    @property
    def routing_confidence_score(self) -> int:
        grade = self.guarantees.get("routing_confidence", "X")
        return GRADE_RANK.get(grade, 99)

    @property
    def sort_key(self) -> Tuple:
        """Lower is more preferred."""
        return (
            self.status_score,
            self.pattern_score,
            self.routing_confidence_score,
            self.fallback_rank,
        )

    def is_experimental(self) -> bool:
        return self.production_status == "experimental"

    def trait_value(self, trait: str) -> str:
        return self.traits.get(trait, "unknown")

    def supports_trait(self, trait: str) -> bool:
        return self.trait_value(trait) in ("yes", "partial")

    def supports_mode(self, mode: str) -> bool:
        return mode in self.modes_supported

    def __repr__(self) -> str:
        return f"<AdapterCandidate {self.adapter_id} [{self.production_status}] key={self.sort_key}>"


class CapabilityMatrix:
    """
    Loads and indexes adapter manifests. Provides sorted candidate lists
    for the adapter selector based on family, mode, and constraints.
    """

    def __init__(self, adapters_root: Optional[str] = None):
        self._adapters_root = adapters_root or str(
            Path(__file__).resolve().parents[1] / "adapters"
        )
        self._candidates: Dict[str, AdapterCandidate] = {}

    def load(self) -> None:
        """Scan adapter directories and load all manifests."""
        root = Path(self._adapters_root)
        if not root.exists():
            return

        for manifest_path in root.rglob("adapter.manifest.json"):
            try:
                with open(manifest_path) as f:
                    manifest = json.load(f)
                adapter_id = manifest.get("adapter_id")
                if adapter_id:
                    self._candidates[adapter_id] = AdapterCandidate(manifest)
            except (json.JSONDecodeError, IOError) as e:
                continue

    def get(self, adapter_id: str) -> Optional[AdapterCandidate]:
        """Get a specific candidate by adapter_id."""
        return self._candidates.get(adapter_id)

    def candidates_for(
        self,
        family: str,
        mode: str,
        allow_experimental: bool = False,
    ) -> List[AdapterCandidate]:
        """
        Return sorted candidates for a given family and mode.
        Experimental adapters are excluded unless allow_experimental=True.
        Sorted by: status → pattern → routing_confidence → fallback_rank.
        """
        results = []
        for candidate in self._candidates.values():
            if candidate.family != family:
                continue
            if not candidate.supports_mode(mode):
                continue
            if candidate.is_experimental() and not allow_experimental:
                continue
            results.append(candidate)

        results.sort(key=lambda c: c.sort_key)
        return results

    def all_candidates(self) -> List[AdapterCandidate]:
        """All loaded candidates."""
        return list(self._candidates.values())

    def by_family(self, family: str) -> List[AdapterCandidate]:
        """All candidates in a given family."""
        return [c for c in self._candidates.values() if c.family == family]

    def promotion_eligible(self, adapter_id: str, conformance_pass_rate: float) -> Dict[str, Any]:
        """
        Check if an adapter is eligible for promotion to next status tier.
        Returns dict with: eligible, current_status, target_status, blocking_reasons.
        """
        candidate = self._candidates.get(adapter_id)
        if not candidate:
            return {"eligible": False, "blocking_reasons": [f"Adapter '{adapter_id}' not found"]}

        current = candidate.production_status
        reasons = []

        if current == "experimental":
            target = "beta"
            # Experimental → Beta requirements
            if not candidate.guarantees:
                reasons.append("No guarantees declared in manifest")
            if conformance_pass_rate < 0.5:
                reasons.append(f"Conformance {conformance_pass_rate:.0%} < 50% required for beta")
        elif current == "beta":
            target = "production"
            # Beta → Production requirements
            if conformance_pass_rate < 0.90:
                reasons.append(f"Conformance {conformance_pass_rate:.0%} < 90% required for production")
            if candidate.guarantees.get("policy") not in ("A", "B"):
                reasons.append("Policy guarantee must be A or B for production")
            if candidate.guarantees.get("receipt") not in ("A", "B"):
                reasons.append("Receipt guarantee must be A or B for production")
        else:
            return {
                "eligible": False,
                "current_status": current,
                "target_status": None,
                "blocking_reasons": ["Already at production status"],
            }

        return {
            "eligible": len(reasons) == 0,
            "current_status": current,
            "target_status": target,
            "blocking_reasons": reasons,
        }
