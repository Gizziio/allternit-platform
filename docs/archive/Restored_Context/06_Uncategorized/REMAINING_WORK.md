# Remaining Work for Cowork Runtime

## 🔴 CRITICAL - Needs Implementation

### 1. Instance Management Routes (High Priority)
**File:** `cloud/allternit-cloud-api/src/routes/instances.rs`

Current state: Returns demo data and "not implemented" errors

Needs:
- [ ] `list_instances` - Query cloud instances from database
- [ ] `get_instance` - Get specific instance by ID
- [ ] `restart_instance` - Restart cloud instance via provider API
- [ ] `destroy_instance` - Destroy cloud instance via provider API

Database table `cloud_instances` needs to be created to track provisioned instances.

---

### 2. VM Bridge for Local Runtime (Medium Priority)
**File:** `cloud/allternit-cloud-api/src/runtime/local_runtime.rs`

Current state: Falls back to mock mode if VM bridge unavailable

Needs:
- [ ] VM Bridge implementation for actual VM lifecycle management
- [ ] QEMU/KVM integration for local VM execution
- [ ] Guest agent for VM communication

---

### 3. WebSocket Real-time Events (Medium Priority)
**File:** `cloud/allternit-cloud-api/src/websocket/`

Current state: Basic WebSocket handler exists

Needs:
- [ ] Full WebSocket event streaming implementation
- [ ] Authentication for WebSocket connections
- [ ] Heartbeat/ping-pong handling

---

## 🟡 IMPORTANT - Production Readiness

### 4. Enhanced Error Handling & Logging
- [ ] Structured logging with correlation IDs
- [ ] Error metrics and alerting hooks
- [ ] Request/response logging middleware

### 5. Rate Limiting
- [ ] API rate limiting per token/user
- [ ] WebSocket connection limits

### 6. Health Checks & Monitoring
- [ ] `/health` endpoint with DB connectivity check
- [ ] `/ready` endpoint for Kubernetes
- [ ] Metrics endpoint for Prometheus

---

## 🟢 NICE TO HAVE - Future Enhancements

### 7. Multi-Region Support
- [ ] Region-aware scheduler
- [ ] Cross-region run migration

### 8. Advanced Scheduling
- [ ] Job dependencies
- [ ] Workflow DAG execution
- [ ] Retry policies with backoff

### 9. Cost Management
- [ ] Cost tracking per run
- [ ] Budget alerts
- [ ] Instance auto-termination for idle runs

---

## 📋 COMPLETED ✅

- [x] Auth Models & DB Schema
- [x] Event Store in Job Routes  
- [x] DB Performance Indexes
- [x] CLI WebSocket/SSE Streaming
- [x] Scheduler Integration with real cron parser
- [x] Auth Context Extraction in all routes
- [x] RemoteRuntime with real SSH
- [x] CloudRuntime with real Hetzner API
- [x] Checkpoint Resume Logic

---

## Summary

**For MVP Launch:** Focus on #1 (Instance Management) and #6 (Health Checks)

**Current Status:** Core runtime is production-ready. Missing cloud instance lifecycle management and monitoring endpoints.
