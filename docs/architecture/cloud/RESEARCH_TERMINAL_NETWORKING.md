# Research: Terminus-Style Terminal & Networking

## Goal
Enable persistent, low-latency terminal and file access to user VPS/local machines via web browser (and eventually mobile app), similar to Termius, but integrated with A2R's agent orchestration.

---

## Current Landscape Analysis

### Termius (The Gold Standard)
**What they do well:**
- Persistent SSH connections across devices
- Sync hosts, keys, and snippets
- SFTP file manager
- Port forwarding
- Mobile apps (iOS/Android)
- Terminal: xterm-256color support
- Biometric auth on mobile

**Architecture (inferred):**
```
Mobile App → SSH → User's Server
            ↓
       Local Terminal (on device)
```

**Limitations:**
- Direct SSH only (no reverse tunnel)
- No orchestration layer
- Single session per connection
- No agent coordination

### GitHub Codespaces
**What they do well:**
- Web-based VS Code
- Integrated terminal
- Port forwarding via web
- Persistent dev environments

**Architecture:**
```
Browser → WebSocket → Codespaces Container
```

**Limitations:**
- Locked to GitHub ecosystem
- Expensive compute ($$)
- No BYOD (bring your own infrastructure)

### Replit
**What they do well:**
- Instant web IDE
- Collaborative editing
- Deployment

**Limitations:**
- No local/VPS compute
- Proprietary runtime

### Our Differentiation
```
Browser → A2R Control Plane ← WebSocket → User's VPS/Local
              ↓
         Terminal (xterm.js)
         File Manager
         Agent Dashboard
         Logs Viewer
```

**Advantages:**
- Works through firewalls (outbound connection)
- Persistent even when browser closes
- Multi-agent orchestration
- Hybrid cloud + local
- Cost effective (user brings compute)

---

## Technical Research

### 1. Web Terminal Technologies

#### Option A: xterm.js (Recommended)
**Pros:**
- Industry standard (VS Code, GitHub, Hyper)
- Full xterm-256color support
- WebGL rendering for performance
- Addon ecosystem (fit, web-links, search)
- Active maintenance

**Cons:**
- Requires WebSocket for data
- Heavy on mobile browsers

**Implementation:**
```typescript
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';

const term = new Terminal({
  cursorBlink: true,
  theme: { background: '#1a1a2e', foreground: '#fff' }
});

const fitAddon = new FitAddon();
term.loadAddon(fitAddon);
term.loadAddon(new WebLinksAddon());

// WebSocket connection to PTY
const ws = new WebSocket('wss://control.a2r.io/terminal/{session_id}');
ws.onmessage = (e) => term.write(e.data);
term.onData(data => ws.send(data));
```

#### Option B: ttyd
**Pros:**
- Simple setup
- Built-in authentication
- C++ backend (fast)

**Cons:**
- Limited customization
- Not integrated with our stack

**Verdict:** Use for quick prototyping, not production.

#### Option C: Custom Canvas Terminal
**Pros:**
- Full control
- Optimized for our use case

**Cons:**
- Massive engineering effort
- Compatibility issues

**Verdict:** No, use xterm.js.

---

### 2. PTY (Pseudo Terminal) Management

#### Architecture
```
User Browser → WebSocket → A2R Control Plane → WebSocket → A2R Node → PTY → Shell
```

#### PTY Implementation Options

**Rust:**
```rust
use tokio::process::Command;
use portable_pty::{CommandBuilder, PtySize, native_pty_system};

pub struct PtySession {
    pub master: Box<dyn MasterPty>,
    pub child: Box<dyn Child>,
}

impl PtySession {
    pub fn new(shell: &str) -> Result<Self, Error> {
        let pty_system = native_pty_system();
        
        let pair = pty_system.openpty(PtySize {
            rows: 24,
            cols: 80,
            pixel_width: 0,
            pixel_height: 0,
        })?;
        
        let cmd = CommandBuilder::new(shell);
        let child = pair.slave.spawn_command(cmd)?;
        
        Ok(Self {
            master: pair.master,
            child,
        })
    }
    
    pub async fn read(&mut self, buf: &mut [u8]) -> Result<usize, Error> {
        self.master.read(buf)
    }
    
    pub async fn write(&mut self, data: &[u8]) -> Result<(), Error> {
        self.master.write_all(data)
    }
}
```

**Node.js Alternative:**
- `node-pty` is mature and battle-tested
- VS Code uses it
- But adds Node dependency to agent

**Verdict:** Use Rust `portable-pty` for A2R Node.

---

### 3. WebSocket Protocol for Terminal

#### Message Types
```typescript
interface TerminalMessage {
  type: 'data' | 'resize' | 'heartbeat' | 'close';
  sessionId: string;
  payload?: string | ResizePayload;
}

interface ResizePayload {
  cols: number;
  rows: number;
}
```

#### Protocol Flow
```
1. Browser requests terminal session
   POST /api/v1/sessions
   → Returns: { sessionId, wsUrl }

2. Browser connects WebSocket
   wss://control.a2r.io/ws/terminal/{sessionId}

3. Control plane routes to appropriate node
   Node opens PTY, starts shell

4. Bidirectional data flow
   Browser ↔ WebSocket ↔ Control Plane ↔ WebSocket ↔ Node PTY

5. Session persistence
   - If browser disconnects: session stays alive
   - If node disconnects: session ends
   - Heartbeat every 30s
```

#### Session State Management
```rust
pub struct TerminalSession {
    pub id: String,
    pub node_id: String,
    pub user_id: String,
    pub created_at: Instant,
    pub last_activity: Instant,
    pub pty: Option<PtySession>,
    pub browser_ws: Option<WebSocketConnection>,
}

pub struct SessionManager {
    sessions: DashMap<String, TerminalSession>,
    timeout: Duration, // 1 hour idle timeout
}
```

---

### 4. File Manager (SFTP over WebSocket)

#### Protocol
Instead of separate SFTP connection, tunnel over WebSocket:

```typescript
interface FileMessage {
  type: 'list' | 'read' | 'write' | 'delete' | 'mkdir' | 'upload' | 'download';
  path: string;
  data?: Uint8Array;
}
```

#### Features
- **List:** Directory contents with metadata
- **Read:** File content (streaming for large files)
- **Write:** Upload file (chunked)
- **Delete:** Remove file/directory
- **Mkdir:** Create directory
- **Search:** Find files by name
- **Edit:** In-browser text editor (Monaco/vim/emacs modes)

#### Chunking for Large Files
```typescript
const CHUNK_SIZE = 64 * 1024; // 64KB

async function uploadFile(path: string, file: File) {
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  
  for (let i = 0; i < totalChunks; i++) {
    const chunk = file.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    const buffer = await chunk.arrayBuffer();
    
    ws.send(JSON.stringify({
      type: 'upload_chunk',
      path,
      chunkIndex: i,
      totalChunks,
      data: Array.from(new Uint8Array(buffer))
    }));
  }
}
```

---

### 5. Mobile Considerations

#### Challenges
1. **Touch keyboard:** No physical Ctrl, Alt, Esc keys
2. **Screen size:** Limited real estate
3. **Battery:** WebSocket keeps connection alive
4. **Backgrounding:** App pause kills WebSocket

#### Solutions

**1. Touch Keyboard Enhancements**
```typescript
// Custom keyboard bar with special keys
const SpecialKeys = [
  { label: 'Ctrl', key: 'Control' },
  { label: 'Alt', key: 'Alt' },
  { label: 'Tab', key: 'Tab' },
  { label: 'Esc', key: 'Escape' },
  { label: '↑', key: 'ArrowUp' },
  { label: '↓', key: 'ArrowDown' },
  { label: '|', key: '|' },
  { label: '~', key: '~' },
];
```

**2. Responsive Layout**
```css
/* Hide sidebar on mobile, show hamburger menu */
@media (max-width: 768px) {
  .sidebar { display: none; }
  .mobile-nav { display: flex; }
  .terminal { height: calc(100vh - 60px); }
}
```

**3. Connection Persistence**
- Use Service Workers for background sync
- Reconnect on foreground
- Queue commands while offline

**4. Mobile App (Future)**
- React Native or Capacitor wrapper
- Native keyboard handling
- Push notifications for job completion
- Biometric auth

---

### 6. Security Considerations

#### Transport Security
- **WSS only** (WebSocket Secure)
- **mTLS** between control plane and nodes
- **Token-based auth** for browser sessions

#### Session Isolation
```rust
// Each session is isolated
pub struct SecureSession {
    session_id: String,
    user_id: String,
    node_id: String,
    permissions: Permissions, // What user can do
    timeout: Duration,
}

impl SecureSession {
    pub fn validate_action(&self, action: &Action) -> Result<(), Error> {
        if !self.permissions.allows(action) {
            return Err(Error::PermissionDenied);
        }
        Ok(())
    }
}
```

#### Input Sanitization
- Escape sequences validated before sending to PTY
- Rate limiting on commands
- Audit logging

---

### 7. Performance Optimization

#### WebSocket Compression
```rust
// Enable per-message deflate
tokio_tungstenite::accept_hdr_async(
    stream,
    |_req: &Request, mut response: Response| {
        response.headers_mut().insert(
            "sec-websocket-extensions",
            HeaderValue::from_static("permessage-deflate"),
        );
        Ok(response)
    }
)
```

#### Message Batching
- Batch small terminal outputs (≤16ms)
- Reduces WebSocket overhead

#### Rendering Optimization
```typescript
// Use requestAnimationFrame for smooth rendering
let pendingData = '';

ws.onmessage = (e) => {
  pendingData += e.data;
  
  if (!scheduled) {
    scheduled = true;
    requestAnimationFrame(() => {
      term.write(pendingData);
      pendingData = '';
      scheduled = false;
    });
  }
};
```

---

## Implementation Plan

### Phase 1: Basic Terminal (Week 1)
- [ ] xterm.js integration
- [ ] WebSocket PTY backend
- [ ] Single session support

### Phase 2: Session Management (Week 2)
- [ ] Session persistence
- [ ] Reconnect logic
- [ ] Multi-tab support

### Phase 3: File Manager (Week 3)
- [ ] File browser UI
- [ ] Upload/download
- [ ] Basic text editing

### Phase 4: Mobile Optimization (Week 4)
- [ ] Touch keyboard
- [ ] Responsive layout
- [ ] Performance tuning

### Phase 5: Advanced Features (Week 5-6)
- [ ] Port forwarding
- [ ] SFTP sync
- [ ] Command snippets

---

## Libraries & Tools

### Frontend
- **xterm.js:** Terminal emulator
- **react-xterm:** React wrapper
- **monaco-editor:** Code editing (VS Code editor)
- **react-dropzone:** File uploads

### Backend
- **tokio-tungstenite:** WebSocket server
- **portable-pty:** PTY management
- **russh:** SSH client (for fallback)
- **axum:** Web framework

### Mobile (Future)
- **Capacitor:** Web-to-native bridge
- **ionic:** Mobile UI components

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Terminal latency | <50ms | Ping test |
| File upload speed | >1MB/s | 10MB file upload |
| Mobile usability | Good | User testing |
| Session stability | 99% | Uptime tracking |
| Concurrent sessions | 10+ | Load testing |

---

## Open Questions

1. **How do we handle clipboard on mobile?**
   - Web Clipboard API (limited support)
   - Custom paste dialog
   - Integration with system clipboard (mobile app only)

2. **Should we support multiple simultaneous terminals per node?**
   - Yes: Different working directories
   - Implementation: Multiple PTY sessions

3. **How do we handle huge log files?**
   - Streaming with virtual scrolling
   - Search indexing
   - Pagination

4. **What about GUI applications?**
   - Future: VNC over WebSocket
   - Or: X11 forwarding (complex)
   - Focus on CLI first

---

## Conclusion

**Recommendation:** Use xterm.js + WebSocket + custom PTY backend.

**Why:**
1. Proven technology (VS Code uses it)
2. Full terminal compatibility
3. Works in any browser
4. Extensible for file manager, etc.

**Next Steps:**
1. Prototype xterm.js + WebSocket
2. Test on mobile browsers
3. Implement PTY backend in Rust
4. Build file manager
