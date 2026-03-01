# A2R NODE - ENTERPRISE DEPLOYMENT QUICK REFERENCE

> **Everything you need for enterprise cloud deployment in one place**

---

## 📁 Complete File Structure

```
8-cloud/a2r-production-ready/
├── README.md                              # Enterprise deployment overview
├── ENTERPRISE_DEPLOYMENT_CHECKLIST.md     # Phase-by-phase checklist
├── PRODUCTION_READINESS_TRACKER.md        # Task tracking & issues
├── PRODUCTION_DEPLOYMENT_GUIDE.md         # Detailed deployment guide
├── PRODUCTION_PREPARATION_SUMMARY.md      # Quick summary
├── PORT_REGISTRY.md                       # Port assignments
├── service-config.sh                      # Port configuration
└── start-platform.sh                      # Unified launcher
```

---

## 🚀 Quick Start (3 Commands)

### 1. Start Development Environment
```bash
cd 8-cloud/a2r-production-ready
./start-platform.sh
```

### 2. Verify All Services
```bash
curl http://127.0.0.1:8013/health
```

### 3. Stop All Services
```bash
pkill -f a2rchitech
```

---

## 📊 Service Port Reference

| Port | Service | External | Required |
|------|---------|----------|----------|
| **8013** | Gateway | ✅ Yes | ✅ Production |
| **3000** | API | ❌ No | ✅ Production |
| **3004** | Kernel | ❌ No | ✅ Production |
| **3200** | Memory | ❌ No | ✅ Production |
| **8080** | Registry | ❌ No | ✅ Production |
| **3003** | Policy | ❌ No | ✅ Production |
| **8001** | Voice | ❌ No | ⚠️ Optional |
| **8002** | WebVM | ❌ No | ⚠️ Optional |
| **3010** | Operator | ❌ No | ⚠️ Optional |
| **3011** | Rails | ❌ No | ⚠️ Optional |
| **8010** | AGUI | ❌ No | ⚠️ Optional |
| **8012** | A2A | ❌ No | ⚠️ Optional |
| **18789** | OpenClaw | ❌ No | ⚠️ Optional |
| **4096** | Terminal | ❌ No | ✅ Production |
| **5177** | Shell UI | ❌ No | ❌ Dev Only |

**Security Note:** Only Gateway (8013) should be exposed externally in production.

---

## ✅ Enterprise Readiness Phases

### Phase 1: Infrastructure
- [ ] Compute: 4+ cores, 16GB+ RAM
- [ ] Storage: 100GB+ SSD
- [ ] Network: Static IP, firewall
- [ ] Region: Primary + DR

### Phase 2: Security
- [ ] SSL/TLS certificates
- [ ] Firewall configured
- [ ] Secrets management
- [ ] Security audit

### Phase 3: Code
- [ ] Critical issues fixed
- [ ] Tests passing (>80% coverage)
- [ ] Load tested (1000 req/s)
- [ ] Documentation complete

### Phase 4: Deployment
- [ ] Deployment plan approved
- [ ] Rollback plan ready
- [ ] Monitoring enabled
- [ ] Alerts configured

### Phase 5: Operations
- [ ] Runbooks created
- [ ] Team trained
- [ ] Backup configured
- [ ] On-call scheduled

---

## 🔧 Configuration Management

### Environment Variables

```bash
# Core Configuration
A2R_ENVIRONMENT=production
A2R_LOG_LEVEL=info
A2R_SECRET_KEY=<32-char-random-string>

# Service Ports
A2R_API_PORT=3000
A2R_KERNEL_PORT=3004
A2R_GATEWAY_PORT=8013
A2R_MEMORY_PORT=3200
A2R_REGISTRY_PORT=8080

# Service URLs
A2R_KERNEL_URL=http://127.0.0.1:3004
A2R_MEMORY_URL=http://127.0.0.1:3200
A2R_REGISTRY_URL=http://127.0.0.1:8080

# Database
DATABASE_URL=/var/lib/a2r/a2rchitech.db
DATABASE_POOL_SIZE=10

# Security
JWT_SECRET=<secret>
JWT_EXPIRY=24h
CORS_ORIGINS=https://your-domain.com
```

### Source Configuration
```bash
source ./service-config.sh
# Now all A2R_*_PORT variables are available
```

---

## 🏥 Health Checks

### Manual Verification
```bash
# Gateway (main entry point)
curl http://127.0.0.1:8013/health

# API Service
curl http://127.0.0.1:3000/health

# Kernel
curl http://127.0.0.1:3004/health

# All services
./verify-deployment.sh
```

### Automated Monitoring
```yaml
# Prometheus scrape config
scrape_configs:
  - job_name: 'a2r-gateway'
    static_configs:
      - targets: ['localhost:8013']
    metrics_path: '/metrics'
    
  - job_name: 'a2r-api'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
```

---

## 📈 Key Metrics

### Infrastructure
- CPU usage (alert >80%)
- Memory usage (alert >85%)
- Disk usage (alert >80%)
- Network I/O

### Application
- Request rate (req/s)
- Error rate (alert >1%)
- P95 latency (alert >500ms)
- P99 latency (alert >2s)

### Business
- Active users
- API calls per tenant
- Feature usage

---

## 🚨 Alert Severity

| Severity | Response | Examples |
|----------|----------|----------|
| **P1** | Immediate | Service down, data loss, security breach |
| **P2** | 1 hour | High error rate, performance degradation |
| **P3** | 4 hours | Resource warnings |
| **P4** | Next business day | Minor issues |

---

## 🔄 Deployment Strategies

### Blue-Green (Recommended)
```
1. Deploy to Green environment
2. Test Green
3. Switch traffic to Green
4. Keep Blue for rollback
```

### Rolling
```
1. Update instance 1
2. Update instance 2
3. Update instance 3
```

### Canary
```
1. Route 5% to new version
2. Monitor metrics
3. Gradually increase to 100%
```

---

## 🛠️ Troubleshooting

### Service Won't Start
```bash
# Check logs
tail -f .logs/api.log

# Check port conflicts
lsof -i :3000

# Check permissions
ls -la /usr/local/bin/a2rchitech-api
```

### High Memory Usage
```bash
# Check memory
top -p $(pgrep a2rchitech)

# Restart service
sudo systemctl restart a2r-api
```

### Database Errors
```bash
# Check database file
ls -la /var/lib/a2r/a2rchitech.db

# Backup and restore
cp a2rchitech.db a2rchitech.db.backup
```

---

## 📞 Support

### Getting Help
1. Check documentation in this folder
2. Review logs: `.logs/`
3. Run health checks
4. Contact on-call engineer

### Escalation
1. Check runbooks
2. Contact on-call
3. Escalate to platform team
4. Engage vendor support

---

## 📋 Pre-Flight Checklist

Before deploying to production:

- [ ] All 🔴 critical issues resolved
- [ ] Infrastructure provisioned
- [ ] Security audit passed
- [ ] Load testing completed
- [ ] Monitoring configured
- [ ] Alerts tested
- [ ] Runbooks created
- [ ] Team trained
- [ ] Rollback plan ready
- [ ] Stakeholders notified

---

## 🎯 Success Criteria

### Technical
- ✅ 99.9% uptime
- ✅ <100ms P95 latency
- ✅ <0.1% error rate
- ✅ <5 min deployment time

### Business
- ✅ Zero data loss
- ✅ Seamless upgrades
- ✅ Quick rollback capability
- ✅ Clear incident response

---

## 📖 Documentation Quick Links

| Document | Purpose |
|----------|---------|
| [README.md](./README.md) | Enterprise deployment overview |
| [ENTERPRISE_DEPLOYMENT_CHECKLIST.md](./ENTERPRISE_DEPLOYMENT_CHECKLIST.md) | Phase-by-phase checklist |
| [PRODUCTION_READINESS_TRACKER.md](./PRODUCTION_READINESS_TRACKER.md) | Task tracking |
| [PRODUCTION_DEPLOYMENT_GUIDE.md](./PRODUCTION_DEPLOYMENT_GUIDE.md) | Deployment guide |
| [PORT_REGISTRY.md](./PORT_REGISTRY.md) | Port assignments |

---

*Version: 1.0.0*
*Last updated: 2026-02-26*
*Classification: Internal Use*
