/**
 * Terminal Injector Types
 */

/**
 * Injection result
 */
export interface InjectionResult {
  /** Success status */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Command that was injected */
  command: string;
  /** Session ID */
  sessionId: string;
  /** Timestamp */
  timestamp: string;
}

/**
 * Terminal session info
 */
export interface TerminalSession {
  /** Session ID */
  id: string;
  /** Session name */
  name: string;
  /** Platform */
  platform: 'darwin' | 'linux' | 'win32';
  /** Active status */
  active: boolean;
  /** Last activity timestamp */
  lastActivity?: string;
  /** Process ID */
  pid?: number;
}

/**
 * Injector configuration
 */
export interface InjectorConfig {
  /** Platform override (auto-detected if not specified) */
  platform?: 'darwin' | 'linux' | 'win32';
  /** tmux socket name (Unix only) */
  tmuxSocket?: string;
  /** Default timeout in ms */
  timeout: number;
  /** Retry attempts */
  maxRetries: number;
  /** Retry delay in ms */
  retryDelay: number;
}

/**
 * Injector interface (platform-agnostic)
 */
export interface TerminalInjector {
  /**
   * Inject keystrokes into a terminal session
   */
  inject(sessionId: string, command: string): Promise<InjectionResult>;
  
  /**
   * Check if session exists
   */
  sessionExists(sessionId: string): Promise<boolean>;
  
  /**
   * List active sessions
   */
  listSessions(): Promise<TerminalSession[]>;
  
  /**
   * Create a new session
   */
  createSession(name: string, command?: string): Promise<TerminalSession>;
  
  /**
   * Kill a session
   */
  killSession(sessionId: string): Promise<void>;
  
  /**
   * Capture session output
   */
  captureOutput(sessionId: string, lines?: number): Promise<string>;
}

/**
 * Platform-specific injector implementations
 */
export type PlatformInjector = 'tmux' | 'win32';

/**
 * Get platform injector type
 */
export function getPlatformInjector(platform: NodeJS.Platform): PlatformInjector {
  if (platform === 'win32') {
    return 'win32';
  }
  return 'tmux';
}
