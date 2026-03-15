"""
A2R Computer Use Gateway - Conformance Test Suite

Tests the gateway contract including:
- Health endpoint
- All browser actions
- Error handling
- Session persistence
- Artifact formats

Run: python -m pytest tests/test_conformance.py -v
"""

import pytest
import httpx
import base64
import time
from typing import Dict, Any

BASE_URL = "http://127.0.0.1:8080"


class TestHealth:
    """Test health endpoint."""
    
    def test_health_returns_ok(self):
        """Health endpoint should return status ok."""
        response = httpx.get(f"{BASE_URL}/health")
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "ok"
        assert "version" in data
        assert "playwright" in data
        assert data["playwright"] == "enabled"
        assert "sessions" in data
    
    def test_health_includes_session_stats(self):
        """Health should include session statistics."""
        response = httpx.get(f"{BASE_URL}/health")
        data = response.json()
        
        sessions = data["sessions"]
        assert "active" in sessions
        assert "max" in sessions
        assert isinstance(sessions["active"], int)
        assert isinstance(sessions["max"], int)


class TestValidationErrors:
    """Test request validation."""
    
    def test_goto_missing_target_returns_400(self):
        """goto without target should return 400."""
        response = httpx.post(
            f"{BASE_URL}/v1/execute",
            json={
                "action": "goto",
                "session_id": "test_validation",
                "run_id": "test_validation"
            }
        )
        assert response.status_code == 400
        assert "target is required" in response.json()["detail"]
    
    def test_click_missing_target_returns_400(self):
        """click without target should return 400."""
        response = httpx.post(
            f"{BASE_URL}/v1/execute",
            json={
                "action": "click",
                "session_id": "test_validation",
                "run_id": "test_validation"
            }
        )
        assert response.status_code == 400
    
    def test_fill_missing_text_returns_400(self):
        """fill without text should return 400."""
        response = httpx.post(
            f"{BASE_URL}/v1/execute",
            json={
                "action": "fill",
                "session_id": "test_validation",
                "run_id": "test_validation",
                "target": "#input"
            }
        )
        assert response.status_code == 400
        assert "text is required" in response.json()["detail"]
    
    def test_execute_missing_goal_returns_400(self):
        """execute without goal should return 400."""
        response = httpx.post(
            f"{BASE_URL}/v1/execute",
            json={
                "action": "execute",
                "session_id": "test_validation",
                "run_id": "test_validation"
            }
        )
        assert response.status_code == 400


class TestGotoAction:
    """Test goto action."""
    
    def test_goto_success(self):
        """goto should navigate successfully."""
        response = httpx.post(
            f"{BASE_URL}/v1/execute",
            json={
                "action": "goto",
                "session_id": "test_goto_001",
                "run_id": "test_goto_001",
                "target": "https://example.com"
            },
            timeout=30.0
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "completed"
        assert data["adapter_id"] == "browser.playwright"
        assert "example.com" in data["summary"]
        assert data["extracted_content"]["title"] == "Example Domain"
        assert len(data["receipts"]) == 1
        assert data["receipts"][0]["success"] is True
    
    def test_goto_invalid_domain(self):
        """goto to invalid domain should fail gracefully."""
        response = httpx.post(
            f"{BASE_URL}/v1/execute",
            json={
                "action": "goto",
                "session_id": "test_goto_error",
                "run_id": "test_goto_error",
                "target": "https://invalid-domain-that-does-not-exist-12345.example"
            },
            timeout=30.0
        )
        assert response.status_code == 200  # Returns 200 with status: failed
        
        data = response.json()
        assert data["status"] == "failed"
        assert "error" in data
        assert data["error"]["code"] in ["DNS_ERROR", "NAVIGATION_ERROR"]
        assert data["receipts"][0]["success"] is False


class TestScreenshotAction:
    """Test screenshot action."""
    
    def test_screenshot_with_target(self):
        """screenshot with target should navigate and capture."""
        response = httpx.post(
            f"{BASE_URL}/v1/execute",
            json={
                "action": "screenshot",
                "session_id": "test_screenshot_001",
                "run_id": "test_screenshot_001",
                "target": "https://example.com"
            },
            timeout=30.0
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "completed"
        assert len(data["artifacts"]) == 1
        
        artifact = data["artifacts"][0]
        assert artifact["type"] == "screenshot"
        assert artifact["mime"] == "image/png"
        assert artifact["url"].startswith("data:image/png;base64,")
        
        # Verify valid PNG
        b64_data = artifact["url"].replace("data:image/png;base64,", "")
        png_bytes = base64.b64decode(b64_data)
        assert png_bytes[:8] == b"\x89PNG\r\n\x1a\n"  # PNG magic
    
    def test_screenshot_without_target_uses_session(self):
        """screenshot without target should use current page."""
        session_id = "test_screenshot_session"
        
        # First navigate
        httpx.post(
            f"{BASE_URL}/v1/execute",
            json={
                "action": "goto",
                "session_id": session_id,
                "run_id": "test_screenshot_002",
                "target": "https://example.com"
            },
            timeout=30.0
        )
        
        # Then screenshot without target
        response = httpx.post(
            f"{BASE_URL}/v1/execute",
            json={
                "action": "screenshot",
                "session_id": session_id,
                "run_id": "test_screenshot_003"
            },
            timeout=30.0
        )
        
        data = response.json()
        assert data["status"] == "completed"
        assert len(data["artifacts"]) == 1


class TestSessionPersistence:
    """Test session persistence across actions."""
    
    def test_session_reused_across_actions(self):
        """Same session_id should reuse browser context."""
        session_id = f"test_persist_{int(time.time())}"
        
        # Action 1: goto
        r1 = httpx.post(
            f"{BASE_URL}/v1/execute",
            json={
                "action": "goto",
                "session_id": session_id,
                "run_id": "persist_001",
                "target": "https://httpbin.org/get"
            },
            timeout=30.0
        )
        assert r1.json()["status"] == "completed"
        
        # Action 2: inspect (uses same session)
        r2 = httpx.post(
            f"{BASE_URL}/v1/execute",
            json={
                "action": "inspect",
                "session_id": session_id,
                "run_id": "persist_002"
            },
            timeout=10.0
        )
        assert r2.json()["status"] == "completed"
        assert "httpbin.org" in r2.json()["extracted_content"]["url"]
        
        # Check health shows 1 active session
        health = httpx.get(f"{BASE_URL}/health").json()
        assert health["sessions"]["active"] >= 1
    
    def test_multiple_sessions_isolated(self):
        """Different session_ids should be isolated."""
        session_a = f"test_isolated_a_{int(time.time())}"
        session_b = f"test_isolated_b_{int(time.time())}"
        
        # Create session A
        httpx.post(
            f"{BASE_URL}/v1/execute",
            json={
                "action": "goto",
                "session_id": session_a,
                "run_id": "iso_001",
                "target": "https://example.com"
            },
            timeout=30.0
        )
        
        # Create session B
        httpx.post(
            f"{BASE_URL}/v1/execute",
            json={
                "action": "goto",
                "session_id": session_b,
                "run_id": "iso_002",
                "target": "https://httpbin.org/get"
            },
            timeout=30.0
        )
        
        # Verify both exist
        health = httpx.get(f"{BASE_URL}/health").json()
        assert health["sessions"]["active"] >= 2


class TestResponseContract:
    """Test that response matches contract."""
    
    def test_response_has_required_fields(self):
        """Response must have all contract fields."""
        response = httpx.post(
            f"{BASE_URL}/v1/execute",
            json={
                "action": "goto",
                "session_id": "test_contract",
                "run_id": "test_contract",
                "target": "https://example.com"
            },
            timeout=30.0
        )
        
        data = response.json()
        required_fields = [
            "run_id", "session_id", "adapter_id", "family",
            "mode", "status", "summary", "artifacts",
            "receipts", "trace_id"
        ]
        
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"
        
        # Verify types
        assert isinstance(data["artifacts"], list)
        assert isinstance(data["receipts"], list)
        assert data["status"] in ["completed", "failed", "pending", "cancelled"]
    
    def test_receipt_structure(self):
        """Receipts must have correct structure."""
        response = httpx.post(
            f"{BASE_URL}/v1/execute",
            json={
                "action": "goto",
                "session_id": "test_receipt",
                "run_id": "test_receipt",
                "target": "https://example.com"
            },
            timeout=30.0
        )
        
        data = response.json()
        assert len(data["receipts"]) > 0
        
        receipt = data["receipts"][0]
        assert "action" in receipt
        assert "timestamp" in receipt
        assert "success" in receipt
        assert isinstance(receipt["success"], bool)


class TestInspectAction:
    """Test inspect action."""
    
    def test_inspect_returns_structure(self):
        """inspect should return page structure."""
        session_id = f"test_inspect_{int(time.time())}"
        
        # Navigate first
        httpx.post(
            f"{BASE_URL}/v1/execute",
            json={
                "action": "goto",
                "session_id": session_id,
                "run_id": "inspect_001",
                "target": "https://example.com"
            },
            timeout=30.0
        )
        
        # Inspect
        response = httpx.post(
            f"{BASE_URL}/v1/execute",
            json={
                "action": "inspect",
                "session_id": session_id,
                "run_id": "inspect_002"
            },
            timeout=10.0
        )
        
        data = response.json()
        assert data["status"] == "completed"
        
        content = data["extracted_content"]
        assert "url" in content
        assert "title" in content
        assert "forms" in content
        assert "links" in content
        assert "inputs" in content


class TestExtractAction:
    """Test extract action."""
    
    def test_extract_json_format(self):
        """extract with JSON format should return structure."""
        session_id = f"test_extract_{int(time.time())}"
        
        # Navigate
        httpx.post(
            f"{BASE_URL}/v1/execute",
            json={
                "action": "goto",
                "session_id": session_id,
                "run_id": "extract_001",
                "target": "https://example.com"
            },
            timeout=30.0
        )
        
        # Extract
        response = httpx.post(
            f"{BASE_URL}/v1/execute",
            json={
                "action": "extract",
                "session_id": session_id,
                "run_id": "extract_002",
                "parameters": {"format": "json"}
            },
            timeout=10.0
        )
        
        data = response.json()
        assert data["status"] == "completed"
        
        content = data["extracted_content"]
        assert "title" in content
        assert "url" in content
        assert "headings" in content
        assert "links" in content


class TestCloseAction:
    """Test close action."""
    
    def test_close_session(self):
        """close should close the session."""
        session_id = f"test_close_{int(time.time())}"
        
        # Create session
        httpx.post(
            f"{BASE_URL}/v1/execute",
            json={
                "action": "goto",
                "session_id": session_id,
                "run_id": "close_001",
                "target": "https://example.com"
            },
            timeout=30.0
        )
        
        # Close
        response = httpx.post(
            f"{BASE_URL}/v1/execute",
            json={
                "action": "close",
                "session_id": session_id,
                "run_id": "close_002"
            },
            timeout=10.0
        )
        
        data = response.json()
        assert data["status"] == "completed"
        assert data["receipts"][0]["success"] is True


def run_tests():
    """Run all conformance tests."""
    import sys
    
    # Check if pytest is available
    try:
        import pytest
    except ImportError:
        print("pytest not installed. Install with: pip install pytest")
        sys.exit(1)
    
    # Check gateway is running
    try:
        response = httpx.get(f"{BASE_URL}/health")
        if response.status_code != 200:
            print(f"Gateway not responding correctly: {response.status_code}")
            sys.exit(1)
        print(f"✓ Gateway running (version: {response.json()['version']})")
    except Exception as e:
        print(f"Gateway not running at {BASE_URL}: {e}")
        print("Start gateway with: uvicorn main:app --host 127.0.0.1 --port 8080")
        sys.exit(1)
    
    # Run tests
    print("\nRunning conformance tests...\n")
    exit_code = pytest.main([__file__, "-v", "--tb=short"])
    sys.exit(exit_code)


if __name__ == "__main__":
    run_tests()
