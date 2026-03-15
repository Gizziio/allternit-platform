"""
Run analyzer - CU-033

Analyzes recorded runs to generate:
- What happened (timeline summary)
- Where it slowed down (performance issues)
- What failed (failure patterns)
- Suggested fixes (recommendations)
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Optional

try:
    from ..recorder.frame import RunTimeline, ActionFrame, FrameStatus, ActionType
except ImportError:
    # Allow direct import for tests
    from recorder.frame import RunTimeline, ActionFrame, FrameStatus, ActionType


@dataclass
class PerformanceIssue:
    """A performance issue detected in a run."""
    step_index: int
    action: str
    duration_ms: int
    threshold_ms: int
    severity: str  # "warning" | "critical"
    description: str


@dataclass
class FailurePattern:
    """A failure pattern detected in a run."""
    step_index: int
    action: str
    error_code: str
    error_message: str
    category: str  # "navigation", "selector", "timeout", "unknown"
    recoverable: bool
    suggestion: str


@dataclass
class GoldenPathCandidate:
    """A successful run that could be promoted to cookbook."""
    run_id: str
    score: float  # 0-1, higher is better
    reasons: list[str]
    action_count: int
    total_duration_ms: int


@dataclass
class AnalysisResult:
    """Complete analysis of a run."""
    
    # Identity
    run_id: str
    session_id: str
    analyzed_at: datetime = field(default_factory=datetime.utcnow)
    
    # Summary
    summary: str = ""  # Human-readable summary
    total_steps: int = 0
    success_rate: float = 0.0
    total_duration_ms: int = 0
    
    # Issues
    performance_issues: list[PerformanceIssue] = field(default_factory=list)
    failure_patterns: list[FailurePattern] = field(default_factory=list)
    slow_steps: list[dict] = field(default_factory=list)
    
    # Assessment
    is_golden_path_candidate: bool = False
    golden_path_score: float = 0.0
    golden_path_reasons: list[str] = field(default_factory=list)
    
    # Suggestions
    suggested_fixes: list[dict] = field(default_factory=list)
    planner_tips: list[str] = field(default_factory=list)  # Tips for system prompt
    
    # Replay
    has_replay: bool = False
    replay_path: Optional[str] = None
    
    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary."""
        return {
            "run_id": self.run_id,
            "session_id": self.session_id,
            "analyzed_at": self.analyzed_at.isoformat(),
            "summary": self.summary,
            "total_steps": self.total_steps,
            "success_rate": self.success_rate,
            "total_duration_ms": self.total_duration_ms,
            "performance_issues": [
                {
                    "step": p.step_index,
                    "action": p.action,
                    "duration_ms": p.duration_ms,
                    "severity": p.severity,
                    "description": p.description,
                }
                for p in self.performance_issues
            ],
            "failure_patterns": [
                {
                    "step": f.step_index,
                    "action": f.action,
                    "error_code": f.error_code,
                    "category": f.category,
                    "recoverable": f.recoverable,
                    "suggestion": f.suggestion,
                }
                for f in self.failure_patterns
            ],
            "is_golden_path_candidate": self.is_golden_path_candidate,
            "golden_path_score": self.golden_path_score,
            "golden_path_reasons": self.golden_path_reasons,
            "suggested_fixes": self.suggested_fixes,
            "planner_tips": self.planner_tips,
            "has_replay": self.has_replay,
            "replay_path": self.replay_path,
        }


class RunAnalyzer:
    """
    Analyzes run timelines to generate insights.
    
    Usage:
        analyzer = RunAnalyzer()
        result = await analyzer.analyze(timeline)
        
        print(result.summary)
        for issue in result.performance_issues:
            print(f"Slow step {issue.step_index}: {issue.description}")
    """
    
    # Thresholds
    SLOW_STEP_MS = 5000      # 5 seconds
    VERY_SLOW_STEP_MS = 15000  # 15 seconds
    MAX_RETRIES = 3
    
    def __init__(self):
        self.failure_categories = {
            "NAVIGATION_ERROR": "navigation",
            "DNS_ERROR": "navigation",
            "SELECTOR_ERROR": "selector",
            "TIMEOUT": "timeout",
            "SCREENSHOT_ERROR": "screenshot",
            "EXTRACT_ERROR": "extraction",
        }
    
    async def analyze(self, timeline: RunTimeline) -> AnalysisResult:
        """
        Analyze a run timeline and generate comprehensive report.
        """
        result = AnalysisResult(
            run_id=timeline.run_id,
            session_id=timeline.session_id,
            total_steps=timeline.total_steps,
            total_duration_ms=timeline.total_duration_ms,
        )
        
        # Calculate success rate
        if timeline.total_steps > 0:
            result.success_rate = timeline.completed_steps / timeline.total_steps
        
        # Analyze each frame
        for frame in timeline.frames:
            self._analyze_frame(frame, result)
        
        # Generate summary
        result.summary = self._generate_summary(timeline, result)
        
        # Check for golden path candidacy
        self._assess_golden_path(timeline, result)
        
        # Generate planner tips
        result.planner_tips = self._generate_planner_tips(result)
        
        return result
    
    def _analyze_frame(self, frame: ActionFrame, result: AnalysisResult) -> None:
        """Analyze a single frame for issues."""
        
        # Performance analysis
        if frame.duration_ms:
            if frame.duration_ms > self.VERY_SLOW_STEP_MS:
                result.performance_issues.append(PerformanceIssue(
                    step_index=frame.step_index,
                    action=frame.action.value,
                    duration_ms=frame.duration_ms,
                    threshold_ms=self.VERY_SLOW_STEP_MS,
                    severity="critical",
                    description=f"Very slow {frame.action.value}: {frame.duration_ms}ms",
                ))
            elif frame.duration_ms > self.SLOW_STEP_MS:
                result.performance_issues.append(PerformanceIssue(
                    step_index=frame.step_index,
                    action=frame.action.value,
                    duration_ms=frame.duration_ms,
                    threshold_ms=self.SLOW_STEP_MS,
                    severity="warning",
                    description=f"Slow {frame.action.value}: {frame.duration_ms}ms",
                ))
            
            # Track slow steps for summary
            if frame.duration_ms > self.SLOW_STEP_MS:
                result.slow_steps.append({
                    "step": frame.step_index,
                    "action": frame.action.value,
                    "duration_ms": frame.duration_ms,
                })
        
        # Failure analysis
        if frame.status == FrameStatus.FAILED and frame.error:
            error_code = frame.error.get("code", "UNKNOWN")
            category = self._categorize_error(error_code)
            
            result.failure_patterns.append(FailurePattern(
                step_index=frame.step_index,
                action=frame.action.value,
                error_code=error_code,
                error_message=frame.error.get("message", ""),
                category=category,
                recoverable=self._is_recoverable(category),
                suggestion=self._suggest_fix(category, frame),
            ))
    
    def _categorize_error(self, error_code: str) -> str:
        """Categorize an error code."""
        return self.failure_categories.get(error_code, "unknown")
    
    def _is_recoverable(self, category: str) -> bool:
        """Determine if an error category is typically recoverable."""
        return category in ["selector", "timeout"]
    
    def _suggest_fix(self, category: str, frame: ActionFrame) -> str:
        """Generate a fix suggestion based on error category."""
        suggestions = {
            "navigation": f"Check URL accessibility and network connectivity. Target: {frame.target}",
            "selector": f"Verify selector exists and is stable. Try waiting for element. Target: {frame.target}",
            "timeout": f"Increase timeout or check for slow-loading elements. Target: {frame.target}",
            "screenshot": "Check browser state and retry.",
            "extraction": "Verify page structure matches expected format.",
            "unknown": "Review error details and retry with different approach.",
        }
        return suggestions.get(category, suggestions["unknown"])
    
    def _generate_summary(self, timeline: RunTimeline, result: AnalysisResult) -> str:
        """Generate human-readable summary."""
        parts = []
        
        # Overall status
        if timeline.failed_steps == 0:
            parts.append(f"✓ Run completed successfully: {timeline.completed_steps} steps")
        else:
            parts.append(f"✗ Run failed: {timeline.completed_steps}/{timeline.total_steps} steps completed")
        
        # Duration
        duration_sec = timeline.total_duration_ms / 1000
        parts.append(f"Total time: {duration_sec:.1f}s")
        
        # Slow steps
        if result.slow_steps:
            parts.append(f"Slow steps: {len(result.slow_steps)} (>{self.SLOW_STEP_MS}ms)")
        
        # Failures
        if result.failure_patterns:
            categories = set(f.category for f in result.failure_patterns)
            parts.append(f"Issues: {', '.join(categories)}")
        
        return " | ".join(parts)
    
    def _assess_golden_path(self, timeline: RunTimeline, result: AnalysisResult) -> None:
        """Assess if this run is a good candidate for cookbook promotion."""
        score = 0.0
        reasons = []
        
        # Minimum steps required (trivial runs don't qualify)
        if timeline.total_steps < 2:
            result.is_golden_path_candidate = False
            result.golden_path_score = 0.0
            result.golden_path_reasons = ["Too few steps (minimum 2 required)"]
            return
        
        # All steps completed
        if timeline.failed_steps == 0:
            score += 0.4
            reasons.append("All steps completed successfully")
        
        # No slow steps
        if not result.slow_steps:
            score += 0.3
            reasons.append("No slow steps")
        
        # Reasonable duration (not too fast, not too slow)
        duration_sec = timeline.total_duration_ms / 1000
        if 1 < duration_sec < 60:
            score += 0.2
            reasons.append(f"Reasonable duration ({duration_sec:.1f}s)")
        
        # Multiple steps (not trivial)
        if timeline.total_steps >= 3:
            score += 0.1
            reasons.append(f"Complex workflow ({timeline.total_steps} steps)")
        
        result.is_golden_path_candidate = score >= 0.7
        result.golden_path_score = score
        result.golden_path_reasons = reasons
    
    def _generate_planner_tips(self, result: AnalysisResult) -> list[str]:
        """Generate tips for improving planner system prompt."""
        tips = []
        
        # From failures
        for failure in result.failure_patterns:
            if failure.category == "selector":
                tips.append(
                    "When clicking elements, prefer stable selectors like ID or data-testid "
                    "over XPath or positional selectors."
                )
            elif failure.category == "timeout":
                tips.append(
                    "For slow-loading pages, consider adding explicit wait steps "
                    "before interacting with elements."
                )
            elif failure.category == "navigation":
                tips.append(
                    "Verify URLs are accessible and handle potential redirects or "
                    "authentication requirements."
                )
        
        # From slow steps
        if len(result.slow_steps) > 2:
            tips.append(
                "This workflow has multiple slow steps. Consider optimizing selectors "
                "or adding explicit waits at known slow points."
            )
        
        # Deduplicate
        seen = set()
        unique_tips = []
        for tip in tips:
            if tip not in seen:
                seen.add(tip)
                unique_tips.append(tip)
        
        return unique_tips


class TrendAnalyzer:
    """
    Analyze trends across multiple runs.
    """
    
    def __init__(self):
        self.runs: list[AnalysisResult] = []
    
    def add_run(self, result: AnalysisResult) -> None:
        """Add a run analysis to the trend."""
        self.runs.append(result)
    
    def get_common_failures(self) -> list[tuple[str, int]]:
        """Get most common failure categories."""
        from collections import Counter
        
        failures = []
        for run in self.runs:
            for f in run.failure_patterns:
                failures.append(f.category)
        
        return Counter(failures).most_common(5)
    
    def get_average_duration(self) -> float:
        """Get average run duration."""
        if not self.runs:
            return 0.0
        return sum(r.total_duration_ms for r in self.runs) / len(self.runs)
    
    def get_success_rate_trend(self) -> list[tuple[datetime, float]]:
        """Get success rate over time."""
        return [(r.analyzed_at, r.success_rate) for r in self.runs]
    
    def generate_system_prompt_tips(self) -> list[str]:
        """Generate system prompt tips based on aggregate trends."""
        tips = []
        
        # Common failures
        common = self.get_common_failures()
        if common:
            top = common[0]
            if top[0] == "selector":
                tips.append(
                    f"Note: {top[1]} recent runs had selector issues. "
                    "Use explicit waits and stable selectors."
                )
            elif top[0] == "timeout":
                tips.append(
                    f"Note: {top[1]} recent runs timed out. "
                    "Add waits for slow-loading elements."
                )
        
        # Success rate
        if self.runs:
            avg_success = sum(r.success_rate for r in self.runs) / len(self.runs)
            if avg_success < 0.7:
                tips.append(
                    f"Recent success rate is {avg_success:.0%}. "
                    "Break complex tasks into smaller steps."
                )
        
        return tips
