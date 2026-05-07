import { spawn } from 'node:child_process';
export class HostEnvironment {
    async execute(command, args = [], options = {}) {
        const { workingDir, env, timeout = 60_000 } = options;
        return new Promise((resolve, reject) => {
            const proc = spawn(command, args, {
                cwd: workingDir,
                env: { ...process.env, ...env },
            });
            let stdout = '';
            let stderr = '';
            let done = false;
            const timer = setTimeout(() => {
                if (!done) {
                    done = true;
                    proc.kill();
                    reject(new Error(`Host command timed out after ${timeout}ms: ${command}`));
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
}
