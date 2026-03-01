# A2RCHITECH PLATFORM - DOCUMENTATION INDEX

> Central navigation for all A2rchitech documentation

---

## 🚀 Getting Started

| Document | Description | For |
|----------|-------------|-----|
| [README.md](../README.md) | Project overview & quick start | Everyone |
| [INSTALL.md](../install.sh) | Installation script | Developers |
| [QUICKSTART.md](../README.md#quick-start) | 5-minute setup | Developers |

---

## 📚 Production Documentation

### Essential Reading (Start Here)

| Document | Description | Priority |
|----------|-------------|----------|
| [PRODUCTION_PREPARATION_SUMMARY.md](./PRODUCTION_PREPARATION_SUMMARY.md) | **Start here** - Complete overview | 🔴 Must Read |
| [PRODUCTION_READINESS_TRACKER.md](./PRODUCTION_READINESS_TRACKER.md) | Task tracking & action items | 🔴 Must Read |
| [PRODUCTION_DEPLOYMENT_GUIDE.md](./PRODUCTION_DEPLOYMENT_GUIDE.md) | Detailed deployment guide | 🔴 Must Read |
| [PORT_REGISTRY.md](./PORT_REGISTRY.md) | Port assignments & conflicts | 🔴 Must Read |

### Quick Reference

```bash
# Start all services (development)
./start-platform.sh

# Source port configuration
source ./dev/scripts/service-config.sh

# Verify deployment
./scripts/verify-deployment.sh

# Validate configuration
./scripts/validate-config.sh
```

---

## 🏗️ Architecture Documentation

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](../ARCHITECTURE.md) | System architecture |
| [docs/SERVICES.md](../docs/SERVICES.md) | Service documentation |
| [docs/SERVICE_DEPENDENCIES.md](./SERVICE_DEPENDENCIES.md) | (TODO) Dependency graph |

---

## 🔧 Development Guides

| Document | Description |
|----------|-------------|
| [CONTRIBUTING.md](../CONTRIBUTING.md) | Contribution guidelines |
| [CODING_STANDARDS.md](./CODING_STANDARDS.md) | (TODO) Code style guide |
| [TESTING_GUIDE.md](../TESTING_GUIDE.md) | Testing guidelines |
| [LOCAL_DEVELOPMENT.md](./LOCAL_DEVELOPMENT.md) | (TODO) Local setup |

---

## 📖 API Documentation

| Document | Description |
|----------|-------------|
| [API_REFERENCE.md](./API_REFERENCE.md) | (TODO) API documentation |
| [OPENAPI_SPEC.md](./OPENAPI_SPEC.md) | (TODO) OpenAPI/Swagger spec |
| [SDK_GUIDE.md](./SDK_GUIDE.md) | (TODO) SDK documentation |

---

## 🔐 Security Documentation

| Document | Description |
|----------|-------------|
| [SECURITY.md](../SECURITY.md) | Security policies |
| [AUTHENTICATION.md](./AUTHENTICATION.md) | (TODO) Auth guide |
| [COMPLIANCE.md](./COMPLIANCE.md) | (TODO) Compliance docs |

---

## 📊 Operations Documentation

| Document | Description |
|----------|-------------|
| [DEPLOYMENT_GUIDE.md](./PRODUCTION_DEPLOYMENT_GUIDE.md) | Production deployment |
| [MONITORING.md](./MONITORING.md) | (TODO) Monitoring setup |
| [RUNBOOKS/](./RUNBOOKS/) | (TODO) Operational runbooks |
| [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) | (TODO) Troubleshooting guide |
| [BACKUP_RECOVERY.md](./BACKUP_RECOVERY.md) | (TODO) Backup procedures |

---

## 🎯 Service Documentation

### Core Services

| Service | Port | Documentation |
|---------|------|---------------|
| API | 3000 | [7-apps/api/README.md](../7-apps/api/README.md) |
| Kernel | 3004 | [4-services/orchestration/kernel-service/README.md](../4-services/orchestration/kernel-service/README.md) |
| Gateway | 8013 | [4-services/gateway/README.md](../4-services/gateway/README.md) |
| Memory | 3200 | [4-services/memory/README.md](../4-services/memory/README.md) |
| Registry | 8080 | [4-services/registry/README.md](../4-services/registry/README.md) |
| Policy | 3003 | [2-governance/README.md](../2-governance/README.md) |

### AI Services

| Service | Port | Documentation |
|---------|------|---------------|
| Voice | 8001 | [4-services/ml-ai-services/voice-service/README.md](../4-services/ml-ai-services/voice-service/README.md) |
| WebVM | 8002 | [4-services/ai/webvm-service/README.md](../4-services/ai/webvm-service/README.md) |
| Operator | 3010 | [4-services/a2r-operator/README.md](../4-services/a2r-operator/README.md) |
| Rails | 3011 | [a2r-agent-system-rails/README.md](../a2r-agent-system-rails/README.md) |

### Gateways

| Service | Port | Documentation |
|---------|------|---------------|
| AGUI | 8010 | [4-services/gateway/agui-gateway/README.md](../4-services/gateway/agui-gateway/README.md) |
| A2A | 8012 | [4-services/gateway/a2a-gateway/README.md](../4-services/gateway/a2a-gateway/README.md) |
| OpenClaw | 18789 | (External) |

---

## 🎓 Learning Resources

| Document | Description |
|----------|-------------|
| [CONCEPTS.md](./CONCEPTS.md) | (TODO) Core concepts |
| [TUTORIALS.md](./TUTORIALS.md) | (TODO) Step-by-step tutorials |
| [FAQ.md](./FAQ.md) | (TODO) Frequently asked questions |
| [GLOSSARY.md](./GLOSSARY.md) | (TODO) Terminology guide |

---

## 📋 Checklists

### Pre-Deployment
- [ ] Read [PRODUCTION_PREPARATION_SUMMARY.md](./PRODUCTION_PREPARATION_SUMMARY.md)
- [ ] Review [PRODUCTION_READINESS_TRACKER.md](./PRODUCTION_READINESS_TRACKER.md)
- [ ] Complete all 🔴 CRITICAL tasks
- [ ] Run load tests
- [ ] Security audit completed

### Deployment Day
- [ ] Follow [PRODUCTION_DEPLOYMENT_GUIDE.md](./PRODUCTION_DEPLOYMENT_GUIDE.md)
- [ ] Run deployment script
- [ ] Verify all health checks
- [ ] Enable monitoring
- [ ] Test rollback procedure

### Post-Deployment
- [ ] Verify metrics collection
- [ ] Test alerting
- [ ] Document any issues
- [ ] Schedule retrospective

---

## 🔍 Finding Information

### By Topic

**Ports & Configuration:**
- [PORT_REGISTRY.md](./PORT_REGISTRY.md) - Port assignments
- [dev/scripts/service-config.sh](../dev/scripts/service-config.sh) - Configuration variables

**Deployment:**
- [PRODUCTION_DEPLOYMENT_GUIDE.md](./PRODUCTION_DEPLOYMENT_GUIDE.md) - Full deployment guide
- [start-platform.sh](../start-platform.sh) - Start script

**Troubleshooting:**
- Check service logs: `./.logs/`
- Health endpoints: `http://127.0.0.1:<PORT>/health`
- Status command: `./dev/scripts/start-all.sh status`

---

## 📝 Document Status

| Status | Count | Description |
|--------|-------|-------------|
| ✅ Complete | 4 | Ready for production use |
| 🚧 In Progress | 0 | Being actively updated |
| 📋 Planned | 15+ | To be created |

---

## 🤝 Contributing to Documentation

1. Check if document already exists
2. Create new file in appropriate directory
3. Add to this index
4. Submit pull request

### Documentation Standards

- Use clear, concise language
- Include examples where helpful
- Keep formatting consistent
- Update when code changes

---

## 📞 Getting Help

- **Quick questions:** Check [FAQ.md](./FAQ.md) (TODO)
- **Technical issues:** See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) (TODO)
- **Architecture questions:** Review [ARCHITECTURE.md](../ARCHITECTURE.md)
- **Production issues:** Follow [RUNBOOKS/](./RUNBOOKS/) (TODO)

---

*Last updated: 2026-02-26*
*Version: 1.0.0*
