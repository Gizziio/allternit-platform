# Gizzi Code

AI-powered terminal interface and runtime for the A2R ecosystem.

## Installation

### Quick Install (macOS/Linux)

```bash
curl -fsSL https://gizzi.sh/install.sh | bash
```

### Homebrew (macOS)

```bash
brew tap a2r/gizzi-code
brew install gizzi-code
```

### npm

```bash
npm install -g @a2r/gizzi-code
```

### Windows

```powershell
# Using winget
winget install A2R.GizziCode

# Using scoop
scoop bucket add gizzi-code https://github.com/a2r/scoop-gizzi-code
scoop install gizzi-code
```

## Usage

### Start the TUI

```bash
gizzi
```

### Commands

```bash
gizzi --version        # Show version
gizzi --help           # Show help
```

## System Service Setup

### macOS

```bash
# Install LaunchAgent
cp install/com.a2r.gizzi.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.a2r.gizzi.plist
```

### Linux (systemd)

```bash
# Install user service
mkdir -p ~/.config/systemd/user/
cp install/gizzi.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable gizzi.service
systemctl --user start gizzi.service
```

## Configuration

Configuration is stored at:
- **macOS**: `~/.config/gizzi/config.json`
- **Linux**: `~/.config/gizzi/config.json`
- **Windows**: `%APPDATA%/gizzi/config.json`

## Documentation

- [Full Documentation](https://docs.gizzi.sh)
- [API Reference](https://docs.gizzi.sh/api)
- [Troubleshooting](https://docs.gizzi.sh/troubleshooting)

## License

MIT License - see [LICENSE](./LICENSE)
