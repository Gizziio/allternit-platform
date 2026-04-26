# Allternit Developer Onboarding

Welcome to the allternit team! This guide will get you up and running.

## Quick Start (5 minutes)

```bash
# Clone repo
git clone https://github.com/allternit/allternit.git
cd allternit

# Install dependencies
./scripts/setup.sh

# Start dev server
pnpm dev
```

Visit http://localhost:5173

## Architecture Overview

```
infrastructure/     # Core SDKs and shared libraries
domains/kernel/        # Communication, compute, data, execution
domains/governance/    # Policy, quality, compliance
services/      # MCP, vendor integrations, bridges
services/      # Gateway, operator, orchestrator
5-agents/        # Agent runtime, rails, skills
surfaces/            # React/TypeScript frontend
cmd/          # CLI, API, desktop apps
```

## Development Setup

### Prerequisites
- Rust 1.75+
- Node.js 20+
- pnpm
- PostgreSQL 15+

### Environment Setup

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your settings
DATABASE_URL=postgres://localhost/allternit_dev
OPENAI_API_KEY=sk-...
```

### Database Setup

```bash
# Run migrations
sqlx migrate run

# Seed test data
./scripts/seed.sh
```

### Running Services

```bash
# Terminal 1: API server
cd cmd/api && cargo run

# Terminal 2: Frontend
cd surfaces/allternit-platform && pnpm dev

# Terminal 3: OpenClaw (optional)
cargo run -p allternit-openclaw-host
```

## Key Concepts

### Sessions
Sessions are conversation contexts. Two modes:
- **LLM Mode**: Direct chat with AI
- **Agent Mode**: OpenClaw-powered autonomous agent

### MCP (Model Context Protocol)
MCP servers provide tools:
```rust
// Register an MCP server
POST /api/v1/mcp/servers
{
  "name": "filesystem",
  "transport_type": "stdio",
  "command": "npx",
  "args": ["@modelcontextprotocol/server-filesystem", "/workspace"]
}

// Use tools
POST /api/v1/tools/execute
{
  "tool_name": "filesystem.read_file",
  "parameters": {"path": "/workspace/file.txt"}
}
```

### Feature Flags
Use feature flags for gradual rollouts:
```rust
if feature_flags.is_enabled("mcp_v2", &context).await? {
    // New implementation
} else {
    // Old implementation
}
```

## Development Workflow

### 1. Pick a Task
```bash
# Find available work
bd ready

# Claim task
bd update N123 --status in_progress
```

### 2. Create Branch
```bash
git checkout -b feature/N123-short-description
```

### 3. Develop
- Write code
- Add tests
- Update docs

### 4. Test
```bash
# Rust tests
cargo test

# TypeScript tests
pnpm test

# Integration tests
pnpm test:e2e
```

### 5. Submit
```bash
# Update issue
bd update N123 --status done

# Commit and push
git add .
git commit -m "N123: Description"
git push

# Sync
bd sync
```

## Common Tasks

### Add a New API Endpoint
1. Define route in `cmd/api/src/xxx_routes.rs`
2. Add to OpenAPI schema
3. Add tests
4. Update docs

### Add a New MCP Tool
1. Register server via API
2. Tools auto-discovered
3. Test via `scripts/test-mcp-tool.sh`

### Debug Session Bridge
```bash
# Watch SSE events
curl -N http://localhost:8013/api/v1/sessions/sync

# Check ChatStore state
# Open browser dev tools → Application → Local Storage
```

## Troubleshooting

### "Database connection failed"
- Check PostgreSQL is running: `pg_isready`
- Verify DATABASE_URL in .env
- Run migrations: `sqlx migrate run`

### "Port already in use"
- Find process: `lsof -i :8013`
- Kill: `kill -9 <PID>`

### "MCP server won't connect"
- Check logs: `tail -f ~/.allternit/logs/openclaw.log`
- Verify command exists: `which npx`
- Test manually: `npx @modelcontextprotocol/server-filesstream`

## Resources

- [Architecture Overview](./ARCHITECTURE.md)
- [API Reference](./api/README.md)
- [Contributing Guide](./CONTRIBUTING.md)
- [Beads Issue Tracker](../.beads/)

## Getting Help

- Slack: #dev-help
- Issues: Create bead issue
- Docs: This guide + inline code docs

## First Week Checklist

- [ ] Set up dev environment
- [ ] Complete architecture walkthrough
- [ ] Pick up first task (suggested: `bd ready | grep P1`)
- [ ] Submit first PR
- [ ] Join team standup

Welcome aboard! 🚀
