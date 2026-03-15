# A2R Product Lineup

Complete list of A2R products with packaging status.

## ✅ Completed Products

### 1. Thin Client
**Lightweight floating chat interface**

| Aspect | Details |
|--------|---------|
| Location | `7-apps/thin-client/` |
| Type | Electron desktop app |
| Package | `.dmg`, `.exe`, `.AppImage` |
| Size | ~50MB |

**Installation:**
```bash
# Download from releases
curl -LO https://github.com/a2r/thin-client/releases/latest/download/Gizzi-Thin-Client.dmg
```

---

### 2. Gizzi Code CLI
**AI-powered terminal interface**

| Aspect | Details |
|--------|---------|
| Location | `cmd/gizzi-code/cli-package/` |
| Type | CLI tool |
| Package | npm, Homebrew, Winget, curl \| bash |
| Command | `gizzi` |

**Installation:**
```bash
# curl | bash
curl -fsSL https://gizzi.sh/install.sh | bash

# Homebrew
brew tap a2r/gizzi-code && brew install gizzi-code

# npm
npm install -g @a2r/gizzi-code

# Winget
winget install A2R.GizziCode
```

**Usage:**
```bash
gizzi              # Start TUI
gizzi --version    # Check version
gizzi daemon start # Start background service
```

---

### 3. A2R Desktop
**Self-hosted AI platform desktop client**

| Aspect | Details |
|--------|---------|
| Location | `7-apps/a2r-desktop/` |
| Type | Electron desktop client (cloud-connected) |
| Package | `.dmg`, `.exe`, `.AppImage`, `.deb` |
| Size | ~50MB (UI only) |
| Connects to | User's own A2R backend (VPS or local) |

**Architecture:**
- ✅ Desktop UI only (~50MB)
- ✅ Connects to user's A2R backend
- ✅ Local mode: localhost services
- ✅ VPS mode: user's cloud instance
- ✅ Auto-discovery of local services
- ✅ Connection test & health checks
- ✅ Auto-updater for UI

**Installation:**
```bash
# macOS
brew install --cask a2r-desktop

# Windows
winget install A2R.Desktop

# Linux
wget https://github.com/a2r/desktop/releases/latest/download/A2R-Desktop.AppImage
chmod +x A2R-Desktop.AppImage
```

**Usage:**
```bash
# 1. First, install A2R backend on your VPS or locally:
curl -fsSL https://a2r.io/install-backend.sh | bash

# 2. Launch A2R Desktop
open /Applications/A2R\ Desktop.app

# 3. Configure connection:
#    - Local: localhost:4096
#    - VPS: https://your-domain.com

# 4. Click Connect - you're ready!
```

**Key Features:**
- 🏠 **Local Mode**: Connect to backend on same machine
- ☁️ **VPS Mode**: Connect to your cloud instance
- 🔍 **Auto-Discovery**: Finds running local services
- 🔗 **Connection Test**: Verify before connecting
- 🔄 **Auto-Update**: UI updates automatically
- 🔒 **Privacy**: Your data stays on your infrastructure

---

## 📦 Packaging Matrix

| Product | npm | Homebrew | Winget | curl | GitHub | Auto-Update |
|---------|-----|----------|--------|------|--------|-------------|
| Thin Client | - | - | - | - | ✅ | ✅ |
| Gizzi Code | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| A2R Desktop | - | ✅ Cask | ✅ | - | ✅ | ✅ |

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        A2R Ecosystem                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐   │
│  │   Thin Client    │  │   Gizzi Code     │  │ A2R Desktop  │   │
│  │   (Companion)    │  │   (CLI Tool)     │  │  (Full App)  │   │
│  │                  │  │                  │  │              │   │
│  │  • Floating UI   │  │  • TUI Interface │  │ • Shell UI   │   │
│  │  • Quick chat    │  │  • Daemon mode   │  │ • Agent Hub  │   │
│  │  • Global hotkey │  │  • gizzi command │  │ • Projects   │   │
│  └────────┬─────────┘  └────────┬─────────┘  └──────┬───────┘   │
│           │                     │                    │           │
│           └─────────────────────┼────────────────────┘           │
│                                 │                                │
│                                 ▼                                │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │              A2R Terminal Server (localhost:4096)           │ │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐           │ │
│  │  │gizzi-code  │  │  OpenClaw  │  │  Chat API  │           │ │
│  │  │  Server    │  │  Gateway   │  │  (SQLite)  │           │ │
│  │  └────────────┘  └────────────┘  └────────────┘           │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Next Steps

### Remaining Products

| Priority | Product | Description |
|----------|---------|-------------|
| 4 | Gizzi Web/Cloud | Self-hosted web platform (Next.js + Docker) |
| 5 | VS Code Extension | IDE integration for A2R |
| 6 | Mobile App | iOS/Android companion |

---

## 📋 Release Checklist

Before publishing each product:

- [ ] Version bumped
- [ ] Changelog updated
- [ ] Code signed (macOS/Windows)
- [ ] Binaries built for all platforms
- [ ] Auto-updater tested
- [ ] Documentation complete
- [ ] GitHub release created

---

## 🔗 Quick Links

| Resource | URL |
|----------|-----|
| Main Website | https://a2r.io |
| Documentation | https://docs.a2r.io |
| GitHub Org | https://github.com/a2r |
| Discord | https://discord.gg/a2r |

---

*Last Updated: 2024*
