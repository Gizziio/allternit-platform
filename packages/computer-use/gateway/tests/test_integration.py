#!/usr/bin/env python3
"""
Integration Test: GIZZI Tool -> Gateway -> Playwright

Tests the complete chain:
1. Tool schema matches gateway API
2. Gateway accepts tool-shaped requests
3. Screenshots are properly formatted for GIZZI attachments
"""

import httpx
import base64
import json
import sys

BASE_URL = "http://127.0.0.1:8080"


def test_gizzi_style_request():
    """Test that gateway accepts requests shaped like GIZZI tool calls."""
    print("\n1. Testing GIZZI-style request...")
    
    # Simulate what the GIZZI tool sends
    gizzi_request = {
        "action": "goto",
        "session_id": "gizzi_test_session",
        "run_id": "gizzi_test_session",  # GIZZI uses sessionID as run_id
        "target": "https://example.com",
        "goal": None,
        "parameters": {},
        "adapter_preference": None
    }
    
    response = httpx.post(
        f"{BASE_URL}/v1/execute",
        json=gizzi_request,
        timeout=30.0
    )
    
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    
    data = response.json()
    assert data["status"] == "completed"
    assert data["session_id"] == "gizzi_test_session"
    assert data["run_id"] == "gizzi_test_session"
    print("   ✓ Gateway accepts GIZZI-style requests")
    
    return data["session_id"]


def test_screenshot_attachment_format():
    """Test screenshot is formatted for GIZZI attachment."""
    print("\n2. Testing screenshot attachment format...")
    
    session_id = "gizzi_ss_test"
    
    # Navigate
    httpx.post(
        f"{BASE_URL}/v1/execute",
        json={
            "action": "goto",
            "session_id": session_id,
            "run_id": session_id,
            "target": "https://example.com"
        },
        timeout=30.0
    )
    
    # Screenshot
    response = httpx.post(
        f"{BASE_URL}/v1/execute",
        json={
            "action": "screenshot",
            "session_id": session_id,
            "run_id": session_id
        },
        timeout=30.0
    )
    
    data = response.json()
    assert data["status"] == "completed"
    assert len(data["artifacts"]) == 1
    
    artifact = data["artifacts"][0]
    
    # Verify GIZZI attachment format
    assert artifact["type"] == "screenshot"
    assert artifact["mime"] == "image/png"
    assert artifact["url"].startswith("data:image/png;base64,")
    
    # Verify valid PNG
    b64_data = artifact["url"].replace("data:image/png;base64,", "")
    png_bytes = base64.b64decode(b64_data)
    assert png_bytes[:8] == b"\x89PNG\r\n\x1a\n"
    
    # Verify size is reasonable
    size_kb = len(png_bytes) / 1024
    assert 1 < size_kb < 5000, f"Screenshot size {size_kb}KB seems wrong"
    
    print(f"   ✓ Screenshot valid: {size_kb:.1f}KB PNG")
    print(f"   ✓ Data URL format correct for GIZZI attachment")


def test_receipt_audit_trail():
    """Test receipts provide proper audit trail."""
    print("\n3. Testing receipt audit trail...")
    
    session_id = "gizzi_audit_test"
    
    response = httpx.post(
        f"{BASE_URL}/v1/execute",
        json={
            "action": "goto",
            "session_id": session_id,
            "run_id": session_id,
            "target": "https://example.com"
        },
        timeout=30.0
    )
    
    data = response.json()
    receipts = data.get("receipts", [])
    
    assert len(receipts) > 0, "Expected at least one receipt"
    
    receipt = receipts[0]
    required_fields = ["action", "timestamp", "success"]
    for field in required_fields:
        assert field in receipt, f"Missing receipt field: {field}"
    
    assert receipt["action"] == "goto"
    assert receipt["success"] is True
    
    print(f"   ✓ Receipt has action: {receipt['action']}")
    print(f"   ✓ Receipt has timestamp: {receipt['timestamp']}")
    print(f"   ✓ Receipt has success: {receipt['success']}")


def test_adapter_response_fields():
    """Test all adapter response fields needed by GIZZI."""
    print("\n4. Testing adapter response fields...")
    
    session_id = "gizzi_fields_test"
    
    response = httpx.post(
        f"{BASE_URL}/v1/execute",
        json={
            "action": "goto",
            "session_id": session_id,
            "run_id": session_id,
            "target": "https://example.com"
        },
        timeout=30.0
    )
    
    data = response.json()
    
    # Fields the GIZZI tool expects
    required = {
        "run_id": str,
        "session_id": str,
        "adapter_id": str,
        "family": str,
        "mode": str,
        "status": str,
        "summary": str,
        "artifacts": list,
        "receipts": list,
        "trace_id": str,
    }
    
    for field, expected_type in required.items():
        assert field in data, f"Missing field: {field}"
        if data[field] is not None:
            assert isinstance(data[field], expected_type), \
                f"Field {field} has wrong type: {type(data[field])}"
    
    print("   ✓ All required fields present")
    print(f"   ✓ Adapter: {data['adapter_id']}")
    print(f"   ✓ Family: {data['family']}")
    print(f"   ✓ Mode: {data['mode']}")


def test_error_response_format():
    """Test error responses match expected format."""
    print("\n5. Testing error response format...")
    
    session_id = "gizzi_error_test"
    
    # Request without target should fail validation
    response = httpx.post(
        f"{BASE_URL}/v1/execute",
        json={
            "action": "goto",
            "session_id": session_id,
            "run_id": session_id
        },
        timeout=10.0
    )
    
    # Validation errors return 400
    assert response.status_code == 400
    error = response.json()
    assert "detail" in error
    print(f"   ✓ Validation error: {error['detail']}")
    
    # Runtime errors return 200 with status: failed
    response = httpx.post(
        f"{BASE_URL}/v1/execute",
        json={
            "action": "goto",
            "session_id": session_id,
            "run_id": session_id,
            "target": "https://invalid-domain-12345.example"
        },
        timeout=30.0
    )
    
    data = response.json()
    assert data["status"] == "failed"
    assert "error" in data
    assert "code" in data["error"]
    assert "message" in data["error"]
    
    print(f"   ✓ Runtime error code: {data['error']['code']}")
    print(f"   ✓ Runtime error message: {data['error']['message'][:50]}...")


def main():
    print("="*60)
    print("GIZZI Integration Test Suite")
    print("="*60)
    
    # Check gateway
    try:
        response = httpx.get(f"{BASE_URL}/health", timeout=5.0)
        if response.status_code != 200:
            print(f"\n✗ Gateway not healthy: {response.status_code}")
            sys.exit(1)
        print(f"\n✓ Gateway running (v{response.json()['version']})")
    except Exception as e:
        print(f"\n✗ Gateway not accessible: {e}")
        sys.exit(1)
    
    passed = 0
    failed = 0
    
    tests = [
        test_gizzi_style_request,
        test_screenshot_attachment_format,
        test_receipt_audit_trail,
        test_adapter_response_fields,
        test_error_response_format,
    ]
    
    for test in tests:
        try:
            test()
            passed += 1
        except Exception as e:
            failed += 1
            print(f"   ✗ FAILED: {e}")
    
    print("\n" + "="*60)
    print(f"Results: {passed} passed, {failed} failed")
    print("="*60)
    
    return failed == 0


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
