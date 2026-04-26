# Browser Runtime Service

Playwright-based browser automation service for Allternitchitech agent computer-use.

## Features

- **Session Management**: Create, navigate, and close browser sessions
- **Full Automation**: Click, type, scroll, and navigate programmatically
- **Event Streaming**: Real-time console, network, and DOM events via WebSocket
- **Screenshot Capture**: PNG/JPEG screenshots of page content
- **DOM Extraction**: Full HTML and text content extraction

## API Endpoints

### Create Session
```bash
POST /session
Content-Type: application/json

{
  "url": "https://example.com",  // optional
  "width": 1280,                 // optional
  "height": 720                  // optional
}

Response: { "sessionId": "session_123456_abc" }
```

### Delete Session
```bash
DELETE /session/:id
Response: { "status": "ok" }
```

### Navigate
```bash
POST /session/:id/navigate
Content-Type: application/json

{
  "url": "https://example.com",
  "waitUntil": "domcontentloaded"  // load, domcontentloaded, networkidle
}

Response: { "url": "https://example.com" }
```

### Click
```bash
POST /session/:id/click
Content-Type: application/json

{
  "selector": "#submit-button",
  "button": "left"  // left, right, middle
}

Response: { "status": "ok" }
```

### Type
```bash
POST /session/:id/type
Content-Type: application/json

{
  "text": "Hello World",
  "selector": "#search-input"  // optional
}

Response: { "status": "ok" }
```

### Scroll
```bash
POST /session/:id/scroll
Content-Type: application/json

{
  "deltaX": 0,
  "deltaY": 500
}

Response: { "status": "ok" }
```

### Screenshot
```bash
GET /session/:id/screenshot?format=png
Content-Type: image/png
```

### DOM Extraction
```bash
GET /session/:id/dom

Response: {
  "url": "https://example.com",
  "title": "Example Page",
  "html": "<html>...</html>",
  "text": "Page content..."
}
```

### Get Current URL
```bash
GET /session/:id/url

Response: { "url": "https://example.com" }
```

### Navigation Controls
```bash
POST /session/:id/back    // Go back
POST /session/:id/forward // Go forward
POST /session/:id/reload  // Reload page

Response: { "status": "ok" }
```

## WebSocket Events

Connect to `ws://localhost:8001/ws?sessionId=<id>` to receive real-time events:

```typescript
interface WSEvent {
  type: 'console' | 'network' | 'load' | 'dom-change' | 'error';
  sessionId: string;
  data: any;
  timestamp: number;
}
```

### Example Usage

```typescript
import { chromium } from 'playwright';

async function automateBrowser() {
  const response = await fetch('http://localhost:8001/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: 'https://example.com' }),
  });
  
  const { sessionId } = await response.json();
  
  // Connect to WebSocket for events
  const ws = new WebSocket(`ws://localhost:8001/ws?sessionId=${sessionId}`);
  
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    console.log(`[${msg.type}]`, msg.data);
  };
  
  // Click an element
  await fetch(`http://localhost:8001/session/${sessionId}/click`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ selector: 'a.nav-link' }),
  });
  
  // Take screenshot
  const screenshotRes = await fetch(`http://localhost:8001/session/${sessionId}/screenshot`);
  const buffer = await screenshotRes.arrayBuffer();
  
  // Cleanup
  await fetch(`http://localhost:8001/session/${sessionId}`, {
    method: 'DELETE',
  });
}
```

## Running the Service

```bash
# Development mode with hot reload
npm run dev

# Production build
npm run build
npm start

# Health check
curl http://localhost:8001/health
```

## Configuration

Environment variables:
- `PORT`: Server port (default: 8001)
- `HEADLESS`: Run browser in headless mode (default: true)
- `VIEWPORT_WIDTH`: Browser width (default: 1280)
- `VIEWPORT_HEIGHT`: Browser height (default: 720)
- `TIMEOUT`: Request timeout in ms (default: 30000)

## Architecture

```
┌─────────────────────────────────────────┐
│  Browser Runtime Service                │
│  - Express REST API                     │
│  - WebSocket for events                 │
│  - Playwright browser management        │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│  Playwright Chromium                    │
│  - Headless browser                     │
│  - Full DOM access                      │
│  - Network interception                │
└─────────────────────────────────────────┘
```

## Integration

The browser runtime is designed to work with:

1. **Tauri Shell** - Native WebView for human browsing
2. **Agent Framework** - Programmatic browser automation
3. **Any HTTP Client** - Simple REST API for automation

## License

MIT
