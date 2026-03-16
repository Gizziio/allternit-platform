# Browser-Use Integration for Superconductor

This integration provides agent-based browser automation using the [browser-use](https://github.com/browser-use/browser-use) library with Chromium and CDP (Chrome DevTools Protocol).

## Overview

Replaces paid external APIs (Firecrawl, Tavily) with local browser automation:
- **No API costs** - Runs locally using Chromium
- **No rate limits** - Limited only by local resources
- **Full control** - Agent-based automation with reasoning
- **Three modes** - Choose the right tool for the job

## Agent Modes

### 1. Browser-Use Mode (Default)
Full agent automation with LLM reasoning and planning.
- Best for: Complex multi-step tasks
- Features: Planning, reasoning, element detection
- Speed: Slower but more capable

### 2. Playwright Mode
Fast headless browser control.
- Best for: Simple scraping, fast extraction
- Features: Direct page control
- Speed: Fast

### 3. Computer-Use Mode
Vision-based desktop-like interactions.
- Best for: Visual tasks, screenshots, complex UIs
- Features: Vision model integration
- Speed: Moderate

## Installation

```bash
# Install dependencies
pip install browser-use==0.1.40 playwright==1.49.0 langchain-openai==0.2.0

# Install Chromium for Playwright
playwright install chromium
```

## Environment Variables

```bash
# Required
OPENAI_API_KEY=your_openai_key  # For agent reasoning

# Optional
BROWSER_HEADLESS=true  # Run browser headless (default: true)
SUPERCONDUCTOR_URL=http://127.0.0.1:3310
```

## API Endpoints

### Health Check
```bash
GET /browser/health
```

### Create Browser Task
```bash
POST /browser/tasks
{
  "goal": "Search for quantum computing news",
  "url": "https://duckduckgo.com/?q=quantum+computing",
  "mode": "browser-use"  // or "playwright", "computer-use"
}
```

### Execute Task
```bash
POST /browser/tasks/{task_id}/execute
```

### Get Task Status
```bash
GET /browser/tasks/{task_id}
```

### Search (Convenience)
```bash
POST /browser/search
{
  "query": "quantum computing",
  "search_engine": "duckduckgo"
}
```

### Retrieve URL (Convenience)
```bash
POST /browser/retrieve
{
  "url": "https://example.com"
}
```

## Usage from UI

The UI platform automatically uses the browser-use service for:
- Web search (replaces Tavily)
- URL retrieval (replaces Firecrawl)
- Content extraction

No configuration needed - just ensure the superconductor service is running.

## Architecture

```
UI Platform → Superconductor → Browser-Use → Chromium (CDP)
                (Port 3310)       (Agent)       (Headless/Visible)
```

## Benefits vs External APIs

| Feature | Browser-Use | Firecrawl/Tavily |
|---------|-------------|------------------|
| Cost | Free | Paid per request |
| Rate Limits | None | Yes |
| JS Rendering | Yes | Limited |
| Custom Actions | Full control | Limited |
| Privacy | Local | External service |

## Troubleshooting

### Service Not Available
Ensure superconductor is running:
```bash
cd /Users/macbook/Desktop/a2rchitech-workspace/a2rchitech/4-services/runtime/superconductor
python -m uvicorn src.main:app --reload --port 3310
```

### Browser-Use Not Installed
```bash
pip install browser-use playwright
playwright install chromium
```

### OpenAI API Key Missing
The browser-use agent requires an OpenAI API key for reasoning:
```bash
export OPENAI_API_KEY=your_key
```
