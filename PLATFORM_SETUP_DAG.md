# A2rchitect Platform Setup - DAG Task Breakdown

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    SETUP DEPENDENCY GRAPH                                    │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                              │
│  PHASE 0: FOUNDATION (Prerequisites)                                                        │
│  ═══════════════════════════════════                                                        │
│                                                                                              │
│  ┌─────────────────┐                                                                        │
│  │ T0.1: Domain    │ ─────────────────────────────────────────────────────────────────────  │
│  │ Verified on     │                                                                       │
│  │ Cloudflare      │                                                                       │
│  └────────┬────────┘                                                                       │
│           │                                                                                 │
│           ▼                                                                                 │
│  ┌─────────────────┐                                                                        │
│  │ T0.2: Clerk     │ ─────────────────────────────────────────────────────────────────────  │
│  │ Account Created │                                                                        │
│  └────────┬────────┘                                                                       │
│           │                                                                                 │
│           ▼                                                                                 │
│  ┌─────────────────┐                                                                        │
│  │ T0.3: GitHub    │ ─────────────────────────────────────────────────────────────────────  │
│  │ Repo Ready      │                                                                        │
│  └─────────────────┘                                                                        │
│                                                                                              │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                              │
│  PHASE 1: CLERK CONFIGURATION (No Dependencies)                                             │
│  ══════════════════════════════════════════════                                             │
│                                                                                              │
│  T1.1: Create Clerk Application ─────────────────────────────────────────────────────────► │
│    ├─ Action: Go to https://dashboard.clerk.com                                             │
│    ├─ Click "Add application"                                                               │
│    ├─ Name: "A2rchitect Platform"                                                           │
│    └─ Output: Application created                                                           │
│                                                                                              │
│  T1.2: Configure Authentication ─────────────────────────────────────────────────────────► │
│    ├─ Action: Go to "Authentication" in sidebar                                             │
│    ├─ Enable: Email + Password                                                              │
│    ├─ Optional: Enable Google OAuth                                                         │
│    ├─ Optional: Enable GitHub OAuth                                                         │
│    └─ Output: Auth methods configured                                                       │
│                                                                                              │
│  T1.3: Configure Session ────────────────────────────────────────────────────────────────► │
│    ├─ Action: Go to "Sessions" in sidebar                                                   │
│    ├─ Set "Inactivity timeout": 7 days                                                      │
│    ├─ Set "Maximum lifetime": 30 days                                                       │
│    └─ Output: Session settings saved                                                        │
│                                                                                              │
│  T1.4: Get API Keys ─────────────────────────────────────────────────────────────────────► │
│    ├─ Action: Go to "API Keys" in sidebar                                                   │
│    ├─ Copy "Publishable key" (starts with pk_test_ or pk_live_)                             │
│    ├─ Copy "Secret key" (starts with sk_test_ or sk_live_)                                  │
│    ├─ Save to: .env.production                                                              │
│    └─ Output: Keys obtained                                                                 │
│                                                                                              │
│  T1.5: Configure URLs ───────────────────────────────────────────────────────────────────► │
│    ├─ Action: Go to "URLs & redirects"                                                      │
│    ├─ Set "Home URL": https://platform.yourdomain.com                                       │
│    ├─ Set "Sign in URL": https://platform.yourdomain.com/sign-in                            │
│    ├─ Set "Sign up URL": https://platform.yourdomain.com/sign-up                            │
│    ├─ Set "After sign in": https://platform.yourdomain.com/dashboard                        │
│    └─ Output: URLs configured                                                               │
│                                                                                              │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                              │
│  PHASE 2: CODE INTEGRATION (Depends on: T1.4)                                               │
│  ═══════════════════════════════════════════                                                │
│                                                                                              │
│           ┌──────────────────────────────────────────────────────────────────────────┐     │
│           │                                                                            │     │
│           ▼                                                                            │     │
│  T2.1: Install Clerk SDK ────────────────────────────────────────────────────────────►  │
│    ├─ Depends on: T1.4 (Need publishable key)                                             │
│    ├─ Action: cd 7-apps/shell/web && pnpm add @clerk/clerk-react                          │
│    ├─ Verify: Check package.json                                                          │
│    └─ Output: SDK installed                                                               │
│                                                                                              │
│  T2.2: Update main.tsx ────────────────────────────────────────────────────────────────►  │
│    ├─ Depends on: T2.1                                                                    │
│    ├─ Action: Add ClerkProvider wrapper                                                   │
│    ├─ File: src/main.tsx                                                                  │
│    └─ Output: Auth provider configured                                                    │
│                                                                                              │
│  T2.3: Create ProtectedRoute Component ────────────────────────────────────────────────►  │
│    ├─ Depends on: T2.2                                                                    │
│    ├─ Action: Create src/components/ProtectedRoute.tsx                                    │
│    └─ Output: Route protection ready                                                      │
│                                                                                              │
│  T2.4: Update App Router ──────────────────────────────────────────────────────────────►  │
│    ├─ Depends on: T2.2, T2.3                                                              │
│    ├─ Action: Add BrowserRouter + protected routes                                        │
│    ├─ File: src/App.tsx                                                                   │
│    └─ Output: Routing configured                                                          │
│                                                                                              │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                              │
│  PHASE 3: VPS INTEGRATION (Depends on: T2.4)                                                │
│  ═══════════════════════════════════════════                                                │
│                                                                                              │
│  T3.1: Create VPS Store ───────────────────────────────────────────────────────────────►  │
│    ├─ Depends on: T2.4                                                                    │
│    ├─ Action: Create src/stores/vpsConnections.ts                                         │
│    ├─ Purpose: Manage VPS connections                                                     │
│    └─ Output: State management ready                                                      │
│                                                                                              │
│  T3.2: Update API Service ─────────────────────────────────────────────────────────────►  │
│    ├─ Depends on: T3.1                                                                    │
│    ├─ Action: Modify src/services/api.ts                                                  │
│    ├─ Change: localhost → dynamic VPS URL                                                 │
│    └─ Output: API service updated                                                         │
│                                                                                              │
│  T3.3: Create Dashboard View ──────────────────────────────────────────────────────────►  │
│    ├─ Depends on: T3.1                                                                    │
│    ├─ Action: Create src/views/Dashboard.tsx                                              │
│    ├─ Purpose: VPS management UI                                                          │
│    └─ Output: Dashboard ready                                                             │
│                                                                                              │
│  T3.4: Create Landing View ────────────────────────────────────────────────────────────►  │
│    ├─ Depends on: None (can parallelize)                                                  │
│    ├─ Action: Create src/views/Landing.tsx                                                │
│    ├─ Purpose: Marketing page                                                             │
│    └─ Output: Landing page ready                                                          │
│                                                                                              │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                              │
│  PHASE 4: BUILD & DEPLOY (Depends on: T2.4, T3.2, T3.3)                                    │
│  ═══════════════════════════════════════════════════════                                   │
│                                                                                              │
│  T4.1: Create Environment File ────────────────────────────────────────────────────────►  │
│    ├─ Depends on: T1.4                                                                    │
│    ├─ Action: Create .env.production                                                      │
│    ├─ Add: VITE_CLERK_PUBLISHABLE_KEY                                                     │
│    └─ Output: Env file ready                                                              │
│                                                                                              │
│  T4.2: Install Dependencies ───────────────────────────────────────────────────────────►  │
│    ├─ Depends on: None                                                                    │
│    ├─ Action: pnpm install                                                                │
│    └─ Output: node_modules ready                                                          │
│                                                                                              │
│  T4.3: Build Production ───────────────────────────────────────────────────────────────►  │
│    ├─ Depends on: T4.1, T4.2                                                              │
│    ├─ Action: pnpm build                                                                  │
│    ├─ Output: dist/ folder created                                                        │
│    └─ Verify: ls -la dist/                                                                │
│                                                                                              │
│  T4.4: Test Locally ───────────────────────────────────────────────────────────────────►  │
│    ├─ Depends on: T4.3                                                                    │
│    ├─ Action: pnpm preview                                                                │
│    ├─ Test: http://localhost:4173                                                         │
│    └─ Output: Local test passed                                                           │
│                                                                                              │
│  T4.5: Deploy to Cloudflare ───────────────────────────────────────────────────────────►  │
│    ├─ Depends on: T4.4                                                                    │
│    ├─ Action: wrangler pages deploy dist                                                  │
│    ├─ Verify: https://platform.yourdomain.com                                             │
│    └─ Output: Live deployment                                                             │
│                                                                                              │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                              │
│  PHASE 5: VPS INSTALLER (Can Parallelize with Phase 4)                                      │
│  ═══════════════════════════════════════════════════════                                   │
│                                                                                              │
│  T5.1: Create Installer Script ────────────────────────────────────────────────────────►  │
│    ├─ Action: Create scripts/install.sh                                                   │
│    ├─ Purpose: One-line VPS installer                                                     │
│    └─ Output: install.sh created                                                          │
│                                                                                              │
│  T5.2: Test Installer ─────────────────────────────────────────────────────────────────►  │
│    ├─ Depends on: T5.1                                                                    │
│    ├─ Action: Test on DigitalOcean droplet                                                │
│    └─ Output: Installer verified                                                          │
│                                                                                              │
│  T5.3: Upload to GitHub ───────────────────────────────────────────────────────────────►  │
│    ├─ Depends on: T5.2                                                                    │
│    ├─ Action: Push to GitHub releases                                                     │
│    └─ Output: Public URL ready                                                            │
│                                                                                              │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                              │
│  PHASE 6: END-TO-END TEST (Depends on: T4.5, T5.3)                                          │
│  ═════════════════════════════════════════════════                                          │
│                                                                                              │
│  T6.1: Deploy Test VPS ────────────────────────────────────────────────────────────────►  │
│    ├─ Depends on: T5.3                                                                    │
│    ├─ Action: Run install.sh on test server                                               │
│    └─ Output: Test VPS ready                                                              │
│                                                                                              │
│  T6.2: Connect via Dashboard ──────────────────────────────────────────────────────────►  │
│    ├─ Depends on: T4.5, T6.1                                                              │
│    ├─ Action: Add VPS connection in UI                                                    │
│    └─ Output: Connection saved                                                            │
│                                                                                              │
│  T6.3: Test Full Platform ─────────────────────────────────────────────────────────────►  │
│    ├─ Depends on: T6.2                                                                    │
│    ├─ Action: Run agent, test Chrome stream                                               │
│    └─ Output: E2E test passed                                                             │
│                                                                                              │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                              │
│  PHASE 7: LAUNCH PREP (Depends on: T6.3)                                                    │
│  ═══════════════════════════════════════                                                    │
│                                                                                              │
│  T7.1: Stripe Integration ─────────────────────────────────────────────────────────────►  │
│    ├─ Action: Set up payment processing                                                   │
│    └─ Output: Payments ready                                                              │
│                                                                                              │
│  T7.2: Analytics Setup ────────────────────────────────────────────────────────────────►  │
│    ├─ Action: Add PostHog/Amplitude                                                       │
│    └─ Output: Tracking live                                                               │
│                                                                                              │
│  T7.3: Documentation ──────────────────────────────────────────────────────────────────►  │
│    ├─ Action: Write setup guide                                                           │
│    └─ Output: Docs published                                                              │
│                                                                                              │
│  T7.4: Launch Checklist ───────────────────────────────────────────────────────────────►  │
│    ├─ Depends on: All above                                                               │
│    ├─ Final verification                                                                  │
│    └─ Output: READY TO LAUNCH                                                             │
│                                                                                              │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Task Execution Order (Priority)

### This Week (Days 1-3)

**Day 1 (Today):**
```
T1.1 → T1.2 → T1.3 → T1.4 → T1.5
(Clerk configuration - 2 hours)
```

**Day 2:**
```
T2.1 → T2.2 → T2.3 → T2.4
(Code integration - 4 hours)
```

**Day 3:**
```
T3.1 → T3.2 → T4.1 → T4.2 → T4.3 → T4.4 → T4.5
(Build and deploy - 3 hours)
```

### Next Week (Days 4-7)

**Day 4-5:**
```
T5.1 → T5.2 → T5.3
(VPS installer - 6 hours)
```

**Day 6-7:**
```
T6.1 → T6.2 → T6.3 → T7.4
(Testing and launch - 4 hours)
```

---

## Critical Path

The **minimum viable path** to launch:

```
T1.4 (Get Clerk keys)
   ↓
T2.1 (Install SDK)
   ↓
T2.2 (Update main.tsx)
   ↓
T3.2 (Update API service)
   ↓
T4.3 (Build)
   ↓
T4.5 (Deploy)
   ↓
T5.1 (Create installer)
   ↓
DONE
```

**Critical path time: ~6 hours of work**

---

## Clerk Setup Help (Current Priority)

Since you just signed up for Clerk, let's do this now:

### Step 1: Create Application

1. Go to: https://dashboard.clerk.com
2. Click the big **"+ Add application"** button
3. Fill in:
   - **Name**: `A2rchitect Platform`
   - **Environment**: Start with "Development" (you can promote to Production later)
4. Click **"Create application"**

### Step 2: Configure Authentication (What do you want?)

**Options:**
- ☐ Email + Password (recommended: enable this)
- ☐ Email magic link (optional)
- ☐ Google OAuth (recommended: enable this)
- ☐ GitHub OAuth (optional)

**Which do you want?** I recommend:
- ✅ Email + Password (required)
- ✅ Google OAuth (makes signup easier)

### Step 3: Get Your Keys (Critical!)

1. In Clerk dashboard, click **"API Keys"** in left sidebar
2. You'll see:
   - **Publishable key**: `pk_test_...` or `pk_live_...`
   - **Secret key**: `sk_test_...` or `sk_live_...`
3. **Copy the Publishable key** (we need this for the code)

### Step 4: Tell Me Your Key

Once you have the publishable key, tell me and I'll help you integrate it into the code.

**Format:** `pk_test_xxxxx` or `pk_live_xxxxx`

---

## Quick Start Checklist

Right now, do these in order:

- [ ] **T1.1**: Create Clerk application
- [ ] **T1.2**: Enable Email + Password auth
- [ ] **T1.4**: Copy publishable key
- [ ] Tell me the key
- [ ] I'll help you integrate it

**Estimated time: 30 minutes**

Ready? Go to https://dashboard.clerk.com and start with Step 1!
