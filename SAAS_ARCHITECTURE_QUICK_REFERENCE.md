# A2rchitect SaaS - Quick Reference

## The Big Picture

```
┌────────────────────────────────────────────────────────────────────────────────────┐
│                           YOUR COMPANY (A2rchitect Inc.)                           │
├────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                    │
│   ┌─────────────────────┐         ┌─────────────────────┐                         │
│   │   Static Web App    │◄───────►│   Clerk Auth        │                         │
│   │   (Vercel)          │  HTTPS  │   (Authentication)  │                         │
│   │   platform.a2r.com  │         │                     │                         │
│   └──────────┬──────────┘         └─────────────────────┘                         │
│              │                                                                      │
│              │  API Key + VPS URL                                                   │
│              ▼                                                                      │
│   ┌────────────────────────────────────────────────────────────────────────────┐  │
│   │                     CUSTOMER VPS (Self-Hosted)                              │  │
│   │                    (DigitalOcean, AWS, Hetzner...)                          │  │
│   │                                                                             │  │
│   │   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                     │  │
│   │   │  API Server  │  │   Chrome     │  │   SQLite     │  Customer's Data   │  │
│   │   │  Port 3010   │  │   Port 8081  │  │   Database   │  Never Leaves      │  │
│   │   └──────────────┘  └──────────────┘  └──────────────┘                     │  │
│   │                                                                             │  │
│   └────────────────────────────────────────────────────────────────────────────┘  │
│                              ▲                                                     │
│                              │ WebRTC                                               │
│                              ▼                                                     │
│   ┌────────────────────────────────────────────────────────────────────────────┐  │
│   │                          END USER BROWSER                                   │  │
│   │                                                                             │  │
│   │   • Sees Chrome browser via WebRTC stream                                   │  │
│   │   • Controls AI agents                                                      │  │
│   │   • All data stays on customer VPS                                          │  │
│   │                                                                             │  │
│   └────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                    │
└────────────────────────────────────────────────────────────────────────────────────┘
```

---

## What You Build vs What They Host

| Layer | You Host | Customer Hosts |
|-------|----------|----------------|
| **UI/Frontend** | ✅ Static web app (Vercel) | ❌ |
| **Authentication** | ✅ Clerk (managed service) | ❌ |
| **API/Backend** | ❌ | ✅ Rust binary on their VPS |
| **Database** | ❌ | ✅ SQLite on their VPS |
| **Browser/Chrome** | ❌ | ✅ Chrome Streaming container |
| **Data** | ❌ | ✅ Never leaves their server |

---

## User Flow (Step by Step)

```
USER VISITS platform.a2rchitect.com
         │
         ▼
┌──────────────────────┐
│   LANDING PAGE       │  ← Marketing, features, pricing
│   ├─ "Get Started"   │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│   SIGN UP (Clerk)    │  ← Email, Google, or GitHub
│   Create account     │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│   ONBOARDING         │  ← "Do you have a VPS?"
│   ├─ Yes → Connect   │
│   └─ No → Show guide │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│   DASHBOARD          │  ← List of VPS connections
│   ├─ Add VPS button  │
│   └─ Connect button  │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│   ADD VPS MODAL      │  ← Enter VPS details:
│   ├─ Name            │      • Name: "Production"
│   ├─ Host URL        │      • Host: https://1.2.3.4:3010
│   └─ API Key         │      • Key: abc123...
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│   PLATFORM UI        │  ← Full a2rchitect interface
│   ├─ Browser capsule │      • Chrome streaming
│   ├─ Agent controls  │      • AI agents
│   └─ Console/logs    │      • All connected to THEIR VPS
└──────────────────────┘
```

---

## Customer VPS Setup (What They Do)

### Step 1: Provision VPS (5 min)
```bash
# DigitalOcean, AWS, Hetzner, etc.
# Minimum: 2 CPU, 4GB RAM, Ubuntu 22.04
```

### Step 2: Run Your Installer (2 min)
```bash
curl -fsSL https://install.a2rchitect.com | bash

# Output:
# ✅ Installed to /opt/a2r
# ✅ API Key: abc123xyz789 (SAVE THIS!)
# ✅ Run: sudo systemctl start a2r-platform
```

### Step 3: Open Firewall (1 min)
```bash
sudo ufw allow 3010/tcp  # API
sudo ufw allow 8081/tcp  # Chrome Streaming
```

### Step 4: Connect in Your Platform (1 min)
- Log in to platform.a2rchitect.com
- Click "Add VPS"
- Paste their VPS IP + API Key
- Click "Connect"
- Done! 🎉

**Total Setup Time: ~10 minutes**

---

## Technical Architecture

### Frontend Stack (Your Cloud)
```
Framework:    React + Vite
Styling:      Tailwind CSS
Auth:         Clerk
Hosting:      Vercel/Netlify
Domain:       platform.a2rchitect.com
```

### Backend Stack (Customer VPS)
```
API Server:   Rust (a2rchitech-api)
Database:     SQLite
Browser:      Chrome via WebRTC
Container:    Docker (optional)
Process:      systemd service
```

### Communication Flow
```
1. User UI ──HTTPS+API Key──► Customer VPS (commands)
2. Chrome ──WebRTC──► User Browser (video stream)
3. All data stays on customer VPS (privacy!)
```

---

## File Structure for SaaS

```
a2rchitech/
├── 7-apps/shell/web/              # Web UI (deploy to Vercel)
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Landing.tsx        # Marketing page
│   │   │   ├── Dashboard.tsx      # VPS management
│   │   │   ├── Platform.tsx       # Main app interface
│   │   │   └── Auth.tsx           # Sign in/up
│   │   ├── components/
│   │   ├── hooks/
│   │   └── App.tsx
│   ├── package.json
│   └── vercel.json
│
├── scripts/
│   └── install.sh                 # Customer VPS installer
│
├── docs/
│   ├── setup.md                   # VPS setup guide
│   └── api.md                     # API documentation
│
└── SAAS_SETUP_GUIDE.md            # This complete guide
```

---

## Environment Variables

### Frontend (Vercel Dashboard)
```
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
VITE_A2R_PLATFORM_MODE=saas
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_... (optional)
```

### Customer VPS (/opt/a2r/config.toml)
```toml
[server]
bind = "0.0.0.0:3010"
data_dir = "/var/lib/a2r"

[auth]
api_key = "abc123..."
cors_origins = ["https://platform.a2rchitect.com"]

[chrome_streaming]
enabled = true
port = 8081
```

---

## API Endpoints (Customer VPS)

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/health` | GET | No | Health check |
| `/auth/verify` | POST | API Key | Verify credentials |
| `/agents` | GET | API Key | List agents |
| `/agents` | POST | API Key | Create agent |
| `/browser/session` | POST | API Key | Start browser |
| `/ws/browser/{id}` | WS | API Key | WebRTC stream |

---

## Pricing Model Options

### Option 1: SaaS Subscription (You Charge)
```
Free:     1 VPS, 100 API calls/day
Pro:      $49/mo, 5 VPS, unlimited
Enterprise: $499/mo, unlimited, support

Customer pays you, hosts their own VPS
```

### Option 2: Open Source (Free)
```
Everything is free
You make money from:
- Support contracts
- Custom development
- Managed hosting (optional)
```

### Option 3: Hybrid
```
Core platform: Free
Premium features: Paid
- Advanced agents
- Team collaboration
- Priority support
```

---

## Security Checklist

- [x] API keys (256-bit random)
- [x] HTTPS only (TLS 1.3)
- [x] CORS restricted to your domain
- [x] Rate limiting per API key
- [x] No data stored on your servers
- [x] WebRTC encrypted (DTLS-SRTP)
- [x] SQLite permissions (600)
- [x] Systemd sandboxing

---

## Common Questions

**Q: Who pays for the VPS?**
A: Customer pays their VPS provider (DO, AWS, etc.)

**Q: Can they use any VPS provider?**
A: Yes, any Linux VPS with Docker support

**Q: What if their VPS goes down?**
A: Their connection shows "disconnected" in dashboard

**Q: Can they run multiple VPS?**
A: Yes, dashboard supports unlimited connections

**Q: Is my data safe?**
A: Yes, data never leaves their VPS

**Q: Do I need a backend server?**
A: No, just static hosting (Vercel/Netlify)

---

## Quick Start Commands

### For You (Deploy Platform)
```bash
# 1. Build web app
cd 7-apps/shell/web
pnpm install
pnpm build

# 2. Deploy to Vercel
vercel --prod

# 3. Set up Clerk
# Go to clerk.com, create app, copy keys to Vercel

# 4. Done! Share platform.a2rchitect.com
```

### For Customer (Setup VPS)
```bash
# 1. Run installer
curl -fsSL https://install.a2rchitect.com | bash

# 2. Start service
sudo systemctl start a2r-platform

# 3. Get API key
cat /var/lib/a2r/.api_key

# 4. Add to your platform dashboard
```

---

## Success Metrics

| Metric | Target |
|--------|--------|
| VPS Setup Time | < 10 minutes |
| First Agent Launch | < 5 minutes |
| Platform Load Time | < 2 seconds |
| WebRTC Latency | < 200ms |
| Uptime | 99.9% |

---

## Next Actions

### Week 1: Foundation
- [ ] Set up Clerk account
- [ ] Build landing page
- [ ] Create dashboard
- [ ] Deploy to Vercel

### Week 2: Integration
- [ ] Build VPS installer script
- [ ] Add connection modal
- [ ] Create platform interface
- [ ] Test end-to-end flow

### Week 3: Polish
- [ ] Write documentation
- [ ] Create onboarding videos
- [ ] Add error handling
- [ ] Beta test with users

### Week 4: Launch
- [ ] Announce on Twitter/ProductHunt
- [ ] Monitor usage
- [ ] Gather feedback
- [ ] Iterate

---

**Files Created:**
- `SAAS_SETUP_GUIDE.md` - Complete technical guide
- `SAAS_ARCHITECTURE_QUICK_REFERENCE.md` - This summary

**Ready to build? Start with Clerk + Landing Page!**
