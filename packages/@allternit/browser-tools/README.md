# @allternit/browser-tools

Browser automation toolkit for A2R agent task execution. Built on Playwright with integrated safety controls.

## Features

- **Session Management** - Create and manage isolated browser sessions
- **Navigation Control** - URL navigation with history (back/forward/reload)
- **DOM Extraction** - Extract text, links, images, forms, tables
- **Action Execution** - Click, type, select, scroll, hover, press keys
- **Event Streaming** - Real-time monitoring of navigation, DOM changes, clicks
- **Safety & Quarantine** - Host allowlists, action approval, audit logging
- **Screenshot Capture** - Full page or element screenshots

## Installation

```bash
npm install @allternit/browser-tools
# or
pnpm add @allternit/browser-tools
```

## Quick Start

```typescript
import { 
  createSession, 
  navigate, 
  click,
  type,
  takeScreenshot,
  extractContent,
  eventStreamManager,
} from '@allternit/browser-tools';

// Create browser session
const session = await createSession({
  viewport: { width: 1280, height: 720 },
  headless: false,
});

// Navigate to URL
await navigate(session.id, { url: 'https://example.com' });

// Subscribe to events
const streamId = eventStreamManager.subscribe(
  session.id,
  (event) => console.log(event.type, event.payload),
  { captureClicks: true, captureNavigation: true }
);

// Extract page content
const content = await extractContent(session.id);
console.log(content.text);
console.log(content.links);

// Perform actions
await click(session.id, { selector: '#submit-button' });
await type(session.id, { selector: '#search-input', text: 'query' });

// Take screenshot
const screenshot = await takeScreenshot(session.id, { fullPage: true });

// Clean up
await closeSession(session.id);
```

## API Reference

### Session Management

```typescript
// Create session
const session = await createSession({
  viewport?: { width: number; height: number; deviceScaleFactor?: number; isMobile?: boolean };
  headless?: boolean;
  incognito?: boolean;
  userAgent?: string;
  locale?: string;
  timezone?: string;
});

// Close session
await closeSession(session.id);

// Get session info
const info = await getSessionInfo(session.id);
```

### Navigation

```typescript
// Navigate to URL
await navigate(session.id, { 
  url: 'https://example.com',
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle',
  timeout?: number,
});

// History navigation
await goBack(session.id);
await goForward(session.id);
await reload(session.id);
```

### Content Extraction

```typescript
// Extract all content
const content = await extractContent(session.id, {
  includeHidden?: boolean;
  maxLength?: number;
  includeSelectors?: boolean;
});

// Find specific element
const element = await findElement(session.id, {
  selector?: string;
  text?: string;
  tag?: string;
  nth?: number;
});
```

### Actions

```typescript
// Click
await click(session.id, { 
  selector: '#button',
  button?: 'left' | 'right' | 'middle';
  clickCount?: number;
  waitForNavigation?: boolean;
});

// Type text
await type(session.id, { 
  selector: '#input', 
  text: 'value',
  clearFirst?: boolean,
});

// Select dropdown
await select(session.id, { 
  selector: '#select',
  value?: string;
  label?: string;
  index?: number;
});

// Scroll
await scroll(session.id, { 
  selector?: string;  // Scroll element into view
  x?: number;         // Or scroll to coordinates
  y?: number;
});

// Hover
await hover(session.id, { selector: '#tooltip' });

// Press key
await press(session.id, { 
  selector?: string;  // Optional: specific element
  key: 'Enter',
  modifiers?: ('alt' | 'ctrl' | 'meta' | 'shift')[];
});

// Wait
await wait(session.id, { 
  selector?: string;
  state?: 'visible' | 'hidden';
  time?: number;  // milliseconds
});
```

### Event Streaming

```typescript
import { eventStreamManager } from '@allternit/browser-tools';

// Subscribe to events
const streamId = eventStreamManager.subscribe(
  sessionId,
  (event) => {
    console.log(event.type);      // 'navigation' | 'dom_change' | 'click' | 'input' | 'scroll' | 'screenshot'
    console.log(event.payload);   // Event-specific data
  },
  {
    captureNavigation: true,
    captureDOMChanges: true,
    captureClicks: true,
    captureInputs: true,
    captureScrolls: false,
    captureScreenshots: false,
    screenshotInterval: 5000,
  }
);

// Add additional handler
eventStreamManager.addHandler(streamId, anotherHandler);

// Unsubscribe
eventStreamManager.unsubscribe(streamId);
```

### Safety & Quarantine

```typescript
import { 
  DEFAULT_SAFETY_POLICY,
  STRICT_SAFETY_POLICY,
  checkNavigationSafety,
  quarantineManager,
} from '@allternit/browser-tools';

// Check navigation safety
const result = checkNavigationSafety(url, DEFAULT_SAFETY_POLICY);
if (!result.allowed) {
  console.log('Blocked:', result.reason);
}

// Create quarantine session
quarantineManager.createSession(sessionId, 'incognito', {
  allowedHosts: ['example.com'],
  blockedHosts: ['localhost', '127.0.0.1'],
  maxNavigationDepth: 10,
});

// Get audit log
const auditLog = quarantineManager.getAuditLog(sessionId);
```

## Safety Features

### Host Restrictions

```typescript
const policy = {
  allowedHosts: ['*.example.com'],  // Allow all subdomains
  blockedHosts: ['localhost', '127.0.0.1', '*.internal'],
  allowedSchemes: ['https:'],        // Only HTTPS
  maxNavigationDepth: 10,
};
```

### Action Approval

```typescript
// Some actions require approval based on policy
const result = checkActionSafety('click', selector, policy);
if (result.requiresApproval) {
  // Queue for user approval
  approvalQueue.requestApproval({
    id: generateId(),
    sessionId,
    action: 'click',
    target: selector,
    timestamp: new Date(),
    expiresAt: new Date(Date.now() + 60000),
  });
}
```

## Browser Support

- Chromium (default)
- Firefox
- WebKit

## License

MIT
