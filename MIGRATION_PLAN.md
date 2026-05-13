# Next.js → Vite + Rust Migration Plan

## Executive Summary

The codebase has **three build targets** but only **one** actually uses Next.js server features:

| Target | Uses Next.js Server? | Build Output |
|--------|---------------------|--------------|
| **Cloudflare Pages** | ❌ No | Static export (`output: 'export'`) |
| **Desktop (Electron)** | ❌ No | Static export copied to `resources/platform/` |
| **Dev Server** | ✅ Yes | `next dev` with API routes |

**The main app (`ShellApp`) is already a self-contained SPA with its own internal router.** The Next.js App Router is essentially a no-op wrapper. This makes the frontend migration much simpler than it appears.

---

## Phase 1: Frontend Shell (Next.js → Vite)

### 1.1 Why the Frontend Migration is Easier Than Expected

**Key finding:** `ShellApp.tsx` implements its own routing via `src/nav/nav.store.ts` with a custom `navReducer`. It manages ~80 view types internally. Next.js just renders `ShellApp` at `/` and `/shell`.

```
Next.js App Router              ShellApp Internal Router
─────────────────               ────────────────────────
/page.tsx ──→ ShellApp          navReducer manages:
/shell/page.tsx ──→ ShellApp      - chat, code, design, browser
/shell/sessions ──→ standalone    - cowork sub-views
/cowork-team/* ──→ standalone     - settings, terminal, etc.
/oauth/* ──→ auth pages           - ~80 total view types
```

### 1.2 Files to Change

#### A. Entry Points (6 `page.tsx` files → 1 `index.html` + `main.tsx`)

**Remove entirely:**
- `src/app/page.tsx` → becomes `index.html` + `src/main.tsx`
- `src/app/shell/page.tsx` → merge into main entry
- `src/app/shell/new/page.tsx` → redirect logic moves to React Router
- `src/app/layout.tsx` → becomes `src/App.tsx` root layout

**Convert to React Router routes:**
| Next.js Path | React Router Route | Component |
|-------------|-------------------|-----------|
| `/` | `/` | `ShellApp` |
| `/shell` | `/shell` | `ShellApp` (or redirect `/`) |
| `/shell/sessions` | `/shell/sessions` | `SessionsPage` |
| `/sign-in` | `/sign-in` | `SignInPage` |
| `/sign-up` | `/sign-up` | `SignUpPage` |
| `/oauth/authorize` | `/oauth/authorize` | `AuthorizePage` |
| `/oauth/select-account` | `/oauth/select-account` | `SelectAccountPage` |
| `/oauth/success` | `/oauth/success` | `SuccessPage` |
| `/cowork-team` | `/cowork-team` | `CoworkTeamDashboard` |
| `/cowork-team/agents` | `/cowork-team/agents` | `CoworkTeamAgentsView` |
| `/cowork-team/board` | `/cowork-team/board` | `CoworkBoardView` |
| `/cowork-team/workspaces` | `/cowork-team/workspaces` | `CoworkWorkspacesView` |
| `/cowork-team/workspaces/:id` | `/cowork-team/workspaces/:id` | `CoworkWorkspaceDetailView` |
| `/marketplace` | `/marketplace` | `PluginMarketplace` |
| `/workflows` | `/workflows` | `WorkflowBuilder` |
| `/privacy` | `/privacy` | `PrivacyPage` |
| `/terms` | `/terms` | `TermsPage` |
| `/status` | `/status` | `StatusPage` |
| `/connect` | `/connect` | `ConnectPage` |
| `/debug-mode` | `/debug-mode` | `DebugModePage` |
| `/gallery-test` | `/gallery-test` | `GalleryTestPage` |
| `/swarm-preview` | `/swarm-preview` | `SwarmPreviewPage` |
| `/terminal-test` | `/terminal-test` | `TerminalTestPage` |
| `/terminal/clerk` | `/terminal/clerk` | `TerminalClerkPage` |

#### B. `next/dynamic` → `React.lazy` + `Suspense` (6 files)

**Pattern change:**
```tsx
// BEFORE (Next.js)
import dynamic from 'next/dynamic';
const ShellApp = dynamic(() => import('./shell/ShellApp'), { ssr: false });

// AFTER (Vite)
import { lazy, Suspense } from 'react';
const ShellApp = lazy(() => import('./shell/ShellApp'));
// Wrap in <Suspense fallback={<AppLoader />}>
```

**Files:**
- `src/app/page.tsx` (removed)
- `src/app/terminal-test/page.tsx` (removed)
- `src/app/shell/page.tsx` (removed)
- `src/shell/ShellApp.tsx` — custom `lazy()` factory wraps `next/dynamic`. Replace with standard `React.lazy`
- `src/components/agent-elements/spiral-loader.tsx`
- `src/views/design/office/OfficeWorkspace.tsx`

#### C. `next/navigation` → React Router (13 files)

**Pattern change:**
```tsx
// BEFORE
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
const router = useRouter();
router.push('/path');

// AFTER
import { useNavigate, useLocation } from 'react-router-dom';
const navigate = useNavigate();
navigate('/path');

// usePathname → useLocation().pathname
// useSearchParams → useSearchParams() from react-router-dom (same API!)
```

**Files:**
- `src/shell/ShellApp.tsx` — core routing logic
- `src/views/settings/VPSConnectionsPanel.tsx`
- `src/views/settings/SSHConnectionManager.tsx`
- `src/lib/platform-auth-client.tsx`
- `src/app/debug-mode/page.tsx`
- `src/app/connect/page.tsx`
- `src/app/terminal/clerk/page.tsx`
- `src/app/oauth/authorize/page.tsx`
- `src/app/oauth/select-account/page.tsx`
- `src/app/oauth/success/page.tsx`
- `src/app/shell/sessions/page.tsx`
- `src/app/sign-in/page.tsx`
- `src/app/sign-up/page.tsx`

#### D. `next/link` → React Router `<Link>` (3 files)

- `src/views/workflow/WorkflowListView.tsx`
- `src/views/cowork-team/CoworkWorkspacesView.tsx`
- `src/views/cowork-team/CoworkWorkspaceDetailView.tsx`

#### E. `next/headers` → Custom Request Context (1 file)

- `src/lib/server-auth.ts` — reads `headers()` for auth tokens.
  - **In Vite (no SSR):** This becomes a client-side auth module.
  - **In Desktop:** Auth tokens come from Electron's `localStorage` or IPC.
  - **In Cloudflare:** Auth is handled by Clerk/Cloudflare directly.

#### F. `next/cache` → SWR/React Query (2 files)

- `src/lib/ai/app-models.ts` — replace `unstable_cache` with SWR or React Query caching
- `src/lib/ai/mcp/cache.ts` — same

#### G. `Metadata` / `generateStaticParams` → `react-helmet-async` (6 files)

- `src/app/layout.tsx` — move `<title>`, `<meta>` to `react-helmet-async`
- `src/app/privacy/page.tsx`
- `src/app/terms/page.tsx`
- `src/app/(platform)/marketplace/page.tsx`
- `src/app/(platform)/workflows/page.tsx`
- `src/app/(platform)/cowork-team/workspaces/[id]/page.tsx` — `generateStaticParams` not needed for SPA

#### H. `middleware.ts` → Rust Middleware or Auth Guard

- `src/middleware.ts` — Clerk auth middleware.
  - **Rust:** Add auth middleware to Axum router.
  - **Cloudflare:** Use Cloudflare Access or Clerk's Cloudflare integration.
  - **Desktop:** Auth gate in `ShellApp.tsx` (already exists).

### 1.3 Vite Configuration

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@allternit/runtime': path.resolve(__dirname, '../../services/runtime/adapter/allternit-runtime/src/index.ts'),
      // ... other monorepo aliases
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  server: {
    port: 3013,
    proxy: {
      '/api': 'http://localhost:8013',
    },
  },
});
```

### 1.4 New File Structure

```
src/
├── main.tsx              # ReactDOM.createRoot, <BrowserRouter>
├── App.tsx               # Root layout (ThemeProvider, PlatformAuthProvider)
├── routes.tsx            # React Router route definitions
├── index.html            # HTML entry point
├── shell/
│   └── ShellApp.tsx      # Already framework-agnostic (just replace next/dynamic)
├── nav/                  # Already framework-agnostic
├── views/                # No changes needed
├── components/           # No changes needed
└── ...
```

---

## Phase 2: API Routes (Next.js → Rust)

### 2.1 Current State

**Next.js API routes:** ~202 endpoints in `src/app/api/`
**Rust API routes:** ~75 endpoints in `cmd/allternit-cloud-api/src/lib.rs`

### 2.2 Migration Strategy: Tiers

Not all 202 routes need Rust equivalents. Some are dev-only, some are frontend-only, and some can be removed.

#### Tier 1: Core Platform (Must Migrate to Rust)

These are actively used by the frontend and need a Rust backend:

| Route Group | Next.js Routes | Rust Status | Priority |
|------------|---------------|-------------|----------|
| **Auth** | `/api/oauth/*`, `/api/onboarding/*` | ❌ None | 🔴 Critical |
| **Chat/AI** | `/api/v1/ai/chat`, `/api/agents/v1/*` | ❌ None | 🔴 Critical |
| **Conversations** | `/api/v1/conversations/*` | ❌ None | 🔴 Critical |
| **Workspaces** | `/api/v1/workspaces/*` | ❌ None | 🔴 Critical |
| **Cowork** | `/api/v1/cowork/*`, `/api/v1/cowork-team/*` | ❌ None | 🔴 Critical |
| **Memory** | `/api/v1/memory/*` | ❌ None | 🔴 Critical |
| **Artifacts** | `/api/v1/artifacts/*` | ❌ None | 🔴 Critical |
| **Workflows** | `/api/v1/workflows/*` | ❌ None | 🔴 Critical |
| **Terminal** | `/api/terminal/*` | ❌ None | 🟡 High |
| **h5i** | `/api/h5i/*` | ❌ None | 🟡 High |
| **Files** | `/api/v1/files/*` | ❌ None | 🟡 High |
| **SSH** | `/api/v1/ssh-connections/*`, `/api/v1/ssh-keys/*` | ❌ None | 🟡 High |
| **Swarm** | `/api/v1/swarm/*` | ❌ None | 🟡 High |

#### Tier 2: Infrastructure (Partially Migrated)

| Route Group | Next.js Routes | Rust Status | Priority |
|------------|---------------|-------------|----------|
| **Runs/Jobs** | Some in Next.js | ✅ Rust has `/api/v1/runs/*`, `/api/v1/jobs/*` | 🟢 Done |
| **Schedules** | Some in Next.js | ✅ Rust has `/api/v1/schedules/*` | 🟢 Done |
| **Approvals** | Some in Next.js | ✅ Rust has `/api/v1/approvals/*` | 🟢 Done |
| **Deployments** | Some in Next.js | ✅ Rust has `/api/v1/deployments/*` | 🟢 Done |
| **Providers** | `/api/v1/providers/*` | ✅ Rust has `/api/v1/providers/*` | 🟢 Done |
| **Regions** | `/api/v1/regions/*` | ✅ Rust has `/api/v1/regions/*` | 🟢 Done |
| **Instances** | `/api/v1/instances/*` | ✅ Rust has `/api/v1/instances/*` | 🟢 Done |
| **Costs** | `/api/v1/costs/*` | ✅ Rust has `/api/v1/costs/*` | 🟢 Done |
| **Tasks** | Some in Next.js | ✅ Rust has `/api/v1/tasks/*` | 🟢 Done |

#### Tier 3: Can Be Removed or Simplified

| Route Group | Rationale |
|------------|-----------|
| `/api/chat-test` | Dev-only test endpoint |
| `/api/playground` | Dev-only |
| `/api/gallery-test` | Dev-only |
| `/api/status` | Can be a static page or Rust health check |
| `/api/v1/udemy/*` | External proxy — can call Udemy directly from frontend |
| `/api/v1/website/fetch` | CORS proxy — can be handled by Rust or removed |
| `/api/web-proxy` | Same as above |
| `/api/design/import-url` | Can be frontend-only |
| `/api/v1/courses`, `/api/v1/lessons` | If these are content APIs, may not need backend |
| `/api/v1/certifications` | May not need backend |
| `/api/v1/enrollments` | May not need backend |
| `/api/v1/inbox` | May not need backend |
| `/api/v1/capabilities` | Can be static JSON |
| `/api/v1/version` | Can be served by Rust |

### 2.3 Implementation Order

**Week 1-2: Auth & Session**
- `/api/oauth/*` → Rust auth middleware
- `/api/onboarding/*` → Rust onboarding flow
- Clerk session validation → Rust JWT validation

**Week 3-4: Core Data APIs**
- `/api/v1/conversations/*` → Rust
- `/api/v1/workspaces/*` → Rust
- `/api/v1/cowork/*` → Rust
- `/api/v1/memory/*` → Rust

**Week 5-6: Code/Terminal/h5i**
- `/api/terminal/*` → Rust (node-pty integration)
- `/api/h5i/*` → Rust
- `/api/v1/files/*` → Rust

**Week 7-8: Agents & AI**
- `/api/v1/ai/chat` → Rust
- `/api/agents/v1/*` → Rust
- `/api/v1/workflows/*` → Rust

**Week 9-10: Artifacts & Design**
- `/api/v1/artifacts/*` → Rust
- `/api/design/*` → Rust or remove

### 2.4 Frontend API Client Changes

All frontend fetch calls currently go to relative paths (e.g., `/api/v1/ai/chat`). With Rust on port 8013:

```ts
// BEFORE (Next.js — same origin)
fetch('/api/v1/ai/chat', { ... })

// AFTER (Rust — different origin in dev)
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8013';
fetch(`${API_BASE}/api/v1/ai/chat`, { ... })
```

**In production:**
- **Cloudflare:** API calls go to `https://api.allternit.com` (or similar)
- **Desktop:** API calls go to `http://localhost:8013` (local Rust server)

---

## Phase 3: Build Pipeline

### 3.1 Dev Environment

```bash
# BEFORE
pnpm run dev  # Next.js dev server on :3013

# AFTER
pnpm run dev  # Vite dev server on :3013 (proxy /api to :8013)
```

Vite's proxy config forwards `/api/*` to the Rust backend automatically.

### 3.2 Cloudflare Pages Build

```bash
# BEFORE
CLOUDFLARE_PAGES=1 next build  # output: dist/

# AFTER
pnpm run build  # vite build, output: dist/
```

No more `build-cloudflare.sh` hack that moves `src/app/api` out. The API directory simply doesn't exist in the Vite project.

### 3.3 Desktop Build

```bash
# BEFORE
npm run prepare:platform-static  # builds Next.js static export, copies to resources/

# AFTER
npm run prepare:platform-static  # builds Vite, copies to resources/
```

The `prepare-platform-static.cjs` script runs `vite build` instead of `next build`.

### 3.4 File Changes

| File | Action |
|------|--------|
| `next.config.ts` | ❌ Delete |
| `package.json` scripts | Update `dev`, `build`, `preview` |
| `package.json` deps | Remove `next`, `@cloudflare/next-on-pages` |
| `tsconfig.json` | Update paths (remove Next.js types) |
| `scripts/build-cloudflare.sh` | ❌ Delete |
| `scripts/build-desktop-server.cjs` | Update to call `vite build` |
| `src/middleware.ts` | ❌ Delete (move auth to Rust) |
| `src/app/api/` | ❌ Delete entire directory (moved to Rust) |
| `src/app/` | ❌ Delete (replaced by Vite entry points) |
| `src/pages/_document.tsx` | ❌ Delete (legacy Pages Router) |

---

## Phase 4: Risk Mitigation

### 4.1 Biggest Risks

| Risk | Mitigation |
|------|-----------|
| **~80 lazy-loaded views in ShellApp** | Vite supports `React.lazy()` with code splitting out of the box. Test each view loads correctly. |
| **Native Node.js modules** | `node-pty`, `better-sqlite3`, `ssh2` are already in `serverExternalPackages`. In Vite, they're not bundled at all (they run in Rust). |
| **Auth middleware** | Rust Axum has excellent middleware support. Port Clerk JWT validation to Rust. |
| **CSS/Theme FOUC** | The theme init script from `layout.tsx` moves to `index.html` as an inline `<script>`. |
| **Environment variables** | Replace `process.env.NEXT_PUBLIC_*` with `import.meta.env.VITE_*`. |

### 4.2 Recommended Approach: Strangler Fig Pattern

Don't do a big-bang migration. Instead:

1. **Create `src/vite/`** parallel to `src/app/`
2. **Port ShellApp and core views first**
3. **Run both Next.js and Vite in parallel** during transition
4. **Migrate API routes one group at a time**
5. **Once stable, delete `src/app/` and `next.config.ts`**

---

## Appendix: Full API Route Inventory

### Already in Rust (✅)
- `/api/v1/runs/*`
- `/api/v1/jobs/*`
- `/api/v1/checkpoints/*`
- `/api/v1/schedules/*`
- `/api/v1/approvals/*`
- `/api/v1/deployments/*`
- `/api/v1/providers/*`
- `/api/v1/regions/*`
- `/api/v1/instances/*`
- `/api/v1/costs/*`
- `/api/v1/tasks/*`
- `/ws/runs/:id`
- `/api/v1/deployments/:id/events`

### Needs Rust Migration (❌)
See full list at the top of this document (~140 routes remaining).

### Can Be Removed (🗑️)
- `/api/chat-test`
- `/api/playground`
- `/api/gallery-test`
- `/api/v1/udemy/*`
- `/api/web-proxy`
- `/api/v1/website/fetch`
