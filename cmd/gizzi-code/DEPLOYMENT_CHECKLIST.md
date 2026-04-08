# Gizzi Code Deployment Checklist

**Status:** Code ready, awaiting deployment

---

## Step 1: Monitor GitHub Actions Build

**URL:** https://github.com/Gizziio/allternit-platform/actions

**Expected workflows running:**
- `Release Gizzi Code` - Building binaries

**What should happen:**
1. Build for darwin-arm64 (macOS Apple Silicon) ✅
2. Build for darwin-x64 (macOS Intel) ✅
3. Build for linux-arm64 ✅
4. Build for linux-x64 ✅
5. Build for windows-x64 ✅
6. Create Release with all binaries attached ✅

**If build fails:**
- Check Actions logs for errors
- Common issues: Missing dependencies, build script errors

---

## Step 2: Deploy to Cloudflare Pages

**Deployment package:** `cmd/gizzi-code/gizzi-install-DEPLOY.zip`

### Option A: Manual Upload (Easiest)

1. Go to https://dash.cloudflare.com
2. Navigate to **Pages**
3. Click **Create a project**
4. Choose **Upload assets**
5. Select `gizzi-install-DEPLOY.zip`
6. Set project name: `gizzi-install`
7. After upload, go to **Custom domains**
8. Add domain: `install.gizziio.com`
9. Follow DNS setup instructions

### Option B: Wrangler CLI

```bash
# Login to Cloudflare
wrangler login

# Deploy
cd cmd/gizzi-code/gizzi-install-site
wrangler pages deploy . --project-name=gizzi-install

# Add custom domain
wrangler pages domain add gizzi-install install.gizziio.com
```

---

## Step 3: Test Install Command

### Test 1: Verify Install Script URL

```bash
# Should return the install script content
curl -fsSL https://install.gizziio.com/install | head -20
```

**Expected output:**
```bash
#!/usr/bin/env bash
set -euo pipefail
APP=gizzi-code
...
```

### Test 2: Dry Run Install

```bash
# Download and inspect install script
curl -fsSL https://install.gizziio.com/install -o /tmp/install-test.sh

# Check it's the correct script
grep "Gizziio/allternit-platform" /tmp/install-test.sh && echo "✅ URL correct"
grep "APP=gizzi-code" /tmp/install-test.sh && echo "✅ App name correct"
```

### Test 3: Full Install Test (After GitHub Release)

```bash
# Clean install test
rm -rf ~/.gizzi

# Run install
curl -fsSL https://install.gizziio.com/install | bash

# Verify
~/.gizzi/bin/gizzi-code --version
```

### Test 4: Windows PowerShell Install

```powershell
# On Windows
irm https://install.gizziio.com/install.ps1 | iex
```

---

## Step 4: Verify GitHub Release Assets

**URL:** https://github.com/Gizziio/allternit-platform/releases

**Expected assets on release `gizzi-code/v0.1.0`:**

```
gizzi-code-v0.1.0-darwin-arm64.tar.gz   # macOS Apple Silicon
gizzi-code-v0.1.0-darwin-x64.tar.gz     # macOS Intel
gizzi-code-v0.1.0-linux-arm64.tar.gz    # Linux ARM64
gizzi-code-v0.1.0-linux-x64.tar.gz      # Linux x64
gizzi-code-v0.1.0-windows-x64.zip       # Windows x64
```

**Verify each asset:**
```bash
# Download and check a binary
url="https://github.com/Gizziio/allternit-platform/releases/download/gizzi-code/v0.1.0/gizzi-code-v0.1.0-darwin-arm64.tar.gz"
curl -L "$url" -o /tmp/test.tar.gz
tar -tzf /tmp/test.tar.gz
```

---

## Step 5: Update Documentation

After deployment succeeds, update these docs:

1. **docs.gizziio.com**
   - Installation page with verified commands
   - Tested and working examples

2. **README.md** in allternit-platform
   - Add install instructions
   - Add badges for build status

---

## Troubleshooting

### Issue: GitHub Actions build fails

**Check:**
```bash
# View workflow file
.cat .github/workflows/release-gizzi-code.yml

# Common fixes:
# - Ensure bun is installed in workflow
# - Check build script exists: cmd/gizzi-code/script/build-production.ts
```

### Issue: Install script 404s

**Check:**
```bash
# Verify Cloudflare Pages is serving
curl -I https://install.gizziio.com/install

# Should return: HTTP/2 200
```

### Issue: Binary download fails

**Check:**
```bash
# Verify release exists
curl -I https://github.com/Gizziio/allternit-platform/releases/download/gizzi-code/v0.1.0/gizzi-code-v0.1.0-darwin-arm64.tar.gz

# Should return: HTTP/2 302 or 200
```

### Issue: Binary runs but errors

**Check:**
```bash
# Verify binary architecture matches system
file ~/.gizzi/bin/gizzi-code

# Should show correct architecture
```

---

## Pre-Launch Verification

Before announcing the install command works:

- [ ] GitHub Actions completed successfully
- [ ] All 5 binaries attached to release
- [ ] Install site deployed to install.gizziio.com
- [ ] curl command returns install script
- [ ] Install script downloads binary successfully
- [ ] Binary runs: `gizzi-code --version` returns version
- [ ] Binary starts TUI: `gizzi-code` opens interface
- [ ] Windows PowerShell install works
- [ ] Re-install works (update scenario)

---

## Post-Launch Monitoring

After launch, monitor:

1. **GitHub Actions** for build failures
2. **Cloudflare Pages** analytics for install traffic
3. **GitHub Release** download counts
4. User feedback on install issues

---

## Short Term Tasks (Next 2 Weeks)

After immediate deployment:

1. **Add Cloudflare CDN caching**
   - Page Rules for static assets
   - Browser cache TTL: 1 hour for install scripts

2. **Publish to NPM**
   - Add NPM_TOKEN to GitHub Secrets
   - Trigger publish workflow
   - Test: `npm install -g @a2r/gizzi-code`

3. **Submit Homebrew formula**
   - Calculate SHA256s from release binaries
   - Submit PR to homebrew-core
   - Or create custom tap

---

## Current Status

| Component | Status | Location |
|-----------|--------|----------|
| Install script (bash) | ✅ Ready | cmd/gizzi-code/install |
| Install script (PowerShell) | ✅ Ready | cmd/gizzi-code/install.ps1 |
| GitHub Actions workflow | ✅ Ready | .github/workflows/release-gizzi-code.yml |
| Deployment package | ✅ Ready | cmd/gizzi-code/gizzi-install-DEPLOY.zip |
| Git tag | ✅ Pushed | gizzi-code/v0.1.0 |
| Cloudflare Pages | ⏳ Pending | Manual upload required |
| GitHub Release | ⏳ Building | Check Actions |

---

**Last Updated:** April 8, 2026
