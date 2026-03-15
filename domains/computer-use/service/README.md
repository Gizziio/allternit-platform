# A2R Operator Service

Unified service for A2R automation capabilities, combining browser automation, computer control, desktop automation, and parallel execution.

## Overview

A2R Operator provides four main automation modes:

| Mode | Description | Use Case |
|------|-------------|----------|
| **Browser-Use** | Agent-based browser automation with LLM reasoning | Web scraping, form filling, research |
| **Playwright** | Fast headless browser control | Quick scraping, simple interactions |
| **Computer-Use** | Vision-based computer control | GUI automation with visual reasoning |
| **Desktop-Use** | Desktop automation via A2R Vision | Native app control, OS-level automation |

## Architecture

```
A2R Operator (Port 3008)
├── Browser-Use (Chromium + CDP)
│   ├── browser-use mode: Full agent with reasoning
│   ├── playwright mode: Fast headless control
│   └── computer-use mode: Vision-based interactions
├── Desktop-Use (A2R Vision)
│   └── Vision-based desktop automation
└── Parallel Execution
    └── Multi-variant task execution
```

## Installation

```bash
# Install dependencies
pip install -r requirements.txt

# Install Chromium for Playwright
playwright install chromium

# Set environment variables
export OPENAI_API_KEY="your-openai-key"
export A2R_VISION_INFERENCE_KEY="your-vision-key"
export A2R_OPERATOR_API_KEY="your-operator-key"
```

## Environment Variables

```bash
# Required
OPENAI_API_KEY=sk-...                    # For browser-use agent reasoning
A2R_VISION_INFERENCE_KEY=sk-...          # For vision model
A2R_OPERATOR_API_KEY=a2r-operator-key    # API key for operator

# Optional
A2R_OPERATOR_PORT=3008                   # Service port (default: 3008)
A2R_OPERATOR_HOST=127.0.0.1              # Service host (default: 127.0.0.1)
A2R_BROWSER_MODEL=gpt-4o                 # Model for browser agent (default: gpt-4o)
A2R_VISION_MODEL_NAME=qwen2-vl-72b       # Vision model (default: a2r-vision-7b)
BRAIN_GATEWAY_URL=http://localhost:3000  # Brain gateway endpoint
```

## Running the Service

```bash
cd /Users/macbook/Desktop/a2rchitech-workspace/a2rchitech/4-services/a2r-operator
python -m uvicorn src.main:app --reload --port 3008
```

## API Endpoints

### Health Check
```bash
GET /health
```

### Browser-Use Endpoints

#### Create Browser Task
```bash
POST /v1/browser/tasks
{
  "goal": "Search for quantum computing news",
  "url": "https://duckduckgo.com/?q=quantum+computing",
  "mode": "browser-use"  // or "playwright", "computer-use"
}
```

#### Execute Task
```bash
POST /v1/browser/tasks/{task_id}/execute
```

#### Search (replaces paid APIs)
```bash
POST /v1/browser/search
{
  "query": "quantum computing",
  "search_engine": "duckduckgo"
}
```

#### Retrieve URL (replaces Firecrawl)
```bash
POST /v1/browser/retrieve
{
  "url": "https://example.com"
}
```

### Desktop/Computer-Use Endpoints

#### Vision Propose
```bash
POST /v1/vision/propose
{
  "session_id": "test-session",
  "task": "Click the Calculator icon",
  "screenshot": "base64...",
  "viewport": {"w": 1920, "h": 1080}
}
```

#### Execute Desktop Task
```bash
POST /v1/sessions/{session_id}/desktop/execute
{
  "app": "Calculator",
  "instruction": "Open Calculator and compute 123 * 456",
  "use_vision": true
}
```

### Parallel Execution Endpoints (formerly Superconductor)

#### Create Parallel Run
```bash
POST /v1/parallel/runs
Authorization: Bearer a2r-operator-key
{
  "jobId": "run-123",
  "goal": "Implement responsive navbar",
  "variants": [
    {"variantId": "v1", "model": "claude-3.5-sonnet", "agentType": "code"},
    {"variantId": "v2", "model": "gpt-4o", "agentType": "code"}
  ]
}
```

#### Get Run Status
```bash
GET /v1/parallel/runs/{run_id}/status
```

#### Stream Events
```bash
GET /v1/parallel/runs/{run_id}/events
```

## Usage Examples

### Browser Automation
```python
import requests

# Search without paid APIs
response = requests.post("http://localhost:3008/v1/browser/search", json={
    "query": "latest AI developments"
})
results = response.json()

# Retrieve URL content
response = requests.post("http://localhost:3008/v1/browser/retrieve", json={
    "url": "https://example.com/article"
})
content = response.json()
```

### Desktop Automation
```python
# Control desktop apps
response = requests.post(
    "http://localhost:3008/v1/sessions/test/desktop/execute",
    json={
        "app": "Finder",
        "instruction": "Create a new folder called 'Project A'",
        "use_vision": True
    }
)
```

### Parallel Execution
```python
# Run multiple variants in parallel
response = requests.post(
    "http://localhost:3008/v1/parallel/runs",
    headers={"Authorization": "Bearer a2r-operator-key"},
    json={
        "jobId": "run-456",
        "goal": "Implement login form",
        "variants": [
            {"variantId": "claude", "model": "claude-3.5-sonnet"},
            {"variantId": "gpt4", "model": "gpt-4o"}
        ]
    }
)
```

## Migration from Superconductor

The A2R Operator replaces the separate Superconductor service:

| Old Endpoint | New Endpoint |
|--------------|--------------|
| `POST /runs` | `POST /v1/parallel/runs` |
| `GET /runs/{id}/status` | `GET /v1/parallel/runs/{id}/status` |
| `GET /runs/{id}/events` | `GET /v1/parallel/runs/{id}/events` |

## Benefits Over External APIs

| Feature | A2R Operator | Firecrawl/Tavily |
|---------|--------------|------------------|
| Cost | Free (local) | Paid per request |
| Rate Limits | None | Strict limits |
| Privacy | Local | External service |
| JS Rendering | Full | Limited |
| Custom Actions | Complete | API-limited |
| CDP Protocol | Yes | No |

## Project Structure

```
a2r-operator/
├── src/
│   ├── main.py                 # Unified FastAPI service
│   ├── brain_adapter.py        # Brain integration
│   ├── a2r_vision/            # A2R Vision module
│   │   ├── action_parser.py
│   │   └── prompt.py
│   └── browser_use/           # Browser automation module
│       ├── __init__.py
│       └── manager.py
├── requirements.txt
└── README.md
```

## Testing

```bash
# Health check
curl http://localhost:3008/health

# Browser health
curl http://localhost:3008/v1/browser/health

# Test search
curl -X POST http://localhost:3008/v1/browser/search \
  -H "Content-Type: application/json" \
  -d '{"query": "test"}'
```

## Notes

- **No paid API keys required** for browser search/retrieval
- Uses **Chromium + CDP** for browser automation
- **Three browser modes**: browser-use (agent), playwright (fast), computer-use (vision)
- **Desktop automation** uses A2R Vision for vision-based control
- **Parallel execution** rebranded from Superconductor

## A2R Usage telemetry dependencies

- Run `./scripts/bootstrap-operator-quickjs-venv.sh` from the repo root before starting the operator. The script creates `4-services/a2r-operator/.venv-a2r-usage`, activates it, and installs `quickjs` from `wheelhouse/quickjs-*.whl` if available (otherwise from PyPI). The operator depends on that virtualenv so the A2R Usage plugin engine always has QuickJS ready.
