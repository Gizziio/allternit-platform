# Backend Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           A2rchitech API Service                             │
│                          (7-apps/api/src/main.rs)                            │
├─────────────────────────────────────────────────────────────────────────────┤
│  HTTP Layer (Axum Router)                                                    │
│  ├── /api/v1/sessions/*   → SessionManagerService                            │
│  ├── /api/v1/cron/*       → CronSystemService                                │
│  ├── /api/v1/logs/*       → LogService                                       │
│  ├── /api/v1/config/*     → ConfigSystemService                              │
│  ├── /api/v1/channels/*   → ChannelAbstractionService                        │
│  ├── /api/v1/rails/*      → Agent Rails (proxy)                              │
│  └── /health, /metrics    → System endpoints                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│  Service Layer (Native Rust)                                                 │
│  ├── CronSystemService        - Job scheduling (tokio-cron-scheduler)        │
│  ├── LogService               - Log aggregation (file-based)                 │
│  ├── ConfigSystemService      - Configuration management (JSON persistence)  │
│  ├── ChannelAbstractionService - Multi-channel messaging                     │
│  └── SessionManagerService    - Session state management                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  Persistence Layer                                                           │
│  ├── Cron jobs       → ./cron-jobs/*.json                                    │
│  ├── Config          → ./a2r/system/config.json                              │
│  ├── Logs            → ./.logs/*.log                                         │
│  └── Sessions        → In-memory (SessionManager)                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Service Initialization Flow

```rust
// main.rs - Service startup sequence

1. ControlPlaneService          // Core kernel service
2. CapsuleStore                 // Package management
3. SessionServiceState          // Chat sessions
4. ToolGateway                  // MCP tool execution
5. CronSystemService::new()     // Initialize scheduler
   └── initialize().await       // Load saved jobs
6. LogService::new()            // Log aggregator
7. ConfigSystemService::new()   // Config management
   └── initialize().await       // Load config file
8. ChannelAbstractionService    // Channel integrations
   └── initialize().await
```

---

## Service Pattern

All services follow the **same architectural pattern**:

```rust
pub struct ServiceName {
    config: ServiceConfig,           // Service configuration
    state: ServiceState,             // Runtime state (HashMap, etc.)
    persistence: PersistenceLayer,   // Files, DB, etc.
}

impl ServiceName {
    pub async fn new() -> Result<Self, Error>;
    pub async fn initialize(&mut self) -> Result<(), Error>;
    pub async fn execute(&mut self, request: Request) -> Result<Response, Error>;
}
```

---

## Service Details

### **1. CronSystemService** (OPS Mode)

**Location:** `native_cron_system.rs`

**Purpose:** Schedule and execute periodic jobs

**State:**
```rust
pub struct CronSystemService {
    config: CronSystemConfig,                    // jobs_dir, persistence settings
    scheduler: JobScheduler,                     // tokio-cron-scheduler instance
    jobs: HashMap<CronJobId, CronJobDefinition>, // All job definitions
    job_history: HashMap<CronJobId, Vec<CronJobResult>>, // Execution history
    active_handles: HashMap<CronJobId, Uuid>,    // Scheduler handles
}
```

**Persistence:**
- Jobs saved to: `./cron-jobs/{job_id}.json`
- JSON format with full job definition

**API Endpoints:**
```
GET    /api/v1/cron           → list_jobs()
POST   /api/v1/cron           → create_job()
DELETE /api/v1/cron/:id       → remove_job()
POST   /api/v1/cron/:id/run   → execute_now()
POST   /api/v1/cron/:id/enable → enable_job()
POST   /api/v1/cron/:id/disable → disable_job()
```

**Request/Response Pattern:**
```rust
CronJobManagementRequest {
    operation: CronJobOperation::ListJobs,
    context: None,
}
↓
CronJobManagementResponse {
    success: true,
    result: Some(json!({ "jobs": [...] })),
    error: None,
    execution_time_ms: 42,
}
```

---

### **2. LogService** (OPS Mode)

**Location:** `native_log_service.rs`

**Purpose:** Aggregate and query logs from all services

**State:**
```rust
pub struct LogService {
    logs_dir: PathBuf,           // ./.logs/
    max_entries: usize,          // 10,000
    sources: Vec<String>,        // ["kernel", "api", "gateway"]
}
```

**Log Format:**
```
[2024-01-15T10:30:00Z] [INFO] [kernel] Message here
[2024-01-15T10:30:01Z] [ERROR] [api] Error details
```

**Features:**
- **Tail:** Last N lines from log files
- **Stream:** Real-time SSE streaming
- **Filter:** Search by level, source, time range
- **Sources:** Auto-discovers log files in ./.logs/

**API Endpoints:**
```
GET /api/v1/logs?source=&lines=&level= → query_logs()
GET /api/v1/logs/sources               → list_sources()
GET /api/v1/logs/stream                → stream_logs() (SSE)
```

---

### **3. ConfigSystemService** (SYS Mode)

**Location:** `native_config_system.rs`

**Purpose:** Centralized configuration management

**State:**
```rust
pub struct ConfigSystemService {
    config: ConfigSystemConfig,              // config_file path
    data: HashMap<String, ConfigValue>,      // Current config values
    history: Vec<ConfigChange>,              // Audit trail
    defaults: HashMap<String, ConfigValue>,  // Default values
}
```

**Config Value Types:**
```rust
pub enum ConfigValue {
    String(String),
    Number(f64),
    Boolean(bool),
    Array(Vec<ConfigValue>),
    Object(HashMap<String, ConfigValue>),
    Null,
}
```

**Dot Notation Paths:**
```
kernel.url              → "http://127.0.0.1:3004"
kernel.timeout_seconds  → 30
logging.level           → "info"
agent.default_model     → "claude-3-5-sonnet"
```

**Persistence:**
- Config file: `./a2r/system/config.json`
- Backup: `./a2r/system/config.json.backup.{timestamp}`

**API Endpoints:**
```
GET    /api/v1/config?path=        → get_config()
PATCH  /api/v1/config              → set_config()
POST   /api/v1/config/validate     → validate_config()
POST   /api/v1/config/apply        → apply_config()
GET    /api/v1/config/history      → get_history()
GET    /api/v1/config/keys         → list_keys()
POST   /api/v1/config/reset        → reset_config()
```

**Validation:**
- URL format checking
- Timeout range validation (1-300 seconds)
- Log level validation (trace, debug, info, warn, error)

---

### **4. ChannelAbstractionService** (OPS Mode)

**Location:** `native_channel_abstraction_native.rs`

**Purpose:** Manage external service integrations

**State:**
```rust
pub struct ChannelAbstractionService {
    config: ChannelAbstractionConfig,
    channels: HashMap<ChannelId, ChannelConfig>,
    connections: HashMap<ChannelId, ConnectionState>,
}
```

**Channel Types:**
- Discord, Slack, Telegram
- Email (SMTP/IMAP)
- Webhooks
- Custom APIs

**API Endpoints:**
```
GET  /api/v1/channels              → list_channels()
POST /api/v1/channels              → create_channel()
GET  /api/v1/channels/:id/status   → get_status()
POST /api/v1/channels/:id/login    → initiate_login()
```

---

### **5. SessionManagerService** (CHAT Mode)

**Location:** `native_session_manager.rs`

**Purpose:** Chat session management

**State:**
```rust
pub struct SessionManagerService {
    sessions: HashMap<SessionId, Session>,
    message_history: HashMap<SessionId, Vec<Message>>,
}
```

**Features:**
- Create/delete sessions
- Add/retrieve messages
- Session forking
- Context compression

**API Endpoints:**
```
GET    /api/v1/sessions           → list_sessions()
POST   /api/v1/sessions           → create_session()
GET    /api/v1/sessions/:id       → get_session()
DELETE /api/v1/sessions/:id       → delete_session()
POST   /api/v1/sessions/cleanup   → cleanup_inactive()
GET    /api/v1/sessions/:id/messages → get_messages()
POST   /api/v1/sessions/:id/messages → send_message()
```

---

## Router Wiring

How services connect to HTTP routes:

```rust
// main.rs - Router assembly

let app = Router::new()
    // Session routes (native)
    .merge(session_routes::create_session_routes())
    
    // Cron routes (native)
    .merge(create_cron_routes())
    
    // Log routes (native)
    .merge(create_log_routes())
    
    // Config routes (native)
    .merge(create_config_routes())
    
    // Channel routes (native)
    .route("/api/v1/channels", get(list_channels))
    .route("/api/v1/channels/:id/status", get(get_channel_status))
    
    // Rails routes (proxy to Agent Rails service)
    .merge(create_rails_routes());
```

**Route Handler Pattern:**
```rust
async fn list_cron_jobs(
    State(state): State<Arc<AppState>>,  // Access shared state
) -> impl IntoResponse {
    // Get service from state
    let cron_service = match state.cron_service.as_ref() {
        Some(svc) => svc,
        None => return error_response("Service not available"),
    };
    
    // Call service method
    let mut service = cron_service.write().await;
    let request = CronJobManagementRequest {
        operation: CronJobOperation::ListJobs,
        context: None,
    };
    
    match service.execute(request).await {
        Ok(response) => Json(response.result).into_response(),
        Err(e) => error_response(e.to_string()),
    }
}
```

---

## Data Flow Example

**Scenario: User creates a cron job via TUI**

```
1. TUI (OPS mode)
   User types: /cron add "daily-backup" "0 2 * * *" "backup.sh"

2. CLI Client
   POST /api/v1/cron
   Body: { "name": "daily-backup", "schedule": "0 2 * * *", "command": "backup.sh" }

3. API Route Handler (cron_routes.rs)
   Extract: State(AppState), Json(body)
   
   Get service: state.cron_service.write().await
   
   Build request: CronJobManagementRequest {
       operation: UpsertJob { definition: CronJobDefinition { ... } }
   }
   
   Call: service.execute(request).await

4. CronSystemService (native_cron_system.rs)
   Parse cron expression
   Create job definition
   Save to: ./cron-jobs/{uuid}.json
   Schedule with: JobScheduler
   
   Return: CronJobManagementResponse {
       success: true,
       result: json!({ "id": "...", "status": "job_created" })
   }

5. HTTP Response
   Status: 201 Created
   Body: { "id": "...", "status": "job_created" }

6. TUI Display
   ✓ Cron job added: abc-123
```

---

## Concurrency Model

All services use **async/await** with Tokio:

```rust
// Service wrapped in Arc<RwLock<>> for shared mutable access
pub cron_service: Option<Arc<RwLock<CronSystemService>>>

// Read operations (concurrent)
let service = cron_service.read().await;
let jobs = service.list_jobs().await;

// Write operations (exclusive)
let mut service = cron_service.write().await;
service.execute(create_request).await;
```

**Thread Safety:**
- Each service is single-threaded internally
- Tokio runtime handles concurrency across services
- RwLock allows multiple readers or one writer

---

## Error Handling

**Service Level:**
```rust
pub enum CronSystemError {
    IoError(String),
    JobNotFound(String),
    ValidationError(String),
    SchedulerError(String),
}
```

**HTTP Level:**
```rust
match service.execute(request).await {
    Ok(response) => {
        if response.success {
            (StatusCode::OK, Json(response.result))
        } else {
            (StatusCode::BAD_REQUEST, Json(response.error))
        }
    }
    Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(e.to_string())),
}
```

**TUI Level:**
```rust
match self.client.cron_add(name, schedule, cmd).await {
    Ok(job) => self.push_system(format!("✓ Created: {}", job.id)),
    Err(e) => self.push_system(format!("✗ Failed: {}", e)),
}
```

---

## Service Lifecycle

```
Startup:
  1. Load configuration
  2. Initialize each service
  3. Load persisted state (jobs, config, channels)
  4. Start background tasks (scheduler)
  5. Bind HTTP server

Runtime:
  6. Accept HTTP requests
  7. Route to handlers
  8. Call service methods
  9. Persist changes

Shutdown:
  10. Stop accepting requests
  11. Save all state
  12. Stop scheduler
  13. Exit
```

---

## Key Design Principles

1. **Native Rust:** No subprocesses, all services are in-process
2. **Async-first:** tokio for concurrency
3. **Persistence:** JSON files for easy inspection/debugging
4. **Request/Response Pattern:** Uniform interface across services
5. **State Isolation:** Each service manages its own state
6. **HTTP Exposure:** REST API for all operations
