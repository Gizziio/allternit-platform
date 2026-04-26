# Gateway-iMessage Technical Specification

> **Component:** `services/gateway-imessage`
> **Priority:** P0 - Immediate Implementation
> **Status:** Not Started

---

## 1. Overview

The Gateway-iMessage service ("The Hive") is a Mac-native service that:
1. Monitors `~/Library/Messages/chat.db` for incoming iMessages
2. Routes messages to the orchestration layer
3. Sends replies via AppleScript

This provides a **native blue bubble experience** without requiring any iOS app.

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Mac Mini (The Hive)                         │
│                                                                     │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐ │
│  │   chat_db.rs    │───▶│   poller.rs     │───▶│   bridge.rs     │ │
│  │ (SQLite Reader) │    │ (Change Detect) │    │ (To Orchestrator)│ │
│  └─────────────────┘    └─────────────────┘    └────────┬────────┘ │
│                                                          │          │
│  ┌─────────────────┐                                     │          │
│  │   sender.rs     │◀────────────────────────────────────┘          │
│  │  (AppleScript)  │                                                │
│  └─────────────────┘                                                │
└─────────────────────────────────────────────────────────────────────┘
          │                                          ▲
          ▼                                          │
┌─────────────────────────────────────────────────────────────────────┐
│                        Orchestration Layer                          │
│  (router-agent → router-model → function-compiler → executor)      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Module Specifications

### 3.1 chat_db.rs - SQLite Reader

**Purpose:** Read incoming messages from macOS Messages database.

**Database Location:** `~/Library/Messages/chat.db`

**Key Tables:**
- `message` - All messages (text, date, is_from_me, handle_id)
- `handle` - Contact info (phone number, email)
- `chat` - Conversation threads
- `chat_message_join` - Links chats to messages

**Core Query:**
```sql
SELECT
    m.ROWID,
    m.guid,
    m.text,
    m.date,
    m.is_from_me,
    m.service,
    h.id as sender_id
FROM message m
JOIN handle h ON m.handle_id = h.ROWID
WHERE m.ROWID > ?
  AND m.is_from_me = 0
ORDER BY m.ROWID ASC
LIMIT 100;
```

**Date Handling:**
- macOS stores dates as nanoseconds since 2001-01-01
- Conversion: `unix_timestamp = (mac_timestamp / 1_000_000_000) + 978307200`

**Rust Interface:**
```rust
pub struct ChatDbReader {
    conn: Connection,
    last_rowid: i64,
}

impl ChatDbReader {
    pub fn new() -> Result<Self, ChatDbError>;
    pub fn poll(&mut self) -> Result<Vec<IncomingMessage>, ChatDbError>;
    pub fn get_conversation_history(&self, sender_id: &str, limit: usize)
        -> Result<Vec<Message>, ChatDbError>;
}

pub struct IncomingMessage {
    pub rowid: i64,
    pub guid: String,
    pub text: String,
    pub timestamp: DateTime<Utc>,
    pub sender_id: String,       // Phone number or email
    pub service: String,         // "iMessage" or "SMS"
}
```

### 3.2 poller.rs - Change Detection

**Purpose:** Detect new messages in real-time.

**Approach Options:**

1. **Polling (Recommended for POC):**
   - Check database every 500ms
   - Track last processed ROWID
   - Simple and reliable

2. **FSEvents (Future Enhancement):**
   - Watch chat.db for modifications
   - More efficient but complex
   - May miss rapid changes

**Rust Interface:**
```rust
pub struct MessagePoller {
    reader: ChatDbReader,
    poll_interval: Duration,
    tx: mpsc::Sender<IncomingMessage>,
}

impl MessagePoller {
    pub fn new(tx: mpsc::Sender<IncomingMessage>) -> Result<Self, Error>;
    pub async fn start(&mut self) -> Result<(), Error>;
    pub fn stop(&mut self);
}
```

### 3.3 sender.rs - AppleScript Executor

**Purpose:** Send iMessages via AppleScript.

**AppleScript Template:**
```applescript
tell application "Messages"
    set targetService to 1st account whose service type is iMessage
    set targetBuddy to participant "{recipient}" of targetService
    send "{message}" to targetBuddy
end tell
```

**Rust Interface:**
```rust
pub struct MessageSender;

impl MessageSender {
    pub fn send(recipient: &str, message: &str) -> Result<(), SendError>;
    pub fn send_with_retry(recipient: &str, message: &str, retries: u32)
        -> Result<(), SendError>;
}

pub enum SendError {
    AppleScriptFailed(String),
    RecipientNotFound,
    ServiceUnavailable,
}
```

**Security Considerations:**
- Escape special characters in message text
- Validate recipient format (phone number or email)
- Rate limit outbound messages

### 3.4 bridge.rs - Orchestrator Connection

**Purpose:** Connect gateway to the orchestration layer.

**For POC:** Direct function calls (in-process)
**For Production:** HTTP/gRPC or message queue (NATS)

**Rust Interface:**
```rust
pub struct OrchestratorBridge {
    // POC: Direct reference
    // Production: HTTP client or NATS connection
}

impl OrchestratorBridge {
    pub async fn process_message(&self, msg: IncomingMessage)
        -> Result<String, ProcessError>;
}
```

---

## 4. Main Application Flow

```rust
// main.rs pseudo-code
#[tokio::main]
async fn main() -> Result<()> {
    // Initialize components
    let (tx, mut rx) = mpsc::channel(100);
    let mut poller = MessagePoller::new(tx)?;
    let bridge = OrchestratorBridge::new()?;

    // Start polling in background
    tokio::spawn(async move {
        poller.start().await.unwrap();
    });

    // Process incoming messages
    while let Some(msg) = rx.recv().await {
        println!("Received from {}: {}", msg.sender_id, msg.text);

        // Get response from orchestrator
        match bridge.process_message(msg.clone()).await {
            Ok(response) => {
                MessageSender::send(&msg.sender_id, &response)?;
                println!("Replied: {}", response);
            }
            Err(e) => {
                eprintln!("Failed to process: {:?}", e);
            }
        }
    }

    Ok(())
}
```

---

## 5. Configuration

```toml
# config.toml
[gateway]
poll_interval_ms = 500
max_message_length = 2000
rate_limit_per_minute = 60

[database]
path = "~/Library/Messages/chat.db"
# path is auto-expanded

[orchestrator]
mode = "local"  # or "http", "nats"
# For http mode:
# url = "http://localhost:3000/api/process"
```

---

## 6. Permissions Required

### Full Disk Access
The binary needs Full Disk Access to read `chat.db`:

1. System Preferences → Security & Privacy → Privacy → Full Disk Access
2. Add Terminal.app (for development) or the compiled binary

### Automation Permission
For AppleScript to control Messages:

1. First run will prompt for permission
2. Grant "Terminal" (or binary) permission to control "Messages"

---

## 7. Error Handling

| Error | Recovery |
|-------|----------|
| Database locked | Retry with exponential backoff |
| Connection refused | Queue messages, retry connection |
| AppleScript timeout | Log and skip, notify user |
| Rate limit exceeded | Backoff, queue messages |

---

## 8. Testing Strategy

### Unit Tests
- `chat_db.rs`: Mock SQLite database with test messages
- `sender.rs`: Mock osascript execution
- `poller.rs`: Test change detection logic

### Integration Tests
- End-to-end with actual Messages database (requires Mac)
- Send test message from iPhone, verify detection
- Send reply, verify delivery

### Manual Testing Checklist
- [ ] Receive message from iPhone, see in terminal
- [ ] Send reply, receive on iPhone (blue bubble)
- [ ] Handle emoji and special characters
- [ ] Handle long messages (split if needed)
- [ ] Handle rapid message sequences
- [ ] Handle multiple senders simultaneously

---

## 9. Future Enhancements

### Phase 2
- FSEvents for efficient change detection
- Message threading (reply to specific message)
- Read receipts handling
- Typing indicators

### Phase 3
- Multi-Mac distribution (The Swarm)
- Identity Pool management
- Load balancing across Macs
- Health monitoring and failover

---

## 10. Dependencies

```toml
[dependencies]
tokio = { version = "1.0", features = ["full"] }
rusqlite = { version = "0.31", features = ["bundled"] }
chrono = { version = "0.4", features = ["serde"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
thiserror = "1.0"
tracing = "0.1"
tracing-subscriber = "0.3"
dirs = "5.0"  # For home directory resolution
```

---

## 11. File Structure

```
services/gateway-imessage/
├── Cargo.toml
├── src/
│   ├── lib.rs           # Module exports
│   ├── main.rs          # Entry point
│   ├── chat_db.rs       # SQLite reader
│   ├── poller.rs        # Change detection
│   ├── sender.rs        # AppleScript wrapper
│   ├── bridge.rs        # Orchestrator connection
│   ├── config.rs        # Configuration loading
│   └── error.rs         # Error types
└── tests/
    ├── chat_db_test.rs
    └── integration_test.rs
```
