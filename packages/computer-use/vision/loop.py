"""
A2R Computer Use — Vision Loop

Implements the observe → decide → act → verify cycle used when deterministic
paths fail or when only a screenshot is available.
"""

import asyncio
import base64
import io
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional


# ---------------------------------------------------------------------------
# Result dataclasses
# ---------------------------------------------------------------------------

@dataclass
class ObservationResult:
    """Snapshot of the current environment state."""
    screenshot_b64: str = ""        # Base-64 encoded PNG
    url: str = ""                   # Active URL (browser context); empty for desktop
    title: str = ""                 # Window / page title
    elements: List[Dict[str, Any]] = field(default_factory=list)  # Detected interactive elements
    timestamp: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    raw_text: str = ""              # Extracted plain text (browser: innerText, desktop: OCR if available)
    error: Optional[str] = None


@dataclass
class DecisionResult:
    """Action chosen by the decide step."""
    action_type: str = ""           # Mirrors ActionRequest.action_type
    target: str = ""                # Selector, window title, or coordinate hint
    parameters: Dict[str, Any] = field(default_factory=dict)
    confidence: float = 0.0         # 0.0–1.0
    reason: str = ""                # Human-readable justification
    fallback: Optional[str] = None  # What to do if this action fails
    source: str = "heuristic"       # "heuristic" | "vlm"


@dataclass
class ActionResult:
    """Result from executing a decided action."""
    status: str = "unknown"         # "completed" | "failed" | "skipped"
    extracted_content: Any = None
    error: Optional[str] = None
    duration_ms: int = 0


@dataclass
class VerifyResult:
    """Outcome of comparing before/after state."""
    outcome: str = "retry"          # "success" | "retry" | "escalate"
    reason: str = ""
    confidence: float = 0.0


@dataclass
class VisionLoopResult:
    """Final result returned by VisionLoop.run()."""
    goal: str = ""
    steps_taken: int = 0
    final_status: str = "unknown"   # "success" | "max_steps" | "escalated" | "error"
    steps: List[Dict[str, Any]] = field(default_factory=list)
    escalation_reason: Optional[str] = None
    started_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    completed_at: Optional[str] = None


# ---------------------------------------------------------------------------
# VisionLoop
# ---------------------------------------------------------------------------

class VisionLoop:
    """
    Vision-driven computer use loop.

    Cycle: observe() → decide() → act() → verify() → repeat or escalate

    Used when deterministic paths fail or when only a screenshot is available.

    Parameters
    ----------
    adapter:
        Any adapter implementing BaseAdapter (desktop or browser).
    vision_inference:
        Optional VisionInference instance. When provided, VLM analysis is used
        in the decide step. When absent, heuristic target detection is used.
    max_retries:
        How many consecutive retry verdicts are allowed before escalating.
    """

    def __init__(self, adapter, vision_inference=None, max_retries: int = 3):
        self._adapter = adapter
        self._vision = vision_inference
        self._max_retries = max_retries

    # ------------------------------------------------------------------
    # Public entry point
    # ------------------------------------------------------------------

    async def run(
        self,
        goal: str,
        session_id: str,
        run_id: str,
        max_steps: int = 10,
    ) -> VisionLoopResult:
        """
        Run the vision loop until the goal is achieved, max_steps is reached,
        or escalation is required.
        """
        result = VisionLoopResult(goal=goal)
        history: List[Dict[str, Any]] = []
        consecutive_retries = 0

        for step_idx in range(max_steps):
            step: Dict[str, Any] = {
                "step": step_idx + 1,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }

            # --- Observe ---
            observation = await self.observe(session_id, run_id)
            step["observation"] = {
                "title": observation.title,
                "url": observation.url,
                "elements_count": len(observation.elements),
                "has_screenshot": bool(observation.screenshot_b64),
                "error": observation.error,
            }
            if observation.error:
                step["status"] = "observe_error"
                result.steps.append(step)
                result.steps_taken = step_idx + 1
                result.final_status = "error"
                result.escalation_reason = f"Observation failed: {observation.error}"
                break

            # --- Decide ---
            decision = await self.decide(goal, observation, history)
            step["decision"] = {
                "action_type": decision.action_type,
                "target": decision.target,
                "parameters": decision.parameters,
                "confidence": decision.confidence,
                "reason": decision.reason,
                "source": decision.source,
            }

            # Low-confidence with no VLM → escalate immediately
            if decision.confidence < 0.1:
                step["status"] = "low_confidence_escalate"
                result.steps.append(step)
                result.steps_taken = step_idx + 1
                result.final_status = "escalated"
                result.escalation_reason = (
                    f"Decision confidence too low ({decision.confidence:.2f}): {decision.reason}"
                )
                break

            # --- Act ---
            action_result = await self.act(decision, session_id, run_id)
            step["action"] = {
                "status": action_result.status,
                "error": action_result.error,
                "duration_ms": action_result.duration_ms,
            }

            # Take post-action observation for verification
            after_observation = await self.observe(session_id, run_id)

            # --- Verify ---
            verify = await self.verify(observation, after_observation, goal)
            step["verify"] = {
                "outcome": verify.outcome,
                "reason": verify.reason,
                "confidence": verify.confidence,
            }
            step["status"] = verify.outcome

            history.append({
                "step": step_idx + 1,
                "decision": step["decision"],
                "verify": step["verify"],
            })
            result.steps.append(step)

            if verify.outcome == "success":
                result.steps_taken = step_idx + 1
                result.final_status = "success"
                break

            if verify.outcome == "escalate":
                result.steps_taken = step_idx + 1
                result.final_status = "escalated"
                result.escalation_reason = verify.reason
                break

            # verify.outcome == "retry"
            consecutive_retries += 1
            if consecutive_retries >= self._max_retries:
                result.steps_taken = step_idx + 1
                result.final_status = "escalated"
                result.escalation_reason = (
                    f"Exceeded {self._max_retries} consecutive retries. "
                    f"Last verify reason: {verify.reason}"
                )
                break
        else:
            # Exhausted max_steps without breaking
            result.steps_taken = max_steps
            result.final_status = "max_steps"
            result.escalation_reason = f"Goal not achieved within {max_steps} steps"

        result.completed_at = datetime.now(timezone.utc).isoformat()
        return result

    # ------------------------------------------------------------------
    # Loop phases
    # ------------------------------------------------------------------

    async def observe(self, session_id: str, run_id: str) -> ObservationResult:
        """Take screenshot and extract current environment state."""
        from core import ActionRequest

        obs = ObservationResult()
        try:
            action = ActionRequest(
                action_type="capture_screen",
                target="",
                parameters={},
            )
            envelope = await self._adapter.execute(action, session_id, run_id)

            if envelope.status == "completed" and envelope.extracted_content:
                content = envelope.extracted_content
                if isinstance(content, dict):
                    obs.screenshot_b64 = content.get("screenshot_b64", "")
                    obs.url = content.get("url", "")
                    obs.title = content.get("title", "")
                    obs.raw_text = content.get("text", "")
                    obs.elements = content.get("elements", [])
            elif envelope.status == "failed":
                # Try legacy "screenshot" type
                action2 = ActionRequest(action_type="screenshot", target="", parameters={})
                envelope2 = await self._adapter.execute(action2, session_id, run_id)
                if envelope2.status == "completed" and isinstance(envelope2.extracted_content, dict):
                    obs.screenshot_b64 = envelope2.extracted_content.get("screenshot_b64", "")
                else:
                    obs.error = (envelope2.error or {}).get("message", "screenshot failed")

            # Supplement with observe action for metadata
            try:
                observe_action = ActionRequest(action_type="observe", target="", parameters={})
                obs_envelope = await self._adapter.execute(observe_action, session_id, run_id)
                if obs_envelope.status == "completed" and isinstance(obs_envelope.extracted_content, dict):
                    meta = obs_envelope.extracted_content
                    if not obs.url:
                        obs.url = meta.get("url", "")
                    if not obs.title:
                        obs.title = meta.get("title", "")
            except Exception:
                pass  # metadata is supplemental; not fatal

        except Exception as exc:
            obs.error = str(exc)

        return obs

    async def decide(
        self,
        goal: str,
        observation: ObservationResult,
        history: List[Dict[str, Any]],
    ) -> DecisionResult:
        """
        Given goal + current observation, decide the next action.
        Uses VisionInference when available; falls back to heuristics.
        """
        # --- VLM path ---
        if self._vision is not None and observation.screenshot_b64:
            try:
                return await self._decide_via_vlm(goal, observation, history)
            except Exception:
                pass  # Fall through to heuristics on VLM failure

        # --- Heuristic path ---
        return self._decide_heuristic(goal, observation, history)

    async def _decide_via_vlm(
        self,
        goal: str,
        observation: ObservationResult,
        history: List[Dict[str, Any]],
    ) -> DecisionResult:
        """Ask the VLM for the next action and parse the response."""
        from vision import VisionParser

        history_summary = ""
        if history:
            last = history[-1]
            history_summary = (
                f"\nLast action: {last['decision']['action_type']} → {last['verify']['outcome']}"
            )

        prompt = (
            f"Goal: {goal}{history_summary}\n"
            f"Current page title: {observation.title or 'unknown'}\n"
            f"Current URL: {observation.url or 'desktop'}\n"
            "Based on the screenshot, what single action should be taken next? "
            "Respond in function-call format: action_type(param=value, ...)"
        )

        raw_response = self._vision.analyze_screenshot(prompt, observation.screenshot_b64)
        parsed = VisionParser.parse_action(raw_response)

        action_type = parsed.get("action", "")
        parameters = parsed.get("parameters", {})

        if not action_type or action_type == "unknown":
            # Try coordinate extraction as fallback within VLM response
            coords = VisionParser.parse_coordinates(raw_response)
            if coords.get("points"):
                pt = coords["points"][0]
                action_type = "click"
                parameters = {"x": pt["x"], "y": pt["y"]}
            else:
                return DecisionResult(
                    action_type="",
                    confidence=0.0,
                    reason=f"VLM returned unparseable response: {raw_response[:200]}",
                    source="vlm",
                )

        return DecisionResult(
            action_type=action_type,
            target=parameters.pop("target", ""),
            parameters=parameters,
            confidence=0.75,
            reason=f"VLM proposed: {raw_response[:200]}",
            source="vlm",
        )

    def _decide_heuristic(
        self,
        goal: str,
        observation: ObservationResult,
        history: List[Dict[str, Any]],
    ) -> DecisionResult:
        """
        Heuristic decision when VLM is unavailable.
        Uses TargetDetector to find candidates, then matches goal keywords.
        """
        from vision.targets import TargetDetector

        # Build page content dict from observation
        page_content: Dict[str, Any] = {
            "title": observation.title,
            "url": observation.url,
            "text": observation.raw_text,
            "elements": observation.elements,
        }

        candidates = TargetDetector.from_browser_state(page_content)
        match = TargetDetector.from_task_description(goal, observation.raw_text)

        if match and match.get("target"):
            return DecisionResult(
                action_type=match.get("action_type", "click"),
                target=match["target"],
                parameters=match.get("parameters", {}),
                confidence=match.get("confidence", 0.4),
                reason=match.get("reason", "keyword match"),
                source="heuristic",
            )

        if candidates:
            best = candidates[0]
            return DecisionResult(
                action_type=best.get("action_type", "click"),
                target=best.get("selector", best.get("text", "")),
                parameters=best.get("parameters", {}),
                confidence=0.3,
                reason=f"Best candidate from page state: {best.get('text', '')}",
                source="heuristic",
            )

        # No candidates found at all — cannot proceed
        return DecisionResult(
            action_type="",
            confidence=0.0,
            reason=(
                "No actionable targets found on page and no VLM available. "
                "Goal may require human input or a different adapter."
            ),
            source="heuristic",
        )

    async def act(
        self,
        decision: DecisionResult,
        session_id: str,
        run_id: str,
    ) -> ActionResult:
        """Execute the decided action via the adapter."""
        from core import ActionRequest

        if not decision.action_type:
            return ActionResult(status="skipped", error="No action_type in decision")

        t0 = time.monotonic()
        try:
            params = dict(decision.parameters)
            if decision.target:
                params.setdefault("target", decision.target)

            action = ActionRequest(
                action_type=decision.action_type,
                target=decision.target,
                parameters=params,
            )
            envelope = await self._adapter.execute(action, session_id, run_id)
            duration_ms = int((time.monotonic() - t0) * 1000)

            return ActionResult(
                status=envelope.status,
                extracted_content=envelope.extracted_content,
                error=(envelope.error or {}).get("message") if envelope.error else None,
                duration_ms=duration_ms,
            )
        except Exception as exc:
            duration_ms = int((time.monotonic() - t0) * 1000)
            return ActionResult(
                status="failed",
                error=str(exc),
                duration_ms=duration_ms,
            )

    async def verify(
        self,
        before: ObservationResult,
        after: ObservationResult,
        goal: str,
    ) -> VerifyResult:
        """
        Compare before/after observation to determine if the goal was achieved.

        Heuristics applied in order:
        1. Error on capture → escalate
        2. URL changed → likely progress → check goal keywords in new title
        3. Title changed → check goal keywords
        4. Screenshot changed meaningfully → retry with optimism
        5. Nothing changed → escalate (stuck)
        """
        if after.error:
            return VerifyResult(
                outcome="escalate",
                reason=f"Post-action observation failed: {after.error}",
                confidence=0.9,
            )

        goal_lower = goal.lower()
        goal_words = set(w for w in goal_lower.split() if len(w) > 3)

        # --- Check for explicit success signals ---
        after_title_lower = (after.title or "").lower()
        after_url_lower = (after.url or "").lower()
        after_text_lower = (after.raw_text or "").lower()

        success_keywords = {
            "success", "done", "complete", "thank you", "confirmation",
            "submitted", "logged in", "welcome", "dashboard",
        }
        success_signals = success_keywords & set(after_title_lower.split())
        if success_signals:
            return VerifyResult(
                outcome="success",
                reason=f"Success keyword '{next(iter(success_signals))}' found in title",
                confidence=0.85,
            )

        # Check if goal words appear in the new page
        if goal_words and goal_words.issubset(
            set(after_title_lower.split()) | set(after_text_lower.split())
        ):
            return VerifyResult(
                outcome="success",
                reason="All goal keywords present in current page state",
                confidence=0.7,
            )

        # --- URL changed → progress ---
        if before.url and after.url and before.url != after.url:
            return VerifyResult(
                outcome="retry",
                reason=f"URL changed ({before.url} → {after.url}); continuing toward goal",
                confidence=0.6,
            )

        # --- Title changed → progress ---
        if before.title and after.title and before.title != after.title:
            return VerifyResult(
                outcome="retry",
                reason=f"Title changed ('{before.title}' → '{after.title}'); continuing",
                confidence=0.5,
            )

        # --- Screenshot pixel diff heuristic ---
        if before.screenshot_b64 and after.screenshot_b64:
            changed = _screenshots_differ(before.screenshot_b64, after.screenshot_b64)
            if changed:
                return VerifyResult(
                    outcome="retry",
                    reason="Screen content changed after action; retrying toward goal",
                    confidence=0.45,
                )
            # Screens identical
            return VerifyResult(
                outcome="escalate",
                reason="Screen did not change after action — possible dead-end or wrong target",
                confidence=0.7,
            )

        # No screenshots to compare — retry conservatively
        return VerifyResult(
            outcome="retry",
            reason="No before/after screenshot comparison available; retrying",
            confidence=0.3,
        )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _screenshots_differ(b64_a: str, b64_b: str, threshold: float = 0.01) -> bool:
    """
    Returns True if the two base-64 encoded PNGs differ by more than `threshold`
    fraction of pixels. Uses a lightweight approach that avoids NumPy/PIL where
    possible — falls back to raw byte comparison if PIL is unavailable.
    """
    try:
        from PIL import Image, ImageChops
        import io as _io

        def _load(b64: str) -> Image.Image:
            return Image.open(_io.BytesIO(base64.b64decode(b64))).convert("RGB")

        img_a = _load(b64_a)
        img_b = _load(b64_b)

        if img_a.size != img_b.size:
            return True  # Different sizes → definitely changed

        diff = ImageChops.difference(img_a, img_b)
        bbox = diff.getbbox()
        if bbox is None:
            return False  # Pixel-identical

        # Compute changed area fraction
        changed_area = (bbox[2] - bbox[0]) * (bbox[3] - bbox[1])
        total_area = img_a.width * img_a.height
        return (changed_area / total_area) > threshold

    except ImportError:
        # PIL not available — compare raw base-64 bytes
        return b64_a != b64_b
    except Exception:
        return True  # Assume changed on any error
