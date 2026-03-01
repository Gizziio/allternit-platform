# A2R Shell Quick Start Guide

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
a2r

# With a specific Work-In-Hand (WIH)
a2r --wih P5-T0500

# With full configuration
a2r --wih P5-T0500 --workspace ./my-project --theme dark
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
a2r> !ls -la
a2r> !git status
a2r> !npm test
```

### Sending Messages

Just type your message (no prefix):

```
a2r> Hello, can you help me implement this feature?
```

## Example Session

```bash
$ a2r --wih P5-T0500

A2R Shell v1.0.0
Type /help for available commands, /exit to quit.

Active WIH: P5-T0500

a2r> /wih
Active WIH: P5-T0500
Title: Implement user authentication
Status: in_progress
Priority: 80

a2r> /status
A2R Shell Status

Connection: disconnected
Gateway URL: ws://127.0.0.1:18789
Session: a2r-k9m2n1
Agent: a2r-shell
WIH: P5-T0500
Theme: dark

Runtime Status:
  Kernel: 1.0.0
  Policies: 2

a2r> Hello, I need to implement a login endpoint
[Message would be sent to AI gateway]

a2r> !git status
On branch feature/auth
Your branch is ahead of 'origin/main' by 3 commits.

a2r> /theme
Theme switched to light

a2r> /exit
Goodbye!
```

## Environment Variables

Set these in your shell profile for defaults:

```bash
export A2R_GATEWAY_URL=ws://127.0.0.1:18789
export A2R_WIH_ID=P5-T0500
export A2R_WORKSPACE=/path/to/project
export A2R_THEME=dark
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
a2r> /wih list
a2r> /wih set P5-T0500
```

### "WIH is blocked"
```
# Check dependencies
a2r> /wih
Blocked by: P4-T0400

# Complete dependency first, then retry
```

### Connection issues
```bash
# Check gateway URL
a2r --url ws://localhost:18789
```
