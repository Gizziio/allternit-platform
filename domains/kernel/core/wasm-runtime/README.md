# A2rchitech WASM Runtime

Secure WASM runtime for executing A2rchitech tools with capability-based security and comprehensive IO/network enforcement.

## Features

- **WASI Compliance**: Full support for WASI preview 1 and 2
- **Capability-Based Security**: Tools have zero capabilities by default, must be explicitly granted
- **IO/Network Enforcement**: Strict allowlist-based controls for filesystem, network, and HTTP access
- **Resource Limits**: Memory, CPU, and execution time limits
- **Sandboxing**: Isolated execution environment
- **Component Model**: Support for WASM component model
- **Policy Logging**: Comprehensive audit trail for capability checks
- **API Integration**: Direct connection to A2rchitech control plane services

## Security Model

The runtime implements a strict capability-based security model:

### Capability Types
- `FilesystemRead { paths: Vec<String> }` - Read access to specific paths with glob patterns
- `FilesystemWrite { paths: Vec<String> }` - Write access to specific paths with glob patterns
- `Network { allowed_hosts: Vec<String>, allowed_ports: Vec<u16> }` - Network access to specific hosts/ports
- `Environment { allowed_vars: Vec<String> }` - Access to specific environment variables
- `Clock` - Access to system time
- `Random` - Access to random number generation
- `Stdio` - Access to stdin/stdout/stderr
- `HttpClient { allowed_hosts: Vec<String>, max_requests_per_minute: u32 }` - HTTP client access with rate limiting

### Host Functions with Capability Checks
The runtime provides secure host functions that enforce capability checks:

- `read_file(path: String) -> Result<String, String>` - Reads a file with filesystem:read capability
- `write_file(path: String, content: String) -> Result<(), String>` - Writes a file with filesystem:write capability
- `http_request(method: String, url: String, headers: Vec<(String, String)>, body: Option<String>) -> Result<HttpResponse, String>` - Makes HTTP requests with http-client capability
- `check_network_access(host: String, port: u16) -> bool` - Checks network access with network capability
- `check_capability(capability_type: String) -> bool` - Generic capability check
- `get_env(name: String) -> Option<String>` - Gets environment variable with environment capability
- `now() -> u64` - Gets current timestamp with clock capability
- `random_uuid() -> String` - Generates random UUID with random capability

### Allowlist Validation
All IO and network operations are validated against capability allowlists:
- Filesystem operations are checked against path patterns
- Network operations are checked against host/port allowlists
- HTTP requests are validated against allowed hosts
- Environment variable access is checked against allowed variable names

### Policy Logging
All capability checks are logged to the history ledger for audit purposes:
- Successful and denied capability checks are recorded
- Execution context (capsule ID, tenant ID, execution ID) is included
- Timestamps are recorded for all access attempts

## Usage

```rust
use a2r_wasm_runtime::{WasmRuntime, WasmRuntimeConfig, CapabilityGrant, Capability, ExecutionContext};

// Create a runtime instance
let runtime = WasmRuntime::new(WasmRuntimeConfig::default())?;

// Create a capability grant with specific permissions
let grant = CapabilityGrant::minimal(
    "my-capsule".to_string(),
    "tenant-123".to_string(),
    "system".to_string(),
)
.with_capability(Capability::FilesystemRead {
    paths: vec!["/tmp/*".to_string(), "/data/**".to_string()]
})
.with_capability(Capability::HttpClient {
    allowed_hosts: vec!["api.example.com".to_string()],
    max_requests_per_minute: 10,
});

// Create execution context
let context = ExecutionContext::new("tenant-123".to_string());

// Instantiate and execute a tool
let instance = runtime.instantiate_tool(component, grant, context).await?;
```

## API Integration

The runtime connects to the A2rchitech control plane for:
- Policy evaluation and enforcement
- Capability grant validation
- Audit logging
- Session management

## Testing

Run the tests with:
```bash
cargo test
```

For integration tests:
```bash
cargo test --features integration
```

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   WASM Tool     │◄──►│  WASM Runtime   │◄──►│  Control Plane  │
│                 │    │                  │    │                 │
│  - Host calls   │    │  - Capability    │    │  - Policy       │
│  - Component    │    │    enforcement   │    │    evaluation   │
│    model        │    │  - IO/network   │    │  - Grant        │
│                 │    │    validation    │    │    validation   │
└─────────────────┘    │  - Audit logs    │    │  - Session      │
                       └──────────────────┘    │    management   │
                                               └─────────────────┘
```

## Security Considerations

- Tools run with zero privileges by default
- All IO operations require explicit capability grants
- Network access is restricted to allowlisted hosts/ports
- Filesystem access is limited to allowlisted paths
- HTTP requests are validated against allowed hosts
- All capability checks are audited