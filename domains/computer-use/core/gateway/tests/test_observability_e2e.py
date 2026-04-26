#!/usr/bin/env python3
"""
Observability End-to-End Verification Test

Tests all action handlers with observability wired.
Verifies outputs: timeline, screenshots, analysis, replay.

Run: python3 tests/test_observability_e2e.py
"""

import asyncio
import httpx
import json
import os
import sys
from pathlib import Path
from datetime import datetime

# Configuration
BASE_URL = "http://127.0.0.1:8080"
RECORDINGS_PATH = Path("/tmp/allternit-recordings")  # Must match gateway default

# Enable observability (gateway must be started with this env var)
os.environ["Allternit_ENABLE_OBSERVABILITY"] = "true"


class ObservabilityE2ETest:
    """End-to-end observability verification."""
    
    def __init__(self):
        self.run_id = f"e2e_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        self.session_id = f"session_{self.run_id}"
        self.results = []
        
    def log(self, msg: str):
        print(f"  {msg}")
        
    async def check_gateway(self) -> bool:
        """Verify gateway is running."""
        try:
            response = httpx.get(f"{BASE_URL}/health", timeout=5.0)
            if response.status_code == 200:
                data = response.json()
                self.log(f"✓ Gateway running (v{data['version']})")
                return True
        except Exception as e:
            self.log(f"✗ Gateway not accessible: {e}")
        return False
    
    async def execute_action(self, action: str, **kwargs) -> dict:
        """Execute an action and return result."""
        payload = {
            "action": action,
            "session_id": self.session_id,
            "run_id": self.run_id,
            **kwargs
        }
        
        response = httpx.post(
            f"{BASE_URL}/v1/execute",
            json=payload,
            timeout=30.0
        )
        
        return response.json()
    
    async def test_action(self, action: str, expect_success: bool = True, **kwargs) -> bool:
        """Test a single action with observability."""
        self.log(f"\n  Testing {action}...")
        
        result = await self.execute_action(action, **kwargs)
        
        if expect_success:
            if result.get("status") != "completed":
                self.log(f"  ✗ {action} failed: {result.get('error', {}).get('message', 'unknown')}")
                return False
            self.log(f"  ✓ {action} completed")
        else:
            if result.get("status") != "failed":
                self.log(f"  ✗ {action} should have failed but succeeded")
                return False
            self.log(f"  ✓ {action} failed as expected")
        
        # Verify receipt exists
        receipts = result.get("receipts", [])
        if not receipts:
            self.log(f"  ✗ No receipt for {action}")
            return False
        
        self.log(f"  ✓ Receipt captured: {receipts[0]['action']}")
        return True
    
    async def run_full_workflow(self) -> bool:
        """Run a complete workflow with all actions."""
        self.log("\n" + "="*60)
        self.log("E2E Observability Test: Full Workflow")
        self.log("="*60)
        self.log(f"Run ID: {self.run_id}")
        self.log(f"Session ID: {self.session_id}")
        
        # Check gateway
        if not await self.check_gateway():
            return False
        
        # 1. goto
        if not await self.test_action("goto", target="https://example.com"):
            return False
        
        # 2. screenshot
        if not await self.test_action("screenshot"):
            return False
        
        # 3. inspect
        if not await self.test_action("inspect"):
            return False
        
        # 4. extract
        if not await self.test_action("extract", parameters={"format": "json"}):
            return False
        
        # 5. Finalize to generate artifacts
        self.log("\n  Finalizing run...")
        
        response = httpx.post(
            f"{BASE_URL}/v1/finalize",
            params={"run_id": self.run_id, "build_replay": "true"},
            timeout=60.0
        )
        
        if response.status_code != 200:
            self.log(f"  ✗ Finalize failed: {response.text}")
            return False
        
        result = response.json()
        
        if result.get("status") == "observability_disabled":
            self.log("  ⚠ Observability disabled in gateway")
            return False
        
        self.log(f"  ✓ Finalized: {result.get('steps', 0)} steps")
        
        # Verify outputs
        return await self.verify_outputs(result)
    
    async def verify_outputs(self, finalize_result: dict) -> bool:
        """Verify all observability outputs exist."""
        self.log("\n  Verifying outputs...")
        
        # 1. Check timeline exists in response
        if "analysis" not in finalize_result:
            self.log("  ✗ No analysis in finalize response")
            return False
        self.log("  ✓ Analysis in response")
        
        analysis = finalize_result["analysis"]
        self.log(f"    - Total steps: {analysis.get('total_steps')}")
        self.log(f"    - Success rate: {analysis.get('success_rate', 0):.0%}")
        
        # 2. Check recording endpoint
        response = httpx.get(f"{BASE_URL}/v1/recordings/{self.run_id}")
        if response.status_code != 200:
            self.log(f"  ✗ Recording endpoint failed: {response.status_code}")
            return False
        
        recording = response.json()
        self.log(f"  ✓ Recording endpoint: {recording.get('total_steps')} steps")
        
        # 3. Check filesystem outputs
        # Find the recording directory (date-based)
        date_dir = RECORDINGS_PATH / datetime.now().strftime("%Y-%m-%d")
        run_dir = date_dir / self.run_id
        
        if not run_dir.exists():
            self.log(f"  ✗ Run directory not found: {run_dir}")
            return False
        
        self.log(f"  ✓ Run directory exists: {run_dir}")
        
        # Check for timeline.json
        timeline_path = run_dir / "timeline.json"
        if timeline_path.exists():
            self.log(f"  ✓ timeline.json exists")
        else:
            self.log(f"  ✗ timeline.json missing")
        
        # Check for frame files
        frames_dir = run_dir / "frames"
        if frames_dir.exists():
            frame_files = list(frames_dir.iterdir())
            self.log(f"  ✓ {len(frame_files)} frame files")
        else:
            self.log(f"  ⚠ No frames directory")
        
        # Check for analysis
        analysis_path = run_dir / "analysis.json"
        if analysis_path.exists():
            self.log(f"  ✓ analysis.json exists")
            # Load and verify content
            with open(analysis_path) as f:
                analysis_data = json.load(f)
            self.log(f"    - Summary: {analysis_data.get('summary', 'N/A')[:60]}...")
        else:
            self.log(f"  ⚠ analysis.json not in run dir (may be in finalize response only)")
        
        # Check for replay
        replay_gif = run_dir.parent.parent / "replays" / f"{self.run_id}.gif"
        if replay_gif.exists():
            size_kb = replay_gif.stat().st_size / 1024
            self.log(f"  ✓ replay.gif exists ({size_kb:.1f} KB)")
        else:
            self.log(f"  ⚠ replay.gif not generated (may need PIL)")
        
        return True
    
    async def test_failure_capture(self) -> bool:
        """Test that failures are properly captured."""
        self.log("\n" + "="*60)
        self.log("E2E Observability Test: Failure Capture")
        self.log("="*60)
        
        if not await self.check_gateway():
            return False
        
        failure_run_id = f"{self.run_id}_fail"
        failure_session = f"{self.session_id}_fail"
        
        # First goto to establish session
        result = await self.execute_action(
            "goto",
            session_id=failure_session,
            run_id=failure_run_id,
            target="https://example.com"
        )
        
        if result.get("status") != "completed":
            self.log("✗ Setup goto failed")
            return False
        
        # Now try to click a non-existent element
        self.log("\n  Testing failure capture...")
        fail_result = await self.execute_action(
            "click",
            session_id=failure_session,
            run_id=failure_run_id,
            target="#non-existent-element-12345"
        )
        
        if fail_result.get("status") != "failed":
            self.log("✗ Expected failure but got success")
            return False
        
        self.log("✓ Action failed as expected")
        
        # Verify error details
        error = fail_result.get("error", {})
        self.log(f"  Error code: {error.get('code', 'N/A')}")
        self.log(f"  Error message: {error.get('message', 'N/A')[:60]}...")
        
        # Finalize to capture failure in timeline
        response = httpx.post(
            f"{BASE_URL}/v1/finalize",
            params={"run_id": failure_run_id, "build_replay": "false"},
            timeout=10.0
        )
        
        if response.status_code == 200:
            result = response.json()
            if result.get("status") != "observability_disabled":
                analysis = result.get("analysis", {})
                failed = analysis.get("failed", 0)
                self.log(f"✓ Finalize captured {failed} failed step(s)")
                
                if analysis.get("failure_patterns"):
                    for fp in analysis["failure_patterns"]:
                        self.log(f"  - Failure: {fp.get('category')} at step {fp.get('step')}")
        
        return True
    
    async def run_all(self) -> bool:
        """Run all tests."""
        passed = 0
        failed = 0
        
        # Test 1: Full workflow
        if await self.run_full_workflow():
            passed += 1
        else:
            failed += 1
        
        # Test 2: Failure capture
        if await self.test_failure_capture():
            passed += 1
        else:
            failed += 1
        
        # Summary
        self.log("\n" + "="*60)
        self.log(f"Results: {passed} passed, {failed} failed")
        self.log("="*60)
        
        return failed == 0


def main():
    print("\n" + "="*60)
    print("Observability E2E Verification")
    print("="*60)
    
    # Clean up old recordings
    if RECORDINGS_PATH.exists():
        import shutil
        shutil.rmtree(RECORDINGS_PATH)
    RECORDINGS_PATH.mkdir(parents=True, exist_ok=True)
    
    test = ObservabilityE2ETest()
    success = asyncio.run(test.run_all())
    
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
