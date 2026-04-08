# Gizzi Code Monorepo Release Plan

**Using Real URLs - No Made-Up Values**

---

## Verified Information

| Property | Value |
|----------|-------|
| **GitHub Org** | Gizziio |
| **Monorepo** | allternit-platform |
| **Git URL** | `https://github.com/Gizziio/allternit-platform.git` |
| **Releases URL** | `https://github.com/Gizziio/allternit-platform/releases` |
| **Current Location** | `cmd/gizzi-code/` |
| **Install Domain** | `install.gizziio.com` |
| **Docs Domain** | `docs.gizziio.com` |

---

## Part 1: Fix Install Scripts (Real URLs)

### Fix `install` (Bash Script)

**Current (broken):**
```bash
APP=a2r
url="https://github.com/anomalyco/opencode/releases/latest/download/$filename"
```

**Fixed:**
```bash
APP=gizzi-code
INSTALL_DIR=$HOME/.gizzi/bin

# Release URL pattern
url="https://github.com/Gizziio/allternit-platform/releases/latest/download/$filename"

# Version check URL  
api_url="https://api.github.com/repos/Gizziio/allternit-platform/releases/latest"
```

**Binary naming convention:**
```
gizzi-code-v{VERSION}-{OS}-{ARCH}.{ext}

gizzi-code-v0.1.0-darwin-arm64.tar.gz
gizzi-code-v0.1.0-darwin-x64.tar.gz
gizzi-code-v0.1.0-linux-arm64.tar.gz
gizzi-code-v0.1.0-linux-x64.tar.gz
gizzi-code-v0.1.0-windows-x64.zip
```

### Fix `install.ps1` (PowerShell)

**Current (broken):**
```powershell
$Repo = "Gizziio/gizzi-code"
```

**Fixed:**
```powershell
$Repo = "Gizziio/allternit-platform"
$AssetPrefix = "gizzi-code"

# Download URL
$DownloadUrl = "https://github.com/$Repo/releases/latest/download/${AssetPrefix}-win.exe"
# Or with version:
$DownloadUrl = "https://github.com/$Repo/releases/download/$Version/${AssetPrefix}-$Version-windows-x64.exe"
```

### Fix Homebrew Formula

**Path:** `packaging/homebrew/gizzi-code.rb`

```ruby
class GizziCode < Formula
  desc "AI-powered terminal interface for the Allternit ecosystem"
  homepage "https://docs.gizziio.com"
  license "MIT"
  version "0.1.0"

  # Release base URL
  release_base = "https://github.com/Gizziio/allternit-platform/releases/download/v#{version}"

  if OS.mac? && Hardware::CPU.arm?
    url "#{release_base}/gizzi-code-v#{version}-darwin-arm64.tar.gz"
    sha256 "PLACEHOLDER_SHA256_DARWIN_ARM64"
  elsif OS.mac? && Hardware::CPU.intel?
    url "#{release_base}/gizzi-code-v#{version}-darwin-x64.tar.gz"
    sha256 "PLACEHOLDER_SHA256_DARWIN_X64"
  elsif OS.linux? && Hardware::CPU.arm?
    url "#{release_base}/gizzi-code-v#{version}-linux-arm64.tar.gz"
    sha256 "PLACEHOLDER_SHA256_LINUX_ARM64"
  elsif OS.linux? && Hardware::CPU.intel?
    url "#{release_base}/gizzi-code-v#{version}-linux-x64.tar.gz"
    sha256 "PLACEHOLDER_SHA256_LINUX_X64"
  end

  def install
    bin.install "gizzi-code"
  end

  test do
    system "#{bin}/gizzi-code", "--version"
  end
end
```

---

## Part 2: GitHub Actions Workflow (Monorepo)

**File:** `.github/workflows/release-gizzi-code.yml`

```yaml
name: Release Gizzi Code

on:
  push:
    tags:
      - 'gizzi-code/v*'  # Trigger on tags like gizzi-code/v0.1.0

permissions:
  contents: write

jobs:
  build-binaries:
    strategy:
      matrix:
        include:
          - os: ubuntu-latest
            target: linux-x64
            ext: tar.gz
          - os: ubuntu-latest
            target: linux-arm64
            ext: tar.gz
          - os: macos-latest
            target: darwin-arm64
            ext: tar.gz
          - os: macos-13
            target: darwin-x64
            ext: tar.gz
          - os: windows-latest
            target: windows-x64
            ext: zip

    runs-on: ${{ matrix.os }}
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Bun
        uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest
      
      - name: Install dependencies
        working-directory: cmd/gizzi-code
        run: bun install
      
      - name: Build binary
        working-directory: cmd/gizzi-code
        run: bun run script/build-production.ts --target=${{ matrix.target }}
      
      - name: Package (Unix)
        if: matrix.os != 'windows-latest'
        working-directory: cmd/gizzi-code
        run: |
          mkdir -p dist/pkg
          cp dist/gizzi-code dist/pkg/
          cd dist/pkg
          tar -czf "../../gizzi-code-${{ github.ref_name }}-${{ matrix.target }}.tar.gz" gizzi-code
      
      - name: Package (Windows)
        if: matrix.os == 'windows-latest'
        working-directory: cmd/gizzi-code
        run: |
          mkdir -p dist\pkg
          copy dist\gizzi-code.exe dist\pkg\
          cd dist\pkg
          Compress-Archive -Path gizzi-code.exe -DestinationPath "..\..\gizzi-code-${{ github.ref_name }}-${{ matrix.target }}.zip"
      
      - name: Upload artifact
        uses: actions/upload-artifact@v4
        with:
          name: gizzi-code-${{ matrix.target }}
          path: cmd/gizzi-code/gizzi-code-*

  create-release:
    needs: build-binaries
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Download all artifacts
        uses: actions/download-artifact@v4
        with:
          path: artifacts
          pattern: gizzi-code-*
          merge-multiple: true
      
      - name: Create Release
        uses: softprops/action-gh-release@v1
        with:
          files: artifacts/*
          generate_release_notes: true
          name: "Gizzi Code ${{ github.ref_name }}"
```

---

## Part 3: NPM Publishing from Monorepo

**Package:** `cmd/gizzi-code/package.json`

**Current name:** `@a2r/gizzi-code`

**Options:**
1. Keep as `@a2r/gizzi-code` (scope matches monorepo)
2. Change to `@gizzi/gizzi-code` (better branding)

**Workflow:**

```yaml
# .github/workflows/publish-gizzi-code-npm.yml
name: Publish Gizzi Code to NPM

on:
  push:
    tags:
      - 'gizzi-code/v*'

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Bun
        uses: oven-sh/setup-bun@v1
      
      - name: Install dependencies
        working-directory: cmd/gizzi-code
        run: bun install
      
      - name: Build
        working-directory: cmd/gizzi-code
        run: bun run build
      
      - name: Setup Node for NPM
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'
      
      - name: Publish to NPM
        working-directory: cmd/gizzi-code
        run: npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

---

## Part 4: Install Site Deployment

**Files to deploy to `install.gizziio.com`:**

```
install.gizziio.com/
├── index.html              ← Landing page (already created)
├── install                 ← Fixed bash script
├── install.ps1             ← Fixed PowerShell script
└── _redirects              ← Cloudflare Pages redirects
```

**_redirects:**
```
/install /install 200
/install.ps1 /install.ps1 200
```

---

## Part 5: Execution Steps (Real)

### Step 1: Fix Scripts (Now)
```bash
cd cmd/gizzi-code

# Fix install script
sed -i.bak 's/anomalyco\/opencode/Gizziio\/allternit-platform/g' install
sed -i.bak 's/APP=a2r/APP=gizzi-code/g' install
sed -i.bak 's/~\/.a2r/~\/.gizzi/g' install

# Fix install.ps1
sed -i.bak 's/Gizziio\/gizzi-code/Gizziio\/allternit-platform/g' cli-package/install/install.ps1
```

### Step 2: Create GitHub Action
```bash
mkdir -p .github/workflows
cat > .github/workflows/release-gizzi-code.yml << 'EOF'
# (content from Part 2 above)
EOF
```

### Step 3: Tag and Release
```bash
# After fixes are committed
git add .
git commit -m "Fix install scripts and add release workflow"

git tag gizzi-code/v0.1.0
git push origin gizzi-code/v0.1.0

# GitHub Actions automatically:
# - Builds binaries for all platforms
# - Creates release with assets
```

### Step 4: Update Homebrew SHA256s
```bash
# After release is created, download and calculate SHA256s
for target in darwin-arm64 darwin-x64 linux-arm64 linux-x64; do
  url="https://github.com/Gizziio/allternit-platform/releases/download/gizzi-code/v0.1.0/gizzi-code-gizzi-code/v0.1.0-${target}.tar.gz"
  curl -L "$url" | shasum -a 256
done
```

### Step 5: Deploy Install Site
```bash
cd cmd/gizzi-code/gizzi-install-site
# Upload to Cloudflare Pages
```

---

## Final Install Commands (After Fix)

| Method | Command | Status After Fix |
|--------|---------|------------------|
| curl | `curl -fsSL https://install.gizziio.com/install \| bash` | ✅ Works |
| Windows | `irm https://install.gizziio.com/install.ps1 \| iex` | ✅ Works |
| NPM | `npm install -g @a2r/gizzi-code` | ✅ Works (if published) |
| Homebrew | `brew install gizzi-code` | ✅ Works (after SHA256 update) |

---

## Important: Release Asset Names

When the GitHub Action runs, assets will be named:
```
gizzi-code-gizzi-code/v0.1.0-darwin-arm64.tar.gz
gizzi-code-gizzi-code/v0.1.0-darwin-x64.tar.gz
gizzi-code-gizzi-code/v0.1.0-linux-arm64.tar.gz
gizzi-code-gizzi-code/v0.1.0-linux-x64.tar.gz
gizzi-code-gizzi-code/v0.1.0-windows-x64.zip
```

The double "gizzi-code" is because `github.ref_name` includes the full tag.

**Fix:** Use `${GITHUB_REF#refs/tags/gizzi-code/}` to extract just the version.

Want me to execute Step 1 (fix the scripts) now?
