# allternit SaaS Platform - Complete Production Setup Guide

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                  YOUR CLOUD INFRASTRUCTURE                              │
│                                      (Company: You)                                     │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│   ┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐      │
│   │   Static Web App    │     │   Auth Service      │     │   Billing/Admin     │      │
│   │   (Vercel/Netlify)  │◄────│   (Clerk/Auth0)     │     │   (Stripe/Internal) │      │
│   │   platform.allternit.com  │     │   platform.allternit.com  │     │   admin.allternit.com     │      │
│   └──────────┬──────────┘     └─────────────────────┘     └─────────────────────┘      │
│              │                                                                          │
│              │ HTTPS + API Key                                                           │
│              ▼                                                                          │
│   ┌─────────────────────────────────────────────────────────────────────────────────┐  │
│   │                        CUSTOMER VPS (Self-Hosted Compute)                        │  │
│   │                           (Company: Customer Inc.)                               │  │
│   │                                                                                  │  │
│   │   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │  │
│   │   │  API Server  │    │   Chrome     │    │   SQLite     │    │   Docker     │  │  │
│   │   │  Port 3010   │    │   Streaming  │    │   Database   │    │   (optional) │  │  │
│   │   │  Rust Binary │    │   Port 8081  │    │   /data      │    │              │  │  │
│   │   └──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘  │  │
│   │                                                                                  │  │
│   │   Customer controls:                                                             │  │
│   │   • Data storage (SQLite)                                                        │  │
│   │   • Compute resources                                                            │  │
│   │   • Chrome browser (via WebRTC)                                                  │  │
│   │   • Network access                                                               │  │
│   └─────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

**Key Principle**: Data never leaves customer's infrastructure. You host the UI, they host the compute.

---

## PART 1: What YOU Need to Do (As the Platform Company)

### 1.1 Build & Deploy the Web Application

```bash
# Step 1: Build production bundle
cd /path/to/allternit/cmd/shell/web

# Install dependencies
pnpm install

# Fix any TypeScript errors first!
pnpm typecheck
# Fix errors until this passes...

# Build production bundle
pnpm build

# Output: dist/ folder contains optimized static files
ls -la dist/
# - index.html
# - assets/ (minified JS, CSS)
# - favicon.ico
```

### 1.2 Deploy to Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
cd cmd/shell/web
vercel --prod

# Or connect GitHub repo for auto-deploys
# 1. Push to GitHub
# 2. Import project in Vercel dashboard
# 3. Set build command: cd cmd/shell/web && pnpm build
# 4. Set output directory: cmd/shell/web/dist
# 5. Set framework preset: Vite
# 6. Deploy!
```

**Vercel Configuration** (`vercel.json`):
```json
{
  "version": 2,
  "builds": [
    {
      "src": "cmd/shell/web/package.json",
      "use": "@vercel/static-build",
      "config": {
        "buildCommand": "cd cmd/shell/web && pnpm build",
        "outputDirectory": "cmd/shell/web/dist"
      }
    }
  ],
  "routes": [
    { "handle": "filesystem" },
    { "src": "/(.*)", "dest": "/index.html" }
  ],
  "env": {
    "VITE_ALLTERNIT_PLATFORM_MODE": "saas",
    "VITE_ALLTERNIT_GATEWAY_URL": ""
  }
}
```

### 1.3 Set Up Authentication (Clerk - Recommended)

**Why Clerk?**
- Handles SSO, MFA, user management
- Easy integration with React
- Free tier for startups

**Setup:**

1. **Create Clerk Account**: https://clerk.com

2. **Configure Application**:
   - Name: "allternit Platform"
   - URLs:
     - Sign-in URL: `/sign-in`
     - Sign-up URL: `/sign-up`
     - After sign-in: `/dashboard`

3. **Get API Keys**:
   ```
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
   CLERK_SECRET_KEY=sk_test_...
   ```

4. **Install in Web App**:
   ```bash
   cd cmd/shell/web
   pnpm add @clerk/clerk-react
   ```

5. **Add Clerk Provider** (`src/main.tsx`):
   ```tsx
   import { ClerkProvider } from '@clerk/clerk-react';
   
   const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
   
   ReactDOM.createRoot(document.getElementById('root')!).render(
     <React.StrictMode>
       <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
         <App />
       </ClerkProvider>
     </React.StrictMode>
   );
   ```

6. **Protect Routes** (`src/App.tsx`):
   ```tsx
   import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/clerk-react';
   
   function App() {
     return (
       <div>
         <SignedOut>
           <LandingPage />
         </SignedOut>
         <SignedIn>
           <Dashboard />
         </SignedIn>
       </div>
     );
   }
   ```

### 1.4 Create Landing Page

**File**: `cmd/shell/web/src/pages/Landing.tsx`

```tsx
import { SignInButton, SignUpButton } from '@clerk/clerk-react';

export function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white">
      {/* Hero Section */}
      <header className="container mx-auto px-6 py-16">
        <nav className="flex justify-between items-center mb-16">
          <div className="text-2xl font-bold">allternit</div>
          <div className="space-x-4">
            <SignInButton mode="modal">
              <button className="text-white hover:text-gray-300">Sign In</button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg">
                Get Started
              </button>
            </SignUpButton>
          </div>
        </nav>
        
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-5xl font-bold mb-6">
            AI-Powered Browser Automation<br />
            <span className="text-blue-400">On Your Infrastructure</span>
          </h1>
          <p className="text-xl text-gray-400 mb-8">
            Run autonomous AI agents with full browser control. 
            Your data stays on your servers. We host the interface, you host the compute.
          </p>
          
          <div className="flex justify-center gap-4">
            <SignUpButton mode="modal">
              <button className="bg-blue-600 hover:bg-blue-700 px-8 py-4 rounded-xl text-lg font-semibold">
                Start Free Trial
              </button>
            </SignUpButton>
            <button className="border border-gray-600 hover:border-gray-400 px-8 py-4 rounded-xl text-lg">
              View Demo
            </button>
          </div>
        </div>
      </header>
      
      {/* Features */}
      <section className="container mx-auto px-6 py-16">
        <div className="grid md:grid-cols-3 gap-8">
          <FeatureCard 
            icon="🤖"
            title="AI Agents"
            description="Autonomous agents that can navigate, click, type, and extract data from any website."
          />
          <FeatureCard 
            icon="🔒"
            title="Data Privacy"
            description="All compute runs on your infrastructure. Your data never leaves your servers."
          />
          <FeatureCard 
            icon="🌐"
            title="Real Chrome"
            description="Full Chrome browser with WebRTC streaming. See exactly what the AI sees."
          />
        </div>
      </section>
      
      {/* How It Works */}
      <section className="container mx-auto px-6 py-16 bg-slate-800/50">
        <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
        <div className="grid md:grid-cols-4 gap-8 text-center">
          <Step number={1} title="Sign Up" description="Create your account" />
          <Step number={2} title="Connect VPS" description="Link your server" />
          <Step number={3} title="Launch Agent" description="Start AI automation" />
          <Step number={4} title="Monitor" description="Watch in real-time" />
        </div>
      </section>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="bg-slate-800/50 p-6 rounded-xl">
      <div className="text-4xl mb-4">{icon}</div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-gray-400">{description}</p>
    </div>
  );
}

function Step({ number, title, description }: { number: number; title: string; description: string }) {
  return (
    <div>
      <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
        {number}
      </div>
      <h3 className="font-semibold mb-1">{title}</h3>
      <p className="text-gray-400 text-sm">{description}</p>
    </div>
  );
}
```

### 1.5 Create Dashboard (Post-Login)

**File**: `cmd/shell/web/src/pages/Dashboard.tsx`

```tsx
import { UserButton, useUser } from '@clerk/clerk-react';
import { useState, useEffect } from 'react';

interface VPSConnection {
  id: string;
  name: string;
  host: string;
  status: 'connected' | 'disconnected' | 'error';
  lastConnected?: string;
}

export function Dashboard() {
  const { user } = useUser();
  const [connections, setConnections] = useState<VPSConnection[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  
  // Load saved connections from localStorage (or your backend)
  useEffect(() => {
    const saved = localStorage.getItem('allternit-connections');
    if (saved) {
      setConnections(JSON.parse(saved));
    }
  }, []);
  
  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold">allternit</h1>
            <span className="text-gray-400">|</span>
            <span className="text-gray-400">Dashboard</span>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setShowAddModal(true)}
              className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm"
            >
              + Add VPS
            </button>
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        {/* Welcome */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold">Welcome back, {user?.firstName || 'User'}</h2>
          <p className="text-gray-400">Manage your AI agents and VPS connections.</p>
        </div>
        
        {/* VPS Connections */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {connections.length === 0 ? (
            <EmptyState onAdd={() => setShowAddModal(true)} />
          ) : (
            connections.map(conn => (
              <VPSCard 
                key={conn.id} 
                connection={conn} 
                onConnect={() => connectToVPS(conn)}
                onDelete={() => deleteConnection(conn.id)}
              />
            ))
          )}
        </div>
      </main>
      
      {/* Add VPS Modal */}
      {showAddModal && (
        <AddVPSModal 
          onClose={() => setShowAddModal(false)}
          onSave={(conn) => {
            const newConnections = [...connections, conn];
            setConnections(newConnections);
            localStorage.setItem('allternit-connections', JSON.stringify(newConnections));
            setShowAddModal(false);
          }}
        />
      )}
    </div>
  );
}

function VPSCard({ connection, onConnect, onDelete }: { 
  connection: VPSConnection; 
  onConnect: () => void;
  onDelete: () => void;
}) {
  const statusColors = {
    connected: 'bg-green-500',
    disconnected: 'bg-gray-500',
    error: 'bg-red-500'
  };
  
  return (
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="font-semibold text-lg">{connection.name}</h3>
          <p className="text-gray-400 text-sm">{connection.host}</p>
        </div>
        <div className={`w-3 h-3 rounded-full ${statusColors[connection.status]}`} />
      </div>
      
      <div className="text-sm text-gray-400 mb-4">
        {connection.status === 'connected' ? (
          <span>Last connected: {connection.lastConnected}</span>
        ) : (
          <span>Not connected</span>
        )}
      </div>
      
      <div className="flex gap-2">
        <button 
          onClick={onConnect}
          className="flex-1 bg-blue-600 hover:bg-blue-700 py-2 rounded-lg text-sm"
        >
          Connect
        </button>
        <button 
          onClick={onDelete}
          className="px-3 py-2 border border-slate-600 rounded-lg text-sm hover:bg-slate-700"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="col-span-full text-center py-16 bg-slate-800/50 rounded-xl border border-dashed border-slate-700">
      <div className="text-6xl mb-4">🖥️</div>
      <h3 className="text-xl font-semibold mb-2">No VPS Connections</h3>
      <p className="text-gray-400 mb-4">Connect your first VPS to start using AI agents.</p>
      <button 
        onClick={onAdd}
        className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg"
      >
        Add Your First VPS
      </button>
    </div>
  );
}

function AddVPSModal({ onClose, onSave }: { onClose: () => void; onSave: (conn: VPSConnection) => void }) {
  const [name, setName] = useState('');
  const [host, setHost] = useState('');
  const [apiKey, setApiKey] = useState('');
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      id: crypto.randomUUID(),
      name,
      host,
      status: 'disconnected'
    });
  };
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-xl p-8 max-w-md w-full mx-4">
        <h2 className="text-2xl font-semibold mb-6">Add VPS Connection</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Connection Name</label>
            <input 
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g., Production Server"
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm text-gray-400 mb-1">VPS Host URL</label>
            <input 
              type="url"
              value={host}
              onChange={e => setHost(e.target.value)}
              placeholder="https://vps.yourcompany.com:3010"
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Include port if not 443. Must be HTTPS in production.
            </p>
          </div>
          
          <div>
            <label className="block text-sm text-gray-400 mb-1">API Key</label>
            <input 
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="Your VPS API key"
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2"
              required
            />
          </div>
          
          <div className="pt-4 flex gap-3">
            <button 
              type="button"
              onClick={onClose}
              className="flex-1 border border-slate-600 py-2 rounded-lg hover:bg-slate-700"
            >
              Cancel
            </button>
            <button 
              type="submit"
              className="flex-1 bg-blue-600 hover:bg-blue-700 py-2 rounded-lg"
            >
              Save & Connect
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

async function connectToVPS(connection: VPSConnection) {
  // Store connection info and redirect to platform
  sessionStorage.setItem('allternit-active-connection', JSON.stringify(connection));
  window.location.href = '/platform';
}

function deleteConnection(id: string) {
  const connections = JSON.parse(localStorage.getItem('allternit-connections') || '[]');
  const filtered = connections.filter((c: VPSConnection) => c.id !== id);
  localStorage.setItem('allternit-connections', JSON.stringify(filtered));
  window.location.reload();
}
```

### 1.6 Create Platform Interface (Main App)

**File**: `cmd/shell/web/src/pages/Platform.tsx`

```tsx
import { useEffect, useState } from 'react';
import { UserButton } from '@clerk/clerk-react';

export function Platform() {
  const [connection, setConnection] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    // Get active connection from session
    const conn = sessionStorage.getItem('allternit-active-connection');
    if (!conn) {
      window.location.href = '/dashboard';
      return;
    }
    
    const parsed = JSON.parse(conn);
    setConnection(parsed);
    
    // Verify connection to VPS
    verifyConnection(parsed).then(valid => {
      if (!valid) {
        setError('Could not connect to VPS. Please check your configuration.');
      }
      setIsLoading(false);
    });
  }, []);
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
          <p>Connecting to {connection?.name}...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-semibold mb-2">Connection Error</h2>
          <p className="text-gray-400 mb-6">{error}</p>
          <button 
            onClick={() => window.location.href = '/dashboard'}
            className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Platform Header */}
      <header className="bg-slate-800 border-b border-slate-700">
        <div className="container mx-auto px-6 py-3 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <span className="font-bold text-lg">allternit</span>
            <span className="text-gray-400">|</span>
            <span className="text-green-400 flex items-center gap-2">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              {connection?.name}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => window.location.href = '/dashboard'}
              className="text-gray-400 hover:text-white"
            >
              Switch VPS
            </button>
            <UserButton />
          </div>
        </div>
      </header>
      
      {/* Main Platform UI */}
      <main className="h-[calc(100vh-60px)]">
        {/* This loads the actual allternit-platform UI component */}
        <AllternitPlatform 
          gatewayUrl={connection?.host}
          apiKey={connection?.apiKey}
        />
      </main>
    </div>
  );
}

async function verifyConnection(connection: any): Promise<boolean> {
  try {
    const response = await fetch(`${connection.host}/health`, {
      headers: {
        'Authorization': `Bearer ${connection.apiKey}`
      }
    });
    return response.ok;
  } catch {
    return false;
  }
}

// This would be your actual platform component
function AllternitPlatform({ gatewayUrl, apiKey }: { gatewayUrl: string; apiKey: string }) {
  // Embed the actual allternit-platform UI here
  // This connects to their VPS API
  return (
    <iframe 
      src={`${gatewayUrl}/ui?key=${encodeURIComponent(apiKey)}`}
      className="w-full h-full border-0"
      sandbox="allow-scripts allow-same-origin allow-popups"
    />
  );
}
```

### 1.7 Environment Variables (Vercel Dashboard)

Set these in Vercel dashboard (Settings → Environment Variables):

```
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
VITE_ALLTERNIT_PLATFORM_MODE=saas
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_... (if using Stripe)
```

---

## PART 2: Customer VPS Setup Guide (What THEY Need to Do)

### 2.1 One-Line Installer (What You Provide)

Create this script: `https://install.allternit.com/install.sh`

```bash
#!/bin/bash
# allternit VPS Installer
# Customers run: curl -fsSL https://install.allternit.com | bash

set -e

ALLTERNIT_VERSION="${ALLTERNIT_VERSION:-1.0.0}"
INSTALL_DIR="${INSTALL_DIR:-/opt/allternit}"
DATA_DIR="${DATA_DIR:-/var/lib/allternit}"

echo "═══════════════════════════════════════════════════════════"
echo "  allternit Platform - VPS Installer"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Detect OS
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)

if [ "$ARCH" = "x86_64" ]; then
  ARCH="x86_64"
elif [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then
  ARCH="aarch64"
else
  echo "❌ Unsupported architecture: $ARCH"
  exit 1
fi

echo "📦 Downloading allternit v${ALLTERNIT_VERSION}..."

# Download binary
BINARY_URL="https://github.com/allternit/allternit/releases/download/v${ALLTERNIT_VERSION}/allternit-${ALLTERNIT_VERSION}-${OS}-${ARCH}.tar.gz"

curl -fsSL "$BINARY_URL" -o /tmp/allternit.tar.gz
tar -xzf /tmp/allternit.tar.gz -C /tmp/

# Create directories
sudo mkdir -p "$INSTALL_DIR"
sudo mkdir -p "$DATA_DIR"

# Install binary
sudo cp /tmp/allternit-api "$INSTALL_DIR/"
sudo chmod +x "$INSTALL_DIR/allternit-api"

# Generate API key
API_KEY=$(openssl rand -hex 32)
echo "$API_KEY" | sudo tee "$DATA_DIR/.api_key" > /dev/null
sudo chmod 600 "$DATA_DIR/.api_key"

echo ""
echo "⚙️  Configuring allternit..."

# Create config
cat | sudo tee "$INSTALL_DIR/config.toml" << EOF
# allternit Platform Configuration
[server]
bind = "0.0.0.0:3010"
data_dir = "$DATA_DIR"

[auth]
api_key = "$API_KEY"
# CORS - Add your platform URL here
cors_origins = [
    "https://platform.allternit.com",
    "https://app.allternit.com"
]

[chrome_streaming]
enabled = true
port = 8081
EOF

# Create systemd service
echo "🔧 Creating systemd service..."

cat | sudo tee /etc/systemd/system/allternit-platform.service << EOF
[Unit]
Description=allternit Platform
After=network.target

[Service]
Type=simple
User=allternit
Group=allternit
WorkingDirectory=$INSTALL_DIR
Environment="Allternit_CONFIG=$INSTALL_DIR/config.toml"
Environment="RUST_LOG=info"
ExecStart=$INSTALL_DIR/allternit-api
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# Create user
sudo useradd -r -s /bin/false allternit 2>/dev/null || true
sudo chown -R allternit:allternit "$INSTALL_DIR"
sudo chown -R allternit:allternit "$DATA_DIR"

# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable allternit-platform

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  ✅ Installation Complete!"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "📋 Next Steps:"
echo ""
echo "1. Start the service:"
echo "   sudo systemctl start allternit-platform"
echo ""
echo "2. Check status:"
echo "   sudo systemctl status allternit-platform"
echo ""
echo "3. Your API Key (save this!):"
echo "   $API_KEY"
echo ""
echo "4. Configure firewall:"
echo "   sudo ufw allow 3010/tcp"
echo "   sudo ufw allow 8081/tcp  # Chrome Streaming"
echo ""
echo "5. Connect in allternit dashboard:"
echo "   Host: https://$(curl -s ifconfig.me):3010"
echo "   API Key: (shown above)"
echo ""
echo "📚 Documentation: https://docs.allternit.com"
echo "🔧 Support: support@allternit.com"
echo ""
```

### 2.2 Customer Instructions (Email/Documentation)

**Subject: Set Up Your allternit Platform VPS**

```
Hi [Customer Name],

Welcome to allternit! To start using AI agents on your own infrastructure, 
please follow these steps:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1: Provision a VPS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Minimum Requirements:
• 2 CPU cores (4 recommended)
• 4 GB RAM (8 GB recommended)
• 20 GB SSD storage
• Ubuntu 22.04 LTS or Debian 12

Recommended Providers:
• DigitalOcean: $24/month (4GB RAM)
• AWS EC2: t3.medium
• Hetzner: €7.50/month (4GB RAM)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2: Run Installer
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SSH into your VPS and run:

curl -fsSL https://install.allternit.com | bash

This will:
✓ Download and install the platform
✓ Configure systemd service
✓ Generate your API key
✓ Set up Chrome streaming (optional)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3: Configure Firewall
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Allow incoming connections:

sudo ufw allow 22/tcp      # SSH (if not already)
sudo ufw allow 80/tcp      # HTTP
sudo ufw allow 443/tcp     # HTTPS
sudo ufw allow 3010/tcp    # allternit API
sudo ufw allow 8081/tcp    # Chrome Streaming
sudo ufw enable

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4: Connect to Platform
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Log in to https://platform.allternit.com
2. Click "Add VPS" on your dashboard
3. Enter:
   • Name: My Production Server
   • Host: https://YOUR_VPS_IP:3010
   • API Key: (shown after installer)
4. Click "Connect"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TROUBLESHOOTING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Check service status:
  sudo systemctl status allternit-platform

View logs:
  sudo journalctl -u allternit-platform -f

Test API:
  curl https://YOUR_VPS_IP:3010/health

Need help? Reply to this email or visit:
https://docs.allternit.com/setup

Best regards,
The allternit Team
```

---

## PART 3: User Experience Flow

### 3.1 First-Time User Journey

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        NEW USER ONBOARDING FLOW                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. LANDING PAGE (platform.allternit.com)                                 │
│     ├─ User sees marketing page with features                              │
│     ├─ "Start Free Trial" / "Sign Up" buttons                              │
│     └─ User clicks "Get Started"                                           │
│         ▼                                                                   │
│  2. SIGN UP (Clerk modal/page)                                             │
│     ├─ Email + password OR                                                 │
│     ├─ Google OAuth OR                                                     │
│     └─ GitHub OAuth                                                        │
│         ▼                                                                   │
│  3. ONBOARDING WIZARD                                                      │
│     ├─ Step 1: "What's your use case?"                                     │
│     │   • Web scraping                                                     │
│     │   • Automated testing                                                │
│     │   • Data extraction                                                  │
│     │   • AI agent development                                             │
│     │                                                                      │
│     ├─ Step 2: "Do you have a VPS?"                                        │
│     │   • Yes → Show connection form                                       │
│     │   • No → Show VPS provider recommendations                           │
│     │                                                                      │
│     └─ Step 3: "Connect your VPS" (if they have one)                       │
│         ▼                                                                   │
│  4. DASHBOARD (First Time)                                                 │
│     ├─ Shows "Add Your First VPS" card prominently                         │
│     ├─ Quick start guide sidebar                                           │
│     └─ Link to documentation                                               │
│         ▼                                                                   │
│  5. ADD VPS CONNECTION                                                     │
│     ├─ Form: Name, Host URL, API Key                                       │
│     ├─ Test connection button                                              │
│     └─ Save connection                                                     │
│         ▼                                                                   │
│  6. PLATFORM INTERFACE                                                     │
│     ├─ Load allternit-platform UI                                                │
│     ├─ Connect to customer's VPS via WebSocket                             │
│     └─ Show browser capsule, agent controls, etc.                          │
│         ▼                                                                   │
│  7. FIRST AGENT                                                            │
│     ├─ Tutorial overlay: "Create your first agent"                         │
│     ├─ Pre-filled example: "Go to example.com and..."                      │
│     └─ User runs first agent successfully! 🎉                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Returning User Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       RETURNING USER FLOW                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. LANDING PAGE                                                           │
│     └─ User clicks "Sign In"                                               │
│         ▼                                                                   │
│  2. SIGN IN (Clerk)                                                        │
│     └─ User authenticates                                                  │
│         ▼                                                                   │
│  3. DASHBOARD (has VPS connections)                                        │
│     ├─ Shows list of saved VPS connections                                 │
│     ├─ Recent activity / quick actions                                     │
│     └─ User clicks "Connect" on a VPS                                      │
│         ▼                                                                   │
│  4. PLATFORM INTERFACE (instant)                                           │
│     ├─ Skip onboarding wizard                                              │
│     ├─ Load directly into platform                                         │
│     └─ Resume previous session (if stored)                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.3 User Interface Screenshots (Description)

#### Screen 1: Landing Page
```
┌─────────────────────────────────────────────────────────────────┐
│  allternit                                    [Sign In] [Get   │
│                                                 Started]        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│         AI-Powered Browser Automation                           │
│         On Your Infrastructure                                  │
│                                                                 │
│    Run autonomous AI agents with full browser control.          │
│    Your data stays on your servers.                             │
│                                                                 │
│         [Start Free Trial]  [View Demo]                         │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  🤖 AI Agents    🔒 Data Privacy    🌐 Real Chrome              │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  How It Works                                                   │
│  1 → 2 → 3 → 4                                                  │
│  Sign Up    Connect VPS    Launch Agent    Monitor              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Screen 2: Dashboard (No VPS)
```
┌─────────────────────────────────────────────────────────────────┐
│  allternit | Dashboard                           [+ Add VPS] 👤 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Welcome back, John                                             │
│  Manage your AI agents and VPS connections.                     │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│           🖥️                                                    │
│         No VPS Connections                                      │
│                                                                 │
│    Connect your first VPS to start using AI agents.             │
│                                                                 │
│         [Add Your First VPS]                                    │
│                                                                 │
│    New to allternit? Check out our:                            │
│    • Quick Start Guide                                          │
│    • Video Tutorials                                            │
│    • VPS Setup Instructions                                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Screen 3: Dashboard (With VPS)
```
┌─────────────────────────────────────────────────────────────────┐
│  allternit | Dashboard                           [+ Add VPS] 👤 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Welcome back, John                                             │
│  Manage your AI agents and VPS connections.                     │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────┐  ┌─────────────────────┐              │
│  │ Production Server   │  │ Staging Server      │              │
│  │ 🟢 Connected        │  │ ⚪ Not connected    │              │
│  │                     │  │                     │              │
│  │ vps.mycompany.com   │  │ staging.mycomp.com  │              │
│  │                     │  │                     │              │
│  │ [   Connect   ]     │  │ [   Connect   ]     │              │
│  └─────────────────────┘  └─────────────────────┘              │
│                                                                 │
│  Recent Activity                                                │
│  • Web scraping job completed - 2 hours ago                     │
│  • New agent "Product Monitor" created - 1 day ago              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Screen 4: Add VPS Modal
```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│              Add VPS Connection                                 │
│                                                                 │
│  Connection Name                                                │
│  [Production Server                           ]                 │
│                                                                 │
│  VPS Host URL                                                   │
│  [https://vps.mycompany.com:3010              ]                 │
│  Include port if not 443. Must be HTTPS.                        │
│                                                                 │
│  API Key                                                        │
│  [••••••••••••••••••••••••••••••••             ]                 │
│                                                                 │
│  [Cancel]                    [Save & Connect]                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Screen 5: Platform Interface
```
┌─────────────────────────────────────────────────────────────────┐
│  allternit | 🟢 Production Server  [Switch VPS] 👤              │
├─────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │                                                             │ │
│ │                    BROWSER CAPSULE                          │ │
│ │                                                             │ │
│ │     ┌───────────────────────────────────────────┐           │ │
│ │     │  🌐 https://example.com                   │           │ │
│ │     ├───────────────────────────────────────────┤           │ │
│ │     │                                           │           │ │
│ │     │           (Chrome View via                │           │ │
│ │     │            WebRTC Stream)                 │           │ │
│ │     │                                           │           │ │
│ │     └───────────────────────────────────────────┘           │ │
│ │                                                             │ │
│ └─────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│  Agent Control  |  Console  |  Network  |  Settings             │
├─────────────────────────────────────────────────────────────────┤
│  > Navigate to https://example.com                              │
│  > Click on "Products" link                                     │
│  > Extract pricing data...                                      │
│                                                                 │
│  [Stop]  [Pause]  [Resume]                                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## PART 4: Technical Implementation

### 4.1 Authentication Flow (Clerk)

```
User → platform.allternit.com → Clerk Auth → JWT Token
                                         ↓
User Dashboard ← Valid Session ← Store token
                                         ↓
API Calls → Include token in header → Clerk verifies → Access granted
```

### 4.2 VPS Connection Security

```
┌─────────────────────────────────────────────────────────────────┐
│                    SECURE CONNECTION FLOW                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Customer VPS Setup:                                         │
│     • Generates API key (256-bit random)                        │
│     • Stores in /var/lib/allternit/.api_key                           │
│     • Sets CORS to allow only your platform domain              │
│                                                                 │
│  2. User Connects from Your Platform:                           │
│     • Sends HTTPS request with API key header                   │
│     • VPS validates API key                                     │
│     • Establishes WebSocket connection                          │
│                                                                 │
│  3. Ongoing Communication:                                      │
│     • All API calls authenticated with API key                  │
│     • WebSocket messages signed                                 │
│     • Rate limiting per API key                                 │
│                                                                 │
│  4. Data Flow:                                                  │
│     • UI commands → Your Platform → Customer VPS                │
│     • Chrome stream → Customer VPS → User's browser (WebRTC)    │
│     • Data NEVER touches your servers                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4.3 API Endpoints (Customer VPS)

```yaml
# Authentication
POST /auth/verify
  Headers: Authorization: Bearer {api_key}
  Response: { valid: true, tenant_id: "..." }

# Health Check
GET /health
  Response: { status: "healthy", version: "1.0.0" }

# Agent Management
GET /agents
  Response: [{ id, name, status, created_at }]

POST /agents
  Body: { name, config, skills }
  Response: { id, status: "created" }

# Browser Control
POST /browser/session
  Body: { viewport, user_agent }
  Response: { session_id, ws_url }

# WebSocket: /ws/browser/{session_id}
# Streams Chrome view to browser
```

### 4.4 Frontend Routing

```typescript
// src/App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ClerkProvider } from '@clerk/clerk-react';

function App() {
  return (
    <ClerkProvider publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/sign-in/*" element={<SignInPage />} />
          <Route path="/sign-up/*" element={<SignUpPage />} />
          
          {/* Protected Routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/platform" element={<Platform />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ClerkProvider>
  );
}
```

---

## PART 5: Billing & Pricing (Optional)

### 5.1 Pricing Tiers

```
┌─────────────────────────────────────────────────────────────────┐
│                         PRICING                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  STARTER (Free)          PRO ($49/mo)          ENTERPRISE       │
│  ───────────────         ────────────          ───────────      │
│  • 1 VPS                 • 5 VPS               • Unlimited      │
│  • 100 API calls/day     • Unlimited calls     • Unlimited      │
│  • Community support     • Email support       • 24/7 support   │
│  • Basic agents          • Advanced agents     • Custom agents  │
│                          • Priority features   • SLA guarantee  │
│                                                                 │
│  [Get Started]           [Start Free Trial]    [Contact Sales]  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Stripe Integration

```bash
# Install Stripe
pnpm add @stripe/stripe-js @stripe/react-stripe-js
```

```typescript
// src/components/Pricing.tsx
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

export function Pricing() {
  const handleSubscribe = async (priceId: string) => {
    const response = await fetch('/api/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priceId })
    });
    
    const { sessionId } = await response.json();
    const stripe = await stripePromise;
    await stripe?.redirectToCheckout({ sessionId });
  };
  
  return (
    <div className="pricing-cards">
      <PricingCard 
        tier="Pro"
        price="$49/mo"
        onSubscribe={() => handleSubscribe('price_pro123')}
      />
    </div>
  );
}
```

---

## Summary

### What YOU (Company) Provide:

| Component | What You Build | What You Host |
|-----------|---------------|---------------|
| **Landing Page** | Marketing site | Vercel/Netlify |
| **Authentication** | Clerk integration | Clerk (managed) |
| **Dashboard** | VPS management UI | Vercel/Netlify |
| **Platform UI** | allternit-platform web app | Vercel/Netlify |
| **Installer** | One-line bash script | GitHub/CDN |
| **Documentation** | Setup guides | GitBook/Docs site |
| **Support** | Email/chat | Your system |

### What CUSTOMER Provides:

| Component | What They Need | Cost |
|-----------|---------------|------|
| **VPS** | 2-4 CPU, 4-8GB RAM | $10-40/month |
| **Domain** (optional) | subdomain or IP | Free |
| **Time** | 10 min setup | One-time |

### What USER Does:

1. Visits `platform.allternit.com`
2. Signs up with email/Google/GitHub
3. Adds VPS connection (Host URL + API Key)
4. Clicks "Connect"
5. Uses AI agents with full browser control

---

## Next Steps

1. **Set up Clerk account** for authentication
2. **Build landing page** with sign-up CTAs
3. **Create dashboard** with VPS management
4. **Build VPS installer script**
5. **Deploy to Vercel**
6. **Test end-to-end flow**

Want me to help with any specific part?
