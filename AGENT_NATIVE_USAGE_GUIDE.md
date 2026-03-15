# Agent Native Usage Guide

**The Computer Use Gateway is a Standalone Service**  
**Any Agent Can Use It Natively via HTTP**

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    ANY AGENT (Python, JS, Go, etc.)             │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Agent A      │  │ Agent B      │  │ Agent C      │          │
│  │ (Python)     │  │ (JavaScript) │  │ (CLI/curl)   │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
└─────────┼─────────────────┼─────────────────┼───────────────────┘
          │                 │                 │
          └─────────────────┼─────────────────┘
                            │ HTTP POST/GET
┌───────────────────────────▼─────────────────────────────────────┐
│              COMPUTER USE GATEWAY (Port 8080)                   │
│                     Standalone Service                          │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Session Manager                                        │   │
│  │  • session_id_1 → BrowserContext A (Agent A)           │   │
│  │  • session_id_2 → BrowserContext B (Agent B)           │   │
│  │  • session_id_3 → BrowserContext C (Agent C)           │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Action Handlers                                        │   │
│  │  • goto, click, fill, extract, screenshot, inspect     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
          │
          │ Controls
          ▼
┌─────────────────────────────────────────────────────────────────┐
│              PLAYWRIGHT / CHROMIUM                              │
│         (Headless Browser Automation)                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Design Decisions

### 1. **HTTP API (Not Library)**

❌ **What We Didn't Do:**
- Build a Python library that agents import
- Create GIZZI-specific code
- Tight coupling to any framework

✅ **What We Did:**
- Exposed functionality via REST API
- Language-agnostic HTTP interface
- Any agent can call it from any language

### 2. **Session Isolation**

Each agent gets **isolated browser contexts**:

```python
# Agent A uses session "agent_a_123"
# Agent B uses session "agent_b_456"

# These are completely separate browser instances
# Cookies, storage, state don't leak between them
```

### 3. **No GIZZI Dependency**

The gateway **does not know about GIZZI**:
- It doesn't import GIZZI code
- It doesn't check for GIZZI environment
- It accepts HTTP requests from anywhere

---

## Usage Examples by Language

### Python Agent

```python
import httpx

class BrowserAgent:
    def __init__(self, gateway_url="http://localhost:8080"):
        self.gateway = gateway_url
        self.session_id = f"my_agent_{uuid4()}"
    
    async def goto(self, url):
        """Navigate to URL - NATIVE USAGE"""
        response = await httpx.post(
            f"{self.gateway}/v1/execute",
            json={
                "action": "goto",
                "session_id": self.session_id,
                "run_id": f"run_{uuid4()}",
                "target": url
            }
        )
        return response.json()
    
    async def screenshot(self):
        """Capture screenshot - NATIVE USAGE"""
        response = await httpx.post(
            f"{self.gateway}/v1/execute",
            json={
                "action": "screenshot",
                "session_id": self.session_id,
                "run_id": f"run_{uuid4()}"
            }
        )
        result = response.json()
        
        # Screenshot is base64 data URL
        if result["status"] == "completed":
            return result["artifacts"][0]["url"]
        return None

# Usage
agent = BrowserAgent()
await agent.goto("https://example.com")
screenshot_data = await agent.screenshot()
```

### JavaScript/TypeScript Agent

```javascript
class BrowserAgent {
    constructor(gatewayUrl = "http://localhost:8080") {
        this.gateway = gatewayUrl;
        this.sessionId = `js_agent_${Date.now()}`;
    }
    
    async goto(url) {
        // NATIVE USAGE - just fetch
        const response = await fetch(`${this.gateway}/v1/execute`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                action: "goto",
                session_id: this.sessionId,
                run_id: `run_${Date.now()}`,
                target: url
            })
        });
        return await response.json();
    }
    
    async fill(selector, text) {
        // NATIVE USAGE
        const response = await fetch(`${this.gateway}/v1/execute`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                action: "fill",
                session_id: this.sessionId,
                run_id: `run_${Date.now()}`,
                target: selector,
                parameters: { text }
            })
        });
        return await response.json();
    }
}

// Usage
const agent = new BrowserAgent();
await agent.goto("https://example.com");
await agent.fill("#username", "john_doe");
```

### curl / CLI Agent

```bash
#!/bin/bash
# NATIVE USAGE - No code required, just HTTP

SESSION_ID="cli_agent_$(date +%s)"
GATEWAY="http://localhost:8080"

# Navigate
curl -X POST $GATEWAY/v1/execute \
  -H "Content-Type: application/json" \
  -d "{
    \"action\": \"goto\",
    \"session_id\": \"$SESSION_ID\",
    \"run_id\": \"run_$(date +%s)\",
    \"target\": \"https://example.com\"
  }"

# Screenshot
curl -X POST $GATEWAY/v1/execute \
  -H "Content-Type: application/json" \
  -d "{
    \"action\": \"screenshot\",
    \"session_id\": \"$SESSION_ID\",
    \"run_id\": \"run_$(date +%s)\"
  }" | jq '.artifacts[0].url' > screenshot.txt

# Extract
curl -X POST $GATEWAY/v1/execute \
  -H "Content-Type: application/json" \
  -d "{
    \"action\": \"extract\",
    \"session_id\": \"$SESSION_ID\",
    \"run_id\": \"run_$(date +%s)\",
    \"parameters\": {\"format\": \"json\"}
  }" | jq '.extracted_content'
```

### Go Agent

```go
package main

import (
    "bytes"
    "encoding/json"
    "net/http"
)

type BrowserAgent struct {
    GatewayURL string
    SessionID  string
}

func (a *BrowserAgent) Goto(url string) (map[string]interface{}, error) {
    // NATIVE USAGE
    payload := map[string]interface{}{
        "action":     "goto",
        "session_id": a.SessionID,
        "run_id":     "run_" + generateID(),
        "target":     url,
    }
    
    jsonData, _ := json.Marshal(payload)
    resp, err := http.Post(
        a.GatewayURL+"/v1/execute",
        "application/json",
        bytes.NewBuffer(jsonData),
    )
    
    var result map[string]interface{}
    json.NewDecoder(resp.Body).Decode(&result)
    return result, err
}
```

---

## Comparison: Native vs Non-Native

### ❌ Non-Native Approach (What We Avoided)

```python
# This would be BAD - requires importing GIZZI code
from gizzi import BrowserTool  # Tight coupling!

result = BrowserTool.execute(
    action="goto",
    target="https://example.com"
)
```

**Problems:**
- Only works with GIZZI
- Requires GIZZI installation
- Can't use from other agents
- Can't use from other languages

### ✅ Native Approach (What We Built)

```python
# This is GOOD - pure HTTP, any agent can use
import httpx  # Any HTTP client works

response = httpx.post(
    "http://localhost:8080/v1/execute",
    json={
        "action": "goto",
        "session_id": "my_session",
        "run_id": "my_run",
        "target": "https://example.com"
    }
)
result = response.json()
```

**Benefits:**
- Works with ANY agent
- Works from ANY language
- No dependencies required
- Just need HTTP client
- Can run on different machines

---

## Real-World Usage Patterns

### Pattern 1: CI/CD Pipeline Agent

```yaml
# GitHub Actions workflow
- name: Visual Regression Test
  run: |
    # Agent is just a shell script
    curl -X POST http://gateway:8080/v1/execute \
      -d '{"action":"goto","session_id":"ci_test","target":"https://mysite.com"}'
    
    curl -X POST http://gateway:8080/v1/execute \
      -d '{"action":"screenshot","session_id":"ci_test"}' \
      > screenshot.json
    
    # Compare screenshots
    ./compare-screenshots.sh
```

### Pattern 2: Microservice Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Web Scraper   │────▶│  Computer Use    │────▶│   Data Store    │
│   Service       │     │  Gateway         │     │                 │
│   (Python)      │     │  (Port 8080)     │     │   (PostgreSQL)  │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                              │
                              ▼
                       ┌──────────────────┐
                       │   Chrome         │
                       │   (Headless)     │
                       └──────────────────┘
```

### Pattern 3: Multi-Agent System

```python
# Agent Coordinator dispatches to multiple agents
# Each agent uses the gateway independently

agents = [
    DataExtractionAgent(),      # Python
    VisualTestingAgent(),       # JavaScript
    FormFillingAgent(),         # Python
    MonitoringAgent(),          # Go
]

# All use same gateway, isolated sessions
results = await asyncio.gather(*[
    agent.run() for agent in agents
])
```

---

## Deployment Options

### Option 1: Local Development

```bash
# Run gateway locally
python -m uvicorn main:app --port 8080

# Any agent on same machine connects to localhost:8080
```

### Option 2: Docker Container

```bash
# Run as container
docker run -p 8080:8080 a2r/computer-use-gateway

# Agents connect to http://gateway-host:8080
```

### Option 3: Kubernetes Service

```yaml
apiVersion: v1
kind: Service
metadata:
  name: computer-use-gateway
spec:
  ports:
  - port: 8080
  selector:
    app: computer-use-gateway

# Agents connect to http://computer-use-gateway:8080
```

### Option 4: Cloud Deployment

```
Agents ──▶ Load Balancer ──▶ Gateway Instances ──▶ Chrome Fleet
            (AWS/GCP/Azure)    (Auto-scaling)       (Managed)
```

---

## Session Isolation Guarantee

Each agent's session is completely isolated:

```python
# Agent A
agent_a_session = "agent_a_123"
httpx.post("...", json={
    "action": "goto",
    "session_id": agent_a_session,
    "target": "https://site-a.com"
})

# Agent B (concurrent)
agent_b_session = "agent_b_456"
httpx.post("...", json={
    "action": "goto",
    "session_id": agent_b_session,
    "target": "https://site-b.com"
})

# These are completely separate browser contexts
# No cookie sharing, no state leakage
```

---

## Why This Architecture Wins

| Aspect | Library Approach | Our Service Approach |
|--------|------------------|---------------------|
| **Language Support** | One language only | Any language with HTTP |
| **Deployment** | Embedded in agent | Standalone service |
| **Scaling** | Hard to scale independently | Easy to scale gateway |
| **Resource Sharing** | Each agent needs browser | Shared browser pool |
| **Updates** | Update all agents | Update gateway only |
| **Multi-Agent** | Coordination required | Natural isolation |

---

## Bottom Line

**The Computer Use Gateway is a universal browser automation service.**

Any agent - Python, JavaScript, Go, curl, whatever - can use it as if it were their own native tool. Just make HTTP requests to port 8080.

It's like having "Playwright as a Service" that any code can use.
