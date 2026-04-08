/**
 * Allternit Backend Manager
 * 
 * Manages the lifecycle of Allternit Backend instances:
 * - Extracts bundled backend on first run
 * - Starts/stops local backend
 * - Checks version compatibility
 * - Handles updates
 */

import { app } from 'electron';
import { spawn, exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import log from 'electron-log';
import { 
  PLATFORM_MANIFEST, 
  getBackendDownloadUrl, 
  isBackendCompatible,
  shouldUpdateBackend 
} from './manifest';

const execAsync = promisify(exec);

interface BackendStatus {
  installed: boolean;
  version?: string;
  running: boolean;
  pid?: number;
  url: string;
}

interface BackendProcess {
  process: ReturnType<typeof spawn>;
  startTime: Date;
}

export class BackendManager {
  private static instance: BackendManager;
  private currentProcess: BackendProcess | null = null;
  
  // Paths
  private readonly userDataPath: string;
  private readonly backendDir: string;
  private readonly dataDir: string;
  private readonly logDir: string;
  private readonly configPath: string;
  
  private constructor() {
    this.userDataPath = app.getPath('userData');
    this.backendDir = path.join(this.userDataPath, 'backend');
    this.dataDir = path.join(this.userDataPath, 'data');
    this.logDir = path.join(this.userDataPath, 'logs');
    this.configPath = path.join(this.userDataPath, 'config', 'backend.yaml');
  }
  
  static getInstance(): BackendManager {
    if (!BackendManager.instance) {
      BackendManager.instance = new BackendManager();
    }
    return BackendManager.instance;
  }
  
  /** Get paths */
  getPaths() {
    return {
      backendDir: this.backendDir,
      dataDir: this.dataDir,
      logDir: this.logDir,
      configPath: this.configPath,
      binaryPath: path.join(this.backendDir, 'bin', this.getBinaryName('allternit-api')),
    };
  }
  
  /**
   * Ensure backend is ready (extract if needed, start if not running)
   * Called on app launch
   */
  async ensureBackend(): Promise<string> {
    log.info('[BackendManager] Ensuring backend is ready...');
    
    const status = await this.getStatus();
    
    // If already running, just return URL
    if (status.running) {
      log.info('[BackendManager] Backend already running at', status.url);
      return status.url;
    }
    
    // Check if installed
    if (!status.installed) {
      log.info('[BackendManager] Backend not installed, extracting...');
      await this.extractBundledBackend();
      await this.createDefaultConfig();
    }
    
    // Check version
    const installedVersion = await this.getInstalledVersion();
    if (installedVersion && shouldUpdateBackend(installedVersion)) {
      log.info(`[BackendManager] Backend version mismatch: ${installedVersion} vs ${PLATFORM_MANIFEST.backend.version}`);
      await this.updateBackend();
    }
    
    // Start backend
    log.info('[BackendManager] Starting backend...');
    await this.startBackend();
    
    // Wait for it to be ready
    await this.waitForReady();
    
    return 'http://localhost:4096';
  }
  
  /**
   * Check backend status
   */
  async getStatus(): Promise<BackendStatus> {
    const binaryPath = path.join(this.backendDir, 'bin', this.getBinaryName('allternit-api'));
    const installed = fs.existsSync(binaryPath);
    
    let running = false;
    let version: string | undefined;
    
    if (installed) {
      // Check if running by hitting health endpoint
      try {
        const response = await fetch('http://localhost:4096/health', {
          signal: AbortSignal.timeout(1000)
        });
        running = response.ok;
        
        if (running) {
          // Get version from API
          const versionResponse = await fetch('http://localhost:4096/version', {
            signal: AbortSignal.timeout(1000)
          });
          if (versionResponse.ok) {
            const data = await versionResponse.json();
            version = data.version;
          }
        }
      } catch {
        running = false;
      }
    }
    
    return {
      installed,
      version,
      running,
      url: 'http://localhost:4096',
    };
  }
  
  /**
   * Extract bundled backend from app resources
   */
  private async extractBundledBackend(): Promise<void> {
    const bundledPath = this.getBundledBackendPath();
    
    if (!bundledPath) {
      throw new Error('Bundled backend not found in app resources');
    }
    
    log.info('[BackendManager] Extracting from:', bundledPath);
    
    // Create directories
    fs.mkdirSync(this.backendDir, { recursive: true });
    fs.mkdirSync(this.dataDir, { recursive: true });
    fs.mkdirSync(this.logDir, { recursive: true });
    fs.mkdirSync(path.dirname(this.configPath), { recursive: true });
    
    // Copy binaries from bundled location
    if (fs.statSync(bundledPath).isDirectory()) {
      // Copy entire directory
      this.copyDirectory(bundledPath, this.backendDir);
    } else {
      // Extract archive (if bundled as tar.gz)
      await this.extractArchive(bundledPath, this.backendDir);
    }
    
    // Make binaries executable on Unix
    if (process.platform !== 'win32') {
      const binDir = path.join(this.backendDir, 'bin');
      const binaries = fs.readdirSync(binDir);
      for (const binary of binaries) {
        fs.chmodSync(path.join(binDir, binary), 0o755);
      }
    }
    
    log.info('[BackendManager] Backend extracted to:', this.backendDir);
  }
  
  /**
   * Start the backend process
   */
  private async startBackend(): Promise<void> {
    const binaryPath = path.join(this.backendDir, 'bin', this.getBinaryName('allternit-api'));
    
    if (!fs.existsSync(binaryPath)) {
      throw new Error(`Backend binary not found at ${binaryPath}`);
    }
    
    log.info('[BackendManager] Starting:', binaryPath);
    
    const proc = spawn(binaryPath, [], {
      env: {
        ...process.env,
        ALLTERNIT_CONFIG: this.configPath,
        RUST_LOG: 'info',
        ALLTERNIT_DATA_DIR: this.dataDir,
        ALLTERNIT_LOG_DIR: this.logDir,
      },
      detached: false,
      windowsHide: true,
    });
    
    // Log output
    proc.stdout?.on('data', (data) => {
      log.info('[Backend]', data.toString().trim());
    });
    
    proc.stderr?.on('data', (data) => {
      log.error('[Backend Error]', data.toString().trim());
    });
    
    proc.on('exit', (code) => {
      log.info(`[BackendManager] Backend exited with code ${code}`);
      this.currentProcess = null;
    });
    
    this.currentProcess = {
      process: proc,
      startTime: new Date(),
    };
  }
  
  /**
   * Stop the backend process
   */
  async stopBackend(): Promise<void> {
    if (this.currentProcess) {
      log.info('[BackendManager] Stopping backend...');
      this.currentProcess.process.kill();
      this.currentProcess = null;
    }
  }
  
  /**
   * Wait for backend to be ready
   */
  private async waitForReady(timeoutMs: number = 30000): Promise<void> {
    const startTime = Date.now();
    
    log.info('[BackendManager] Waiting for backend to be ready...');
    
    while (Date.now() - startTime < timeoutMs) {
      try {
        const response = await fetch('http://localhost:4096/health', {
          signal: AbortSignal.timeout(500)
        });
        if (response.ok) {
          log.info('[BackendManager] Backend is ready!');
          return;
        }
      } catch {
        // Not ready yet
      }
      await new Promise(r => setTimeout(r, 100));
    }
    
    throw new Error('Backend failed to start within timeout');
  }
  
  /**
   * Get installed backend version
   */
  private async getInstalledVersion(): Promise<string | null> {
    const binaryPath = path.join(this.backendDir, 'bin', this.getBinaryName('allternit-api'));
    
    if (!fs.existsSync(binaryPath)) {
      return null;
    }
    
    try {
      const { stdout } = await execAsync(`"${binaryPath}" --version`);
      return stdout.trim();
    } catch {
      return null;
    }
  }
  
  /**
   * Update backend to match Desktop version
   */
  private async updateBackend(): Promise<void> {
    log.info('[BackendManager] Updating backend...');
    
    // Stop current backend
    await this.stopBackend();
    
    // Remove old backend
    fs.rmSync(this.backendDir, { recursive: true, force: true });
    
    // Extract new version
    await this.extractBundledBackend();
    
    log.info('[BackendManager] Backend updated to', PLATFORM_MANIFEST.backend.version);
  }
  
  /**
   * Create default backend config
   */
  private async createDefaultConfig(): Promise<void> {
    const jwtSecret = this.generateSecret(64);
    
    const config = `# Allternit Backend Configuration
# Generated: ${new Date().toISOString()}

server:
  host: 127.0.0.1
  port: 4096

api:
  cors_origins:
    - "http://localhost:3000"
    - "http://localhost:5173"

security:
  jwt_secret: "${jwtSecret}"

database:
  type: sqlite
  path: ${this.dataDir.replace(/\\/g, '/')}/allternit.db

storage:
  data_dir: ${this.dataDir.replace(/\\/g, '/')}
  logs_dir: ${this.logDir.replace(/\\/g, '/')}

logging:
  level: info
  file: ${this.logDir.replace(/\\/g, '/')}/allternit.log
`;
    
    fs.mkdirSync(path.dirname(this.configPath), { recursive: true });
    fs.writeFileSync(this.configPath, config);
    
    log.info('[BackendManager] Config created at:', this.configPath);
  }
  
  /**
   * Get path to bundled backend in app resources
   */
  private getBundledBackendPath(): string | null {
    const possiblePaths = [
      // Packaged app - macOS
      path.join(process.resourcesPath, 'backend'),
      // Packaged app - Windows/Linux
      path.join(process.resourcesPath, 'app', 'backend'),
      // Development - from repo
      path.join(__dirname, '..', '..', '..', 'bundled-backend', process.platform, process.arch),
    ];
    
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        return p;
      }
    }
    
    return null;
  }
  
  /**
   * Copy directory recursively
   */
  private copyDirectory(src: string, dest: string): void {
    fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src, { withFileTypes: true });
    
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      
      if (entry.isDirectory()) {
        this.copyDirectory(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }
  
  /**
   * Extract tar.gz archive
   */
  private async extractArchive(archivePath: string, destDir: string): Promise<void> {
    return new Promise((resolve, reject) => {
      fs.mkdirSync(destDir, { recursive: true });
      const tar = spawn('tar', ['-xzf', archivePath, '-C', destDir, '--strip-components=1']);
      
      tar.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Extraction failed with code ${code}`));
        }
      });
      
      tar.on('error', reject);
    });
  }
  
  /**
   * Get binary name with platform extension
   */
  private getBinaryName(name: string): string {
    return process.platform === 'win32' ? `${name}.exe` : name;
  }
  
  /**
   * Generate random secret
   */
  private generateSecret(length: number = 64): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}

export const backendManager = BackendManager.getInstance();
