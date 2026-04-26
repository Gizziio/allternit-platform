/**
 * Allternit VM Manager
 *
 * Provides a TypeScript interface to the Swift VM manager CLI by spawning it
 * as a child process. This keeps the Electron main process build pure TS while
 * still using the native Apple Virtualization-backed binary at runtime.
 */
import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
export class AllternitVMManager extends EventEmitter {
    constructor(config = {}) {
        super();
        const home = os.homedir();
        const vmImagesDir = path.join(home, '.allternit/vm-images');
        const arch = process.arch === 'x64'
            ? 'amd64'
            : process.arch === 'arm64'
                ? 'arm64'
                : process.arch;
        const archSuffix = arch === 'amd64' ? '' : `-${arch}`;
        const discoverImage = (prefix, suffix) => {
            try {
                const files = fs.readdirSync(vmImagesDir);
                const match = files.find((file) => file.startsWith(prefix) && file.endsWith(suffix));
                if (match) {
                    return path.join(vmImagesDir, match);
                }
            }
            catch {
                // The image directory may not exist yet on first run.
            }
            return undefined;
        };
        const defaultKernel = discoverImage('vmlinux-', `-allternit${archSuffix}`) ??
            discoverImage('vmlinux-', '-allternit');
        const defaultInitrd = discoverImage('initrd.img-', `-allternit${archSuffix}`) ??
            discoverImage('initrd.img-', '-allternit');
        const defaultRootfs = discoverImage('ubuntu-22.04-allternit-', `${archSuffix}.ext4`) ??
            discoverImage('ubuntu-22.04-allternit-', '.ext4');
        this.config = {
            vmName: config.vmName ?? 'allternit-vm',
            kernelPath: config.kernelPath ??
                defaultKernel ??
                path.join(vmImagesDir, `vmlinux-UNKNOWN-allternit${archSuffix}`),
            initrdPath: config.initrdPath ??
                defaultInitrd ??
                path.join(vmImagesDir, `initrd.img-UNKNOWN-allternit${archSuffix}`),
            rootfsPath: config.rootfsPath ??
                defaultRootfs ??
                path.join(vmImagesDir, `ubuntu-22.04-allternit-UNKNOWN${archSuffix}.ext4`),
            cpuCount: config.cpuCount ?? 4,
            memorySizeMB: config.memorySizeMB ?? 4096,
            vsockPort: config.vsockPort ?? 8080,
            socketPath: config.socketPath ?? path.join(home, '.allternit/desktop-vm.sock'),
        };
        this.status = {
            state: 'stopped',
            vmName: this.config.vmName,
            socketPath: this.config.socketPath,
            vsockPort: this.config.vsockPort,
        };
    }
    getCliPath() {
        const resourcesPath = process.resourcesPath ?? '';
        const possiblePaths = [
            path.join(resourcesPath, 'bin', 'vm-manager-cli'),
            path.join(__dirname, '..', '..', 'resources', 'bin', 'vm-manager-cli'),
            path.join(__dirname, '..', '..', 'vm-manager', '.build', 'release', 'vm-manager-cli'),
            '/usr/local/bin/vm-manager-cli',
        ];
        for (const candidate of possiblePaths) {
            if (fs.existsSync(candidate)) {
                return candidate;
            }
        }
        throw new Error('vm-manager-cli not found. Searched:\n' +
            possiblePaths.map((candidate) => `  - ${candidate}`).join('\n') +
            '\n\nBuild the Swift package or ensure resources/bin/vm-manager-cli is present.');
    }
    getStatus() {
        return { ...this.status };
    }
    isRunning() {
        return this.status.state === 'running';
    }
    async start() {
        if (this.isRunning()) {
            throw new Error('VM is already running');
        }
        this.updateStatus({ state: 'starting' });
        await new Promise((resolve, reject) => {
            const cliPath = this.getCliPath();
            const args = [
                'start',
                '--kernel',
                this.config.kernelPath,
                '--initrd',
                this.config.initrdPath,
                '--rootfs',
                this.config.rootfsPath,
                '--cpus',
                String(this.config.cpuCount),
                '--memory',
                String(this.config.memorySizeMB),
                '--socket',
                this.config.socketPath,
            ];
            this.vmProcess = spawn(cliPath, args, {
                detached: false,
                stdio: ['ignore', 'pipe', 'pipe'],
            });
            let stderr = '';
            let resolved = false;
            this.vmProcess.stdout?.on('data', (data) => {
                const output = data.toString();
                if (output.includes('[Status]')) {
                    const match = output.match(/\[Status\]\s+(\w+)/);
                    if (match) {
                        this.updateStatus({ state: match[1] });
                    }
                }
                if (!resolved && output.includes('VM started successfully')) {
                    resolved = true;
                    this.updateStatus({ state: 'running', uptime: 0 });
                    this.startStatusMonitoring();
                    resolve();
                }
            });
            this.vmProcess.stderr?.on('data', (data) => {
                stderr += data.toString();
            });
            this.vmProcess.on('error', (error) => {
                if (!resolved) {
                    this.updateStatus({ state: 'error', errorMessage: error.message });
                    reject(error);
                }
            });
            this.vmProcess.on('exit', (code) => {
                if (!resolved && code !== 0) {
                    this.updateStatus({
                        state: 'error',
                        errorMessage: `VM process exited with code ${code}\n${stderr}`,
                    });
                    reject(new Error(`VM failed to start: ${stderr}`));
                    return;
                }
                if (this.status.state === 'running') {
                    this.updateStatus({ state: 'stopped' });
                    this.emit('stopped');
                }
            });
            setTimeout(() => {
                if (!resolved && this.status.state === 'starting') {
                    this.vmProcess?.kill();
                    reject(new Error('VM start timeout'));
                }
            }, 60000);
        });
    }
    async stop() {
        if (!this.isRunning()) {
            return;
        }
        this.updateStatus({ state: 'stopping' });
        await new Promise((resolve, reject) => {
            const proc = spawn(this.getCliPath(), ['stop'], {
                stdio: ['ignore', 'pipe', 'pipe'],
            });
            let stderr = '';
            proc.stderr?.on('data', (data) => {
                stderr += data.toString();
            });
            proc.on('exit', (code) => {
                this.stopStatusMonitoring();
                if (code === 0) {
                    this.vmProcess?.kill();
                    this.vmProcess = undefined;
                    this.updateStatus({ state: 'stopped' });
                    resolve();
                    return;
                }
                reject(new Error(`Failed to stop VM: ${stderr}`));
            });
        });
    }
    async restart() {
        await this.stop();
        await this.start();
    }
    async execute(command, args = [], options = {}) {
        if (!this.isRunning()) {
            throw new Error('VM is not running');
        }
        return new Promise((resolve, reject) => {
            const proc = spawn(this.getCliPath(), ['exec', command, ...args], {
                stdio: ['ignore', 'pipe', 'pipe'],
                timeout: options.timeout ?? 60000,
            });
            let stdout = '';
            let stderr = '';
            const startTime = Date.now();
            proc.stdout?.on('data', (data) => {
                stdout += data.toString();
            });
            proc.stderr?.on('data', (data) => {
                stderr += data.toString();
            });
            proc.on('exit', (code) => {
                resolve({
                    success: code === 0,
                    stdout,
                    stderr,
                    exitCode: code ?? -1,
                    executionTime: Date.now() - startTime,
                });
            });
            proc.on('error', (error) => {
                reject(error);
            });
        });
    }
    async checkImages() {
        const requiredFiles = [this.config.kernelPath, this.config.initrdPath, this.config.rootfsPath];
        return requiredFiles.every((filePath) => fs.existsSync(filePath));
    }
    async setup() {
        await new Promise((resolve, reject) => {
            const proc = spawn(this.getCliPath(), ['setup'], {
                stdio: ['ignore', 'pipe', 'pipe'],
            });
            let stderr = '';
            proc.stderr?.on('data', (data) => {
                stderr += data.toString();
            });
            proc.on('exit', (code) => {
                if (code === 0) {
                    resolve();
                    return;
                }
                reject(new Error(`Setup failed: ${stderr}`));
            });
        });
    }
    updateStatus(updates) {
        this.status = { ...this.status, ...updates };
        this.emit('statusChanged', this.status);
    }
    startStatusMonitoring() {
        this.statusCheckInterval = setInterval(() => {
            if (this.status.state === 'running' && this.status.uptime !== undefined) {
                this.status.uptime += 1;
            }
        }, 1000);
    }
    stopStatusMonitoring() {
        if (this.statusCheckInterval) {
            clearInterval(this.statusCheckInterval);
            this.statusCheckInterval = undefined;
        }
    }
    dispose() {
        this.stopStatusMonitoring();
        this.vmProcess?.kill();
    }
}
export function createVMManager(config) {
    return new AllternitVMManager(config);
}
export default AllternitVMManager;
//# sourceMappingURL=index.js.map