#!/usr/bin/env python3
"""
Observability Integration Tests

Tests the recorder, replay builder, and analyzer.
"""

import asyncio
import httpx
import os
from pathlib import Path

# Set up paths
os.environ["Allternit_ENABLE_OBSERVABILITY"] = "true"
os.environ["Allternit_RECORDINGS_PATH"] = "/tmp/allternit-test-recordings"

import sys
OBSERVABILITY_PATH = str(Path(__file__).parent.parent.parent / "observability")
sys.path.insert(0, OBSERVABILITY_PATH)

from recorder import SessionRecorder, RecorderConfig, ActionType, FrameStatus
from analyzer import RunAnalyzer
from replay import ReplayConfig, ReplayFormat, MultiFormatBuilder

BASE_URL = "http://127.0.0.1:8080"


def test_recorder_frame():
    """Test basic frame recording."""
    print("\n1. Testing recorder frame capture...")
    
    async def run():
        config = RecorderConfig(
            storage_path="/tmp/allternit-test-recordings",
            storage_backend="memory",
            async_save=False,
        )
        recorder = SessionRecorder(config)
        
        # Start frame
        frame = await recorder.start_frame(
            run_id="test_run_001",
            session_id="test_session_001",
            step_index=0,
            action="goto",
            target="https://example.com",
        )
        
        assert frame.run_id == "test_run_001"
        assert frame.action == ActionType.GOTO
        assert frame.status == FrameStatus.RUNNING
        
        # Complete frame
        await recorder.complete_frame(
            frame=frame,
            status="completed",
            result={"url": "https://example.com", "title": "Example"},
        )
        
        assert frame.status == FrameStatus.COMPLETED
        assert frame.duration_ms is not None
        
        print("   ✓ Frame recorded successfully")
        return True
    
    return asyncio.run(run())


def test_analyzer():
    """Test run analysis."""
    print("\n2. Testing run analyzer...")
    
    async def run():
        from recorder.frame import RunTimeline, ActionFrame
        from datetime import datetime
        
        # Create a timeline with some frames
        timeline = RunTimeline(
            run_id="test_run_002",
            session_id="test_session_002",
        )
        
        # Add some frames
        for i in range(3):
            frame = ActionFrame(
                run_id="test_run_002",
                session_id="test_session_002",
                step_index=i,
                action=ActionType.GOTO if i == 0 else ActionType.CLICK,
                target="https://example.com" if i == 0 else f"#button-{i}",
                status=FrameStatus.COMPLETED,
                timestamp_start=datetime.utcnow(),
                timestamp_end=datetime.utcnow(),
                duration_ms=1500 if i == 0 else 800,
            )
            timeline.add_frame(frame)
        
        # Add a slow frame
        slow_frame = ActionFrame(
            run_id="test_run_002",
            session_id="test_session_002",
            step_index=3,
            action=ActionType.EXTRACT,
            status=FrameStatus.COMPLETED,
            timestamp_start=datetime.utcnow(),
            timestamp_end=datetime.utcnow(),
            duration_ms=6000,  # Slow!
        )
        timeline.add_frame(slow_frame)
        
        # Analyze
        analyzer = RunAnalyzer()
        result = await analyzer.analyze(timeline)
        
        assert result.total_steps == 4
        assert result.success_rate == 1.0
        assert len(result.slow_steps) == 1
        assert result.slow_steps[0]["step"] == 3
        
        print(f"   ✓ Analysis: {result.total_steps} steps, {len(result.slow_steps)} slow")
        print(f"   ✓ Golden path candidate: {result.is_golden_path_candidate}")
        return True
    
    return asyncio.run(run())


def test_replay_builder():
    """Test GIF replay builder."""
    print("\n3. Testing replay builder...")
    
    async def run():
        # Create test images
        try:
            from PIL import Image
        except ImportError:
            print("   ⚠ PIL not available, skipping replay test")
            return True
        
        # Create test frames
        test_dir = Path("/tmp/allternit-test-frames")
        test_dir.mkdir(exist_ok=True)
        
        frame_paths = []
        for i in range(3):
            img = Image.new('RGB', (800, 600), color=(i*50, i*50, i*50))
            path = test_dir / f"frame_{i:03d}.png"
            img.save(path)
            frame_paths.append((i, str(path), f"Step {i}"))
        
        # Build GIF
        config = ReplayConfig(
            formats=[ReplayFormat.GIF],
            gif_fps=2,
        )
        builder = MultiFormatBuilder(config)
        
        output_dir = "/tmp/allternit-test-replays"
        artifacts = await builder.build_from_frames(
            frames=frame_paths,
            output_dir=output_dir,
            run_id="test_run_003",
        )
        
        assert "gif" in artifacts
        assert Path(artifacts["gif"]).exists()
        
        print(f"   ✓ Replay GIF created: {artifacts['gif']}")
        return True
    
    return asyncio.run(run())


def test_gateway_observability():
    """Test observability through gateway."""
    print("\n4. Testing gateway observability integration...")
    
    # First check if gateway is running
    try:
        response = httpx.get(f"{BASE_URL}/health", timeout=2.0)
        if response.status_code != 200:
            print("   ⚠ Gateway not running, skipping integration test")
            return True
    except Exception:
        print("   ⚠ Gateway not accessible, skipping integration test")
        return True
    
    async def run():
        run_id = f"obs_test_{os.urandom(4).hex()}"
        
        # Execute an action
        response = httpx.post(
            f"{BASE_URL}/v1/execute",
            json={
                "action": "goto",
                "session_id": f"obs_session_{run_id}",
                "run_id": run_id,
                "target": "https://example.com",
            },
            timeout=30.0
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "completed"
        
        # Finalize to trigger observability
        finalize_response = httpx.post(
            f"{BASE_URL}/v1/finalize",
            params={"run_id": run_id, "build_replay": "false"},
            timeout=10.0
        )
        
        assert finalize_response.status_code == 200
        result = finalize_response.json()
        
        assert "steps" in result
        assert result["steps"] >= 1
        
        print(f"   ✓ Run finalized: {result['steps']} steps")
        return True
    
    return asyncio.run(run())


def main():
    print("="*60)
    print("Observability Integration Tests")
    print("="*60)
    
    tests = [
        ("Recorder Frame Capture", test_recorder_frame),
        ("Run Analyzer", test_analyzer),
        ("Replay Builder", test_replay_builder),
        ("Gateway Integration", test_gateway_observability),
    ]
    
    passed = 0
    failed = 0
    
    for name, test_fn in tests:
        try:
            if test_fn():
                passed += 1
            else:
                failed += 1
                print(f"   ✗ {name} failed")
        except Exception as e:
            failed += 1
            print(f"   ✗ {name} error: {e}")
    
    print("\n" + "="*60)
    print(f"Results: {passed} passed, {failed} failed")
    print("="*60)
    
    return failed == 0


if __name__ == "__main__":
    import sys
    success = main()
    sys.exit(0 if success else 1)
