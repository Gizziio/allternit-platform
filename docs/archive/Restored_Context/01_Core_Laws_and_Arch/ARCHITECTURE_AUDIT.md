# Senior Engineer Architecture Audit Report

## Executive Summary

**Overall Status:** Functional but with **CRITICAL GAPS** in production readiness  
**Recommendation:** Address P0 and P1 issues before production deployment

---

## 🔴 P0 - CRITICAL GAPS (Must Fix Before Production)

### 1. Cost Tracking Background Task NOT Started
**File:** `cloud/allternit-workspace/allternit/cloud/allternit-cloud-api/src/main.rs`

**Problem:** The `start_cost_tracking_task()` function exists but is never called. This means:
- Running instance costs are never updated
- Budget alerts are never sent
- User costs are never finalized

**Fix:** Add to main.rs:
```rust
// Start cost tracking background task
tokio::spawn(async move {
    start_cost_tracking_task(db.clone()).await;
});
```

---

### 2. Cost API Routes Commented Out
**File:** `cloud/allternit-workspace/allternit/cloud/allternit-cloud-api/src/lib.rs:118-126`

**Problem:** All cost endpoints are commented out:
- `GET /api/v1/runs/:id/cost`
- `GET /api/v1/costs/summary`
- `GET /api/v1/costs/budget`
- etc.

**Impact:** Users cannot view costs or budgets despite cost tracking being implemented.

**Fix:** Uncomment the routes in `create_router()`.

---

### 3. CORS Security Misconfiguration
**File:** `cloud/allternit-workspace/allternit/cloud/allternit-cloud-api/src/lib.rs:168`

**Problem:** `CorsLayer::permissive()` allows:
- Any origin (`*`)
- Any method
- Any headers
- Credentials from any origin

**Security Risk:** CSRF attacks, credential theft in production.

**Fix:** Configure specific origins:
```rust
.layer(
    CorsLayer::new()
        .allow_origin(["https://app.allternit.com".parse().unwrap()])
        .allow_methods([Method::GET, Method::POST, ...])
        .allow_headers([header::CONTENT_TYPE, header::AUTHORIZATION])
)
```

---

### 4. No Request Size Limits
**File:** `cloud/allternit-workspace/allternit/cloud/allternit-cloud-api/src/lib.rs`

**Problem:** No request body size limits configured.

**Risk:** DoS attacks via large request bodies.

**Fix:** Add `DefaultBodyLimit` layer:
```rust
.layer(DefaultBodyLimit::max(1024 * 1024 * 10)) // 10MB
```

---

### 5. Missing Request Timeout
**Problem:** No global request timeout configured.

**Risk:** Hanging connections exhausting resources.

**Fix:** Add timeout layer from `tower_http`.

---

## 🟡 P1 - HIGH PRIORITY GAPS

### 6. Inefficient Cost Service Instantiation
**File:** `cloud/allternit-workspace/allternit/cloud/allternit-cloud-api/src/routes/costs.rs`

**Problem:** Each route handler creates a new `CostServiceImpl`:
```rust
let service = CostServiceImpl::new(state.db.clone());
```

**Impact:** Unnecessary database connection overhead.

**Fix:** Add `cost_service` to `ApiState` and share it.

---

### 7. No Structured Logging Configuration
**File:** `cloud/allternit-workspace/allternit/cloud/allternit-cloud-api/src/main.rs:12`

**Problem:** Using default fmt subscriber without configuration.

**Impact:** No JSON logging for production, no log levels, no filtering.

**Fix:** Configure tracing with JSON format and environment-based filters.

---

### 8. Hardcoded Default URLs
**File:** `cloud/allternit-workspace/allternit/cloud/allternit-cloud-api/src/main.rs:15-18`

**Problem:**
```rust
let database_url = std::env::var("DATABASE_URL")
    .unwrap_or_else(|_| "sqlite://allternit-cloud.db".to_string());
```

**Risk:** Production could accidentally use SQLite instead of PostgreSQL.

**Fix:** Fail hard if required env vars not set in production.

---

### 9. No Graceful Shutdown
**Problem:** No graceful shutdown handling for:
- In-flight requests
- Background tasks
- Database connections
- WebSocket connections

**Fix:** Implement shutdown signal handling with `tokio::select!`.

---

### 10. WebSocket Auth Only Via Query Params
**File:** `cloud/allternit-workspace/allternit/cloud/allternit-cloud-api/src/websocket/mod.rs`

**Problem:** WebSocket auth only supports `?token=` query param, no header support.

**Impact:** Some WebSocket clients can't pass auth tokens securely.

**Fix:** Support both query param and `Sec-WebSocket-Protocol` header.

---

## 🟠 P2 - MEDIUM PRIORITY GAPS

### 11. No Connection Pooling Configuration
**Problem:** SQLx pool uses default configuration.

**Impact:** Potential performance issues under load.

**Fix:** Configure pool size, timeouts, etc.

---

### 12. Scheduler Not Integrated with Cost Service
**Problem:** Scheduler creates runs but doesn't initialize cost tracking.

**Fix:** Call `init_run_cost_tracking()` in scheduler when creating runs.

---

### 13. No API Versioning Strategy
**Problem:** All routes are `/api/v1/` but no strategy for v2.

**Recommendation:** Consider versioning approach (URL vs header).

---

### 14. Missing Input Validation
**Problem:** Many request fields lack validation:
- String length limits
- Enum value validation
- Sanitization

**Examples:**
- Run names could be 1000 characters
- No email validation
- No SQL injection protection (though SQLx helps)

---

### 15. Error Responses Leak Implementation Details
**Problem:** Some error messages include internal details.

**Example:** Database error messages returned to client.

**Fix:** Map internal errors to generic user-facing messages.

---

## 🔵 P3 - LOW PRIORITY / NICE TO HAVE

### 16. No OpenAPI/Swagger Documentation
**Impact:** API consumers lack documentation.

**Fix:** Add `utoipa` for OpenAPI generation.

---

### 17. No Distributed Tracing
**Impact:** Hard to trace requests across services.

**Fix:** Add OpenTelemetry integration.

---

### 18. In-Memory Rate Limiter Won't Scale
**File:** `cloud/allternit-workspace/allternit/cloud/allternit-cloud-api/src/middleware/rate_limit.rs`

**Problem:** Rate limiter uses `HashMap` in memory.

**Impact:** Won't work across multiple API server instances.

**Fix:** Use Redis for distributed rate limiting (when scaling needed).

---

### 19. No Database Connection Retries
**Problem:** If DB is temporarily unavailable, queries fail immediately.

**Fix:** Add retry logic with exponential backoff.

---

### 20. Cloud Runtime Only Supports Hetzner
**Problem:** AWS runtime is stubbed but not implemented.

**Impact:** Users can't use AWS for cloud runs.

---

## 📊 Summary Statistics

| Category | Count |
|----------|-------|
| P0 - Critical | 5 |
| P1 - High | 5 |
| P2 - Medium | 5 |
| P3 - Low | 5 |
| **Total** | **20** |

---

## 🎯 Recommended Action Plan

### Week 1 (Critical)
1. Start cost tracking background task
2. Uncomment and enable cost API routes
3. Fix CORS configuration
4. Add request size limits
5. Add request timeouts

### Week 2 (High Priority)
6. Add cost_service to ApiState
7. Configure structured JSON logging
8. Add graceful shutdown handling
9. Implement WebSocket auth headers
10. Add input validation

### Week 3 (Medium Priority)
11. Configure connection pooling
12. Integrate scheduler with cost service
13. Add OpenAPI documentation
14. Implement AWS cloud runtime

---

## ✅ What's Working Well

1. **Architecture:** Clean separation of concerns
2. **Database:** Proper migrations and models
3. **Event System:** Event store and broadcasting works
4. **Runtime Abstraction:** Good trait-based design
5. **Auth:** Token validation against database
6. **Scheduler:** Cron-based scheduling with multi-region
7. **SSH Integration:** Real SSH for remote execution
8. **VM Bridge:** QEMU/KVM integration for local runs
9. **Error Types:** Comprehensive error enum
10. **Testing:** Unit tests present

---

*Audit conducted by: Senior Software Engineer*  
*Date: 2024*  
*Scope: Allternit Cloud API & CLI*
