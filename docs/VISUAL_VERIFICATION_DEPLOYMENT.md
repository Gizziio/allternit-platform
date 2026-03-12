# Visual Verification Deployment Guide

Complete guide for deploying the visual verification system with A2R Autoland.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              PRODUCTION STACK                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────┐      gRPC       ┌─────────────────────────┐   │
│  │   Rust Substrate        │◄────────────────►│  TypeScript gizzi-code  │   │
│  │   (0-substrate)         │   localhost:50051│  (cmd/gizzi-code)       │   │
│  │                         │                  │                         │   │
│  │  • autoland_wih()       │                  │  • VisualCaptureManager │   │
│  │  • Visual verification  │                  │  • gRPC server          │   │
│  │  • Policy enforcement   │                  │  • Browser automation   │   │
│  │                         │                  │                         │   │
│  │  VerificationProvider   │                  │  GatherEvidence RPC     │   │
│  │  ├─ GrpcProvider        │                  │  ├─ UI screenshots      │   │
│  │  └─ FileBasedProvider   │                  │  ├─ Coverage maps       │   │
│  │                         │                  │  ├─ Console logs        │   │
│  │  Policy: 80% threshold  │                  │  └─ Visual diffs        │   │
│  │          30s timeout    │                  │                         │   │
│  └─────────────────────────┘                  └─────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────┐                                                │
│  │   Governance Layer      │                                                │
│  │   (2-governance)        │                                                │
│  │                         │                                                │
│  │  visual-verification.json                                              │
│  │  {                       │                                                │
│  │    "enabled": true,      │                                                │
│  │    "min_confidence": 0.8,│                                                │
│  │    "provider_type": "Grpc"│                                                │
│  │  }                       │                                                │
│  └─────────────────────────┘                                                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Deployment Modes

### Mode 1: Production (gRPC)

**Use when:** High performance, production workloads

**Characteristics:**
- Synchronous gRPC calls (30s timeout)
- No file polling overhead
- Type-safe contracts
- Best for CI/CD pipelines

**Setup:**

```bash
# 1. Start TypeScript gRPC server
cd /Users/macbook/Desktop/a2rchitech-workspace/a2rchitech/cmd/gizzi-code
VERIFICATION_GRPC_PORT=50051 bun run start

# 2. Configure governance for gRPC
cat > /Users/macbook/Desktop/a2rchitech-workspace/a2rchitech/2-governance/config/visual-verification.json << 'EOF'
{
  "enabled": true,
  "min_confidence": 0.8,
  "required_types": ["UiState", "CoverageMap", "ConsoleOutput", "VisualDiff"],
  "provider_type": "Grpc",
  "timeout_seconds": 30,
  "allow_bypass": false,
  "bypass_roles": []
}
EOF

# 3. Start Rust substrate with gRPC provider
cd /Users/macbook/Desktop/a2rchitech-workspace/a2rchitech/0-substrate/a2r-agent-system-rails
cargo run --bin a2r-rails --release
```

### Mode 2: Development (File-Based)

**Use when:** Debugging, local development, simple setups

**Characteristics:**
- File polling (checks every 500ms)
- Evidence files in `.a2r/evidence/`
- More lenient timeouts
- Easy to inspect manually

**Setup:**

```bash
# 1. Start TypeScript (no gRPC server needed)
cd /Users/macbook/Desktop/a2rchitech-workspace/a2rchitech/cmd/gizzi-code
bun run dev

# 2. Configure governance for file mode
cat > /Users/macbook/Desktop/a2rchitech-workspace/a2rchitech/2-governance/config/visual-verification.json << 'EOF'
{
  "enabled": true,
  "min_confidence": 0.6,
  "required_types": ["ConsoleOutput", "CoverageMap"],
  "provider_type": "FileBased",
  "timeout_seconds": 120,
  "allow_bypass": true,
  "bypass_roles": ["developer", "admin"]
}
EOF

# 3. Start Rust substrate
cargo run --bin a2r-rails
```

### Mode 3: Hybrid (Auto)

**Use when:** Mixed environments, graceful degradation needed

**Characteristics:**
- Tries gRPC first
- Falls back to file if gRPC unavailable
- Best for transition periods

**Setup:**

```typescript
// TypeScript side: Both services start
configureVisualAutoland({
  enabled: true,
  mode: "auto",
  fallbackToFile: true,
});

// Rust side: Reads policy, creates appropriate provider
let provider = ProviderFactory::create(policy.provider_type, &config);
```

## Environment-Specific Configurations

### Development

```json
{
  "enabled": true,
  "min_confidence": 0.5,
  "required_types": [],
  "provider_type": "FileBased",
  "timeout_seconds": 120,
  "allow_bypass": true,
  "bypass_roles": ["developer"]
}
```

### Staging

```json
{
  "enabled": true,
  "min_confidence": 0.7,
  "required_types": ["ConsoleOutput", "CoverageMap"],
  "provider_type": "FileBased",
  "timeout_seconds": 60,
  "allow_bypass": true,
  "bypass_roles": ["admin"]
}
```

### Production

```json
{
  "enabled": true,
  "min_confidence": 0.8,
  "required_types": ["UiState", "CoverageMap", "ConsoleOutput", "VisualDiff"],
  "provider_type": "Grpc",
  "timeout_seconds": 30,
  "allow_bypass": false,
  "bypass_roles": []
}
```

## Deployment Steps

### Step 1: Build Rust Substrate

```bash
cd /Users/macbook/Desktop/a2rchitech-workspace/a2rchitech/0-substrate/a2r-agent-system-rails

# Generate gRPC code from proto
cargo build

# Run tests
cargo test visual_verification

# Build release
cargo build --release
```

### Step 2: Build TypeScript gizzi-code

```bash
cd /Users/macbook/Desktop/a2rchitech-workspace/a2rchitech/cmd/gizzi-code

# Install dependencies
bun install

# Build
bun run build

# Run type check
bun run typecheck
```

### Step 3: Configure Governance

```bash
# Copy default config
sudo cp /Users/macbook/Desktop/a2rchitech-workspace/a2rchitech/2-governance/config/visual-verification.default.json \
        /etc/a2rchitech/policies/visual-verification.json

# Edit for environment
sudo nano /etc/a2rchitech/policies/visual-verification.json
```

### Step 4: Start Services

**Systemd service for Rust substrate:**

```ini
# /etc/systemd/system/a2r-substrate.service
[Unit]
Description=A2R Substrate (Visual Verification)
After=network.target

[Service]
Type=simple
User=a2r
WorkingDirectory=/Users/macbook/Desktop/a2rchitech-workspace/a2rchitech
Environment="RUST_LOG=info,visual_verification=debug"
Environment="GOVERNANCE_CONFIG=/etc/a2rchitech/policies"
ExecStart=/Users/macbook/Desktop/a2rchitech-workspace/a2rchitech/target/release/a2r-rails
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

**Systemd service for TypeScript gRPC:**

```ini
# /etc/systemd/system/a2r-verification.service
[Unit]
Description=A2R Visual Verification (gRPC)
After=network.target

[Service]
Type=simple
User=a2r
WorkingDirectory=/Users/macbook/Desktop/a2rchitech-workspace/a2rchitech/cmd/gizzi-code
Environment="VERIFICATION_GRPC_PORT=50051"
Environment="NODE_ENV=production"
ExecStart=/usr/bin/bun run start
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

**Enable and start:**

```bash
sudo systemctl daemon-reload
sudo systemctl enable a2r-substrate a2r-verification
sudo systemctl start a2r-substrate a2r-verification
```

### Step 5: Verify Deployment

```bash
# Check Rust substrate is running
sudo systemctl status a2r-substrate

# Check TypeScript gRPC is running
sudo systemctl status a2r-verification

# Check gRPC port is listening
netstat -tlnp | grep 50051

# Test health endpoint
grpcurl -plaintext localhost:50051 verification.VerificationProvider/HealthCheck

# Run integration tests
cargo test --test visual_verification_integration
```

## Monitoring

### Prometheus Metrics

Rust substrate exposes metrics at `:9090/metrics`:

```
# HELP visual_verification_requests_total Total verification requests
visual_verification_requests_total 1523

# HELP visual_verification_successes_total Successful verifications
visual_verification_successes_total 1421

# HELP visual_verification_failures_total Failed verifications
visual_verification_failures_total 102

# HELP visual_verification_in_flight Current in-flight verifications
visual_verification_in_flight 3
```

### Grafana Dashboard

Import dashboard `dashboards/visual-verification.json`:

- Verification success rate
- Average confidence score
- Duration histograms
- Provider type breakdown
- Top failure reasons

### Alerting Rules

```yaml
# alerts/visual-verification.yml
groups:
  - name: visual-verification
    rules:
      - alert: HighVisualVerificationFailureRate
        expr: |
          (
            rate(visual_verification_failures_total[5m])
            /
            rate(visual_verification_requests_total[5m])
          ) > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High visual verification failure rate"
          
      - alert: VisualVerificationTimeout
        expr: rate(visual_verification_timeouts_total[5m]) > 0.05
        for: 2m
        labels:
          severity: critical
```

## Troubleshooting

### Issue: Visual verification always times out

**Symptoms:**
- `autoland_wih` returns "Visual verification timeout"
- No evidence files in `.a2r/evidence/`

**Diagnosis:**
```bash
# Check TypeScript service is running
systemctl status a2r-verification
journalctl -u a2r-verification -f

# Check if dev server is accessible
curl http://localhost:3000

# Check gRPC connectivity
grpcurl -plaintext localhost:50051 verification.VerificationProvider/HealthCheck
```

**Solutions:**
1. Increase timeout: `"timeout_seconds": 120`
2. Check dev server is running before WIH completes
3. Verify gRPC port is not blocked by firewall

### Issue: Confidence always low

**Symptoms:**
- Visual verification fails with "confidence 45% below threshold 70%"

**Diagnosis:**
```bash
# Inspect evidence file
cat .a2r/evidence/{wih_id}.json | jq '.artifacts[].confidence'

# Check browser logs
journalctl -u a2r-verification | grep -i "browser\|capture"
```

**Solutions:**
1. Lower threshold for development: `"min_confidence": 0.5`
2. Check browser automation is working (Playwright/agent-browser)
3. Verify coverage reports are being generated

### Issue: gRPC connection refused

**Symptoms:**
- Rust error: "Connection refused (os error 111)"

**Diagnosis:**
```bash
# Check port is listening
netstat -tlnp | grep 50051

# Check TypeScript service logs
journalctl -u a2r-verification -n 100
```

**Solutions:**
1. Start TypeScript service: `bun run start`
2. Check port binding: `VERIFICATION_GRPC_PORT=50051`
3. Use file-based mode as fallback

### Issue: Policy changes not taking effect

**Symptoms:**
- Changed `min_confidence` in config but old value still used

**Diagnosis:**
```bash
# Check config file is being read
cat /etc/a2rchitech/policies/visual-verification.json

# Check logs for policy load
journalctl -u a2r-substrate | grep -i "policy\|governance"
```

**Solutions:**
1. Restart substrate: `sudo systemctl restart a2r-substrate`
2. Check config path in environment: `GOVERNANCE_CONFIG=/etc/a2rchitech/policies`
3. Validate JSON syntax: `jq . /etc/a2rchitech/policies/visual-verification.json`

## Rollback Procedure

If visual verification causes issues:

```bash
# 1. Disable visual verification (emergency)
sudo tee /etc/a2rchitech/policies/visual-verification.json << 'EOF'
{
  "enabled": false
}
EOF

# 2. Restart substrate
sudo systemctl restart a2r-substrate

# 3. Verify autoland works without visual
./scripts/test-autoland.sh

# 4. Re-enable when fixed
# (restore original config and restart)
```

## Performance Tuning

### High-Volume Deployments

```json
{
  "enabled": true,
  "min_confidence": 0.75,
  "required_types": ["ConsoleOutput"],
  "provider_type": "Grpc",
  "timeout_seconds": 20,
  "allow_bypass": false
}
```

- Lower threshold for faster feedback
- Reduce required types
- Shorter timeout
- gRPC for lower latency

### CI/CD Optimization

```typescript
// Cache visual evidence between runs
const evidence = await captureForWih(wihId, {
  cacheKey: `${commitSha}-${fileHash}`,
  cacheTTL: 3600, // 1 hour
});
```

## Security Considerations

1. **gRPC TLS:** In production, use TLS for gRPC:
   ```rust
   Channel::builder(endpoint)
       .tls_config(ClientTlsConfig::new())?
       .connect()
       .await?
   ```

2. **Evidence Cleanup:** Old evidence files may contain screenshots:
   ```json
   {
     "auto_cleanup": true,
     "cleanup_max_age_hours": 24
   }
   ```

3. **Bypass Audit:** All bypasses are logged:
   ```
   Event: VisualVerificationBypassed
   wih_id: wih_123
   bypassed_by: admin
   reason: "Emergency hotfix"
   ```

## Next Steps

1. [ ] Deploy to staging environment
2. [ ] Run integration tests
3. [ ] Monitor metrics for 1 week
4. [ ] Tune confidence thresholds
5. [ ] Deploy to production
6. [ ] Enable alerting
7. [ ] Train team on bypass procedures
