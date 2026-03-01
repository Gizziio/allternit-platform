# OpenClaw Vendor Directory

**Version**: 2026.1.29  
**Purpose**: Quarantined OpenClaw codebase for strangler migration  
**Status**: 🔒 LOCKED - See update procedure below

---

## Architecture Locks

### LOCK 1: Node is never allowed into kernel directly

**Rule**: All OpenClaw interaction MUST go through `OpenClawHost` RPC boundary.

**Violations**:
- ❌ Importing from `vendor/openclaw/` in any module except `openclaw_host/`
- ❌ Direct Node.js FFI calls
- ❌ In-process execution of OpenClaw code

**Compliant Pattern**:
```rust
// CORRECT: Through host boundary
let mut host = OpenClawHost::start(config).await?;
let result = host.call("skills.list", json!({})).await?;
host.stop().await?;
```

### LOCK 2: Parity corpus is the authority

**Rule**: Nothing graduates from OpenClaw without ≥500 corpus replays and 0 semantic diffs.

**Requirement**: Every call to OpenClaw generates a receipt in `.migration/openclaw-absorption/corpus/`.

---

## Directory Structure

```
3-adapters/vendor/openclaw/
├── dist/                   # Compiled TypeScript (61 modules)
├── skills/                 # 53 built-in skills
├── extensions/             # 32 extension channels
├── docs/                   # Documentation
├── package.json            # npm manifest
├── VENDOR.md               # This file
└── README.md               # Original OpenClaw docs
```

**Total**: ~5,867 files, 400+ directories

---

## Update Procedure

### When to Update

Only update vendor code when:
1. Critical security patch in OpenClaw
2. Bug fix affecting functionality
3. New feature required for parity

### How to Update

1. **Create tracking issue**
   ```markdown
   Title: Vendor Update: OpenClaw 2026.1.29 → 2026.2.1
   Labels: vendor-update, security|bug|feature
   ```

2. **Backup current state**
   ```bash
   cp -r 3-adapters/vendor/openclaw \
         3-adapters/vendor/openclaw-backup-$(date +%Y%m%d)
   ```

3. **Extract new version**
   ```bash
   # Download new OpenClaw version
   npm pack openclaw@NEW_VERSION
   
   # Extract to temp directory
   tar -xzf openclaw-*.tgz -C /tmp/openclaw-new
   
   # Sync to vendor directory
   rsync -av --delete /tmp/openclaw-new/package/ \
          3-adapters/vendor/openclaw/
   ```

4. **Update VENDOR.md**
   - Update version number
   - Document reason for update
   - Note any breaking changes

5. **Run parity tests**
   ```bash
   cargo test --features parity-tests
   ```

6. **Create PR with `vendor-update` label**
   - Requires 2 admin approvals
   - Must pass vendor-guard CI

---

## Migration Status

See `.migration/openclaw-absorption/` for:
- Full DAG (20-week migration plan)
- Parity corpus
- Progress reports
- Graduation criteria

---

## Contact

For questions about vendor boundary:
- Architecture review: @a2r-core-team
- Migration lead: [TBD]
- Emergency: #incident-response

---

**Last Updated**: 2026-02-08  
**Next Review**: 2026-03-08
