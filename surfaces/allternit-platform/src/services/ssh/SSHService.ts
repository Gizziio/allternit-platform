/**
 * SSH Service - Server-side SSH Connection Management
 * 
 * This service is used by API routes to manage SSH connections.
 * It provides methods for connecting, executing commands, and managing sessions.
 */

import type { NodeSSH } from 'node-ssh';
import { gatherSSHSystemInfo } from '@/lib/ssh-system-info';

export interface SSHConnectionConfig {
  host: string;
  port: number;
  username: string;
  privateKey?: string;
  password?: string;
}

export interface SSHSession {
  id: string;
  ssh: NodeSSH;
  config: SSHConnectionConfig;
  connectedAt: Date;
  lastActivity: Date;
}

class SSHService {
  private sessions: Map<string, SSHSession> = new Map();
  private NodeSSHClass: typeof NodeSSH | null = null;

  /**
   * Lazy load NodeSSH to avoid bundling issues
   */
  private async getNodeSSH(): Promise<typeof NodeSSH> {
    if (!this.NodeSSHClass) {
      const { NodeSSH } = await import('node-ssh');
      this.NodeSSHClass = NodeSSH;
    }
    return this.NodeSSHClass;
  }

  /**
   * Create a new SSH connection
   */
  async connect(sessionId: string, config: SSHConnectionConfig): Promise<void> {
    const NodeSSHClass = await this.getNodeSSH();
    const ssh = new NodeSSHClass();

    const connectConfig: any = {
      host: config.host,
      port: config.port || 22,
      username: config.username,
      readyTimeout: 20000,
    };

    if (config.privateKey) {
      connectConfig.privateKey = config.privateKey;
    } else if (config.password) {
      connectConfig.password = config.password;
    } else {
      throw new Error('Either privateKey or password must be provided');
    }

    await ssh.connect(connectConfig);

    const session: SSHSession = {
      id: sessionId,
      ssh,
      config,
      connectedAt: new Date(),
      lastActivity: new Date(),
    };

    this.sessions.set(sessionId, session);
  }

  /**
   * Disconnect an SSH session
   */
  disconnect(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.ssh.dispose();
      this.sessions.delete(sessionId);
    }
  }

  /**
   * Execute a command on an SSH session
   */
  async executeCommand(
    sessionId: string,
    command: string
  ): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('SSH session not found');
    }

    session.lastActivity = new Date();
    const result = await session.ssh.execCommand(command);

    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.code,
    };
  }

  /**
   * Get system information from the remote server
   */
  async getSystemInfo(sessionId: string): Promise<{
    os: string;
    architecture: string;
    dockerInstalled: boolean;
    allternitInstalled: boolean;
    allternitVersion?: string;
  }> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('SSH session not found');
    }

    const systemInfo = await gatherSSHSystemInfo(session.ssh);

    session.lastActivity = new Date();

    return {
      os: systemInfo.os,
      architecture: systemInfo.architecture,
      dockerInstalled: systemInfo.dockerInstalled,
      allternitInstalled: systemInfo.allternitInstalled,
      allternitVersion: systemInfo.allternitVersion,
    };
  }

  /**
   * Check if a session exists
   */
  hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  /**
   * Get all active session IDs
   */
  getActiveSessions(): string[] {
    return Array.from(this.sessions.keys());
  }

  /**
   * Clean up stale sessions
   */
  cleanupStaleSessions(maxAgeMs: number = 30 * 60 * 1000): void {
    const now = Date.now();
    for (const [id, session] of this.sessions) {
      if (now - session.lastActivity.getTime() > maxAgeMs) {
        this.disconnect(id);
      }
    }
  }
}

// Export singleton instance
export const sshService = new SSHService();
export default SSHService;
