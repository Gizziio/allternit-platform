# Gizzi Code — VS Code Extension

AI-powered code assistance from Allternit, integrated directly into VS Code.

## Features

- **Explain Code** — Select code and get a clear, concise explanation of what it does
- **Refactor Code** — Improve readability, maintainability, and performance with AI suggestions
- **Generate Tests** — Automatically create unit tests for your code
- **Review Code** — Find bugs, security issues, and performance problems
- **Fix Errors** — Automatically fix diagnostics reported by VS Code
- **Chat Panel** — Sidebar chat interface for interactive code assistance

## Installation

### From source

```bash
cd surfaces/gizzi-vscode
npm install
npm run build
```

Package the extension:

```bash
npx @vscode/vsce package
```

Install the `.vsix` file via VS Code: **Extensions** → **⋯** → **Install from VSIX...**

### Development

```bash
npm run watch
```

Press `F5` in VS Code to launch an Extension Development Host.

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `gizzi.apiUrl` | `http://localhost:4096` | Allternit API URL |
| `gizzi.apiKey` | _(empty)_ | Allternit API key |
| `gizzi.model` | `default` | Default model for code generation |
| `gizzi.autoContext` | `true` | Automatically include surrounding file context |

## Commands

| Command | Description |
|---------|-------------|
| `Gizzi Code: Open Panel` | Open the Gizzi Code sidebar panel |
| `Gizzi Code: Explain Selection` | Explain the selected code |
| `Gizzi Code: Refactor Selection` | Refactor the selected code |
| `Gizzi Code: Generate Tests` | Generate tests for the current file |
| `Gizzi Code: Review Selection` | Review the selected code for issues |
| `Gizzi Code: Fix Errors` | Fix errors reported by diagnostics |

## Requirements

- VS Code 1.90.0 or later
- A running Allternit API instance (local or remote)
