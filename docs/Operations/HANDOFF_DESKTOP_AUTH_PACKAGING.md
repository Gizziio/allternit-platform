# ✦ Handoff: Allternit Desktop — Production Auth & Packaging

**Date:** 2026-04-20  
**Status:** Build stable, awaiting final OAuth handshake verification  
**Owner:** Platform / Desktop Team  

---

## 1. Executive Summary

We have transitioned the Allternit Desktop authentication model from a local-only "Clerk-disabled" mode to a production-ready external browser OAuth flow with PKCE. The desktop app itself does not use Clerk directly — instead, it orchestrates an OAuth 2.0 flow where **Clerk handles user authentication in the browser**, and the platform server bridges that Clerk session into custom OAuth tokens that the desktop app uses to talk to its local backend.

This design matches the security and user experience of industry standards like Claude Desktop. We also resolved critical blockers in the Next.js standalone build system and macOS application packaging.

---

## 2. Accomplishments

### A. Authentication Architecture

| Feature | Description |
|---------|-------------|
| **Integrated Splash Gate** | Re-engineered the startup sequence so the app shows the branded Allternit splash screen immediately. The login prompt is now a "Sign In" button embedded in the splash screen rather than a blocking native dialog. |
| **Desktop Auth Manager** | Built a robust Electron-side manager (`auth-manager.ts`) that generates PKCE verifiers, opens the system browser, and listens for the `allternit://auth/callback` deep link. |
| **Secure Persistence** | Implemented session storage using OS-native encryption (`safeStorage`) on macOS, Windows, and Linux. |
| **Local Backend Trust** | Created a session bridge that automatically injects the OAuth access token into all requests made by the Electron shell to the local platform server (`127.0.0.1`), allowing the local server to trust the desktop session via custom JWT validation. |

### B. Build & Packaging Fixes

| Fix | Impact |
|-----|--------|
| **Next.js 15 Standalone Success** | Resolved a `SyntaxError` and transpilation conflicts in the platform server build by moving heavy libraries (`lucide-react`, `antd`, etc.) into `transpilePackages` and excluding them from `optimizePackageImports` for desktop builds. |
| **Codesign Resolution** | Fixed macOS code-signing failures by updating the preparation script to dereference all symbolic links. The app bundle is now fully self-contained and ready for distribution. |
| **Multi-Arch Support** | Successfully generated production artifacts for both Apple Silicon (`arm64`) and Intel (`x64`) Macs. |

### C. Platform Fixes

| Fix | Detail |
|-----|--------|
| **OAuth Page Reliability** | Updated the authorization pages to use the `usePlatformAuth` abstraction, allowing them to render correctly in both Clerk-enabled and Clerk-disabled local development modes. |
| **API Correction** | Switched OAuth API routes from client-side `auth()` to the server-side `getAuth()` abstraction, which correctly handles both Clerk sessions and desktop token validation. |

---

## 3. How The Auth Flow Actually Works

### The Full Flow (Desktop + Clerk)

```
Desktop (Electron)              Browser (localhost:3013)              Platform Server
       │                                │                                      │
       │── 1. shell.openExternal() ────►│                                      │
       │    /oauth/authorize?...        │                                      │
       │                                │                                      │
       │                                │── 2. Not signed in? ────────────────►│
       │                                │    Redirect to /sign-in              │
       │                                │    (uses Clerk <SignIn />)           │
       │                                │                                      │
       │                                │◄── 3. Clerk authenticates user ──────│
       │                                │    (email, Google, etc.)             │
       │                                │                                      │
       │                                │── 4. Redirect back to ──────────────►│
       │                                │    /oauth/authorize                  │
       │                                │    isSignedIn = true                 │
       │                                │                                      │
       │                                │── 5. User clicks "Authorize" ───────►│
       │                                │    POST /api/oauth/authorize         │
       │                                │                                      │
       │                                │◄── 6. getAuth() validates ───────────│
       │                                │    Clerk session → issues OAuth code │
       │                                │                                      │
       │◄── 7. Browser redirects ───────│    allternit://auth/callback?...     │
       │                                │                                      │
       │── 8. Exchange code for token ──►│                                      │
       │    POST /api/oauth/token       │                                      │
       │                                │                                      │
       │                                │◄── 9. Verify PKCE → issue ───────────│
       │                                │    custom JWT access + refresh token │
       │                                │                                      │
       │── 10. Store in safeStorage ────│                                      │
       │                                │                                      │
```

### What Uses Clerk vs. What Doesn't

| Component | Uses Clerk? | Notes |
|-----------|-------------|-------|
| **Desktop app (Electron)** | ❌ No | Pure OAuth 2.0 client — PKCE, deep links, custom JWTs |
| **Browser sign-in page** | ✅ Yes | Clerk `<SignIn />` component handles all user auth |
| **Browser authorize page** | ✅ Yes | `usePlatformAuth()` reads Clerk session; redirect if not signed in |
| **`/api/oauth/authorize`** | ✅ Yes | `getAuth()` validates Clerk session before issuing OAuth code |
| **`/api/oauth/token`** | ❌ No | Validates PKCE + code, issues custom HMAC-JWT tokens |
| **Desktop → Backend API calls** | ❌ No | Sends `Authorization: Bearer <custom JWT>` |
| **`getAuth()` server-side** | Hybrid | First checks desktop token header, then Clerk session, then fallback |

### The Tokens

- **Access token**: Custom HMAC-SHA256 JWT (`oauth-tokens.ts`), 1-hour lifetime, validated against Redis/in-memory store
- **Refresh token**: Opaque random string, single-use rotation, 30-day lifetime
- **NOT Clerk tokens** — the desktop app never holds or sends a Clerk session token

---

## 4. Current State

- **Local Environment:** The desktop app is currently running (`pnpm run dev`) and the local platform server is active on port **3013**.
- **Visual State:** The app is displaying the splash screen with a "Sign In" button.
- **Test Status:** The core OAuth handshake library logic is verified via integration tests (`test-oauth-integration.ts`).

---

## 5. Immediate Next Steps

### Step 1 — Finalize Browser Handshake
1. Click **"Sign In"** in the splash screen.
2. Ensure the browser loads `http://localhost:3013/oauth/authorize`.
3. If not already signed in, Clerk sign-in page should appear. Complete sign-in.
4. Back on the authorize page, click **"Authorize"**.

### Step 2 — Verify Deep Link Redirect
1. The browser should redirect to `allternit://auth/callback?code=...&state=...`.
2. Confirm the desktop app receives this URL, exchanges the code for a token, and hides the splash screen.

### Step 3 — Confirm App Unlock
1. Verify that the main Allternit shell loads successfully once authentication is complete.
2. Check that API calls from the shell to `127.0.0.1:3013` include the `Authorization: Bearer` header.

### Step 4 — Production Sync
1. Once local testing is complete, update `OAUTH_BASE_URL` in `auth-manager.ts` back to `https://platform.allternit.com`.
2. Ensure the `allternit-desktop` client is registered in the production database.
3. Verify `OAUTH_TOKEN_SECRET` is set to a production-grade secret in the deployed environment.

---

## 6. Key File Map

| Purpose | Path |
|---------|------|
| Main Logic | `surfaces/allternit-desktop/src/main/unified-main.ts` |
| Auth Orchestration | `surfaces/allternit-desktop/src/main/auth-manager.ts` |
| Platform Auth Hook | `surfaces/allternit-platform/src/lib/platform-auth-client.tsx` |
| Server Auth Resolver | `surfaces/allternit-platform/src/lib/server-auth.ts` |
| OAuth Token Logic | `surfaces/allternit-platform/src/lib/oauth-tokens.ts` |
| OAuth Code Logic | `surfaces/allternit-platform/src/lib/oauth-codes.ts` |
| Build Optimization | `surfaces/allternit-platform/next.config.ts` |
| Packaging Prep | `surfaces/allternit-desktop/scripts/prepare-platform-server.cjs` |
| OAuth Pages | `surfaces/allternit-platform/src/app/oauth/authorize/page.tsx` |
| OAuth API (Authorize) | `surfaces/allternit-platform/src/app/api/oauth/authorize/route.ts` |
| OAuth API (Token) | `surfaces/allternit-platform/src/app/api/oauth/token/route.ts` |
| Integration Tests | `surfaces/allternit-platform/scripts/test-oauth-integration.ts` |

---

## 7. Environment Variables (Desktop Build)

The following are injected during the desktop server build via `prepare-platform-server.cjs`:

```
ALLTERNIT_BUILD_MODE=desktop
ALLTERNIT_DESKTOP_AUTH_ENABLED=1
NEXT_PUBLIC_ALLTERNIT_DESKTOP_AUTH=1
ALLTERNIT_PLATFORM_DISABLE_CLERK=0
NEXT_PUBLIC_ALLTERNIT_PLATFORM_DISABLE_CLERK=0
```

**Important:** `ALLTERNIT_PLATFORM_DISABLE_CLERK=0` means **Clerk is enabled** for the browser-based sign-in flow. The desktop app itself does not use Clerk, but the platform server does.

---

## 8. Quick Commands

```bash
# Navigate to desktop surface
cd surfaces/allternit-desktop

# Dev mode (spins up Electron + local platform server)
pnpm run dev

# Build TypeScript only
pnpm run build

# Build platform server for desktop bundling
pnpm run build:desktop-server

# Run OAuth integration tests
cd surfaces/allternit-platform
pnpm tsx scripts/test-oauth-integration.ts

# Package macOS DMG (arm64 + x64)
pnpm run build:electron:dmg
```

---

## 9. Risks & Watchouts

1. **Deep Link Registration:** The `allternit://` protocol handler is registered in `unified-main.ts`. If the app is moved or renamed after first launch, the OS may not route deep links correctly until the app is reopened.
2. **Token Refresh:** The auth manager schedules proactive refresh 5 minutes before expiry. If the machine sleeps for longer than the token lifetime, the first API call after wake may fail with `401`; the manager should auto-recover by triggering a silent refresh or re-prompt.
3. **Clerk Dependency:** Because the browser flow relies on Clerk, the desktop app cannot authenticate users if Clerk is unreachable (e.g., no internet). Consider whether an offline fallback mode is needed.
4. **Dual Auth Paths:** `getAuth()` and `usePlatformAuth()` support three modes (desktop token, Clerk, local fallback). Changes to these must be tested in all three configurations.

---

*End of handoff. For questions, refer to the Key File Map above or the master documentation in `docs/MASTER_HANDOFF_PROMPT.md`.*
