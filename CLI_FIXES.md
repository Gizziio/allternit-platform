# CLI API Fixes - Complete

## Summary

All API import mismatches and type errors in the CLI have been fixed. The CLI now compiles successfully with the new driver interface and session manager.

## Changes Made

### 1. Driver Interface (`a2r-driver-interface`)
Added compatibility types for CLI:
- `TargetArch` - Enum for AMD64/ARM64 architectures
- `ResourceLimitsCompat` - Resource limit specification
- `RootfsSpecCompat` - Root filesystem specification
- `ResourceUsageCompat` - Resource usage metrics
- `HealthStatusCompat` - Health status structure
- `StreamType`/`OutputChunk` - Streaming output types
- `ExecutionStream` trait - For streaming command output
- `StreamingExecutionDriver` trait - Extended driver with streaming
- `DriverCapabilitiesCompat` - Extended driver capabilities

### 2. CLI Session Files

#### `src/sessions/macos.rs`
- Fixed `AppleVfDriver` → `AppleVFDriver` naming
- Updated to use new `Session`/`SessionSpec` types
- Simplified implementation for new API

#### `src/sessions/linux.rs`
- Removed custom `ProcessDriver` implementation
- Simplified to use new session manager API
- Removed streaming execution code (now in driver interface)

#### `src/sessions/local.rs`
- Updated to use new `Session`/`SessionSpec` types
- Fixed `ExecResult` handling (Option<Vec<u8>>)

#### `src/sessions/remote.rs`
- Simplified for new API compatibility
- Removed Firecracker-specific code

### 3. CLI Command Files

#### `src/commands/run.rs`
- Fixed `ExecResult.stdout/stderr` handling (now `Option<Vec<u8>>`)
- Use `String::from_utf8_lossy()` for output conversion

#### `src/commands/repl.rs`
- Removed `toolchains` field usage (not in new SessionSpec)
- Fixed `ExecResult` stdout/stderr handling
- Updated session info display (use `session.spec.working_dir`)

#### `src/commands/sessions.rs`
- Fixed `start_time` → `created_at` field name

### 4. Cowork Module

#### `src/cowork/attach.rs`
- Fixed `args.cursor` move issue by adding `.clone()`

### 5. Driver Selection

#### `src/driver_selection.rs`
- Fixed `AppleVfDriver` → `AppleVFDriver` naming
- Removed FirecrackerConfig creation (API changed)
- Simplified to use `SessionManager::new()`

### 6. Error Types

#### `src/error.rs`
- Added `NotImplemented` error variant

### 7. Main

#### `src/main.rs`
- Added error conversion for `cowork::execute()`

## Build Status

```bash
# All workspace packages compile successfully
cargo check --workspace
```

## Type Mapping Summary

| Old Type | New Type | Location |
|----------|----------|----------|
| `AppleVfDriver` | `AppleVFDriver` | `a2r-apple-vf-driver` |
| `Session.working_dir` | `Session.spec.working_dir` | `a2r-session-manager` |
| `Session.start_time` | `Session.created_at` | `a2r-session-manager` |
| `ExecResult.stdout: String` | `ExecResult.stdout: Option<Vec<u8>>` | `a2r-driver-interface` |
| `ExecResult.stderr: String` | `ExecResult.stderr: Option<Vec<u8>>` | `a2r-driver-interface` |
| `SessionSpec.toolchains` | Removed | N/A |

## Next Steps

The CLI is now syntactically correct and compiles. Functional testing would be needed to verify runtime behavior, especially for:
- VM lifecycle management (macOS Apple VF, Linux Firecracker)
- Session creation and command execution
- Cowork run attachment and streaming
