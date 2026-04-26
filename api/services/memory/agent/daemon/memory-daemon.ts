/**
 * Memory Daemon - 24/7 Background Service
 * 
 * Manages the memory agent as a persistent background process
 * Supports start, stop, status, and restart commands
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { spawn } from 'child_process';

/**
 * Daemon commands
 */
type DaemonCommand = 'start' | 'stop' | 'status' | 'restart' | 'logs';

/**
 * Daemon configuration
 */
interface DaemonConfig {
  pidFile: string;
  logFile: string;
  dataDir: string;
  memoryAgentDir: string;
}

/**
 * Default daemon configuration
 */
const DEFAULT_DAEMON_CONFIG: DaemonConfig = {
  pidFile: '/tmp/allternit-memory-agent.pid',
  logFile: '/tmp/allternit-memory-agent.log',
  dataDir: path.join(process.env.HOME || '~', '.allternit', 'memory'),
  memoryAgentDir: path.dirname(path.dirname(new URL(import.meta.url).pathname)),
};

/**
 * Memory Daemon class
 */
export class MemoryDaemon {
  private config: DaemonConfig;

  constructor(config?: Partial<DaemonConfig>) {
    this.config = {
      ...DEFAULT_DAEMON_CONFIG,
      ...config,
    };
  }

  /**
   * Run daemon command
   */
  async run(command: DaemonCommand): Promise<void> {
    switch (command) {
      case 'start':
        await this.start();
        break;
      case 'stop':
        await this.stop();
        break;
      case 'status':
        await this.status();
        break;
      case 'restart':
        await this.restart();
        break;
      case 'logs':
        await this.showLogs();
        break;
      default:
        console.log(`Unknown command: ${command}`);
        this.printUsage();
    }
  }

  /**
   * Start the daemon (background process)
   */
  async start(): Promise<void> {
    // Check if already running
    const runningPid = await this.getRunningPid();
    if (runningPid) {
      console.log(`Memory Agent is already running (PID: ${runningPid})`);
      return;
    }

    console.log('Starting Memory Agent daemon...');

    // Ensure data directory exists
    await fs.mkdir(this.config.dataDir, { recursive: true });

    // Start as background process
    const scriptPath = path.join(this.config.memoryAgentDir, 'src', 'orchestrator.ts');
    const logStream = await fs.open(this.config.logFile, 'a');
    
    const child = spawn('tsx', [scriptPath], {
      detached: true,
      stdio: ['ignore', logStream.fd, logStream.fd],
      env: { ...process.env },
    });

    logStream.close();

    // Write PID file
    await fs.writeFile(this.config.pidFile, child.pid!.toString());

    console.log(`Memory Agent started (PID: ${child.pid})`);
    console.log(`Logs: ${this.config.logFile}`);
    console.log(`PID file: ${this.config.pidFile}`);
    
    // Detach from parent
    child.unref();
  }

  /**
   * Stop the daemon
   */
  async stop(): Promise<void> {
    const runningPid = await this.getRunningPid();
    
    if (!runningPid) {
      console.log('Memory Agent is not running');
      return;
    }

    console.log(`Stopping Memory Agent (PID: ${runningPid})...`);

    try {
      // Send SIGTERM
      process.kill(runningPid, 'SIGTERM');
      
      // Wait for process to stop
      await this.waitForStop(runningPid, 5000);
      
      // Clean up PID file
      try {
        await fs.unlink(this.config.pidFile);
      } catch {
        // Ignore if file doesn't exist
      }
      
      console.log('Memory Agent stopped');
    } catch (error) {
      console.error('Error stopping Memory Agent:', error);
      
      // Force kill
      try {
        process.kill(runningPid, 'SIGKILL');
        await fs.unlink(this.config.pidFile);
        console.log('Memory Agent force killed');
      } catch (killError) {
        console.error('Failed to force kill:', killError);
      }
    }
  }

  /**
   * Get daemon status
   */
  async status(): Promise<void> {
    const runningPid = await this.getRunningPid();
    
    if (!runningPid) {
      console.log('Memory Agent: Not running');
      return;
    }

    // Check if process is actually running
    const isRunning = this.isProcessRunning(runningPid);
    
    if (isRunning) {
      console.log(`Memory Agent: Running (PID: ${runningPid})`);
      
      // Show recent stats if possible
      try {
        const logContent = await fs.readFile(this.config.logFile, 'utf-8');
        const lines = logContent.split('\n').filter(l => l.includes('MemoryOrchestrator'));
        const recentLines = lines.slice(-5);
        
        if (recentLines.length > 0) {
          console.log('Recent activity:');
          recentLines.forEach(line => console.log(`  ${line}`));
        }
      } catch {
        // Ignore log read errors
      }
    } else {
      console.log('Memory Agent: Stale PID file (process not running)');
      // Clean up stale PID file
      try {
        await fs.unlink(this.config.pidFile);
      } catch {
        // Ignore
      }
    }
  }

  /**
   * Restart the daemon
   */
  async restart(): Promise<void> {
    console.log('Restarting Memory Agent...');
    await this.stop();
    await new Promise(resolve => setTimeout(resolve, 1000));
    await this.start();
  }

  /**
   * Show logs
   */
  async showLogs(): Promise<void> {
    try {
      const logContent = await fs.readFile(this.config.logFile, 'utf-8');
      console.log(logContent);
    } catch (error) {
      console.log('No logs found');
    }
  }

  /**
   * Get running PID from PID file
   */
  private async getRunningPid(): Promise<number | null> {
    try {
      const pidContent = await fs.readFile(this.config.pidFile, 'utf-8');
      const pid = parseInt(pidContent.trim(), 10);
      
      if (isNaN(pid)) {
        return null;
      }
      
      return pid;
    } catch {
      return null;
    }
  }

  /**
   * Check if process is running
   */
  private isProcessRunning(pid: number): boolean {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Wait for process to stop
   */
  private async waitForStop(pid: number, timeoutMs: number): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      if (!this.isProcessRunning(pid)) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    throw new Error('Timeout waiting for process to stop');
  }

  /**
   * Print usage information
   */
  private printUsage(): void {
    console.log(`
Memory Agent Daemon

Usage:
  pnpm daemon <command>

Commands:
  start    - Start the memory agent as a background daemon
  stop     - Stop the running memory agent
  status   - Check if the memory agent is running
  restart  - Restart the memory agent
  logs     - Show daemon logs

Examples:
  pnpm daemon start
  pnpm daemon status
  pnpm daemon stop
`);
  }
}

/**
 * Run daemon from CLI
 */
async function runDaemonCli(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0] as DaemonCommand | undefined;

  if (!command) {
    console.log('Memory Agent Daemon');
    console.log('');
    console.log('Usage: pnpm daemon <command>');
    console.log('');
    console.log('Commands: start, stop, status, restart, logs');
    process.exit(1);
  }

  const daemon = new MemoryDaemon();
  
  try {
    await daemon.run(command);
  } catch (error) {
    console.error('Daemon error:', error);
    process.exit(1);
  }
}

// Run CLI if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runDaemonCli();
}

export default MemoryDaemon;
