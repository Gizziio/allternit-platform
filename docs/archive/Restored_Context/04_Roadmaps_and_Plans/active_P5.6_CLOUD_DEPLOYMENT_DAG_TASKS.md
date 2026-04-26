# CLOUD DEPLOYMENT - DAG TASK BREAKDOWN

**Date:** 2026-02-21  
**Phase:** P5 - Cloud Deployment Backend Integration  
**Total Effort:** 12 days (MVP) + 10 days (Edge Cases)  
**Priority:** CRITICAL

---

## Task Summary

| ID | Task | Effort | Dependencies | Priority |
|----|------|--------|--------------|----------|
| P5.6.1 | Backend API Endpoints | 3 days | None | 🔴 CRITICAL |
| P5.6.2 | SSH Executor Service | 3 days | P5.6.1 | 🔴 CRITICAL |
| P5.6.3 | Installation Script | 2 days | None | 🔴 CRITICAL |
| P5.6.4 | Wire UI to Backend | 2 days | P5.6.1, P5.6.2, P5.6.3 | 🔴 CRITICAL |
| P5.6.5 | True BYOC Flow | 3 days | P5.6.2, P5.6.3 | 🟡 HIGH |
| P5.6.6 | Manual Provider Setup | 2 days | P5.6.3 | 🟡 HIGH |
| P5.6.7 | Credential Validation | 2 days | P5.6.1 | 🟡 HIGH |
| P5.6.8 | Failure Recovery | 3 days | P5.6.1 | 🟡 HIGH |
| P5.6.9 | OS Compatibility | 3 days | P5.6.3 | 🟡 HIGH |
| P5.6.10 | Firewall Configuration | 2 days | P5.6.1 | 🟡 HIGH |
| P5.6.11 | Audit Logging | 2 days | P5.6.1 | 🟢 MEDIUM |
| P5.6.12 | End-to-End Testing | 2 days | All above | 🔴 CRITICAL |

**Total: 28 days (4 weeks)**

---

## P5.6.1: Backend API Endpoints

**Effort:** 3 days  
**Dependencies:** None  
**Priority:** 🔴 CRITICAL

### Subtasks

| ID | Subtask | Effort | Acceptance Criteria |
|----|---------|--------|---------------------|
| 5.6.1.1 | Create deployment API crate | 0.5 days | `allternit-cloud-api` crate created with Cargo.toml |
| 5.6.1.2 | Implement POST /deployments endpoint | 1 day | Can create deployment record, returns deployment ID |
| 5.6.1.3 | Implement GET /deployments/:id endpoint | 0.5 days | Returns deployment status, progress, events |
| 5.6.1.4 | Implement WebSocket event stream | 1 day | Live deployment events via WebSocket |
| 5.6.1.5 | Implement DELETE /deployments/:id/cancel | 0.5 days | Can cancel in-progress deployment |

### Files to Create

```
cloud/allternit-cloud-api/
├── Cargo.toml
├── src/
│   ├── lib.rs
│   ├── main.rs
│   ├── routes/
│   │   ├── deployments.rs
│   │   └── mod.rs
│   ├── websocket/
│   │   ├── events.rs
│   │   └── mod.rs
│   ├── db/
│   │   ├── models.rs
│   │   └── mod.rs
│   └── error.rs
```

### API Specification

```rust
// POST /api/v1/deployments
Request:
{
  "provider_id": "hetzner",
  "region_id": "fsn1",
  "instance_type_id": "cx21",
  "storage_gb": 100,
  "credentials": { "api_token": "..." },
  "ssh_public_key": "ssh-rsa ..."
}

Response:
{
  "deployment_id": "deploy-abc123",
  "status": "provisioning",
  "created_at": "2026-02-21T12:00:00Z"
}

// GET /api/v1/deployments/:id
Response:
{
  "deployment_id": "deploy-abc123",
  "status": "installing",
  "progress": 60,
  "message": "Installing Allternit runtime",
  "events": [
    { "timestamp": "...", "message": "VM provisioned" },
    { "timestamp": "...", "message": "SSH connected" }
  ]
}

// WS /api/v1/deployments/:id/events
Message:
{
  "event_type": "progress_update",
  "progress": 65,
  "message": "Configuring firewall"
}
```

### Acceptance Criteria

- [ ] All 5 endpoints implemented
- [ ] WebSocket supports 100+ concurrent connections
- [ ] Deployment records persisted to database
- [ ] Events streamed in real-time (<100ms latency)
- [ ] Error handling for all failure modes
- [ ] OpenAPI spec generated
- [ ] Integration tests pass

---

## P5.6.2: SSH Executor Service

**Effort:** 3 days  
**Dependencies:** P5.6.1  
**Priority:** 🔴 CRITICAL

### Subtasks

| ID | Subtask | Effort | Acceptance Criteria |
|----|---------|--------|---------------------|
| 5.6.2.1 | Add tokio-ssh dependency | 0.25 days | SSH library added to Cargo.toml |
| 5.6.2.2 | Implement SSH connection manager | 1 day | Can connect to VPS via SSH |
| 5.6.2.3 | Implement command executor | 0.5 days | Can run remote commands |
| 5.6.2.4 | Implement file transfer (SCP) | 0.5 days | Can upload installation scripts |
| 5.6.2.5 | Implement SSH key management | 0.5 days | Generate, store, rotate keys |
| 5.6.2.6 | Add connection pooling | 0.25 days | Reuse connections efficiently |

### Files to Create

```
cloud/allternit-cloud-ssh/
├── Cargo.toml
├── src/
│   ├── lib.rs
│   ├── connection.rs
│   ├── executor.rs
│   ├── key_manager.rs
│   └── error.rs
```

### Key Management

```rust
// Generate keypair for deployment
let keypair = SshKeyManager::generate_keypair()?;

// Store encrypted private key
let encrypted = keypair.encrypt_private_key(passphrase)?;
credential_store.store(deployment_id, encrypted)?;

// Use for SSH connection
let session = SshConnection::connect(
    host,
    port,
    "root",
    &keypair.private_key,
).await?;
```

### Acceptance Criteria

- [ ] Can connect to Ubuntu 22.04 VPS via SSH
- [ ] Can execute commands remotely
- [ ] Can upload files via SCP
- [ ] SSH keys generated per deployment
- [ ] Private keys encrypted at rest
- [ ] Connection pooling working (10+ concurrent)
- [ ] Timeout handling (30s default)
- [ ] Retry logic (3 retries with backoff)

---

## P5.6.3: Installation Script

**Effort:** 2 days  
**Dependencies:** None  
**Priority:** 🔴 CRITICAL

### Subtasks

| ID | Subtask | Effort | Acceptance Criteria |
|----|---------|--------|---------------------|
| 5.6.3.1 | Write install-allternit-runtime.sh | 1 day | Script installs Allternit on Ubuntu 22.04 |
| 5.6.3.2 | Create systemd service file | 0.5 days | Allternit runs as systemd service |
| 5.6.3.3 | Implement registration with control plane | 0.5 days | Agent registers and appears in Console |

### Installation Script

```bash
#!/bin/bash
set -e

# install-allternit-runtime.sh
# Installs Allternit runtime on fresh VPS

echo "=== Allternit Runtime Installation ==="

# Configuration (passed via environment)
ALLTERNIT_VERSION="${ALLTERNIT_VERSION:-latest}"
CONTROL_PLANE_URL="${CONTROL_PLANE_URL:-wss://console.allternit.sh}"
DEPLOYMENT_TOKEN="${DEPLOYMENT_TOKEN}"

# 1. Create Allternit user
if ! id -u allternit >/dev/null 2>&1; then
    useradd -r -s /bin/false allternit
    echo "✓ Created allternit user"
fi

# 2. Create directories
mkdir -p /opt/allternit/bin
mkdir -p /opt/allternit/config
mkdir -p /var/log/allternit
chown -R allternit:allternit /opt/allternit
chown -R allternit:allternit /var/log/allternit
echo "✓ Created directories"

# 3. Download Allternit runtime
RELEASE_URL="https://releases.allternit.sh/${ALLTERNIT_VERSION}/allternit-agent-x86_64-unknown-linux-gnu.tar.gz"
curl -L "$RELEASE_URL" | tar xz -C /opt/allternit/bin --strip-components=1
chmod +x /opt/allternit/bin/allternit-agent
echo "✓ Downloaded Allternit runtime"

# 4. Create systemd service
cat > /etc/systemd/system/allternit-agent.service << EOF
[Unit]
Description=Allternit Agent
After=network.target

[Service]
Type=simple
ExecStart=/opt/allternit/bin/allternit-agent --control-plane=${CONTROL_PLANE_URL} --token=${DEPLOYMENT_TOKEN}
Restart=always
RestartSec=5
User=allternit
Group=allternit
Environment=RUST_LOG=info

# Security
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/log/allternit /opt/allternit/config

[Install]
WantedBy=multi-user.target
EOF
echo "✓ Created systemd service"

# 5. Enable and start service
systemctl daemon-reload
systemctl enable allternit-agent
systemctl start allternit-agent
echo "✓ Started Allternit agent"

# 6. Verify installation
sleep 2
if systemctl is-active --quiet allternit-agent; then
    echo "✓ Allternit installation complete"
    echo "✓ Service is running"
    exit 0
else
    echo "✗ Allternit service failed to start"
    systemctl status allternit-agent
    exit 1
fi
```

### Acceptance Criteria

- [ ] Script runs on fresh Ubuntu 22.04 VPS
- [ ] Creates allternit user
- [ ] Downloads and installs Allternit runtime
- [ ] Creates systemd service
- [ ] Service starts automatically
- [ ] Agent registers with control plane
- [ ] Instance appears in Console Instances page
- [ ] Script idempotent (can run twice safely)
- [ ] Error handling with clear messages

---

## P5.6.4: Wire UI to Backend

**Effort:** 2 days  
**Dependencies:** P5.6.1, P5.6.2, P5.6.3  
**Priority:** 🔴 CRITICAL

### Subtasks

| ID | Subtask | Effort | Acceptance Criteria |
|----|---------|--------|---------------------|
| 5.6.4.1 | Create API client library | 0.5 days | TypeScript client for backend API |
| 5.6.4.2 | Replace simulated deployment start | 0.5 days | Calls real POST /deployments |
| 5.6.4.3 | Wire progress tracker to WebSocket | 0.5 days | Shows real deployment events |
| 5.6.4.4 | Handle deployment errors | 0.5 days | Shows error messages from backend |

### Files to Modify

```
surfaces/allternit-platform/src/views/cloud-deploy/
├── CloudDeployView.tsx      # Wire deployment start
├── components/
│   └── DeploymentProgress.tsx  # Wire WebSocket events
└── lib/
    └── api-client.ts        # NEW - API client library
```

### API Client

```typescript
// api-client.ts
export class CloudDeployApi {
  private baseUrl: string;
  
  async createDeployment(config: DeploymentConfig): Promise<Deployment> {
    const response = await fetch(`${this.baseUrl}/deployments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    return response.json();
  }
  
  async getDeploymentStatus(id: string): Promise<DeploymentStatus> {
    const response = await fetch(`${this.baseUrl}/deployments/${id}`);
    return response.json();
  }
  
  subscribeToEvents(id: string, callback: (event: DeploymentEvent) => void): () => void {
    const ws = new WebSocket(`ws://${this.baseUrl}/deployments/${id}/events`);
    ws.onmessage = (msg) => callback(JSON.parse(msg.data));
    return () => ws.close();
  }
}
```

### Acceptance Criteria

- [ ] UI calls real backend API
- [ ] Progress shows real deployment events
- [ ] Errors displayed to user
- [ ] Can cancel deployment
- [ ] Instance appears in Instances page after deploy
- [ ] No simulated progress

---

## P5.6.5: True BYOC Flow

**Effort:** 3 days  
**Dependencies:** P5.6.2, P5.6.3  
**Priority:** 🟡 HIGH

### Subtasks

| ID | Subtask | Effort | Acceptance Criteria |
|----|---------|--------|---------------------|
| 5.6.5.1 | Add "I Have Existing VPS" option | 0.5 days | New deployment mode in wizard |
| 5.6.5.2 | Create SSH credential input form | 1 day | IP, port, username, key/password |
| 5.6.5.3 | Implement SSH connection test | 0.5 days | Test credentials before deploy |
| 5.6.5.4 | Install Allternit on existing VPS | 1 day | Same installation as new VPS |

### Acceptance Criteria

- [ ] User can select "Existing VPS" mode
- [ ] Can enter SSH credentials
- [ ] Connection test works
- [ ] Allternit installs on existing VPS
- [ ] Instance appears in Console

---

## P5.6.6: Manual Provider Setup

**Effort:** 2 days  
**Dependencies:** P5.6.3  
**Priority:** 🟡 HIGH

### Subtasks

| ID | Subtask | Effort | Acceptance Criteria |
|----|---------|--------|---------------------|
| 5.6.6.1 | Create manual setup instructions UI | 1 day | Step-by-step guide for each provider |
| 5.6.6.2 | Add manual credential entry form | 0.5 days | Enter VPS IP, SSH credentials |
| 5.6.6.3 | Wire to installation script | 0.5 days | Install on manually created VPS |

### Acceptance Criteria

- [ ] Instructions for Contabo, RackNerd
- [ ] User can create VPS manually
- [ ] Can enter VPS credentials
- [ ] Allternit installs successfully

---

## P5.6.7: Credential Validation

**Effort:** 2 days  
**Dependencies:** P5.6.1  
**Priority:** 🟡 HIGH

### Subtasks

| ID | Subtask | Effort | Acceptance Criteria |
|----|---------|--------|---------------------|
| 5.6.7.1 | Implement POST /providers/:id/validate | 1 day | Validates API credentials |
| 5.6.7.2 | Add quota checking | 0.5 days | Check provider quota before deploy |
| 5.6.7.3 | Handle rate limits | 0.5 days | Graceful rate limit handling |

### Acceptance Criteria

- [ ] Can validate API tokens
- [ ] Shows clear error for invalid credentials
- [ ] Checks quota before deployment
- [ ] Handles rate limits gracefully

---

## P5.6.8: Failure Recovery

**Effort:** 3 days  
**Dependencies:** P5.6.1  
**Priority:** 🟡 HIGH

### Subtasks

| ID | Subtask | Effort | Acceptance Criteria |
|----|---------|--------|---------------------|
| 5.6.8.1 | Implement rollback on failure | 1.5 days | Cleans up partial deployments |
| 5.6.8.2 | Add retry logic | 0.5 days | Retries failed steps |
| 5.6.8.3 | Create error diagnostics | 1 day | Clear error messages, logs |

### Acceptance Criteria

- [ ] Failed deployments cleaned up
- [ ] No orphaned VPS instances
- [ ] Retry works for transient failures
- [ ] Clear error messages shown to user

---

## P5.6.9: OS Compatibility

**Effort:** 3 days  
**Dependencies:** P5.6.3  
**Priority:** 🟡 HIGH

### Subtasks

| ID | Subtask | Effort | Acceptance Criteria |
|----|---------|--------|---------------------|
| 5.6.9.1 | Add OS detection to installer | 1 day | Detects Ubuntu, Debian, CentOS |
| 5.6.9.2 | Create OS-specific install scripts | 1.5 days | Separate scripts per OS |
| 5.6.9.3 | Test on each supported OS | 0.5 days | Verified on all target OS |

### Supported OS

- Ubuntu 20.04, 22.04, 24.04
- Debian 11, 12
- (Future: CentOS, RHEL, Amazon Linux)

### Acceptance Criteria

- [ ] Auto-detects OS
- [ ] Installs on all supported OS
- [ ] OS-specific error handling

---

## P5.6.10: Firewall Configuration

**Effort:** 2 days  
**Dependencies:** P5.6.1  
**Priority:** 🟡 HIGH

### Subtasks

| ID | Subtask | Effort | Acceptance Criteria |
|----|---------|--------|---------------------|
| 5.6.10.1 | Configure AWS security groups | 0.5 days | Opens ports 22, 80, 443, 3000 |
| 5.6.10.2 | Configure Hetzner firewall | 0.5 days | Same ports |
| 5.6.10.3 | Configure DigitalOcean firewall | 0.5 days | Same ports |
| 5.6.10.4 | Configure UFW on VPS | 0.5 days | Local firewall rules |

### Acceptance Criteria

- [ ] Firewall configured for all providers
- [ ] Required ports open
- [ ] SSH access secured
- [ ] Allternit accessible on port 3000

---

## P5.6.11: Audit Logging

**Effort:** 2 days  
**Dependencies:** P5.6.1  
**Priority:** 🟢 MEDIUM

### Subtasks

| ID | Subtask | Effort | Acceptance Criteria |
|----|---------|--------|---------------------|
| 5.6.11.1 | Implement audit log database | 1 day | Stores all actions |
| 5.6.11.2 | Log deployment actions | 0.5 days | Who deployed what when |
| 5.6.11.3 | Log credential access | 0.5 days | Who accessed credentials |

### Acceptance Criteria

- [ ] All actions logged
- [ ] Logs immutable
- [ ] Can query audit trail
- [ ] Compliance-ready

---

## P5.6.12: End-to-End Testing

**Effort:** 2 days  
**Dependencies:** All above  
**Priority:** 🔴 CRITICAL

### Subtasks

| ID | Subtask | Effort | Acceptance Criteria |
|----|---------|--------|---------------------|
| 5.6.12.1 | Create E2E test suite | 1 day | Automated test scenarios |
| 5.6.12.2 | Test on real VPS providers | 0.5 days | Deploy to Hetzner, DO, AWS |
| 5.6.12.3 | Test failure scenarios | 0.5 days | Invalid creds, network failures |

### Test Scenarios

1. Deploy new VPS (Hetzner)
2. Deploy new VPS (DigitalOcean)
3. Deploy new VPS (AWS)
4. Connect existing VPS
5. Manual provider setup
6. Invalid credentials
7. Deployment failure + rollback
8. OS compatibility (Ubuntu, Debian)

### Acceptance Criteria

- [ ] All test scenarios pass
- [ ] Deploy to 3 providers works
- [ ] BYOC works
- [ ] Failure recovery works
- [ ] No memory leaks
- [ ] Performance acceptable (<5 min deploy)

---

## Critical Path

```
P5.6.1 (API Endpoints) ─┬─> P5.6.2 (SSH) ─┬─> P5.6.4 (Wire UI) ─> P5.6.12 (E2E)
                        │                  │
P5.6.3 (Installer) ─────┘                  │
                                           │
P5.6.5 (BYOC) ─────────────────────────────┘
P5.6.6 (Manual) ───────────────────────────┘
```

**MVP (Weeks 1-2):** P5.6.1, P5.6.2, P5.6.3, P5.6.4, P5.6.12  
**Full Feature (Weeks 3-4):** P5.6.5, P5.6.6, P5.6.7, P5.6.8, P5.6.9, P5.6.10, P5.6.11

---

## Work Order Summary

**Phase 1: MVP (12 days)**
- Backend API endpoints
- SSH executor
- Installation script
- UI integration
- E2E testing

**Phase 2: Full Feature (10 days)**
- BYOC support
- Manual provider setup
- Credential validation
- Failure recovery
- OS compatibility
- Firewall configuration
- Audit logging

**Total: 22 working days (4.5 weeks)**

---

**End of DAG Task Breakdown**
