# OpenAI Codex Setup

## Overview

Use Allternit plugins directly in OpenAI Codex via the CLI adapter.

## Quick Setup (1 minute)

### 1. Install

```bash
npm install -g @allternit/plugin-sdk
```

### 2. Set API Key

```bash
export OPENAI_API_KEY="sk-..."
# Add to ~/.zshrc or ~/.bashrc for persistence
```

### 3. Test

```bash
allternit-plugin --version
```

## Usage in Codex

### Direct Execution

```bash
# In Codex chat
codex> /run allternit-plugin run market-research --industry "electric vehicles"

[Plugin executes]
[Output appears in chat]
```

### With Files

```bash
# Create input file
cat > input.json << 'EOF'
{
  "industry": "AI code assistants",
  "depth": "comprehensive"
}
EOF

# Run with file
codex> /run allternit-plugin run market-research --stdin < input.json
```

### Interactive Mode

```bash
codex> /run allternit-plugin run --interactive

Allternit Plugin CLI v1.0.0
Type "help" for commands, "exit" to quit.

> market-research industry="AI"
[Executes and shows results]

> code-react component="Button"
[Generates React component]
```

## Capabilities

| Feature | Support | Notes |
|---------|---------|-------|
| LLM | ✅ Full | Uses OpenAI API |
| Tools | ⚠️ Shell | Can run CLI commands |
| UI | ⚠️ Text | Terminal output only |
| Storage | ❌ None | Session only |
| Streaming | ✅ Yes | Real-time chunks |

## Best Practices

### 1. Pipe to Files

```bash
codex> /run allternit-plugin run code-react --component "Modal" > Modal.tsx
```

### 2. Chain Commands

```bash
codex> /run allternit-plugin run market-research --industry "EVs" | grep "market size"
```

### 3. Use with Git

```bash
codex> /run allternit-plugin run code-react --component "Button" > Button.tsx

# Then in Codex:
git add Button.tsx
git commit -m "Add Button component"
```

## Environment Variables

```bash
# LLM Provider
export ALLTERNIT_LLM_PROVIDER="openai"  # or "anthropic", "ollama"
export ALLTERNIT_API_KEY="sk-..."

# Local models
export ALLTERNIT_BASE_URL="http://localhost:11434"
export ALLTERNIT_LLM_PROVIDER="ollama"
```

## Troubleshooting

### "Command not found"

```bash
# Check installation
which allternit-plugin

# If not found, reinstall
npm install -g @allternit/plugin-sdk
```

### "API key not set"

```bash
# Set in shell
export OPENAI_API_KEY="sk-..."

# Or use flag
allternit-plugin run ... --api-key "sk-..."
```

## Tips

1. **Use --output flag**: Save results directly to files
2. **Combine with Codex**: Research with plugin, then code with Codex
3. **Batch operations**: Use --stdin for complex inputs
4. **Script it**: Create shell aliases for common plugins

```bash
# Alias example
alias research="allternit-plugin run market-research"
alias react="allternit-plugin run code-react"
```
