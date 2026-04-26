# Allternit PLATFORM - PRODUCTION DEPLOYMENT GUIDE

> **Complete guide for preparing, configuring, and deploying Allternit Platform to production**

---

## Table of Contents

1. [Current Issues to Fix](#current-issues-to-fix)
2. [Pre-Production Checklist](#pre-production-checklist)
3. [Code Base Changes Required](#code-base-changes-required)
4. [Infrastructure Setup](#infrastructure-setup)
5. [Configuration Management](#configuration-management)
6. [Deployment Options](#deployment-options)
7. [Post-Deployment Verification](#post-deployment-verification)
8. [Monitoring & Maintenance](#monitoring--maintenance)

---

## Current Issues to Fix

### 🔴 CRITICAL - Must Fix Before Production

#### 1. Port Conflicts Between Services

**Problem:** Multiple services may attempt to bind to the same ports.

**Current State:**
| Service | Configured Port | Actual Port | Conflict |
|---------|----------------|-------------|----------|
| Main Gateway | 8013 | 8013 | ✅ OK |
| AGUI Gateway | 8010 | 8010 | ✅ OK |
| A2A Gateway | 8012 | 8012 | ✅ OK |
| Kernel | 3004 | 3004 | ✅ OK |
| API | 3000 | 3000 | ✅ OK |

**Fix Required:**
- ✅ Port registry created: `docs/PORT_REGISTRY.md`
- ✅ Centralized config: `dev/scripts/service-config.sh`
- ⚠️ **TODO:** Update each service to read from environment variables

**Action Items:**
```bash
# 1. Verify each service reads PORT from environment
grep -r "PORT.*=" 4-services/ 7-apps/ --include="*.rs" --include="*.py" --include="*.ts"

# 2. Update services that hardcode ports
# See: Code Base Changes Required section below
```

---

#### 2. Database Migration System

**Problem:** SQLite database schema changes may break between versions.

**Current State:**
- Database: `./allternit.db`
- No migration system in place
- Schema changes require manual intervention

**Fix Required:**
```bash
# Create migrations directory
mkdir -p 7-apps/api/migrations

# Create migration runner
cat > 7-apps/api/migrations/README.md << 'EOF'
# Database Migrations

## Running Migrations
./migrate.sh up    # Apply all pending migrations
./migrate.sh down  # Rollback last migration
./migrate.sh status # Show migration status
EOF
```

**Action Items:**
- [ ] Implement SQL migration system (like Diesel migrations for Rust)
- [ ] Add migration version tracking table
- [ ] Create rollback scripts
- [ ] Test migration path from v0.1 → v1.0

---

#### 3. Service Health Checks

**Problem:** No standardized health check endpoints across all services.

**Current State:**
- API Service: `/health` ✅
- Other services: Unknown/Inconsistent

**Fix Required:**
```rust
// Add to each Rust service (src/main.rs)
async fn health_check() -> impl Responder {
    web::Json(json!({
        "status": "healthy",
        "service": env!("CARGO_PKG_NAME"),
        "version": env!("CARGO_PKG_VERSION"),
        "timestamp": Utc::now()
    }))
}
```

```python
# Add to each Python service
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "voice-service",
        "version": "1.0.0",
        "timestamp": datetime.utcnow().isoformat()
    }
```

**Action Items:**
- [ ] Add `/health` endpoint to all services
- [ ] Add `/ready` endpoint (checks dependencies)
- [ ] Add `/live` endpoint (liveness probe)
- [ ] Create health check aggregator in Gateway

---

#### 4. Logging Standardization

**Problem:** Inconsistent logging formats across services.

**Current State:**
- Rust services: `tracing` crate (structured)
- Python services: `logging` module (varies)
- TypeScript services: `console.log` (unstructured)

**Fix Required:**
```json
{
  "timestamp": "2026-02-26T21:30:00Z",
  "level": "INFO",
  "service": "api-service",
  "trace_id": "abc123",
  "span_id": "def456",
  "message": "Request processed",
  "context": {
    "method": "POST",
    "path": "/api/v1/chat",
    "duration_ms": 150
  }
}
```

**Action Items:**
- [ ] Configure structured logging for all Rust services
- [ ] Add JSON formatter to Python services
- [ ] Replace console.log with structured logger in TypeScript
- [ ] Set up log aggregation (ELK stack or similar)

---

#### 5. Configuration Management

**Problem:** Configuration scattered across `.env` files, code, and command-line args.

**Fix Required:**
```bash
# Create centralized config directory
mkdir -p config/production
mkdir -p config/staging
mkdir -p config/development

# Create config validator
cat > scripts/validate-config.sh << 'EOF'
#!/bin/bash
# Validate all required config values are present
REQUIRED_VARS=(
    "Allternit_API_PORT"
    "Allternit_KERNEL_PORT"
    "DATABASE_URL"
    "SECRET_KEY"
)

for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        echo "ERROR: Required variable $var not set"
        exit 1
    fi
done
echo "Configuration valid"
EOF
```

---

### 🟡 HIGH PRIORITY - Should Fix Before Production

#### 6. Error Handling & Recovery

**Action Items:**
- [ ] Add retry logic with exponential backoff
- [ ] Implement circuit breakers for external services
- [ ] Create dead letter queue for failed jobs
- [ ] Add graceful shutdown handlers

#### 7. Rate Limiting

**Action Items:**
- [ ] Implement rate limiting at Gateway level
- [ ] Add per-user rate limits
- [ ] Add per-IP rate limits
- [ ] Create rate limit bypass for internal services

#### 8. Authentication & Authorization

**Action Items:**
- [ ] Implement JWT token validation at Gateway
- [ ] Add API key management
- [ ] Create service-to-service auth (mTLS)
- [ ] Add RBAC (Role-Based Access Control)

#### 9. Secret Management

**Action Items:**
- [ ] Move secrets out of `.env` files
- [ ] Use AWS Secrets Manager / HashiCorp Vault
- [ ] Implement secret rotation
- [ ] Add secret access auditing

---

## Pre-Production Checklist

### Code Quality

- [ ] All services have unit tests with >80% coverage
- [ ] Integration tests pass for all service combinations
- [ ] Load testing completed (target: 1000 req/s)
- [ ] Security audit completed
- [ ] Code review completed by 2+ engineers

### Infrastructure

- [ ] Production environment provisioned
- [ ] Database backups configured (hourly + daily)
- [ ] Monitoring stack deployed (Prometheus + Grafana)
- [ ] Log aggregation configured
- [ ] SSL certificates provisioned
- [ ] CDN configured for static assets

### Configuration

- [ ] Production config files created
- [ ] All secrets migrated to secret manager
- [ ] Environment variables documented
- [ ] Feature flags configured

### Documentation

- [ ] API documentation generated and published
- [ ] Runbooks created for common issues
- [ ] Incident response plan documented
- [ ] On-call rotation schedule created

---

## Code Base Changes Required

### 1. Update Service Port Configuration

**File:** `7-apps/api/src/main.rs`
```rust
// BEFORE (hardcoded)
let addr = "127.0.0.1:3000";

// AFTER (from environment)
let port = std::env::var("Allternit_API_PORT").unwrap_or_else(|_| "3000".to_string());
let host = std::env::var("Allternit_API_HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
let addr = format!("{}:{}", host, port);
```

**File:** `4-services/gateway/src/main.py`
```python
# BEFORE
PORT = 8013

# AFTER
PORT = int(os.environ.get("Allternit_GATEWAY_PORT", "8013"))
HOST = os.environ.get("Allternit_GATEWAY_HOST", "127.0.0.1")
```

**File:** `4-services/gateway/agui-gateway/src/index.ts`
```typescript
// BEFORE
const PORT = process.env.PORT || 8010;

// AFTER
const PORT = parseInt(process.env.Allternit_AGUI_PORT || "8010", 10);
const HOST = process.env.Allternit_AGUI_HOST || "127.0.0.1";
```

---

### 2. Add Health Check Endpoints

**File:** `7-apps/api/src/main.rs` (add to routes)
```rust
async fn health_check(
    kernel_url: web::Data<String>,
    memory_url: web::Data<String>,
) -> impl Responder {
    // Check dependencies
    let kernel_healthy = reqwest::get(&format!("{}/health", kernel_url))
        .await
        .map(|r| r.status().is_success())
        .unwrap_or(false);
    
    let memory_healthy = reqwest::get(&format!("{}/health", memory_url))
        .await
        .map(|r| r.status().is_success())
        .unwrap_or(false);
    
    let status = if kernel_healthy && memory_healthy { "healthy" } else { "degraded" };
    
    web::Json(json!({
        "status": status,
        "service": "api",
        "version": env!("CARGO_PKG_VERSION"),
        "dependencies": {
            "kernel": kernel_healthy,
            "memory": memory_healthy
        }
    }))
}
```

---

### 3. Add Graceful Shutdown

**File:** `7-apps/api/src/main.rs`
```rust
use tokio::signal;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // ... setup code ...
    
    let (tx, rx) = tokio::sync::oneshot::channel();
    
    // Spawn shutdown handler
    tokio::spawn(async move {
        let ctrl_c = async {
            signal::ctrl_c()
                .await
                .expect("failed to install Ctrl+C handler");
        };
        
        #[cfg(unix)]
        let terminate = async {
            signal::unix::signal(signal::unix::SignalKind::terminate())
                .expect("failed to install signal handler")
                .recv()
                .await;
        };
        
        #[cfg(not(unix))]
        let terminate = std::future::pending::<()>();
        
        tokio::select! {
            _ = ctrl_c => {},
            _ = terminate => {},
        }
        
        let _ = tx.send(());
    });
    
    // ... server code ...
    
    let server = axum::serve(listener, app).with_graceful_shutdown(async {
        rx.await.ok();
        tracing::info!("Shutting down gracefully...");
    });
    
    server.await?;
    
    Ok(())
}
```

---

### 4. Add Structured Logging

**File:** `7-apps/api/src/main.rs`
```rust
use tracing_subscriber::{fmt, prelude::*, EnvFilter};

fn init_logging() {
    let fmt_layer = fmt::layer()
        .with_target(false)
        .with_thread_ids(true)
        .with_file(true)
        .with_line_number(true)
        .json(); // JSON format for production
    
    let filter_layer = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info,allternit_api=debug"));
    
    tracing_subscriber::registry()
        .with(filter_layer)
        .with(fmt_layer)
        .init();
}
```

---

### 5. Create Configuration Module

**File:** `7-apps/api/src/config.rs` (new file)
```rust
use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
pub struct Config {
    pub host: String,
    pub port: u16,
    pub kernel_url: String,
    pub memory_url: String,
    pub registry_url: String,
    pub policy_url: String,
    pub database_url: String,
    pub log_level: String,
    pub environment: Environment,
}

#[derive(Debug, Clone, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Environment {
    Development,
    Staging,
    Production,
}

impl Config {
    pub fn from_env() -> Result<Self, config::ConfigError> {
        let config = config::Config::builder()
            .add_source(config::Environment::with_prefix("Allternit").separator("__"))
            .add_source(config::File::with_name("config/base").required(false))
            .add_source(config::File::with_name("config/production").required(false))
            .build()?;
        
        config.try_deserialize()
    }
    
    pub fn is_production(&self) -> bool {
        self.environment == Environment::Production
    }
}
```

---

## Infrastructure Setup

### Option 1: Single Server Deployment

**Best for:** Small teams, low traffic (<10k requests/day)

```bash
# Server Requirements
- CPU: 4 cores minimum (8 recommended)
- RAM: 16GB minimum (32GB recommended)
- Disk: 100GB SSD minimum
- OS: Ubuntu 22.04 LTS or macOS 14+

# Installation Steps
1. Install system dependencies
   sudo apt update
   sudo apt install -y curl git build-essential pkg-config libssl-dev

2. Install Rust
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

3. Install Python 3.11+
   sudo apt install -y python3.11 python3.11-venv python3-pip

4. Install Node.js 18+
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt install -y nodejs

5. Clone repository
   git clone https://github.com/your-org/allternit.git
   cd allternit

6. Build services
   ./start-platform.sh build

7. Configure systemd services
   sudo cp distribution/systemd/*.service /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable allternit-api allternit-kernel allternit-gateway

8. Start services
   sudo systemctl start allternit-api allternit-kernel allternit-gateway
```

---

### Option 2: Docker Compose Deployment

**Best for:** Medium teams, medium traffic (<100k requests/day)

**File:** `docker-compose.production.yml`
```yaml
version: '3.8'

services:
  gateway:
    build:
      context: .
      dockerfile: 4-services/gateway/Dockerfile
    ports:
      - "8013:8013"
    environment:
      - Allternit_GATEWAY_PORT=8013
      - Allternit_API_URL=http://api:3000
    depends_on:
      - api
    networks:
      - allternit-network
    restart: unless-stopped

  api:
    build:
      context: .
      dockerfile: 7-apps/api/Dockerfile
    environment:
      - Allternit_API_PORT=3000
      - Allternit_KERNEL_URL=http://kernel:3004
      - Allternit_MEMORY_URL=http://memory:3200
      - DATABASE_URL=/data/allternit.db
    volumes:
      - api-data:/data
    depends_on:
      - kernel
      - memory
    networks:
      - allternit-network
    restart: unless-stopped

  kernel:
    build:
      context: .
      dockerfile: 4-services/orchestration/kernel-service/Dockerfile
    environment:
      - Allternit_KERNEL_PORT=3004
    networks:
      - allternit-network
    restart: unless-stopped

  memory:
    build:
      context: .
      dockerfile: 4-services/memory/Dockerfile
    volumes:
      - memory-data:/data
    networks:
      - allternit-network
    restart: unless-stopped

  # Monitoring
  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus-data:/prometheus
    ports:
      - "9090:9090"
    networks:
      - allternit-network

  grafana:
    image: grafana/grafana:latest
    volumes:
      - grafana-data:/var/lib/grafana
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=changeme
    networks:
      - allternit-network

volumes:
  api-data:
  memory-data:
  prometheus-data:
  grafana-data:

networks:
  allternit-network:
    driver: bridge
```

**Deployment:**
```bash
docker-compose -f docker-compose.production.yml up -d
```

---

### Option 3: Kubernetes Deployment

**Best for:** Large teams, high traffic (>100k requests/day)

**File:** `k8s/api-deployment.yaml`
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: allternit-api
  namespace: allternit
spec:
  replicas: 3
  selector:
    matchLabels:
      app: allternit-api
  template:
    metadata:
      labels:
        app: allternit-api
    spec:
      containers:
      - name: api
        image: allternit/api:latest
        ports:
        - containerPort: 3000
        env:
        - name: Allternit_API_PORT
          value: "3000"
        - name: Allternit_KERNEL_URL
          value: "http://allternit-kernel:3004"
        - name: Allternit_MEMORY_URL
          value: "http://allternit-memory:3200"
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: allternit-api
  namespace: allternit
spec:
  selector:
    app: allternit-api
  ports:
  - port: 3000
    targetPort: 3000
  type: ClusterIP
```

---

## Configuration Management

### Environment Variables

**File:** `.env.production`
```bash
# =============================================================================
# Allternit PLATFORM - PRODUCTION CONFIGURATION
# =============================================================================

# -----------------------------------------------------------------------------
# Core Settings
# -----------------------------------------------------------------------------
Allternit_ENVIRONMENT=production
Allternit_LOG_LEVEL=info
Allternit_SECRET_KEY=changeme-in-production-use-32-char-random-string

# -----------------------------------------------------------------------------
# Service Ports
# -----------------------------------------------------------------------------
Allternit_API_PORT=3000
Allternit_API_HOST=0.0.0.0
Allternit_KERNEL_PORT=3004
Allternit_KERNEL_HOST=127.0.0.1
Allternit_GATEWAY_PORT=8013
Allternit_GATEWAY_HOST=0.0.0.0

# -----------------------------------------------------------------------------
# Service URLs (internal network)
# -----------------------------------------------------------------------------
Allternit_KERNEL_URL=http://127.0.0.1:3004
Allternit_MEMORY_URL=http://127.0.0.1:3200
Allternit_REGISTRY_URL=http://127.0.0.1:8080
Allternit_POLICY_URL=http://127.0.0.1:3003

# -----------------------------------------------------------------------------
# Database
# -----------------------------------------------------------------------------
DATABASE_URL=/var/lib/allternit/allternit.db
DATABASE_POOL_SIZE=10
DATABASE_TIMEOUT=30

# -----------------------------------------------------------------------------
# Redis (optional, for caching)
# -----------------------------------------------------------------------------
REDIS_URL=redis://127.0.0.1:6379
REDIS_POOL_SIZE=5

# -----------------------------------------------------------------------------
# Rate Limiting
# -----------------------------------------------------------------------------
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW=60

# -----------------------------------------------------------------------------
# Security
# -----------------------------------------------------------------------------
CORS_ORIGINS=https://your-domain.com
JWT_SECRET=changeme-in-production
JWT_EXPIRY=24h
```

---

## Deployment Options

### Quick Deploy Scripts

**File:** `scripts/deploy-production.sh`
```bash
#!/bin/bash
set -e

echo "🚀 Deploying Allternit Platform to Production"

# 1. Validate configuration
echo "📋 Validating configuration..."
./scripts/validate-config.sh

# 2. Build all services
echo "🔨 Building services..."
cargo build --release --workspace
npm run build --prefix 4-services/gateway/agui-gateway
npm run build --prefix 4-services/gateway/a2a-gateway

# 3. Run database migrations
echo "🗄️  Running database migrations..."
./7-apps/api/migrate.sh up

# 4. Stop existing services
echo "🛑 Stopping existing services..."
sudo systemctl stop allternit-api allternit-kernel allternit-gateway || true

# 5. Deploy new binaries
echo "📦 Deploying binaries..."
sudo cp target/release/allternit-api /usr/local/bin/
sudo cp target/release/allternit-kernel /usr/local/bin/

# 6. Start services
echo "▶️  Starting services..."
sudo systemctl start allternit-api
sudo systemctl start allternit-kernel
sudo systemctl start allternit-gateway

# 7. Health check
echo "🏥 Running health checks..."
sleep 5
curl -f http://127.0.0.1:3000/health || exit 1
curl -f http://127.0.0.1:3004/health || exit 1
curl -f http://127.0.0.1:8013/health || exit 1

echo "✅ Deployment complete!"
```

---

## Post-Deployment Verification

### Health Check Script

**File:** `scripts/verify-deployment.sh`
```bash
#!/bin/bash

SERVICES=(
    "API:3000"
    "Kernel:3004"
    "Gateway:8013"
    "Memory:3200"
    "Registry:8080"
)

echo "🔍 Verifying deployment..."

for service in "${SERVICES[@]}"; do
    name="${service%%:*}"
    port="${service##*:}"
    
    response=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${port}/health")
    
    if [ "$response" = "200" ]; then
        echo "✅ $name (port $port) - Healthy"
    else
        echo "❌ $name (port $port) - Unhealthy (HTTP $response)"
        exit 1
    fi
done

echo "✅ All services healthy!"
```

---

## Monitoring & Maintenance

### Prometheus Configuration

**File:** `monitoring/prometheus.yml`
```yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'allternit-api'
    static_configs:
      - targets: ['api:3000']
    metrics_path: '/metrics'
    
  - job_name: 'allternit-kernel'
    static_configs:
      - targets: ['kernel:3004']
    metrics_path: '/metrics'
    
  - job_name: 'allternit-gateway'
    static_configs:
      - targets: ['gateway:8013']
    metrics_path: '/metrics'
```

### Grafana Dashboard

Import dashboard ID: `TBD` (create custom dashboard)

### Alert Rules

**File:** `monitoring/alerts.yml`
```yaml
groups:
- name: allternit
  rules:
  - alert: ServiceDown
    expr: up == 0
    for: 1m
    labels:
      severity: critical
    annotations:
      summary: "Service {{ $labels.job }} is down"
      
  - alert: HighErrorRate
    expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "High error rate detected"
```

---

## Troubleshooting

### Common Issues

#### 1. Service Won't Start

```bash
# Check logs
journalctl -u allternit-api -f

# Check port conflicts
lsof -i :3000

# Check permissions
ls -la /usr/local/bin/allternit-api
```

#### 2. Database Errors

```bash
# Check database file
ls -la /var/lib/allternit/allternit.db

# Run migrations
./7-apps/api/migrate.sh status

# Backup and restore
cp allternit.db allternit.db.backup
```

#### 3. High Memory Usage

```bash
# Check memory
top -p $(pgrep allternit)

# Adjust limits
sudo systemctl edit allternit-api
# Add: LimitRSS=1G
```

---

## Contact & Support

- Documentation: `docs/`
- Issues: GitHub Issues
- Emergency: On-call rotation schedule

---

*Last updated: 2026-02-26*
*Version: 1.0.0*
