# A2R Operator Architecture

## Overview

A2R Operator is the unified automation service for the A2rchitect platform, providing browser automation, computer control, desktop automation, and parallel execution capabilities.

**Service Port**: 3008  
**Service Name**: a2r-operator  
**Location**: `/4-services/a2r-operator/`

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           A2R Operator (Port 3008)                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      HTTP API Layer (FastAPI)                        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│           ┌────────────────────────┼────────────────────────┐              │
│           │                        │                        │              │
│           ▼                        ▼                        ▼              │
│  ┌─────────────────┐   ┌──────────────────┐   ┌──────────────────────┐    │
│  │   Browser-Use   │   │  Computer-Use    │   │   Parallel Execution │    │
│  │   (Chromium)    │   │  (Vision Model)  │   │   (Multi-Variant)    │    │
│  └────────┬────────┘   └────────┬─────────┘   └──────────┬───────────┘    │
│           │                     │                        │                │
│  ┌────────▼────────┐   ┌────────▼─────────┐   ┌──────────▼───────────┐    │
│  │  • browser-use  │   │  • A2R Vision    │   │  • Local Execution   │    │
│  │  • playwright   │   │  • Qwen2-VL      │   │  • Variant Manager   │    │
│  │  • computer-use │   │  • GPT-4V        │   │  • Event Streaming   │    │
│  └─────────────────┘   └──────────────────┘   └──────────────────────┘    │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    Desktop-Use (A2R Vision)                          │   │
│  │  • Native App Control  • OS-Level Automation  • Vision-Based         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CDP Protocol (Chrome DevTools)                       │
│                    Used by browser-use and playwright modes                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Service Capabilities

### 1. Browser-Use (Web Automation)

**Purpose**: Agent-based web browser automation

**Three Modes**:

| Mode | Description | Use Case | Speed |
|------|-------------|----------|-------|
| `browser-use` | Full LLM agent with reasoning | Complex multi-step tasks | Slower |
| `playwright` | Direct browser control | Fast scraping, simple tasks | Fast |
| `computer-use` | Vision-based interactions | Visual reasoning tasks | Moderate |

**Technology Stack**:
- **Engine**: Chromium with CDP (Chrome DevTools Protocol)
- **Agent Library**: browser-use (Python)
- **Browser Control**: Playwright
- **LLM**: GPT-4o (configurable)

**Endpoints**:
```
GET  /v1/browser/health              # Health check
POST /v1/browser/tasks               # Create browser task
POST /v1/browser/tasks/{id}/execute  # Execute task
GET  /v1/browser/tasks/{id}          # Get task status
POST /v1/browser/search              # Web search (replaces Tavily)
POST /v1/browser/retrieve            # URL retrieval (replaces Firecrawl)
```

### 2. Computer-Use (Vision Control)

**Purpose**: Vision-based computer control using AI models

**Technology Stack**:
- **Vision Models**: A2R Vision, Qwen2-VL, GPT-4V
- **Input**: Screenshots
- **Output**: Mouse/keyboard actions

**Endpoints**:
```
POST /v1/vision/propose              # Get action proposals from screenshot
POST /v1/sessions/{id}/computer/execute  # Execute computer task
```

### 3. Desktop-Use (OS Automation)

**Purpose**: Native desktop application control

**Technology Stack**:
- **Engine**: A2R Vision
- **Control**: Native OS APIs
- **Vision**: Screenshot-based reasoning

**Endpoints**:
```
POST /v1/sessions/{id}/desktop/execute   # Execute desktop task
GET  /v1/sessions/{id}/context       # Get session context
```

### 4. Parallel Execution (Multi-Variant)

**Purpose**: Execute multiple AI variants in parallel

**Technology Stack**:
- **Execution**: Async Python
- **Models**: Claude, GPT-4o, Gemini, etc.
- **Streaming**: Server-Sent Events (SSE)

**Endpoints**:
```
POST /v1/parallel/runs               # Create parallel run
GET  /v1/parallel/runs/{id}/status   # Get run status
GET  /v1/parallel/runs/{id}/results  # Get results
GET  /v1/parallel/runs/{id}/events   # Stream events (SSE)
```

## Project Structure

```
/4-services/a2r-operator/
├── src/
│   ├── main.py                    # Main FastAPI application
│   ├── brain_adapter.py           # Brain gateway integration
│   ├── a2r_vision/               # Desktop/Computer-Use modules
│   │   ├── __init__.py
│   │   ├── action_parser.py      # Parse VLM actions
│   │   └── prompt.py             # Prompt templates
│   └── browser_use/              # Browser-Use modules
│       ├── __init__.py
│       └── manager.py            # Browser automation manager
├── .a2r/receipts/                # Generated receipts
├── requirements.txt              # Python dependencies
└── README.md                     # Service documentation
```

## Dependencies

### Core
```
fastapi==0.128.0
uvicorn==0.40.0
pydantic==2.10.5
httpx==0.28.1
python-dotenv==1.0.1
```

### AI/Vision
```
openai==1.59.8
Pillow==11.1.0
```

### Browser Automation
```
browser-use==0.1.40
playwright==1.49.0
langchain-openai==0.2.0
```

## Environment Variables

### Required
```bash
# For browser-use agent reasoning
OPENAI_API_KEY=sk-...

# For vision models
A2R_VISION_INFERENCE_KEY=sk-...
A2R_VISION_INFERENCE_BASE=https://api.openrouter.ai/v1

# API security
A2R_OPERATOR_API_KEY=your-secret-key
```

### Optional
```bash
# Service configuration
A2R_OPERATOR_PORT=3008              # Default: 3008
A2R_OPERATOR_HOST=127.0.0.1         # Default: 127.0.0.1

# Model configuration
A2R_BROWSER_MODEL=gpt-4o            # Default: gpt-4o
A2R_VISION_MODEL_NAME=a2r-vision-7b # Default: a2r-vision-7b

# Browser configuration
BROWSER_HEADLESS=true               # Run browser headless

# External services
BRAIN_GATEWAY_URL=http://localhost:3000
```

## Installation & Setup

### 1. Install Dependencies
```bash
cd /Users/macbook/Desktop/a2rchitech-workspace/a2rchitech/4-services/a2r-operator
pip install -r requirements.txt
```

### 2. Install Chromium
```bash
playwright install chromium
```

### 3. Set Environment Variables
```bash
export OPENAI_API_KEY="sk-..."
export A2R_VISION_INFERENCE_KEY="sk-..."
export A2R_OPERATOR_API_KEY="a2r-operator-secret"
```

### 4. Run the Service
```bash
# Development
python -m uvicorn src.main:app --reload --port 3008

# Production
python -m uvicorn src.main:app --host 0.0.0.0 --port 3008 --workers 4
```

## Usage Examples

### Browser Search (Free, No API Keys)
```bash
curl -X POST http://localhost:3008/v1/browser/search \
  -H "Content-Type: application/json" \
  -d '{"query": "quantum computing news"}'
```

Response:
```json
{
  "success": true,
  "results": [
    {
      "title": "Quantum Computing Breakthrough",
      "url": "https://example.com/article",
      "content": "Scientists have achieved..."
    }
  ]
}
```

### Browser Task with Agent
```bash
# Create task
curl -X POST http://localhost:3008/v1/browser/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "goal": "Search for OpenAI news and extract the latest updates",
    "url": "https://duckduckgo.com/?q=openai+news",
    "mode": "browser-use"
  }'

# Execute task
curl -X POST http://localhost:3008/v1/browser/tasks/{task_id}/execute
```

### Desktop Automation
```bash
curl -X POST http://localhost:3008/v1/sessions/test-session/desktop/execute \
  -H "Content-Type: application/json" \
  -d '{
    "app": "Calculator",
    "instruction": "Open Calculator and compute 123 * 456",
    "use_vision": true
  }'
```

### Parallel Execution
```bash
# Create parallel run
curl -X POST http://localhost:3008/v1/parallel/runs \
  -H "Authorization: Bearer a2r-operator-secret" \
  -H "Content-Type: application/json" \
  -d '{
    "jobId": "run-123",
    "goal": "Implement responsive navbar",
    "variants": [
      {"variantId": "claude", "model": "claude-3.5-sonnet", "agentType": "code"},
      {"variantId": "gpt4", "model": "gpt-4o", "agentType": "code"}
    ]
  }'

# Stream events
curl http://localhost:3008/v1/parallel/runs/run-123/events
```

## Integration with UI Platform

The UI platform connects to A2R Operator for:

1. **Web Search**: `src/lib/ai/tools/browser-web-search.ts`
2. **URL Retrieval**: `src/lib/ai/tools/browser-retrieve-url.ts`
3. **Desktop Control**: Via brain gateway

Configuration in UI:
```typescript
// .env.local
VITE_A2R_OPERATOR_URL=http://127.0.0.1:3008
```

## Migration from Superconductor

If you were using Superconductor before:

| Old | New |
|-----|-----|
| Port 3310 | Port 3008 |
| `POST /runs` | `POST /v1/parallel/runs` |
| `GET /runs/{id}/status` | `GET /v1/parallel/runs/{id}/status` |
| `GET /runs/{id}/events` | `GET /v1/parallel/runs/{id}/events` |

## Troubleshooting

### Browser-Use Not Available
```bash
# Install browser-use
pip install browser-use==0.1.40 playwright==1.49.0

# Install Chromium
playwright install chromium
```

### Service Not Responding
```bash
# Check if service is running
curl http://localhost:3008/health

# Check logs
python -m uvicorn src.main:app --port 3008 --log-level debug
```

### CDP Protocol Issues
Ensure Chromium is properly installed:
```bash
playwright install chromium
```

## Future Enhancements

1. **Multi-Browser Support**: Firefox, WebKit
2. **Persistent Sessions**: Save browser state
3. **Recording**: Record automation sessions
4. **Custom Actions**: User-defined action sequences
5. **Distributed Execution**: Multi-node parallel runs

## Related Documentation

- [BROWSER_CAPSULE_GOLD_STANDARD.md](../docs/BROWSER_CAPSULE_GOLD_STANDARD.md)
- [README_BRAIN_INTEGRATION.md](README_BRAIN_INTEGRATION.md)
- UI Platform: `/5-ui/a2r-platform/src/lib/ai/tools/`
