# allternit Platform - Deployment Architecture Guide

## Your Mental Model (VALIDATED ✓)

You want:
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         YOUR ARCHITECTURE VISION                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌──────────────┐        ┌─────────────────┐        ┌──────────────┐      │
│   │   Company    │        │   Your VPS      │        │   Company    │      │
│   │   Website    │◄──────►│  (Platform)     │◄──────►│   Website    │      │
│   │   (Cloud)    │  Web   │                 │  Web   │   (Cloud)    │      │
│   └──────────────┘        └─────────────────┘        └──────────────┘      │
│          ▲                       │                          ▲              │
│          │                       │                          │              │
│          └───────────────────────┴──────────────────────────┘              │
│                          Login Required                                    │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │  Desktop App (Electron)                                            │  │
│   │  └─► Runs on user's local machine OR self-hosted on company's VPS  │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│   KEY PRINCIPLE: Compute is hosted by THEM, UI is hosted by YOU            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**This is a valid multi-tenant SaaS model!**

---

## Current State vs Production

### What You Have NOW (Development)

```
┌─────────────────────────────────────────────────────────────────┐
│                     CURRENT SETUP                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌──────────────┐        ┌─────────────────┐                  │
│   │   systemd    │        │   Vite Dev      │                  │
│   │   Service    │───────►│   Server        │                  │
│   │   (pnpm dev) │        │   Port 5177     │                  │
│   └──────────────┘        └─────────────────┘                  │
│                                   │                             │
│                                   ▼                             │
│                          Compiles on-the-fly                   │
│                          ❌ SLOW (20-40s first load)           │
│                          ❌ High CPU usage                     │
│                          ❌ Not suitable for production        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Why this is NOT production-ready:**
- Vite dev server compiles TypeScript on every request
- No optimization/bundling
- Hot Module Replacement (HMR) enabled (wastes resources)
- No CDN/caching
- Source maps exposed

---

## Production Architecture (Your Use Case)

### Option 1: Web-First SaaS (Recommended for Companies)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PRODUCTION: WEB SAAS                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐        ┌─────────────────────────────────────────┐    │
│  │   Company A     │        │         YOUR CLOUD INFRASTRUCTURE       │    │
│  │   Employees     │        │                                         │    │
│  └────────┬────────┘        │  ┌──────────────┐    ┌──────────────┐  │    │
│           │                 │  │   Cloudflare │    │   Vercel/    │  │    │
│           │ HTTPS           │  │   CDN/Cache  │───►│   Netlify    │  │    │
│           ▼                 │  └──────────────┘    └──────┬───────┘  │    │
│  ┌─────────────────┐        │                             │          │    │
│  │  Static React   │        │                      ┌──────▼──────┐   │    │
│  │  App (Built)    │        │                      │   Built     │   │    │
│  │  ├─ Login       │        │                      │   Static    │   │    │
│  │  ├─ Dashboard   │        │                      │   Files     │   │    │
│  │  └─ Browser     │        │                      │   (dist/)   │   │    │
│  │     Capsule     │        │                      └──────┬──────┘   │    │
│  └────────┬────────┘        │                             │          │    │
│           │                 │                             │          │    │
│           │ WebSocket       │         ┌───────────────────┘          │    │
│           │ / API Calls     │         │                              │    │
│           ▼                 │         ▼                              │    │
│  ┌─────────────────┐        │  ┌──────────────┐    ┌──────────────┐  │    │
│  │  WebRTC Stream  │◄───────┼──│  Their VPS   │    │  Their VPS   │  │    │
│  │  (Chrome View)  │        │  │  (Company A) │    │  (Company B) │  │    │
│  └─────────────────┘        │  └──────────────┘    └──────────────┘  │    │
│                             │       │                     │          │    │
│                             │       │ SSH/WebSocket         │          │    │
│                             │       ▼                     ▼          │    │
│                             │  ┌──────────────┐    ┌──────────────┐   │    │
│                             │  │  Platform    │    │  Platform    │   │    │
│                             │  │  (Compute)   │    │  (Compute)   │   │    │
│                             │  │  ├─ API      │    │  ├─ API      │   │    │
│                             │  │  ├─ Kernel   │    │  ├─ Kernel   │   │    │
│                             │  │  ├─ Browser  │    │  ├─ Browser  │   │    │
│                             │  │  └─ Agent    │    │  └─ Agent    │   │    │
│                             │  └──────────────┘    └──────────────┘   │    │
│                             │                                         │    │
│                             └─────────────────────────────────────────┘    │
│                                                                             │
│  KEY:                                                                        │
│  • Cloud hosts STATIC UI (fast, cheap, scales)                              │
│  • Each company hosts COMPUTE on their own VPS (data stays with them)       │
│  • WebRTC streams Chrome from their VPS to their browser                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Option 2: Desktop-First (For Power Users)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       PRODUCTION: DESKTOP APP                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                    ELECTRON DESKTOP APP                               │ │
│  │  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐   │ │
│  │  │   Local API     │    │   Local Kernel  │    │   Local Chrome  │   │ │
│  │  │   (Bundled)     │    │   (Bundled)     │    │   (Sidecar)     │   │ │
│  │  └────────┬────────┘    └─────────────────┘    └─────────────────┘   │ │
│  │           │                                                          │ │
│  │           │ Can connect to remote VPS                                 │ │
│  │           │ (if user has self-hosted platform)                       │ │
│  │           ▼                                                          │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │ │
│  │  │              "Connect to Remote Instance" Feature               │ │ │
│  │  │  ├─ Enter VPS IP                                                │ │ │
│  │  │  ├─ Authenticate                                                │ │ │
│  │  │  └─ Stream from remote instead of local                        │ │ │
│  │  └─────────────────────────────────────────────────────────────────┘ │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  Distribution:                                                              │
│  • macOS: .dmg via GitHub Releases                                          │
│  • Windows: .exe installer                                                  │
│  • Linux: .AppImage or .deb                                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Build Process for Production

### Step 1: Build Static Web UI

```bash
# From cmd/shell/web
cd /root/allternit/cmd/shell/web

# Install dependencies
pnpm install

# Build production bundle
pnpm build

# Output: dist/ folder with optimized files
# - index.html
# - assets/ (JS, CSS, images - all minified)
# - No dev server, no HMR, no source maps
```

### Step 2: Build Electron Desktop App

```bash
# From cmd/shell/desktop
cd /root/allternit/cmd/shell/desktop

# Build TypeScript
npm run build

# Package Electron (creates distributables)
npm run dist

# Output: 
# - dist/allternit-platform-1.0.0.dmg (macOS)
# - dist/allternit-platform-1.0.0.exe (Windows)
# - dist/allternit-platform-1.0.0.AppImage (Linux)
```

### Step 3: Build Rust API Binary

```bash
# From project root
cd /root/allternit

# Build optimized release binary
cargo build --release --bin allternit-api

# Output: target/release/allternit-api
# - Optimized binary (~10-50MB)
# - No debug symbols
# - Fast execution
```

---

## Deployment Options

### Option A: Self-Hosted (Company Runs Everything)

```bash
# Company deploys on their VPS
# 1. Download release
curl -L https://github.com/allternit/allternit/releases/download/v1.0.0/allternit-linux-x64.tar.gz | tar xz

# 2. Run binary (no build needed!)
./allternit-api --bind 0.0.0.0:3010 --data /var/lib/allternit

# 3. Serve static UI (nginx)
# nginx config serves built files from cmd/shell/web/dist
```

### Option B: Hybrid (Your Model)

```yaml
# docker-compose.production.yml
version: '3.9'

services:
  # Static UI (could be on Vercel/Netlify instead)
  ui:
    image: nginx:alpine
    volumes:
      - ./cmd/shell/web/dist:/usr/share/nginx/html:ro
    ports:
      - "80:80"
  
  # API (this connects to customer's VPS via WebSocket)
  api:
    image: allternit/api:latest
    environment:
      - ALLTERNIT_MODE=saas-gateway
      - ALLTERNIT_CUSTOMER_VPS_HOST=${CUSTOMER_VPS}
      - ALLTERNIT_CUSTOMER_AUTH_TOKEN=${AUTH_TOKEN}
    ports:
      - "3010:3010"
```

### Option C: Desktop App Distribution

```bash
# GitHub Actions workflow builds releases automatically
# .github/workflows/release.yml

name: Release
on:
  push:
    tags: ['v*']

jobs:
  build:
    strategy:
      matrix:
        os: [macos-latest, ubuntu-latest, windows-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v3
      - name: Build Electron
        run: |
          cd cmd/shell/desktop
          npm install
          npm run dist
      - name: Upload Release
        uses: softprops/action-gh-release@v1
        with:
          files: |
            cmd/shell/desktop/dist/*.dmg
            cmd/shell/desktop/dist/*.exe
            cmd/shell/desktop/dist/*.AppImage
```

---

## Correcting Your Current Setup

### What's Wrong Now

| Aspect | Current | Should Be |
|--------|---------|-----------|
| **UI Server** | `pnpm dev` (Vite dev) | `nginx` serving static `dist/` |
| **Process** | systemd runs dev | systemd runs compiled binary |
| **Binary** | Built on-demand | Pre-built release binary |
| **Assets** | Uncompiled TS | Minified JS/CSS |
| **Speed** | 20-40s first load | <1s first load |

### Fix Checklist

```bash
# 1. Fix TypeScript errors first
# (You mentioned about 10 errors - need to resolve these)
cd cmd/shell/web
pnpm typecheck
# Fix all errors...

# 2. Build production bundle
pnpm build

# 3. Update systemd to serve static files
# /etc/systemd/system/allternit-ui.service
[Unit]
Description=Allternit Static UI
After=network.target

[Service]
Type=simple
User=allternit
WorkingDirectory=/var/www/allternit
# Use nginx OR a simple static server
ExecStart=/usr/bin/python3 -m http.server 5177 --directory /var/www/allternit/dist
Restart=always

[Install]
WantedBy=multi-user.target

# 4. For API (already correct mostly)
# /etc/systemd/system/allternit-api.service
[Unit]
Description=Allternit API Server
After=network.target

[Service]
Type=simple
User=allternit
WorkingDirectory=/opt/allternit
ExecStart=/opt/allternit/target/release/allternit-api
Restart=always
Environment="Allternit_API_BIND=0.0.0.0:3010"

[Install]
WantedBy=multi-user.target
```

---

## Your Specific Use Case Implementation

### Architecture for "Company VPS + Your Cloud UI"

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    YOUR IMPLEMENTATION PLAN                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  PART 1: COMPANY VPS (Self-Hosted Compute)                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  $ ./install.sh  # Downloads pre-built binary                       │   │
│  │  $ ./allternit start    # Starts API + Chrome Streaming                   │   │
│  │                                                                     │   │
│  │  Exposes:                                                           │   │
│  │  • API: https://company-vps.com:3010                                │   │
│  │  • Chrome Stream: wss://company-vps.com:8081                       │   │
│  │                                                                     │   │
│  │  Security:                                                          │   │
│  │  • API key required for all requests                                │   │
│  │  • CORS restricted to your domain                                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  PART 2: YOUR CLOUD (Hosted UI)                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Deployed to Vercel/Netlify:                                        │   │
│  │  • https://platform.yourcompany.com                                 │   │
│  │                                                                     │   │
│  │  Company logs in → Enters their VPS URL + API key                  │   │
│  │  → UI connects to THEIR VPS for compute                            │   │
│  │                                                                     │   │
│  │  Benefits:                                                          │   │
│  │  • You control UI updates                                           │   │
│  │  • Their data never touches your servers                            │   │
│  │  • They pay for their own compute                                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  PART 3: END USER EXPERIENCE                                                │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  1. User visits https://platform.yourcompany.com                    │   │
│  │  2. Logs in with company credentials                                │   │
│  │  3. Sees dashboard connecting to their VPS                          │   │
│  │  4. Clicks "Open Browser" → WebRTC stream from their VPS           │   │
│  │  5. All compute happens on their infrastructure                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  PART 4: DESKTOP APP (Optional)                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Download from: https://platform.yourcompany.com/download          │   │
│  │                                                                     │   │
│  │  Features:                                                          │   │
│  │  • Can connect to local instance (localhost)                        │   │
│  │  • Can connect to company VPS (remote)                              │   │
│  │  • Better performance, native shortcuts                             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Summary

| Question | Answer |
|----------|--------|
| Is current setup production? | **NO** - It's running `pnpm dev` which is development only |
| Is my mental model valid? | **YES** - Self-hosted compute + Cloud UI is a valid SaaS model |
| What's needed for production? | Build static files, use nginx, distribute binaries |
| Should I use Electron or Web? | **Both** - Web for accessibility, Desktop for power users |
| Who hosts what? | You host UI (static), they host compute (API/Chrome) |

---

## Next Steps

1. **Fix TypeScript errors** in web app (so it can build)
2. **Build production bundle** (`pnpm build`)
3. **Create systemd service** for static file serving
4. **Build release binaries** (`cargo build --release`)
5. **Set up CI/CD** for automated builds
6. **Create install script** for customer VPS deployment

Want me to help with any of these steps?
