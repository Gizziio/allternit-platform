/**
 * VM Session Error Classes
 *
 * Provides specific error types for VM session operations to enable
 * better error handling and user feedback.
 *
 * @module @/cli/sessions/errors
 */

import { NamedError } from "@a2r/util/error"

/**
 * Error thrown when the A2R Desktop daemon is not running
 *
 * This error indicates that the CLI cannot connect to the desktop
 * application via Unix socket, suggesting the desktop app needs
 * to be started.
 */
export class DaemonNotRunningError extends Error {
  constructor() {
    super(
      "A2R Desktop is not running.\n" +
        "Please start it with: a2r desktop\n" +
        "Or run with --local for limited local execution."
    )
    this.name = "DaemonNotRunningError"
  }
}

/**
 * Error thrown when the VM is not ready to accept commands
 *
 * This can happen when the VM is still starting up or has been stopped.
 * The user should wait for the VM to be fully started before retrying.
 */
export class VMNotReadyError extends Error {
  constructor() {
    super("VM is starting, please wait...")
    this.name = "VMNotReadyError"
  }
}

/**
 * Error thrown when connection to desktop times out
 */
export class ConnectionTimeoutError extends Error {
  /**
   * @param timeout - Timeout duration in milliseconds
   */
  constructor(timeout: number) {
    super(`Connection to desktop timed out after ${timeout}ms`)
    this.name = "ConnectionTimeoutError"
  }
}

/**
 * Error thrown when a socket operation fails
 */
export class SocketError extends Error {
  /**
   * @param message - Error message
   * @param cause - Original error that caused this error
   */
  constructor(
    message: string,
    public override readonly cause?: Error
  ) {
    super(message)
    this.name = "SocketError"
  }
}

/**
 * Error thrown when protocol communication fails
 */
export class ProtocolError extends Error {
  /**
   * @param message - Error message
   * @param code - Protocol error code
   */
  constructor(
    message: string,
    public readonly code?: string
  ) {
    super(message)
    this.name = "ProtocolError"
  }
}

/**
 * Error thrown when VM execution fails
 */
export class VMExecutionError extends Error {
  /**
   * @param message - Error message
   * @param exitCode - Exit code from VM execution
   */
  constructor(
    message: string,
    public readonly exitCode?: number
  ) {
    super(message)
    this.name = "VMExecutionError"
  }
}

/**
 * Error thrown when daemon returns an error response
 */
export class DaemonError extends Error {
  /**
   * @param code - Error code from daemon
   * @param message - Error message from daemon
   */
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message)
    this.name = "DaemonError"
  }
}
