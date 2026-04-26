# Gizzi Code

AI-powered terminal interface and runtime for the Allternit ecosystem.

## Installation

### Quick Install (macOS/Linux)

```bash
curl -fsSL https://gizzi.sh/install.sh | bash
```

### Homebrew (macOS)

```bash
brew tap allternit/gizzi-code
brew install gizzi-code
```

### npm

```bash
npm install -g @allternit/gizzi-code
```

### Windows

```powershell
# Using winget
winget install Allternit.GizziCode

# Using scoop
scoop bucket add gizzi-code https://github.com/allternit/scoop-gizzi-code
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
cp install/com.allternit.gizzi.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.allternit.gizzi.plist
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
