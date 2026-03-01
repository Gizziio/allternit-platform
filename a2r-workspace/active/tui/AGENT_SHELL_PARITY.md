# Agent-Shell Parity: TUI Reference Behavior

**Date:** 2026-02-17  
**Reference:** https://github.com/xenodium/agent-shell  
**Status:** Feature parity mapping for A2R TUI

---

## Agent-Shell Overview

Agent-shell is an **ACP client** (not a runtime) written in Emacs Lisp that:
- Spawns ACP-capable agents (codex-acp, claude-code-acp, gemini --experimental-acp)
- Manages ACP stdio transport
- Logs all ACP traffic
- Supports transcript save/restore
- Maintains strict separation: chat sessions vs terminal sessions

**Key Insight:** Agent-shell delegates ALL execution to external ACP agents. It is a **UI layer only**, which is the correct pattern for our 7-apps/cli/.

---

## Feature Parity Table

| Feature | Agent-Shell | A2R TUI (MVP) | A2R TUI (Later) | Notes |
|---------|-------------|---------------|-----------------|-------|
| **ACP Spawn** | ✅ | ✅ P0 | - | Spawn ACP process + stdio |
| **Initialize Handshake** | ✅ | ✅ P0 | - | ACP initialize exchange |
| **Session Lifecycle** | ✅ | ✅ P0 | - | new, prompt, cancel, close |
| **Tool Permission UX** | ✅ | ⚠️ P1 | - | Approve/reject tool calls |
| **Traffic Logging** | ✅ | ✅ P0 | - | Log all ACP messages |
| **Transcript Save** | ✅ | ✅ P0 | - | Save session to file |
| **Transcript Restore** | ✅ | ⚠️ P1 | - | Resume from saved state |
| **Fragment UI** | ✅ | - | ✅ P2 | Collapsible blocks |
| **Heartbeat Animation** | ✅ | - | ✅ P2 | "Working..." indicator |
| **Viewport Mode** | ✅ | - | ✅ P3 | Alternative edit mode |
| **Multi-Provider** | ✅ | ✅ P0 | - | Claude, Gemini, Codex, etc. |
| **MCP Server Config** | ✅ | - | ✅ P2 | Per-session MCP servers |
| **Chat/Terminal Separation** | ✅ | ✅ P0 | - | Hard separation |

---

## ACP Client Behaviors to Replicate

### Behavior 1: Spawn ACP Process + Stdio Transport

**Agent-Shell Pattern:**
```elisp
;; From agent-shell.el:195
(defun agent-shell--make-acp-client (command args)
  "Spawn ACP process and return stdio transport"
  (make-process
   :name "acp-client"
   :command (cons command args)  ; e.g., ("opencode" "acp")
   :connection-type 'pipe       ; stdio, NOT PTY!
   :filter #'agent-shell--on-stdout
   :stderr #'agent-shell--on-stderr))
```

**A2R Mapping:**
```rust
// 1-kernel/infrastructure/a2r-acp-driver/src/transport.rs
pub struct AcpTransport {
    process: Child,
    stdin: ChildStdin,
    stdout: ChildStdout,
}

impl AcpTransport {
    pub async fn spawn(command: &str, args: &[&str]) -> Result<Self> {
        let mut child = Command::new(command)
            .args(args)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()?;
        // NOT a PTY - raw stdio pipes only!
    }
}
```

**Code Path:**
- 7-apps/cli/: User selects provider → HTTP POST to kernel
- 4-services/kernel-service/: Forwards to runtime
- 1-kernel/a2r-runtime/: Uses a2r-acp-driver to spawn
- 1-kernel/a2r-acp-driver/: Spawns process, manages stdio

---

### Behavior 2: Initialize Handshake

**Agent-Shell Pattern:**
```elisp
;; From agent-shell.el:900
(defun agent-shell--handle (method params)
  (cond
   ((equal method "initialize")
    ;; Send InitializeRequest
    ;; Wait for InitializeResponse
    ;; Then send initialized notification
    (agent-shell--send-initialize-request))))
```

**A2R Mapping:**
```rust
// 1-kernel/infrastructure/a2r-acp-driver/src/protocol.rs
pub async fn initialize_handshake(
    transport: &mut AcpTransport,
    client_info: ImplementationInfo,
) -> Result<ServerCapabilities> {
    let request = InitializeRequest {
        protocol_version: PROTOCOL_VERSION,
        client_info,
        capabilities: ClientCapabilities::default(),
    };
    
    let response = transport
        .send_request("initialize", request)
        .await?;
    
    // Send initialized notification
    transport.send_notification("initialized", {}).await?;
    
    Ok(response.capabilities)
}
```

---

### Behavior 3: Session Lifecycle

**Agent-Shell States:**
```
Disconnected → Connecting → Initializing → Ready → Prompting → Streaming → Ready
```

**A2R Mapping:**
The existing BrainRuntime trait handles this via `create_session` and `send_prompt_stream`.

**Integration:** State machine should be added to track:
- `Idle` → `Initializing` → `Ready` → `AwaitingModel` → `Streaming` → `Ready`

---

### Behavior 4: Tool Permission Requests

**Agent-Shell Pattern:**
```elisp
;; From agent-shell.el:1096
(defun agent-shell--handle-tool-call (tool-call)
  "Show permission dialog for tool"
  (if (agent-shell--tool-approved-p tool-call)
      (agent-shell--execute-tool tool-call)
    (agent-shell--request-permission tool-call)))
```

**A2R Mapping:**
```rust
// 1-kernel/infrastructure/a2r-runtime/src/tool_loop/arbiter.rs
impl ToolLoopArbiter {
    pub fn should_execute(&self, tool_call: &ToolCall) -> Decision {
        // Check if tool requires permission
        if self.requires_permission(&tool_call.name) {
            // Emit permission request event to UI
            self.emit_permission_request(tool_call);
            return Decision::PendingPermission;
        }
        
        // Check circuit breaker
        if self.circuit_breaker.is_open(&tool_call.name) {
            return Decision::Reject(RejectionReason::CircuitBreakerOpen);
        }
        
        Decision::Execute
    }
}
```

---

### Behavior 5: Traffic Logging + Transcript Save/Restore

**Agent-Shell Pattern:**
```elisp
;; Traffic logging (always on)
(defun agent-shell--log-traffic (direction message)
  (append-to-file (format "[%s] %s: %s\n" 
                         (current-time-string)
                         direction
                         (json-encode message))
                  nil
                  agent-shell-log-file))

;; Transcript save
(defun agent-shell--save-transcript (session-id)
  (let ((transcript (agent-shell--get-history session-id)))
    (write-region (json-encode transcript) nil
                  (format "%s-transcript.json" session-id))))
```

**A2R Mapping:**
Use existing `a2rchitect-history` ledger and BrainStore in kernel-service.

---

### Behavior 6: Hard Separation (Chat vs Terminal)

**Agent-Shell Pattern:**
```elisp
;; Terminal sessions (PTY-based, human TUI)
(defun agent-shell-terminal-mode (command)
  "Open terminal with full TUI"
  (make-term "terminal" command nil))

;; Chat sessions (ACP-based, programmatic)
(defun agent-shell-chat-mode (provider-id)
  "Start ACP chat session"
  (agent-shell--spawn-acp provider-id))
```

**A2R Mapping (Already Implemented):**
```rust
// 1-kernel/infrastructure/a2r-runtime/src/lib.rs
pub enum SessionSource {
    Chat,
    Terminal,
}

pub enum EventMode {
    Acp,
    Jsonl,
    Terminal,
}

// Validation in CreateSession::validate()
match (self.source, self.event_mode) {
    (SessionSource::Chat, EventMode::Terminal) => Err(...),
    (SessionSource::Terminal, EventMode::Acp) => Err(...),
    _ => Ok(()),
}
```

---

## Code Path Mapping

### Full Stack Flow (Chat Mode)

```
User Input (7-apps/cli/)
    ↓ HTTP POST /v1/sessions/{id}/prompt
4-services/orchestration/kernel-service/
    ↓ BrainManager.send_prompt()
1-kernel/a2r-runtime/
    ↓ BrainRuntime.send_prompt_stream()
1-kernel/a2r-acp-driver/
    ↓ AcpDriver.send()
ACP Agent Process (opencode, codex, etc.)
    ↓ stdio JSON-RPC
1-kernel/a2r-acp-driver/
    ↓ AcpTransport.on_stdout()
1-kernel/a2r-runtime/
    ↓ StreamEvent
4-services/kernel-service/
    ↓ SSE/WebSocket
7-apps/cli/
    ↓ renders
UI
```

---

## Agent-Shell Behaviors Mirrored

| Behavior | Agent-Shell Location | A2R Implementation |
|----------|---------------------|-------------------|
| ACP spawn | `agent-shell--make-acp-client` | `a2r-acp-driver/src/transport.rs` |
| Initialize handshake | `agent-shell--handle` (initialize) | `a2r-acp-driver/src/protocol.rs` |
| Session state | `agent-shell--state` alist | `a2r-runtime/src/session/state_machine.rs` (TO ADD) |
| Tool permissions | `agent-shell--handle-tool-call` | `a2r-runtime/src/tool_loop/arbiter.rs` (TO ADD) |
| Traffic logging | `agent-shell--log-traffic` | `a2r-acp-driver/src/transport.rs` |
| Transcript save | `agent-shell--save-transcript` | `kernel-service/src/brain/store.rs` |
| Chat/Terminal separation | `agent-shell-terminal-mode` vs `agent-shell-chat-mode` | `a2r-runtime/src/lib.rs` ✅ |

---

**END OF AGENT-SHELL PARITY DOCUMENT**
