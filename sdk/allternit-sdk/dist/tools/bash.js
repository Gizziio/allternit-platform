export class BashTool {
    runner;
    constructor(options = {}) {
        this.runner = options.runner ?? defaultBashRunner();
    }
    definition() {
        return {
            name: 'bash',
            description: 'Execute a shell command with optional timeout and restart control.',
            input_schema: {
                type: 'object',
                properties: {
                    command: { type: 'string', description: 'The shell command to execute' },
                    timeout: { type: 'integer', description: 'Timeout in seconds (default: 30)' },
                    restart: { type: 'boolean', description: 'Whether to restart a fresh shell environment' },
                },
                required: ['command'],
            },
            metadata: { category: 'system', isDestructive: true },
            execute: async (args) => {
                const command = requiredString(args.command, 'command');
                const timeout = typeof args.timeout === 'number' && args.timeout > 0 ? args.timeout : 30;
                const restart = args.restart === true;
                return this.runner.run({ command, timeout, restart });
            },
        };
    }
}
function defaultBashRunner() {
    return {
        run: async ({ command, timeout = 30 }) => {
            const { execFile } = await import('node:child_process');
            const { promisify } = await import('node:util');
            const execAsync = promisify(execFile);
            try {
                const { stdout, stderr } = await execAsync('sh', ['-c', command], {
                    timeout: timeout * 1000,
                    killSignal: 'SIGTERM',
                });
                return {
                    stdout: stdout ?? '',
                    stderr: stderr ?? '',
                    exit_code: 0,
                    success: true,
                };
            }
            catch (error) {
                return {
                    stdout: error.stdout ?? '',
                    stderr: error.stderr ?? error.message ?? '',
                    exit_code: typeof error.code === 'number' ? error.code : 1,
                    success: false,
                };
            }
        },
    };
}
function requiredString(value, name) {
    if (typeof value !== 'string' || value.length === 0)
        throw new Error(`${name} is required`);
    return value;
}
