# Allternit Node End-to-End Production Test Plan

**Date:** 2026-02-24  
**Environment:** Production VPS  
**Goal:** Validate complete Allternit Node system in production-like environment

---

## 📋 PRE-TEST CHECKLIST

### Prerequisites
- [ ] VPS with Ubuntu 20.04+ or Debian 11+
- [ ] SSH access to VPS
- [ ] Domain/subdomain for control plane (optional)
- [ ] Local development machine
- [ ] Git installed locally

### System Requirements
| Component | Minimum | Recommended |
|-----------|---------|-------------|
| VPS CPU | 1 core | 2+ cores |
| VPS Memory | 1 GB | 2+ GB |
| VPS Disk | 10 GB | 20+ GB |
| Local Machine | Any | Any |

---

## 🚀 DEPLOYMENT STEPS

### Step 1: Build the Node Agent Binary

```bash
# Navigate to node agent directory
cd /Users/macbook/Desktop/allternit-workspace/allternit/cloud/allternit-node

# Build release binary
cargo build --release

# Verify binary was created
ls -lh target/release/allternit-node

# Check binary size (should be ~15-25 MB)
file target/release/allternit-node
```

**Expected Output:**
```
-rwxr-xr-x  1 user  staff    18M Feb 24 10:00 target/release/allternit-node
```

---

### Step 2: Transfer Binary to VPS

```bash
# Replace with your VPS details
VPS_USER="root"
VPS_HOST="your.vps.ip.address"

# Create directory on VPS
ssh ${VPS_USER}@${VPS_HOST} "mkdir -p /opt/allternit/bin"

# Transfer binary
scp target/release/allternit-node ${VPS_USER}@${VPS_HOST}:/opt/allternit/bin/

# Make executable
ssh ${VPS_USER}@${VPS_HOST} "chmod +x /opt/allternit/bin/allternit-node"
```

---

### Step 3: Install Docker on VPS

```bash
# SSH to VPS
ssh ${VPS_USER}@${VPS_HOST}

# Install Docker (if not already installed)
curl -fsSL https://get.docker.com | sh

# Add user to docker group
usermod -aG docker $USER

# Start Docker
systemctl start docker
systemctl enable docker

# Verify Docker
docker --version
docker ps
```

**Expected Output:**
```
Docker version 24.0.7, build afdd53b
CONTAINER ID   IMAGE   COMMAND   CREATED   STATUS    PORTS   NAMES
```

---

### Step 4: Configure Node Agent

```bash
# Still on VPS, create config directory
sudo mkdir -p /etc/allternit
sudo mkdir -p /var/log/allternit

# Generate a test token (or use your control plane token)
NODE_TOKEN="test-token-$(openssl rand -hex 16)"
NODE_ID="node-prod-test-$(hostname | cut -c1-8)"

# Create config file
sudo cat > /etc/allternit/node.env << EOF
# Allternit Node Configuration
# Generated: $(date)

ALLTERNIT_NODE_ID=${NODE_ID}
ALLTERNIT_TOKEN=${NODE_TOKEN}
ALLTERNIT_CONTROL_PLANE=ws://localhost:3000
EOF

# Secure config file
sudo chmod 600 /etc/allternit/node.env
sudo chown root:root /etc/allternit/node.env

# Show config
cat /etc/allternit/node.env
```

---

### Step 5: Install Systemd Service

```bash
# Create systemd service file
sudo cat > /etc/systemd/system/allternit-node.service << 'EOF'
[Unit]
Description=Allternit Node Agent
Documentation=https://docs.allternit.com
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
EnvironmentFile=/etc/allternit/node.env
ExecStart=/opt/allternit/bin/allternit-node
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=allternit-node

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd
sudo systemctl daemon-reload

# Enable service
sudo systemctl enable allternit-node

# Show service status
systemctl status allternit-node --no-pager
```

---

### Step 6: Start Control Plane (Local or VPS)

**Option A: Run Control Plane Locally**

```bash
# On your local machine
cd /Users/macbook/Desktop/allternit-workspace/allternit/cmd/api

# Start API server
cargo run
```

**Option B: Run Control Plane on VPS**

```bash
# On VPS, in a separate terminal or screen session
cd /path/to/allternit/cmd/api
cargo run --release
```

**Expected Output:**
```
2026-02-24T10:00:00Z  INFO  Starting Allternit API server
2026-02-24T10:00:00Z  INFO  Listening on http://127.0.0.1:3000
2026-02-24T10:00:00Z  INFO  SQLite database initialized
2026-02-24T10:00:00Z  INFO  Job dispatcher started
```

---

### Step 7: Start Node Agent

```bash
# On VPS
sudo systemctl start allternit-node

# Watch logs in real-time
sudo journalctl -u allternit-node -f
```

**Expected Output:**
```
Feb 24 10:05:00 vps allternit-node[12345]: 🔌 Connecting to ws://localhost:3000/ws/nodes/node-prod-test-xxx
Feb 24 10:05:01 vps allternit-node[12345]: ✅ WebSocket connected
Feb 24 10:05:01 vps allternit-node[12345]: 📋 Registration sent
Feb 24 10:05:01 vps allternit-node[12345]: ✅ Registered with control plane
Feb 24 10:05:01 vps allternit-node[12345]: 🐳 Docker available: version=24.0.7
Feb 24 10:05:31 vps allternit-node[12345]: 💓 Heartbeat sent
```

---

## ✅ VERIFICATION TESTS

### Test 1: Node Registration

```bash
# On control plane machine, check if node registered
curl -s http://localhost:3000/api/v1/nodes | jq '.'

# Or check database directly
sqlite3 allternit.db "SELECT id, hostname, status FROM nodes;"
```

**Expected Result:**
```json
{
  "connected": ["node-prod-test-xxx"],
  "all_nodes": [
    {
      "id": "node-prod-test-xxx",
      "hostname": "vps-hostname",
      "status": "online",
      "docker_available": true
    }
  ]
}
```

---

### Test 2: Heartbeat Monitoring

```bash
# Watch control plane logs for heartbeats
# On control plane machine
tail -f logs/api.log | grep "Heartbeat from"

# Or query node status every 10 seconds
watch -n 10 'curl -s http://localhost:3000/api/v1/nodes | jq ".connected"'
```

**Expected Result:**
- Heartbeat received every 30 seconds
- Node stays in "online" status

---

### Test 3: Job Submission & Execution

```bash
# Create a test job via API
curl -X POST http://localhost:3000/api/v1/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "name": "test-job-1",
    "wih": {
      "handler": "shell",
      "version": "1.0",
      "task": {
        "type": "shell",
        "command": "echo \"Hello from Allternit! $(date)\""
      },
      "tools": []
    },
    "resources": {
      "cpu_cores": 1,
      "memory_gb": 1,
      "disk_gb": 1,
      "gpu": false
    },
    "priority": 10,
    "timeout_secs": 60
  }' | jq '.'
```

**Expected Result:**
```json
{
  "job_id": "job-xxx-xxx-xxx",
  "status": "queued"
}
```

**Monitor Job Execution:**
```bash
# Watch job status
watch -n 2 'curl -s http://localhost:3000/api/v1/jobs | jq "."'

# Watch node logs for job execution
ssh ${VPS_USER}@${VPS_HOST} "sudo journalctl -u allternit-node -f | grep -i job"
```

**Expected Flow:**
1. Job queued (status: "pending")
2. Job dispatched to node (status: "scheduled")
3. Job started on node (status: "running")
4. Job completed (status: "completed")

---

### Test 4: Real-time WebSocket Updates

```bash
# Connect to job events WebSocket
websocat ws://localhost:3000/ws/jobs/events

# In another terminal, submit a job
curl -X POST http://localhost:3000/api/v1/jobs \
  -H "Content-Type: application/json" \
  -d '{"name":"ws-test","wih":{"handler":"shell","task":{"type":"shell","command":"echo test"}}}'
```

**Expected Result:**
```json
{"event_type":"job_started","job_id":"job-xxx","status":"running","timestamp":"..."}
{"event_type":"job_progress","job_id":"job-xxx","progress":0.5,"message":"Running...","timestamp":"..."}
{"event_type":"job_completed","job_id":"job-xxx","status":"completed","timestamp":"..."}
```

---

### Test 5: Node Resource Monitoring

```bash
# Check node capabilities and resource usage
curl -s http://localhost:3000/api/v1/nodes/node-prod-test-xxx | jq '.'
```

**Expected Result:**
```json
{
  "node": {
    "id": "node-prod-test-xxx",
    "hostname": "vps-hostname",
    "cpu_cores": 2,
    "memory_gb": 4,
    "disk_gb": 50,
    "docker_available": true,
    "gpu_available": false,
    "status": "online"
  },
  "connected": true
}
```

---

### Test 6: Job Cancellation

```bash
# Submit a long-running job
JOB_ID=$(curl -X POST http://localhost:3000/api/v1/jobs \
  -H "Content-Type: application/json" \
  -d '{"name":"cancel-test","wih":{"handler":"shell","task":{"type":"shell","command":"sleep 60"}}}' \
  | jq -r '.job_id')

echo "Job ID: $JOB_ID"

# Wait a moment for job to start
sleep 3

# Cancel the job
curl -X POST http://localhost:3000/api/v1/jobs/${JOB_ID}/cancel

# Check job status
curl -s http://localhost:3000/api/v1/jobs/${JOB_ID} | jq '.job.status'
```

**Expected Result:**
```
"cancelled"
```

---

### Test 7: Node Disconnect & Reconnect

```bash
# Stop node agent
ssh ${VPS_USER}@${VPS_HOST} "sudo systemctl stop allternit-node"

# Check node status (should show offline after ~60 seconds)
curl -s http://localhost:3000/api/v1/nodes | jq '.[]'

# Start node agent again
ssh ${VPS_USER}@${VPS_HOST} "sudo systemctl start allternit-node"

# Wait for reconnection
sleep 5

# Check node status (should be online again)
curl -s http://localhost:3000/api/v1/nodes | jq '.connected'
```

**Expected Result:**
- Node goes offline when stopped
- Node reconnects automatically when started
- No manual intervention required

---

### Test 8: Multiple Concurrent Jobs

```bash
# Submit 5 jobs simultaneously
for i in {1..5}; do
  curl -X POST http://localhost:3000/api/v1/jobs \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"concurrent-job-$i\",\"wih\":{\"handler\":\"shell\",\"task\":{\"type\":\"shell\",\"command\":\"echo Job $i && sleep 2\"}}}" &
done

# Wait for all to complete
wait

# Check job queue stats
curl -s http://localhost:3000/api/v1/jobs/stats | jq '.'
```

**Expected Result:**
```json
{
  "pending": 0,
  "running": 0,
  "completed": 5,
  "failed": 0,
  "cancelled": 0
}
```

---

### Test 9: Terminal Session (If UI Available)

```bash
# Create terminal session
curl -X POST http://localhost:3000/api/v1/nodes/node-prod-test-xxx/terminal \
  -H "Content-Type: application/json" \
  -d '{"shell":"/bin/bash","cols":80,"rows":24}' | jq '.'

# Note: Full terminal testing requires WebSocket client
# Use websocat or similar tool
```

---

### Test 10: Node Deletion

```bash
# Get node ID
NODE_ID="node-prod-test-xxx"

# Delete node
curl -X DELETE http://localhost:3000/api/v1/nodes/${NODE_ID}

# Check node status (should be gone)
curl -s http://localhost:3000/api/v1/nodes | jq '.'

# Check VPS logs for shutdown message
ssh ${VPS_USER}@${VPS_HOST} "sudo journalctl -u allternit-node | grep -i shutdown | tail -5"
```

**Expected Result:**
- Node removed from database
- Node agent receives shutdown message
- Node agent exits gracefully

---

## 📊 TEST RESULTS TEMPLATE

| Test | Status | Notes |
|------|--------|-------|
| 1. Node Registration | ⬜ Pass / ⬜ Fail | |
| 2. Heartbeat Monitoring | ⬜ Pass / ⬜ Fail | |
| 3. Job Execution | ⬜ Pass / ⬜ Fail | |
| 4. WebSocket Updates | ⬜ Pass / ⬜ Fail | |
| 5. Resource Monitoring | ⬜ Pass / ⬜ Fail | |
| 6. Job Cancellation | ⬜ Pass / ⬜ Fail | |
| 7. Disconnect/Reconnect | ⬜ Pass / ⬜ Fail | |
| 8. Concurrent Jobs | ⬜ Pass / ⬜ Fail | |
| 9. Terminal Session | ⬜ Pass / ⬜ Fail / ⬜ N/A | |
| 10. Node Deletion | ⬜ Pass / ⬜ Fail | |

**Overall Status:** ⬜ All Pass / ⬜ Some Issues

---

## 🐛 TROUBLESHOOTING

### Node Won't Connect

```bash
# Check if control plane is running
curl -I http://localhost:3000/health

# Check firewall
sudo ufw status

# Check node logs
sudo journalctl -u allternit-node -n 50

# Test WebSocket connection manually
websocat ws://localhost:3000/ws/nodes/test-node
```

### Jobs Not Executing

```bash
# Check Docker on VPS
ssh ${VPS_USER}@${VPS_HOST} "docker ps"

# Check node logs for job errors
ssh ${VPS_USER}@${VPS_HOST} "sudo journalctl -u allternit-node | grep -i job"

# Check job queue
curl -s http://localhost:3000/api/v1/jobs/stats | jq '.'
```

### Heartbeat Not Received

```bash
# Check node agent status
ssh ${VPS_USER}@${VPS_HOST} "systemctl status allternit-node"

# Check network connectivity
ssh ${VPS_USER}@${VPS_HOST} "curl -I http://localhost:3000/health"

# Restart node agent
ssh ${VPS_USER}@${VPS_HOST} "sudo systemctl restart allternit-node"
```

---

## 📝 POST-TEST CLEANUP

```bash
# Stop node agent
ssh ${VPS_USER}@${VPS_HOST} "sudo systemctl stop allternit-node"

# Remove service
ssh ${VPS_USER}@${VPS_HOST} "sudo systemctl disable allternit-node"
ssh ${VPS_USER}@${VPS_HOST} "sudo rm /etc/systemd/system/allternit-node.service"

# Remove files
ssh ${VPS_USER}@${VPS_HOST} "sudo rm -rf /opt/allternit /etc/allternit /var/log/allternit"

# Clear database (if testing locally)
rm -f allternit.db
```

---

## ✅ SUCCESS CRITERIA

The E2E test is considered **successful** if:

1. ✅ Node registers successfully with control plane
2. ✅ Heartbeats received every 30 seconds
3. ✅ Jobs execute and complete successfully
4. ✅ Real-time WebSocket updates work
5. ✅ Resource metrics are accurate
6. ✅ Job cancellation works
7. ✅ Auto-reconnect works after disconnect
8. ✅ Multiple concurrent jobs execute
9. ✅ Node deletion triggers graceful shutdown

---

**Ready to begin testing! Let me know your VPS details and I'll help you through each step.** 🚀
