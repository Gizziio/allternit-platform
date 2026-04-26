"""
ACU Scratchpad — Persistent per-task learning store.

The bitter-lesson pill for browser agents: don't hand-craft perfect flows
upfront — compound empirical discoveries across runs.

Three-layer pipeline (Siddhi / Phronesis-inspired):
  Layer 1 REFLECTIONS — post-run LLM post-mortem after every task
  Layer 2 SEGMENTS    — recurring tool-call sequences extracted across runs
  Layer 3 SKILLS      — segments that graduate when count/success thresholds
                        are met; injected into system prompt before next run

File layout (~/.allternit/acu/scratchpad/):
  tasks/<task>/
    strategy.md        — hand-editable evolving instruction file (autobrowse-style)
    reflections.json   — list of ReflectionEntry
    segments.json      — list of SegmentEntry
    skills.json        — list of SkillEntry
  global/
    environment.json   — discovered entities: apps, URLs, selectors, shortcuts

All thresholds are data-adaptive — derived from current store state, never
hardcoded (Siddhi design). The data decides when a segment graduates.

Integration points:
  PlanningLoop.run()   — call ScratchpadManager.build_context(task) to inject
                         strategy + skills into the system prompt before running,
                         then call reflect(task, trajectory) after completion.
  MCP tools            — scratchpad_read, scratchpad_write, scratchpad_reflect
  /v1/computer/reflect — gateway endpoint for post-run reflection calls
"""

from __future__ import annotations

import json
import logging
import os
import re
import time
import uuid
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Storage root
# ---------------------------------------------------------------------------

def _scratchpad_root() -> Path:
    root = Path(os.environ.get("ACU_SCRATCHPAD_DIR", Path.home() / ".allternit" / "acu" / "scratchpad"))
    root.mkdir(parents=True, exist_ok=True)
    return root


def _task_dir(task: str) -> Path:
    # Normalize task name to a safe directory name
    safe = re.sub(r"[^\w\-]", "_", task.strip().lower())[:64] or "default"
    d = _scratchpad_root() / "tasks" / safe
    d.mkdir(parents=True, exist_ok=True)
    return d


def _global_dir() -> Path:
    d = _scratchpad_root() / "global"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _load(path: Path, default):
    try:
        return json.loads(path.read_text()) if path.exists() else default
    except Exception:
        return default


def _save(path: Path, data) -> None:
    path.write_text(json.dumps(data, indent=2))


# ---------------------------------------------------------------------------
# Data models
# ---------------------------------------------------------------------------

@dataclass
class ReflectionEntry:
    id: str = field(default_factory=lambda: f"ref_{uuid.uuid4().hex[:8]}")
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    task: str = ""
    session_id: str = ""
    outcome: str = ""          # "success" | "failure" | "partial"
    iterations: int = 0
    actions_taken: List[str] = field(default_factory=list)
    lesson: str = ""           # LLM-generated post-mortem lesson
    error_summary: str = ""
    tokens_used: int = 0
    duration_s: float = 0.0


@dataclass
class SegmentEntry:
    id: str = field(default_factory=lambda: f"seg_{uuid.uuid4().hex[:8]}")
    label: str = ""            # Human-readable name, e.g. "open_gmail_compose"
    precondition: str = ""     # State description before segment
    postcondition: str = ""    # State description after segment
    action_sequence: List[str] = field(default_factory=list)  # e.g. ["navigate", "left_click", "type"]
    occurrences: int = 1
    success_count: int = 0
    success_rate: float = 0.0
    last_seen: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


@dataclass
class SkillEntry:
    id: str = field(default_factory=lambda: f"skill_{uuid.uuid4().hex[:8]}")
    name: str = ""             # Parameterized name, e.g. "navigate_to(url)"
    description: str = ""      # What this skill does and when to use it
    template: str = ""         # Step-by-step instructions (injected into system prompt)
    source_segment_id: str = ""
    graduated_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    use_count: int = 0
    success_rate: float = 1.0


# ---------------------------------------------------------------------------
# Adaptive thresholds (data-derived, no magic numbers)
# ---------------------------------------------------------------------------

def _adaptive_thresholds(segments: List[dict], skills: List[dict], reflections: List[dict]) -> Dict[str, Any]:
    """
    All thresholds derived from current data state.

    GRADUATION_COUNT: minimum occurrences before a segment can graduate.
      Premise: we need enough observations to distinguish luck from skill.
      The Reflexion paper converges at ~5 episodes. With N existing skills,
      the bar rises to prevent premature graduation: max(3, median(occurrences)).

    GRADUATION_SUCCESS_RATE: minimum success rate to graduate.
      Premise: should exceed the current average to ensure new skills are
      better than the existing bar. = max(0.65, mean(existing skill success_rates)).

    REFLECTION_CAP: max reflections stored per task.
      Premise: unique_task_variants * 5 (enough to extract both success/failure
      patterns per variant). Floor = 20.

    SEGMENT_CAP: max segments stored per task.
      Premise: desktop UI primitives are bounded (~40). With variants: 40*3 = 120.
      Data-adaptive: grows only when we have evidence of more variety.
    """
    n_skills = len(skills)
    n_segments = len(segments)
    n_reflections = len(reflections)

    # Graduation count threshold
    occ_counts = [s.get("occurrences", 1) for s in segments] if segments else [1]
    sorted_counts = sorted(occ_counts)
    median_occ = sorted_counts[len(sorted_counts) // 2] if sorted_counts else 1
    graduation_count = max(3, median_occ)

    # Graduation success rate threshold
    sr_values = [s.get("success_rate", 0.0) for s in skills] if skills else [0.0]
    mean_sr = sum(sr_values) / len(sr_values) if sr_values else 0.0
    graduation_sr = max(0.65, mean_sr)

    # Storage caps
    unique_tasks = len(set(r.get("task", "") for r in reflections)) if reflections else 1
    reflection_cap = max(20, unique_tasks * 5)
    segment_cap = max(40, min(120, n_reflections * 2))

    return {
        "graduation_count": graduation_count,
        "graduation_success_rate": graduation_sr,
        "reflection_cap": reflection_cap,
        "segment_cap": segment_cap,
        "n_skills": n_skills,
        "n_segments": n_segments,
        "n_reflections": n_reflections,
    }


# ---------------------------------------------------------------------------
# ScratchpadManager
# ---------------------------------------------------------------------------

class ScratchpadManager:
    """
    Primary interface for the ACU scratchpad.

    Usage:
        sp = ScratchpadManager()

        # Before a run — get context to inject into system prompt
        ctx = sp.build_context("book flight on delta.com")
        system_prompt += ctx

        # After a run — store trajectory and update layers
        await sp.reflect(task="book flight on delta.com",
                         trajectory=loop_result.steps,
                         outcome="success",
                         lesson=None)  # None = generate with LLM
    """

    def __init__(self, model_client=None):
        """
        model_client: optional Anthropic/OpenAI client for LLM reflection.
                      If None, reflection is rule-based (no LLM).
        """
        self._client = model_client

    # ── Public API ────────────────────────────────────────────────────────────

    def build_context(self, task: str) -> str:
        """
        Build a system-prompt injection string for this task.

        Returns a markdown block containing:
          - strategy.md contents (if exists)
          - active skills relevant to this task
          - recent lessons from reflections
          - known environment entities

        Returns empty string if nothing is known yet (first run).
        """
        parts: List[str] = []
        td = _task_dir(task)

        # strategy.md (hand-editable + auto-updated)
        strategy_path = td / "strategy.md"
        if strategy_path.exists():
            strategy = strategy_path.read_text().strip()
            if strategy:
                parts.append(f"## Strategy for this task\n{strategy}")

        # Skills (graduated segments)
        skills = _load(td / "skills.json", [])
        if skills:
            skill_lines = []
            for s in sorted(skills, key=lambda x: x.get("use_count", 0), reverse=True)[:5]:
                skill_lines.append(f"**{s['name']}**: {s['description']}\n{s['template']}")
            parts.append("## Known skills\n" + "\n\n".join(skill_lines))

        # Recent lessons (last 3 reflections)
        reflections = _load(td / "reflections.json", [])
        recent = sorted(reflections, key=lambda r: r.get("timestamp", ""), reverse=True)[:3]
        if recent:
            lessons = [r.get("lesson", "") for r in recent if r.get("lesson")]
            if lessons:
                parts.append("## Lessons from recent runs\n" + "\n".join(f"- {l}" for l in lessons))

        # Global environment entities
        env = _load(_global_dir() / "environment.json", {})
        shortcuts = env.get("shortcuts", {})
        if shortcuts:
            sc_lines = [f"- {k}: {v}" for k, v in list(shortcuts.items())[:10]]
            parts.append("## Known shortcuts\n" + "\n".join(sc_lines))

        if not parts:
            return ""
        return (
            "\n\n---\n## ACU Scratchpad Context\n\n"
            + "\n\n".join(parts)
            + "\n---\n"
        )

    def record_reflection(self, entry: ReflectionEntry) -> None:
        """Store a reflection entry, enforcing the storage cap."""
        td = _task_dir(entry.task)
        path = td / "reflections.json"
        reflections = _load(path, [])
        all_r = _load(_scratchpad_root() / "tasks" / ".all_reflections_index.json", [])

        thresholds = _adaptive_thresholds(
            _load(td / "segments.json", []),
            _load(td / "skills.json", []),
            reflections,
        )
        cap = thresholds["reflection_cap"]

        reflections.append(asdict(entry))
        # Trim oldest if over cap
        if len(reflections) > cap:
            reflections = reflections[-cap:]
        _save(path, reflections)

        # Update global environment with any new entities from the lesson
        self._extract_environment(entry.lesson)

    def update_segments(self, task: str, action_sequence: List[str],
                        precondition: str, postcondition: str,
                        label: str, success: bool) -> None:
        """
        Record a completed action sequence, update or create a segment entry,
        then check graduation.
        """
        td = _task_dir(task)
        path = td / "segments.json"
        segments: List[dict] = _load(path, [])

        # Find existing segment by matching action sequence
        existing = next((s for s in segments if s.get("action_sequence") == action_sequence), None)

        if existing:
            existing["occurrences"] = existing.get("occurrences", 1) + 1
            if success:
                existing["success_count"] = existing.get("success_count", 0) + 1
            existing["success_rate"] = existing["success_count"] / existing["occurrences"]
            existing["last_seen"] = datetime.now(timezone.utc).isoformat()
        else:
            thresholds = _adaptive_thresholds(segments, _load(td / "skills.json", []), _load(td / "reflections.json", []))
            if len(segments) < thresholds["segment_cap"]:
                seg = SegmentEntry(
                    label=label,
                    precondition=precondition,
                    postcondition=postcondition,
                    action_sequence=action_sequence,
                    occurrences=1,
                    success_count=1 if success else 0,
                    success_rate=1.0 if success else 0.0,
                )
                segments.append(asdict(seg))

        _save(path, segments)
        self._check_graduation(task)

    def update_strategy(self, task: str, new_content: str) -> None:
        """Overwrite strategy.md for this task."""
        strategy_path = _task_dir(task) / "strategy.md"
        strategy_path.write_text(new_content)
        logger.info("[scratchpad] strategy updated for task %r", task)

    def append_strategy(self, task: str, heuristic: str) -> None:
        """Append a single heuristic line to strategy.md."""
        strategy_path = _task_dir(task) / "strategy.md"
        existing = strategy_path.read_text() if strategy_path.exists() else ""
        strategy_path.write_text(
            (existing.rstrip() + f"\n- {heuristic.strip()}\n") if existing
            else f"- {heuristic.strip()}\n"
        )

    def get_strategy(self, task: str) -> str:
        p = _task_dir(task) / "strategy.md"
        return p.read_text() if p.exists() else ""

    def get_reflections(self, task: str) -> List[dict]:
        return _load(_task_dir(task) / "reflections.json", [])

    def get_skills(self, task: str) -> List[dict]:
        return _load(_task_dir(task) / "skills.json", [])

    def get_segments(self, task: str) -> List[dict]:
        return _load(_task_dir(task) / "segments.json", [])

    def get_environment(self) -> dict:
        return _load(_global_dir() / "environment.json", {})

    def record_shortcut(self, description: str, shortcut: str) -> None:
        """Record a discovered keyboard shortcut to global environment."""
        env = _load(_global_dir() / "environment.json", {})
        env.setdefault("shortcuts", {})[description] = shortcut
        _save(_global_dir() / "environment.json", env)

    def record_entity(self, entity_type: str, name: str, details: dict) -> None:
        """Record a discovered environment entity (app, URL, selector)."""
        env = _load(_global_dir() / "environment.json", {})
        env.setdefault(entity_type, {})[name] = {**details, "last_seen": datetime.now(timezone.utc).isoformat()}
        _save(_global_dir() / "environment.json", env)

    async def reflect(
        self,
        task: str,
        steps: list,
        outcome: str,
        session_id: str = "",
        duration_s: float = 0.0,
        tokens_used: int = 0,
        error_summary: str = "",
    ) -> ReflectionEntry:
        """
        Run post-task reflection: generate a lesson, store the reflection,
        extract action sequences for segment tracking, check graduation.

        steps: list of LoopStep or dict with action_type/status fields.
        """
        # Extract action sequence from steps
        action_sequence = []
        for step in steps:
            if hasattr(step, "action_type"):
                action_sequence.append(step.action_type)
            elif isinstance(step, dict):
                action_sequence.append(step.get("action_type", step.get("action", "unknown")))

        # Generate lesson
        lesson = await self._generate_lesson(task, steps, outcome, error_summary)

        entry = ReflectionEntry(
            task=task,
            session_id=session_id,
            outcome=outcome,
            iterations=len(steps),
            actions_taken=action_sequence,
            lesson=lesson,
            error_summary=error_summary,
            tokens_used=tokens_used,
            duration_s=duration_s,
        )
        self.record_reflection(entry)

        # Update segment tracking
        if action_sequence:
            self.update_segments(
                task=task,
                action_sequence=action_sequence,
                precondition=f"start of {task}",
                postcondition=f"{outcome} of {task}",
                label=f"{task[:30]}_{outcome}",
                success=(outcome == "success"),
            )

        # Auto-append lesson to strategy if it's concrete enough
        if lesson and outcome in ("success", "partial") and len(lesson) < 200:
            self.append_strategy(task, lesson)

        logger.info("[scratchpad] reflected on task %r outcome=%s lesson=%r", task, outcome, lesson[:80] if lesson else "")
        return entry

    # ── Graduation ────────────────────────────────────────────────────────────

    def _check_graduation(self, task: str) -> None:
        """
        Promote segments that meet adaptive thresholds to skills.
        Runs after every segment update.
        """
        td = _task_dir(task)
        segments = _load(td / "segments.json", [])
        skills: List[dict] = _load(td / "skills.json", [])
        reflections = _load(td / "reflections.json", [])

        t = _adaptive_thresholds(segments, skills, reflections)
        existing_seg_ids = {s.get("source_segment_id") for s in skills}

        graduated_any = False
        for seg in segments:
            seg_id = seg.get("id", "")
            if seg_id in existing_seg_ids:
                continue
            if (seg.get("occurrences", 0) >= t["graduation_count"] and
                    seg.get("success_rate", 0.0) >= t["graduation_success_rate"]):
                skill = SkillEntry(
                    name=_parameterize_label(seg.get("label", task)),
                    description=(
                        f"Proven sub-procedure: {seg.get('label', task)}. "
                        f"Seen {seg['occurrences']}x at {seg['success_rate']:.0%} success."
                    ),
                    template=_sequence_to_template(seg.get("action_sequence", [])),
                    source_segment_id=seg_id,
                )
                skills.append(asdict(skill))
                graduated_any = True
                logger.info(
                    "[scratchpad] GRADUATED segment %r → skill %r (count=%d sr=%.2f)",
                    seg.get("label"), skill.name,
                    seg["occurrences"], seg["success_rate"],
                )

        if graduated_any:
            _save(td / "skills.json", skills)

    # ── Lesson generation ─────────────────────────────────────────────────────

    async def _generate_lesson(
        self, task: str, steps: list, outcome: str, error_summary: str
    ) -> str:
        """
        Generate a one-line lesson from the trajectory.
        Uses LLM if client available; falls back to rule-based extraction.
        """
        if self._client is not None:
            return await self._llm_lesson(task, steps, outcome, error_summary)
        return self._rule_based_lesson(task, steps, outcome, error_summary)

    async def _llm_lesson(self, task: str, steps: list, outcome: str, error: str) -> str:
        try:
            action_log = _summarize_steps(steps)
            prompt = (
                f"Task: {task}\n"
                f"Outcome: {outcome}\n"
                f"Actions taken: {action_log}\n"
                f"Error (if any): {error or 'none'}\n\n"
                "Write exactly ONE concrete, actionable heuristic (≤25 words) that should be "
                "added to the strategy for this task based on what happened. "
                "Focus on what specifically caused success or failure. "
                "Start with a verb. Example: 'Click the Accept button before navigating to avoid modal blocking.'"
            )
            if hasattr(self._client, "messages"):
                # Anthropic SDK
                msg = await self._client.messages.create(
                    model="claude-haiku-4-5-20251001",
                    max_tokens=80,
                    messages=[{"role": "user", "content": prompt}],
                )
                return msg.content[0].text.strip()
            else:
                # OpenAI SDK
                resp = await self._client.chat.completions.create(
                    model="gpt-4o-mini",
                    max_tokens=80,
                    messages=[{"role": "user", "content": prompt}],
                )
                return resp.choices[0].message.content.strip()
        except Exception as exc:
            logger.warning("[scratchpad] LLM reflection failed: %s", exc)
            return self._rule_based_lesson(task, steps, outcome, error)

    @staticmethod
    def _rule_based_lesson(task: str, steps: list, outcome: str, error: str) -> str:
        if outcome == "success":
            n = len(steps)
            return f"Task completed in {n} steps — note the action sequence for next time."
        if error:
            # Extract the most meaningful part of the error
            first_line = error.split("\n")[0][:120]
            return f"Failed with: {first_line} — add explicit wait or fallback."
        return f"Task ended with {outcome} — review trace for improvement opportunities."

    # ── Environment extraction ────────────────────────────────────────────────

    def _extract_environment(self, lesson: str) -> None:
        """Heuristically extract URL, selector, or shortcut mentions from lesson text."""
        if not lesson:
            return
        env = _load(_global_dir() / "environment.json", {})
        # URLs
        for url in re.findall(r"https?://[^\s\"']+", lesson):
            env.setdefault("urls", {})[url] = {"last_seen": datetime.now(timezone.utc).isoformat()}
        # Keyboard shortcuts like Cmd+K, Ctrl+Shift+N
        for sc in re.findall(r"(?:Cmd|Ctrl|Alt|Shift)\+[^\s.,]+", lesson, re.IGNORECASE):
            env.setdefault("shortcuts", {})[sc] = {"last_seen": datetime.now(timezone.utc).isoformat()}
        _save(_global_dir() / "environment.json", env)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _summarize_steps(steps: list) -> str:
    items = []
    for i, s in enumerate(steps[:20]):
        if hasattr(s, "action_type"):
            items.append(f"{i+1}. {s.action_type}({getattr(s, 'action_target', '')})")
        elif isinstance(s, dict):
            items.append(f"{i+1}. {s.get('action_type', s.get('action', '?'))}")
    return " → ".join(items) if items else "no steps recorded"


def _parameterize_label(label: str) -> str:
    """Convert 'open_gmail_compose_success' → 'open_gmail_compose()'"""
    clean = re.sub(r"_(success|failure|partial)$", "", label)
    clean = re.sub(r"_+", "_", clean).strip("_")
    return f"{clean}()"


def _sequence_to_template(sequence: List[str]) -> str:
    """Convert ['navigate', 'left_click', 'type'] into step-by-step instructions."""
    steps = []
    for i, action in enumerate(sequence, 1):
        desc = {
            "screenshot": "Take a screenshot to observe current state",
            "navigate": "Navigate to the target URL",
            "left_click": "Click the target element",
            "type": "Type the required text",
            "fill": "Fill the form field with required value",
            "key": "Press the keyboard shortcut",
            "scroll": "Scroll to reveal the target",
            "extract": "Extract the required content",
            "wait": "Wait for the page/element to be ready",
        }.get(action, f"Execute: {action}")
        steps.append(f"{i}. {desc}")
    return "\n".join(steps)


# ---------------------------------------------------------------------------
# Module-level singleton
# ---------------------------------------------------------------------------

_default_scratchpad: Optional[ScratchpadManager] = None


def get_scratchpad(model_client=None) -> ScratchpadManager:
    """Return (or create) the module-level ScratchpadManager singleton."""
    global _default_scratchpad
    if _default_scratchpad is None:
        _default_scratchpad = ScratchpadManager(model_client=model_client)
    return _default_scratchpad
