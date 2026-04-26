# Allternit Gateway Networking Architecture - Implementation Report

## Overview

This PR implements the Allternit Gateway networking architecture, consolidating all UI communication through a single gateway endpoint at `http://127.0.0.1:3210`. The gateway provides REST API proxying and SSE event streaming, eliminating scattered localhost/port usage.

---

## Files Changed

### New Files

| File | Purpose |
|------|---------|
| `spec/Networking.md` | Allternit Shell Protocol v1 specification document |
| `services/allternit-gateway/package.json` | Gateway service package configuration |
| `services/allternit-gateway/src/index.js` | Fastify gateway implementation |
| `services/allternit-gateway/vitest.config.js` | Test configuration |
| `services/allternit-gateway/tests/contract.test.js` | Contract tests for endpoints and SSE |
| `services/allternit-gateway/tests/smoke.test.js` | End-to-end smoke tests |
| `services/allternit-gateway/scripts/verify-gateway.js` | Gateway verification script |
| `surfaces/allternit-platform/src/network/index.ts` | UI network adapter with ALLTERNIT_BASE_URL |
| `surfaces/allternit-platform/src/network/adapters/VoiceServiceAdapter.ts` | Voice service adapter |
| `surfaces/allternit-platform/.env.example` | Updated environment configuration |

---

## Implementation Details

### 1. Allternit Shell Protocol v1 Specification (`spec/Networking.md`)

**Why:** Establishes the canonical protocol for all gateway communication.

**Key Sections:**
- Architecture diagram showing UI → Gateway → Services flow
- REST endpoint definitions with request/response schemas
- SSE event taxonomy with ordering guarantees
- Error handling and rate limiting specifications
- Migration guide for existing code

### 2. Fastify Gateway (`services/allternit-gateway/src/index.js`)

**Why:** Provides a single entry point for all UI traffic with clean shutdown support.

**Features:**
- **Single Base URL:** All requests go through `http://127.0.0.1:3210`
- **REST Proxying:** Routes requests to internal services based on path
- **SSE Streaming:** `/v1/events` and `/v1/events-http` for real-time events
- **Request Tracing:** X-Request-ID headers for distributed tracing
- **Rate Limiting:** 120 requests/minute with configurable limits
- **CORS:** Configurable origins with credentials support
- **Health Checks:** Periodic backend health monitoring
- **Graceful Shutdown:** Notifies SSE clients before closing

**Routing Logic:**
```
/v1/voice/*      → Voice Service (8001)
/v1/operator/*   → Operator Service (3010)
/v1/rails/*      → Rails Service (3011)
/v1/*            → API Service (3000)
```

### 3. UI Network Adapter (`surfaces/allternit-platform/src/network/index.ts`)

**Why:** Single source of truth for all UI networking.

**Exports:**
- `ALLTERNIT_BASE_URL` - The single configuration constant
- `allternitFetch()` - HTTP client with retries and tracing
- `createSSEConnection()` - SSE client with auto-reconnect
- `get()`, `post()`, `put()`, `patch()`, `del()` - Convenience methods
- `checkHealth()`, `getDiscovery()` - Gateway status methods

**Usage:**
```typescript
import { ALLTERNIT_BASE_URL, post, createSSEConnection } from '@allternit/network';

// REST request
const response = await post('/v1/chat/completions', { messages: [...] });

// SSE connection
const sse = createSSEConnection();
sse.on('message', (event) => console.log(event.data));
```

### 4. Contract Tests (`services/allternit-gateway/tests/contract.test.js`)

**Why:** Verifies gateway conforms to protocol specification.

**Test Coverage:**
- Health endpoint responses
- Discovery endpoint structure
- SSE connection and event parsing
- SSE event ordering (connected → ... → done/error)
- Request tracing headers
- CORS headers
- Rate limit headers
- Error response format
- Proxy routing verification

### 5. Smoke Tests (`services/allternit-gateway/tests/smoke.test.js`)

**Why:** End-to-end verification of complete flows.

**Test Scenarios:**
- Boot UI → Send Message → Stream Response flow
- Concurrent request handling
- SSE heartbeat verification
- Malformed request handling
- Missing body handling

---

## How to Verify

### 1. Install Dependencies

```bash
cd services/allternit-gateway
npm install
```

### 2. Start the Gateway

```bash
# Development mode with auto-reload
npm run dev

# Or production mode
npm start
```

### 3. Run Verification Script

```bash
# In a new terminal
node scripts/verify-gateway.js
```

Expected output:
```
🔍 Allternit Gateway Verification
==================================================
Gateway URL: http://127.0.0.1:3210

Test 1: Health Check (/health)
  ✅ PASS: Gateway is healthy

Test 2: Discovery Endpoint (/v1/discovery)
  ✅ PASS: Discovery returned 7 services
    - api: healthy
    - kernel: healthy
    ...

Test 3: SSE Endpoint (/v1/events-http)
  ✅ PASS: SSE endpoint returns correct content-type
  ✅ PASS: SSE connection event received

...

Summary:
  ✅ Passed: 10

🎉 All tests passed! Gateway is ready.
```

### 4. Run Contract Tests

```bash
npm test
```

### 5. Run Smoke Tests

```bash
# Ensure gateway is running, then:
npm test -- tests/smoke.test.js
```

---

## Commands Reference

### Development

```bash
# Start gateway in development mode
cd services/allternit-gateway && npm run dev

# Start gateway in production mode
cd services/allternit-gateway && npm start

# Run verification
node scripts/verify-gateway.js
```

### Testing

```bash
# Run all tests
cd services/allternit-gateway && npm test

# Run contract tests only
npm test -- tests/contract.test.js

# Run smoke tests only
npm test -- tests/smoke.test.js

# Run tests in watch mode
npm run test:watch
```

### Environment Variables

```bash
# Gateway configuration
export ALLTERNIT_GATEWAY_PORT=3210
export ALLTERNIT_GATEWAY_HOST=0.0.0.0

# Backend services
export ALLTERNIT_API_URL=http://127.0.0.1:3000
export ALLTERNIT_VOICE_URL=http://127.0.0.1:8001
export ALLTERNIT_OPERATOR_URL=http://127.0.0.1:3010
export ALLTERNIT_RAILS_URL=http://127.0.0.1:3011

# CORS
export ALLTERNIT_CORS_ORIGINS=http://localhost:5177,http://127.0.0.1:5177

# Rate limiting
export ALLTERNIT_RATE_LIMIT_MAX=120
export ALLTERNIT_RATE_LIMIT_WINDOW=60000
```

---

## Migration Path

### For UI Developers

**Before:**
```typescript
const API_URL = 'http://localhost:3000';
const VOICE_URL = 'http://localhost:8001';

fetch(`${API_URL}/v1/chat/completions`, {...});
fetch(`${VOICE_URL}/v1/voice/tts`, {...});
```

**After:**
```typescript
import { ALLTERNIT_BASE_URL, post } from '@allternit/network';

// All requests go through gateway
await post('/v1/chat/completions', {...});
await post('/v1/voice/tts', {...});
```

### For Service Owners

No changes required initially. The gateway proxies requests to existing services.

Optional improvements:
1. Update service health endpoints to return standardized format
2. Add X-Request-ID propagation in service logs
3. Configure services to accept X-User-ID headers from gateway

---

## Backward Compatibility

The existing Python gateway (`services/gateway/src/main.py`) remains functional during migration. Both gateways can run simultaneously on different ports:
- Python Gateway: Port 8013
- Fastify Gateway: Port 3210

Update UI configuration to use the new gateway:
```
VITE_ALLTERNIT_BASE_URL=http://127.0.0.1:3210
```

---

## Testing Checklist

- [ ] Gateway starts without errors
- [ ] Health endpoint returns healthy status
- [ ] Discovery endpoint lists all services
- [ ] SSE connection establishes successfully
- [ ] SSE events follow correct ordering
- [ ] Request tracing headers present
- [ ] CORS headers configured correctly
- [ ] Rate limiting headers present
- [ ] Proxy routing works for all services
- [ ] Graceful shutdown notifies SSE clients
- [ ] Contract tests pass
- [ ] Smoke tests pass

---

## Next Steps

1. **Update UI Applications:** Replace scattered URL configurations with `ALLTERNIT_BASE_URL`
2. **Enable Authentication:** Implement JWT validation in gateway middleware
3. **Add Metrics:** Integrate Prometheus metrics for gateway monitoring
4. **SSL/TLS:** Add HTTPS support for production deployments
5. **Load Balancing:** Add support for multiple backend instances

---

## Related Documentation

- [Allternit Shell Protocol v1](../spec/Networking.md) - Full protocol specification
- [Gateway README](../services/allternit-gateway/README.md) - Service documentation

---

**Author:** Systems Architect  
**Date:** 2024-02-22  
**Version:** 1.0.0
