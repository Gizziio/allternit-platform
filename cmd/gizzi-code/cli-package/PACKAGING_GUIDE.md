# Gizzi Code Packaging Guide

This directory contains the packaging infrastructure for distributing Gizzi Code.

**Note**: Package name is `gizzi-code`, command is `gizzi`.

## Installation Methods

### 1. curl | bash (Recommended)

```bash
curl -fsSL https://gizzi.sh/install.sh | bash
```

### 2. Homebrew (macOS)

```bash
brew tap allternit/gizzi-code
brew install gizzi-code
```

### 3. npm

```bash
npm install -g @allternit/gizzi-code
```

### 4. Windows

```powershell
# Winget
winget install Allternit.GizziCode

# Scoop
scoop bucket add gizzi-code https://github.com/allternit/scoop-gizzi-code
scoop install gizzi-code
```

### 5. GitHub Releases

Download pre-built binaries:
```bash
# macOS
curl -LO https://github.com/allternit/gizzi-code/releases/latest/download/gizzi-code-macos
chmod +x gizzi-code-macos
mv gizzi-code-macos /usr/local/bin/gizzi

# Linux
curl -LO https://github.com/allternit/gizzi-code/releases/latest/download/gizzi-code-linux
chmod +x gizzi-code-linux
mv gizzi-code-linux /usr/local/bin/gizzi
```

## Commands

After installation, use the `gizzi` command:

```bash
# Main commands
gizzi                  # Start the TUI
gizzi --version        # Show version
gizzi --help           # Show help

# Daemon commands
gizzi daemon start     # Start background daemon
gizzi daemon stop      # Stop daemon
gizzi daemon status    # Check status

# Other commands
gizzi init             # Initialize project
gizzi doctor           # Check setup
```

## Building

### Prerequisites

- Bun (for building)
- Node.js 18+ (for npm package)

### Build Commands

```bash
# Build Node.js version (dist/gizzi.js)
npm run build

# Build platform binaries
npm run build:mac      # dist/gizzi-code-macos
npm run build:linux    # dist/gizzi-code-linux
npm run build:win      # dist/gizzi-code-win.exe

# Build all
npm run build:all
```

## Publishing

### Automated (GitHub Actions)

1. Tag a release:
   ```bash
   git tag -a v1.0.1 -m "Release v1.0.1"
   git push origin v1.0.1
   ```

2. GitHub Actions automatically:
   - Builds for all platforms (gizzi-code-*)
   - Publishes to npm (@allternit/gizzi-code)
   - Creates GitHub release with binaries

### Manual

```bash
# Run publish script
./scripts/publish.sh [version]

# Examples:
./scripts/publish.sh patch    # 1.0.0 -> 1.0.1
./scripts/publish.sh minor    # 1.0.0 -> 1.1.0
./scripts/publish.sh major    # 1.0.0 -> 2.0.0
./scripts/publish.sh 1.2.3    # explicit version
```

## System Service Setup

### macOS (LaunchAgent)

```bash
# Copy plist
cp install/com.allternit.gizzi.plist ~/Library/LaunchAgents/

# Replace USERNAME with actual username
sed -i '' "s/USERNAME/$USER/g" ~/Library/LaunchAgents/com.allternit.gizzi.plist

# Load and start
launchctl load ~/Library/LaunchAgents/com.allternit.gizzi.plist
launchctl start com.allternit.gizzi

# Check status
launchctl list | grep gizzi
```

### Linux (systemd)

```bash
# Install user service
mkdir -p ~/.config/systemd/user/
cp install/gizzi.service ~/.config/systemd/user/

# Enable and start
systemctl --user daemon-reload
systemctl --user enable gizzi.service
systemctl --user start gizzi.service

# Check status
systemctl --user status gizzi.service
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `GIZZI_LOG_LEVEL` | Log level (error, warn, info, debug) | `info` |
| `GIZZI_CONFIG_DIR` | Config directory path | Platform-specific |
| `GIZZI_DATA_DIR` | Data directory path | Platform-specific |
| `GIZZI_BACKEND_URL` | Backend server URL | `http://localhost:4096` |

### Config Files

- **macOS**: `~/.config/gizzi/config.json`
- **Linux**: `~/.config/gizzi/config.json`
- **Windows**: `%APPDATA%/gizzi/config.json`

## Directory Structure

```
cli-package/
├── bin/
│   └── gizzi                   # Node.js wrapper (command)
├── dist/                        # Built binaries (generated)
│   ├── gizzi.js                # Node.js version
│   ├── gizzi-code-macos        # macOS binary
│   ├── gizzi-code-linux        # Linux binary
│   └── gizzi-code-win.exe      # Windows binary
├── install/
│   ├── install.sh              # curl | bash installer
│   ├── gizzi.rb                # Homebrew formula (package: gizzi-code)
│   ├── gizzi.service           # systemd service
│   └── com.allternit.gizzi.plist     # macOS LaunchAgent
├── install/winget/
│   └── Allternit.Gizzi.yaml          # Windows Package Manager
├── scripts/
│   └── publish.sh              # Release script
├── .github/workflows/
│   └── release.yml             # CI/CD workflow
├── package.json                # npm: @allternit/gizzi-code
├── README.md
├── INSTALLATION_METHODS.md
└── PACKAGING_GUIDE.md          # This file
```

## Testing Installation

```bash
# Check installation
gizzi --version
gizzi --help

# Test TUI
gizzi

# Test daemon
gizzi daemon start
gizzi daemon status
gizzi daemon stop
```

## Troubleshooting

### "command not found: gizzi"

```bash
# Check if in PATH
which gizzi

# Add to PATH manually
export PATH="$HOME/.local/bin:$PATH"

# Or reinstall with PATH setup
curl -fsSL https://gizzi.sh/install.sh | bash
```

### Permission Denied

```bash
# Fix permissions
chmod +x ~/.local/bin/gizzi
```

### Binary Not Working

```bash
# Check architecture
uname -m
file $(which gizzi)

# Reinstall via npm
npm install -g @allternit/gizzi-code
```

## Support

- Documentation: https://docs.gizzi.sh
- Issues: https://github.com/allternit/gizzi-code/issues
- Discussions: https://github.com/allternit/gizzi-code/discussions
