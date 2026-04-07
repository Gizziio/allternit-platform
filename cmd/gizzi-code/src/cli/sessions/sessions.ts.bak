/**
 * CLI Sessions Module
 *
 * Provides session management for command execution with support for
 * VM-based execution through A2R Desktop daemon and local fallback.
 *
 * @packageDocumentation
 */

// Core session implementations
export { VMSession, type Session, type Command, type Result, type VMSessionConfig } from "./vm"

// Session factory
export {
  createSession,
  createVMSession,
  createLocalSession,
  isVMAvailable,
  type SessionConfig,
  type SessionType,
} from "./factory"

// Error classes
export {
  DaemonNotRunningError,
  VMNotReadyError,
  ConnectionTimeoutError,
  SocketError,
  ProtocolError,
  VMExecutionError,
  DaemonError,
} from "./errors"
