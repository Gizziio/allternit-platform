# MCP vs CLI for h5i Integration + Entire Comparison

**Date:** 2026-04-24  
**Scope:** Evaluate integration patterns for AI session observability in Allternit's canvas code mode.

---

## 1. MCP vs CLI: Which is Better for h5i?

### MCP (Model Context Protocol)

**What it is:** A protocol for connecting AI assistants to external data sources and tools. h5i exposes an MCP server with tools like `h5i_log`, `h5i_blame`, `h5i_context_trace`.

**Pros:**
- Agents discover h5i capabilities automatically via tool schema
- Structured I/O — agents get typed responses, not raw text to parse
- Composable with other MCP servers (e.g., filesystem + h5i + browser)
- Type-safe — schemas prevent malformed queries

**Cons:**
- Requires MCP client support in the agent runtime (gizzi-code)
- Adds protocol overhead and dependency complexity
- Agents must be MCP-aware — doesn't work with basic shell-based agents
- Harder to debug — protocol traces instead of direct CLI output

**Best for:** Advanced agents that need to actively query their own history *during* reasoning (e.g., "What did I do in the last session?" → calls `h5i_context_trace` → incorporates into plan).

### CLI (Command Line Interface)

**What it is:** Direct shell commands — `h5i vibe`, `h5i context start`, `h5i claims list`.

**Pros:**
- Universal — works with any agent that can run shell commands
- Zero runtime dependencies — no MCP client needed
- Easy to debug — run the same command in terminal
- Simple to wrap in API routes (what we already built)
- Background capture works transparently via git hooks

**Cons:**
- Unstructured output — agents (or our UI) must parse text
- Less discoverable — agents don't know what tools exist unless told
- No type safety at the protocol level

**Best for:** Background session capture, post-hoc analysis, human-driven queries, and UI-driven operations.

### Verdict for Allternit

| Use Case | Best Approach | Why |
|----------|--------------|-----|
| Background session capture | **CLI** | Transparent via git hooks, no agent changes needed |
| Canvas UI (audit, knowledge tiles) | **CLI** | API routes wrapping CLI commands |
| Agent self-awareness during reasoning | **MCP** | Structured tool discovery and typed responses |
| Commit provenance | **CLI** | Simple `h5i commit` wrapper |
| Session rewind/resume | **CLI** | `h5i context restore` is a direct command |

**Recommendation:** Use **CLI as the primary integration** (Tiers 1–3, already built). Add **MCP as an optional Tier 4 enhancement** for agents that need runtime self-awareness. This mirrors how Entire works — CLI-first with hooks, then optional deeper integrations.

---

## 2. Entire (entireio/cli) Deep Dive

### What Entire Does

Entire is a **Go CLI** that hooks into Git workflows to capture AI agent sessions. It stores session metadata (transcripts, prompts, files touched, token usage, tool calls) on a dedicated `entire/checkpoints/v1` branch.

### Key Commands

| Command | Purpose |
|---------|---------|
| `entire enable` | Install git hooks + agent hooks (interactive) |
| `entire disable` | Remove hooks |
| `entire status` | Show current session info |
| `entire rewind` | Restore code to a previous checkpoint |
| `entire resume` | Switch branch + restore session metadata |
| `entire sessions` | View/manage tracked sessions |
| `entire explain` | Explain a session or commit |
| `entire doctor` | Fix stuck sessions |

### Architecture

```
Your Branch (main/feature)          entire/checkpoints/v1
     │                                         │
     │  ┌── Agent works ──┐                    │
     │  │ Step 1          │                    │
     │  │ Step 2          │                    │
     │  └─────────────────┘                    │
     ▼                                         ▼
[Your Commit] ───────────────────────► [Session Metadata]
                                          (transcript,
                                           prompts,
                                           files touched)
```

**Critical design choice:** Entire stores metadata on a **separate Git branch**, not in hidden refs like h5i.

### Agent Hook Coverage

| Agent | Entire Support | h5i Support |
|-------|---------------|-------------|
| Claude Code | ✅ | ✅ |
| Codex | ✅ | ✅ |
| Cursor | ✅ | ❌ |
| Gemini CLI | ✅ | ❌ |
| Copilot CLI | ✅ | ❌ |
| OpenCode | ✅ | ❌ |
| Factory AI Droid | ✅ | ❌ |

**Entire wins on agent coverage** — supports 7 agents vs h5i's 2.

---

## 3. h5i vs Entire: Head-to-Head

| Dimension | h5i | Entire | Winner |
|-----------|-----|--------|--------|
| **License** | Apache 2.0 | MIT | Tie |
| **Language** | Rust | Go | Tie |
| **Storage** | Git refs (`refs/h5i/*`) — invisible, zero pollution | Git branch (`entire/checkpoints/v1`) — visible, separate branch | **h5i** (cleaner) |
| **Agent hooks** | 2 (Claude Code, Codex) | 7 (Claude, Codex, Cursor, Gemini, Copilot, OpenCode, Factory AI) | **Entire** |
| **Setup** | Manual (`h5i init` + paste hooks) | Interactive (`entire enable` auto-installs) | **Entire** |
| **Claims system** | ✅ Content-addressed facts, auto-invalidate | ❌ | **h5i** |
| **Summaries** | Manual `h5i summary set` | Auto-summarization at commit (Claude CLI) | **Entire** |
| **Token cost reduction** | Benchmarked −69% (claims), −46% (summaries) | Not benchmarked | **h5i** |
| **Audit/compliance** | `h5i vibe`, `h5i compliance`, `h5i notes review` | Basic | **h5i** |
| **Rewind/resume** | `h5i context restore <sha>` | `entire rewind`, `entire resume` | **Entire** (more polished) |
| **Web dashboard** | Self-hosted (`h5i serve` on localhost:7150) | Cloud-based (entire.io) | **h5i** (privacy) |
| **Pricing** | Free/open-source | Freemium (cloud features) | **h5i** |
| **Concurrent sessions** | Per-session context workspaces | Concurrent with isolation warnings | Tie |
| **Secret redaction** | Manual | Auto-redaction at write time | **Entire** |
| **Multi-worktree** | Untested | ✅ Supported | **Entire** |

### Where h5i Wins

1. **Storage hygiene** — Git refs don't pollute branch list or working tree
2. **Proven cost reduction** — The −69% cache-read token reduction is measured and significant
3. **Self-hosted** — No cloud dependency, no freemium gates
4. **Claims system** — Content-addressed facts with auto-invalidation is unique to h5i
5. **Audit depth** — `vibe`, `compliance`, `notes review` create a governance layer
6. **Rust alignment** — Fits Allternit's Rust backend ecosystem

### Where Entire Wins

1. **Agent coverage** — 7 agents vs 2 is a massive UX difference
2. **Setup experience** — `entire enable` is one command vs manual hook installation
3. **Auto-summarization** — Generates session summaries automatically at commit time
4. **Rewind UI** — `entire rewind` is more user-friendly than `h5i context restore`
5. **Secret redaction** — Automatic, best-effort redaction of API keys
6. **Multi-worktree** — Tested and supported

---

## 4. Recommendation for Allternit

### Short Term (Keep h5i, borrow from Entire)

**Stick with h5i** — we've already built 3 tiers of integration. The architecture is solid.

**Borrow Entire's best ideas:**

1. **Auto-summarization** — Add a lightweight auto-summary feature that runs at `h5i context finish` time. Could call the existing LLM backend (gizzi-code) to generate a session summary.

2. **Better agent hook coverage** — Document how to manually add h5i hooks for Cursor, Gemini, and other agents. The hooks are simple JSON files — just need the right paths.

3. **Secret redaction** — Add a basic regex-based redaction step before writing to `refs/h5i/notes`. Entire's approach is best-effort but better than nothing.

4. **Checkpoint rewind UI** — Enhance our canvas with a "Rewind to Checkpoint" button that calls `h5i context restore`. Much simpler than Entire's full rewind system.

### Medium Term (MCP Tier 4)

Add h5i's MCP server as an optional agent capability:

```json
// .claude/settings.json or agent config
{
  "mcpServers": {
    "h5i": {
      "command": "h5i",
      "args": ["mcp", "start"]
    }
  }
}
```

This gives agents structured access to:
- `h5i_log` — query commit history with provenance
- `h5i_blame` — line-level AI attribution
- `h5i_context_trace` — retrieve session reasoning

### Long Term (Evaluate Entire as Alternative)

If h5i's limited agent coverage becomes a blocker:

1. **Run both** — Entire for background capture (better hooks), h5i for canvas UI (better dashboard/claims)
2. **Migrate to Entire** — Only if the cloud dependency and branch storage are acceptable tradeoffs
3. **Fork/extend h5i** — Add the missing agent hooks to h5i (open-source, Rust)

---

## 5. Quick Comparison Matrix

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Allternit Canvas Integration                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Background Capture          CLI hooks (h5i or Entire)              │
│  Canvas UI                   h5i (dashboard, audit, knowledge)      │
│  Agent Self-Awareness        MCP (h5i server)                       │
│  Session Rewind              h5i context restore                    │
│  Commit Provenance           h5i commit                             │
│                                                                     │
│  Best Stack: h5i CLI (primary) + h5i MCP (optional)                │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 6. Actionable Next Steps

1. **Improve agent hook coverage** — Add h5i hooks for Cursor, Gemini, Copilot CLI
2. **Add auto-summarization** — Call gizzi-code LLM at `h5i context finish` to generate session summaries
3. **Add secret redaction** — Regex-based redaction before writing to h5i refs
4. **MCP server integration** — Mount h5i MCP for agents that need runtime self-awareness
5. **Monitor Entire** — Track their open-source releases; evaluate if a migration makes sense later
