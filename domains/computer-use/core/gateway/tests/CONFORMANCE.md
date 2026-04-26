# Allternit Computer Use Gateway - Conformance Test Suite

## Overview

Automated validation suite for the Computer Use Gateway contract. Tests health, actions, sessions, and response format compliance.

## Quick Start

```bash
# Run all tests
python3 tests/run_conformance.py

# Or with pytest (if installed)
python3 -m pytest tests/test_conformance.py -v
```

## Test Coverage

| Test Category | Count | Tests |
|--------------|-------|-------|
| Health & Validation | 2 | Health endpoint, Validation errors |
| Core Actions | 2 | goto, screenshot |
| Session Management | 2 | Persistence, Close |
| Data Extraction | 2 | inspect, extract |
| Contract Compliance | 2 | Response fields, Receipt structure |
| **Total** | **10** | **All passing** |

## Test Details

### Health & Validation

- **test_health_endpoint**: Verifies `/health` returns status ok, version, playwright enabled, session stats
- **test_validation_error**: Verifies missing parameters return 400 with clear message

### Core Actions

- **test_goto_success**: Navigates to example.com, verifies title extraction, adapter_id, receipts
- **test_screenshot_format**: Captures screenshot, validates PNG magic bytes, base64 encoding

### Session Management

- **test_session_persistence**: Verifies same session_id reuses context across actions
- **test_close_session**: Verifies close action terminates session properly

### Data Extraction

- **test_inspect_structure**: Returns page metadata (url, title, forms, links, inputs)
- **test_extract_structure**: Returns structured JSON content

### Contract Compliance

- **test_response_fields**: All required fields present (run_id, session_id, adapter_id, etc.)
- **test_receipt_structure**: Receipts have action, timestamp, success boolean

## Gateway Requirements

- Running on `http://127.0.0.1:8080`
- Version 0.3.0 or higher
- Playwright enabled
- Network access for test URLs (example.com, httpbin.org)

## Sample Output

```
============================================================
Allternit Computer Use Gateway - Conformance Tests
============================================================

Checking gateway...
✓ Gateway running (v0.3.0)
ℹ Sessions: 2/10 active

Health & Validation:
  Testing health endpoint... ✓ PASS
  Testing validation error... ✓ PASS

Core Actions:
  Testing goto success... ✓ PASS
  Testing screenshot format... ✓ PASS

Session Management:
  Testing session persistence... ✓ PASS
  Testing close session... ✓ PASS

Data Extraction:
  Testing inspect structure... ✓ PASS
  Testing extract structure... ✓ PASS

Contract Compliance:
  Testing response fields... ✓ PASS
  Testing receipt structure... ✓ PASS

==================================================
Results: 10 passed, 0 failed
==================================================
```

## Adding New Tests

Add tests to `tests/run_conformance.py`:

```python
def test_new_feature() -> bool:
    """Test description."""
    response = httpx.post(f"{BASE_URL}/v1/execute", ...)
    data = response.json()
    return data.get("status") == "completed"

# In main():
runner.run("new feature", test_new_feature)
```
