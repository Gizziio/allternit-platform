# Allternit Desktop — Gap Analysis & Integration Analysis
## Claude Desktop Architecture Parity Assessment

---

## 1. Claude Desktop Architecture (Reference Model)

Claude Desktop uses a **remote UI + local backend** architecture:

| Layer | Claude Desktop | How It Works |
|-------|---------------|--------------|
| **UI Shell** | Electron loads `https://claude.ai` | Remote Next.js app served from CDN |
| **API Redirection** | `webRequest.onBeforeRequest` | Intercepts `/api/*` → `localhost:8080` |
| **Local Backend** | Claude Code engine (Rust/Go) | Runs on `localhost:8080`, handles sessions, tools, MCP |
| **Auth** | OAuth PKCE + protocol callback | `claude://` scheme, external browser sign-in |
| **AI Runtime** | Local LLM inference or API proxy | Manages conversation state, tool execution |
| **MCP Host** | Built-in MCP client | Reads `claude_desktop_config.json`, manages server lifecycle |
| **Permissions** | macOS Accessibility + Screen Recording | Required for computer-use automation |
| **Data Storage** | Local SQLite + encrypted keychain | User data never leaves the device |
| **Updates** | Auto-update via electron-updater | Downloads new binaries from GitHub Releases |
| **Offline Mode** | Bundled static UI fallback | If `claude.ai` unreachable, serves local copy |

**Key Integration Pattern:** The renderer (remote UI) thinks it's talking to `claude.ai/api/*`, but Electron transparently redirects those requests to `localhost:8080`. The backend validates auth tokens and handles all business logic.

---

## 2. Our Current Architecture

### 2.1 What's Implemented

| Component | Status | Details |
|-----------|--------|---------|
| **Electron Shell** | ✅ Complete | Splash screen, main window, mini window, tray, global hotkey |
| **Remote UI Loading** | ✅ Complete | Loads `https://ai.allternit.com` (Cloudflare Pages) |
| **API Redirection** | ✅ Complete | `webRequest.onBeforeRequest` redirects `/api/*` → `localhost:8013` |
| **Auth Token Injection** | ✅ Complete | `onBeforeSendHeaders` injects `Bearer` for localhost calls |
| **Rust API Backend** | ✅ Compiles | Axum server on port 8013, 17 SQLite tables, ~25 routes implemented |
| **Gizzi AI Runtime** | ✅ Complete | Bun binary on port 4096, per-session password auth |
| **OAuth PKCE Flow** | ✅ Complete | `allternit://auth/callback`, PKCE, token refresh, multi-account |
| **Backend Lifecycle** | ✅ Complete | Spawn, health check, auto-restart, hard reset |
| **Gizzi Lifecycle** | ✅ Complete | Spawn, password auth, health check, auto-restart |
| **MCP Host** | ✅ Complete | Claude-compatible config, JSON-RPC over stdio, tool listing/calling |
| **Extension Bridge** | ✅ Complete | TCP server port 3011 for Chrome native messaging |
| **Tray Integration** | ✅ Complete | Status menu, permission indicators, mode display |
| **Auto-updater** | ✅ Configured | `update-electron-app` configured |
| **Electron Builder** | ✅ Complete | macOS (DMG+ZIP), Windows (NSIS), Linux (AppImage+deb), notarization |
| **Static Export Build** | ✅ Working | `pnpm build:cloudflare` → 38 pages in `dist/` |
| **CORS** | ✅ Complete | Allows `https://ai.allternit.com` and `localhost:3013` |
| **TypeScript Compile** | ✅ Clean | `tsc --noEmit` passes for main + preload |
| **Rust Compile** | ✅ Clean | `cargo build` and `cargo build --release` both succeed |

### 2.2 What's Partially Implemented (Stubs / Partial)

| Component | Status | Gap |
|-----------|--------|-----|
| **Rust API Routes** | 🟡 ~50% | ~25 fully implemented, ~30 stubs, ~35 completely missing |
| **SQLite Schema** | 🟡 ~55% | 17 tables in Rust, 22 tables exist only in Prisma |
| **Auth Validation** | 🟡 0% | Desktop injects Bearer tokens, Rust API **ignores them entirely** |
| **Chrome Embed** | 🟡 Stub | `chrome:launch/navigate/close` return "not yet available" |
| **VM Setup (Lima)** | 🟡 Partial | IPC handlers exist, but simplified (brew install only) |
| **Backend Auto-Download** | 🟡 Configured | Manifest has URLs/checksums, but **no download logic exists** |
| **Local UI Fallback** | 🟡 Partial | `resolvePlatformStaticPath()` exists but never used as fallback |
| **Research Backend** | 🟡 Lazy-start | `notebookManager` exists, unclear if fully wired |
| **HyperFrames** | 🟡 External dep | Requires `npx hyperframes` CLI to be installed |
| **Window Event Emitter** | 🟡 Broken | `window:event:*` channel subscribed in preload, **never emitted from main** |
| **Dev Mode Backend** | 🟡 Weak | If binary not found in dev, silently returns URL without starting anything |

### 2.3 What's Completely Missing

| Component | Impact | Notes |
|-----------|--------|-------|
| **Auth Middleware (Rust)** | 🔴 Critical | Anyone with localhost access can read/write all data |
| **Users Table (Rust SQLite)** | 🔴 Critical | No user entity in Rust DB — auth tokens have no validation target |
| **Tasks API** | 🔴 High | `/api/v1/tasks/*` completely missing — core workflow feature |
| **Tools Execute API** | 🔴 High | `/api/v1/tools/execute` missing — agent tool calling |
| **Local Brain API** | 🔴 High | `/api/local-brain` missing — memory/embedding queries |
| **Providers API** | 🔴 High | `/api/v1/providers` and `/api/provider/ollama/models` missing |
| **Capabilities API** | 🟡 Medium | `/api/v1/capabilities` missing — feature discovery |
| **Workspace Members API** | 🟡 Medium | `/api/v1/workspaces/:id/members` missing |
| **Agent Runtimes Table** | 🟡 Medium | No Rust equivalent for Prisma `agent_runtimes` |
| **Workflow Executions Table** | 🟡 Medium | No Rust equivalent for Prisma `workflow_executions` |
| **Board Comments Table** | 🟡 Low | No Rust equivalent for Prisma `board_comments` |
| **Team Skills Table** | 🟡 Low | No Rust equivalent for Prisma `team_skills` |
| **Cowork Tables (6)** | 🟡 Low | `cowork_projects`, `cowork_sessions`, etc. — partially stubbed |
| **CLI ↔ Desktop Socket** | 🟡 Medium | Unix socket for CLI-to-desktop communication not implemented |
| **File System Watcher** | 🟡 Low | Not implemented per ARCHITECTURE_PARITY.md |
| **Secure Local HTTPS** | 🟡 Medium | Uses `allowRunningInsecureContent` instead of self-signed cert |

---

## 3. Integration Analysis

### 3.1 Desktop ↔ Rust API Integration

**Flow:**
```
Desktop (Electron) → spawns → allternit-api (Rust, :8013)
  ├── Injects: ALLTERNIT_API_PORT, ALLTERNIT_OPERATOR_API_KEY, ALLTERNIT_DATA_DIR
  ├── Injects: TERMINAL_SERVER_URL (gizzi), GIZZI_USERNAME, GIZZI_PASSWORD
  ├── Health check: GET /health (30s timeout)
  └── Auto-restart on crash (1s delay in production)
```

**Grade: B+**
- Binary resolution works for packaged and dev modes
- Environment variable injection is comprehensive
- Health checking and auto-restart are solid
- **Gap:** No auth token validation on the Rust side
- **Gap:** Backend auto-download from manifest URLs not implemented
- **Gap:** Version compatibility check exists in manifest but not enforced at runtime

### 3.2 Desktop ↔ Gizzi Integration

**Flow:**
```
Desktop (Electron) → spawns → gizzi-code (Bun, :4096)
  ├── Per-session random password (24 bytes hex)
  ├── Basic auth: gizzi:<password>
  ├── Health check: GET /v1/global/health
  └── Credentials passed to Rust API via env vars
```

**Grade: A-**
- Binary resolution works
- Password auth is secure (per-session random)
- Health checking works
- Auto-restart works
- **Gap:** Gizzi failure is non-fatal — app continues without AI (intentional but may confuse)
- **Gap:** Dev mode binary path is brittle (relies on monorepo structure)

### 3.3 Desktop ↔ Web UI Integration

**Flow:**
```
Electron Window → loadURL(https://ai.allternit.com)
  └── webRequest.onBeforeRequest
       └── /api/* → redirect to http://localhost:8013
  └── webRequest.onBeforeSendHeaders
       └── Inject Authorization: Bearer <token> for localhost
```

**Grade: B**
- API redirection works transparently
- Auth injection works
- CORS configured on Rust side
- **Gap:** No offline fallback — if ai.allternit.com is down, app is dead
- **Gap:** `allowRunningInsecureContent: true` is a security workaround
- **Gap:** WebSocket streams not handled (only HTTP `/api/*` redirected)

### 3.4 Web UI ↔ Rust API Integration

**Flow:**
```
https://ai.allternit.com (Next.js static export)
  ├── Thinks it's calling /api/* on same origin
  ├── Actually hitting localhost:8013 via redirect
  └── Receives responses from Rust API
```

**Grade: C+**
- Route coverage is incomplete (~50% of needed routes)
- No auth validation — Rust API accepts any Bearer token (or none)
- Database schema mismatch — 5 tables exist, many Prisma tables missing in Rust
- **Critical:** Conversations, messages, files work, but tasks, tools, providers don't

### 3.5 Auth Flow Integration

**Flow:**
```
Splash Screen → "Sign In" → auth:start-login IPC
  └── DesktopAuthManager.generate PKCE verifier + state
  └── shell.openExternal(https://platform.allternit.com/sign-in?...)
  └── User signs in with Clerk (browser)
  └── Redirect to allternit://auth/callback?code=...&state=...
  └── app.on('open-url') captures protocol callback
  └── exchangeCodeForSession(code, verifier) → /api/oauth/token
  └── Persist encrypted session to disk
```

**Grade: B+**
- Full PKCE implementation
- Token refresh with skew handling
- Multi-account support
- Encrypted session persistence (local-hardware AES)
- **Gap:** OAuth base URL is `platform.allternit.com` but UI loads from `ai.allternit.com` — cross-subdomain issue
- **Gap:** Rust API doesn't validate these tokens
- **Gap:** No Clerk webhook handlers in Rust API

### 3.6 MCP Host Integration

**Flow:**
```
Renderer → mcp:list-servers → mcpHostManager
  ├── Reads ~/.allternit/mcp-config.json (Claude-compatible format)
  ├── Spawns MCP servers via JSON-RPC over stdio
  └── Returns tool lists, handles tool calls
```

**Grade: B**
- Claude-compatible config format
- Full server lifecycle management
- Tool listing and calling works
- **Gap:** Custom JSON-RPC implementation instead of official `@modelcontextprotocol/sdk`
- **Gap:** No MCP OAuth token refresh automation

### 3.7 Preload ↔ Main IPC Integration

**Grade: B**

| API Category | Preload APIs | Main Handlers | Coverage |
|-------------|--------------|---------------|----------|
| SDK/Backend URL | 1 | 1 | ✅ 100% |
| Connection | 4 | 4 | ✅ 100% |
| Backend/Sidecar | 9 | 9 | ✅ 100% |
| VM Setup | 5 | 5 | ✅ 100% |
| Window | 14 | 14 | ✅ 100% |
| Store | 2 | 2 | ✅ 100% |
| App Info | 3 | 3 | ✅ 100% |
| Auth | 6 | 6 | ✅ 100% |
| Shell/Dialog | 3 | 3 | ✅ 100% |
| Theme | 3 | 3 | ✅ 100% |
| Extension | 4 | 4 | ✅ 100% |
| Tunnel | 6 | 6 | ✅ 100% |
| Chrome Embed | 3 | 3 | 🟡 Stubs |
| Permission Guide | 7 | 7 | ✅ 100% |
| Feature Flags | 3 | 3 | ✅ 100% |
| Persisted State | 4 | 4 | ✅ 100% |
| Find in Page | 4 | 4 | ✅ 100% |
| Locale | 3 | 3 | ✅ 100% |
| Menu Bar | 3 | 3 | ✅ 100% |
| Startup | 2 | 2 | ✅ 100% |
| MCP | 6 | 6 | ✅ 100% |
| Research | 3 | 3 | ✅ 100% |
| Worker Bus | 2 | 2 | ✅ 100% |
| HyperFrames | 3 | 3 | ✅ 100% |

**Total: ~48 APIs exposed, ~47 implemented, 1 stubbed (Chrome)**

**Window Events Gap:**
- Preload exposes `window.allternit.window.onEvent(event, handler)`
- Main process has NO `window:event:*` emitters
- Events like `resize`, `move`, `focus`, `blur` are never pushed to renderer

---

## 4. Detailed Gap Analysis by Component

### 4.1 Authentication & Security (Grade: C+)

**Claude Desktop:**
- Tokens validated by backend on every request
- Sessions bound to device fingerprint
- Refresh tokens rotated on use

**Allternit:**
- ✅ Desktop generates and stores tokens properly
- ✅ PKCE flow is correct
- ✅ Token refresh works
- ❌ **Rust API has ZERO auth middleware** — `Authorization: Bearer` header is read but never validated
- ❌ **No user table in Rust SQLite** — even if we wanted to validate, there's no user entity
- ❌ **No Clerk webhook handlers** — can't sync user state from Clerk to local DB
- ❌ **`allowRunningInsecureContent: true`** — security workaround for HTTPS→HTTP

**Fix Priority: P0**
1. Add `users` table to Rust SQLite schema
2. Add auth middleware to Axum router
3. Implement Clerk JWT validation (or token introspection)
4. Remove `allowRunningInsecureContent` by serving localhost over HTTPS with self-signed cert

### 4.2 Database Schema (Grade: C-)

**Prisma Schema (source of truth):** 39 tables
**Rust SQLite (current):** 17 tables

**Missing in Rust:**
| Table | Priority | Used By |
|-------|----------|---------|
| `users` | P0 | Auth, all user-scoped queries |
| `agents` | P1 | Agent management, runtime |
| `tasks` | P1 | Task system, workflows |
| `workflow_executions` | P1 | Workflow engine |
| `workspace_invitations` | P2 | Team collaboration |
| `board_comments` | P2 | Board feature |
| `team_skills` | P2 | Skill sharing |
| `agent_runtimes` | P2 | Agent execution |
| `memory_entities` | P2 | Knowledge graph |
| `memory_edges` | P2 | Knowledge graph |
| `test_suites` | P3 | Testing framework |
| `agent_metrics` | P3 | Analytics |
| `cowork_projects` | P3 | Cowork feature |
| `cowork_sessions` | P3 | Cowork feature |
| `cowork_scheduled_tasks` | P3 | Cowork feature |
| `cowork_memory_entries` | P3 | Cowork feature |
| `cowork_personas` | P3 | Cowork feature |
| `cowork_connectors` | P3 | Cowork feature |
| `cowork_suggestions` | P3 | Cowork feature |

### 4.3 API Routes (Grade: C)

**Implemented (~25):**
- Health check
- Conversations CRUD
- Messages CRUD
- Artifacts CRUD
- Workspaces CRUD
- Files upload/download
- Memory documents/events
- Status/presence
- MCP OAuth callback
- VM sessions (partial)
- Terminal (partial)
- SSH (stub)
- Swarm (stub)
- Board items (stub)
- Cowork (stub)

**Missing (~35):**
| Route | Priority | Description |
|-------|----------|-------------|
| `/api/v1/tasks/*` | P0 | Task CRUD, assignments, scheduling |
| `/api/v1/tools/execute` | P0 | Agent tool execution |
| `/api/local-brain` | P0 | Vector search, memory query |
| `/api/provider/ollama/models` | P1 | Local model discovery |
| `/api/v1/providers` | P1 | LLM provider management |
| `/api/v1/capabilities` | P1 | Feature discovery |
| `/api/v1/workspaces/:id/members` | P1 | Team membership |
| `/api/v1/agents/*` | P1 | Agent CRUD |
| `/api/v1/workflows/*` | P2 | Workflow execution |
| `/api/v1/search/*` | P2 | Full-text search |
| `/api/v1/integrations/*` | P2 | External integrations |

### 4.4 Desktop Integration (Grade: B)

**What's Solid:**
- Backend lifecycle management
- Gizzi lifecycle management
- Auth flow
- Window controls
- Theme switching
- Tray integration
- Extension bridge
- Tunnel management
- Permission guide
- Feature flags
- Find in page

**What's Missing/Broken:**
| Issue | Severity | Description |
|-------|----------|-------------|
| Window events | Medium | `window:event:*` never emitted |
| Chrome embed | Medium | All stubs |
| Offline fallback | High | No local UI if remote down |
| Backend auto-download | Medium | Manifest URLs unused |
| Dev mode silent fail | Low | Binary missing → silent URL return |

### 4.5 Build & Deployment (Grade: B+)

**What's Working:**
- Rust compiles (debug + release)
- TypeScript compiles (main + preload)
- Static export builds (38 pages)
- Electron packages (macOS, Windows, Linux)
- CI/CD workflows (just fixed)

**Remaining Issues:**
| Issue | Severity | Status |
|-------|----------|--------|
| pnpm-lock.yaml | Low | Just updated |
| `prepare-platform-static.cjs` | Medium | Just fixed (was looking for `out/` instead of `dist/`) |
| Release workflow | Low | Fixed Cargo.toml paths, build script extension |
| Duplicate deploy workflow | Low | Deleted |

### 4.6 Gizzi Sidecar (Grade: A-)

**What's Working:**
- Binary builds and runs
- Per-session password auth
- Health checking
- Auto-restart
- Credential passing to Rust API

**Minor Gaps:**
- Dev mode binary path is brittle
- Failure is non-fatal (intentional design)

---

## 5. Overall Grades

| Category | Grade | Trend |
|----------|-------|-------|
| Desktop Shell | A- | Stable |
| Auth Flow (Desktop) | B+ | Stable |
| Auth (Rust API) | F | 🔴 Critical gap |
| API Routes | C | 🟡 Improving |
| Database Schema | C- | 🟡 Needs work |
| Desktop ↔ Backend Integration | B+ | Stable |
| Desktop ↔ Gizzi Integration | A- | Stable |
| Desktop ↔ Web UI Integration | B | 🟡 Needs offline fallback |
| Web UI ↔ Rust API Integration | C+ | 🟡 Routes incomplete |
| MCP Host | B | Stable |
| Build & Deploy | B+ | ✅ Just fixed CI |
| **Overall** | **C+** | **🟡 Improving** |

---

## 6. Priority Action Plan

### P0 (Critical — Block Release)
1. **Add auth middleware to Rust API** — Validate Bearer tokens
2. **Add `users` table to Rust SQLite** — Required for auth validation
3. **Implement missing `/api/v1/tasks/*` routes** — Core workflow feature
4. **Implement `/api/v1/tools/execute`** — Agent tool calling
5. **Add offline fallback** — Serve `resources/platform/` when remote UI unreachable

### P1 (High — Needed for MVP)
6. Add `agents`, `workflow_executions` tables
7. Implement `/api/local-brain` for memory queries
8. Implement `/api/v1/providers` and `/api/provider/ollama/models`
9. Add backend binary auto-download from manifest URLs
10. Fix `window:event:*` emission from main process

### P2 (Medium — Polish)
11. Add remaining Prisma tables to Rust (board_comments, team_skills, etc.)
12. Implement missing workspace member routes
13. Add Clerk webhook handlers
14. Replace `allowRunningInsecureContent` with localhost HTTPS
15. Complete Chrome embed or remove from preload

### P3 (Low — Nice to Have)
16. VM Manager integration into Electron main process
17. CLI ↔ Desktop Unix socket
18. File system watcher
19. Replace custom MCP JSON-RPC with official SDK
