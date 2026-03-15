"""
Suggestion engine for planner improvements.

Generates specific, actionable suggestions based on failure patterns.
"""

from dataclasses import dataclass
from typing import Optional

try:
    from ..recorder.frame import ActionFrame, ActionType
except ImportError:
    # Allow direct import for tests
    from recorder.frame import ActionFrame, ActionType


@dataclass
class SuggestedFix:
    """A suggested fix for a specific issue."""
    issue: str
    current_approach: str
    suggested_approach: str
    confidence: float  # 0-1
    example_before: Optional[str] = None
    example_after: Optional[str] = None


class SuggestionEngine:
    """
    Generate context-aware suggestions for failed actions.
    """
    
    def __init__(self):
        self.patterns = self._load_patterns()
    
    def _load_patterns(self) -> dict:
        """Load suggestion patterns."""
        return {
            "selector": {
                "xpath_unstable": SuggestedFix(
                    issue="XPath selector is unstable",
                    current_approach="Using full XPath like /html/body/div[3]/div[2]/button",
                    suggested_approach="Use stable attributes: [data-testid='submit'] or #submit-btn",
                    confidence=0.9,
                    example_before='target: "/html/body/div[3]/button"',
                    example_after='target: "[data-testid=\'submit-button\']"',
                ),
                "element_not_found": SuggestedFix(
                    issue="Element not found immediately",
                    current_approach="Direct click without waiting",
                    suggested_approach="Add explicit wait for element to be visible/interactive",
                    confidence=0.85,
                    example_before='action: "click", target: "#dynamic-btn"',
                    example_after='action: "click", target: "#dynamic-btn", parameters: {wait_for: "visible"}',
                ),
            },
            "navigation": {
                "page_not_loaded": SuggestedFix(
                    issue="Navigation timeout",
                    current_approach="Direct navigation to URL",
                    suggested_approach="Verify URL is accessible, check for redirects or auth requirements",
                    confidence=0.8,
                ),
                "spa_navigation": SuggestedFix(
                    issue="SPA page change not detected",
                    current_approach="Standard goto action",
                    suggested_approach="For SPAs, use click on navigation elements instead of direct URL",
                    confidence=0.75,
                ),
            },
            "fill": {
                "input_not_focused": SuggestedFix(
                    issue="Text not entered into field",
                    current_approach="fill action on selector",
                    suggested_approach="Ensure element is focused first, clear existing content",
                    confidence=0.8,
                    example_before='action: "fill", target: "#email", text: "user@example.com"',
                    example_after='action: "fill", target: "#email", text: "user@example.com", parameters: {clear: true}',
                ),
            },
        }
    
    def suggest(self, frame: ActionFrame) -> Optional[SuggestedFix]:
        """
        Generate a suggestion for a failed frame.
        """
        if not frame.error:
            return None
        
        error_code = frame.error.get("code", "UNKNOWN")
        action = frame.action
        
        # Match based on action type and error
        if action == ActionType.CLICK and error_code == "SELECTOR_ERROR":
            return self.patterns["selector"]["element_not_found"]
        
        if action == ActionType.GOTO and error_code in ["NAVIGATION_ERROR", "DNS_ERROR"]:
            return self.patterns["navigation"]["page_not_loaded"]
        
        if action == ActionType.FILL and error_code == "SELECTOR_ERROR":
            return self.patterns["fill"]["input_not_focused"]
        
        # Default suggestion based on error category
        return self._default_suggestion(error_code, frame)
    
    def _default_suggestion(self, error_code: str, frame: ActionFrame) -> SuggestedFix:
        """Generate default suggestion when no specific pattern matches."""
        defaults = {
            "SELECTOR_ERROR": SuggestedFix(
                issue=f"Could not find element: {frame.target}",
                current_approach=f"Using selector: {frame.target}",
                suggested_approach="Check selector is correct, element exists, and is visible. Try more specific or stable selector.",
                confidence=0.6,
            ),
            "TIMEOUT": SuggestedFix(
                issue=f"Action timed out: {frame.action.value}",
                current_approach=f"Action with default timeout",
                suggested_approach="Increase timeout or check for blocking conditions (alerts, modals, slow network)",
                confidence=0.7,
            ),
            "NAVIGATION_ERROR": SuggestedFix(
                issue=f"Navigation failed: {frame.target}",
                current_approach=f"Direct navigation to {frame.target}",
                suggested_approach="Verify URL is correct and accessible. Check for redirects or required authentication.",
                confidence=0.7,
            ),
        }
        
        return defaults.get(error_code, SuggestedFix(
            issue=f"Error: {error_code}",
            current_approach=f"Action: {frame.action.value}",
            suggested_approach="Review error details and retry. Consider breaking action into smaller steps.",
            confidence=0.5,
        ))
    
    def generate_cookbook_entry(self, successful_run: list[ActionFrame], task_description: str) -> dict:
        """
        Generate a cookbook entry from a successful run.
        
        Args:
            successful_run: List of frames from a successful execution
            task_description: Natural language description of what was accomplished
        """
        return {
            "task": task_description,
            "actions": [
                {
                    "step": i,
                    "action": f.action.value,
                    "target": f.target,
                    "parameters": f.parameters,
                    "notes": self._action_notes(f),
                }
                for i, f in enumerate(successful_run)
            ],
            "total_steps": len(successful_run),
            "total_duration_ms": sum(f.duration_ms or 0 for f in successful_run),
            "key_learnings": self._extract_learnings(successful_run),
        }
    
    def _action_notes(self, frame: ActionFrame) -> str:
        """Generate notes for an action in cookbook."""
        notes = []
        
        if frame.duration_ms and frame.duration_ms > 5000:
            notes.append(f"Slow step ({frame.duration_ms}ms) - consider optimization")
        
        if frame.action == ActionType.CLICK and frame.target:
            # Check if selector looks unstable
            if frame.target.startswith("/") or "[" in frame.target:
                notes.append("Consider using more stable selector")
        
        return "; ".join(notes) if notes else ""
    
    def _extract_learnings(self, frames: list[ActionFrame]) -> list[str]:
        """Extract key learnings from a successful run."""
        learnings = []
        
        # Check for patterns
        slow_count = sum(1 for f in frames if f.duration_ms and f.duration_ms > 5000)
        if slow_count > 0:
            learnings.append(f"{slow_count} steps required extra time - add explicit waits")
        
        # Check for goto patterns
        goto_frames = [f for f in frames if f.action == ActionType.GOTO]
        if len(goto_frames) > 1:
            learnings.append("Multi-page workflow - verify session persistence")
        
        # Check for fill patterns
        fill_frames = [f for f in frames if f.action == ActionType.FILL]
        if fill_frames:
            learnings.append("Form interaction involved - consider validation steps")
        
        return learnings


class PromptAugmenter:
    """
    Augment system prompts with learned tips.
    
    Based on Anthropic's recommendation to add task-specific tips
    to the system prompt when you know recurring failure modes.
    """
    
    def __init__(self, suggestion_engine: SuggestionEngine):
        self.suggestion_engine = suggestion_engine
        self.learned_tips: list[str] = []
    
    def add_tip(self, tip: str, source: str = "unknown") -> None:
        """Add a learned tip."""
        if tip not in self.learned_tips:
            self.learned_tips.append(tip)
    
    def add_tips_from_analysis(self, analysis: 'AnalysisResult') -> None:
        """Extract and add tips from run analysis."""
        for tip in analysis.planner_tips:
            self.add_tip(tip, source=f"run:{analysis.run_id}")
    
    def augment_prompt(self, base_prompt: str) -> str:
        """
        Augment a system prompt with learned tips.
        
        Returns base prompt with added tips section.
        """
        if not self.learned_tips:
            return base_prompt
        
        tips_section = "\n\n## Learned Tips\n\n"
        tips_section += "Based on previous executions:\n"
        for i, tip in enumerate(self.learned_tips[-5:], 1):  # Last 5 tips
            tips_section += f"{i}. {tip}\n"
        
        return base_prompt + tips_section
    
    def get_tips_for_task(self, task_type: str) -> list[str]:
        """Get relevant tips for a specific task type."""
        task_keywords = {
            "form": ["fill", "input", "form", "field"],
            "navigation": ["goto", "navigate", "page", "url"],
            "data_extraction": ["extract", "scrape", "data"],
            "screenshot": ["screenshot", "capture", "image"],
        }
        
        keywords = task_keywords.get(task_type, [])
        relevant = []
        
        for tip in self.learned_tips:
            tip_lower = tip.lower()
            if any(kw in tip_lower for kw in keywords):
                relevant.append(tip)
        
        return relevant
