# What Actually Runs: Static Site vs Full Platform

## The Confusion

You're asking: *"If it's static pages, where does the actual allternit platform run?"*

**Answer: The FULL platform DOES NOT run on static pages alone.**

Let me be crystal clear about what runs where:

---

## Three Different Experiences

```
┌─────────────────────────────────────────────────────────────────────────────┐
│           EXPERIENCE A: BROWSER-ONLY (No VPS)                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  What User Sees:                                                            │
│  ├─ Landing page ✓                                                          │
│  ├─ Dashboard with "connect VPS" prompt ✓                                   │
│  ├─ AI Chat (WebGPU) ✓                                                      │
│  ├─ Agent Designer UI (drag-drop) ✓                                         │
│  ├─ Templates library ✓                                                     │
│  ├─ Settings ✓                                                              │
│  └─ "Connect VPS to run agents" CTA ✓                                       │
│                                                                             │
│  What Does NOT Work:                                                        │
│  ├─ ❌ Real browser automation                                              │
│  ├─ ❌ Chrome streaming                                                     │
│  ├─ ❌ Python code execution                                                │
│  ├─ ❌ Persistent agent workflows                                           │
│  ├─ ❌ File system access                                                   │
│  ├─ ❌ Docker containers                                                    │
│  └─ ❌ Long-running processes                                               │
│                                                                             │
│  Why: Browser sandbox prevents these                                        │
│                                                                             │
│  Use Case: Trial/demo, learning the platform                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│           EXPERIENCE B: CONNECTED TO VPS (Full Platform)                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  What User Sees:                                                            │
│  ├─ Everything from Experience A ✓                                          │
│  ├─ Real Chrome browser window ✓                                            │
│  ├─ Agent actually navigating websites ✓                                    │
│  ├─ Python code execution ✓                                                 │
│  ├─ Persistent chat history ✓                                               │
│  ├─ File uploads/downloads ✓                                                │
│  ├─ Long-running workflows ✓                                                │
│  └─ Full API access ✓                                                       │
│                                                                             │
│  Architecture:                                                              │
│  ├─ Static website (Cloudflare)                                             │
│  ├─ ↓                                                                       │
│  ├─ User's browser                                                          │
│  ├─ ↓                                                                       │
│  └─ Customer's VPS (Rust API + Chrome + SQLite)                             │
│                                                                             │
│  Use Case: Production use, real automation                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│           EXPERIENCE C: YOUR HOSTED VPS (Optional Enterprise)               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  What User Sees:                                                            │
│  ├─ Same as Experience B ✓                                                  │
│  ├─ But YOU host the VPS                                                    │
│  └─ They pay you premium for managed service                                │
│                                                                             │
│  Architecture:                                                              │
│  ├─ Static website (Cloudflare)                                             │
│  ├─ ↓                                                                       │
│  ├─ User's browser                                                          │
│  ├─ ↓                                                                       │
│  └─ YOUR VPS (Rust API + Chrome + SQLite)                                   │
│      └─ You manage Kubernetes/Docker                                        │
│                                                                             │
│  Use Case: Enterprise customers who don't want to manage VPS                │
│  Revenue: $500-2000/mo per customer                                         │
│  Cost to you: $50-100/mo per customer (VPS)                                 │
│  Margin: 80-90%                                                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## The Reality Check

### What Runs on Cloudflare Pages (Static Only)

```typescript
// This is what "static" means:
// Just HTML, CSS, JavaScript files

// 1. LANDING PAGE (works)
function LandingPage() {
  return (
    <div>
      <h1>allternit</h1>
      <p>AI Browser Automation</p>
      <button>Sign Up</button>
    </div>
  );
}

// 2. DASHBOARD UI (works)
function Dashboard() {
  return (
    <div>
      <h2>Your Agents</h2>
      {/* List of agents from localStorage */}
      {/* Button to "connect VPS" */}
    </div>
  );
}

// 3. AGENT DESIGNER UI (works - just the interface)
function AgentDesigner() {
  return (
    <div>
      <DragDropWorkflowBuilder />  {/* React component */}
      <button>Save Agent</button>   {/* Saves to localStorage */}
      <button>Run Agent</button>    {/* Shows "connect VPS" modal */}
    </div>
  );
}

// 4. AI CHAT (works - WebGPU)
function AIChat() {
  const model = useWebGPUModel('phi-2');
  
  const sendMessage = async (msg) => {
    // Runs IN BROWSER, no server needed
    const response = await model.generate(msg);
  };
}

// 5. WHAT DOESN'T WORK without VPS:
function WhatDoesntWork() {
  // ❌ Can't run real Chrome
  // ❌ Can't execute Python
  // ❌ Can't access file system
  // ❌ Can't run Docker
  // ❌ Can't make outbound HTTP from server
  
  return (
    <div>
      <p>These features require VPS connection:</p>
      <ul>
        <li>🚫 Browser automation</li>
        <li>🚫 Chrome streaming</li>
        <li>🚫 Code execution</li>
        <li>🚫 File system access</li>
      </ul>
      <button>Connect VPS to Unlock</button>
    </div>
  );
}
```

### What Requires a VPS (Backend Server)

```rust
// This runs on customer's VPS (or yours for enterprise)
// NOT on static hosting!

#[tokio::main]
async fn main() {
    // Real HTTP server
    let app = Router::new()
        // Browser automation endpoints
        .route("/browser/session", post(create_browser_session))
        .route("/browser/navigate", post(navigate_browser))
        .route("/browser/click", post(click_element))
        .route("/browser/screenshot", post(take_screenshot))
        
        // Agent execution
        .route("/agent/run", post(run_agent))
        .route("/agent/status", get(get_agent_status))
        
        // Code execution
        .route("/execute/python", post(execute_python))
        .route("/execute/javascript", post(execute_javascript))
        
        // File system
        .route("/files/upload", post(upload_file))
        .route("/files/download", get(download_file))
        
        // Chrome streaming
        .route("/chrome/stream", get(stream_chrome_webrtc));
    
    // Bind to port 3010
    let listener = TcpListener::bind("0.0.0.0:3010").await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

// Real Chrome browser (not available in browser sandbox)
async fn create_browser_session() -> Json<BrowserSession> {
    let chrome = Chrome::new();
    // Launch actual Chrome process
    // This CANNOT run in browser!
}

// Real Python execution
async fn execute_python(code: String) -> Json<ExecutionResult> {
    // Spawn Python process
    // Run code in sandbox
    // Return results
    // This CANNOT run in browser!
}
```

---

## Architecture Diagram: Complete Picture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    COMPLETE SYSTEM ARCHITECTURE                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  LAYER 1: YOUR CLOUDFLARE (Static + Edge)                                   │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │  PAGES (Static Website)                                               │ │
│  │  ├─ index.html (landing page)                                         │ │
│  │  ├─ dashboard.html (dashboard UI)                                     │ │
│  │  ├─ app.js (React app)                                                │ │
│  │  ├─ styles.css                                                        │ │
│  │  └─ These are JUST files! No server code!                             │ │
│  │                                                                       │ │
│  │  What they CAN do:                                                    │ │
│  │  ├─ Render UI                                                         │ │
│  │  ├─ Handle user clicks                                                │ │
│  │  ├─ Run WebGPU AI (in user's browser)                                 │ │
│  │  ├─ Store data in browser (localStorage)                              │ │
│  │  └─ Make API calls to external servers                                │ │
│  │                                                                       │ │
│  │  What they CANNOT do:                                                 │ │
│  │  ├─ Run a server process                                              │ │
│  │  ├─ Listen on a port                                                  │ │
│  │  ├─ Execute system commands                                           │ │
│  │  ├─ Access file system                                                │ │
│  │  └─ Run Chrome/Docker/Python                                          │ │
│  │                                                                       │ │
│  │  Cost: $20/mo                                                         │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                              │                                              │
│                              │ (API calls, WebSocket)                       │
│                              ▼                                              │
│  LAYER 2: CUSTOMER'S VPS (Full Backend)                                     │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │  RUST API SERVER (Port 3010)                                          │ │
│  │  ├─ Running process                                                   │ │
│  │  ├─ Listening on port 3010                                            │ │
│  │  ├─ Real HTTP server                                                  │ │
│  │  │                                                                     │ │
│  │  ├─ CHROME BROWSER (Port 9222)                                        │ │
│  │  │  └─ Real Chrome process                                            │ │
│  │  │                                                                     │ │
│  │  ├─ SQLITE DATABASE                                                   │ │
│  │  │  └─ Persistent storage                                             │ │
│  │  │                                                                     │ │
│  │  ├─ DOCKER (Optional)                                                 │ │
│  │  │  └─ Containerized services                                         │ │
│  │  │                                                                     │ │
│  │  └─ PYTHON RUNTIME                                                    │ │
│  │     └─ Code execution                                                  │ │
│  │                                                                       │ │
│  │  Cost: Customer pays $20-40/mo                                        │ │
│  │  Location: DigitalOcean, AWS, Hetzner, etc.                           │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                              │                                              │
│                              │ (WebRTC video stream)                        │
│                              ▼                                              │
│  LAYER 3: USER'S BROWSER (Frontend)                                         │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │  RENDERED UI                                                          │ │
│  │  ├─ Sees Chrome stream (WebRTC)                                       │ │
│  │  ├─ Controls agent (API calls to VPS)                                 │ │
│  │  ├─ Chat with AI (WebGPU local)                                       │ │
│  │  └─ Views results                                                     │ │
│  │                                                                       │ │
│  │  Cost: User pays $0 (uses their computer)                             │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## The Static Website is Just the INTERFACE

Think of it like this:

```
STATIC WEBSITE = TV Remote Control
├─ Buttons (UI)
├─ Display (Interface)
├─ Sends signals (API calls)
└─ But NO processing power!

VPS = The Actual TV
├─ Processor (CPU)
├─ Memory (RAM)
├─ Runs apps (Chrome, Python, etc.)
├─ Does the actual work
└─ Connected to via remote (static site)
```

**The remote (static site) can't watch Netflix by itself!**
**It needs the TV (VPS) to do the actual work.**

---

## What allternit Actually Needs to Run

| Feature | Needs VPS? | Why? |
|---------|------------|------|
| **Landing page** | No | Just HTML/CSS |
| **User login** | No | Clerk handles this |
| **Dashboard UI** | No | React components |
| **AI Chat (browser)** | No | WebGPU runs locally |
| **Agent Designer UI** | No | React drag-drop |
| **Browser automation** | **YES** | Needs real Chrome |
| **Chrome streaming** | **YES** | Needs WebRTC server |
| **Python execution** | **YES** | Needs Python runtime |
| **File storage** | **YES** | Needs file system |
| **Docker containers** | **YES** | Needs Docker daemon |
| **Database persistence** | **YES** | Needs server storage |
| **Long-running tasks** | **YES** | Background processes |
| **API endpoints** | **YES** | HTTP server required |

---

## The Business Model Implication

```
FREE TIER (Browser-Only):
├─ Can: Chat with AI, design agents, browse templates
├─ Cannot: Run agents, automate browsers, execute code
├─ Limitation: "Connect VPS to unlock full features"
└─ Purpose: Let users try the platform

PRO TIER (With VPS):
├─ Can: Everything - full platform
├─ Customer provides: Their own VPS
├─ You provide: Static website + installer
└─ Revenue: $29/mo subscription

ENTERPRISE (Optional):
├─ Can: Everything - full platform
├─ You provide: Static website + managed VPS
├─ Revenue: $99-499/mo
└─ Margin: 80%+ (VPS costs $40, you charge $200)
```

---

## Bottom Line

**Q: Where does allternit run?**

**A:**
1. **Static website** (UI) → Cloudflare Pages
2. **Full platform** (Chrome, Python, agents) → Customer's VPS
3. **Browser demo** (AI chat only) → User's browser (WebGPU)

**Q: Can you run the full platform without a VPS?**

**A: NO.** Browser sandbox prevents:
- Running Chrome
- Executing Python
- File system access
- Docker containers
- Background processes

**Q: What do browser-only users get?**

**A:** A demo/trial experience - they can chat with AI and design agents, but can't actually RUN them until they connect a VPS.

**Q: Is this a bad experience?**

**A:** NO. This is the freemium model:
- Free: Try the AI, design workflows (gets them hooked)
- Paid: Unlock full automation (where the value is)

---

## Next Steps

1. ✅ Accept that browser-only = limited demo
2. ✅ Build "connect VPS" as core conversion flow
3. ✅ Make the VPS setup as easy as possible (one-click)
4. ✅ Show clear value: "This agent would automate X task - deploy to run it"

**The static site is the REMOTE. The VPS is the TV.**
