# Deploy Your Existing UI to Cloudflare Pages

## The Short Answer

**Your existing allternit UI IS the static UI.** You just need to:

1. Build it (`pnpm build`)
2. Configure it to connect to user VPS (not localhost)
3. Deploy the built files to Cloudflare Pages

That's it. No rewriting needed.

---

## What "Static" Means

```
Your Code (TypeScript/React)          Built Files (Static)
├─ src/                               ├─ index.html
├─ components/           BUILD        ├─ assets/
├─ views/              ───────►      │   ├─ main.js
├─ hooks/                             │   ├─ styles.css
└─ main.tsx                           │   └─ images/
                                      └─ favicon.ico

"Static" = Just HTML/CSS/JS files
          No server process running
          Served from CDN
```

**Your UI is ALREADY static-ready.** It's a React app that builds to static files.

---

## What You Already Have

Looking at your code:

```
cmd/shell/web/
├─ src/
│   ├─ main.tsx              ✓ Entry point
│   ├─ components/           ✓ Reusable components
│   ├─ views/                ✓ Page views
│   ├─ hooks/                ✓ Custom hooks
│   └─ services/             ✓ API services
├─ package.json              ✓ Dependencies
├─ vite.config.ts            ✓ Build config
└─ index.html                ✓ HTML template
```

**This is EXACTLY what you deploy.** Just build it.

---

## What Changes Are Needed (Minimal)

### 1. Environment Configuration

Create `cmd/shell/web/.env.production`:

```bash
# Production environment variables
VITE_CLERK_PUBLISHABLE_KEY=pk_live_YOUR_KEY_HERE

# API URL - this will be dynamic based on user's VPS
# Leave empty or set to placeholder - configured at runtime
VITE_API_URL=

# Platform mode
VITE_ALLTERNIT_PLATFORM_MODE=saas
```

### 2. Update API Service to Connect to User VPS

Your existing API service probably connects to localhost. Update it:

```typescript
// src/services/api.ts (existing file, update this)

// OLD: Connects to localhost or fixed backend
// const API_URL = 'http://localhost:3010';

// NEW: Connects to user's VPS
class VPSApiService {
  private baseUrl: string;
  private apiKey: string;
  
  constructor(vpsConnection: VPSConnection) {
    this.baseUrl = vpsConnection.host;
    this.apiKey = vpsConnection.apiKey;
  }
  
  async request(endpoint: string, options: RequestInit = {}) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    return response.json();
  }
  
  // All your existing methods work the same
  async getAgents() {
    return this.request('/v1/agents');
  }
  
  async runAgent(agentId: string) {
    return this.request(`/v1/agents/${agentId}/run`, {
      method: 'POST'
    });
  }
  
  async getBrowserStream() {
    return new WebSocket(
      `${this.baseUrl.replace('https', 'wss')}/chrome/stream`,
      [],
      { headers: { 'Authorization': `Bearer ${this.apiKey}` }}
    );
  }
}

export const createVPSApi = (connection: VPSConnection) => {
  return new VPSApiService(connection);
};
```

### 3. Add VPS Connection Management

```typescript
// src/stores/vpsConnections.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface VPSConnection {
  id: string;
  name: string;
  host: string;
  apiKey: string;
  status: 'connected' | 'disconnected' | 'error';
}

interface VPSStore {
  connections: VPSConnection[];
  activeConnection: VPSConnection | null;
  addConnection: (conn: Omit<VPSConnection, 'id'>) => void;
  removeConnection: (id: string) => void;
  setActiveConnection: (conn: VPSConnection | null) => void;
  testConnection: (conn: VPSConnection) => Promise<boolean>;
}

export const useVPSStore = create<VPSStore>()(
  persist(
    (set, get) => ({
      connections: [],
      activeConnection: null,
      
      addConnection: (conn) => {
        const newConn = { ...conn, id: crypto.randomUUID() };
        set((state) => ({
          connections: [...state.connections, newConn]
        }));
      },
      
      removeConnection: (id) => {
        set((state) => ({
          connections: state.connections.filter(c => c.id !== id),
          activeConnection: state.activeConnection?.id === id 
            ? null 
            : state.activeConnection
        }));
      },
      
      setActiveConnection: (conn) => {
        set({ activeConnection: conn });
        // Save to session storage for platform access
        if (conn) {
          sessionStorage.setItem('allternit-active-vps', JSON.stringify(conn));
        } else {
          sessionStorage.removeItem('allternit-active-vps');
        }
      },
      
      testConnection: async (conn) => {
        try {
          const response = await fetch(`${conn.host}/health`, {
            headers: { 'Authorization': `Bearer ${conn.apiKey}` }
          });
          return response.ok;
        } catch {
          return false;
        }
      }
    }),
    {
      name: 'allternit-vps-connections',
      partialize: (state) => ({ 
        connections: state.connections 
      })
    }
  )
);
```

### 4. Update Main App Entry

```typescript
// src/main.tsx (update existing)

import React from 'react';
import ReactDOM from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import App from './App';

const CLERK_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!CLERK_KEY) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY');
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ClerkProvider 
      publishableKey={CLERK_KEY}
      afterSignInUrl="/dashboard"
      afterSignUpUrl="/dashboard"
    >
      <App />
    </ClerkProvider>
  </React.StrictMode>
);
```

### 5. Create Dashboard Entry Point

```typescript
// src/App.tsx (update existing)

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { SignedIn, SignedOut } from '@clerk/clerk-react';
import { LandingPage } from './views/Landing';
import { Dashboard } from './views/Dashboard';
import { Platform } from './views/Platform';
import { ProtectedRoute } from './components/ProtectedRoute';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route 
          path="/" 
          element={
            <>
              <SignedOut>
                <LandingPage />
              </SignedOut>
              <SignedIn>
                <Dashboard />
              </SignedIn>
            </>
          } 
        />
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/platform" 
          element={
            <ProtectedRoute>
              <Platform />
            </ProtectedRoute>
          } 
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
```

---

## Build Configuration

### Update vite.config.ts

```typescript
// vite.config.ts (update existing)

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  
  // Build output directory
  build: {
    outDir: 'dist',
    sourcemap: true,
    // Ensure all routes work (SPA mode)
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html')
      }
    }
  },
  
  // Resolve path aliases
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  
  // Environment variables
  define: {
    __PLATFORM_MODE__: JSON.stringify(process.env.VITE_ALLTERNIT_PLATFORM_MODE)
  }
});
```

---

## Build & Deploy Commands

### Step 1: Install Dependencies

```bash
cd /Users/macbook/Desktop/allternit-workspace/allternit/cmd/shell/web

# Install dependencies
pnpm install

# Install Clerk
pnpm add @clerk/clerk-react

# Install Zustand for state management (if not already)
pnpm add zustand
```

### Step 2: Set Environment Variables

```bash
# Create .env.production
cat > .env.production << 'EOF'
VITE_CLERK_PUBLISHABLE_KEY=pk_test_YOUR_KEY_HERE
VITE_ALLTERNIT_PLATFORM_MODE=saas
EOF
```

### Step 3: Build

```bash
# Build for production
pnpm build

# Output will be in dist/ folder
ls -la dist/
```

### Step 4: Test Locally

```bash
# Serve the built files locally
pnpm preview

# Or use a static server
npx serve dist

# Visit http://localhost:4173
```

### Step 5: Deploy to Cloudflare Pages

```bash
# Install Wrangler (Cloudflare CLI)
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Deploy
wrangler pages deploy dist --project-name=allternit-platform

# Or use the web interface:
# 1. Go to https://dash.cloudflare.com
# 2. Pages → Create a project
# 3. Upload dist/ folder
```

---

## Alternative: Git Integration (Auto-Deploy)

### Connect GitHub Repo

```
1. Push your code to GitHub
2. Cloudflare Dashboard → Pages
3. "Connect to Git"
4. Select your repository
5. Build settings:
   - Framework preset: Vite
   - Build command: cd cmd/shell/web && pnpm build
   - Build output: cmd/shell/web/dist
6. Add environment variables:
   - VITE_CLERK_PUBLISHABLE_KEY
7. Deploy
```

---

## Summary: What You Actually Do

### Files to Create/Update:

1. **`.env.production`** (NEW)
   - Clerk API key
   - Platform mode

2. **`src/services/api.ts`** (UPDATE)
   - Change from localhost to user VPS

3. **`src/stores/vpsConnections.ts`** (NEW)
   - Manage VPS connections

4. **`src/views/Landing.tsx`** (NEW or REUSE)
   - Marketing page

5. **`src/views/Dashboard.tsx`** (NEW or REUSE)
   - VPS management

6. **`src/main.tsx`** (UPDATE)
   - Add Clerk provider

### Commands to Run:

```bash
cd cmd/shell/web
pnpm install
pnpm add @clerk/clerk-react zustand
# Update code files...
pnpm build
wrangler pages deploy dist
```

### That's It!

Your existing UI **IS** the static UI. You're just:
1. Building it (`pnpm build`)
2. Changing API calls from localhost → user VPS
3. Deploying the built files

**No rewrite needed. Just configuration and deployment.**

---

## Common Issues

### Issue 1: "window is not defined" during build
**Fix:** Some code runs during SSR. Wrap browser-only code:
```typescript
if (typeof window !== 'undefined') {
  // Browser-only code
}
```

### Issue 2: Environment variables not working
**Fix:** Must use `VITE_` prefix:
```bash
# Wrong
REACT_APP_API_URL=

# Correct
VITE_API_URL=
```

### Issue 3: Routes not working (404)
**Fix:** Cloudflare Pages needs SPA fallback:
```json
// Add _routes.json to dist/
{
  "version": 1,
  "include": ["/*"],
  "exclude": ["/assets/*"]
}
```

---

## Next Steps

1. ✅ Add Clerk authentication to your existing code
2. ✅ Update API service to use user VPS
3. ✅ Add VPS connection management
4. ✅ Build (`pnpm build`)
5. ✅ Deploy to Cloudflare Pages
6. ✅ Test with a VPS

**Ready to start?** The hard work (building the UI) is already done!
