/**
 * VM Transport Layer - Unified Host↔VM Communication
 * 
 * This module provides a unified transport interface for communication between
 * host and virtual machines, supporting both Linux VSOCK and macOS VZVirtioSocket.
 * 
 * ## Platforms
 * 
 * - **Linux**: Uses AF_VSOCK sockets for efficient VM communication
 * - **macOS**: Uses VZVirtioSocket from Virtualization.framework
 * 
 * ## Usage
 * 
 * ```typescript
 * import { createTransport, ConnectionManager } from "./transport";
 * 
 * // Create platform-specific transport
 * const transport = createTransport();
 * 
 * // Use connection manager for pooling and reconnection
 * const manager = new ConnectionManager(transport, true);
 * 
 * // Connect to a VM
 * const conn = await manager.connect("vm-001", 8080);
 * await conn.write(Buffer.from("Hello VM"));
 * const response = await conn.read();
 * ```
 * 
 * @module index
 */

// Core interfaces and types
export {
  // Interfaces
  VMTransport,
  VMConnection,
  VMTransportOptions,
  VSockAddress,

  // Error handling
  VMTransportError,
  VMTransportErrorCode,

  // Utilities
  MessageFramer,
  BaseVMConnection,
  generateConnectionId,

  // Type aliases
  Platform,
} from "./transport";

// VSOCK transport (Linux)
export {
  VSockTransport,
  VSockConnection,
  isVSockSupported,
  getVSockPortRange,
  VSOCK_CID,
  VSOCK_TYPE,
} from "./vsock";

// VirtioSocket transport (macOS)
export {
  VirtioSocketTransport,
  VirtioSocketConnection,
  isVirtioSocketSupported,
  getVirtioSocketInfo,
} from "./virtio";

// Connection management
export {
  ConnectionManager,
  ConnectionPool,
  ManagedConnection,
  DEFAULT_POOL_CONFIG,
  DEFAULT_RECONNECT_CONFIG,
  type ConnectionPoolConfig,
  type ReconnectConfig,
} from "./connection";

import * as os from "os";
import {
  VMTransport,
  VMTransportOptions,
  VMTransportError,
  VMTransportErrorCode,
  Platform,
} from "./transport";
import { VSockTransport, isVSockSupported } from "./vsock";
import { VirtioSocketTransport, isVirtioSocketSupported } from "./virtio";

/**
 * Detect the current platform
 * @returns The detected platform
 */
export function detectPlatform(): Platform {
  const platform = os.platform();

  switch (platform) {
    case "linux":
      return "linux";
    case "darwin":
      return "darwin";
    case "win32":
      return "win32";
    default:
      throw new VMTransportError(
        `Unsupported platform: ${platform}`,
        VMTransportErrorCode.PLATFORM_UNSUPPORTED
      );
  }
}

/**
 * Check if the current platform supports VM transport
 * @returns True if VM transport is supported
 */
export function isPlatformSupported(): boolean {
  const platform = detectPlatform();

  switch (platform) {
    case "linux":
      return isVSockSupported();
    case "darwin":
      return isVirtioSocketSupported();
    default:
      return false;
  }
}

/**
 * Get transport capabilities for the current platform
 * @returns Object describing available transport capabilities
 */
export function getTransportCapabilities(): {
  platform: Platform;
  supported: boolean;
  transport: "vsock" | "virtio" | null;
  nativeSupport: boolean;
  features: {
    connectionPooling: boolean;
    reconnection: boolean;
    keepalive: boolean;
    messageFraming: boolean;
  };
} {
  const platform = detectPlatform();
  let supported = false;
  let transport: "vsock" | "virtio" | null = null;
  let nativeSupport = false;

  switch (platform) {
    case "linux":
      supported = true;
      transport = "vsock";
      nativeSupport = isVSockSupported();
      break;
    case "darwin":
      supported = true;
      transport = "virtio";
      nativeSupport = isVirtioSocketSupported();
      break;
  }

  return {
    platform,
    supported,
    transport,
    nativeSupport,
    features: {
      connectionPooling: true,
      reconnection: true,
      keepalive: true,
      messageFraming: true,
    },
  };
}

/**
 * Create a platform-specific transport instance
 * 
 * @param platform - Target platform (auto-detected if not specified)
 * @param options - Transport configuration options
 * @returns Platform-specific transport implementation
 * @throws {VMTransportError} If platform is unsupported
 * 
 * @example
 * ```typescript
 * // Auto-detect platform
 * const transport = createTransport();
 * 
 * // Explicit platform
 * const transport = createTransport("linux");
 * 
 * // With options
 * const transport = createTransport("darwin", {
 *   keepalive: true,
 *   keepaliveInterval: 30000,
 *   framed: true
 * });
 * ```
 */
export function createTransport(
  platform?: Platform,
  options?: VMTransportOptions
): VMTransport {
  const targetPlatform = platform || detectPlatform();

  switch (targetPlatform) {
    case "linux":
      return new VSockTransport(options);

    case "darwin":
      return new VirtioSocketTransport(options);

    case "win32":
      throw new VMTransportError(
        "Windows not yet supported. Use WSL2 with Linux transport.",
        VMTransportErrorCode.PLATFORM_UNSUPPORTED
      );

    default:
      throw new VMTransportError(
        `Unsupported platform: ${targetPlatform}`,
        VMTransportErrorCode.PLATFORM_UNSUPPORTED
      );
  }
}

/**
 * Create transport with automatic platform detection and feature negotiation
 * 
 * @param options - Transport configuration options
 * @returns Transport instance with full feature support
 * @throws {VMTransportError} If platform is unsupported
 */
export function createAutoTransport(options?: VMTransportOptions): VMTransport {
  const capabilities = getTransportCapabilities();

  if (!capabilities.supported) {
    throw new VMTransportError(
      `Platform ${capabilities.platform} does not support VM transport`,
      VMTransportErrorCode.PLATFORM_UNSUPPORTED
    );
  }

  const transport = createTransport(capabilities.platform, options);

  // Log capability information
  console.log(`[transport] Created ${capabilities.transport} transport for ${capabilities.platform}`);
  console.log(`[transport] Native support: ${capabilities.nativeSupport}`);

  return transport;
}

/**
 * Version information
 */
export const VERSION = {
  major: 1,
  minor: 0,
  patch: 0,
  toString(): string {
    return `${this.major}.${this.minor}.${this.patch}`;
  },
};

/**
 * Default export
 */
export default {
  createTransport,
  createAutoTransport,
  detectPlatform,
  isPlatformSupported,
  getTransportCapabilities,
  VERSION,
};
