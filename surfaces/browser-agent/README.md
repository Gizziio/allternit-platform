# A2R Browser Capsule (Chrome Extension)

Chrome extension for browser automation and control via A2R agents.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Chrome Extension                         │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Popup UI   │  │   Options    │  │  Background  │      │
│  │  (popup/)    │  │   (options/) │  │(service-worker)│     │
│  └──────────────┘  └──────────────┘  └──────┬───────┘      │
│                                             │               │
│                              ┌──────────────┼──────────────┐│
│                              │              │              ││
│                         ┌────▼────┐  ┌─────▼─────┐  ┌────▼───┐
│                         │WebSocket│  │Native Host│  │Content │
│                         │ Client  │  │  (CDP)    │  │ Script │
│                         └────┬────┘  └─────┬─────┘  └───┬────┘
│                              │             │            │
└──────────────────────────────┼─────────────┼────────────┼──────┘
                               │             │            │
                    ┌──────────▼─────────────┘            │
                    │       A2R API                       │
                    │   (WebSocket/SSE)                   │
                    └──────────┬──────────────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │    A2R Platform     │
                    │  (ShellUI/Agents)   │
                    └─────────────────────┘
```

## Features

### BROWSER.* Tool Contracts

| Tool | Description |
|------|-------------|
| `BROWSER.NAV` | Navigate to URL |
| `BROWSER.GET_CONTEXT` | Get page context (DOM, title, URL) |
| `BROWSER.ACT` | Click, type, scroll, hover |
| `BROWSER.EXTRACT` | Extract data from page |
| `BROWSER.SCREENSHOT` | Capture screenshot |
| `BROWSER.WAIT` | Wait for condition |

### Safety Model

- **Host Allowlist**: Default deny, explicit allow
- **Circuit Breaker**: Rate limiting for failed actions
- **Origin Validation**: Validates message origins
- **CSP**: Strict content security policy

## Development

```bash
cd packages/chrome-extension

# Install dependencies
npm install

# Development build with watch
npm run dev

# Production build
npm run build:prod
```

## Installation

1. Build the extension: `npm run build:prod`
2. Open Chrome: `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the `dist/` folder

## Permissions

- `activeTab`: Access current tab
- `scripting`: Inject content scripts
- `storage`: Store configuration
- `nativeMessaging`: Communicate with native host
- `tabs`: Tab management
- `webNavigation`: Navigation events

## License

MIT
