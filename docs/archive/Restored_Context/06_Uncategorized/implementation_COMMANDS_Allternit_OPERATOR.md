# Allternit Operator Commands Quick Reference

## Start Services

### Start Allternit Operator
```bash
cd /Users/macbook/Desktop/allternit-workspace/allternit/services/allternit-operator
python -m uvicorn src.main:app --reload --port 3008
```

### Start with Debug Logging
```bash
python -m uvicorn src.main:app --port 3008 --log-level debug
```

### Production Mode
```bash
python -m uvicorn src.main:app --host 0.0.0.0 --port 3008 --workers 4
```

---

## Health Checks

### Service Health
```bash
curl http://localhost:3008/health
```

### Browser-Use Health
```bash
curl http://localhost:3008/v1/browser/health
```

---

## Browser Automation

### Web Search (Free - Replaces Tavily)
```bash
curl -X POST http://localhost:3008/v1/browser/search \
  -H "Content-Type: application/json" \
  -d '{"query": "quantum computing breakthrough 2025"}'
```

### URL Retrieval (Free - Replaces Firecrawl)
```bash
curl -X POST http://localhost:3008/v1/browser/retrieve \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/article"}'
```

### Create Browser Task
```bash
curl -X POST http://localhost:3008/v1/browser/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "goal": "Fill out the contact form",
    "url": "https://example.com/contact",
    "mode": "browser-use"
  }'
```

### Execute Task
```bash
curl -X POST http://localhost:3008/v1/browser/tasks/{task_id}/execute
```

### Get Task Status
```bash
curl http://localhost:3008/v1/browser/tasks/{task_id}
```

---

## Desktop/Computer Automation

### Execute Desktop Task
```bash
curl -X POST http://localhost:3008/v1/sessions/test-session/desktop/execute \
  -H "Content-Type: application/json" \
  -d '{
    "app": "Calculator",
    "instruction": "Compute 123 * 456",
    "use_vision": true
  }'
```

### Vision Propose
```bash
curl -X POST http://localhost:3008/v1/vision/propose \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "test",
    "task": "Click the red button",
    "screenshot": "base64encoded...",
    "viewport": {"w": 1920, "h": 1080}
  }'
```

---

## Parallel Execution

### Create Parallel Run
```bash
curl -X POST http://localhost:3008/v1/parallel/runs \
  -H "Authorization: Bearer allternit-operator-key" \
  -H "Content-Type: application/json" \
  -d '{
    "jobId": "run-123",
    "goal": "Implement responsive navbar",
    "variants": [
      {
        "variantId": "claude",
        "model": "claude-3.5-sonnet",
        "agentType": "code"
      },
      {
        "variantId": "gpt4",
        "model": "gpt-4o",
        "agentType": "code"
      }
    ]
  }'
```

### Get Run Status
```bash
curl http://localhost:3008/v1/parallel/runs/run-123/status \
  -H "Authorization: Bearer allternit-operator-key"
```

### Stream Events (SSE)
```bash
curl http://localhost:3008/v1/parallel/runs/run-123/events \
  -H "Authorization: Bearer allternit-operator-key"
```

### Get Results
```bash
curl http://localhost:3008/v1/parallel/runs/run-123/results \
  -H "Authorization: Bearer allternit-operator-key"
```

---

## Installation

### Install Dependencies
```bash
cd /Users/macbook/Desktop/allternit-workspace/allternit/services/allternit-operator
pip install -r requirements.txt
```

### Install Chromium
```bash
playwright install chromium
```

### Verify Installation
```bash
python -c "from browser_use import Agent; print('browser-use OK')"
python -c "from playwright.sync_api import sync_playwright; print('playwright OK')"
```

---

## Environment Setup

### Set All Required Variables
```bash
export OPENAI_API_KEY="sk-your-openai-key"
export ALLTERNIT_VISION_INFERENCE_KEY="sk-your-vision-key"
export ALLTERNIT_VISION_INFERENCE_BASE="https://api.openrouter.ai/v1"
export ALLTERNIT_OPERATOR_API_KEY="allternit-operator-secret"
export ALLTERNIT_OPERATOR_PORT=3008
```

### Add to ~/.zshrc or ~/.bashrc
```bash
echo 'export ALLTERNIT_OPERATOR_API_KEY="your-key"' >> ~/.zshrc
```

---

## Testing

### Test Browser Search
```bash
curl -s http://localhost:3008/v1/browser/search \
  -H "Content-Type: application/json" \
  -d '{"query": "test"}' | jq
```

### Test Health
```bash
curl -s http://localhost:3008/health | jq
```

### Test Parallel Run (with auth)
```bash
export API_KEY="allternit-operator-key"

curl -s -X POST http://localhost:3008/v1/parallel/runs \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "jobId": "test-run",
    "goal": "Test parallel execution",
    "variants": [{"variantId": "v1", "model": "gpt-4o"}]
  }' | jq
```

---

## Debugging

### Check Service Logs
```bash
# If running with uvicorn, logs appear in terminal
# For background process:
ps aux | grep allternit-operator
```

### Test Browser-Use Directly
```bash
python -c "
from browser_use import Agent, Browser
from langchain_openai import ChatOpenAI

browser = Browser()
agent = Agent(task='Open Google', llm=ChatOpenAI())
print('Browser-use working!')
"
```

### Verify CDP Protocol
```bash
# Check if Chromium is installed
ls ~/Library/Caches/ms-playwright/chromium-*/chrome-mac/Chromium.app/Contents/MacOS/Chromium
```

---

## Integration with UI

The UI platform automatically connects to Allternit Operator:

```typescript
// Configuration in UI
const ALLTERNIT_OPERATOR_URL = "http://127.0.0.1:3008";

// Browser search
fetch(`${ALLTERNIT_OPERATOR_URL}/v1/browser/search`, {
  method: "POST",
  body: JSON.stringify({ query: "quantum computing" })
});
```

---

## Troubleshooting

### Port Already in Use
```bash
# Find process using port 3008
lsof -i :3008

# Kill it
kill -9 <PID>
```

### Browser-Use Import Error
```bash
pip install browser-use==0.1.40 --force-reinstall
```

### Playwright Not Found
```bash
pip install playwright==1.49.0
playwright install chromium
```

### API Key Error
```bash
# Test with explicit header
curl http://localhost:3008/v1/parallel/runs \
  -H "Authorization: Bearer your-actual-key"
```
