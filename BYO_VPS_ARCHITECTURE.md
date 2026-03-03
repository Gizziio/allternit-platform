# BYO VPS Architecture - Final Design

## The Decision

**You host:** Static website only (Cloudflare Pages)  
**Users host:** Everything else (VPS with Rust API, Chrome, SQLite)

**Your cost:** ~$20/mo  
**User cost:** $20-40/mo (their own VPS)  
**Your revenue:** $29-99/mo subscription

---

## Complete Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     BYO VPS ARCHITECTURE                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  YOUR INFRASTRUCTURE (Minimal)                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                                                                       │ │
│  │  Cloudflare Pages ($20/mo)                                            │ │
│  │  ├─ Static React website                                              │ │
│  │  ├─ Landing page                                                      │ │
│  │  ├─ Dashboard UI                                                      │ │
│  │  ├─ Platform interface                                                │ │
│  │  └─ Connects to user VPS via WebSocket/API                            │ │
│  │                                                                       │ │
│  │  Clerk (Free tier)                                                    │ │
│  │  └─ Authentication (managed service)                                  │ │
│  │                                                                       │ │
│  │  GitHub (Free)                                                        │ │
│  │  └─ Code repository + VPS installer script                            │ │
│  │                                                                       │ │
│  │  TOTAL YOUR COST: $20/mo                                              │ │
│  │                                                                       │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                              ▲                                              │
│                              │ HTTPS / WebSocket                             │
│                              │ API Key authentication                        │
│                              ▼                                              │
│  USER INFRASTRUCTURE (They Pay)                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                                                                       │ │
│  │  DigitalOcean / AWS / Hetzner ($20-40/mo)                             │ │
│  │                                                                       │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                │ │
│  │  │  Rust API    │  │   Chrome     │  │   SQLite     │                │ │
│  │  │  Port 3010   │  │   Port 9222  │  │   Database   │                │ │
│  │  │              │  │              │  │              │                │ │
│  │  │  ├─ Auth     │  │  ├─ Browser  │  │  ├─ Agents   │                │ │
│  │  │  ├─ Agents   │  │  ├─ WebRTC   │  │  ├─ History  │                │ │
│  │  │  ├─ Execute  │  │  └─ Stream   │  │  └─ Config   │                │ │
│  │  │  └─ WebSocket│  │              │  │              │                │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘                │ │
│  │                                                                       │ │
│  │  Docker (Optional)                                                    │ │
│  │  └─ Containerized services                                            │ │
│  │                                                                       │ │
│  │  Python Runtime                                                       │ │
│  │  └─ Code execution                                                    │ │
│  │                                                                       │ │
│  │  TOTAL USER COST: $20-40/mo                                           │ │
│  │                                                                       │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                              ▲                                              │
│                              │ WebRTC Video Stream                           │
│                              ▼                                              │
│  USER BROWSER                                                               │
│  ├─ Sees Chrome automation                                                 │
│  ├─ Controls agents                                                        │
│  ├─ Views results                                                          │
│  └─ All data stays on their VPS                                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## User Flow: From Signup to Full Platform

```
1. USER VISITS platform.yourdomain.com
        ↓
2. Signs up with Clerk (email/Google/GitHub)
        ↓
3. Lands on Dashboard
        ↓
4. Sees "Add Your First VPS" card
        ↓
5. CLICKS "Deploy to DigitalOcean" (one-click)
        ├─ OR clicks "I have my own VPS"
        ↓
6. DIGITALOCEAN FLOW:
   ├─ OAuth to DigitalOcean
   ├─ Auto-creates $24/mo droplet
   ├─ Runs install script
   ├─ Gets API key
   └─ Auto-connects to dashboard
        ↓
   OWN VPS FLOW:
   ├─ Shows install command:
   │  curl -fsSL https://install.a2rchitect.com | bash
   ├─ User runs on their VPS
   ├─ Gets API key
   └─ Pastes into dashboard
        ↓
7. VPS APPEARS IN DASHBOARD
        ↓
8. USER CLICKS "Connect"
        ↓
9. FULL PLATFORM LOADS
   ├─ WebSocket connection to their VPS
   ├─ Chrome browser streams via WebRTC
   ├─ AI agents execute on their server
   └─ All data stays on their infrastructure
        ↓
10. USER CREATES AND RUNS AGENTS
    └─ Full automation capabilities
```

---

## What You Actually Build

### 1. Static Website (Cloudflare Pages)

```typescript
// Just these files - no backend!

// Landing.tsx - Marketing page
export function Landing() {
  return (
    <div>
      <h1>A2rchitect</h1>
      <p>AI Browser Automation</p>
      <SignUpButton />
    </div>
  );
}

// Dashboard.tsx - VPS management
export function Dashboard() {
  const [vpsList, setVpsList] = useState([]);
  
  return (
    <div>
      <h2>Your VPS Connections</h2>
      {vpsList.length === 0 ? (
        <EmptyState 
          title="No VPS Connected"
          action={
            <>
              <Button onClick={deployToDigitalOcean}>
                Deploy to DigitalOcean
              </Button>
              <Button onClick={showManualSetup}>
                Use My Own VPS
              </Button>
            </>
          }
        />
      ) : (
        <VpsList connections={vpsList} />
      )}
    </div>
  );
}

// Platform.tsx - Connects to user VPS
export function Platform() {
  const [connection] = useState(() => {
    return JSON.parse(sessionStorage.getItem('active-vps'));
  });
  
  useEffect(() => {
    // Connect to USER'S VPS, not yours!
    const ws = new WebSocket(
      `wss://${connection.host}/ws`,
      [],
      { headers: { 'Authorization': `Bearer ${connection.apiKey}` }}
    );
    
    ws.onmessage = (event) => {
      // Handle messages from user's VPS
      handleVpsMessage(JSON.parse(event.data));
    };
  }, [connection]);
  
  return (
    <div>
      <ChromeStream ws={ws} />
      <AgentControls ws={ws} />
      <ConsoleOutput ws={ws} />
    </div>
  );
}
```

### 2. VPS Installer Script (Hosted on GitHub)

```bash
#!/bin/bash
# install.sh - One-line installer
# curl -fsSL https://install.a2rchitect.com | bash

set -e

echo "🚀 Installing A2rchitect Platform..."

# 1. Download latest release
curl -fsSL https://github.com/a2rchitect/releases/latest/download/a2rchitect-linux-amd64.tar.gz | tar xz

# 2. Move to /opt
sudo mv a2rchitect /opt/a2rchitect
sudo chmod +x /opt/a2rchitect/a2rchitech-api

# 3. Generate API key
API_KEY=$(openssl rand -hex 32)

# 4. Create config
cat | sudo tee /opt/a2rchitect/config.toml << EOF
[server]
bind = "0.0.0.0:3010"
data_dir = "/var/lib/a2r"

[auth]
api_key = "$API_KEY"
cors_origins = ["https://platform.yourdomain.com"]

[chrome]
enabled = true
port = 9222
EOF

# 5. Create systemd service
cat | sudo tee /etc/systemd/system/a2r-platform.service << EOF
[Unit]
Description=A2rchitect Platform
After=network.target

[Service]
Type=simple
User=a2r
ExecStart=/opt/a2rchitect/a2rchitech-api --config /opt/a2rchitect/config.toml
Restart=always

[Install]
WantedBy=multi-user.target
EOF

# 6. Create user
sudo useradd -r -s /bin/false a2r 2>/dev/null || true

# 7. Enable and start
sudo systemctl daemon-reload
sudo systemctl enable a2r-platform
sudo systemctl start a2r-platform

# 8. Open firewall
sudo ufw allow 3010/tcp
sudo ufw allow 9222/tcp

# 9. Output success
echo ""
echo "✅ Installation complete!"
echo ""
echo "Your API Key: $API_KEY"
echo "VPS URL: https://$(curl -s ifconfig.me):3010"
echo ""
echo "Add to your A2rchitect dashboard:"
echo "  Host: https://$(curl -s ifconfig.me):3010"
echo "  API Key: $API_KEY"
```

### 3. DigitalOcean Integration (One-Click Deploy)

```typescript
// src/services/digitalocean.ts

export class DigitalOceanDeployer {
  async deployVPS(accessToken: string): Promise<VPSConnection> {
    // 1. Create droplet
    const droplet = await fetch('https://api.digitalocean.com/v2/droplets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: `a2r-${Date.now()}`,
        region: 'nyc3',
        size: 's-2vcpu-4gb',  // $24/mo
        image: 'ubuntu-22-04-x64',
        user_data: `
          #!/bin/bash
          curl -fsSL https://install.a2rchitect.com | bash
        `,
        tags: ['a2rchitect']
      })
    }).then(r => r.json());
    
    // 2. Wait for provisioning
    await this.waitForDroplet(droplet.droplet.id, accessToken);
    
    // 3. Get IP
    const ip = droplet.droplet.networks.v4[0].ip_address;
    
    // 4. Wait for install script to complete
    await this.waitForInstall(ip);
    
    // 5. Fetch API key from VPS
    const apiKey = await this.fetchApiKey(ip);
    
    // 6. Return connection details
    return {
      id: crypto.randomUUID(),
      name: 'DigitalOcean VPS',
      host: `https://${ip}:3010`,
      apiKey: apiKey,
      provider: 'digitalocean'
    };
  }
  
  private async waitForDroplet(id: number, token: string): Promise<void> {
    // Poll until active
    while (true) {
      const status = await fetch(
        `https://api.digitalocean.com/v2/droplets/${id}`,
        { headers: { 'Authorization': `Bearer ${token}` }}
      ).then(r => r.json());
      
      if (status.droplet.status === 'active') break;
      await sleep(5000);
    }
  }
  
  private async waitForInstall(ip: string): Promise<void> {
    // Poll health endpoint until ready
    while (true) {
      try {
        const response = await fetch(`https://${ip}:3010/health`);
        if (response.ok) break;
      } catch {
        // Not ready yet
      }
      await sleep(5000);
    }
  }
}
```

---

## API Flow: Your Site → User VPS

```typescript
// Every API call goes to USER'S VPS, not yours!

// Example: Get agent status
async function getAgentStatus(vps: VPSConnection) {
  const response = await fetch(`${vps.host}/v1/agents/status`, {
    headers: {
      'Authorization': `Bearer ${vps.apiKey}`
    }
  });
  return response.json();
}

// Example: Run agent
async function runAgent(vps: VPSConnection, agentId: string) {
  const response = await fetch(`${vps.host}/v1/agents/${agentId}/run`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${vps.apiKey}`,
      'Content-Type': 'application/json'
    }
  });
  return response.json();
}

// Example: Get Chrome stream
function connectChromeStream(vps: VPSConnection) {
  const ws = new WebSocket(
    `wss://${vps.host}/chrome/stream`,
    [],
    { headers: { 'Authorization': `Bearer ${vps.apiKey}` }}
  );
  return ws;
}
```

---

## Pricing Model (BYO VPS)

| Tier | Price | What's Included | Your Cost |
|------|-------|-----------------|-----------|
| **Free** | $0 | Browser AI only (WebGPU) | $0 |
| **Pro** | $29/mo | Full platform + 1 VPS slot | $0 |
| **Team** | $79/mo | Full platform + 5 VPS slots | $0 |
| **Enterprise** | $199/mo | Unlimited VPS + priority support | $0 |

**Note:** User pays for their own VPS separately ($20-40/mo to DigitalOcean/AWS)

**Your Revenue:**
- 100 Pro users = $2,900/mo
- Your cost = $20/mo (Cloudflare)
- **Profit = $2,880/mo**

---

## Security Model

```
User Browser                          User VPS
     │                                    │
     │ HTTPS + API Key                    │
     ├───────────────────────────────────►│
     │                                    │
     │ WebSocket (authenticated)          │
     ├───────────────────────────────────►│
     │                                    │
     │ All data stays on their VPS        │
     │ You never see their:               │
     │ • Chat history                     │
     │ • Agent data                       │
     │ • Browser activity                 │
     │ • Files                            │
```

**CORS Configuration (User VPS):**
```toml
# config.toml on user VPS
cors_origins = [
    "https://platform.yourdomain.com",
    "https://app.yourdomain.com"
]
```

---

## Implementation Checklist

### Week 1: Foundation
- [ ] Set up Cloudflare Pages
- [ ] Deploy static landing page
- [ ] Integrate Clerk auth
- [ ] Create dashboard UI

### Week 2: VPS Connection
- [ ] Create "Add VPS" modal
- [ ] Build manual VPS setup flow
- [ ] Test connection to VPS
- [ ] Store VPS connections in localStorage

### Week 3: One-Click Deploy
- [ ] DigitalOcean OAuth integration
- [ ] Auto-provisioning endpoint
- [ ] Progress tracking UI
- [ ] Error handling

### Week 4: Platform Integration
- [ ] Connect dashboard to user VPS
- [ ] WebSocket for real-time updates
- [ ] Chrome streaming via WebRTC
- [ ] Full agent execution

### Week 5: Polish
- [ ] End-to-end testing
- [ ] Documentation
- [ ] VPS installer script polish
- [ ] Launch preparation

---

## Summary

**You build:**
1. Static website (Cloudflare Pages)
2. VPS installer script (GitHub)
3. DigitalOcean integration (optional)

**You do NOT build/host:**
- Backend API (user hosts)
- Database (user hosts)
- Chrome (user hosts)
- Compute (user hosts)

**Your cost:** $20/mo
**User cost:** $20-40/mo (VPS) + $29-199/mo (your subscription)
**Your profit:** 95%+ margins

**This is the most scalable, profitable model.**
