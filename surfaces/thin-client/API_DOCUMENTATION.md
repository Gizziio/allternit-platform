# API Documentation - Gizzi Thin Client

Complete API reference for integrating with and extending the Gizzi Thin Client.

## Table of Contents

- [IPC API](#ipc-api)
- [Backend API](#backend-api)
- [Computer Use API](#computer-use-api)
- [Settings API](#settings-api)
- [Events](#events)

## IPC API

The renderer process communicates with the main process via Electron's IPC (Inter-Process Communication).

### Available Channels

All IPC methods are available through `window.thinClient`:

```typescript
interface ThinClientAPI {
  // Window Management
  hideWindow: () => void;
  showWindow: () => void;
  
  // Settings
  getSettings: () => Promise<Settings>;
  updateSettings: (settings: Partial<Settings>) => void;
  
  // Connection
  getConnectionStatus: () => Promise<ConnectionStatus>;
  onConnectionStatus: (callback: (status: ConnectionStatus) => void) => () => void;
  onBackendChanged: (callback: (backend: 'cloud' | 'desktop') => void) => () => void;
  
  // App Discovery
  getDiscoveredApps: () => Promise<DiscoveredApp[]>;
  onAppsDiscovered: (callback: (apps: DiscoveredApp[]) => void) => () => void;
  
  // Shortcuts
  registerShortcut: (shortcut: string, action: string) => Promise<boolean>;
  unregisterShortcut: (shortcut: string) => void;
}
```

### Window Management

#### `hideWindow()`
Hides the thin client window.

```typescript
window.thinClient.hideWindow();
```

#### `showWindow()`
Shows the thin client window.

```typescript
window.thinClient.showWindow();
```

### Settings

#### `getSettings()`
Retrieves current settings from the main process.

```typescript
const settings = await window.thinClient.getSettings();
// Returns: { backend: 'desktop', cloudUrl: '...', ... }
```

**Returns**: `Promise<Settings>`

#### `updateSettings(settings)`
Updates settings in the main process.

```typescript
window.thinClient.updateSettings({
  backend: 'cloud',
  cloudUrl: 'https://api.a2r.io'
});
```

**Parameters**:
- `settings`: `Partial<Settings>` - Settings to update

### Connection

#### `getConnectionStatus()`
Gets current connection status.

```typescript
const status = await window.thinClient.getConnectionStatus();
// Returns: { state: 'connected', backend: 'desktop', url: '...' }
```

**Returns**: `Promise<ConnectionStatus>`

#### `onConnectionStatus(callback)`
Subscribe to connection status changes.

```typescript
const unsubscribe = window.thinClient.onConnectionStatus((status) => {
  console.log('Connection:', status.state);
});

// Later: unsubscribe()
```

**Parameters**:
- `callback`: `(status: ConnectionStatus) => void`

**Returns**: `() => void` - Unsubscribe function

### App Discovery

#### `getDiscoveredApps()`
Gets list of discovered applications.

```typescript
const apps = await window.thinClient.getDiscoveredApps();
// Returns: [{ id: 'vscode', name: 'VS Code', windowTitle: '...' }, ...]
```

**Returns**: `Promise<DiscoveredApp[]>`

#### `onAppsDiscovered(callback)`
Subscribe to app discovery updates.

```typescript
const unsubscribe = window.thinClient.onAppsDiscovered((apps) => {
  console.log('Discovered apps:', apps);
});
```

## Backend API

The thin client communicates with the A2R Terminal Server via HTTP and WebSocket.

### Base URL

```
http://localhost:4096/api/v1
```

### Authentication

No authentication required for local development.

### Endpoints

#### Health Check

```http
GET /health
```

**Response**:
```json
{
  "status": "healthy",
  "version": "0.1.0",
  "timestamp": "2024-01-15T10:00:00Z"
}
```

#### Create Session

```http
POST /sessions
Content-Type: application/json

{
  "name": "My Chat Session"
}
```

**Response**:
```json
{
  "id": "sess_abc123",
  "name": "My Chat Session",
  "createdAt": "2024-01-15T10:00:00Z"
}
```

#### Send Message

```http
POST /sessions/{sessionId}/messages
Content-Type: application/json

{
  "text": "Hello, Gizzi!",
  "role": "user"
}
```

**Response**:
```json
{
  "id": "msg_def456",
  "sessionId": "sess_abc123",
  "text": "Hello, Gizzi!",
  "role": "user",
  "timestamp": "2024-01-15T10:00:00Z"
}
```

#### Stream Response (SSE)

```http
GET /sessions/{sessionId}/stream
Accept: text/event-stream
```

**Response** (Server-Sent Events):
```
event: message
data: {"type": "chunk", "content": "Hello"}

event: message
data: {"type": "chunk", "content": " there"}

event: done
data: {}
```

#### Get Messages

```http
GET /sessions/{sessionId}/messages
```

**Response**:
```json
{
  "messages": [
    {
      "id": "msg_1",
      "text": "Hello!",
      "role": "user",
      "timestamp": "2024-01-15T10:00:00Z"
    },
    {
      "id": "msg_2",
      "text": "Hi there!",
      "role": "assistant",
      "timestamp": "2024-01-15T10:00:01Z"
    }
  ]
}
```

#### Get Providers/Models

```http
GET /providers
```

**Response**:
```json
{
  "all": [
    {
      "id": "openai",
      "name": "OpenAI",
      "models": [
        { "id": "gpt-4", "name": "GPT-4" },
        { "id": "gpt-3.5-turbo", "name": "GPT-3.5 Turbo" }
      ]
    }
  ]
}
```

## Computer Use API

Integration with A2R Computer Use Gateway for browser/desktop automation.

### Base URL

```
http://localhost:8080
```

### WebSocket

```
ws://localhost:8080/ws
```

### Endpoints

#### Health Check

```http
GET /health
```

#### Capture Screenshot

```http
POST /screenshot
Content-Type: application/json

{
  "target": "desktop",  // "desktop" | "browser"
  "fullPage": false
}
```

**Response**:
```json
{
  "success": true,
  "data": "base64encodedimage...",
  "path": "/tmp/screenshot.png"
}
```

#### Execute Automation

```http
POST /automate
Content-Type: application/json

{
  "action": {
    "type": "click",  // "click" | "type" | "scroll" | "key" | "navigate"
    "coordinates": { "x": 100, "y": 200 },
    "value": "optional value"
  },
  "target": "browser"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Action completed",
  "screenshot": "base64encoded..."
}
```

#### Navigate Browser

```http
POST /automate
Content-Type: application/json

{
  "action": {
    "type": "navigate",
    "value": "https://example.com"
  },
  "target": "browser"
}
```

#### Get Browser State

```http
GET /browser/state
```

**Response**:
```json
{
  "url": "https://example.com",
  "title": "Example Domain",
  "canGoBack": false,
  "canGoForward": false,
  "isLoading": false
}
```

#### Launch Application

```http
POST /launch
Content-Type: application/json

{
  "target": "chrome"  // "chrome" | "vscode" | "cursor" | "browser"
}
```

### WebSocket Events

#### Browser State Updates

```json
{
  "type": "browser_state",
  "state": {
    "url": "https://example.com",
    "title": "Example"
  }
}
```

#### Screenshots

```json
{
  "type": "screenshot",
  "data": "base64encodedimage..."
}
```

#### Automation Complete

```json
{
  "type": "automation_complete",
  "success": true,
  "screenshot": "base64encoded..."
}
```

## Settings API

Settings are stored persistently using `electron-store`.

### Settings Schema

```typescript
interface Settings {
  // Connection
  backend: 'cloud' | 'desktop';
  cloudUrl: string;
  desktopPort: number;
  
  // Appearance
  theme: 'light' | 'dark' | 'system';
  fontSize: 'small' | 'medium' | 'large';
  
  // UI
  showTimestamps: boolean;
  showMetadata: boolean;
  compactMode: boolean;
  
  // Features
  enableAgentMode: boolean;
  enableComputerUse: boolean;
  
  // Shortcuts
  globalShortcut: string;
  
  // Window
  windowPosition: { x: number; y: number } | null;
  
  // Advanced
  debugMode: boolean;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
}
```

### Default Values

```json
{
  "backend": "desktop",
  "cloudUrl": "https://api.a2r.io",
  "desktopPort": 4096,
  "theme": "system",
  "fontSize": "medium",
  "showTimestamps": true,
  "showMetadata": true,
  "compactMode": false,
  "enableAgentMode": false,
  "enableComputerUse": true,
  "globalShortcut": "CommandOrControl+Shift+A",
  "windowPosition": null,
  "debugMode": false,
  "logLevel": "info"
}
```

## Events

### Application Events

#### `ready`
Emitted when the app is ready.

```typescript
app.on('ready', () => {
  console.log('App is ready');
});
```

#### `window-all-closed`
Emitted when all windows are closed.

```typescript
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
```

#### `activate`
Emitted when the app is activated (macOS).

```typescript
app.on('activate', () => {
  showWindow();
});
```

### Window Events

#### `blur`
Emitted when window loses focus.

```typescript
window.on('blur', () => {
  if (!isQuitting) {
    hideWindow();
  }
});
```

#### `show` / `hide`
Emitted when window is shown or hidden.

```typescript
window.on('show', () => {
  console.log('Window shown');
});
```

### Custom Events

#### `connection-status-changed`
Emitted when connection status changes.

```typescript
ipcMain.on('connection-status-changed', (event, status) => {
  console.log('Connection:', status);
});
```

#### `apps-discovered`
Emitted when new apps are discovered.

```typescript
ipcMain.on('apps-discovered', (event, apps) => {
  console.log('Apps:', apps);
});
```

## TypeScript Types

```typescript
// types/index.ts

export interface ConnectionStatus {
  state: 'connecting' | 'connected' | 'disconnected' | 'error' | 'unavailable';
  backend: 'cloud' | 'desktop';
  url: string;
  error?: string;
}

export interface DiscoveredApp {
  id: string;
  name: string;
  windowTitle: string;
  bundleId?: string;
  icon?: string;
  isFrontmost: boolean;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
  metadata?: {
    model?: string;
    tokens?: number;
    latency?: number;
    source?: 'cloud' | 'desktop';
  };
}

export interface Session {
  id: string;
  name: string;
  createdAt: Date;
  messages: Message[];
}

export interface Provider {
  id: string;
  name: string;
  models: Model[];
}

export interface Model {
  id: string;
  name: string;
  description?: string;
  contextWindow?: number;
}
```

## Error Handling

All API methods return structured errors:

```typescript
interface APIError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// Example error response
{
  "error": {
    "code": "E001",
    "message": "Server not found",
    "details": {
      "url": "http://localhost:4096",
      "attempts": 3
    }
  }
}
```

### Error Codes

| Code | Description | HTTP Status |
|------|-------------|-------------|
| E001 | Server not found | 503 |
| E002 | Connection timeout | 504 |
| E003 | Invalid request | 400 |
| E004 | Session not found | 404 |
| E005 | Rate limited | 429 |
| E006 | Internal server error | 500 |

## Rate Limiting

API requests are rate-limited to prevent abuse:

- **Chat messages**: 60 per minute
- **Screenshots**: 30 per minute
- **Automation actions**: 120 per minute

Rate limit headers:

```http
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 59
X-RateLimit-Reset: 1642245600
```

## WebSocket Protocol

### Connection

```javascript
const ws = new WebSocket('ws://localhost:4096/ws');

ws.onopen = () => {
  console.log('Connected');
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
};
```

### Message Format

All WebSocket messages follow this format:

```json
{
  "type": "event_name",
  "payload": { ... },
  "timestamp": "2024-01-15T10:00:00Z"
}
```

### Subscription

Subscribe to specific events:

```json
{
  "type": "subscribe",
  "events": ["chat.message", "browser.state"]
}
```

## Examples

### Complete Chat Flow

```typescript
import { useChat } from './hooks/useChat';

function ChatComponent() {
  const { messages, sendMessage, isStreaming } = useChat();
  
  const handleSend = async (text: string) => {
    await sendMessage(text);
  };
  
  return (
    <div>
      {messages.map(msg => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
      {isStreaming && <StreamingIndicator />}
    </div>
  );
}
```

### Computer Use Integration

```typescript
import { useComputerUse } from './hooks/useComputerUse';

function ScreenshotButton() {
  const { captureScreenshot, isCapturing } = useComputerUse();
  
  const handleCapture = async () => {
    const result = await captureScreenshot('desktop');
    if (result.success) {
      console.log('Screenshot:', result.data);
    }
  };
  
  return (
    <button onClick={handleCapture} disabled={isCapturing}>
      {isCapturing ? 'Capturing...' : 'Screenshot'}
    </button>
  );
}
```

## Resources

- [Electron IPC](https://www.electronjs.org/docs/latest/tutorial/ipc)
- [Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
- [WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
