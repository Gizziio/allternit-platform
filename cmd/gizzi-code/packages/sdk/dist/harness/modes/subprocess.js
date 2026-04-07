/**
 * Subprocess Mode
 * Spawns external CLI tools as AI backends
 */
import { APIConnectionError, APIUserAbortError, } from '../../providers/anthropic';
import { AllternitError } from '../../providers/anthropic/core/error';
/**
 * Default timeout for subprocess execution (60 seconds)
 */
const DEFAULT_TIMEOUT = 60000;
/**
 * Stream from subprocess CLI tool
 */
export async function* streamFromSubprocess(config, request) {
    const signal = request.signal;
    const timeout = config.timeout ?? DEFAULT_TIMEOUT;
    try {
        // Check for cancellation before starting
        if (signal?.aborted) {
            yield { type: 'error', error: new APIUserAbortError() };
            return;
        }
        // Parse command
        const args = parseCommand(config.command);
        if (args.length === 0) {
            throw new AllternitError('Empty command provided for subprocess mode');
        }
        const [cmd, ...cmdArgs] = args;
        // Build prompt from messages
        const prompt = buildPrompt(request.messages);
        // Spawn subprocess using Bun.spawn if available, otherwise use Node child_process
        yield* spawnAndStream(cmd, cmdArgs, prompt, config, timeout, signal);
    }
    catch (error) {
        // Handle cancellation
        if (signal?.aborted) {
            yield { type: 'error', error: new APIUserAbortError() };
            return;
        }
        // Re-yield harness errors
        if (error instanceof AllternitError) {
            yield { type: 'error', error };
            return;
        }
        // Wrap unknown errors
        const harnessError = new AllternitError(error instanceof Error ? error.message : 'Unknown error in Subprocess mode');
        yield { type: 'error', error: harnessError };
    }
}
/**
 * Spawn subprocess and stream output
 */
async function* spawnAndStream(cmd, args, prompt, config, timeout, signal) {
    // Check if Bun.spawn is available
    if (typeof Bun !== 'undefined' && Bun.spawn) {
        yield* spawnWithBun(cmd, args, prompt, config, timeout, signal);
    }
    else {
        yield* spawnWithNode(cmd, args, prompt, config, timeout, signal);
    }
}
/**
 * Spawn subprocess using Bun.spawn
 */
async function* spawnWithBun(cmd, args, prompt, config, timeout, signal) {
    // Create abort controller for timeout
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), timeout);
    // Handle external abort signal
    if (signal) {
        signal.addEventListener('abort', () => abortController.abort());
    }
    try {
        const proc = Bun.spawn([cmd, ...args], {
            cwd: config.cwd,
            env: { ...process.env, ...config.env },
            stdin: 'pipe',
            stdout: 'pipe',
            stderr: 'pipe',
            signal: abortController.signal,
        });
        // Write prompt to stdin
        const stdin = proc.stdin;
        if (stdin) {
            await stdin.write(prompt);
            await stdin.end();
        }
        // Read stdout
        const stdout = proc.stdout;
        if (stdout) {
            const reader = stdout.getReader();
            const decoder = new TextDecoder();
            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done)
                        break;
                    const text = decoder.decode(value, { stream: true });
                    if (text) {
                        yield { type: 'text', text };
                    }
                }
            }
            finally {
                reader.releaseLock();
            }
        }
        // Wait for process to exit
        const exitCode = await proc.exited;
        if (exitCode !== 0) {
            // Read stderr for error message
            const stderr = proc.stderr;
            let errorMessage = `Subprocess exited with code ${exitCode}`;
            if (stderr) {
                const reader = stderr.getReader();
                const decoder = new TextDecoder();
                try {
                    const { value } = await reader.read();
                    if (value) {
                        errorMessage = decoder.decode(value);
                    }
                }
                finally {
                    reader.releaseLock();
                }
            }
            yield {
                type: 'error',
                error: new AllternitError(`Subprocess error: ${errorMessage}`),
            };
            return;
        }
        yield { type: 'done' };
    }
    finally {
        clearTimeout(timeoutId);
    }
}
/**
 * Spawn subprocess using Node.js child_process
 */
async function* spawnWithNode(cmd, args, prompt, config, timeout, signal) {
    // Use the streaming generator version
    yield* nodeSpawnGenerator(cmd, args, prompt, config, timeout, signal);
}
/**
 * Non-blocking generator wrapper for Node spawn
 */
async function* nodeSpawnGenerator(cmd, args, prompt, config, timeout, signal) {
    const { spawn } = await import('child_process');
    const proc = spawn(cmd, args, {
        cwd: config.cwd,
        env: { ...process.env, ...config.env },
        timeout,
    });
    // Write prompt to stdin
    if (proc.stdin) {
        proc.stdin.write(prompt, 'utf-8');
        proc.stdin.end();
    }
    // Set up abort handling
    if (signal) {
        signal.addEventListener('abort', () => {
            proc.kill('SIGTERM');
        });
    }
    // Collect stdout chunks
    const chunks = [];
    let stderr = '';
    let exitCode = null;
    let finished = false;
    proc.stdout?.on('data', (data) => {
        const text = data.toString('utf-8');
        chunks.push(text);
    });
    proc.stderr?.on('data', (data) => {
        stderr += data.toString('utf-8');
    });
    proc.on('close', (code) => {
        exitCode = code;
        finished = true;
    });
    proc.on('error', (error) => {
        stderr = error.message;
        finished = true;
    });
    // Yield chunks as they arrive
    let yieldedCount = 0;
    while (!finished) {
        await new Promise((resolve) => setTimeout(resolve, 10));
        while (yieldedCount < chunks.length) {
            yield { type: 'text', text: chunks[yieldedCount] };
            yieldedCount++;
        }
        if (signal?.aborted) {
            proc.kill('SIGTERM');
            yield { type: 'error', error: new APIUserAbortError() };
            return;
        }
    }
    // Yield any remaining chunks
    while (yieldedCount < chunks.length) {
        yield { type: 'text', text: chunks[yieldedCount] };
        yieldedCount++;
    }
    // Check exit code
    if (exitCode !== 0 && exitCode !== null) {
        yield {
            type: 'error',
            error: new AllternitError(`Subprocess exited with code ${exitCode}: ${stderr || 'Unknown error'}`),
        };
        return;
    }
    yield { type: 'done' };
}
/**
 * Execute subprocess without streaming (for non-streaming API)
 */
export async function executeSubprocess(config, messages, signal) {
    const timeout = config.timeout ?? DEFAULT_TIMEOUT;
    const prompt = buildPrompt(messages);
    const args = parseCommand(config.command);
    if (args.length === 0) {
        throw new AllternitError('Empty command provided for subprocess mode');
    }
    const [cmd, ...cmdArgs] = args;
    // Use Bun.spawn if available
    if (typeof Bun !== 'undefined' && Bun.spawn) {
        const abortController = new AbortController();
        const timeoutId = setTimeout(() => abortController.abort(), timeout);
        if (signal) {
            signal.addEventListener('abort', () => abortController.abort());
        }
        try {
            const proc = Bun.spawn([cmd, ...cmdArgs], {
                cwd: config.cwd,
                env: { ...process.env, ...config.env },
                stdin: 'pipe',
                stdout: 'pipe',
                stderr: 'pipe',
                signal: abortController.signal,
            });
            // Write prompt
            const stdin = proc.stdin;
            if (stdin) {
                await stdin.write(prompt);
                await stdin.end();
            }
            // Collect output
            const stdout = proc.stdout;
            let content = '';
            if (stdout) {
                const reader = stdout.getReader();
                const decoder = new TextDecoder();
                try {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done)
                            break;
                        content += decoder.decode(value, { stream: true });
                    }
                }
                finally {
                    reader.releaseLock();
                }
            }
            const exitCode = await proc.exited;
            if (exitCode !== 0) {
                const stderr = proc.stderr;
                let errorMessage = '';
                if (stderr) {
                    const reader = stderr.getReader();
                    const decoder = new TextDecoder();
                    try {
                        const { value } = await reader.read();
                        if (value) {
                            errorMessage = decoder.decode(value);
                        }
                    }
                    finally {
                        reader.releaseLock();
                    }
                }
                throw new AllternitError(`Subprocess error (exit ${exitCode}): ${errorMessage || 'Unknown error'}`);
            }
            return {
                content: content.trim(),
                usage: { input_tokens: 0, output_tokens: 0 }, // Subprocess doesn't provide token counts
            };
        }
        finally {
            clearTimeout(timeoutId);
        }
    }
    else {
        // Use Node.js child_process
        const { spawn } = await import('child_process');
        return new Promise((resolve, reject) => {
            const proc = spawn(cmd, cmdArgs, {
                cwd: config.cwd,
                env: { ...process.env, ...config.env },
                timeout,
            });
            let stdout = '';
            let stderr = '';
            if (signal) {
                signal.addEventListener('abort', () => {
                    proc.kill('SIGTERM');
                    reject(new APIUserAbortError());
                });
            }
            proc.stdout?.on('data', (data) => {
                stdout += data.toString('utf-8');
            });
            proc.stderr?.on('data', (data) => {
                stderr += data.toString('utf-8');
            });
            proc.on('error', (error) => {
                reject(new APIConnectionError({ message: error.message, cause: error }));
            });
            proc.on('close', (code) => {
                if (code !== 0 && code !== null) {
                    reject(new AllternitError(`Subprocess exited with code ${code}: ${stderr || 'Unknown error'}`));
                }
                else {
                    resolve({
                        content: stdout.trim(),
                        usage: { input_tokens: 0, output_tokens: 0 },
                    });
                }
            });
            if (proc.stdin) {
                proc.stdin.write(prompt, 'utf-8');
                proc.stdin.end();
            }
        });
    }
}
// ============================================================================
// Utility Functions
// ============================================================================
/**
 * Parse a command string into arguments
 * Handles basic quoting (both single and double quotes)
 */
function parseCommand(command) {
    const args = [];
    let current = '';
    let inQuotes = null;
    for (let i = 0; i < command.length; i++) {
        const char = command[i];
        if (inQuotes) {
            if (char === inQuotes) {
                inQuotes = null;
            }
            else {
                current += char;
            }
        }
        else {
            if (char === '"' || char === "'") {
                inQuotes = char;
            }
            else if (char === ' ') {
                if (current) {
                    args.push(current);
                    current = '';
                }
            }
            else {
                current += char;
            }
        }
    }
    if (current) {
        args.push(current);
    }
    return args;
}
/**
 * Build a prompt string from messages
 * Combines all messages into a single string for subprocess input
 */
function buildPrompt(messages) {
    return messages
        .map((msg) => {
        const role = msg.role === 'system' ? 'System' : msg.role === 'assistant' ? 'Assistant' : 'User';
        if (typeof msg.content === 'string') {
            return `${role}: ${msg.content}`;
        }
        // Handle complex content - extract text parts
        const textParts = msg.content
            .filter((block) => block.type === 'text')
            .map((block) => block.text);
        return `${role}: ${textParts.join('\n')}`;
    })
        .join('\n\n');
}
//# sourceMappingURL=subprocess.js.map