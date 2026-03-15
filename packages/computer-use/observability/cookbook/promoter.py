"""
Cookbook promotion pipeline - CU-034

Promotes successful runs to reusable cookbook entries.
Links to conformance scenarios and planner prompts.
"""

import json
from dataclasses import dataclass, field, asdict
from datetime import datetime
from pathlib import Path
from typing import Optional

try:
    from ..recorder.frame import RunTimeline, ActionFrame, FrameStatus
    from ..analyzer.analyzer import AnalysisResult
except ImportError:
    # Allow direct import for tests
    from recorder.frame import RunTimeline, ActionFrame, FrameStatus
    from analyzer.analyzer import AnalysisResult


@dataclass
class CookbookEntry:
    """
    A reusable cookbook entry from a successful run.
    
    Contains:
    - Task description (natural language)
    - Action sequence (normalized)
    - Expected artifacts
    - Replay reference
    - Planner prompt example
    - Failure patterns to avoid
    """
    
    # Identity
    id: str
    created_at: datetime = field(default_factory=datetime.utcnow)
    source_run_id: str = ""
    
    # Task definition
    task_description: str = ""  # Natural language description
    task_category: str = ""  # "form_filling", "data_extraction", "navigation", etc.
    complexity: str = "medium"  # "simple", "medium", "complex"
    
    # Action sequence
    actions: list[dict] = field(default_factory=list)
    total_steps: int = 0
    expected_duration_ms: int = 0
    
    # References
    replay_gif_path: Optional[str] = None
    replay_video_path: Optional[str] = None
    timeline_path: Optional[str] = None
    analysis_path: Optional[str] = None
    
    # Planner resources
    example_prompt: str = ""  # Example user prompt that triggers this
    system_prompt_addition: str = ""  # Task-specific guidance
    
    # Quality indicators
    success_count: int = 0  # Times this pattern has succeeded
    failure_patterns: list[str] = field(default_factory=list)  # Known issues
    stability_score: float = 0.0  # 0-1 based on repeated success
    
    # Tags
    tags: list[str] = field(default_factory=list)
    
    # Conformance link
    conformance_scenario: Optional[str] = None  # Link to conformance test
    
    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "created_at": self.created_at.isoformat(),
            "source_run_id": self.source_run_id,
            "task_description": self.task_description,
            "task_category": self.task_category,
            "complexity": self.complexity,
            "actions": self.actions,
            "total_steps": self.total_steps,
            "expected_duration_ms": self.expected_duration_ms,
            "replay_gif_path": self.replay_gif_path,
            "replay_video_path": self.replay_video_path,
            "example_prompt": self.example_prompt,
            "success_count": self.success_count,
            "stability_score": self.stability_score,
            "tags": self.tags,
            "conformance_scenario": self.conformance_scenario,
        }
    
    def to_prompt_example(self) -> str:
        """Generate a prompt example for planner training."""
        lines = [
            f"<example>",
            f"<user>{self.example_prompt}</user>",
            f"<assistant>",
            f"I'll help you {self.task_description}. Here's my approach:",
            "",
        ]
        
        for i, action in enumerate(self.actions, 1):
            lines.append(f"{i}. {action['action']}: {action.get('target', action.get('goal', ''))}")
        
        lines.extend([
            "",
            f"This should complete in approximately {self.expected_duration_ms // 1000} seconds.",
            "</assistant>",
            "</example>",
        ])
        
        return "\n".join(lines)


@dataclass
class PromotionCriteria:
    """Criteria for promoting a run to cookbook."""
    
    min_steps: int = 2  # At least this many actions
    max_steps: int = 20  # Not too complex
    min_success_rate: float = 1.0  # Must be perfect (for now)
    max_slow_steps: int = 2  # Allow some slow steps
    min_duration_ms: int = 1000  # At least 1 second (not trivial)
    max_duration_ms: int = 120000  # Under 2 minutes
    
    required_tags: list[str] = field(default_factory=list)
    excluded_categories: list[str] = field(default_factory=list)


class CookbookPromoter:
    """
    Promotes successful runs to cookbook entries.
    
    Usage:
        promoter = CookbookPromoter(repository)
        
        if promoter.should_promote(timeline, analysis):
            entry = await promoter.promote(
                timeline=timeline,
                analysis=analysis,
                task_description="Fill out a contact form",
                example_prompt="Go to example.com and fill out the contact form"
            )
    """
    
    def __init__(
        self,
        repository: 'CookbookRepository',
        criteria: Optional[PromotionCriteria] = None,
        storage_path: str = "/tmp/a2r-cookbook",
    ):
        self.repository = repository
        self.criteria = criteria or PromotionCriteria()
        self.storage_path = Path(storage_path)
        self.storage_path.mkdir(parents=True, exist_ok=True)
    
    def should_promote(self, timeline: RunTimeline, analysis: AnalysisResult) -> bool:
        """
        Determine if a run should be promoted to cookbook.
        """
        c = self.criteria
        
        # Success rate
        if analysis.success_rate < c.min_success_rate:
            return False
        
        # Step count
        if not (c.min_steps <= timeline.total_steps <= c.max_steps):
            return False
        
        # Duration
        if not (c.min_duration_ms <= timeline.total_duration_ms <= c.max_duration_ms):
            return False
        
        # Slow steps
        if len(analysis.slow_steps) > c.max_slow_steps:
            return False
        
        # Not already a failure pattern
        if analysis.failure_patterns:
            return False
        
        return True
    
    async def promote(
        self,
        timeline: RunTimeline,
        analysis: AnalysisResult,
        task_description: str,
        example_prompt: str,
        task_category: str = "",
        tags: Optional[list[str]] = None,
        copy_replay: bool = True,
    ) -> CookbookEntry:
        """
        Promote a run to cookbook entry.
        
        Args:
            timeline: The recorded run timeline
            analysis: Analysis result
            task_description: Natural language description of task
            example_prompt: Example user prompt that triggers this
            task_category: Category like "form_filling", "navigation"
            tags: Additional tags for discovery
            copy_replay: Whether to copy replay files to cookbook storage
        """
        entry_id = f"cookbook_{timeline.run_id}"
        
        # Determine complexity
        complexity = self._assess_complexity(timeline)
        
        # Copy replay files if requested
        replay_gif = None
        replay_video = None
        if copy_replay:
            replay_gif, replay_video = await self._copy_replay_files(timeline, entry_id)
        
        # Build action sequence (normalized)
        actions = self._normalize_actions(timeline.frames)
        
        # Generate system prompt addition
        system_addition = self._generate_system_addition(timeline, analysis)
        
        # Create entry
        entry = CookbookEntry(
            id=entry_id,
            source_run_id=timeline.run_id,
            task_description=task_description,
            task_category=task_category,
            complexity=complexity,
            actions=actions,
            total_steps=timeline.total_steps,
            expected_duration_ms=timeline.total_duration_ms,
            replay_gif_path=replay_gif or timeline.replay_gif_path,
            replay_video_path=replay_video or timeline.replay_video_path,
            timeline_path=str(self.storage_path / f"{entry_id}_timeline.json"),
            analysis_path=str(self.storage_path / f"{entry_id}_analysis.json"),
            example_prompt=example_prompt,
            system_prompt_addition=system_addition,
            success_count=1,
            failure_patterns=[f.category for f in analysis.failure_patterns],
            stability_score=analysis.golden_path_score,
            tags=tags or [],
        )
        
        # Save supporting files
        await self._save_supporting_files(entry, timeline, analysis)
        
        # Store in repository
        await self.repository.save(entry)
        
        return entry
    
    def _assess_complexity(self, timeline: RunTimeline) -> str:
        """Assess task complexity."""
        steps = timeline.total_steps
        duration_sec = timeline.total_duration_ms / 1000
        
        if steps <= 3 and duration_sec < 10:
            return "simple"
        elif steps <= 8 and duration_sec < 60:
            return "medium"
        else:
            return "complex"
    
    async def _copy_replay_files(
        self,
        timeline: RunTimeline,
        entry_id: str,
    ) -> tuple[Optional[str], Optional[str]]:
        """Copy replay files to cookbook storage."""
        import shutil
        
        gif_dest = None
        video_dest = None
        
        if timeline.replay_gif_path and Path(timeline.replay_gif_path).exists():
            gif_dest = str(self.storage_path / f"{entry_id}.gif")
            shutil.copy2(timeline.replay_gif_path, gif_dest)
        
        if timeline.replay_video_path and Path(timeline.replay_video_path).exists():
            video_dest = str(self.storage_path / f"{entry_id}.webm")
            shutil.copy2(timeline.replay_video_path, video_dest)
        
        return gif_dest, video_dest
    
    def _normalize_actions(self, frames: list[ActionFrame]) -> list[dict]:
        """Normalize action frames to cookbook format."""
        return [
            {
                "step": f.step_index,
                "action": f.action.value,
                "target": f.target,
                "goal": f.goal,
                "parameters": self._sanitize_parameters(f.parameters),
            }
            for f in frames
        ]
    
    def _sanitize_parameters(self, params: dict) -> dict:
        """Remove sensitive data from parameters."""
        # Remove any potentially sensitive keys
        sensitive_keys = {'password', 'secret', 'token', 'api_key', 'auth'}
        return {
            k: v for k, v in params.items()
            if not any(sk in k.lower() for sk in sensitive_keys)
        }
    
    def _generate_system_addition(
        self,
        timeline: RunTimeline,
        analysis: AnalysisResult,
    ) -> str:
        """Generate system prompt addition for this task type."""
        lines = [f"For tasks like '{analysis.summary}', use this approach:"]
        
        for tip in analysis.planner_tips[:3]:  # Top 3 tips
            lines.append(f"- {tip}")
        
        if analysis.slow_steps:
            lines.append(f"- Note: This typically takes {timeline.total_duration_ms // 1000}s")
        
        return "\n".join(lines)
    
    async def _save_supporting_files(
        self,
        entry: CookbookEntry,
        timeline: RunTimeline,
        analysis: AnalysisResult,
    ) -> None:
        """Save timeline and analysis files."""
        # Save timeline
        if entry.timeline_path:
            with open(entry.timeline_path, 'w') as f:
                json.dump({
                    "run_id": timeline.run_id,
                    "frames": [f.model_dump() for f in timeline.frames],
                }, f, indent=2, default=str)
        
        # Save analysis
        if entry.analysis_path:
            with open(entry.analysis_path, 'w') as f:
                json.dump(analysis.to_dict(), f, indent=2)


class FailureModeCapture:
    """
    Capture failure patterns for negative examples in cookbooks.
    
    Useful for:
    - Training planners on what NOT to do
    - Conformance negative test cases
    - Regression testing
    """
    
    def __init__(self, storage_path: str = "/tmp/a2r-failures"):
        self.storage_path = Path(storage_path)
        self.storage_path.mkdir(parents=True, exist_ok=True)
    
    async def capture(
        self,
        timeline: RunTimeline,
        analysis: AnalysisResult,
        task_description: str,
    ) -> dict:
        """Capture a failure mode."""
        failure_id = f"failure_{timeline.run_id}"
        
        failure_record = {
            "id": failure_id,
            "captured_at": datetime.utcnow().isoformat(),
            "task_description": task_description,
            "run_id": timeline.run_id,
            "total_steps": timeline.total_steps,
            "failed_at_step": timeline.frames[-1].step_index if timeline.frames else None,
            "failure_patterns": [
                {
                    "step": f.step_index,
                    "action": f.action,
                    "error_code": f.error_code,
                    "category": f.category,
                    "suggestion": f.suggestion,
                }
                for f in analysis.failure_patterns
            ],
            "planner_tips": analysis.planner_tips,
            "what_went_wrong": self._describe_failure(timeline, analysis),
            "how_to_fix": self._suggest_fixes(analysis),
        }
        
        # Save failure record
        path = self.storage_path / f"{failure_id}.json"
        with open(path, 'w') as f:
            json.dump(failure_record, f, indent=2)
        
        return failure_record
    
    def _describe_failure(
        self,
        timeline: RunTimeline,
        analysis: AnalysisResult,
    ) -> str:
        """Generate human-readable failure description."""
        if not analysis.failure_patterns:
            return "Unknown failure"
        
        f = analysis.failure_patterns[0]
        return f"Failed at step {f.step_index} ({f.action}): {f.error_code}"
    
    def _suggest_fixes(self, analysis: AnalysisResult) -> list[str]:
        """Generate fix suggestions."""
        return [f.suggestion for f in analysis.failure_patterns]
