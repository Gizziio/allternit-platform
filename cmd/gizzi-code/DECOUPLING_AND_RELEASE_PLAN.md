# Gizzi Code Decoupling & Release Plan

**Goal:** Separate gizzi-code from monorepo and make all install methods work
**Status:** URGENT - Execute Now

---

## Part 1: The Problem

### Current State (Broken)
```
allternit/                          ← Monorepo
└── cmd/
    └── gizzi-code/                 ← Gizzi Code buried here
        ├── package.json            ← Name: @a2r/gizzi-code
        ├── install                 ← Points to anomalyco/opencode
        └── ...

Gizziio/gizzi-code                  ← Empty GitHub repo (page enabled)
    └── (nothing useful)
```

### Why This Sucks
1. Install scripts point to wrong repo
2. No releases exist
3. Monorepo coupling makes versioning/releases hard
4. Can't use `go install github.com/Gizziio/gizzi-code`

---

## Part 2: Decoupling Strategy

### Option A: Hard Cut (Recommended)
Move everything to `Gizziio/gizzi-code` and delete from monorepo

**Pros:**
- Clean separation
- Proper Go module path
- Independent releases
- Clear ownership

**Cons:**
- Breaks monorepo build temporarily
- Need to update imports

### Option B: Git Subtree Split
Keep history, but make standalone

**Pros:**
- Preserves git history
- Can still sync if needed

**Cons:**
- Complex
- Easy to mess up

### Decision: OPTION A - Hard Cut

---

## Part 3: Repository Structure (Target)

```
Gizziio/gizzi-code/                 ← Standalone repo
├── .github/
│   └── workflows/
│       ├── build.yml               ← Build binaries on push
│       └── release.yml             ← Create releases on tag
├── cmd/
│   └── gizzi/                      ← Main entry point
│       └── main.go                 ← If Go, or main.ts if Node
├── pkg/                            ← Core packages
├── internal/                       ← Private code
├── docs/                           ← Documentation site source
├── install/                        ← Install scripts
│   ├── install                     ← Bash script
│   ├── install.ps1                 ← PowerShell script
│   └── README.md
├── packaging/
│   ├── homebrew/
│   │   └── gizzi-code.rb
│   ├── npm/
│   │   └── package.json
│   └── chocolatey/
│       └── ...
├── web/                            ← install.gizziio.com site
│   └── index.html
├── Makefile                        ← Build commands
├── package.json                    ← If Node/Bun project
├── go.mod                          ← If Go project
└── README.md
```

---

## Part 4: Execution Steps

### Phase 1: Prepare Standalone Repo (30 min)

#### Step 1.1: Create Clean Export
```bash
# From monorepo root
cd /Users/macbook/Desktop/allternit-workspace/allternit/cmd/gizzi-code

# Create temp export folder
mkdir -p /tmp/gizzi-export
cp -r . /tmp/gizzi-export/

# Remove monorepo-specific files
rm -rf /tmp/gizzi-export/.gizzi           # Internal config
rm -rf /tmp/gizzi-export/ACTUAL_STATUS.md  # Internal docs
rm -rf /tmp/gizzi-export/*_PLAN.md        # All plan files
rm -rf /tmp/gizzi-export/gizzi-install-*.zip  # Old zips

# Clean node_modules
rm -rf /tmp/gizzi-export/node_modules
```

#### Step 1.2: Fix Package Identity
```bash
cd /tmp/gizzi-export

# Update package.json
# Change: "name": "@a2r/gizzi-code" → "name": "@gizzi/gizzi-code"
# Update description, repository URL, etc.

# Create proper go.mod (if Go)
# module github.com/Gizziio/gizzi-code
```

#### Step 1.3: Fix Install Scripts
```bash
# Fix install script (bash)
# Change: APP=a2r → APP=gizzi-code
# Change: anomalyco/opencode → Gizziio/gizzi-code
# Change: ~/.a2r/bin → ~/.gizzi/bin
# Change: a2r.dev/docs → docs.gizziio.com

# Fix install.ps1
# Update $Repo = "Gizziio/gizzi-code"
# Update $InstallDir to use "gizzi" not "a2r"
# Change "A2R Ecosystem" → "Allternit Ecosystem"

# Fix Homebrew formula
# Update URLs to github.com/Gizziio/gizzi-code
# Keep SHA256 placeholders for now

# Fix Chocolatey
# Update package name and URLs
```

---

### Phase 2: Setup New Repository (15 min)

#### Step 2.1: Clone and Clean
```bash
cd /tmp
rm -rf gizzi-code-new

# Clone the existing (empty-ish) repo
git clone https://github.com/Gizziio/gizzi-code.git gizzi-code-new

# Remove everything except .git
cd gizzi-code-new
rm -rf *
rm -rf .[^.]* 2>/dev/null || true
```

#### Step 2.2: Import Clean Code
```bash
# Copy export contents
cp -r /tmp/gizzi-export/* .
cp -r /tmp/gizzi-export/.[^.]* . 2>/dev/null || true

# Don't copy .git
rm -rf .git
cp -r /tmp/gizzi-code-new/.git .
```

#### Step 2.3: Initial Commit
```bash
git add .
git commit -m "Initial import: gizzi-code standalone

- Decoupled from allternit monorepo
- Fixed install scripts to point to correct repo
- Prepared for independent releases
- Updated package name to @gizzi/gizzi-code"

git push origin main
```

---

### Phase 3: Build System (45 min)

#### Step 3.1: Create GitHub Actions

**`.github/workflows/build.yml`:**
```yaml
name: Build Binaries

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  workflow_dispatch:

jobs:
  build:
    strategy:
      matrix:
        include:
          - os: ubuntu-latest
            target: linux-x64
          - os: ubuntu-latest
            target: linux-arm64
          - os: macos-latest
            target: darwin-arm64
          - os: macos-13
            target: darwin-x64
          - os: windows-latest
            target: windows-x64
    
    runs-on: ${{ matrix.os }}
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node/Bun
        uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest
      
      - name: Install dependencies
        run: bun install
      
      - name: Build binary
        run: bun run build:binary --target ${{ matrix.target }}
      
      - name: Upload artifact
        uses: actions/upload-artifact@v4
        with:
          name: gizzi-code-${{ matrix.target }}
          path: dist/gizzi-code-*
```

**`.github/workflows/release.yml`:**
```yaml
name: Create Release

on:
  push:
    tags:
      - 'v*'

permissions:
  contents: write

jobs:
  release:
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
```

#### Step 3.2: Create Build Script

**`Makefile`:**
```make
.PHONY: all build clean release

VERSION ?= $(shell git describe --tags --always --dirty)
TARGETS := darwin-x64 darwin-arm64 linux-x64 linux-arm64 windows-x64

all: build

build:
	bun run build

build-binary:
	bun run script/build-binary.ts --target $(TARGET)

release: $(TARGETS)

$(TARGETS):
	$(MAKE) build-binary TARGET=$@

clean:
	rm -rf dist/
```

---

### Phase 4: Create First Release (30 min)

#### Step 4.1: Version Tag
```bash
cd /tmp/gizzi-code-new

# Update version in package.json
# Set to 0.1.0 or 1.0.0

git add package.json
git commit -m "Bump version to v0.1.0"

git tag v0.1.0
git push origin v0.1.0
```

#### Step 4.2: Trigger Release
```bash
# This will trigger the release workflow
# Wait for GitHub Actions to complete
# Binaries will appear in GitHub Releases
```

#### Step 4.3: Calculate SHA256s
```bash
# Download each binary and calculate SHA256
# Update Homebrew formula with real values

for target in darwin-arm64 darwin-x64 linux-arm64 linux-x64; do
  url="https://github.com/Gizziio/gizzi-code/releases/download/v0.1.0/gizzi-code-0.1.0-${target}.tar.gz"
  curl -L "$url" | shasum -a 256
done

# For Windows
curl -L "https://github.com/Gizziio/gizzi-code/releases/download/v0.1.0/gizzi-code-0.1.0-windows-x64.exe" | shasum -a 256
```

---

### Phase 5: Deploy Install Scripts (15 min)

#### Step 5.1: Prepare Install Site
```bash
mkdir -p /tmp/gizzi-install-site

# Copy install scripts
cp install/install /tmp/gizzi-install-site/
cp install/install.ps1 /tmp/gizzi-install-site/

# Create index.html (from gizzi-install-site)
# Update links to point to correct places

# Create _redirects for Cloudflare Pages
echo "/install /install 200" > /tmp/gizzi-install-site/_redirects
echo "/install.ps1 /install.ps1 200" >> /tmp/gizzi-install-site/_redirects
```

#### Step 5.2: Deploy to Cloudflare Pages
```bash
# Zip the site
cd /tmp/gizzi-install-site
zip -r gizzi-install-final.zip .

# Upload to Cloudflare Pages (manual or wrangler)
# Or use: npx wrangler pages deploy . --project-name=gizzi-install
```

---

### Phase 6: Update Monorepo (15 min)

#### Step 6.1: Remove from Monorepo
```bash
cd /Users/macbook/Desktop/allternit-workspace/allternit

# Remove gizzi-code from cmd/
rm -rf cmd/gizzi-code

# Update any imports that referenced it
# Update documentation
```

#### Step 6.2: Add Submodule (Optional)
```bash
# If monorepo still needs to reference it:
git submodule add https://github.com/Gizziio/gizzi-code.git external/gizzi-code
```

---

## Part 5: Verification Checklist

### Install Methods
- [ ] `curl -fsSL https://install.gizziio.com/install | bash` works on macOS
- [ ] `curl -fsSL https://install.gizziio.com/install | bash` works on Linux
- [ ] `irm https://install.gizziio.com/install.ps1 | iex` works on Windows
- [ ] `npm install -g @gizzi/gizzi-code` works
- [ ] `brew install gizzi-code` works (after homebrew accepts)
- [ ] `choco install gizzi-code` works (after chocolatey accepts)

### Functionality
- [ ] Binary runs: `gizzi-code --version` returns version
- [ ] Binary runs: `gizzi-code --help` shows help
- [ ] Binary runs: `gizzi-code` starts TUI

### Documentation
- [ ] docs.gizziio.com exists
- [ ] Install instructions are correct
- [ ] All install methods documented

---

## Part 6: NPM Publishing

### Step 6.1: Prepare Package
```bash
cd /tmp/gizzi-code-new

# Ensure package.json has:
# - "name": "@gizzi/gizzi-code"
# - "bin": { "gizzi-code": "./bin/gizzi-code" }
# - "files": ["bin/", "README.md"]

# Build the package
bun run build

# Create bin directory
mkdir -p bin
cp dist/gizzi-code bin/
```

### Step 6.2: Publish
```bash
# Login to npm
npm login

# Publish
npm publish --access public

# Or if scoped
npm publish --access public
```

---

## Part 7: Timeline

| Phase | Time | Cumulative |
|-------|------|------------|
| Phase 1: Prepare Export | 30 min | 30 min |
| Phase 2: Setup Repo | 15 min | 45 min |
| Phase 3: Build System | 45 min | 1.5 hrs |
| Phase 4: First Release | 30 min | 2 hrs |
| Phase 5: Deploy Install | 15 min | 2.25 hrs |
| Phase 6: Update Monorepo | 15 min | 2.5 hrs |
| NPM Publish | 15 min | 2.75 hrs |
| **Buffer/Testing** | 45 min | **3.5 hrs** |

**Total: ~3-4 hours of focused work**

---

## Part 8: Immediate Next Steps

### You need to decide NOW:

1. **What is the actual build output?**
   - Is it a single binary? (Go, Rust, Bun compile)
   - Is it a Node/Bun app that needs runtime?
   - What files need to be in the release?

2. **What platforms must be supported?**
   - macOS (arm64 + x64)?
   - Linux (arm64 + x64)?
   - Windows (x64)?

3. **Do you want to keep Bun as runtime or compile to binary?**
   - `bun build --compile` makes standalone binaries
   - Or ship as npm package that needs `bun` installed

4. **Who has access to Gizziio GitHub org?**
   - Need admin to setup repos/settings
   - Need to configure GitHub Pages
   - Need to add secrets if using Actions

---

## Quick Start Command

Want me to execute this plan? Tell me:
1. "Go" - I'll start with Phase 1 (export and clean)
2. "Wait" - Review and modify the plan first
3. "Help" - Answer the questions in Part 8 first
