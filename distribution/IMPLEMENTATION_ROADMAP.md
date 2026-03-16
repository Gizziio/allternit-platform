# A2R Unified Implementation Roadmap

## Phase 1: Local-Only MVP (Weeks 1-4)

### Goal
Desktop with bundled backend, version-locked, single release.

### Tasks
1. **Backend Build Pipeline**
   - [ ] Create 7-apps/a2r-backend/ workspace structure
   - [ ] Build scripts for all platforms (x64, arm64)
   - [ ] GitHub Actions release workflow

2. **Desktop Control Plane**
   - [ ] Create 7-apps/a2r-desktop/ with electron-builder
   - [ ] Bundle backend binaries in extraResources
   - [ ] Backend-manager.ts to extract/start bundled backend
   - [ ] Version manifest with lock

3. **Unified Update**
   - [ ] Desktop auto-update via electron-updater
   - [ ] On update: extract new bundled backend
   - [ ] Restart backend with new version

4. **First-Run Experience**
   - [ ] Splash screen
   - [ ] Extract backend (if not already)
   - [ ] Start backend
   - [ ] Load platform UI

### Deliverable
- A2R Desktop v0.1.0 (macOS, Windows, Linux)
- Works out of the box
- Auto-updates both Desktop and Backend together

---

## Phase 2: VPS Support (Weeks 5-8)

### Goal
Desktop can manage backends on user VPS via SSH.

### Tasks
1. **Connection Manager**
   - [ ] Detect local vs remote backend
   - [ ] SSH connection to VPS
   - [ ] API connection validation

2. **Remote Backend Management**
   - [ ] SSH key management
   - [ ] Upload backend binary to VPS
   - [ ] Install systemd service remotely
   - [ ] Start/stop remote backend

3. **Version Sync for Remote**
   - [ ] Check remote backend version
   - [ ] Upload update if mismatch
   - [ ] Restart remote backend
   - [ ] Verify new version

4. **Onboarding Wizard**
   - [ ] "Add VPS" flow
   - [ ] SSH credentials input
   - [ ] Test connection
   - [ ] Install backend on VPS

### Deliverable
- Desktop can connect to local OR VPS backend
- Version sync works for both
- Unified UX: user doesn't know the difference

---

## Phase 3: Browser PWA (Weeks 9-12)

### Goal
Browser-based UI that connects to existing backend.

### Tasks
1. **Backend Web UI**
   - [ ] Platform UI in a2r-backend/web/platform/
   - [ ] Build as static files
   - [ ] Served by a2r-web-server

2. **PWA Support**
   - [ ] Service worker
   - [ ] Offline capabilities
   - [ ] Install prompt

3. **Connection Dialog**
   - [ ] Browser asks for backend URL
   - [ ] Store in localStorage
   - [ ] Connect and load UI

4. **Shared Components**
   - [ ] Extract UI components to shared package
   - [ ] Used by both Desktop and Browser

### Deliverable
- User can open browser, enter VPS URL, use A2R
- Same UI as Desktop
- No control plane features (just connects)

---

## Phase 4: Production Polish (Weeks 13-16)

### Goal
Enterprise-ready, scalable, secure.

### Tasks
1. **Security**
   - [ ] Code signing (Apple, Windows EV)
   - [ ] Binary checksums
   - [ ] Signed updates
   - [ ] Secure credential storage (keychain)

2. **Enterprise Features**
   - [ ] MSI installer for Windows
   - [ ] PKG installer for macOS
   - [ ] Silent install options
   - [ ] Group Policy support

3. **Observability**
   - [ ] Desktop telemetry (opt-in)
   - [ ] Backend health monitoring
   - [ ] Auto-error reporting
   - [ ] Usage analytics

4. **Documentation**
   - [ ] User docs
   - [ ] Admin docs (VPS setup)
   - [ ] API docs
   - [ ] Troubleshooting guides

### Deliverable
- Production-ready release
- Enterprise distribution
- Full documentation

---

## Technical Decisions

### Version Lock Implementation

```typescript
// a2r-desktop/src/main/manifest.ts
export const MANIFEST = {
  version: process.env.npm_package_version,
  backendVersion: process.env.npm_package_version, // Same!
};

// On connect, Desktop checks backend version
// If mismatch, Desktop pushes update
// User never sees version numbers
```

### Connection Priority

```typescript
// Desktop tries in order:
async function findBackend() {
  // 1. Development mode (localhost:4096)
  if (await checkDevServer()) return devUrl;
  
  // 2. Previously connected VPS
  if (await checkSavedRemote()) return remoteUrl;
  
  // 3. Local bundled backend
  if (fs.exists(bundledPath)) {
    return await startLocalBackend();
  }
  
  // 4. Extract and start bundled
  return await extractAndStartBundled();
}
```

### Update Flow

```typescript
// Desktop update available
autoUpdater.on('update-downloaded', async () => {
  // Get current backend location
  const backend = await getCurrentBackend();
  
  if (backend.type === 'local') {
    // Quit Desktop, install, restart
    // New Desktop will extract new bundled backend
    autoUpdater.quitAndInstall();
  } else if (backend.type === 'remote') {
    // Update remote first
    await updateRemoteBackend(backend.ssh);
    // Then update Desktop
    autoUpdater.quitAndInstall();
  }
});
```

---

## File Structure After Implementation

```
a2rchitech/
├── 7-apps/
│   ├── a2r-desktop/              # Control Plane
│   │   ├── src/
│   │   │   ├── main/
│   │   │   │   ├── connection/
│   │   │   │   ├── backend-management/
│   │   │   │   └── update/
│   │   │   └── renderer/
│   │   ├── bundled-backend/      # Included in repo
│   │   └── package.json
│   │
│   ├── a2r-backend/              # Compute Engine
│   │   ├── crates/
│   │   │   ├── a2r-api/
│   │   │   ├── a2r-kernel/
│   │   │   ├── a2r-memory/
│   │   │   └── a2r-web-server/
│   │   └── web/
│   │       └── platform/         # React UI
│   │
│   └── gizzi-code/               # CLI (separate)
│
├── distribution/
│   ├── desktop/
│   │   ├── electron-builder/
│   │   └── after-install.sh
│   │
│   └── backend/
│       ├── build-scripts/
│       └── install.sh
│
└── .github/workflows/
    └── release.yml
```

---

## Success Metrics

| Metric | Target |
|--------|--------|
| First launch to ready | < 10 seconds |
| Update install time | < 30 seconds |
| Version sync success rate | > 99% |
| VPS connection success | > 95% |
| User confusion (support tickets) | < 5% mention "backend" |

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Version lock too strict | Allow 1 minor version grace |
| SSH credentials security | Use keychain, never store plaintext |
| Backend won't start on VPS | Fallback to local mode |
| Update breaks remote | Rollback capability |
| Corporate proxy blocks download | Bundle option always works |
