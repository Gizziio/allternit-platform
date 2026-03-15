"""
A2R Computer Use — Adapter Selector
Selects primary adapter and fallback chain from the capability matrix.

Selection pipeline (per RoutingPolicy.md):
  1. Filter by family
  2. Filter by mode support
  3. Filter by policy (experimental gate)
  4. Rank by: status → pattern → routing_confidence → fallback_rank
  5. Return primary + fallback chain
  6. Emit selection receipt (caller responsibility)

This is the code binding for the CapabilityMatrix.md routing principles RP-1 through RP-7.
"""

from typing import List, Optional, Dict, Any, NamedTuple
from .capability_matrix import CapabilityMatrix, AdapterCandidate


class SelectionResult(NamedTuple):
    primary: str
    fallback_chain: List[str]
    reason: str
    candidates_considered: int
    experimental_filtered: int


class AdapterSelector:
    """
    Selects adapters from the capability matrix for a given routing request.
    Implements the routing principles from CapabilityMatrix.md.
    """

    def __init__(self, matrix: Optional[CapabilityMatrix] = None):
        self._matrix = matrix or CapabilityMatrix()
        if not self._matrix._candidates:
            self._matrix.load()

    def select(
        self,
        family: str,
        mode: str,
        prefer_deterministic: bool = True,
        allow_experimental: bool = False,
        required_traits: Optional[List[str]] = None,
        exclude_adapters: Optional[List[str]] = None,
    ) -> SelectionResult:
        """
        Select primary adapter and fallback chain for a given family and mode.

        Args:
            family: adapter family (browser, retrieval, desktop, hybrid)
            mode: execution mode (execute, inspect, parallel, assist, crawl, desktop, hybrid)
            prefer_deterministic: if True, rank deterministic adapters before adaptive (RP-5)
            allow_experimental: if True, include experimental adapters (RP-2)
            required_traits: list of trait names the adapter must support
            exclude_adapters: adapter IDs to exclude from selection

        Returns:
            SelectionResult with primary, fallback_chain, and reason
        """
        exclude = set(exclude_adapters or [])

        # Get all valid candidates
        candidates = self._matrix.candidates_for(
            family=family,
            mode=mode,
            allow_experimental=allow_experimental,
        )

        # Count before filtering for telemetry
        total_candidates = len(candidates)
        all_including_experimental = self._matrix.candidates_for(
            family=family, mode=mode, allow_experimental=True
        )
        experimental_count = len(all_including_experimental) - total_candidates

        # Apply required traits filter
        if required_traits:
            candidates = [
                c for c in candidates
                if all(c.supports_trait(t) for t in required_traits)
            ]

        # Apply exclusion list
        candidates = [c for c in candidates if c.adapter_id not in exclude]

        if not candidates:
            return SelectionResult(
                primary="",
                fallback_chain=[],
                reason=f"No adapter found for family='{family}' mode='{mode}'. "
                       f"Checked {total_candidates} candidates, {experimental_count} were experimental.",
                candidates_considered=total_candidates,
                experimental_filtered=experimental_count,
            )

        # Re-sort: factor in default_for_modes (adapters declared as default for this
        # mode get priority boost, overriding the generic production status ranking)
        def sort_key_with_default(c: "AdapterCandidate") -> tuple:
            is_default = 0 if mode in c.manifest.get("default_for_modes", []) else 1
            pattern_pref = (0 if c.pattern == "deterministic" else 1) if prefer_deterministic else 0
            return (is_default, pattern_pref, c.sort_key)

        candidates.sort(key=sort_key_with_default)

        primary = candidates[0]
        fallbacks = [c.adapter_id for c in candidates[1:]]

        reason = (
            f"Selected '{primary.adapter_id}' [{primary.production_status}] "
            f"pattern={primary.pattern} "
            f"from {len(candidates)} candidates for {family}/{mode}"
        )

        return SelectionResult(
            primary=primary.adapter_id,
            fallback_chain=fallbacks,
            reason=reason,
            candidates_considered=total_candidates,
            experimental_filtered=experimental_count,
        )

    def select_for_pattern(
        self,
        family: str,
        mode: str,
        pattern: str,
        allow_experimental: bool = False,
    ) -> SelectionResult:
        """
        Select adapter that matches a specific pattern (deterministic/adaptive/orchestrated-hybrid).
        Falls back to any available adapter if no exact pattern match.
        """
        candidates = self._matrix.candidates_for(
            family=family, mode=mode, allow_experimental=allow_experimental
        )
        pattern_match = [c for c in candidates if c.pattern == pattern]

        if pattern_match:
            primary = pattern_match[0]
            fallbacks = [c.adapter_id for c in pattern_match[1:]]
            reason = f"Pattern-matched '{primary.adapter_id}' for pattern={pattern}"
        elif candidates:
            primary = candidates[0]
            fallbacks = [c.adapter_id for c in candidates[1:]]
            reason = f"No exact pattern={pattern} match; using best available '{primary.adapter_id}'"
        else:
            return SelectionResult(
                primary="",
                fallback_chain=[],
                reason=f"No adapter found for family='{family}' mode='{mode}' pattern='{pattern}'",
                candidates_considered=len(candidates),
                experimental_filtered=0,
            )

        return SelectionResult(
            primary=primary.adapter_id,
            fallback_chain=fallbacks,
            reason=reason,
            candidates_considered=len(candidates),
            experimental_filtered=0,
        )

    def get_default_for_mode(self, mode: str) -> Optional[str]:
        """
        Get the default adapter for a given mode (the one that declares default_for_modes).
        """
        for candidate in self._matrix.all_candidates():
            manifest = candidate.manifest
            if mode in manifest.get("default_for_modes", []):
                return candidate.adapter_id
        return None

    def promotion_report(self, conformance_results: Dict[str, float]) -> List[Dict[str, Any]]:
        """
        Generate a promotion eligibility report for all adapters.

        Args:
            conformance_results: {adapter_id: pass_rate (0.0–1.0)}

        Returns:
            List of promotion reports sorted by adapter_id
        """
        reports = []
        for candidate in sorted(self._matrix.all_candidates(), key=lambda c: c.adapter_id):
            pass_rate = conformance_results.get(candidate.adapter_id, 0.0)
            report = self._matrix.promotion_eligible(candidate.adapter_id, pass_rate)
            report["adapter_id"] = candidate.adapter_id
            report["conformance_pass_rate"] = pass_rate
            reports.append(report)
        return reports
