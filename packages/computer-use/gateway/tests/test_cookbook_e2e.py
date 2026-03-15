#!/usr/bin/env python3
"""
Cookbook Promotion E2E Test - CU-034a

Tests the full cookbook promotion pipeline:
1. Run a successful workflow
2. Analyze the run
3. Promote to cookbook
4. Verify cookbook entry structure
"""

import asyncio
import httpx
import json
import sys
from pathlib import Path
from datetime import datetime

BASE_URL = "http://127.0.0.1:8080"
COOKBOOK_PATH = Path("/tmp/a2r-cookbook-test")


class CookbookE2ETest:
    """End-to-end cookbook promotion test."""
    
    def __init__(self):
        self.run_id = f"cookbook_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        self.session_id = f"session_{self.run_id}"
        
    def log(self, msg: str):
        print(f"  {msg}")
    
    async def run_successful_workflow(self) -> bool:
        """Run a workflow that should be promoted to cookbook."""
        self.log(f"\nRun ID: {self.run_id}")
        
        # 1. goto
        response = httpx.post(
            f"{BASE_URL}/v1/execute",
            json={
                "action": "goto",
                "session_id": self.session_id,
                "run_id": self.run_id,
                "target": "https://example.com"
            },
            timeout=30.0
        )
        if response.json().get("status") != "completed":
            self.log("✗ goto failed")
            return False
        self.log("✓ Step 1: goto to example.com")
        
        # 2. inspect
        response = httpx.post(
            f"{BASE_URL}/v1/execute",
            json={
                "action": "inspect",
                "session_id": self.session_id,
                "run_id": self.run_id
            },
            timeout=10.0
        )
        if response.json().get("status") != "completed":
            self.log("✗ inspect failed")
            return False
        self.log("✓ Step 2: inspect page")
        
        # 3. screenshot
        response = httpx.post(
            f"{BASE_URL}/v1/execute",
            json={
                "action": "screenshot",
                "session_id": self.session_id,
                "run_id": self.run_id
            },
            timeout=10.0
        )
        if response.json().get("status") != "completed":
            self.log("✗ screenshot failed")
            return False
        self.log("✓ Step 3: screenshot")
        
        # 4. extract
        response = httpx.post(
            f"{BASE_URL}/v1/execute",
            json={
                "action": "extract",
                "session_id": self.session_id,
                "run_id": self.run_id,
                "parameters": {"format": "json"}
            },
            timeout=10.0
        )
        if response.json().get("status") != "completed":
            self.log("✗ extract failed")
            return False
        self.log("✓ Step 4: extract data")
        
        # 5. close
        response = httpx.post(
            f"{BASE_URL}/v1/execute",
            json={
                "action": "close",
                "session_id": self.session_id,
                "run_id": self.run_id
            },
            timeout=10.0
        )
        if response.json().get("status") != "completed":
            self.log("✗ close failed")
            return False
        self.log("✓ Step 5: close session")
        
        # Finalize to save timeline
        self.log("\n  Finalizing run...")
        response = httpx.post(
            f"{BASE_URL}/v1/finalize",
            params={"run_id": self.run_id, "build_replay": "true"},
            timeout=60.0
        )
        if response.status_code != 200:
            self.log(f"✗ Finalize failed: {response.text}")
            return False
        
        result = response.json()
        if result.get("status") == "observability_disabled":
            self.log("✗ Observability disabled")
            return False
        
        self.log(f"✓ Finalized: {result.get('steps', 0)} steps")
        
        return True
    
    async def promote_to_cookbook(self) -> bool:
        """Promote the successful run to cookbook."""
        self.log("\nPromoting to cookbook...")
        
        # Import and use the cookbook promoter directly
        import sys
        OBS_PATH = Path(__file__).parent.parent.parent / "observability"
        sys.path.insert(0, str(OBS_PATH))
        
        from cookbook import CookbookPromoter, CookbookRepository, PromotionCriteria
        from recorder.frame import RunTimeline, ActionFrame, FrameStatus, ActionType
        from analyzer import RunAnalyzer
        from datetime import datetime
        
        # Load timeline from storage
        recordings_path = Path("/tmp/a2r-recordings")
        date_dir = recordings_path / datetime.now().strftime("%Y-%m-%d")
        run_dir = date_dir / self.run_id
        timeline_path = run_dir / "timeline.json"
        
        if not timeline_path.exists():
            self.log(f"✗ Timeline not found: {timeline_path}")
            return False
        
        with open(timeline_path) as f:
            timeline_data = json.load(f)
        
        # Reconstruct timeline
        timeline = RunTimeline(
            run_id=timeline_data["run_id"],
            session_id=timeline_data["session_id"],
        )
        
        for frame_data in timeline_data.get("frames", []):
            frame = ActionFrame(**frame_data)
            timeline.add_frame(frame)
        
        self.log(f"✓ Loaded timeline: {timeline.total_steps} steps")
        
        # Analyze
        analyzer = RunAnalyzer()
        analysis = await analyzer.analyze(timeline)
        
        self.log(f"✓ Analysis complete: {analysis.success_rate:.0%} success rate")
        self.log(f"  Summary: {analysis.summary}")
        
        # Check if qualifies for cookbook
        criteria = PromotionCriteria(
            min_steps=2,
            max_steps=10,
            min_success_rate=1.0,
        )
        
        # Create repository and promoter
        COOKBOOK_PATH.mkdir(parents=True, exist_ok=True)
        repository = CookbookRepository(str(COOKBOOK_PATH))
        promoter = CookbookPromoter(repository, criteria, str(COOKBOOK_PATH))
        
        if not promoter.should_promote(timeline, analysis):
            self.log(f"✗ Run doesn't qualify for cookbook")
            self.log(f"  Steps: {timeline.total_steps}")
            self.log(f"  Success rate: {analysis.success_rate}")
            self.log(f"  Failed steps: {timeline.failed_steps}")
            return False
        
        self.log("✓ Run qualifies for cookbook promotion")
        
        # Promote
        try:
            entry = await promoter.promote(
                timeline=timeline,
                analysis=analysis,
                task_description="Navigate to example.com, inspect, screenshot, extract data, and close session",
                example_prompt="Go to example.com, inspect the page, take a screenshot, extract the page data, then close the browser",
                task_category="web_navigation",
                tags=["example", "navigation", "screenshot", "extraction"],
                copy_replay=True,
            )
            
            self.log(f"✓ Promoted to cookbook: {entry.id}")
            self.log(f"  Complexity: {entry.complexity}")
            self.log(f"  Actions: {entry.total_steps}")
            self.log(f"  Expected duration: {entry.expected_duration_ms}ms")
            
            # Verify entry files exist
            entry_path = COOKBOOK_PATH / f"{entry.id}.json"
            if entry_path.exists():
                self.log(f"✓ Entry file exists: {entry_path}")
            else:
                self.log(f"✗ Entry file missing: {entry_path}")
                return False
            
            # Load and verify entry content
            with open(entry_path) as f:
                entry_data = json.load(f)
            
            required_fields = [
                "id", "task_description", "task_category", "actions",
                "total_steps", "example_prompt", "complexity"
            ]
            
            for field in required_fields:
                if field not in entry_data:
                    self.log(f"✗ Missing field in entry: {field}")
                    return False
            
            self.log(f"✓ Entry has all required fields")
            
            # Verify action sequence
            actions = entry_data.get("actions", [])
            if len(actions) != timeline.total_steps:
                self.log(f"✗ Action count mismatch: {len(actions)} vs {timeline.total_steps}")
                return False
            
            self.log(f"✓ Action sequence captured: {len(actions)} actions")
            
            # Print example prompt
            self.log(f"\n  Example prompt:")
            self.log(f"    {entry_data['example_prompt'][:80]}...")
            
            # Print system prompt addition if present
            if entry_data.get('system_prompt_addition'):
                self.log(f"\n  System prompt addition:")
                self.log(f"    {entry_data['system_prompt_addition'][:80]}...")
            
            return True
            
        except Exception as e:
            self.log(f"✗ Promotion failed: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    async def verify_cookbook_index(self) -> bool:
        """Verify cookbook index was updated."""
        self.log("\nVerifying cookbook index...")
        
        index_path = COOKBOOK_PATH / "index.json"
        if not index_path.exists():
            self.log("✗ Index file missing")
            return False
        
        with open(index_path) as f:
            index = json.load(f)
        
        # Should have at least one entry
        if len(index) == 0:
            self.log("✗ Index is empty")
            return False
        
        self.log(f"✓ Index has {len(index)} entries")
        
        # Check first entry has required index fields
        first_entry = list(index.values())[0]
        required = ["id", "task_category", "complexity", "total_steps"]
        
        for field in required:
            if field not in first_entry:
                self.log(f"✗ Index entry missing field: {field}")
                return False
        
        self.log("✓ Index entries have all required fields")
        return True
    
    async def run_all(self) -> bool:
        """Run all cookbook tests."""
        self.log("="*60)
        self.log("Cookbook Promotion E2E Test")
        self.log("="*60)
        
        # Check gateway
        try:
            response = httpx.get(f"{BASE_URL}/health", timeout=5.0)
            if response.status_code != 200:
                self.log("✗ Gateway not running")
                return False
            self.log(f"✓ Gateway running (v{response.json()['version']})")
        except Exception as e:
            self.log(f"✗ Gateway not accessible: {e}")
            return False
        
        # Clean up old cookbook
        if COOKBOOK_PATH.exists():
            import shutil
            shutil.rmtree(COOKBOOK_PATH)
        COOKBOOK_PATH.mkdir(parents=True, exist_ok=True)
        
        # Run tests
        passed = 0
        failed = 0
        
        # Test 1: Run workflow
        if await self.run_successful_workflow():
            passed += 1
        else:
            failed += 1
            return False  # Can't continue without workflow
        
        # Test 2: Promote to cookbook
        if await self.promote_to_cookbook():
            passed += 1
        else:
            failed += 1
        
        # Test 3: Verify index
        if await self.verify_cookbook_index():
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
    print("Cookbook Promotion E2E Verification")
    print("="*60)
    
    test = CookbookE2ETest()
    success = asyncio.run(test.run_all())
    
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
