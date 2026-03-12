# Production Deployment Guide

**Agent Communication System - Production Ready**

## Prerequisites

- Node.js 18+ or Bun 1.0+
- Git installed
- a2rchitech platform running

## Installation

### 1. Install Dependencies

```bash
cd /Users/macbook/Desktop/a2rchitech-workspace/a2rchitech
pnpm install
```

### 2. Verify Installation

```bash
# Run verification tests
cd cmd/gizzi-code
bun run test-verify-integration.ts

# Expected: 10/10 PASS
```

## Configuration

### Environment Variables

```bash
# Optional: Custom rate limits
A2R_RATE_LIMIT_DEFAULT_REQUESTS=100
A2R_RATE_LIMIT_DEFAULT_WINDOW_MS=60000

# Optional: Git bundle size limit (MB)
A2R_GIT_BUNDLE_MAX_SIZE_MB=50

# Optional: API key expiration (days)
A2R_AUTH_KEY_DEFAULT_EXPIRY_DAYS=30
```

### Rate Limit Configuration

Edit `cmd/gizzi-code/src/runtime/integrations/rate-limiter/rate-limiter.ts`:

```typescript
const defaultLimits: RateLimitConfig = {
  maxRequests: 100,    // Adjust as needed
  windowMs: 60000,     // 1 minute
  burstLimit: 20,      // Allow short bursts
}
```

### Git Bundle Configuration

Edit `cmd/gizzi-code/src/runtime/integrations/git-bundle/git-bundle.ts`:

```typescript
const defaultConfig: BundleConfig = {
  maxBundleSizeMB: 50,  // Adjust as needed
  allowedRefPatterns: ['refs/heads/*', 'refs/tags/*'],
  requireValidation: true,
}
```

## Deployment Steps

### 1. Build the System

```bash
cd /Users/macbook/Desktop/a2rchitech-workspace/a2rchitech
pnpm build
```

### 2. Initialize Workspace

```bash
# Create .a2r/communication directory structure
mkdir -p .a2r/communication
touch .a2r/communication/{messages.jsonl,channels.json,mentions.jsonl,loop-guard.jsonl}
```

### 3. Start the Platform

```bash
# Start main platform
pnpm dev

# Or start specific services
cd cmd/gizzi-code
bun run src/cli/main.ts
```

### 4. Verify Deployment

```bash
# Test CLI
ac --help

# Test authentication
ac auth create --agent-id test-1 --agent-name "Test Agent"

# Test communication
ac send "Test message" --to builder

# Test Git DAG
ac git leaves --repo /path/to/repo
```

## Monitoring

### Health Checks

```bash
# Check rate limit status
ac rate-limit show --agent-id <agent-id>

# Check API keys
ac auth list --agent-id <agent-id>

# Check workspace state
ls -la .a2r/communication/
```

### Logs

Logs are written to standard output with service tags:

```
INFO  service=agent-auth Generated API key for agent
INFO  service=agent-rate-limiter Rate limit exceeded
INFO  service=git-dag Tracked commit
INFO  service=bus type=agent.communicate.message.sent publishing
```

### Metrics to Monitor

1. **Authentication**
   - Keys generated per hour
   - Validation success rate
   - Revocation count

2. **Rate Limiting**
   - Requests per agent
   - Rate limit violations
   - Burst limit hits

3. **Git Operations**
   - Bundles created
   - Bundle validation failures
   - Commits tracked

4. **Communication**
   - Messages sent
   - @mentions routed
   - Loop guard triggers

## Scaling

### Horizontal Scaling

The system supports multiple instances:

1. **Shared State**: Use Redis for rate limit state
2. **Bus Events**: Use message queue (RabbitMQ, Kafka)
3. **Workspace**: Use shared filesystem (NFS, S3)

### Vertical Scaling

Adjust limits based on capacity:

```typescript
// Higher limits for powerful instances
const highCapacityLimits = {
  maxRequests: 1000,
  windowMs: 60000,
  burstLimit: 100,
}
```

## Security

### API Key Security

1. **Store Securely**: Never log plain text keys
2. **Rotate Regularly**: Set expiration dates
3. **Revoke Compromised**: Use `ac auth revoke`

### Rate Limiting

Prevents abuse:

```bash
# Default: 60 requests/minute for communicate:send
# Adjust based on your needs
```

### Git Bundle Validation

Prevents malicious bundles:

```typescript
// Validates:
// - Size limits
// - Ref patterns
// - Bundle integrity
```

## Backup and Recovery

### Backup Workspace State

```bash
# Backup communication state
tar -czf communication-backup.tar.gz .a2r/communication/

# Backup to remote storage
aws s3 cp .a2r/communication/ s3://bucket/a2r/communication/ --recursive
```

### Recovery

```bash
# Restore from backup
tar -xzf communication-backup.tar.gz

# Or from S3
aws s3 cp s3://bucket/a2r/communication/ .a2r/communication/ --recursive
```

## Troubleshooting

### Issue: Rate Limit Too Strict

**Solution:**
```typescript
// Increase limits
AgentRateLimiter.setAgentLimits({
  agentId: 'agent-1',
  limits: {
    'communicate:send': {
      maxRequests: 200,  // Increased from 60
      windowMs: 60000,
    },
  },
})
```

### Issue: Git Bundle Too Large

**Solution:**
```bash
# Split into smaller bundles
ac git bundle create HEAD~10..HEAD~5 --repo /path --agent-id agent-1
ac git bundle create HEAD~5..HEAD --repo /path --agent-id agent-1
```

### Issue: API Key Expired

**Solution:**
```bash
# Create new key
ac auth create --agent-id agent-1 --agent-name "Agent" --expires 30

# Revoke old key
ac auth revoke <old-key-id>
```

## Performance Tuning

### Optimize Rate Limit Cleanup

```typescript
// Run cleanup more frequently
setInterval(() => {
  AgentRateLimiter.cleanup()
}, 60 * 1000) // Every minute instead of 5 minutes
```

### Optimize Git DAG Cache

```typescript
// Pre-load frequently accessed commits
const frontier = GitDAGTracker.getFrontier()
for (const hash of frontier) {
  GitDAGTracker.getCommit(hash) // Cache it
}
```

### Optimize Workspace I/O

```typescript
// Batch message writes
const messages = [msg1, msg2, msg3]
await Promise.all(
  messages.map(msg => AgentWorkspaceCommunication.logMessage(msg))
)
```

## Production Checklist

- [ ] Rate limits configured
- [ ] API key expiration set
- [ ] Git bundle size limits set
- [ ] Backup strategy implemented
- [ ] Monitoring configured
- [ ] Logs aggregated
- [ ] Security audit completed
- [ ] Performance tested
- [ ] Documentation reviewed
- [ ] Team trained

## Support

For issues or questions:

1. Check logs for error messages
2. Review configuration
3. Run verification tests
4. Check documentation

## License

MIT
