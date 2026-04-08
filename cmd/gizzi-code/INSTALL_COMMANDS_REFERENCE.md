# Gizzi Code Install Commands Reference

**Status:** Scripts fixed, awaiting release deployment

---

## Final Install Commands (After Release)

### Quick Install (macOS/Linux)
```bash
curl -fsSL https://install.gizziio.com/install | bash
```

### Windows (PowerShell)
```powershell
irm https://install.gizziio.com/install.ps1 | iex
```

### NPM
```bash
npm install -g @a2r/gizzi-code
```

### Homebrew (macOS/Linux)
```bash
brew install gizzi-code
```

---

## What Was Fixed

| Component | Before | After |
|-----------|--------|-------|
| **Bash Script** | `APP=a2r` | `APP=gizzi-code` |
| | `~/.a2r/bin` | `~/.gizzi/bin` |
| | `anomalyco/opencode` | `Gizziio/allternit-platform` |
| | `a2r.dev/docs` | `docs.gizziio.com` |
| **PowerShell** | `Gizziio/gizzi-code` | `Gizziio/allternit-platform` |
| **Homebrew** | `gizzi.sh` | `docs.gizziio.com` |
| | A2R ecosystem | Allternit ecosystem |

---

## Repository Configuration

| Property | Value |
|----------|-------|
| **GitHub Repo** | `https://github.com/Gizziio/allternit-platform` |
| **Releases URL** | `https://github.com/Gizziio/allternit-platform/releases` |
| **Release Tag Pattern** | `gizzi-code/v*` (e.g., `gizzi-code/v0.1.0`) |
| **Install Domain** | `https://install.gizziio.com` |
| **Docs Domain** | `https://docs.gizziio.com` |

---

## Release Asset Names

When you tag `gizzi-code/v0.1.0`, the GitHub Action will create:

```
gizzi-code-v0.1.0-darwin-arm64.tar.gz   # macOS Apple Silicon
gizzi-code-v0.1.0-darwin-x64.tar.gz     # macOS Intel
gizzi-code-v0.1.0-linux-arm64.tar.gz    # Linux ARM64
gizzi-code-v0.1.0-linux-x64.tar.gz      # Linux x64
gizzi-code-v0.1.0-windows-x64.zip       # Windows x64
```

---

## To Complete Setup

### 1. Push Changes
```bash
git push origin main
```

### 2. Create Release Tag
```bash
git tag gizzi-code/v0.1.0
git push origin gizzi-code/v0.1.0
```

This triggers the GitHub Action at:
`.github/workflows/release-gizzi-code.yml`

### 3. Wait for Build
Check progress at:
`https://github.com/Gizziio/allternit-platform/actions`

### 4. Deploy Install Scripts
Upload to Cloudflare Pages (install.gizziio.com):
- `cmd/gizzi-code/install` → `/install`
- `cmd/gizzi-code/install.ps1` → `/install.ps1`

### 5. Update Homebrew (Optional)
After binaries are built, calculate SHA256s:
```bash
for target in darwin-arm64 darwin-x64 linux-arm64 linux-x64; do
  url="https://github.com/Gizziio/allternit-platform/releases/download/gizzi-code/v0.1.0/gizzi-code-v0.1.0-${target}.tar.gz"
  curl -L "$url" | shasum -a 256
done
```

Update `packaging/homebrew/gizzi-code.rb` with real SHA256s.

### 6. Setup NPM (Optional)
Add `NPM_TOKEN` secret to GitHub repo settings for automatic publishing.

---

## Verification

After deployment, test each install method:

```bash
# Test curl install
curl -fsSL https://install.gizziio.com/install | bash
~/.gizzi/bin/gizzi-code --version

# Test NPM install
npm install -g @a2r/gizzi-code
gizzi-code --version
```
