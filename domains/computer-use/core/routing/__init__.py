"""
A2R Computer Use — Deterministic Router
Routes tasks by: mode → family → adapter (G5 routing guarantee).
No direct UI-to-adapter paths. All routing decisions are logged.

Adapters:
  v0.1 (live):
    browser.playwright    — deterministic browser automation (headed/headless)
    browser.browser-use   — adaptive LLM-powered browser automation
    browser.cdp           — Chrome DevTools Protocol inspect/debug
    desktop.pyautogui     — native desktop screenshot, click, type
  v0.2 (new):
    retrieval.playwright-crawler — systematic multi-page crawl + extraction
    hybrid.orchestrator          — cross-family browser↔desktop workflow coordination
    browser.extension            — user-present assist mode via thin-client extension

Modes:
  v0.1: execute, inspect, parallel, desktop
  v0.2: assist, crawl, hybrid

Families:
  v0.1: browser, desktop
  v0.2: retrieval, hybrid
"""

from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, field
from datetime import datetime
import uuid


VALID_FAMILIES = {"browser", "desktop", "retrieval", "hybrid"}
VALID_MODES = {"execute", "inspect", "parallel", "desktop", "assist", "crawl", "hybrid"}


@dataclass
class RouteConstraints:
    """Constraints that narrow adapter selection."""
    user_present: bool = False
    headless_allowed: bool = True
    deterministic: bool = True
    visual_reasoning: bool = False
    parallel: bool = False
    persistence_required: bool = False
    destructive_action: bool = False
    local_only: bool = False


@dataclass
class RouteDecision:
    """Routing decision record — emitted as a receipt."""
    decision_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    family: str = ""
    mode: str = ""
    primary_adapter: str = ""
    fallback_chain: List[str] = field(default_factory=list)
    constraints: Dict[str, Any] = field(default_factory=dict)
    reason: str = ""
    policy_decision_id: Optional[str] = None
    timestamp: str = field(default_factory=lambda: datetime.utcnow().isoformat())

    def to_dict(self) -> Dict[str, Any]:
        return {
            "decision_id": self.decision_id,
            "family": self.family,
            "mode": self.mode,
            "primary_adapter": self.primary_adapter,
            "fallback_chain": self.fallback_chain,
            "constraints": self.constraints,
            "reason": self.reason,
            "policy_decision_id": self.policy_decision_id,
            "timestamp": self.timestamp,
        }


# ── Adapter selection matrix ──────────────────────────────────────────
# Key: (mode, family, deterministic)
# Every valid (mode, family) pair must have entries for BOTH deterministic
# values so the router never falls through to unknown.

ADAPTER_MATRIX: Dict[Tuple[str, str, bool], dict] = {
    # ── browser × execute ──
    ("execute", "browser", True): {
        "primary": "browser.playwright",
        "fallbacks": ["browser.browser-use"],
        "reason": "Deterministic browser execution → Playwright",
    },
    ("execute", "browser", False): {
        "primary": "browser.browser-use",
        "fallbacks": ["browser.playwright"],
        "reason": "Adaptive browser execution → browser-use",
    },

    # ── browser × inspect ──
    ("inspect", "browser", True): {
        "primary": "browser.cdp",
        "fallbacks": ["browser.playwright"],
        "reason": "Browser inspect/debug → CDP (read-only DevTools)",
    },
    ("inspect", "browser", False): {
        "primary": "browser.cdp",
        "fallbacks": ["browser.playwright"],
        "reason": "Browser inspect/debug → CDP (read-only DevTools)",
    },

    # ── browser × parallel ──
    ("parallel", "browser", True): {
        "primary": "browser.playwright",
        "fallbacks": ["browser.browser-use"],
        "reason": "Parallel browser pool → Playwright (multi-context)",
    },
    ("parallel", "browser", False): {
        "primary": "browser.playwright",
        "fallbacks": ["browser.browser-use"],
        "reason": "Parallel browser pool → Playwright (multi-context)",
    },

    # ── browser × desktop (cross-family: browser asked for desktop mode) ──
    ("desktop", "browser", True): {
        "primary": "browser.playwright",
        "fallbacks": [],
        "reason": "Desktop mode on browser family → Playwright screenshot/capture",
    },
    ("desktop", "browser", False): {
        "primary": "browser.playwright",
        "fallbacks": [],
        "reason": "Desktop mode on browser family → Playwright screenshot/capture",
    },

    # ── desktop × desktop ──
    ("desktop", "desktop", True): {
        "primary": "desktop.pyautogui",
        "fallbacks": [],
        "reason": "Desktop automation → pyautogui",
    },
    ("desktop", "desktop", False): {
        "primary": "desktop.pyautogui",
        "fallbacks": [],
        "reason": "Desktop automation → pyautogui",
    },

    # ── desktop × execute (desktop asked to execute = same as desktop mode) ──
    ("execute", "desktop", True): {
        "primary": "desktop.pyautogui",
        "fallbacks": [],
        "reason": "Execute on desktop family → pyautogui",
    },
    ("execute", "desktop", False): {
        "primary": "desktop.pyautogui",
        "fallbacks": [],
        "reason": "Execute on desktop family → pyautogui",
    },

    # ── desktop × inspect (desktop screenshot/observe for debugging) ──
    ("inspect", "desktop", True): {
        "primary": "desktop.pyautogui",
        "fallbacks": [],
        "reason": "Desktop inspect → pyautogui screenshot/observe (read-only)",
    },
    ("inspect", "desktop", False): {
        "primary": "desktop.pyautogui",
        "fallbacks": [],
        "reason": "Desktop inspect → pyautogui screenshot/observe (read-only)",
    },

    # ── desktop × parallel (multi-screenshot / multi-region) ──
    ("parallel", "desktop", True): {
        "primary": "desktop.pyautogui",
        "fallbacks": [],
        "reason": "Parallel desktop → pyautogui (sequential on single screen)",
    },
    ("parallel", "desktop", False): {
        "primary": "desktop.pyautogui",
        "fallbacks": [],
        "reason": "Parallel desktop → pyautogui (sequential on single screen)",
    },

    # ═══════════════════════════════════════════════════════════════════
    # v0.2 — New families and modes
    # ═══════════════════════════════════════════════════════════════════

    # ── retrieval × crawl (primary use case for retrieval family) ──
    ("crawl", "retrieval", True): {
        "primary": "retrieval.playwright-crawler",
        "fallbacks": [],
        "reason": "Retrieval crawl → Playwright-based systematic crawler",
    },
    ("crawl", "retrieval", False): {
        "primary": "retrieval.playwright-crawler",
        "fallbacks": [],
        "reason": "Retrieval crawl → Playwright-based systematic crawler",
    },

    # ── retrieval × execute (single-page extraction) ──
    ("execute", "retrieval", True): {
        "primary": "retrieval.playwright-crawler",
        "fallbacks": [],
        "reason": "Retrieval execute → Playwright crawler (single-page extract)",
    },
    ("execute", "retrieval", False): {
        "primary": "retrieval.playwright-crawler",
        "fallbacks": [],
        "reason": "Retrieval execute → Playwright crawler (single-page extract)",
    },

    # ── retrieval × inspect (crawl preview / sitemap) ──
    ("inspect", "retrieval", True): {
        "primary": "retrieval.playwright-crawler",
        "fallbacks": [],
        "reason": "Retrieval inspect → Playwright crawler (preview mode)",
    },
    ("inspect", "retrieval", False): {
        "primary": "retrieval.playwright-crawler",
        "fallbacks": [],
        "reason": "Retrieval inspect → Playwright crawler (preview mode)",
    },

    # ── hybrid × hybrid (cross-family orchestration) ──
    ("hybrid", "hybrid", True): {
        "primary": "hybrid.orchestrator",
        "fallbacks": [],
        "reason": "Hybrid workflow → orchestrator coordinates browser + desktop",
    },
    ("hybrid", "hybrid", False): {
        "primary": "hybrid.orchestrator",
        "fallbacks": [],
        "reason": "Hybrid workflow → orchestrator coordinates browser + desktop",
    },

    # ── hybrid × execute (orchestrated execution) ──
    ("execute", "hybrid", True): {
        "primary": "hybrid.orchestrator",
        "fallbacks": [],
        "reason": "Hybrid execute → orchestrator (cross-family task)",
    },
    ("execute", "hybrid", False): {
        "primary": "hybrid.orchestrator",
        "fallbacks": [],
        "reason": "Hybrid execute → orchestrator (cross-family task)",
    },

    # ── browser × assist (user-present, agent suggests + human confirms) ──
    ("assist", "browser", True): {
        "primary": "browser.extension",
        "fallbacks": ["browser.playwright"],
        "reason": "Assist mode → extension adapter (user-present workflow)",
    },
    ("assist", "browser", False): {
        "primary": "browser.extension",
        "fallbacks": ["browser.browser-use"],
        "reason": "Assist mode → extension adapter (user-present, adaptive fallback)",
    },

    # ── desktop × assist (user-present desktop guidance) ──
    ("assist", "desktop", True): {
        "primary": "desktop.pyautogui",
        "fallbacks": [],
        "reason": "Desktop assist → pyautogui (observe + suggest, user confirms)",
    },
    ("assist", "desktop", False): {
        "primary": "desktop.pyautogui",
        "fallbacks": [],
        "reason": "Desktop assist → pyautogui (observe + suggest, user confirms)",
    },
}


class RoutingError(Exception):
    """Raised when no adapter can be found for the requested route."""
    pass


class Router:
    """
    Deterministic task router.
    Routes by mode → family → adapter based on constraints and policy.
    Raises RoutingError for invalid family/mode combos instead of returning unknown.
    """

    def __init__(self, registry: "AdapterRegistry" = None):
        self._registry = registry
        self._decisions: List[RouteDecision] = []

    def route(
        self,
        goal: str,
        family: str,
        mode: str,
        constraints: Optional[RouteConstraints] = None,
    ) -> RouteDecision:
        """
        Determine the adapter to use for a given task.
        Returns a RouteDecision with primary adapter and fallback chain.
        Raises RoutingError if family/mode combination is not supported.
        """
        if constraints is None:
            constraints = RouteConstraints()

        if family not in VALID_FAMILIES:
            raise RoutingError(
                f"Unknown family '{family}'. Valid families: {sorted(VALID_FAMILIES)}"
            )

        if mode not in VALID_MODES:
            raise RoutingError(
                f"Unknown mode '{mode}'. Valid modes: {sorted(VALID_MODES)}"
            )

        # Lookup in adapter matrix — exact match first
        key = (mode, family, constraints.deterministic)
        entry = ADAPTER_MATRIX.get(key)

        if not entry:
            # Try with opposite deterministic flag
            key_alt = (mode, family, not constraints.deterministic)
            entry = ADAPTER_MATRIX.get(key_alt)

        if not entry:
            raise RoutingError(
                f"No routing rule for mode='{mode}' family='{family}'. "
                f"This combination is not supported by any installed adapter."
            )

        primary = entry["primary"]
        fallbacks = list(entry["fallbacks"])
        reason = entry["reason"]

        # Constraint overrides

        # If visual_reasoning required and primary doesn't support it, prefer browser-use
        if constraints.visual_reasoning and not constraints.deterministic:
            if family == "browser" and primary == "browser.playwright":
                primary = "browser.browser-use"
                reason += " (visual reasoning override)"

        # If user_present, run headed (no adapter swap needed — all adapters support headed)
        if constraints.user_present and not constraints.headless_allowed:
            reason += " (user-present, headed)"

        decision = RouteDecision(
            family=family,
            mode=mode,
            primary_adapter=primary,
            fallback_chain=fallbacks,
            constraints={
                "user_present": constraints.user_present,
                "headless_allowed": constraints.headless_allowed,
                "deterministic": constraints.deterministic,
                "visual_reasoning": constraints.visual_reasoning,
                "parallel": constraints.parallel,
                "destructive_action": constraints.destructive_action,
            },
            reason=reason,
        )

        self._decisions.append(decision)
        return decision

    def list_supported_routes(self) -> List[Dict[str, str]]:
        """Return all supported (mode, family) combinations and their primary adapters."""
        seen = set()
        routes = []
        for (mode, family, det), entry in ADAPTER_MATRIX.items():
            key = (mode, family)
            if key not in seen:
                seen.add(key)
                routes.append({
                    "mode": mode,
                    "family": family,
                    "primary_adapter": entry["primary"],
                    "fallbacks": entry["fallbacks"],
                })
        return sorted(routes, key=lambda r: (r["family"], r["mode"]))

    def get_decisions(self) -> List[RouteDecision]:
        """Return all routing decisions for audit."""
        return list(self._decisions)
