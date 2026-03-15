"""
A2R Computer Use Observability - Analyzer

Post-run analysis:
- Action timeline
- Slow step detection
- Failure analysis
- Suggested fixes
- Golden path identification
"""

from .analyzer import RunAnalyzer, AnalysisResult, PerformanceIssue, FailurePattern
from .suggestions import SuggestionEngine, SuggestedFix

__all__ = [
    "RunAnalyzer",
    "AnalysisResult",
    "PerformanceIssue",
    "FailurePattern",
    "SuggestionEngine",
    "SuggestedFix",
]
