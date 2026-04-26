# Onboarding Flow Updated ✅

## Changes Made

### Infrastructure Options (InfraStep)
Now shows 5 options:

1. **Use this computer** (HardDrive icon)
   - Auto-detects local backend on ports 8013, 4096, 3001, 8080
   - Shows "Activate" button when found
   - Shows instructions when not found

2. **Enter backend URL** (Globe icon) ⭐ NEW
   - Form for backend URL (e.g., tunnel URL)
   - Connection name
   - Auth token (optional)
   - "Connect to Backend" button
   - Help tip for cloudflared tunnel

3. **I have a server** (WifiHigh icon)
   - SSH connection form
   - Test connection + Install backend

4. **Get a cloud server** (Cloud icon)
   - VPS provider recommendations

5. **Remote desktop** (Desktop icon)
   - WebRTC remote control

## User Flow for Your Setup

Your backend is running on port 4096 with a tunnel.

### Option A: Local Backend (if on same machine)
1. Select **"Use this computer"**
2. Should auto-detect `http://localhost:4096`
3. Click **"Activate"**

### Option B: Tunnel URL (recommended for testing)
1. Select **"Enter backend URL"**
2. Fill in:
   - URL: `https://molecules-dsc-specifications-dangerous.trycloudflare.com`
   - Name: `MacBook Test`
   - Token: `Basic Z2l6emk6YzVkNDY1NmU3ZjM3NTNiYzBkODk5NmQ0ZGJlYmY0OGNlY2JkNzM2MmJlMDZlNjBm`
3. Click **"Connect to Backend"**

## Deploy Status

| Commit | `5f058771` |
|--------|------------|
| Status | ✅ Pushed to GitHub |
| Build | ⏳ Deploying to Vercel (2-3 min) |

## Files Changed

- `OnboardingFlow.tsx` - Added manual backend option and form
- `InfrastructureStep.tsx` - Local backend auto-detection
- `runtime-backend.ts` - API client for manual registration

## Testing

1. Wait for Vercel deployment
2. Go to https://platform.allternit.com
3. Start onboarding
4. Select infrastructure option
5. Complete connection
