# Chrome CDP Development Mode

Stop wasting 17GB on Electron! Use Chrome directly for development.

## Quick Start

```bash
# 1. Start browser dev mode (Vite + Chrome)
./dev-browser.sh

# 2. In another terminal, start auto-reload watcher
node watch-reload.mjs
```

## Available Scripts

| Script | Purpose |
|--------|---------|
| `./dev-browser.sh` | Start Vite + Chrome with CDP |
| `./chrome-dev.sh` | Launch Chrome in app mode only |
| `./cdp-helper.mjs` | CDP automation commands |
| `node watch-reload.mjs` | Auto-reload on file changes |

## CDP Helper Commands

```bash
# List all Chrome tabs
node cdp-helper.mjs list

# Open DevTools in browser
node cdp-helper.mjs devtools

# Reload the A2R page
node cdp-helper.mjs reload

# Execute JavaScript in page
node cdp-helper.mjs eval "document.title"

# Take screenshot
node cdp-helper.mjs screenshot app-state.png

# Get Chrome version
node cdp-helper.mjs version
```

## Benefits over Electron

| Metric | Chrome CDP | Electron |
|--------|-----------|----------|
| Disk Space | ~0 MB | 17+ GB |
| Startup | 1 second | 10+ seconds |
| Memory | ~100 MB | ~400 MB |
| Hot Reload | Instant | Slow |
| DevTools | Native Chrome | Wrapped |

## CDP Endpoints

- **DevTools**: http://localhost:9222/devtools/inspector.html
- **Target List**: http://localhost:9222/json/list
- **Version**: http://localhost:9222/json/version

## Stopping

```bash
# Stop Chrome
pkill -f a2r-chrome-dev

# Stop Vite
pkill -f "vite"

# Stop watcher
Ctrl+C
```
