# BYOC Test Configuration

## Current Test Environment

### Backend Running on MacBook
```
Local URL:  http://localhost:4096
Public URL: https://molecules-dsc-specifications-dangerous.trycloudflare.com
Username:   gizzi
Password:   c5d4656e7f3753bc0d8996d4dbebf48cecbd7362be06e60f
```

### SSH Tunnel for MacBook
```
SSH Host:   earrings-arrested-renewal-harry.trycloudflare.com
SSH Port:   22 (HTTPS endpoint - requires cloudflared access)
Username:   Your Mac username
Password:   Your Mac password
```

## The Problem

**Cloudflare quick tunnels don't support raw TCP/SSH** - they only proxy HTTP. The Vercel backend can't SSH through an HTTPS endpoint.

## How This SHOULD Work (Proper VPS)

### For a Real VPS (Hetzner, DO, etc.):
```
1. User goes to platform.allternit.com
2. Clicks "Add VPS Connection"
3. Enters: host=5.189.170.23, user=root, password=12345678
4. Frontend calls Vercel API: POST /api/v1/ssh-connections/test
5. Vercel SSHs to VPS, gathers system info
6. User clicks "Install Backend"
7. Vercel SSHs and runs install script
8. Backend starts on VPS port 4096
9. Frontend connects directly to VPS:4096
```

### For Local Development:
```
1. User runs backend locally: ./gizzi-code serve --port 4096
2. User goes to platform.allternit.com  
3. Frontend detects local backend OR user selects "Local Mode"
4. Frontend connects directly to localhost:4096
```

## Missing for Local Testing

The platform needs a **"Local Backend"** option in the UI that:
1. Skips SSH entirely
2. Sets backend URL to `http://localhost:4096`
3. Uses the local tunnel URL for internet access

## Current Status

| Component | Working? | Notes |
|-----------|----------|-------|
| Backend binary | ✅ | Running locally |
| Backend tunnel | ✅ | Accessible from internet |
| SSH access | ❌ | MacBook not reachable via SSH from internet |
| Frontend deploy | ✅ | On Vercel |

## To Test NOW

**Option 1: Add "Local Mode" to UI**
Need to implement a button that bypasses SSH and connects directly to local backend.

**Option 2: Get a Real VPS**
Use Hetzner/DigitalOcean with public IP and working SSH.

**Option 3: Enable SSH on MacBook with Public Access**
Requires router port forwarding or ngrok with auth token.

---

**What do you want to do?**
1. I can add a "Use Local Backend" button to skip SSH
2. We can fix the VPS at 5.189.170.23
3. You can provide a different VPS
