import { spawn, execFile } from 'node:child_process';
export const VM_NAME = 'allternit';
export class LimaEnvironment {
    /**
     * Execute a command inside the Lima VM
     */
    async execute(command, args = [], options = {}) {
        const { workingDir, env, timeout = 60_000 } = options;
        // Build the shell command for the guest
        const shellCmd = workingDir
            ? `cd ${JSON.stringify(workingDir)} && ${[command, ...args].map(a => JSON.stringify(a)).join(' ')}`
            : [command, ...args].map(a => JSON.stringify(a)).join(' ');
        return new Promise((resolve, reject) => {
            const proc = spawn('limactl', ['shell', VM_NAME, '--', 'sh', '-c', shellCmd], {
                env: { ...process.env, ...env },
            });
            let stdout = '';
            let stderr = '';
            let done = false;
            const timer = setTimeout(() => {
                if (!done) {
                    done = true;
                    proc.kill();
                    reject(new Error(`Lima VM command timed out after ${timeout}ms: ${command}`));
                }
            }, timeout);
            proc.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
            proc.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
            proc.on('close', (code) => {
                if (done)
                    return;
                done = true;
                clearTimeout(timer);
                resolve({ stdout, stderr, exitCode: code ?? 0 });
            });
            proc.on('error', (err) => {
                if (done)
                    return;
                done = true;
                clearTimeout(timer);
                reject(err);
            });
        });
    }
    async getStatus() {
        return new Promise((resolve) => {
            execFile('limactl', ['--version'], { timeout: 3000 }, (err) => {
                if (err)
                    return resolve('not-installed');
                execFile('limactl', ['list', VM_NAME, '--format', 'json'], { timeout: 5000 }, (listErr, stdout) => {
                    if (listErr || !stdout.trim())
                        return resolve('stopped');
                    try {
                        const rows = JSON.parse(stdout);
                        const vm = Array.isArray(rows) ? rows.find((v) => v.name === VM_NAME) : null;
                        if (!vm)
                            return resolve('stopped');
                        if (vm.status === 'Running')
                            return resolve('running');
                        return resolve('stopped');
                    }
                    catch {
                        resolve('error');
                    }
                });
            });
        });
    }
}
