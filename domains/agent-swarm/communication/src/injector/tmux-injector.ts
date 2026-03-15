/**
 * tmux Terminal Injector
 * 
 * Injects keystrokes into tmux sessions on macOS/Linux.
 * Reverse engineered from agentchattr pattern, implemented for a2rchitech.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import type {
  TerminalInjector,
  TerminalSession,
  InjectionResult,
  InjectorConfig,
} from './injector-types.js';

const execAsync = promisify(exec);

/**
 * tmux-based terminal injector
 */
export class TmuxInjector implements TerminalInjector {
  private config: InjectorConfig;
  private tmuxSocket?: string;

  constructor(config: InjectorConfig = { timeout: 5000, maxRetries: 3, retryDelay: 100 }) {
    this.config = config;
    this.tmuxSocket = config.tmuxSocket;
  }

  /**
   * Inject keystrokes into a tmux session
   */
  async inject(sessionId: string, command: string): Promise<InjectionResult> {
    const timestamp = new Date().toISOString();
    
    try {
      // Check if session exists
      const exists = await this.sessionExists(sessionId);
      if (!exists) {
        return {
          success: false,
          error: `Session not found: ${sessionId}`,
          command,
          sessionId,
          timestamp,
        };
      }

      // Build tmux send-keys command
      // -t targets the session
      // Enter at the end simulates pressing Enter
      const tmuxCommand = this.buildTmuxCommand(sessionId, command);

      // Execute with timeout
      await this.executeWithRetry(tmuxCommand);

      return {
        success: true,
        command,
        sessionId,
        timestamp,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        command,
        sessionId,
        timestamp,
      };
    }
  }

  /**
   * Build tmux send-keys command
   */
  private buildTmuxCommand(sessionId: string, command: string): string {
    const socketArg = this.tmuxSocket ? `-L ${this.tmuxSocket}` : '';
    
    // Escape special characters in command
    const escapedCommand = this.escapeShellCommand(command);
    
    return `tmux ${socketArg} send-keys -t ${sessionId} ${escapedCommand} Enter`;
  }

  /**
   * Escape shell command
   */
  private escapeShellCommand(command: string): string {
    // Simple escaping - in production use proper shell escaping
    return command
      .replace(/'/g, "'\\''")
      .replace(/"/g, '\\"')
      .replace(/\$/g, '\\$')
      .replace(/`/g, '\\`');
  }

  /**
   * Execute command with retry
   */
  private async executeWithRetry(command: string): Promise<void> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        await execAsync(command, {
          timeout: this.config.timeout,
        });
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        if (attempt < this.config.maxRetries - 1) {
          // Wait before retry
          await this.sleep(this.config.retryDelay);
        }
      }
    }

    throw lastError || new Error('Command failed after retries');
  }

  /**
   * Check if tmux session exists
   */
  async sessionExists(sessionId: string): Promise<boolean> {
    try {
      const socketArg = this.tmuxSocket ? `-L ${this.tmuxSocket}` : '';
      await execAsync(`tmux ${socketArg} has-session -t ${sessionId} 2>/dev/null`);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * List active tmux sessions
   */
  async listSessions(): Promise<TerminalSession[]> {
    try {
      const socketArg = this.tmuxSocket ? `-L ${this.tmuxSocket}` : '';
      const { stdout } = await execAsync(
        `tmux ${socketArg} list-sessions -F "#{session_name} #{session_created}"`
      );

      const lines = stdout.trim().split('\n').filter(Boolean);
      
      return lines.map(line => {
        const [name, created] = line.split(' ');
        return {
          id: name,
          name,
          platform: process.platform as 'darwin' | 'linux',
          active: true,
          lastActivity: created ? new Date(parseInt(created) * 1000).toISOString() : undefined,
        };
      });
    } catch {
      return [];
    }
  }

  /**
   * Create a new tmux session
   */
  async createSession(name: string, command?: string): Promise<TerminalSession> {
    try {
      const socketArg = this.tmuxSocket ? `-L ${this.tmuxSocket}` : '';
      
      if (command) {
        // Create session with command
        await execAsync(
          `tmux ${socketArg} new-session -d -s ${name} "${command}"`
        );
      } else {
        // Create empty session
        await execAsync(`tmux ${socketArg} new-session -d -s ${name}`);
      }

      return {
        id: name,
        name,
        platform: process.platform as 'darwin' | 'linux',
        active: true,
        lastActivity: new Date().toISOString(),
      };
    } catch (error) {
      throw new Error(
        `Failed to create session: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Kill a tmux session
   */
  async killSession(sessionId: string): Promise<void> {
    try {
      const socketArg = this.tmuxSocket ? `-L ${this.tmuxSocket}` : '';
      await execAsync(`tmux ${socketArg} kill-session -t ${sessionId}`);
    } catch (error) {
      throw new Error(
        `Failed to kill session: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Capture session output (pane content)
   */
  async captureOutput(sessionId: string, lines: number = 100): Promise<string> {
    try {
      const socketArg = this.tmuxSocket ? `-L ${this.tmuxSocket}` : '';
      const { stdout } = await execAsync(
        `tmux ${socketArg} capture-pane -pt ${sessionId} -S -${lines}`
      );
      return stdout;
    } catch (error) {
      throw new Error(
        `Failed to capture output: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Create tmux injector
 */
export function createTmuxInjector(config?: Partial<InjectorConfig>): TmuxInjector {
  return new TmuxInjector({
    timeout: 5000,
    maxRetries: 3,
    retryDelay: 100,
    ...config,
  });
}
