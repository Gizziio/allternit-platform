# BYOC Test Setup - Manual Backend Registration

## What We Built

Added `POST /api/v1/runtime/backend/manual` endpoint to register a backend by URL without SSH.

## API Usage

```bash
curl -X POST https://platform.allternit.com/api/v1/runtime/backend/manual \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN" \
  -d '{
    "name": "My MacBook Backend",
    "gatewayUrl": "https://your-tunnel.trycloudflare.com",
    "gatewayWsUrl": "wss://your-tunnel.trycloudflare.com",
    "gatewayToken": "Basic BASE64(username:password)"
  }'
```

## Current Backend Status

| Component | Status |
|-----------|--------|
| Backend on MacBook | ✅ Running on port 4096 |
| Tunnel URL | ✅ https://molecules-dsc-specifications-dangerous.trycloudflare.com |
| Auth | Username: `gizzi`, Password: `c5d4656e7f3753bc0d8996d4dbebf48cecbd7362be06e60f` |
| Health Check | ✅ Pass |

## What's Missing

The **UI component** for manual backend entry. Currently only the API exists.

## Testing Options

### Option 1: Test via API (Now)
Use the curl command above with your Clerk session token (get from browser dev tools) to register the backend manually.

### Option 2: Add UI Component
Add a "Manual Backend URL" option in the InfrastructureStep alongside "Use Local Backend", "Connect Existing VPS", etc.

## Next Steps

To complete E2E testing, we need either:

1. **A working VPS** with public IP for full SSH flow test
2. **UI for manual backend entry** (API exists, need React component)
3. **Use the existing tunnel** via API call

---

**Status**: Backend ready, API deployed, need UI or manual API call to test.
