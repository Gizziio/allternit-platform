# Gizzi Thin Client - Project Summary

## Overview

The **Gizzi Thin Client** is a lightweight, floating AI chat interface that provides instant access to Gizzi's AI capabilities through a global hotkey. It's designed as a companion app to the A2R Terminal Server, offering a streamlined chat experience while maintaining full integration with the A2R ecosystem.

## Key Features

| Feature | Description |
|---------|-------------|
| ⚡ Instant Access | Global hotkey (Cmd/Ctrl+Shift+A) from anywhere |
| 💬 Streaming Chat | Real-time AI responses with markdown support |
| 🔌 Local-First | Connects to local Terminal Server (port 4096) |
| 🤖 Agent Mode | Toggle autonomous agent capabilities |
| 🖥️ Computer Use | Browser and desktop automation integration |
| 🎨 Theme Support | Light, dark, and system theme modes |
| 💾 Persistent Settings | Automatic saving of preferences |
| 🔒 Privacy Focused | All data stays on your machine |

## Technology Stack

| Layer | Technology |
|-------|------------|
| Framework | Electron 28 |
| UI | React 18, TypeScript |
| Build | Vite, electron-builder |
| Styling | Tailwind CSS, CSS Variables |
| Animation | framer-motion |
| State | zustand (with persist) |
| Icons | lucide-react |
| Markdown | react-markdown, remark-gfm |
| Syntax Highlight | react-syntax-highlighter |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Gizzi Thin Client                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   Renderer   │  │  Main Process│  │    Preload   │       │
│  │  (React UI)  │◄─┤   (Electron) │◄─┤   (Bridge)   │       │
│  └──────┬───────┘  └──────────────┘  └──────────────┘       │
└─────────┼───────────────────────────────────────────────────┘
          │ HTTP/WebSocket
          ▼
┌─────────────────────────────────────────────────────────────┐
│              A2R Terminal Server (localhost:4096)            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │  gizzi-code  │  │   OpenClaw   │  │  Chat Store  │       │
│  │   Server     │  │   Gateway    │  │   (SQLite)   │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

## File Structure

```
thin-client/
├── build/                      # Build resources
│   ├── icon.icns              # macOS icon
│   ├── icon.ico               # Windows icon
│   ├── icon.png               # Linux icon
│   └── entitlements.mac.plist # macOS entitlements
├── docs/                       # Documentation
│   ├── BUILD_GUIDE.md
│   ├── DEPLOYMENT.md
│   ├── API_DOCUMENTATION.md
│   ├── TROUBLESHOOTING.md
│   └── QUICKSTART.md
├── src/
│   ├── main/                   # Electron main process
│   │   ├── index.ts           # Entry point
│   │   ├── app-discovery.ts   # App detection
│   │   └── connection-manager.ts
│   ├── preload/                # IPC bridge
│   │   └── index.ts
│   └── renderer/               # React frontend
│       ├── components/
│       │   ├── ThinClientApp.tsx
│       │   ├── ChatContainer.tsx
│       │   ├── MessageBubble.tsx
│       │   ├── InputArea.tsx
│       │   ├── Header.tsx
│       │   ├── BackendStatus.tsx
│       │   └── GizziMascot.tsx
│       ├── hooks/
│       │   ├── useChat.ts
│       │   ├── useConnection.ts
│       │   └── useComputerUse.ts
│       ├── stores/
│       │   ├── settingsStore.ts
│       │   ├── modelStore.ts
│       │   └── agentStore.ts
│       ├── lib/
│       │   └── utils.ts
│       └── styles/
│           └── global.css
├── package.json
├── README.md
├── CHANGELOG.md
├── CONTRIBUTING.md
├── LICENSE
└── PROJECT_SUMMARY.md (this file)
```

## Key Components

### 1. MessageBubble (`components/MessageBubble.tsx`)
- Enhanced markdown rendering with `remark-gfm`
- Syntax-highlighted code blocks with copy button
- Support for headings, lists, tables, blockquotes
- Theme-aware styling

### 2. BackendStatus (`components/BackendStatus.tsx`)
- Compact status indicator
- Full unavailable panel with retry actions
- Backend switching (cloud/local)
- Setup instructions for Terminal Server

### 3. Settings Store (`stores/settingsStore.ts`)
- Zustand with persist middleware
- Theme, model, window position persistence
- Feature toggles (agent mode, computer use)

### 4. Connection Hook (`hooks/useConnection.ts`)
- Health checking every 30s
- Exponential backoff retry logic
- Multiple connection states
- Latency tracking

### 5. Computer Use Hook (`hooks/useComputerUse.ts`)
- WebSocket connection to gateway
- Screenshot capture
- Browser automation
- Desktop control

## Development Commands

```bash
# Development
npm run dev              # Start all processes
npm run dev:main         # Main process only
npm run dev:renderer     # Renderer only
npm run dev:electron     # Electron only

# Building
npm run build            # Full build
npm run build:main       # Main process
npm run build:preload    # Preload script
npm run build:renderer   # Renderer
npm run build:prod       # Production packages

# Quality
npm run typecheck        # Type checking
npm run lint             # Linting
npm run clean            # Clean artifacts
```

## Production Builds

| Platform | Output | Location |
|----------|--------|----------|
| macOS | `.dmg`, `.zip` | `release/` |
| Windows | `.exe` (installer + portable) | `release/` |
| Linux | `.AppImage`, `.deb` | `release/` |

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl+Shift+A` | Toggle window |
| `Esc` | Hide window |
| `Cmd/Ctrl+K` | Focus input |
| `Cmd/Ctrl+,` | Settings |
| `Enter` | Send message |
| `Shift+Enter` | New line |

## Configuration

### Environment Variables
```env
RENDERER_VITE_API_URL=http://localhost:4096
RENDERER_VITE_COMPUTER_USE_URL=http://localhost:8080
RENDERER_VITE_ENABLE_AGENT_MODE=true
RENDERER_VITE_ENABLE_COMPUTER_USE=true
```

### Settings Storage
- **macOS**: `~/Library/Application Support/gizzi-thin-client/`
- **Windows**: `%APPDATA%/gizzi-thin-client/`
- **Linux**: `~/.config/gizzi-thin-client/`

## API Endpoints

### Terminal Server (Port 4096)
- `GET /health` - Health check
- `POST /sessions` - Create chat session
- `POST /sessions/{id}/messages` - Send message
- `GET /sessions/{id}/stream` - SSE streaming
- `GET /providers` - Get available models

### Computer Use Gateway (Port 8080)
- `POST /screenshot` - Capture screenshot
- `POST /automate` - Execute automation
- `GET /browser/state` - Get browser state
- `WS /ws` - WebSocket for real-time updates

## Documentation

| Document | Purpose |
|----------|---------|
| [README.md](README.md) | Main documentation |
| [QUICKSTART.md](QUICKSTART.md) | 5-minute setup |
| [BUILD_GUIDE.md](BUILD_GUIDE.md) | Build instructions |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Distribution guide |
| [API_DOCUMENTATION.md](API_DOCUMENTATION.md) | API reference |
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | Problem solving |
| [CHANGELOG.md](CHANGELOG.md) | Version history |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Contribution guide |

## Testing Checklist

- [ ] App launches successfully
- [ ] Global hotkey works
- [ ] Connects to Terminal Server
- [ ] Messages send and receive
- [ ] Markdown renders correctly
- [ ] Settings persist
- [ ] Theme switching works
- [ ] Auto-updater configured
- [ ] Code signing valid (macOS/Windows)
- [ ] Build artifacts generated

## Future Enhancements

### Phase 2
- [ ] Voice input/output
- [ ] File attachments
- [ ] Custom themes
- [ ] Plugin system
- [ ] Offline mode

### Phase 3
- [ ] Multi-language support
- [ ] Advanced agent workflows
- [ ] Team collaboration features
- [ ] Cloud sync option

## Performance Targets

| Metric | Target |
|--------|--------|
| Launch time | < 500ms |
| Window toggle | < 100ms |
| First paint | < 200ms |
| Message send | < 50ms |
| Memory usage | < 200MB |
| Bundle size | < 50MB |

## Security Considerations

- Local-only by default
- No telemetry without consent
- Sandboxed renderer process
- Code signing for all platforms
- Content Security Policy
- Input validation

## License

MIT License - See [LICENSE](LICENSE)

## Support

- **Issues**: GitHub Issues
- **Discussions**: GitHub Discussions
- **Email**: support@a2r.io
- **Discord**: [Join Server](https://discord.gg/a2r)

---

**Version**: 0.1.0  
**Last Updated**: 2024-01-15  
**Maintained by**: A2R Technologies
