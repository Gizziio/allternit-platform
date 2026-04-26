# Allternit Shell Quick Start Guide

## Installation

```bash
# From source
pnpm install
pnpm build

# Link for global access
pnpm link --global
```

## Basic Usage

```bash
# Start shell
allternit

# With a specific Work-In-Hand (WIH)
allternit --wih P5-T0500

# With full configuration
allternit --wih P5-T0500 --workspace ./my-project --theme dark
```

## Command Reference

### Built-in Commands (type `/` then command)

| Command | Description |
|---------|-------------|
| `/help` | Show all available commands |
| `/wih` | Show current WIH status |
| `/wih list` | List all available WIH items |
| `/wih set <id>` | Switch to a different WIH |
| `/status` | Show connection and system status |
| `/theme` | Toggle between dark and light theme |
| `/compact` | Toggle compact mode (less spacing) |
| `/tools` | Show/hide tool execution details |
| `/clear` | Clear chat history |
| `/exit` | Exit the shell |

### Shell Commands (type `!` then command)

Execute any shell command directly:

```
allternit> !ls -la
allternit> !git status
allternit> !npm test
```

### Sending Messages

Just type your message (no prefix):

```
allternit> Hello, can you help me implement this feature?
```

## Example Session

```bash
$ allternit --wih P5-T0500

Allternit Shell v1.0.0
Type /help for available commands, /exit to quit.

Active WIH: P5-T0500

allternit> /wih
Active WIH: P5-T0500
Title: Implement user authentication
Status: in_progress
Priority: 80

allternit> /status
Allternit Shell Status

Connection: disconnected
Gateway URL: ws://127.0.0.1:18789
Session: allternit-k9m2n1
Agent: allternit-shell
WIH: P5-T0500
Theme: dark

Runtime Status:
  Kernel: 1.0.0
  Policies: 2

allternit> Hello, I need to implement a login endpoint
[Message would be sent to AI gateway]

allternit> !git status
On branch feature/auth
Your branch is ahead of 'origin/main' by 3 commits.

allternit> /theme
Theme switched to light

allternit> /exit
Goodbye!
```

## Environment Variables

Set these in your shell profile for defaults:

```bash
export ALLTERNIT_GATEWAY_URL=ws://127.0.0.1:18789
export ALLTERNIT_WIH_ID=P5-T0500
export ALLTERNIT_WORKSPACE=/path/to/project
export ALLTERNIT_THEME=dark
```

## Tips

1. **Always use a WIH**: The shell works best when you have an active Work-In-Hand item
2. **Use `/wih list`**: See what work items are available
3. **Tab completion**: Not yet implemented, use `/wih set <id>`
4. **History**: Up/down arrows navigate command history
5. **Exit quickly**: Use `Ctrl+C` or type `/exit`

## Troubleshooting

### "No active WIH"
```
allternit> /wih list
allternit> /wih set P5-T0500
```

### "WIH is blocked"
```
# Check dependencies
allternit> /wih
Blocked by: P4-T0400

# Complete dependency first, then retry
```

### Connection issues
```bash
# Check gateway URL
allternit --url ws://localhost:18789
```
