#!/usr/bin/env python3
"""
Allternit Computer Use Gateway - Conformance Test Runner

Standalone test runner (no pytest required).
Tests gateway contract with clear pass/fail output.

Usage: python tests/run_conformance.py
"""

import sys
import httpx
import base64
import time
from typing import Dict, Any, List, Tuple, Callable

BASE_URL = "http://127.0.0.1:8080"

# ANSI colors
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
BLUE = "\033[94m"
RESET = "\033[0m"


def print_success(msg: str):
    print(f"{GREEN}✓{RESET} {msg}")


def print_failure(msg: str):
    print(f"{RED}✗{RESET} {msg}")


def print_info(msg: str):
    print(f"{BLUE}ℹ{RESET} {msg}")


def print_warning(msg: str):
    print(f"{YELLOW}⚠{RESET} {msg}")


class TestRunner:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.errors: List[str] = []
    
    def run(self, name: str, test_fn: Callable[[], bool]):
        """Run a single test."""
        try:
            print(f"  Testing {name}... ", end="", flush=True)
            if test_fn():
                self.passed += 1
                print_success("PASS")
                return True
            else:
                self.failed += 1
                print_failure("FAIL")
                return False
        except Exception as e:
            self.failed += 1
            self.errors.append(f"{name}: {e}")
            print_failure(f"ERROR: {e}")
            return False
    
    def summary(self):
        """Print test summary."""
        print(f"\n{'='*50}")
        print(f"Results: {self.passed} passed, {self.failed} failed")
        if self.errors:
            print(f"\nErrors:")
            for err in self.errors:
                print(f"  - {err}")
        print(f"{'='*50}\n")
        return self.failed == 0


def test_health_endpoint() -> bool:
    """Test health endpoint returns ok."""
    response = httpx.get(f"{BASE_URL}/health", timeout=5.0)
    if response.status_code != 200:
        return False
    
    data = response.json()
    return (
        data.get("status") == "ok" and
        "version" in data and
        data.get("playwright") == "enabled"
    )


def test_goto_success() -> bool:
    """Test goto navigates successfully."""
    session_id = f"goto_{int(time.time())}"
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
    
    if response.status_code != 200:
        return False
    
    data = response.json()
    return (
        data.get("status") == "completed" and
        data.get("adapter_id") == "browser.playwright" and
        data["extracted_content"].get("title") == "Example Domain"
    )


def test_validation_error() -> bool:
    """Test goto without target returns 400."""
    response = httpx.post(
        f"{BASE_URL}/v1/execute",
        json={
            "action": "goto",
            "session_id": "validation_test",
            "run_id": "validation_test"
        },
        timeout=5.0
    )
    return response.status_code == 400


def test_screenshot_format() -> bool:
    """Test screenshot returns valid base64 PNG."""
    session_id = f"ss_{int(time.time())}"
    response = httpx.post(
        f"{BASE_URL}/v1/execute",
        json={
            "action": "screenshot",
            "session_id": session_id,
            "run_id": session_id,
            "target": "https://example.com"
        },
        timeout=30.0
    )
    
    if response.status_code != 200:
        return False
    
    data = response.json()
    artifacts = data.get("artifacts", [])
    if not artifacts:
        return False
    
    artifact = artifacts[0]
    if artifact.get("type") != "screenshot" or artifact.get("mime") != "image/png":
        return False
    
    url = artifact.get("url", "")
    if not url.startswith("data:image/png;base64,"):
        return False
    
    # Verify valid PNG
    try:
        b64_data = url.replace("data:image/png;base64,", "")
        png_bytes = base64.b64decode(b64_data)
        return png_bytes[:8] == b"\x89PNG\r\n\x1a\n"
    except Exception:
        return False


def test_session_persistence() -> bool:
    """Test session persists across actions."""
    session_id = f"persist_{int(time.time())}"
    
    # First action: goto
    r1 = httpx.post(
        f"{BASE_URL}/v1/execute",
        json={
            "action": "goto",
            "session_id": session_id,
            "run_id": f"{session_id}_1",
            "target": "https://httpbin.org/get"
        },
        timeout=30.0
    )
    
    if r1.json().get("status") != "completed":
        return False
    
    # Second action: inspect (no target, uses session)
    r2 = httpx.post(
        f"{BASE_URL}/v1/execute",
        json={
            "action": "inspect",
            "session_id": session_id,
            "run_id": f"{session_id}_2"
        },
        timeout=10.0
    )
    
    if r2.json().get("status") != "completed":
        return False
    
    # Verify we got the right URL
    content = r2.json().get("extracted_content", {})
    return "httpbin.org" in content.get("url", "")


def test_inspect_structure() -> bool:
    """Test inspect returns page structure."""
    session_id = f"inspect_{int(time.time())}"
    
    # Navigate
    httpx.post(
        f"{BASE_URL}/v1/execute",
        json={
            "action": "goto",
            "session_id": session_id,
            "run_id": f"{session_id}_1",
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
            "run_id": f"{session_id}_2"
        },
        timeout=10.0
    )
    
    data = response.json()
    if data.get("status") != "completed":
        return False
    
    content = data.get("extracted_content", {})
    required = ["url", "title", "forms", "links", "inputs"]
    return all(field in content for field in required)


def test_extract_structure() -> bool:
    """Test extract returns structured data."""
    session_id = f"extract_{int(time.time())}"
    
    # Navigate
    httpx.post(
        f"{BASE_URL}/v1/execute",
        json={
            "action": "goto",
            "session_id": session_id,
            "run_id": f"{session_id}_1",
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
            "run_id": f"{session_id}_2",
            "parameters": {"format": "json"}
        },
        timeout=10.0
    )
    
    data = response.json()
    if data.get("status") != "completed":
        return False
    
    content = data.get("extracted_content", {})
    return "title" in content and "url" in content


def test_response_contract() -> bool:
    """Test response has all required fields."""
    session_id = f"contract_{int(time.time())}"
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
    required = [
        "run_id", "session_id", "adapter_id", "family",
        "mode", "status", "summary", "artifacts",
        "receipts", "trace_id"
    ]
    
    return all(field in data for field in required)


def test_receipt_structure() -> bool:
    """Test receipts have correct structure."""
    session_id = f"receipt_{int(time.time())}"
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
    if not receipts:
        return False
    
    receipt = receipts[0]
    return (
        "action" in receipt and
        "timestamp" in receipt and
        isinstance(receipt.get("success"), bool)
    )


def test_close_session() -> bool:
    """Test close action closes session."""
    session_id = f"close_{int(time.time())}"
    
    # Create session
    httpx.post(
        f"{BASE_URL}/v1/execute",
        json={
            "action": "goto",
            "session_id": session_id,
            "run_id": f"{session_id}_1",
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
            "run_id": f"{session_id}_2"
        },
        timeout=10.0
    )
    
    data = response.json()
    return data.get("status") == "completed"


def main():
    print("\n" + "="*60)
    print("Allternit Computer Use Gateway - Conformance Tests")
    print("="*60 + "\n")
    
    # Check gateway
    print("Checking gateway...")
    try:
        response = httpx.get(f"{BASE_URL}/health", timeout=5.0)
        if response.status_code == 200:
            data = response.json()
            print_success(f"Gateway running (v{data['version']})")
            print_info(f"Sessions: {data['sessions']['active']}/{data['sessions']['max']} active")
        else:
            print_failure(f"Gateway responded with {response.status_code}")
            sys.exit(1)
    except Exception as e:
        print_failure(f"Gateway not accessible: {e}")
        print_info(f"Start gateway with: uvicorn main:app --host 127.0.0.1 --port 8080")
        sys.exit(1)
    
    print()
    
    # Run tests
    runner = TestRunner()
    
    print("Health & Validation:")
    runner.run("health endpoint", test_health_endpoint)
    runner.run("validation error", test_validation_error)
    
    print("\nCore Actions:")
    runner.run("goto success", test_goto_success)
    runner.run("screenshot format", test_screenshot_format)
    
    print("\nSession Management:")
    runner.run("session persistence", test_session_persistence)
    runner.run("close session", test_close_session)
    
    print("\nData Extraction:")
    runner.run("inspect structure", test_inspect_structure)
    runner.run("extract structure", test_extract_structure)
    
    print("\nContract Compliance:")
    runner.run("response fields", test_response_contract)
    runner.run("receipt structure", test_receipt_structure)
    
    # Summary
    success = runner.summary()
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
