"""
Allternit Computer Use — Pluggable Run Monitor

A monitor observes the planning loop after each OBSERVE phase and can
pause the run for human review. Interface (swap-in point for a VLM
classifier later):

    class MyMonitor:
        async def evaluate(self, *, screenshot_b64: str, extracted_text: str,
                           action_type: str, action_target: str,
                           step: int, run_id: str, session_id: str,
                           history: list) -> Optional[MonitorDecision]: ...

Return None (or a continue decision) to let the run proceed; return
``MonitorDecision.pause(reason=...)`` to pause the run with an
``approval.required`` event (kind ``monitor_flag``). The planning loop
then consults its approval callback: approve resumes, deny stops the run
with stop_reason MONITOR_FLAG (status ``needs_approval``).

Monitors shipped here:

  * ``HeuristicMonitor`` (default) — two cheap checks:
      - Prompt-injection keyword scan over extracted page/text content.
      - Rapid identical-action loop detection (same action+target repeated
        N consecutive times — a sign the model is stuck).

  * ``VLMMonitor`` — optional vision-language-model classifier. Enable it
    by setting env vars and passing it to the planning loop:

        ACU_MONITOR_VLM_PROVIDER   provider key, e.g. "openai", "ollama"
                                   (required — without it the monitor is
                                   inert and always continues)
        ACU_MONITOR_VLM_MODEL      model name (provider default if unset)
        ACU_MONITOR_VLM_ENDPOINT   base URL override for the chat endpoint

        from core.monitor import VLMMonitor
        loop = PlanningLoop(..., monitor=VLMMonitor())

    Each evaluation sends the current screenshot plus the pending action
    context to the provider's chat-completions endpoint and expects a
    single-line verdict: ``continue`` or ``pause: <reason>``. A ``pause``
    verdict becomes a MonitorDecision.pause with the reason attached.
    Heuristic checks run first as a cheap pre-filter; any provider or
    network error is logged and treated as continue — a monitor failure
    never breaks the run.
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional, Protocol, Sequence, runtime_checkable

logger = logging.getLogger(__name__)

DEFAULT_INJECTION_PATTERNS: Sequence[str] = (
    "ignore previous instructions",
    "ignore all previous instructions",
    "disregard previous instructions",
    "forget your instructions",
    "system prompt",
    "you are now",
    "new instructions:",
    "override your",
    "jailbreak",
    "do anything now",
    "developer mode",
    "reveal your instructions",
    "print your instructions",
)

DEFAULT_REPEAT_THRESHOLD = 5


@dataclass
class MonitorDecision:
    """Outcome of a monitor evaluation."""
    action: str  # "continue" | "pause"
    reason: str = ""
    flag: str = ""  # machine-readable flag type, e.g. "prompt_injection"

    @classmethod
    def pause(cls, reason: str, flag: str = "monitor_flag") -> "MonitorDecision":
        return cls(action="pause", reason=reason, flag=flag)

    @classmethod
    def continue_(cls) -> "MonitorDecision":
        return cls(action="continue")


@runtime_checkable
class Monitor(Protocol):
    """Monitor interface — implement and pass to PlanningLoop(monitor=...)."""

    async def evaluate(
        self,
        *,
        screenshot_b64: str,
        extracted_text: str,
        action_type: str,
        action_target: str,
        step: int,
        run_id: str,
        session_id: str,
        history: List[Dict[str, Any]],
    ) -> Optional[MonitorDecision]: ...


class HeuristicMonitor:
    """Default monitor: injection keyword scan + identical-action loop detection."""

    def __init__(
        self,
        injection_patterns: Sequence[str] = DEFAULT_INJECTION_PATTERNS,
        repeat_threshold: int = DEFAULT_REPEAT_THRESHOLD,
    ) -> None:
        self._patterns = tuple(p.lower() for p in injection_patterns)
        self._repeat_threshold = repeat_threshold

    async def evaluate(
        self,
        *,
        screenshot_b64: str,
        extracted_text: str,
        action_type: str,
        action_target: str,
        step: int,
        run_id: str,
        session_id: str,
        history: List[Dict[str, Any]],
    ) -> Optional[MonitorDecision]:
        # 1. Prompt-injection keyword scan on extracted text.
        if extracted_text:
            lowered = extracted_text.lower()
            for pattern in self._patterns:
                if pattern in lowered:
                    return MonitorDecision.pause(
                        reason=f"page content matched prompt-injection pattern {pattern!r}",
                        flag="prompt_injection",
                    )

        # 2. Rapid identical-action loop: same action+target across recent history.
        recent = [h for h in history if isinstance(h, dict)][-self._repeat_threshold:]
        if len(recent) >= self._repeat_threshold:
            signatures = {
                (h.get("action_type", ""), h.get("action_target", "")) for h in recent
            }
            if len(signatures) == 1 and action_type == recent[-1].get("action_type", ""):
                return MonitorDecision.pause(
                    reason=(
                        f"identical action {action_type!r} on {action_target!r} repeated "
                        f"{self._repeat_threshold}+ times — loop detected"
                    ),
                    flag="action_loop",
                )
        return None


# ---------------------------------------------------------------------------
# VLM-backed monitor (optional, configured via env)
# ---------------------------------------------------------------------------

#: Default chat-completions base URL per provider key.
_VLM_DEFAULT_ENDPOINTS = {
    "openai": "https://api.openai.com/v1",
    "ollama": "http://localhost:11434/v1",
}

#: Default model per provider key.
_VLM_DEFAULT_MODELS = {
    "openai": "gpt-4o-mini",
    "ollama": "llama3.2-vision",
}

_VLM_SYSTEM_PROMPT = (
    "You are a safety monitor for a computer-use automation agent. You receive "
    "a screenshot of the current screen and a description of the action the "
    "agent is about to take. Reply with exactly one line: "
    "'continue' if the action is safe to proceed, or 'pause: <short reason>' "
    "if the action looks dangerous, irreversible, or off-task. "
    "No other output."
)


def _default_vlm_client(provider: str, model: str, endpoint: str, timeout_s: float):
    """Build the default async verdict client (OpenAI-style chat completions).

    Uses only the stdlib (urllib) so the monitor adds no hard dependency;
    the request runs in a worker thread to stay async-friendly.
    """
    import asyncio
    import json as _json
    import urllib.request

    url = endpoint.rstrip("/") + "/chat/completions"
    api_key = os.environ.get("ACU_MONITOR_VLM_API_KEY") or (
        os.environ.get("OPENAI_API_KEY", "") if provider == "openai" else ""
    )

    async def client(prompt: str, screenshot_b64: str) -> str:
        content: List[Dict[str, Any]] = [{"type": "text", "text": prompt}]
        if screenshot_b64:
            content.append({
                "type": "image_url",
                "image_url": {"url": f"data:image/png;base64,{screenshot_b64}"},
            })
        body = _json.dumps({
            "model": model,
            "messages": [
                {"role": "system", "content": _VLM_SYSTEM_PROMPT},
                {"role": "user", "content": content},
            ],
            "temperature": 0,
            "max_tokens": 60,
        }).encode()

        def _post() -> str:
            req = urllib.request.Request(
                url, data=body,
                headers={
                    "Content-Type": "application/json",
                    **({"Authorization": f"Bearer {api_key}"} if api_key else {}),
                },
            )
            with urllib.request.urlopen(req, timeout=timeout_s) as resp:
                payload = _json.loads(resp.read())
            return payload["choices"][0]["message"]["content"]

        return await asyncio.to_thread(_post)

    return client


class VLMMonitor:
    """Optional VLM-backed monitor behind the same Monitor protocol.

    Runs the heuristic checks first (cheap pre-filter, same behavior as
    HeuristicMonitor), then asks a vision-language model to classify
    screenshot + pending action. The model replies with a single-line
    verdict: ``continue`` or ``pause: <reason>``.

    Configuration (env vars, read at construction):
      ACU_MONITOR_VLM_PROVIDER — provider key ("openai", "ollama", ...).
                                 If unset, the monitor is inert: every
                                 evaluation returns None (continue).
      ACU_MONITOR_VLM_MODEL    — model name (provider default if unset).
      ACU_MONITOR_VLM_ENDPOINT — base URL override for /chat/completions.
      ACU_MONITOR_VLM_API_KEY  — API key (falls back to OPENAI_API_KEY for
                                 the "openai" provider).

    A ``client`` callable (async (prompt, screenshot_b64) -> verdict str)
    can be injected for tests or non-OpenAI-compatible providers.
    Provider/network/parse errors are logged and treated as continue —
    a monitor failure never breaks the run.
    """

    def __init__(
        self,
        provider: Optional[str] = None,
        model: Optional[str] = None,
        endpoint: Optional[str] = None,
        client: Optional[Callable[[str, str], Any]] = None,
        timeout_s: float = 30.0,
        heuristic: Optional[HeuristicMonitor] = None,
    ) -> None:
        self._provider = provider or os.environ.get("ACU_MONITOR_VLM_PROVIDER", "")
        self._model = model or os.environ.get("ACU_MONITOR_VLM_MODEL") or (
            _VLM_DEFAULT_MODELS.get(self._provider, "") if self._provider else ""
        )
        self._endpoint = endpoint or os.environ.get("ACU_MONITOR_VLM_ENDPOINT") or (
            _VLM_DEFAULT_ENDPOINTS.get(self._provider, "") if self._provider else ""
        )
        if client is not None:
            self._client = client
        elif self._provider and self._endpoint:
            self._client = _default_vlm_client(
                self._provider, self._model, self._endpoint, timeout_s
            )
        else:
            self._client = None
        self._heuristic = heuristic if heuristic is not None else HeuristicMonitor()

    @property
    def active(self) -> bool:
        """True when a VLM client is configured (provider + endpoint, or injected)."""
        return self._client is not None

    async def evaluate(
        self,
        *,
        screenshot_b64: str,
        extracted_text: str,
        action_type: str,
        action_target: str,
        step: int,
        run_id: str,
        session_id: str,
        history: List[Dict[str, Any]],
    ) -> Optional[MonitorDecision]:
        # 1. Cheap heuristic pre-filter (injection scan + loop detection).
        decision = await self._heuristic.evaluate(
            screenshot_b64=screenshot_b64,
            extracted_text=extracted_text,
            action_type=action_type,
            action_target=action_target,
            step=step,
            run_id=run_id,
            session_id=session_id,
            history=history,
        )
        if decision is not None:
            return decision

        # 2. VLM verdict. Inert (no provider configured) → continue.
        if self._client is None:
            return None

        prompt = (
            f"Run {run_id} step {step}: the agent is about to perform "
            f"action {action_type!r} on target {action_target!r}.\n"
            f"Extracted page text (truncated):\n{extracted_text[:2000]}\n\n"
            "Verdict line:"
        )
        try:
            verdict = await self._client(prompt, screenshot_b64)
        except Exception as exc:
            logger.warning("[vlm-monitor] provider call failed, continuing: %s", exc)
            return None

        line = (verdict or "").strip().splitlines()[0].strip().lower() if verdict else ""
        if line.startswith("pause"):
            parts = (verdict or "").strip().split(":", 1)
            reason_text = parts[1].strip() if len(parts) > 1 else "VLM flagged the pending action"
            logger.info("[vlm-monitor] paused run %s at step %d: %s", run_id, step, reason_text)
            return MonitorDecision.pause(
                reason=f"VLM monitor: {reason_text}",
                flag="vlm_flag",
            )
        if not line.startswith("continue"):
            logger.warning(
                "[vlm-monitor] unparseable verdict %r from provider, continuing",
                verdict,
            )
        return None
