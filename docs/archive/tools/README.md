# A2rchitect Agent Shell

A TUI shell for interacting with A2rchitect via the [Agent Client Protocol (ACP)](https://agentclientprotocol.com/).

## Quick Start

**One command to start:**

```bash
make agent-shell
```

Or directly:

```bash
agent-shell
```

That's it! The launcher will:
1. Build the ACP adapter if needed
2. Install Emacs packages (agent-shell, acp, shell-maker) automatically
3. Start the agent-shell TUI with A2rchitect

## Prerequisites

- Emacs 29.1+ (`brew install emacs` on macOS)
- Rust toolchain (for building the adapter)

## Installation

Add to your PATH:

```bash
ln -s /Users/macbook/Desktop/a2rchitech-workspace/a2rchitech/7-apps/agent-shell-acp-adapter/agent-shell ~/.local/bin/
```

## Architecture

```
┌─────────────────┐     ACP Protocol        ┌─────────────┐     HTTP/gRPC     ┌─────────────┐
│  agent-shell    │ ◄───(JSON-RPC/stdio)──► │   a2r-acp   │ ◄────────────────►│   kernel    │
│  (Emacs TUI)    │                         │   (adapter) │                   │  (A2R)      │
└─────────────────┘                         └─────────────┘                   └─────────────┘
```

## Manual Usage

If you prefer to use agent-shell directly in your existing Emacs:

```elisp
(add-to-list 'load-path "/path/to/a2rchitech/7-apps/agent-shell-acp-adapter")
(require 'agent-shell-a2r)
M-x agent-shell-a2r-start
```

## Development

Test the ACP adapter:

```bash
# Build
cargo build --release -p agent-shell-acp-adapter

# Test protocol
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' | ./target/release/a2r-acp
```
