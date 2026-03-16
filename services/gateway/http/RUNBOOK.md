# A2R Gateway - Kernel Wiring Proof Runbook

**Purpose:** Prove end-to-end kernel wiring in <5 minutes

**Version:** 1.0.0  
**Date:** 2024-02-23

---

## Acceptance Tests (Must Pass All)

1. ✅ **UI submit triggers exactly one kernel run** (prove via kernel adapter log with run_id)
2. ✅ **Streamed PART_DELTA events originate ONLY from kernel** (enforce via assertion)
3. ✅ **Session persists and reloads** (refresh UI loads same session/messages)

---

## Prerequisites

- Node.js 18+ installed
- A2R Gateway running on port 3210
- A2R UI (6-ui/a2r-platform) running on port 5177

---

## Step 1: Start Gateway

```bash
cd /Users/macbook/Desktop/a2rchitech-workspace/a2rchitech/4-services/a2r-gateway

# Install if needed
npm install

# Start gateway (HTTP mode)
npm run dev:http
```

**Expected Output:**
```
[HttpTransport] Starting...
[GatewayCore] Initialized
[HttpTransport] Listening on 0.0.0.0:3210
```

**Verify:**
```bash
curl http://localhost:3210/health
# Should return: {"status":"healthy","service":"a2r-gateway",...}
```

---

## Step 2: Start UI

```bash
cd /Users/macbook/Desktop/a2rchitech-workspace/a2rchitech/6-ui/a2r-platform

# Install if needed
npm install

# Start UI dev server
npm run dev
```

**Expected Output:**
```
[A2R API Client] Using gateway URL: http://127.0.0.1:3210
VITE v5.x.x  ready in xxx ms

➜  Local:   http://localhost:5177/
```

**Verify:**
- Open browser to `http://localhost:5177/`
- Open DevTools Console
- Look for: `[A2R API Client] Using gateway URL: http://127.0.0.1:3210`

---

## Step 3: Create Session

In the UI:
1. Click "New Session" or navigate to chat
2. Observe DevTools Network tab for: `POST /session`

**Expected Gateway Log:**
```
[KERNEL] KERNEL_RUN run_id=run_1708732800000_abc123 session=sess_xxx directory=* model=default text_length=0
```

---

## Step 4: Submit Prompt

In the UI:
1. Type a message: "Hello, this is a test"
2. Press Enter
3. Watch DevTools Console for SSE events

**Expected Gateway Log:**
```
[KERNEL] KERNEL_RUN run_id=run_1708732800000_def456 session=sess_xxx directory=* model=default text_length=26
[KERNEL] KERNEL_RUN_COMPLETE run_id=run_1708732800000_def456 session=sess_xxx
```

**Expected SSE Events (in order):**
```
event: message
data: {"directory":"*","payload":{"type":"MESSAGE_CREATED",...}}

event: message
data: {"directory":"*","payload":{"type":"PART_CREATED",...}}

event: message
data: {"directory":"*","payload":{"type":"PART_DELTA","data":{"_source":"kernel",...}}}

event: message
data: {"directory":"*","payload":{"type":"PART_DELTA",...}}
...

event: message
data: {"directory":"*","payload":{"type":"PART_UPDATED",...}}

event: message
data: {"directory":"*","payload":{"type":"MESSAGE_UPDATED",...}}
```

---

## Step 5: Verify Kernel-Only Delta Enforcement

**Test:** The gateway should throw if PART_DELTA is emitted without `_source: 'kernel'`

**Verify:** No errors in gateway console like:
```
KERNEL-ONLY VIOLATION: PART_DELTA emitted without source=kernel
```

If you see this error, it means something OTHER than the kernel is emitting deltas (which is a bug).

---

## Step 6: Verify Session Persistence

1. Wait for response to complete
2. Refresh the browser page
3. Navigate back to the session

**Expected:**
- Session loads with the same messages
- No "Session not found" errors

**Verify via API:**
```bash
# Get session
curl http://localhost:3210/session/SESSION_ID

# Get messages
curl http://localhost:3210/session/SESSION_ID/message
```

---

## Troubleshooting

### UI shows "Failed to connect"

**Check:**
1. Gateway is running on port 3210
2. No firewall blocking localhost
3. UI env var `VITE_A2R_GATEWAY_URL` is set correctly

### No KERNEL_RUN logs appear

**Check:**
1. UI is pointing to correct gateway URL (check console log)
2. Gateway is receiving requests (check gateway logs)
3. Route `/session/:id/prompt_async` is being called

### KERNEL-ONLY VIOLATION error

**This is a BUG.** Something is emitting PART_DELTA outside the kernel adapter.

**Fix:**
1. Search codebase for `part.delta` emissions
2. Ensure ALL go through `kernel._publish()`
3. Remove any direct `eventBus.emit()` calls

---

## Success Criteria Checklist

- [ ] Gateway starts on port 3210
- [ ] UI connects and shows `[A2R API Client] Using gateway URL: http://127.0.0.1:3210`
- [ ] KERNEL_RUN log appears for each prompt submit
- [ ] KERNEL_RUN_COMPLETE log appears after streaming
- [ ] SSE events show `_source: 'kernel'` in PART_DELTA
- [ ] No KERNEL-ONLY VIOLATION errors
- [ ] Session persists after refresh

---

## Quick Test Commands

```bash
# Test gateway health
curl http://localhost:3210/health

# Test SSE connection
curl -N http://localhost:3210/global/event

# Test session creation
curl -X POST http://localhost:3210/session \
  -H "Content-Type: application/json" \
  -d '{"profile_id":"test","directory":"/test"}'
```

---

**Maintainer:** A2R Platform Team  
**Last Updated:** 2024-02-23
