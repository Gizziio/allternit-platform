# A2R × OpenClaw Integration: UI Concepts & ASCII Wireframes

**Date:** 2026-01-31  
**Status:** Conceptual Design  
**Theme:** Dark mode, terminal aesthetic, unified agent OS

---

## Design Philosophy

Based on analysis of the A2rchitech onboarding concepts and the functional requirements:

1. **Dark First:** Space-themed dark UI with cyan/blue accents
2. **Terminal Aesthetic:** Monospace fonts, command-line echoes
3. **Unified Cockpit:** All agent functions in one view
4. **Contextual Density:** Information-rich but scannable
5. **OpenClaw Integration:** Channels, skills, canvas merged into A2R Shell

## UI Source Inventory

The A2R Shell is a **consolidation target** that absorbs patterns and components from multiple sources:

| Source | Location | Elements to Absorb |
|--------|----------|-------------------|
| **A2R Current Shell** | `a2rchitech/apps/shell/` | ChatInterface, CoworkPanel, ConductorPanel, BrainManagerWidget |
| **OpenClaw** | `upstream/openclaw/ui/` | Channels UI, Canvas/A2UI, Skills browser, Control UI |
| **Claude Desktop** | `claude-workspace/desktopruntime/` | Window chrome, Model selector, Context chips |
| **OpenWork** | `a2rchitech/apps/openwork/` | Workspace panels, File tree, Task boards |
| **CopilotKit Reference** | `a2rchitech/apps/shell/copilotkit-reference/` | Chat primitives, Copilot UI patterns |
| **Future Sources** | TBD | BrowserBox, DevPod, Kimi local cluster |

**Integration Rule:**
- Shell UI is the **single target surface**
- All sources contribute **components or patterns**
- No source maintains independent UI
- All branded elements genericized to A2R

---

---

## 1. Main Shell Layout (A2R Shell + OpenClaw Features)

```
╔══════════════════════════════════════════════════════════════════════════════════════════╗
║  ▓▓▓ A2rchitect OS                                    🔔  ≡  👤  admin@local          ║
╠══════════════════════════════════════════════════════════════════════════════════════════╣
║                                                                                          ║
║  ┌─────────────┐  ╔══════════════════════════════════════════════════════════════════╗  ║
║  │             │  ║                                                                  ║  ║
║  │  NAV RAIL   │  ║                    MAIN CONTENT AREA                             ║  ║
║  │             │  ║                                                                  ║  ║
║  │  💬 Chat    │  ║   [Context-aware: Chat / Cowork / Conductor / Channels / etc]    ║  ║
║  │  🤖 Agents  │  ║                                                                  ║  ║
║  │  📊 Tasks   │  ║                                                                  ║  ║
║  │  🔌 Channels│  ║   ┌─────────────────────────────────────────────────────────┐    ║  ║
║  │  🛒 Skills  │  ║   │                                                         │    ║  ║
║  │  🖥️ Canvas  │  ║   │                                                         │    ║  ║
║  │  ⚙️ Config  │  ║   │          [Primary Work Area]                            │    ║  ║
║  │             │  ║   │                                                         │    ║  ║
║  │  ─────────  │  ║   │                                                         │    ║  ║
║  │  📁 Files   │  ║   └─────────────────────────────────────────────────────────┘    ║  ║
║  │  📈 Inspector│ ║                                                                  ║  ║
║  │             │  ╚══════════════════════════════════════════════════════════════════╝  ║
║  │  [Collapse] │                                                                      ║
║  └─────────────┘                                                                      ║
║                                                                                          ║
║  ═══════════════════════════════════════════════════════════════════════════════════   ║
║  > _ [Input area - universal command/chat/terminal hybrid]                    [Send]   ║
║                                                                                          ║
╚══════════════════════════════════════════════════════════════════════════════════════════╝
```

---

## 2. Chat View (Primary Interface)

```
╔══════════════════════════════════════════════════════════════════════════════════════════╗
║  💬 Chat with Claude (OpenClaw Runtime)                                    [+ New Chat]  ║
╠══════════════════════════════════════════════════════════════════════════════════════════╣
║                                                                                          ║
║  ┌──────────────────────────────────────────────────────────────────────────────────┐   ║
║  │  🤖 Claude (OpenClaw)               2:34 PM                                       │   ║
║  │  ───────────────────────────────────────────────────────────────────────────────  │   ║
║  │  I'll help you analyze the codebase. Let me start by exploring the structure.    │   ║
║  │                                                                                   │   ║
║  │  [Tool] filesystem.list - /Users/project/src                                     │   ║
║  │  └── 12 files, 3 directories                                                     │   ║
║  │                                                                                   │   ║
║  │  [Receipt] ✓ Files listed - Receipt: R-2026-0131-001                             │   ║
║  │                                                                                   │   ║
║  │  Now let me check the main entry point...                                        │   ║
║  │  [Tool] read_file - src/main.ts                                                  │   ║
║  │  [Receipt] ✓ File read - Receipt: R-2026-0131-002                                │   ║
║  └──────────────────────────────────────────────────────────────────────────────────┘   ║
║                                                                                          ║
║  ┌──────────────────────────────────────────────────────────────────────────────────┐   ║
║  │  👤 You                              2:35 PM                                      │   ║
║  │  ───────────────────────────────────────────────────────────────────────────────  │   ║
║  │  Can you refactor the authentication module?                                     │   ║
║  └──────────────────────────────────────────────────────────────────────────────────┘   ║
║                                                                                          ║
║  ┌──────────────────────────────────────────────────────────────────────────────────┐   ║
║  │  🤖 Claude                           2:35 PM     [Thinking...]                    │   ║
║  │  ───────────────────────────────────────────────────────────────────────────────  │   ║
║  │  I'll refactor the auth module. First, let me create a plan:                     │   ║
║  │                                                                                   │   ║
║  │  📋 Action Proposal #AP-1042                                                     │   ║
║  │  ┌─────────────────────────────────────────────────────────────────────────────┐ │   ║
║  │  │ 1. Extract auth logic to separate service                                   │ │   ║
║  │  │ 2. Add JWT token validation middleware                                      │ │   ║
║  │  │ 3. Update user model with refresh token support                             │ │   ║
║  │  │ 4. Write tests for new auth flows                                          │ │   ║
║  │  └─────────────────────────────────────────────────────────────────────────────┘ │   ║
║  │                                                                                   │   ║
║  │  [Approve] [Modify] [Cancel]                                                     │   ║
║  └──────────────────────────────────────────────────────────────────────────────────┘   ║
║                                                                                          ║
║  📎 Attach | 🎤 Voice | 📸 Screenshot | 🔗 Share                                        ║
║  ═══════════════════════════════════════════════════════════════════════════════════   ║
║  > Can you refactor the auth...                                               [Send]  ║
║                                                                                          ║
╚══════════════════════════════════════════════════════════════════════════════════════════╝
```

---

## 3. Cowork Panel (Multi-Agent Swarm View)

```
╔══════════════════════════════════════════════════════════════════════════════════════════╗
║  🤖 Agent Swarm / Cowork Space                                              [+ Spawn]  ║
╠══════════════════════════════════════════════════════════════════════════════════════════╣
║                                                                                          ║
║  ACTIVE AGENTS                              CHANNELS (OpenClaw Integration)             ║
║  ┌────────────────────────────────────┐     ┌────────────────────────────────────┐      ║
║  │                                    │     │                                    │      ║
║  │ 🤖 Claude-Code    ● Running        │     │ 💬 WhatsApp        ● Connected     │      ║
║  │    └─ Refactoring auth module      │     │    └─ 3 unread                     │      ║
║  │    [Terminal] [Pause] [Kill]       │     │    [View] [Settings]               │      ║
║  │                                    │     │                                    │      ║
║  │ 🦞 OpenClaw-Agent ● Idle           │     │ 📱 Telegram        ● Connected     │      ║
║  │    └─ Awaiting instructions        │     │    └─ 0 unread                     │      ║
║  │    [Resume] [Configure]            │     │                                    │      ║
║  │                                    │     │ 💼 Slack           ● Connected     │      ║
║  │ 🔧 Aider          ● Running        │     │    └─ #general active              │      ║
║  │    └─ Writing tests                │     │                                    │      ║
║  │    [Terminal] [Diff] [Approve]     │     │ 🎮 Discord         ● Connected     │      ║
║  │                                    │     │    └─ DM from user                 │      ║
║  │ 🌐 Browser-Agent  ● Paused         │     │                                    │      ║
║  │    └─ Needs approval: navigation   │     │ ✉️  iMessage       ● Paired       │      ║
║  │    [Approve] [Modify] [Cancel]     │     │    └─ 1 pending request            │      ║
║  │                                    │     │                                    │      ║
║  └────────────────────────────────────┘     └────────────────────────────────────┘      ║
║                                                                                          ║
║  PROPOSAL QUEUE                                                                          ║
║  ┌──────────────────────────────────────────────────────────────────────────────────┐   ║
║  │  📋 Pending Approvals                                                            │   ║
║  │  ───────────────────────────────────────────────────────────────────────────────  │   ║
║  │  [#1042] Claude-Code: Refactor auth module                     [View] [Approve]  │   ║
║  │  [#1043] Aider: Add test coverage for utils                    [View] [Approve]  │   ║
║  │  [#1044] OpenClaw-Agent: Browse documentation                  [View] [Modify]   │   ║
║  └──────────────────────────────────────────────────────────────────────────────────┘   ║
║                                                                                          ║
╚══════════════════════════════════════════════════════════════════════════════════════════╝
```

---

## 4. Conductor Panel (Timeline & Execution DAG)

```
╔══════════════════════════════════════════════════════════════════════════════════════════╗
║  🎼 Conductor / Execution Timeline                                          [Filter ▼]  ║
╠══════════════════════════════════════════════════════════════════════════════════════════╣
║                                                                                          ║
║  TIMELINE VIEW                              DAG VIEW                                    ║
║  ┌────────────────────────────────────┐     ┌────────────────────────────────────┐      ║
║  │                                    │     │                                    │      ║
║  │ 2:34:01 ▶️ Session started         │     │        [Start]                     │      ║
║  │ 2:34:02 ⬇️ Tool: fs.list           │     │           │                        │      ║
║  │ 2:34:03 ✅ Receipt: R-001          │     │     ┌─────┴─────┐                  │      ║
║  │ 2:34:05 ⬇️ Tool: read_file         │     │     ▼           ▼                  │      ║
║  │ 2:34:06 ✅ Receipt: R-002          │     │ [fs.list]   [read_file]            │      ║
║  │ 2:34:10 💭 LLM completion          │     │     │           │                    │      ║
║  │ 2:34:15 📝 Proposal #1042 created  │     │     └─────┬─────┘                  │      ║
║  │ 2:34:20 ⏸️  Awaiting approval       │     │           ▼                        │      ║
║  │         ...                        │     │    [Proposal #1042]                │      ║
║  │                                    │     │           │                        │      ║
║  │ ─────────────────────────────────  │     │      ⏸️  [Pending]                 │      ║
║  │                                    │     │                                    │      ║
║  │ [▶️ Play] [⏸️ Pause] [⏹️ Stop] [🔄 Replay]│     │ Click node for details      │      ║
║  │                                    │     │                                    │      ║
║  └────────────────────────────────────┘     └────────────────────────────────────┘      ║
║                                                                                          ║
║  TERMINAL OUTPUT (Selected: fs.list)                                                    ║
║  ═══════════════════════════════════════════════════════════════════════════════════   ║
║  $ ls -la src/                                                                          ║
║  total 48                                                                               ║
║  drwxr-xr-x  12 user  staff   384 Jan 31 14:23 .                                       ║
║  drwxr-xr-x   5 user  staff   160 Jan 31 14:20 ..                                      ║
║  -rw-r--r--   1 user  staff  2341 Jan 31 14:22 main.ts                                 ║
║  -rw-r--r--   1 user  staff  1847 Jan 31 14:21 auth.ts                                 ║
║  -rw-r--r--   1 user  staff   923 Jan 31 14:21 utils.ts                                ║
║  drwxr-xr-x   3 user  staff    96 Jan 31 14:21 components/                             ║
║  drwxr-xr-x   3 user  staff    96 Jan 31 14:21 hooks/                                  ║
║                                                                                          ║
║  > _                                                                                    ║
║                                                                                          ║
╚══════════════════════════════════════════════════════════════════════════════════════════╝
```

---

## 5. Channels View (OpenClaw Integration)

```
╔══════════════════════════════════════════════════════════════════════════════════════════╗
║  🔌 Channels (OpenClaw Runtime)                                             [+ Connect]  ║
╠══════════════════════════════════════════════════════════════════════════════════════════╣
║                                                                                          ║
║  CONNECTED CHANNELS                      PENDING APPROVALS                              ║
║  ┌────────────────────────────────┐      ┌────────────────────────────────┐              ║
║  │                                │      │                                │              ║
║  │ 💬 WhatsApp     ● Connected    │      │  🔐 Pairing Requests           │              ║
║  │    └─ +1 (555) 123-4567        │      │  ────────────────────────────  │              ║
║  │    [Chat] [Settings] [Logs]    │      │  📱 +1 (555) 987-6543          │              ║
║  │                                │      │     Code: 7X3K9               │              ║
║  │ 📱 Telegram     ● Connected    │      │     [Approve] [Block] [Ignore]│              ║
║  │    └─ @mybot                   │      │                                │              ║
║  │    [Chat] [Settings] [Logs]    │      │  💬 @unknown_user              │              ║
║  │                                │      │     Code: 2P8M1               │              ║
║  │ 💼 Slack        ● Connected    │      │     [Approve] [Block] [Ignore]│              │
║  │    └─ #general, #random        │      │                                │              ║
║  │    [Chat] [Settings] [Logs]    │      │                                │              ║
║  │                                │      └────────────────────────────────┘              ║
║  │ 🎮 Discord      ● Connected    │                                                    ║
║  │    └─ Server: A2R Community    │                                                    ║
║  │    [Chat] [Settings] [Logs]    │                                                    ║
║  │                                │                                                    ║
║  │ ✉️  iMessage     ● Connected    │                                                    ║
║  │    └─ user@icloud.com          │                                                    ║
║  │    [Chat] [Settings] [Logs]    │                                                    ║
║  │                                │                                                    ║
║  │ 🌐 WebChat      ● Active       │                                                    ║
║  │    └─ 2 active sessions        │                                                    ║
║  │    [View] [Settings]           │                                                    ║
║  │                                │                                                    ║
║  └────────────────────────────────┘                                                    ║
║                                                                                          ║
║  CHANNEL SETTINGS                                                                       ║
║  ┌────────────────────────────────────────────────────────────────────────────────┐    ║
║  │  Selected: WhatsApp                                                             │    ║
║  │  ─────────────────────────────────────────────────────────────────────────────  │    ║
║  │  DM Policy: [Pairing ●] [Open ○]                                                │    ║
║  │  Allow From: [Contacts only ●] [Anyone ○]                                       │    ║
║  │  Auto-reply: [Enabled ●] [Disabled ○]                                           │    ║
║  │  Agent Assignment: Default Agent [Claude ▼]                                     │    ║
║  │                                                                                  │    ║
║  │  [Save Changes] [Test Connection] [Disconnect]                                  │    ║
║  └────────────────────────────────────────────────────────────────────────────────┘    ║
║                                                                                          ║
╚══════════════════════════════════════════════════════════════════════════════════════════╝
```

---

## 6. Skills Marketplace (Merged A2R + OpenClaw)

```
╔══════════════════════════════════════════════════════════════════════════════════════════╗
║  🛒 Skills Marketplace                                                      [+ Install]  ║
╠══════════════════════════════════════════════════════════════════════════════════════════╣
║                                                                                          ║
║  [All] [Installed] [A2R Native] [OpenClaw] [GitHub] [MCP]                    [Search...] ║
║                                                                                          ║
║  FEATURED                                                                               ║
║  ┌──────────────────────────────────────────────────────────────────────────────────┐   ║
║  │  🏗️ Repo Cartography    🤖 Claude Code      🌐 Browser Automation              │   ║
║  │  Analyze codebase        OpenClaw native    Web control                        │   ║
║  │  [Install]               [Installed ✓]      [Install]                          │   ║
║  │                                                                                 │   ║
║  │  📊 Finance Ops          📄 Doc Factory      🧪 Test Runner                    │   ║
║  │  Trading workflows       PDF generation      Automated testing                 │   ║
║  │  [Install]               [Install]           [Install]                         │   ║
║  └──────────────────────────────────────────────────────────────────────────────────┘   ║
║                                                                                          ║
║  ALL SKILLS                                                                             ║
║  ┌──────────────────────────────────────────────────────────────────────────────────┐   ║
║  │                                                                                  │   ║
║  │  📦 filesystem@v2.1.0                    📦 whatsapp-bridge@1.5.0 (OpenClaw)    │   ║
║  │  Source: A2R Core                        Source: OpenClaw Bundled               │   ║
║  │  Filesystem operations with law gate     WhatsApp channel integration          │   ║
║  │  Permissions: fs(read,write)             Permissions: messaging               │   ║
║  │  Risk: Low 🔵                            Risk: Medium 🟡                        │   ║
║  │  [Installed ✓] [Config]                  [Installed ✓] [Config]                │   ║
║  │                                                                                  │   ║
║  │  📦 telegram-bridge@2.0.1 (OpenClaw)     📦 canvas-render@1.2.0 (OpenClaw)     │   ║
║  │  Source: OpenClaw Bundled                Source: OpenClaw Bundled               │   ║
║  │  Telegram channel integration            Visual canvas rendering               │   ║
║  │  Permissions: messaging                  Permissions: canvas, eval            │   ║
║  │  Risk: Medium 🟡                         Risk: High 🔴                         │   ║
║  │  [Install]                               [Install]                             │   ║
║  │                                                                                  │   ║
║  │  📦 slack-bridge@1.8.3 (OpenClaw)        📦 code-analyzer@v3.0.0               │   ║
║  │  Source: OpenClaw Managed                Source: GitHub                         │   ║
║  │  Slack workspace integration             AST-based code analysis               │   ║
║  │  Permissions: messaging, channels        Permissions: fs(read), network       │   ║
║  │  Risk: Medium 🟡                         Risk: Low 🔵                         │   ║
║  │  [Update available]                      [Install]                             │   ║
║  │                                                                                  │   ║
║  └──────────────────────────────────────────────────────────────────────────────────┘   ║
║                                                                                          ║
║  DETAILS PANEL (Selected: whatsapp-bridge)                                              ║
║  ┌──────────────────────────────────────────────────────────────────────────────────┐   ║
║  │  📦 whatsapp-bridge@1.5.0                                                         │   ║
║  │  ───────────────────────────────────────────────────────────────────────────────  │   ║
║  │  Source: OpenClaw Bundled | Pinned: commit abc1234 | Sig: verified ✓             │   ║
║  │  Sandbox: wasm/container | Logs: tool-calls → artifacts                         │   ║
║  │                                                                                  │   ║
║  │  Description: Official WhatsApp integration for OpenClaw. Enables bidirectional │   ║
║  │  messaging through WhatsApp Web. Supports group chats, media, and voice notes.  │   ║
║  │                                                                                  │   ║
║  │  Permissions:                                                                    │   ║
║  │  • messaging:send - Send messages to configured contacts                        │   ║
║  │  • messaging:receive - Receive and process incoming messages                    │   ║
║  │  • media:download - Download media attachments                                  │   ║
║  │                                                                                  │   ║
║  │  [Disable] [Uninstall] [Pin Version] [View Logs]                                │   ║
║  └──────────────────────────────────────────────────────────────────────────────────┘   ║
║                                                                                          ║
╚══════════════════════════════════════════════════════════════════════════════════════════╝
```

---

## 7. Inspector View (Receipts & Audit)

```
╔══════════════════════════════════════════════════════════════════════════════════════════╗
║  🔍 Inspector / Audit Log                                                   [Export ▼]  ║
╠══════════════════════════════════════════════════════════════════════════════════════════╣
║                                                                                          ║
║  RECEIPTS FOR SESSION: sess_abc123 (Claude-Code refactor-auth)                          ║
║  ┌──────────────────────────────────────────────────────────────────────────────────┐   ║
║  │                                                                                  │   ║
║  │  Timestamp        Type           Tool/Action           Status      Receipt ID   │   ║
║  │  ───────────────────────────────────────────────────────────────────────────────  │   ║
║  │  2:34:01          session:start  -                     ✅          R-0001       │   ║
║  │  2:34:02          tool:call      fs.list               ✅          R-0002       │   ║
║  │  2:34:03          artifact       file_listing.json     ✅          A-0001       │   ║
║  │  2:34:05          tool:call      read_file             ✅          R-0003       │   ║
║  │  2:34:06          artifact       main_ts_content.txt   ✅          A-0002       │   ║
║  │  2:34:10          llm:complete   -                     ✅          R-0004       │   ║
║  │  2:34:15          proposal       refactor-auth         ⏸️           P-1042       │   ║
║  │  2:35:00          approval       refactor-auth         ✅          R-0005       │   ║
║  │  2:35:05          tool:call      write_file            ✅          R-0006       │   ║
║  │  2:35:06          artifact       auth_service.ts       ✅          A-0003       │   ║
║  │  2:35:10          tool:call      edit_file             ✅          R-0007       │   ║
║  │  2:35:12          artifact       auth_service.ts.diff  ✅          A-0004       │   ║
║  │                                                                                  │   ║
║  └──────────────────────────────────────────────────────────────────────────────────┘   ║
║                                                                                          ║
║  RECEIPT DETAILS (Selected: R-0007 - edit_file)                                         ║
║  ┌──────────────────────────────────────────────────────────────────────────────────┐   ║
║  │  🧾 Receipt: R-0007                                                               │   ║
║  │  ───────────────────────────────────────────────────────────────────────────────  │   ║
║  │  Session: sess_abc123                                                             │   ║
║  │  WorkItem: WIH-T0001                                                              │   ║
║  │  Tool: edit_file (filesystem skill)                                              │   ║
║  │  Timestamp: 2026-01-31T14:35:10Z                                                 │   ║
║  │  Status: ✅ COMPLETED                                                             │   ║
║  │                                                                                  │   ║
║  │  Inputs:                                                                          │   ║
║  │  • path: src/auth_service.ts                                                     │   ║
║  │  • old_string: "function validateToken(token) {"                                  │   ║
║  │  • new_string: "async function validateToken(token: string): Promise<boolean> {" │   ║
║  │                                                                                  │   ║
║  │  Outputs:                                                                         │   ║
║  │  • diff: /.a2r/receipts/sess_abc123/R-0007.diff                                  │   ║
║  │  • backup: /.a2r/backups/src/auth_service.ts.bak.20260131_143510                │   ║
║  │                                                                                  │   ║
║  │  Law Checks:                                                                      │   ║
║  │  ✅ PreToolUse: Path in allowlist                                               │   ║
║  │  ✅ WriteGate: Canonical path computed                                          │   ║
║  │  ✅ ReceiptEmit: Logged to /.a2r/receipts/                                      │   ║
║  │                                                                                  │   ║
║  │  [View Diff] [View File] [Rollback]                                             │   ║
║  └──────────────────────────────────────────────────────────────────────────────────┘   ║
║                                                                                          ║
╚══════════════════════════════════════════════════════════════════════════════════════════╝
```

---

## 8. Canvas View (A2UI Integration)

```
╔══════════════════════════════════════════════════════════════════════════════════════════╗
║  🖥️ Canvas / Visual Workspace                                               [New Canvas] ║
╠══════════════════════════════════════════════════════════════════════════════════════════╣
║                                                                                          ║
║  ┌─────────────────────────────────────────────────────────────────────────────────────┐ ║
║  │                                                                                     │ ║
║  │                        A2UI CANVAS (OpenClaw Runtime)                               │ ║
║  │                                                                                     │ ║
║  │   ┌─────────────┐      ┌─────────────┐      ┌─────────────┐                        │ ║
║  │   │  📊 Chart   │◀────▶│  📝 Notes   │◀────▶│  🗂️  Tasks   │                        │ ║
║  │   │  Revenue    │      │  Meeting    │      │  Sprint 12  │                        │ ║
║  │   │  Q4 2025    │      │  Notes      │      │  Backlog    │                        │ ║
║  │   └─────────────┘      └─────────────┘      └─────────────┘                        │ ║
║  │          ▲                                              ▲                          │ ║
║  │          │                                              │                          │ ║
║  │          └──────────────────────────────────────────────┘                          │ ║
║  │                    ┌─────────────┐                                                  │ ║
║  │                    │  🤖 Agent   │                                                  │ ║
║  │                    │  Status     │                                                  │ ║
║  │                    │  ● Active   │                                                  │ ║
║  │                    └─────────────┘                                                  │ ║
║  │                                                                                     │ ║
║  │   [Drag to rearrange] [Reset View] [Export PNG] [Share]                             │ ║
║  │                                                                                     │ ║
║  └─────────────────────────────────────────────────────────────────────────────────────┘ ║
║                                                                                          ║
║  CANVAS TOOLS                                                                           ║
║  ┌──────────────────────────────────────────────────────────────────────────────────┐   ║
║  │  📝 Add Note  📊 Add Chart  🗂️ Add Board  🔗 Add Link  🖼️ Add Image  🤖 Agent   │   ║
║  └──────────────────────────────────────────────────────────────────────────────────┘   ║
║                                                                                          ║
║  AGENT CONTROL (Claude controlling canvas)                                              ║
║  ═══════════════════════════════════════════════════════════════════════════════════   ║
║  🤖 Claude: "I've created a visual board with your Q4 data and sprint tasks. You can   ║
║  drag items to reorganize or ask me to add more elements."                              ║
║                                                                                          ║
║  > _                                                                                    ║
║                                                                                          ║
╚══════════════════════════════════════════════════════════════════════════════════════════╝
```

---

## 9. TUI Cockpit (Terminal Mode)

```
╔══════════════════════════════════════════════════════════════════════════════════════════╗
║  A2rchitect OS v2.0.0 - Terminal Cockpit                                    [F1: Help]  ║
╠══════════════════════════════════════════════════════════════════════════════════════════╣
║                                                                                          ║
║  ┌───────────────────────────────────────────────────────────────────────────────────┐  ║
║  │                                                                                   │  ║
║  │   ╔═══════════════════════════════════════════════════════════════════════════╗   │  ║
║  │   ║                                                                           ║   │  ║
║  │   ║   ACTIVE SESSIONS                    CHANNEL STATUS                        ║   │  ║
║  │   ║   ─────────────────                  ───────────────                       ║   │  ║
║  │   ║   1. 🤖 claude-code   [RUNNING]      💬 WhatsApp    ● Connected            ║   │  ║
║  │   ║   2. 🦞 openclaw      [IDLE]         📱 Telegram    ● Connected            ║   │  ║
║  │   ║   3. 🔧 aider         [RUNNING]      💼 Slack       ● Connected            ║   │  ║
║  │   ║   4. 🌐 browser       [PAUSED]       🎮 Discord     ● Connected            ║   │  ║
║  │   ║                                                                           ║   │  ║
║  │   ║   PENDING: 2 proposals                 📨 2 unread messages                ║   │  ║
║  │   ║                                                                           ║   │  ║
║  │   ╚═══════════════════════════════════════════════════════════════════════════╝   │  ║
║  │                                                                                   │  ║
║  │   COMMANDS:                                                                       │  ║
║  │   ─────────                                                                       │  ║
║  │   a2r session list              - List active sessions                           │  ║
║  │   a2r session attach <id>       - Attach to session                              │  ║
║  │   a2r channel status            - Show channel connections                       │  ║
║  │   a2r skill list                - List installed skills                          │  ║
║  │   a2r workitem create           - Create new work item                           │  ║
║  │   a2r inspector                 - View receipts/audit log                        │  ║
║  │   openclaw agent --msg "..."    - Send message via OpenClaw                     │  ║
║  │                                                                                   │  ║
║  └───────────────────────────────────────────────────────────────────────────────────┘  ║
║                                                                                          ║
║  > a2r session attach 1                                                                   ║
║  Attaching to session claude-code (sess_abc123)...                                        ║
║  [Terminal stream connected - Press Ctrl+C to detach]                                     ║
║                                                                                          ║
║  🤖 claude-code> Working on refactoring auth module...                                    ║
║  🤖 claude-code> [Tool] fs.list src/                                                      ║
║  🤖 claude-code> [Receipt] ✓ R-0002                                                      ║
║  🤖 claude-code> Found 4 relevant files.                                                  ║
║  🤖 claude-code> [Tool] read_file src/auth.ts                                             ║
║  🤖 claude-code> [Receipt] ✓ R-0003                                                      ║
║  🤖 claude-code> Creating proposal...                                                     ║
║  🤖 claude-code> [Proposal #1042] Awaiting approval...                                    ║
║                                                                                          ║
║  > approve 1042                                                                           ║
║  ✅ Proposal #1042 approved. Session continuing...                                        ║
║                                                                                          ║
╚══════════════════════════════════════════════════════════════════════════════════════════╝
```

---

## 10. Onboarding Flow (A2R + OpenClaw Combined)

```
╔══════════════════════════════════════════════════════════════════════════════════════════╗
║  🚀 A2rchitect Onboarding                                                   [Skip ▼]   ║
╠══════════════════════════════════════════════════════════════════════════════════════════╣
║                                                                                          ║
║  STEP 3 OF 5: Configure OpenClaw Integration                                              ║
║  ═══════════════════════════════════════════════════════════════════════════════════   ║
║                                                                                          ║
║  The OpenClaw runtime provides multi-channel messaging and personal assistant features.   ║
║                                                                                          ║
║  ┌──────────────────────────────────────────────────────────────────────────────────┐   ║
║  │  CHANNEL SETUP (Optional)                                                         │   ║
║  │  ─────────────────────────────                                                   │   ║
║  │                                                                                  │   ║
║  │  💬 WhatsApp        [Connect]    ── Not connected                                │   ║
║  │     └─ Pair with your WhatsApp account                                           │   ║
║  │                                                                                  │   ║
║  │  📱 Telegram        [Connect]    ── Not connected                                │   ║
║  │     └─ Connect via BotFather token                                               │   ║
║  │                                                                                  │   ║
║  │  💼 Slack           [Connect]    ── Not connected                                │   ║
║  │     └─ OAuth with your workspace                                                 │   ║
║  │                                                                                  │   ║
║  │  🎮 Discord         [Connect]    ── Not connected                                │   ║
║  │     └─ Bot token required                                                        │   ║
║  │                                                                                  │   ║
║  │  [Skip for now, configure later in Settings]                                     │   ║
║  │                                                                                  │   ║
║  └──────────────────────────────────────────────────────────────────────────────────┘   ║
║                                                                                          ║
║  ┌──────────────────────────────────────────────────────────────────────────────────┐   ║
║  │  MODEL CONFIGURATION                                                              │   ║
║  │  ─────────────────────────────                                                   │   ║
║  │                                                                                  │   ║
║  │  Primary Model: [Anthropic Claude Opus 4.5 ●] [GPT-4 ○] [Local ○]               │   ║
║  │  Auth:          [OAuth ●] [API Key ○]                                           │   ║
║  │                                                                                  │   ║
║  │  [Connect Anthropic Account]                                                      │   ║
║  │                                                                                  │   ║
║  └──────────────────────────────────────────────────────────────────────────────────┘   ║
║                                                                                          ║
║  ┌──────────────────────────────────────────────────────────────────────────────────┐   ║
║  │  SECURITY DEFAULTS                                                                │   ║
║  │  ─────────────────────────────                                                   │   ║
║  │                                                                                  │   ║
║  │  DM Pairing:        [● Require approval] [○ Open]                               │   ║
║  │  File Write Gate:   [● Enabled]                                                  │   ║
║  │  Skill Sandbox:     [● Required]                                                 │   ║
║  │                                                                                  │   ║
║  └──────────────────────────────────────────────────────────────────────────────────┘   ║
║                                                                                          ║
║                                         [Back]  [Next: Review]                          ║
║                                                                                          ║
╚══════════════════════════════════════════════════════════════════════════════════════════╝
```

---

## Design System Summary

### Color Palette (Dark Theme)

```
Background:     #0D1117  (GitHub Dark bg)
Surface:        #161B22  (Elevated surfaces)
Border:         #30363D  (Subtle borders)

Primary:        #58A6FF  (Blue - Actions)
Secondary:      #8B949E  (Gray - Secondary text)
Accent:         #3FB950  (Green - Success)
Warning:        #D29922  (Yellow - Warnings)
Error:          #F85149  (Red - Errors)

OpenClaw Brand: #FF6B35  (Orange - OpenClaw features)
A2R Brand:      #00D9FF  (Cyan - A2R native features)
```

### Typography

```
Monospace:  JetBrains Mono, Fira Code  (Terminal, code)
Sans-serif: Inter, SF Pro               (UI, labels)

Sizes:
- Title:     24px
- Heading:   18px
- Body:      14px
- Small:     12px
- Terminal:  13px
```

### Icons (Lucide)

```
💬 Chat/Message      🤖 Agent/AI          📊 Dashboard
🔌 Channels          🛒 Skills/Market     🖥️ Canvas
🔍 Inspector         📁 Files             ⚙️ Settings
▶️ Run/Start         ⏸️ Pause              ⏹️ Stop
✅ Success           ⏸️ Pending            🔴 Error
```

---

**End of UI Concepts Document**

*See A2R_OPENCLAW_CODEBASE_SKELETON.md for architecture mapping*
*See A2R_OPENCLAW_PHASED_PLAN.md for implementation phases*
