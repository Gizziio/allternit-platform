# BYOC Local Test Configuration

## Backend Status ✅ RUNNING

**Local Backend:**
- URL: http://localhost:4096
- Username: `gizzi`
- Password: `c5d4656e7f3753bc0d8996d4dbebf48cecbd7362be06e60f`

**Public Tunnel (for Vercel frontend):**
- URL: https://molecules-dsc-specifications-dangerous.trycloudflare.com
- Same credentials as above

## Test Steps

### 1. Test Backend Health
```bash
curl -u "gizzi:c5d4656e7f3753bc0d8996d4dbebf48cecbd7362be06e60f" \
  https://molecules-dsc-specifications-dangerous.trycloudflare.com/v1/global/health
```

### 2. Open Frontend
Go to: https://platform.allternit.com

### 3. Add "Local" Connection
Since we can't add your actual MacBook via SSH through the browser, we need to manually register this backend:

**Option A: Via API (if you have admin access)**
```bash
curl -X POST https://platform.allternit.com/api/v1/ssh-connections \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN" \
  -d '{
    "name": "Local MacBook Test",
    "host": "localhost",
    "port": 22,
    "username": "test"
  }'
```

**Option B: Manually set backend URL**
In the browser console on platform.allternit.com:
```javascript
// Override the backend URL
localStorage.setItem('a2r.runtime-backend.snapshot', JSON.stringify({
  mode: 'byoc-vps',
  fallback_mode: 'local',
  source: 'user-preference',
  gateway_url: 'https://molecules-dsc-specifications-dangerous.trycloudflare.com',
  gateway_ws_url: 'wss://molecules-dsc-specifications-dangerous.trycloudflare.com',
  gateway_token: 'Basic ' + btoa('gizzi:c5d4656e7f3753bc0d8996d4dbebf48cecbd7362be06e60f'),
  fetched_at: new Date().toISOString()
}));
window.location.reload();
```

### 4. Test Terminal
1. Go to /shell page
2. Create new session
3. If backend is detected, terminal should connect

## Stopping the Test

```bash
# Kill the backend
pkill -f "gizzi-code serve"

# Kill the tunnel
pkill -f "cloudflared tunnel"
```

## Current Process IDs
- Backend PID: 21372
- Tunnel PID: 21441
