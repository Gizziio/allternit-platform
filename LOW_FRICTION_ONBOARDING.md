# Low-Friction Onboarding: "Try Before You Buy" Model

## The Problem

**Major Platforms (Vercel, Railway, etc.):**
- ✅ User signs up → Immediately sees dashboard → Can deploy in 30 seconds
- ❌ They host compute (expensive for you)

**Your Current Model:**
- ❌ User signs up → "Please set up a VPS first" → High friction, many drop off
- ✅ You don't host compute (cheap for you)

**The Solution:** Bridge the gap with a **sandbox/demo instance** + **progressive migration**

---

## Option 1: Shared Demo Instance (RECOMMENDED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SHARED DEMO MODEL                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  YOU HOST (Small VPS: $20/mo)                                               │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │  Shared Demo VPS                                                      │ │
│  │  ├─ Multi-tenant isolation (namespaced)                               │ │
│  │  ├─ Rate limited: 100 API calls/day per user                          │ │
│  │  ├─ Data ephemeral (reset daily)                                      │ │
│  │  └─ Read-only Chrome or limited interaction                           │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                              ▲                                              │
│                              │                                              │
│  USER FLOW:                  │                                              │
│  1. Sign up ────────────────►│                                              │
│  2. Immediately sees dashboard                                             │
│  3. Can create agents, run tests                                          │
│  4. "Upgrade to use your own VPS" CTA                                     │
│                                                                             │
│  RESULT: User experiences value in 30 seconds, then migrates to own VPS   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Implementation

**1. Create Shared Demo Service**

```rust
// 7-apps/api/src/demo_mode.rs
use std::collections::HashMap;
use tokio::sync::RwLock;

pub struct DemoService {
    /// Maps user_id to their sandbox namespace
    sandboxes: RwLock<HashMap<String, Sandbox>>,
    /// Rate limiter per user
    rate_limits: RwLock<HashMap<String, RateLimit>>,
}

impl DemoService {
    pub async fn create_sandbox(&self, user_id: &str) -> Sandbox {
        // Each user gets isolated namespace on shared VPS
        // - Separate SQLite database: demo_{user_id}.db
        // - Separate Chrome session (container)
        // - Resource limits: 1 CPU, 512MB RAM
        Sandbox {
            id: format!("demo_{}", user_id),
            db_path: format!("/data/demo/{}.db", user_id),
            chrome_port: self.allocate_port().await,
            created_at: Utc::now(),
            expires_at: Utc::now() + Duration::hours(24),
        }
    }
    
    pub async fn enforce_limits(&self, user_id: &str) -> Result<(), DemoError> {
        // Max 100 API calls per day
        // Max 5 browser sessions per day
        // Max 10 minutes per session
        // Data resets every 24 hours
    }
}
```

**2. Environment Detection (Frontend)**

```typescript
// 7-apps/shell/web/src/hooks/useConnection.ts
interface ConnectionMode {
  type: 'demo' | 'user-vps' | 'local';
  gatewayUrl: string;
  limits?: {
    maxApiCalls: number;
    maxBrowserTime: number;
    resetTime: string;
  };
}

export function useConnection(): ConnectionMode {
  const { user } = useUser();
  const [mode, setMode] = useState<ConnectionMode>(() => {
    // Check URL params
    const params = new URLSearchParams(window.location.search);
    const demoMode = params.get('demo');
    
    if (demoMode === 'true' || !user?.hasVps) {
      return {
        type: 'demo',
        gatewayUrl: 'https://demo-api.a2rchitect.com',
        limits: {
          maxApiCalls: 100,
          maxBrowserTime: 600, // 10 minutes
          resetTime: '24:00 UTC'
        }
      };
    }
    
    // User has their own VPS
    return {
      type: 'user-vps',
      gatewayUrl: user.vpsUrl
    };
  });
  
  return mode;
}
```

**3. Dashboard with Demo Banner**

```tsx
// 7-apps/shell/web/src/pages/Dashboard.tsx
export function Dashboard() {
  const connection = useConnection();
  const [apiUsage, setApiUsage] = useState(0);
  
  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Demo Mode Banner */}
      {connection.type === 'demo' && (
        <div className="bg-gradient-to-r from-amber-600 to-orange-600 px-6 py-3">
          <div className="container mx-auto flex justify-between items-center">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🎮</span>
              <div>
                <span className="font-semibold">Demo Mode</span>
                <span className="text-amber-100 ml-2">
                  {apiUsage}/{connection.limits?.maxApiCalls} API calls used today
                </span>
              </div>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => showDemoLimits()}
                className="text-amber-100 hover:text-white underline"
              >
                View Limits
              </button>
              <button 
                onClick={() => setShowAddVpsModal(true)}
                className="bg-white text-orange-600 px-4 py-1.5 rounded-lg font-semibold hover:bg-amber-50"
              >
                Connect Your VPS →
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Regular Dashboard */}
      <main className="container mx-auto px-6 py-8">
        {connection.type === 'demo' ? (
          <DemoWelcome onAddVps={() => setShowAddVpsModal(true)} />
        ) : (
          <UserDashboard />
        )}
      </main>
    </div>
  );
}

function DemoWelcome({ onAddVps }: { onAddVps: () => void }) {
  return (
    <div className="text-center py-16">
      <div className="text-6xl mb-6">🚀</div>
      <h2 className="text-3xl font-bold mb-4">Welcome to A2rchitect!</h2>
      <p className="text-gray-400 max-w-2xl mx-auto mb-8">
        You're in <strong>demo mode</strong> with a shared playground. 
        Create agents, test browser automation, and explore the platform.
        <br /><br />
        Data resets daily. For production use, connect your own VPS.
      </p>
      
      <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto mb-8">
        <DemoFeature 
          icon="🤖"
          title="Create an Agent"
          description="Build your first AI agent in 30 seconds"
          onClick={() => createDemoAgent()}
        />
        <DemoFeature 
          icon="🌐"
          title="Launch Browser"
          description="Try browser automation with Chrome"
          onClick={() => launchDemoBrowser()}
        />
        <DemoFeature 
          icon="📊"
          title="View Examples"
          description="See pre-built automation examples"
          onClick={() => showExamples()}
        />
      </div>
      
      <button 
        onClick={onAddVps}
        className="bg-blue-600 hover:bg-blue-700 px-8 py-4 rounded-xl text-lg font-semibold"
      >
        Connect Your Own VPS for Full Access →
      </button>
    </div>
  );
}
```

---

## Option 2: One-Click VPS Provisioning (Like Railway)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     ONE-CLICK DEPLOY MODEL                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  User clicks "Deploy to DigitalOcean"                                       │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Your Backend (Cloudflare Worker / Vercel Edge)                     │   │
│  │  ├─ Receives OAuth token from DigitalOcean                          │   │
│  │  ├─ API call: Create $20/mo droplet                                 │   │
│  │  ├─ SSH in: Run install script                                      │   │
│  │  └─ Return VPS URL + API key to user                                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│         │                                                                   │
│         ▼                                                                   │
│  User sees: "Your VPS is ready! Connecting..."                              │
│         │                                                                   │
│         ▼                                                                   │
│  Dashboard loads with their new VPS pre-connected                           │
│                                                                             │
│  TIME TO FIRST VALUE: 2-3 minutes                                           │
│  USER EFFORT: Click 2 buttons, login to DigitalOcean                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Implementation

**1. Cloud Provider Integration**

```typescript
// api/providers/digitalocean.ts
export class DigitalOceanProvider {
  async createDroplet(userId: string, token: string): Promise<VPS> {
    const response = await fetch('https://api.digitalocean.com/v2/droplets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: `a2r-${userId.slice(0, 8)}`,
        region: 'nyc3',
        size: 's-2vcpu-4gb', // $24/mo
        image: 'ubuntu-22-04-x64',
        user_data: `
          #!/bin/bash
          curl -fsSL https://install.a2rchitect.com | bash
          # Configure with API key
          echo "A2R_API_KEY=${generateApiKey()}" >> /opt/a2r/config
        `,
        tags: ['a2rchitect', 'managed']
      })
    });
    
    return await this.waitForProvisioning(response.droplet.id);
  }
}
```

**2. Frontend "Deploy" Button**

```tsx
// components/DeployButton.tsx
export function DeployButton() {
  const [provider, setProvider] = useState<'digitalocean' | 'aws' | 'hetzner'>('digitalocean');
  const [isDeploying, setIsDeploying] = useState(false);
  
  const deploy = async () => {
    setIsDeploying(true);
    
    // OAuth flow with provider
    const oauthWindow = window.open(
      `/api/auth/${provider}`,
      'Connect VPS',
      'width=600,height=700'
    );
    
    // Wait for OAuth callback
    window.addEventListener('message', async (e) => {
      if (e.data.type === 'OAUTH_SUCCESS') {
        // Start provisioning
        const response = await fetch('/api/vps/provision', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            provider,
            token: e.data.token 
          })
        });
        
        const { vpsUrl, apiKey } = await response.json();
        
        // Auto-save to dashboard
        await saveVpsConnection({ vpsUrl, apiKey });
        
        // Redirect to platform
        window.location.href = '/platform';
      }
    });
  };
  
  return (
    <div className="bg-slate-800 rounded-xl p-6">
      <h3 className="text-xl font-semibold mb-4">Quick Deploy</h3>
      <p className="text-gray-400 mb-4">
        We'll create a VPS for you. You pay the cloud provider directly.
      </p>
      
      <div className="space-y-3">
        <ProviderButton 
          name="DigitalOcean"
          logo="💧"
          price="$24/mo"
          onClick={() => deploy('digitalocean')}
          isLoading={isDeploying}
        />
        <ProviderButton 
          name="Hetzner"
          logo="🇩🇪"
          price="€7.50/mo"
          onClick={() => deploy('hetzner')}
        />
        <ProviderButton 
          name="AWS"
          logo="☁️"
          price="$30/mo"
          onClick={() => deploy('aws')}
        />
      </div>
      
      <div className="mt-4 pt-4 border-t border-slate-700 text-center">
        <button 
          onClick={() => setShowManualSetup(true)}
          className="text-gray-400 hover:text-white underline"
        >
          Or use your own VPS →
        </button>
      </div>
    </div>
  );
}
```

---

## Option 3: Local-First Desktop App

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       LOCAL-FIRST MODEL                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  User downloads desktop app                                                 │
│         │                                                                   │
│         ▼                                                                   │
│  App bundles:                                                               │
│  ├─ Electron UI                                                             │
│  ├─ Rust API (local)                                                        │
│  ├─ SQLite (local)                                                          │
│  └─ Chrome (optional, local or remote)                                      │
│         │                                                                   │
│         ▼                                                                   │
│  User opens app → Works immediately (no signup, no VPS)                     │
│         │                                                                   │
│         ▼                                                                   │
│  Later: User can "Enable Cloud Sync" → Add VPS → Sync data                  │
│                                                                             │
│  TIME TO FIRST VALUE: 0 seconds                                             │
│  USER EFFORT: Download, double-click                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Implementation

```typescript
// 7-apps/shell/desktop/src/main.ts
// Bundles everything locally

import { app, BrowserWindow } from 'electron';
import { spawn } from 'child_process';
import path from 'path';

class LocalFirstApp {
  apiProcess: ChildProcess | null = null;
  
  async start() {
    // 1. Start local API server (bundled Rust binary)
    this.apiProcess = spawn(
      path.join(__dirname, '../bin/a2rchitech-api'),
      ['--bind', '127.0.0.1:3010', '--data', app.getPath('userData')],
      { stdio: 'pipe' }
    );
    
    // 2. Wait for API to be ready
    await this.waitForApi();
    
    // 3. Open Electron window pointing to local API
    const window = new BrowserWindow({
      width: 1400,
      height: 900,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js')
      }
    });
    
    // Load UI from local files
    window.loadURL('http://localhost:3010/ui');
    
    // 4. Show "Add Cloud VPS" button in UI for later
  }
}
```

---

## Option 4: Browser-Only Mode (No Compute)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     BROWSER-ONLY MODE                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Features that work WITHOUT any VPS:                                        │
│  ├─ Agent Designer (drag-drop workflow builder)                             │
│  ├─ Template Library (browse examples)                                      │
│  ├─ Documentation & Tutorials                                               │
│  ├─ Community Forum                                                         │
│  └─ Billing & Settings                                                      │
│                                                                             │
│  When user tries to RUN agent:                                              │
│  ├─ "Connect VPS to execute" CTA                                            │
│  └─ Show one-click deploy options                                           │
│                                                                             │
│  VALUE: User can explore platform, build agents, learn BEFORE committing    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Recommended Hybrid Approach

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    RECOMMENDED: HYBRID MODEL                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  TIER 1: IMMEDIATE (0 seconds)                                              │
│  ├─ User signs up → Lands on Dashboard                                      │
│  ├─ Can access: Agent Designer, Templates, Documentation                    │
│  └─ Sees: "Run your first agent" → Triggers Tier 2                          │
│                                                                             │
│  TIER 2: DEMO MODE (30 seconds)                                             │
│  ├─ Click "Try Demo" → Auto-connects to shared demo VPS                     │
│  ├─ Limited: 10 min session, 10 API calls, ephemeral data                   │
│  └─ "This is a demo. Deploy your own VPS for unlimited use."               │
│                                                                             │
│  TIER 3: ONE-CLICK DEPLOY (2-3 minutes)                                     │
│  ├─ Click "Deploy to DigitalOcean"                                          │
│  ├─ OAuth + Auto-provisioning                                               │
│  └─ Fully functional, permanent, their data                                 │
│                                                                             │
│  TIER 4: BRING YOUR OWN (10 minutes)                                        │
│  ├─ Manual VPS setup for advanced users                                     │
│  └─ Full control, any provider                                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Priority

### Week 1: Browser-Only + Demo Banner
```typescript
// Show dashboard immediately
// Add "Demo Mode" banner
// Agent designer works (can't run without VPS)
// Low effort, immediate UX improvement
```

### Week 2: Shared Demo VPS
```bash
# Spin up one $20/mo VPS
# Configure multi-tenant isolation
# Set rate limits (100 calls/day per user)
# Auto-reset data daily
```

### Week 3: One-Click Deploy
```typescript
// Integrate DigitalOcean OAuth
// Auto-provisioning endpoint
// Progress UI ("Setting up your VPS...")
```

### Week 4: Desktop App (Optional)
```bash
# Bundle API + UI in Electron
# Local SQLite
# Works offline
```

---

## Cost Analysis

| Approach | Your Cost | User Effort | Time to Value |
|----------|-----------|-------------|---------------|
| **Status Quo** | $0 | High (30 min) | 30 min |
| **Shared Demo** | $20/mo VPS | Low (click) | 30 sec |
| **One-Click** | $0 | Low (2 clicks) | 2-3 min |
| **Local Desktop** | $0 | Low (download) | 0 sec |
| **Hybrid** | $20/mo | Lowest | 0 sec |

---

## Code: Demo Mode Implementation

```typescript
// hooks/useDemoMode.ts
export function useDemoMode() {
  const { user } = useUser();
  
  return {
    isDemo: user?.vpsConnections?.length === 0,
    demoGatewayUrl: 'https://demo.a2rchitect.com',
    limits: {
      maxApiCalls: 100,
      maxBrowserTime: 600,
      resetTime: '00:00 UTC'
    },
    
    async trackApiCall() {
      const today = new Date().toISOString().split('T')[0];
      const key = `demo-api-calls-${user?.id}-${today}`;
      const current = parseInt(localStorage.getItem(key) || '0');
      
      if (current >= 100) {
        throw new Error('Demo limit reached. Connect your own VPS for unlimited usage.');
      }
      
      localStorage.setItem(key, String(current + 1));
    },
    
    async resetDemo() {
      // Clear demo data
      localStorage.removeItem(`demo-api-calls-${user?.id}`);
      // Call API to reset sandbox
      await fetch('https://demo.a2rchitect.com/reset', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${user?.id}` }
      });
    }
  };
}
```

---

## Summary

**To compete with Vercel/Railway UX without hosting compute:**

1. **Browser-Only Mode** (Day 1) - Let users explore UI immediately
2. **Shared Demo VPS** (Week 1) - One cheap VPS, multi-tenant isolation
3. **One-Click Deploy** (Week 2) - Auto-provision DigitalOcean/etc
4. **Progressive Upsell** - Demo → Deploy → Bring Your Own

**Key Insight:** You don't need to host everyone's compute, just a **shared playground** for trial.

Want me to implement the Demo Mode or One-Click Deploy first?
