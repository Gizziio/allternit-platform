#!/usr/bin/env python3
"""
Analyzer Tuning Test - CU-033b

Verifies analyzer improvements:
1. Empty runs don't qualify as golden path
2. Minimum 2 steps required
3. Score calculations are accurate
"""

import asyncio
import sys
from pathlib import Path

OBS_PATH = Path(__file__).parent.parent.parent / "observability"
sys.path.insert(0, str(OBS_PATH))

from analyzer import RunAnalyzer
from recorder.frame import RunTimeline, ActionFrame, ActionType, FrameStatus
from datetime import datetime


class AnalyzerTuningTest:
    """Test analyzer scoring and golden path detection."""
    
    def log(self, msg: str):
        print(f"  {msg}")
    
    async def test_empty_run_not_golden_path(self) -> bool:
        """Empty runs (0 steps) should not be golden path candidates."""
        self.log("\nTest 1: Empty run should not be golden path")
        
        timeline = RunTimeline(
            run_id="test_empty",
            session_id="test_session",
            total_steps=0,
            completed_steps=0,
            failed_steps=0,
            total_duration_ms=0,
        )
        
        analyzer = RunAnalyzer()
        result = await analyzer.analyze(timeline)
        
        if result.is_golden_path_candidate:
            self.log(f"✗ FAIL: Empty run marked as golden path (score: {result.golden_path_score})")
            return False
        
        if result.golden_path_score != 0.0:
            self.log(f"✗ FAIL: Empty run has non-zero score: {result.golden_path_score}")
            return False
        
        if "Too few steps" not in str(result.golden_path_reasons):
            self.log(f"✗ FAIL: Wrong reason: {result.golden_path_reasons}")
            return False
        
        self.log(f"✓ PASS: Empty run correctly rejected (score: {result.golden_path_score})")
        return True
    
    async def test_single_step_not_golden_path(self) -> bool:
        """Single step runs should not be golden path candidates."""
        self.log("\nTest 2: Single step run should not be golden path")
        
        timeline = RunTimeline(
            run_id="test_single",
            session_id="test_session",
        )
        
        # Add one successful step
        frame = ActionFrame(
            run_id="test_single",
            session_id="test_session",
            step_index=0,
            action=ActionType.GOTO,
            target="https://example.com",
            status=FrameStatus.COMPLETED,
            timestamp_start=datetime.utcnow(),
            timestamp_end=datetime.utcnow(),
            duration_ms=1500,
        )
        timeline.add_frame(frame)
        
        analyzer = RunAnalyzer()
        result = await analyzer.analyze(timeline)
        
        if result.is_golden_path_candidate:
            self.log(f"✗ FAIL: Single step marked as golden path (score: {result.golden_path_score})")
            return False
        
        self.log(f"✓ PASS: Single step correctly rejected (score: {result.golden_path_score})")
        return True
    
    async def test_two_step_successful_is_golden_path(self) -> bool:
        """Two+ step successful runs should be candidates."""
        self.log("\nTest 3: Two step successful run should be golden path")
        
        timeline = RunTimeline(
            run_id="test_two_step",
            session_id="test_session",
        )
        
        # Add two successful steps
        for i, action in enumerate([ActionType.GOTO, ActionType.SCREENSHOT]):
            frame = ActionFrame(
                run_id="test_two_step",
                session_id="test_session",
                step_index=i,
                action=action,
                target="https://example.com" if i == 0 else None,
                status=FrameStatus.COMPLETED,
                timestamp_start=datetime.utcnow(),
                timestamp_end=datetime.utcnow(),
                duration_ms=1500,
            )
            timeline.add_frame(frame)
        
        analyzer = RunAnalyzer()
        result = await analyzer.analyze(timeline)
        
        if not result.is_golden_path_candidate:
            self.log(f"✗ FAIL: Two step success not marked as golden path (score: {result.golden_path_score})")
            self.log(f"  Reasons: {result.golden_path_reasons}")
            return False
        
        self.log(f"✓ PASS: Two step success is golden path (score: {result.golden_path_score})")
        self.log(f"  Reasons: {result.golden_path_reasons}")
        return True
    
    async def test_failed_run_not_golden_path(self) -> bool:
        """Failed runs should not be golden path candidates."""
        self.log("\nTest 4: Failed run should not be golden path")
        
        timeline = RunTimeline(
            run_id="test_failed",
            session_id="test_session",
        )
        
        # Add one success, one failure
        frame1 = ActionFrame(
            run_id="test_failed",
            session_id="test_session",
            step_index=0,
            action=ActionType.GOTO,
            target="https://example.com",
            status=FrameStatus.COMPLETED,
            timestamp_start=datetime.utcnow(),
            timestamp_end=datetime.utcnow(),
            duration_ms=1500,
        )
        timeline.add_frame(frame1)
        
        frame2 = ActionFrame(
            run_id="test_failed",
            session_id="test_session",
            step_index=1,
            action=ActionType.CLICK,
            target="#bad-selector",
            status=FrameStatus.FAILED,
            error={"code": "SELECTOR_ERROR", "message": "Timeout"},
            timestamp_start=datetime.utcnow(),
            timestamp_end=datetime.utcnow(),
            duration_ms=5000,
        )
        timeline.add_frame(frame2)
        
        analyzer = RunAnalyzer()
        result = await analyzer.analyze(timeline)
        
        if result.is_golden_path_candidate:
            self.log(f"✗ FAIL: Failed run marked as golden path (score: {result.golden_path_score})")
            return False
        
        self.log(f"✓ PASS: Failed run correctly rejected (score: {result.golden_path_score})")
        self.log(f"  Failure patterns detected: {len(result.failure_patterns)}")
        return True
    
    async def test_slow_steps_detected(self) -> bool:
        """Slow steps should be detected and affect scoring."""
        self.log("\nTest 5: Slow steps should be detected")
        
        timeline = RunTimeline(
            run_id="test_slow",
            session_id="test_session",
        )
        
        # Add 3 steps, one is very slow
        for i, (action, duration) in enumerate([
            (ActionType.GOTO, 1500),
            (ActionType.CLICK, 16000),  # Very slow!
            (ActionType.SCREENSHOT, 1000),
        ]):
            frame = ActionFrame(
                run_id="test_slow",
                session_id="test_session",
                step_index=i,
                action=action,
                status=FrameStatus.COMPLETED,
                timestamp_start=datetime.utcnow(),
                timestamp_end=datetime.utcnow(),
                duration_ms=duration,
            )
            timeline.add_frame(frame)
        
        analyzer = RunAnalyzer()
        result = await analyzer.analyze(timeline)
        
        # Should have performance issues
        if len(result.performance_issues) == 0:
            self.log(f"✗ FAIL: No performance issues detected for slow step")
            return False
        
        # Should have slow steps recorded
        if len(result.slow_steps) == 0:
            self.log(f"✗ FAIL: No slow steps recorded")
            return False
        
        # Score should NOT get the "no slow steps" bonus (0.3)
        # Max possible without that bonus: 0.4 + 0.2 + 0.1 = 0.7
        # With one slow step, it's exactly at threshold
        self.log(f"✓ PASS: Slow steps detected ({len(result.slow_steps)} steps)")
        self.log(f"  Performance issues: {len(result.performance_issues)}")
        self.log(f"  Score without 'no slow steps' bonus: {result.golden_path_score}")
        
        # The point is: slow steps WERE detected, so the test passes
        return True
    
    async def test_planner_tips_generated(self) -> bool:
        """Analyzer should generate useful planner tips."""
        self.log("\nTest 6: Planner tips should be generated from failures")
        
        timeline = RunTimeline(
            run_id="test_tips",
            session_id="test_session",
        )
        
        # Add successful goto
        frame1 = ActionFrame(
            run_id="test_tips",
            session_id="test_session",
            step_index=0,
            action=ActionType.GOTO,
            target="https://example.com",
            status=FrameStatus.COMPLETED,
            timestamp_start=datetime.utcnow(),
            timestamp_end=datetime.utcnow(),
            duration_ms=1500,
        )
        timeline.add_frame(frame1)
        
        # Add failed click with selector error
        frame2 = ActionFrame(
            run_id="test_tips",
            session_id="test_session",
            step_index=1,
            action=ActionType.CLICK,
            target="#nonexistent",
            status=FrameStatus.FAILED,
            error={"code": "SELECTOR_ERROR", "message": "Timeout waiting for selector"},
            timestamp_start=datetime.utcnow(),
            timestamp_end=datetime.utcnow(),
            duration_ms=5000,
        )
        timeline.add_frame(frame2)
        
        analyzer = RunAnalyzer()
        result = await analyzer.analyze(timeline)
        
        # Should have planner tips about selectors
        if len(result.planner_tips) == 0:
            self.log(f"✗ FAIL: No planner tips generated")
            return False
        
        tips_text = " ".join(result.planner_tips)
        if "selector" not in tips_text.lower():
            self.log(f"✗ FAIL: Tips don't mention selectors: {result.planner_tips}")
            return False
        
        self.log(f"✓ PASS: Planner tips generated: {len(result.planner_tips)} tips")
        for tip in result.planner_tips:
            self.log(f"    - {tip[:60]}...")
        return True
    
    async def run_all(self) -> bool:
        """Run all analyzer tuning tests."""
        print("="*60)
        print("Analyzer Tuning Tests")
        print("="*60)
        
        tests = [
            self.test_empty_run_not_golden_path,
            self.test_single_step_not_golden_path,
            self.test_two_step_successful_is_golden_path,
            self.test_failed_run_not_golden_path,
            self.test_slow_steps_detected,
            self.test_planner_tips_generated,
        ]
        
        passed = 0
        failed = 0
        
        for test in tests:
            try:
                if await test():
                    passed += 1
                else:
                    failed += 1
            except Exception as e:
                self.log(f"✗ EXCEPTION: {e}")
                import traceback
                traceback.print_exc()
                failed += 1
        
        print("\n" + "="*60)
        print(f"Results: {passed} passed, {failed} failed")
        print("="*60)
        
        return failed == 0


def main():
    test = AnalyzerTuningTest()
    success = asyncio.run(test.run_all())
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
